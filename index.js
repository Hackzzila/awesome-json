'use strict';

const path = require('path');
const zlib = require('zlib');
const yaml = require('js-yaml');
const BSON = require('bson');

let defaultFs;
try {
  defaultFs = require('graceful-fs');
} catch (_) {
  defaultFs = require('fs');
}

let MsgpackEncoder;
try {
  const msgpack = require('msgpack'); // eslint-disable-line import/no-unresolved

  MsgpackEncoder = class Encoder {
    static encodeSync(obj) {
      return msgpack.pack(obj);
    }

    static encode(obj, callback) {
      try {
        callback(null, this.encodeSync(obj));
      } catch (err) {
        callback(err, null);
      }
    }

    static decodeSync(string) {
      return msgpack.unpack(string);
    }

    static decode(string, callback) {
      try {
        callback(null, this.decodeSync(string));
      } catch (err) {
        callback(err, null);
      }
    }
  };
} catch (_) {
  const msgpack = require('msgpack-js');

  MsgpackEncoder = class Encoder {
    static encodeSync(obj) {
      return msgpack.encode(obj);
    }

    static encode(obj, callback) {
      try {
        callback(null, this.encodeSync(obj));
      } catch (err) {
        callback(err, null);
      }
    }

    static decodeSync(string) {
      return msgpack.decode(string);
    }

    static decode(string, callback) {
      try {
        callback(null, this.decodeSync(string));
      } catch (err) {
        callback(err, null);
      }
    }
  };
}

const bson = new BSON();
const files = {};

class JsonEncoder {
  static encodeSync(obj) {
    return JSON.stringify(obj);
  }

  static encode(obj, callback) {
    try {
      callback(null, this.encodeSync(obj));
    } catch (err) {
      callback(err, null);
    }
  }

  static decodeSync(string) {
    return JSON.parse(string);
  }

  static decode(string, callback) {
    try {
      callback(null, this.decodeSync(string));
    } catch (err) {
      callback(err, null);
    }
  }
}

class YamlEncoder {
  static encodeSync(obj) {
    return yaml.dump(obj);
  }

  static encode(obj, callback) {
    try {
      callback(null, this.encodeSync(obj));
    } catch (err) {
      callback(err, null);
    }
  }

  static decodeSync(string) {
    return yaml.load(string);
  }

  static decode(string, callback) {
    try {
      callback(null, this.decodeSync(string));
    } catch (err) {
      callback(err, null);
    }
  }
}

class BsonEncoder {
  static encodeSync(obj) {
    return bson.serialize(obj);
  }

  static encode(obj, callback) {
    try {
      callback(null, this.encodeSync(obj));
    } catch (err) {
      callback(err, null);
    }
  }

  static decodeSync(string) {
    return bson.deserialize(string);
  }

  static decode(string, callback) {
    try {
      callback(null, this.decodeSync(string));
    } catch (err) {
      callback(err, null);
    }
  }
}

class ZlibEncoder {
  constructor(encoderOrFile) {
    if (typeof encoderOrFile !== 'string') this.encoder = encoderOrFile;
    else this.encoder = findEncoder(encoderOrFile); // eslint-disable-line
  }

  encodeSync(obj) {
    return zlib.deflateSync(this.encoder.encodeSync(obj));
  }

  encode(obj, callback) {
    this.encoder.encode(obj, (err, string) => {
      if (err) callback(err, null); else {
        zlib.deflate(string, (e, buffer) => {
          if (e) callback(err, null); else {
            callback(null, buffer);
          }
        });
      }
    });
  }

  decodeSync(string) {
    return this.encoder.decodeSync(zlib.unzipSync(string));
  }

  decode(string, callback) {
    zlib.unzip(string, (err, buffer) => {
      if (err) callback(err, null); else {
        this.encoder.decode(buffer.toString(), (e, obj) => {
          if (e) callback(e, null); else {
            callback(null, obj);
          }
        });
      }
    });
  }
}

process.on('exit', () => {
  for (const file in files) {
    files[file].fs.writeFileSync(file, files[file].encoder.encodeSync(files[file].content));
  }
});

