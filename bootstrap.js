var assert = require("node:assert/strict").ok;
var assertEqual = require("node:assert/strict").deepEqual;

function dbg(...args) {
  console.log(...args); return args[0];
}
