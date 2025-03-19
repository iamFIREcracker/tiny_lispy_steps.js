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
    binding(e, s) ??
    a?.[e] ??
    g[e] ??
    ((e === "*scope*" && ["ENV", a]) || (e === "*globe*" && ["ENV", g]))
  );
}

function binding(e, s) {
  for (const [e2, _] of s) {
    if (taggedList(e2, smark) && e2[1] === "bind") {
      if (e2[2][e] != null) {
        return e2[2][e];
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

special("fn", function fn(ctx) {
  const [[_, parms, ...body], a] = top(ctx.s);
  return {
    ...ctx,
    s: butTop(ctx.s),
    r: push(mkProcedure(a, parms, ...body), ctx.r),
  };
});

function mkProcedure(a, parms, ...body) {
  return ["lit", "proc", a, parms, prognify(body)];
}

function procLexical(proc) {
  return proc[2];
}

function procParams(proc) {
  return proc[3];
}

function procBody(proc) {
  return proc[4];
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

special("def", function def(ctx) {
  const [[_, name, parms, ...body], a] = top(ctx.s);
  const proc = mkProcedure(a, parms, ...body);
  ctx.g[name] = proc;
  return { ...ctx, s: butTop(ctx.s), r: push(proc, ctx.r) };
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
    case "proc":
      return applycProc(ctx);
  }
}

function applycProc(ctx) {
  const [[_smark, _call, _applycProc, ...args], a] = top(ctx.s);
  return {
    ...ctx,
    s: [
      ...procParams(top(ctx.r)).map((_, i) => [args[i] ?? "nil", a]),
      [[smark, "call", "applycProc2", top(ctx.r)], a],
      ...butTop(ctx.s),
    ],
    r: butTop(ctx.r),
  };
}

function applycProc2(ctx) {
  const [[_smark, _call, _applycProoc2, proc], _] = top(ctx.s);
  const parms = procParams(proc);
  const vals = ctx.r.slice(0, parms.length);
  const r2 = ctx.r.slice(parms.length);
  return {
    ...ctx,
    s: push([procBody(proc), env(proc, parms, vals)], butTop(ctx.s)),
    r: r2,
  };

  function env(proc, parms, vals) {
    assert(parms.length === vals.length, "INVALID APPLY ARGS NO");
    const a = { ...procLexical(proc) };
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
