function evalc(ctx) {
  return (
    doNothingIfFinished(ctx) ??
    tryEvalStackMark(ctx) ??
    tryEvalSelfEvaluating(ctx) ??
    tryEvalVariable(ctx) ??
    tryEvalSpecialOperator(ctx) ??
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
    a[e] ??
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
  const [[_, params, ...body], a] = top(ctx.s);
  return {
    ...ctx,
    s: butTop(ctx.s),
    r: push(mkProcedure(a, params, ...body), ctx.r),
  };
});

function mkProcedure(a, params, ...body) {
  return ["lit", "proc", a, params, prognify(body)];
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
  const [[_, ...rest], a] = top(ctx.s);
  if (rest.length === 0) {
    return { ...ctx, s: butTop(ctx.s), r: push("nil", ctx.r) };
  }
  if (rest.length === 1) {
    return { ...ctx, s: push([rest[0], a], butTop(ctx.s)) };
  }
  return {
    ...ctx,
    s: push(
      [rest[0], a],
      push([[smark, "call", "if2", ...rest.slice(1)], a], butTop(ctx.s)),
    ),
  };
});

function if2(ctx, args) {
  const test = top(ctx.r);
  const [[_smark, _call, _if2, ...rest], a] = top(ctx.s);
  if (test !== "nil") {
    return { ...ctx, s: push([rest[0], a], butTop(ctx.s)), r: butTop(ctx.r) };
  }
  return {
    ...ctx,
    s: push([["if", ...rest.slice(1)], a], butTop(ctx.s)),
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
  const [[_, name, params, ...body], a] = top(ctx.s);
  const proc = mkProcedure(a, params, ...body);
  ctx.g[name] = proc;
  return { ...ctx, s: butTop(ctx.s), r: push(proc, ctx.r)};
});


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