function findEncoder(file) {
  if (path.parse(file).ext === '.yaml' || path.parse(file).ext === '.yml') return YamlEncoder;
  else if (path.parse(file).ext === '.bson') return BsonEncoder;
  else if (path.parse(file).ext === '.mp') return MsgpackEncoder;
  else if (path.parse(file).ext === '.gz') return new ZlibEncoder(path.parse(file).name);
  return JsonEncoder;
}

function watch(file, contents, opts, encoder) {
  const options = Object.assign({ writeFrequency: 5000 }, opts);
  const fs = options.fs || defaultFs;

  let onFile = Object.assign({}, contents);
  let current = Object.assign({}, contents);

  if (options.writeFrequency !== 0) {
    setInterval(() => {
      if (onFile !== current) {
        encoder.encode(current, (error, encoded) => {
          if (error) throw error;
          fs.writeFile(file, encoded, (err) => {
            if (err) throw err;
            onFile = current;
          });
        });
      }
    }, options.writeFrequency).unref();
  }

  return new Proxy(contents, {
    set: (obj, prop, value) => {
      obj[prop] = value; // eslint-disable-line

      files[file] = { content: obj, encoder, fs };

      if (options.writeFrequency !== 0) {
        current = obj;
      } else {
        encoder.encode(obj, (error, encoded) => {
          if (error) throw error;
          fs.writeFile(file, encoded, (err) => {
            if (err) throw err;
          });
        });
      }

      return true;
    },

    deleteProperty: (obj, prop) => {
      delete obj[prop]; // eslint-disable-line

      files[file] = { content: obj, encoder, fs };

      if (options.writeFrequency !== 0) {
        current = obj;
      } else {
        encoder.encode(obj, (error, encoded) => {
          if (error) throw error;
          fs.writeFile(file, encoded, (err) => {
            if (err) throw err;
          });
        });
      }

      return true;
    },
  });
}

module.exports = {
  read: (filename, opts, cb) => new Promise((resolve, reject) => {
    let file = filename;
    let callback = cb;
    let options = opts || {};

    if (typeof opts === 'function') {
      callback = opts;
      options = {};
    }

    if (typeof options === 'string') {
      options = { encoding: options };
    }

    const fs = options.fs || defaultFs;

    let encoder = JsonEncoder;

    fs.readFile(file, { encoding: options.encoding }, (error, contents) => {
      if (error && error.code === 'ENOENT') {
        file = `${file}.json`;
        fs.readFile(file, { encoding: options.encoding }, (e, c) => {
          if (e) {
            if (typeof callback === 'function') callback(e, null);
            reject(e);
          }

          encoder.decode(c, (err, obj) => {
            if (err) {
              if (typeof callback === 'function') callback(err, null);
              reject(err);
            }

            const result = watch(file, obj || {}, options, encoder);
            if (typeof callback === 'function') callback(null, result);
            resolve(result);
          });
        });
      } else if (error) {
        if (typeof callback === 'function') callback(error, null);
        reject(error);
      } else {
        encoder = findEncoder(file);

        encoder.decode(contents, (err, obj) => {
          if (err) {
            if (typeof callback === 'function') callback(err, null);
            reject(err);
          }

          const result = watch(file, obj || {}, options, encoder);
          if (typeof callback === 'function') callback(null, result);
          resolve(result);
        });
      }
    });
  }),

  readSync: (filename, opts) => {
    let file = filename;
    let options = opts || {};

    if (typeof options === 'string') {
      options = { encoding: options };
    }

    const fs = options.fs || defaultFs;

    let contents;
    try {
      contents = fs.readFileSync(file, { encoding: options.encoding });
    } catch (error) {
      if (error.code === 'ENOENT') {
        contents = fs.readFileSync(`${file}.json`, { encoding: options.encoding });
        file = `${file}.json`;
      } else {
        throw error;
      }
    }

    const encoder = findEncoder(file);

    return watch(file, encoder.decodeSync(contents) || {}, options, encoder);
  },
};
