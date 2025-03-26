function evalc(ctx) {
  // dbg("evalc", ctx);
  return (
    doNothingIfFinished(ctx) ??
    tryEvalStackMark(ctx) ??
    tryEvalSelfEvaluating(ctx) ??
    tryEvalVariable(ctx) ??
    tryEvalSpecialOperator(ctx) ??
    tryEvalApplication(ctx) ??
    notSupportedError()
  );

  function doNothingIfFinished(ctx) {
    if (ctx.s.length === 0) {
      return ctx;
    }
  }

  function notSupportedError() {
    throw new Error(
      `Not supported evaluation: ${JSON.stringify(ctx, null, 2)}`,
    );
  }
}

function taggedList(expr, tag) {
  return Array.isArray(expr) && expr[0] === tag;
}

function lit(expr, tag) {
  return taggedList(expr, "lit") && expr[1] === tag;
}

var smark = "%smark";

function tryEvalStackMark(ctx) {
  const [e, _] = top(ctx.s);
  if (taggedList(e, smark)) {
    switch (e[1]) {
      case "call": {
        const fn = e[2];
        assert(globalThis[fn], `Cannot find function: ${fn}`); // TODO: SIGERR
        return globalThis[fn].call(null, ctx);
      }
      case "bind": {
        return { ...ctx, s: butTop(ctx.s) };
      }
    }
  }
}

function tryEvalSelfEvaluating(ctx) {
  const [e, _] = top(ctx.s);
  if (
    typeof e === "number" ||
    taggedList(e, "STRING") ||
    taggedList(e, "JS-ARRAY") ||
    taggedList(e, "JS-OBJ") ||
    taggedList(e, "PROCEDURE") ||
    taggedList(e, "CONTINUATION") ||
    taggedList(e, "ENV") ||
    taggedList(e, "lit") ||
    keyword(e) ||
    e === "t" ||
    e === "nil"
  ) {
    return { ...ctx, s: butTop(ctx.s), r: push(e, ctx.r) };
  }
}

function symbol(e) {
  return typeof e === "string";
}

function keyword(e) {
  return symbol(e) && e.charAt(0) === ":";
}

function tryEvalVariable(ctx) {
  const [e, a] = top(ctx.s);
  if (symbol(e)) {
    const v = lookup(e, a, ctx.s, ctx.g);
    assert(v, `UNBOUND ${e}`); // TODO: SIGERR
    return { ...ctx, s: butTop(ctx.s), r: push(v, ctx.r) };
  }
}

function lookup(e, a, s, g) {
  return (
    binding(e, s)?.[0] ??
    a?.[e] ??
    g[e] ??
    ((e === "*scope*" && ["ENV", a]) || (e === "*globe*" && ["ENV", g]))
  );
}

function binding(e, s) {
  for (const [e2, _] of s) {
    if (taggedList(e2, smark) && e2[1] === "bind") {
      if (e2[2][e] != null) {
        return [e2[2][e], e2[2]]; // return value and place
      }
    }
  }
}

var SPECIAL_OPERATORS = {};

function tryEvalSpecialOperator(ctx) {
  const [e, _] = top(ctx.s);
  if (Array.isArray(e) && SPECIAL_OPERATORS[e[0]]) {
    return SPECIAL_OPERATORS[e[0]](ctx);
  }
}

function special(name, fn) {
  SPECIAL_OPERATORS[name] = fn;
  return fn;
}

special("quote", function quote(ctx) {
  const [[_, e]] = top(ctx.s);
  return {
    ...ctx,
    s: butTop(ctx.s),
    r: push(e, ctx.r),
  };
});

special("quasiquote", function quasiquote(ctx) {
  const [[_, e], a] = top(ctx.s);
  const ee = [];
  unquotes(e);

  return {
    ...ctx,
    s: [
      ...ee.map((e2) => [e2, a]),
      [[smark, "call", "quasiquote2", e, ee.length]],
      ...butTop(ctx.s),
    ],
    r: butTop(ctx.r),
  };

  function unquotes(e) {
    if (taggedList(e, "unquote")) {
      ee.push(e[1]);
    } else if (taggedList(e, "quote")) {
      return;
    } else if (Array.isArray(e)) {
      e.map(unquotes);
    } else {
      return;
    }
  }
});

function quasiquote2(ctx) {
  const [[_smark, _call, _qq2, e, n]] = top(ctx.s);
  const vals = ctx.r.slice(0, n);
  const r2 = ctx.r.slice(n);
  const e2 = reassemble(e);

  return { ...ctx, s: butTop(ctx.s), r: push(e2, r2) };

  function reassemble(e) {
    if (taggedList(e, "unquote")) {
      return vals.pop();
    } else if (taggedList(e, "quote")) {
      return e;
    } else if (Array.isArray(e)) {
      return e.map(reassemble);
    } else {
      return e;
    }
  }
}

