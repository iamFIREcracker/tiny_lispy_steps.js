var assert = require("node:assert/strict").ok;
var assertEqual = require("node:assert/strict").deepEqual;

function dbg(...args) {
  console.log(
    ...args.map((v) =>
      util.inspect(v, { showHidden: false, depth: null, colors: true }),
    ),
  );
  return args[0];
}

function top(y) {
  return y[0];
}

function butTop(y) {
  return y.slice(1);
}

function push(x, y) {
  return [x, ...y];
}
