var StringStream = function (string, start = 0) {
  this.string = string;
  this.start = 0;
};
StringStream.prototype.peekChar = function () {
  return this.string.charAt(this.start);
};
StringStream.prototype.readChar = function () {
  assert(
    this.start < this.string.length,
    "Trying to read a character out of bounds.",
  );
  const ch = this.string.charAt(this.start);
  this.start++;
  return ch;
};

function readFromString(string, start = 0) {
  const s = new StringStream(string, start);
  return parseExpression(s);
}

function parseExpression(s) {
  skipWhitespace(s);
  return parseAtom(s) ?? parseList(s);
}

var WHITES = [" ", "	", "\n", "\r"];

function skipWhitespace(s) {
  let skipped = 0;
  while (WHITES.includes(s.peekChar())) {
    s.readChar();
    skipped++;
  }
  return skipped;
}

function parseAtom(s) {
  if (!"()".includes(s.peekChar())) {
    let atom = s.readChar();
    while (!WHITES.includes(s.peekChar()) && !"()".includes(s.peekChar())) {
      atom = `${atom}${s.readChar()}`;
    }
    if (atom) {
      if (!isNaN(atom)) {
        atom = Number(atom);
      } else if (atom.startsWith('"') && atom.endsWith('"')) {
        atom = ["STRING", atom.slice(1, -1)];
      } else {
        atom = atom.toUpperCase();
      }
    }
    return atom;
  }
}

function parseList(s) {
  if (s.peekChar() === "(") {
    s.readChar(); // swallow parenthesis
    const ret = [];
    let parsed;
    while ((parsed = parseExpression(s))) {
      ret.push(parsed);
    }
    assert(s.readChar() === ")", "Expected )");
    return ret;
  }
}