special("set", function set(ctx) {
  const [[_, ...bindings], a] = top(ctx.s);
  if (bindings.length < 2) {
    assert(false, "INVALID SET ARGS NO"); // TODO: SIGERR
  } else {
    const [v, e, ...bindings2] = bindings;
    return {
      ...ctx,
      s: push(
        [e, a],
        push([[smark, "call", "set2", v, ...bindings2], a], butTop(ctx.s)),
      ),
    };
  }
});

function set2(ctx) {
  const [[_smark, _call, _set2, v, ...bindings], a] = top(ctx.s);
  const o = where(v, a, ctx.s, ctx.g);
  o[v] = top(ctx.r);
  const ctx2 = {
    ...ctx,
    s: butTop(ctx.s),
  };
  if (bindings.length === 0) {
    return ctx2;
  } else {
    return {
      ...ctx2,
      s: push([["set", ...bindings], a], ctx2.s),
      r: butTop(ctx2.r),
    };
  }
}

function where(e, a, s, g) {
  let o;
  if ((o = binding(e, s) != null)) {
    return o;
  } else if (a?.[e] != null) {
    return a;
  } else {
    return g;
  }
}

special("fn", function fn(ctx) {
  const [[_, parms, ...body], a] = top(ctx.s);
  return {
    ...ctx,
    s: butTop(ctx.s),
    r: push(["lit", "clo", a, parms, prognify(body)], ctx.r),
  };
});

special("macro", function macro(ctx) {
  const [[_, parms, ...body], a] = top(ctx.s);
  return {
    ...ctx,
    s: butTop(ctx.s),
    r: push(["lit", "mac", a, parms, prognify(body)], ctx.r),
  };
});

function cloLexical(clo) {
  return clo[2];
}

function cloParams(clo) {
  return clo[3];
}

function cloBody(clo) {
  return clo[4];
}

function prognify(body) {
  if (body.length === 1) {
    body = body[0];
  } else {
    body = ["progn", ...body];
  }
  return body;
}

special("if", function if_(ctx) {
  const [[_, ...args], a] = top(ctx.s);
  if (args.length === 0) {
    return { ...ctx, s: butTop(ctx.s), r: push("nil", ctx.r) };
  }
  if (args.length === 1) {
    return { ...ctx, s: push([args[0], a], butTop(ctx.s)) };
  }
  return {
    ...ctx,
    s: push(
      [args[0], a],
      push([[smark, "call", "if2", ...args.slice(1)], a], butTop(ctx.s)),
    ),
  };
});

function if2(ctx) {
  const test = top(ctx.r);
  const [[_smark, _call, _if2, ...args], a] = top(ctx.s);
  if (test !== "nil") {
    return { ...ctx, s: push([args[0], a], butTop(ctx.s)), r: butTop(ctx.r) };
  }
  return {
    ...ctx,
    s: push([["if", ...args.slice(1)], a], butTop(ctx.s)),
    r: butTop(ctx.r),
  };
}

special("dyn", function dyn(ctx) {
  const [[_, v, e1, e2], a] = top(ctx.s);
  return {
    ...ctx,
    s: push([e1, a], push([[smark, "call", "dyn2", v, e2], a], butTop(ctx.s))),
  };
});

function dyn2(ctx) {
  const [[_smark, _call, _dyn2, v, e2], a] = top(ctx.s);
  return {
    ...ctx,
    s: push(
      [e2, a],
      push([[smark, "bind", { [v]: top(ctx.r) }]], butTop(ctx.s)),
    ),
    r: butTop(ctx.r),
  };
}

// TODO: convert into a macro
special("def", function def(ctx) {
  const [[_, name, parms, ...body], a] = top(ctx.s);
  return {
    ...ctx,
    s: push(
      [["set", name, ["lit", "clo", a, parms, prognify(body)]]],
      butTop(ctx.s),
    ),
  };
});

// TODO: convert into a macro
special("mac", function mac(ctx) {
  const [[_, name, parms, ...body], a] = top(ctx.s);
  return {
    ...ctx,
    s: push(
      [["set", name, ["lit", "mac", a, parms, prognify(body)]]],
      butTop(ctx.s),
    ),
  };
});

function tryEvalApplication(ctx) {
  const [[op, ...args], a] = top(ctx.s);
  return {
    ...ctx,
    s: push([op], push([[smark, "call", "applyc", ...args], a], butTop(ctx.s))),
  };
}

function applyc(ctx) {
  const [[_smark, _call, _applyc, ...args], _] = top(ctx.s);
  switch (top(ctx.r)[1]) {
    case "clo":
      return applycClo(ctx);
    case "mac":
      return applycMac(ctx);
  }
}

function applycClo(ctx) {
  const [[_smark, _call, _applycClo, ...args], a] = top(ctx.s);
  return {
    ...ctx,
    s: [
      ...args.map((v) => [v, a]),
      [[smark, "call", "applycClo2", top(ctx.r), args.length], a],
      ...butTop(ctx.s),
    ],
    r: butTop(ctx.r),
  };
}

