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

function readAllFromString(string, start = 0) {
  const s = new StringStream(string, start);
  const ret = [];
  while (true) {
    parsed = parseExpression(s);
    if (parsed == null) break;
    ret.push(parsed);
  }
  return ret;
}

function parseExpression(s) {
  while (skipWhitespace(s) > 0 || skipComments(s) > 0) {}
  return parseQuote(s) ?? parseQuasiquote(s) ?? parseUnquote(s) ?? parseAtom(s) ?? parseList(s);
}

function parseQuote(s) {
  if (s.peekChar() === "'") {
    s.readChar(); // consume the quote character
    const expr = parseExpression(s);
    return ["quote", expr];
  }
}

function parseQuasiquote(s) {
  if (s.peekChar() === '`') {
    s.readChar(); // consume the backtick character
    const expr = parseExpression(s);
    return ["quasiquote", expr];
  }
}

function parseUnquote(s) {
  if (s.peekChar() === ',') {
    s.readChar(); // consume the comma character
    
    // Check if the next character is '@' for splicing
    if (s.peekChar() === '@') {
      s.readChar(); // consume the @ character
      const expr = parseExpression(s);
      return ["unquote-splicing", expr];
    } else {
      const expr = parseExpression(s);
      return ["unquote", expr];
    }
  }
}

var WHITES = [" ", "	"];
var NEWLINE_MARKERS = ["\n", "\r"];

function skipWhitespace(s) {
  let skipped = 0;
  while (
    WHITES.includes(s.peekChar()) ||
    NEWLINE_MARKERS.includes(s.peekChar())
  ) {
    s.readChar();
    skipped++;
  }
  return skipped;
}

function skipComments(s) {
  let skipped = 0;
  if (s.peekChar() === ";") {
    s.readChar();
    skipped += 1;
    while (!NEWLINE_MARKERS.includes(s.peekChar())) {
      s.readChar();
      skipped += 1;
    }
    if (NEWLINE_MARKERS.includes(s.peekChar())) {
      s.readChar();
      skipped += 1;
    }
  }
  return skipped;
}

function parseAtom(s) {
  if (!"()".includes(s.peekChar())) {
    let atom = s.readChar();
    while (
      !WHITES.includes(s.peekChar()) &&
      !NEWLINE_MARKERS.includes(s.peekChar()) &&
      !"()".includes(s.peekChar())
    ) {
      atom = `${atom}${s.readChar()}`;
    }
    if (!isNaN(atom)) {
      atom = Number(atom);
    } else if (atom.startsWith('"') && atom.endsWith('"')) {
      atom = ["lit", "str", atom.slice(1, -1)];
    } else {
      atom = atom;
    }
    return atom;
  }
}

function parseList(s) {
  if (s.peekChar() === "(") {
    s.readChar(); // swallow opening parenthesis
    const ret = [];
    let parsed;
    
    // Parse elements until we hit a dot or closing paren
    while (true) {
      // Skip whitespace and comments before checking for dot or closing paren
      while (skipWhitespace(s) > 0 || skipComments(s) > 0) {}
      
      // Check if we've reached the end of the list or a dot
      if (s.peekChar() === ")") break;
      if (s.peekChar() === ".") {
        s.readChar(); // consume the dot
        skipWhitespace(s); // skip whitespace after dot
        
        // Parse the rest parameter
        const restParam = parseExpression(s);
        ret.push(".", restParam); // Add dot and rest param to the list
        
        // Skip whitespace before closing paren
        skipWhitespace(s);
        break;
      }
      
      parsed = parseExpression(s);
      if (parsed == null) break;
      ret.push(parsed);
    }
    
    assert(s.readChar() === ")", "Expected )");
    return ret;
  }
}
