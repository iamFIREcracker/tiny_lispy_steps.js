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
  }
}

function applycClo(ctx) {
  const [[_smark, _call, _applycClo, ...args], a] = top(ctx.s);
  return {
    ...ctx,
    s: [
      ...cloParams(top(ctx.r)).map((_, i) => [args[i] ?? "nil", a]),
      [[smark, "call", "applycClo2", top(ctx.r)], a],
      ...butTop(ctx.s),
    ],
    r: butTop(ctx.r),
  };
}

function applycClo2(ctx) {
  const [[_smark, _call, _applycClo2, clo], _] = top(ctx.s);
  const parms = cloParams(clo);
  const vals = ctx.r.slice(0, parms.length);
  const r2 = ctx.r.slice(parms.length);
  return {
    ...ctx,
    s: push([cloBody(clo), env(clo, parms, vals)], butTop(ctx.s)),
    r: r2,
  };

  function env(clo, parms, vals) {
    assert(parms.length === vals.length, "INVALID APPLY ARGS NO"); // TODO: SIGERR
    const a = { ...cloLexical(clo) };
    for (let i = 0; i < parms.length; i++) {
      a[parms[i]] = vals[i];
    }
    return a;
  }
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
