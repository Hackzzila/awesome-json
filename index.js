const fs = require('fs');

function watch(file, contents, opts) {
  const options = Object.assign({ writeFrequency: 5000 }, opts);

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
  });
}

module.exports = {
  read: (file, opts, cb) => new Promise((resolve, reject) => {
    let callback = cb;
    let options = opts;

    if (typeof opts === 'function') {
      callback = opts;
      options = {};
    }

    fs.readFile(file, (error, contents) => {
      if (error) {
        if (typeof callback === 'function') callback(error, null);
        reject(error);
      }

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
    });
  }),

  readSync: (file, opts) => {
    let options = opts;

    if (typeof opts === 'object') {
      options = {};
    }

    const contents = fs.readFileSync(file);

    let json;
    try {
      json = JSON.parse(contents);
    } catch (err) {
      throw err;
    }

    return watch(file, json, options);
  },
};
