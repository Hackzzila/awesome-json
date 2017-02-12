const path = require('path');
const yaml = require('js-yaml');
const BSON = require('bson');

let defaultFs;
try {
  defaultFs = require('graceful-fs');
} catch (_) {
  defaultFs = require('fs');
}

const bson = new BSON();

class JsonEncoder {
  static encode(obj) {
    return JSON.stringify(obj);
  }

  static decode(string) {
    return JSON.parse(string);
  }
}

class YamlEncoder {
  static encode(obj) {
    return yaml.dump(obj);
  }

  static decode(string) {
    return yaml.load(string);
  }
}

class BsonEncoder {
  static encode(obj) {
    return bson.serialize(obj);
  }

  static decode(string) {
    return bson.deserialize(string);
  }
}

function watch(file, contents, opts, encoder) {
  const options = Object.assign({ writeFrequency: 5000 }, opts);
  const fs = options.fs || defaultFs;

  let onFile = Object.assign({}, contents);
  let current = Object.assign({}, contents);

  if (options.writeFrequency !== 0) {
    setInterval(() => {
      if (onFile !== current) {
        fs.writeFile(file, encoder.encode(current), (err) => {
          if (err) throw err;
          onFile = current;
        });
      }
    }, options.writeFrequency);
  }

  return new Proxy(contents, {
    set: (obj, prop, value) => {
      obj[prop] = value; // eslint-disable-line

      if (options.writeFrequency !== 0) {
        current = obj;
      } else {
        fs.writeFile(file, encoder.encode(obj), (err) => {
          if (err) throw err;
        });
      }

      return true;
    },

    deleteProperty: (obj, prop) => {
      delete obj[prop]; // eslint-disable-line

      if (options.writeFrequency !== 0) {
        current = obj;
      } else {
        fs.writeFile(file, encoder.encode(obj), (err) => {
          if (err) throw err;
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

          let obj;
          try {
            obj = encoder.decode(c) || {};
          } catch (err) {
            if (typeof callback === 'function') callback(err, null);
            reject(err);
          }

          const result = watch(file, obj, options, encoder);
          if (typeof callback === 'function') callback(null, result);
          resolve(result);
        });
      } else if (error) {
        if (typeof callback === 'function') callback(error, null);
        reject(error);
      } else {
        if (path.parse(file).ext === '.yaml' || path.parse(file).ext === '.yml') encoder = YamlEncoder;
        else if (path.parse(file).ext === '.bson') encoder = BsonEncoder;

        let obj;
        try {
          obj = encoder.decode(contents) || {};
        } catch (err) {
          if (typeof callback === 'function') callback(err, null);
          reject(err);
        }

        const result = watch(file, obj, options, encoder);
        if (typeof callback === 'function') callback(null, result);
        resolve(result);
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

    let encoder = JsonEncoder;
    if (path.parse(file).ext === '.yaml' || path.parse(file).ext === '.yml') encoder = YamlEncoder;
    else if (path.parse(file).ext === '.bson') encoder = BsonEncoder;

    let obj;
    try {
      obj = encoder.decode(contents) || {};
    } catch (err) {
      throw err;
    }

    return watch(file, obj, options, encoder);
  },
};