function parseParamsList(parms) {
  let regularParams = [];
  let restParam = null;

  // Handle the case where parms is a single symbol (not an array)
  if (!Array.isArray(parms)) {
    // Treat a single symbol as a rest parameter
    restParam = parms;
  } else {
    // Check if we have a dotted parameter list
    const dotIndex = parms.indexOf(".");

    if (dotIndex !== -1) {
      // We have a rest parameter
      regularParams = parms.slice(0, dotIndex);
      restParam = parms[dotIndex + 1]; // Get the parameter after the dot
    } else {
      // No rest parameter
      regularParams = parms;
      restParam = null;
    }
  }

  return { regularParams, restParam };
}

function createEnv(clo, regularParams, restParam, regularVals, restVals) {
  assert(regularParams.length === regularVals.length, "INVALID APPLY ARGS NO"); // TODO: SIGERR
  const a = { ...cloLexical(clo) };

  // Bind regular parameters
  for (let i = 0; i < regularParams.length; i++) {
    a[regularParams[i]] = regularVals[i];
  }

  // Bind rest parameter if it exists
  if (restParam) {
    a[restParam] = restVals;
  }

  return a;
}

function applycClo2(ctx) {
  const [[_smark, _call, _applycClo2, clo, n], _] = top(ctx.s);
  const parms = cloParams(clo);

  const { regularParams, restParam } = parseParamsList(parms);

  // Get values for regular parameters
  const regularVals = ctx.r.slice(0, regularParams.length).reverse();

  // Get values for rest parameter (if any)
  const restVals = restParam
    ? ctx.r.slice(regularParams.length, regularParams.length + n).reverse()
    : [];

  // Update result stack
  const r2 = ctx.r.slice(
    regularParams.length + (restParam ? restVals.length : 0),
  );

  dbg(regularParams, restParam, restVals);
  return {
    ...ctx,
    s: push(
      [
        cloBody(clo),
        createEnv(clo, regularParams, restParam, regularVals, restVals),
      ],
      butTop(ctx.s),
    ),
    r: r2,
  };
}

function applycMac(ctx) {
  const [[_smark, _call, _applycMac, ...vals], a] = top(ctx.s);
  const mac = top(ctx.r);
  assert(lit(mac, "mac"), `Not a MACRO: ${mac}`); // TODO: SIGERR
  const clo = mac;
  const parms = cloParams(clo);

  const { regularParams, restParam } = parseParamsList(parms);

  // Get values for regular parameters
  const regularVals = vals.slice(0, regularParams.length);

  // Get values for rest parameter (if any)
  const restVals = restParam ? vals.slice(regularParams.length) : [];

  return {
    ...ctx,
    s: [
      [
        cloBody(clo),
        createEnv(clo, regularParams, restParam, regularVals, restVals),
      ],
      [[smark, "call", "applycMac2", a]],
      ...butTop(ctx.s),
    ],
    r: butTop(ctx.r),
  };
}

function applycMac2(ctx) {
  const [[_smark, _call, _applycMac2, a]] = top(ctx.s);
  return {
    ...ctx,
    s: push([top(ctx.r), a], butTop(ctx.s)),
    r: butTop(ctx.r),
  };
}

special("progn", function progn(ctx) {
  const [[_, ...args], a] = top(ctx.s);
  if (args.length === 0) {
    return { ...ctx, s: butTop(ctx.s), r: push("nil", ctx.r) };
  }
  return {
    ...ctx,
    s: push(
      [args[0], a],
      push([[smark, "call", "progn2", ...args.slice(1)], a], butTop(ctx.s)),
    ),
  };
});

function progn2(ctx) {
  const [[_smark, _call, _progn2, ...args], a] = top(ctx.s);
  if (args.length === 0) {
    return { ...ctx, s: butTop(ctx.s) };
  }
  return {
    ...ctx,
    s: push([["progn", ...args], a], butTop(ctx.s)),
    r: butTop(ctx.r),
  };
}

special("let", function let(ctx) {
  const [[_, parm, e2, ...body], a] = top(ctx.s);
  return {
    ...ctx,
    s: push(
      [e2, a],
      push([[smark, "call", "let2", parm, prognify(body)], a], butTop(ctx.s)),
    ),
  };
});

function let2(ctx) {
  const [[_smark, _call, _let2, parm, body], a] = top(ctx.s);
  const val = ctx.r[0];
  const r2 = ctx.r.slice(1);
  return {
    ...ctx,
    s: push([body, { ...a, [parm]: val }], butTop(ctx.s)),
    r: r2,
  };
}

function run(e, g = {}) {
  let cont = { s: [[e, []]], r: [], g };
  do {
    cont = evalc(cont);
  } while (cont.s.length > 0);
  return top(cont.r);
}

function srun(string, g = {}) {
  let cont = { s: readAllFromString(string).map((e) => [e, {}]), r: [], g };
  do {
    cont = evalc(cont);
    // dbg(cont);
  } while (cont.s.length > 0);
  return top(cont.r);
}
