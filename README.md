# awesome-json
[![Build Status](https://travis-ci.org/Hackzzila/awesome-json.svg?branch=master)](https://travis-ci.org/Hackzzila/awesome-json)
[![dependencies Status](https://david-dm.org/hackzzila/awesome-json/status.svg)](https://david-dm.org/hackzzila/awesome-json)
[![optionalDependencies Status](https://david-dm.org/hackzzila/awesome-json/optional-status.svg)](https://david-dm.org/hackzzila/awesome-json?type=optional)

## About
awesome-json is a simple system for reading JSON (plus BSON, YAML, and MsgPack) files, and automatically writing to the JSON (or BSON/YAML/MsgPack) file whenever the object is updated. awesome-json supports gzip compression as well.


## Installation
```
npm install --save awesome-json
```

## API
### read(filename, [options], callback)
Returns: `Promise`  

`options`  
* `fs`: any fs module backwards compatible with `fs`
* `encoding`: encoding to use while reading the file
* `writeFrequency` (default: 5000): the length of the interval to write changes in milliseconds, writes immediately if `0`

Reads a JSON file, and watches for changes. Automatically appends `.json` if the file isn't found.

```js
const json = require('awesome-json');

json.read('test', (err, contents) => {
  if (err) throw err;
  contents.baz = 1; // This change is automatically written to the file.
});
```

### readSync(filename, [options])
Returns: `Object`  

`options`  
* `fs`: any fs module backwards compatible with `fs`
* `encoding`: encoding to use while reading the file
* `writeFrequency` (default: 5000): the length of the interval to write changes in milliseconds, writes immediately if `0`

Reads a JSON file, and watches for changes. Automatically appends `.json` if the file isn't found.

```js
const json = require('awesome-json');

const contents = json.readSync('test');

contents.baz = 1; // This change is automatically written to the file.
```
