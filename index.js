let defaultFs;
try {
  defaultFs = require('graceful-fs');
} catch (_) {
  defaultFs = require('fs');
}

function watch(file, contents, opts) {
  const options = Object.assign({ writeFrequency: 5000 }, opts);
  const fs = options.fs || defaultFs;

  let onFile = Object.assign({}, contents);
  let current = Object.assign({}, contents);

  if (options.writeFrequency !== 0) {
    setInterval(() => {
      if (onFile !== current) {
        fs.writeFile(file, JSON.stringify(current), (err) => {
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
        fs.writeFile(file, JSON.stringify(obj), (err) => {
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
        fs.writeFile(file, JSON.stringify(obj), (err) => {
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

    fs.readFile(file, { encoding: options.encoding }, (error, contents) => {
      if (error && error.code === 'ENOENT') {
        file = `${file}.json`;
        fs.readFile(file, { encoding: options.encoding }, (e, c) => {
          if (e) {
            if (typeof callback === 'function') callback(e, null);
            reject(e);
          }

          let json;
          try {
            json = JSON.parse(c);
          } catch (err) {
            if (typeof callback === 'function') callback(err, null);
            reject(err);
          }

          const result = watch(file, json, options);
          if (typeof callback === 'function') callback(null, result);
          resolve(result);
        });
      } else if (error) {
        if (typeof callback === 'function') callback(error, null);
        reject(error);
      } else {
        let json;
        try {
          json = JSON.parse(contents);
        } catch (err) {
          if (typeof callback === 'function') callback(err, null);
          reject(err);
        }

        const result = watch(file, json, options);
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

    let json;
    try {
      json = JSON.parse(contents);
    } catch (err) {
      throw err;
    }

    return watch(file, json, options);
  },
};
