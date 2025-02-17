var Env = function (parent = null, ...bindings) {
  this.parent = parent;
  this.bindings = new Map();
  for (let i = 0; i < bindings.length; i += 2) {
    this.bindings.set(bindings[i], bindings[i + 1]);
  }
};
Env.prototype.lookup = function (symbol) {
  if (this.bindings.has(symbol)) {
    return this.bindings.get(symbol);
  }
  if (this.parent) {
    return this.parent.lookup(symbol);
  }
  throw new Error(`Undefined symbol: ${symbol}`);
};
Env.prototype.define = function (symbol, value) {
  this.bindings.set(symbol, value);
  return value;
};

var COMPILED = Symbol.for("COMPILED");
var COMPILED_PROCEDURES = [
  ["+", (...args) => args.reduce((a, b) => a + b, 0)],
  [
    "-",
    (a, ...args) =>
      args.length ? args.reduce((acc, val) => acc - val, a) : -a,
  ],
  ["*", (...args) => args.reduce((a, b) => a * b, 1)],
  ["/", (a, b) => a / b],

  // // Comparison operations
  ["=", (a, b) => a === b],
  // ["<", (a, b) => a < b],
  // [">", (a, b) => a > b],

  // // List operations
  // ["LIST", (...args) => args],
  // ["CONS", (a, b) => [a, ...b]],
  // ["CAR", (list) => list[0]],
  // ["CDR", (list) => list.slice(1)],
];

function mkGlobalEnv() {
  const env = new Env();

  for (const [name, fn] of COMPILED_PROCEDURES) {
    env.define(name, [COMPILED, fn]);
  }

  return env;
}

function taggedList(expr, tag) {
  return Array.isArray(expr) && expr[0] === tag;
}

function evalc(cont) {
  // console.log({ type: "EVALC", cont });
  return (
    resumePrevContinuation(cont) ??
    doNothingIfFinished(cont) ??
    tryEvalSelfEvaluating(cont) ??
    tryEvalVariable(cont) ??
    tryEvalSpecialOperator(cont) ??
    tryEvalApplication(cont) ??
    notSupportedError()
  );

  function resumePrevContinuation(cont) {
    if (cont.hasOwnProperty("ret") && cont.cont) {
      return evalc({ ...cont.cont, resumedFrom: cont });
    }
  }

  function doNothingIfFinished(cont) {
    if (cont.hasOwnProperty("ret")) {
      return cont;
    }
  }

  function notSupportedError() {
    throw new Error(`Not supported evaluation: ${cont}`);
  }
}

function applyc(cont) {
  // console.log({ type: "APPLYC", cont });
  return (
    tryApplyCompiled(cont) ?? tryApplyProcedure(cont) ?? notSupportedError()
  );

  function notSupportedError() {
    throw new Error(`Not supported application: ${cont}`);
  }
}

function tryApplyCompiled(cont) {
  const [proc, ...args] = cont.evald.map((p) => p.ret);
  if (taggedList(proc, COMPILED)) {
    return { ...cont, ret: proc[1].apply(proc[1], args) };
  }
}

var PROCEDURE = Symbol.for("PROCEDURE");

function tryApplyProcedure(cont) {
  const [proc, ...args] = cont.evald.map((p) => p.ret);
  if (taggedList(proc, PROCEDURE)) {
    let evald1 = cont.evald1;
    if (!evald1) {
      const env = new Env(cont.env);
      const [_, params, ...body] = proc;
      for (let i = 0; i < params.length; i++) {
        env.define(params[i], args[i] ?? null);
      }
      const bcont = {
        expr: taggedList(body, "PROGN") ? body : ["PROGN", ...body],
        env,
      };
      return { ...bcont, cont: { ...cont, evald1: bcont } };
    } else if (!evald1.hasOwnProperty("ret")) {
      console.assert(cont.resumedFrom.hasOwnProperty("ret"));
      evald1 = cont.resumedFrom;
    }
    return { ...cont, evald1, ret: evald1.ret };
  }
}

function tryEvalSelfEvaluating(cont) {
  if (typeof cont.expr === "number" || typeof cont.expr === "boolean") {
    return { ...cont, ret: cont.expr };
  }
}

function tryEvalVariable(cont) {
  if (typeof cont.expr === "string") {
    return { ...cont, ret: cont.env.lookup(cont.expr) };
  }
}

var SPECIAL_OPERATORS = {
  LAMBDA: tryEvalLambda,
  IF: tryEvalIf,
  DEFUN: tryEvalDefun,
  PROGN: tryEvalProgn,
};

function tryEvalSpecialOperator(cont) {
  for (const evaler of Object.values(SPECIAL_OPERATORS)) {
    const cont1 = evaler(cont);
    if (cont1) {
      return cont1;
    }
  }
}

function tryEvalLambda(cont) {
  if (taggedList(cont.expr, "LAMBDA")) {
    return {
      ...cont,
      ret: [PROCEDURE, cont.expr[1], ["PROGN", ...cont.expr.slice(2)]],
    };
  }
}

function tryEvalIf(cont) {
  if (taggedList(cont.expr, "IF")) {
    const [test, then, else_] = cont.expr.slice(1);
    let tstcon = cont.tstcon;
    if (!tstcon) {
      tstcon = { expr: test, env: cont.env };
      return { ...tstcon, cont: { ...cont, tstcon } };
    }
    if (!tstcon.hasOwnProperty("ret")) {
      console.assert(cont.resumedFrom.hasOwnProperty("ret"));
      tstcon = cont.resumedFrom;
    }
    if (tstcon.ret) {
      return { ...cont, tstcon, expr: then };
    }
    return { ...cont, tstcon, expr: else_ };
  }
}

function tryEvalDefun(cont) {
  if (taggedList(cont.expr, "DEFUN")) {
    const [_, name, params, ...body] = cont.expr;
    let procd;
    if (!cont.procd) {
      procd = eval({ expr: ["LAMBDA", params, ...body], env: cont.env });
      return { ...procd, cont: { ...cont, procd } };
    }
    if (!cont.procd.hasOwnProperty("ret")) {
      console.assert(cont.resumedFrom.hasOwnProperty("ret"));
      procd = cont.resumedFrom;
    }
    const env = new Env(cont.env);
    env.define(name, procd.ret);
    return { ...cont, procd, env, ret: procd.ret };
  }
}

function tryEvalProgn(cont) {
  if (taggedList(cont.expr, "PROGN")) {
    let evald = cont.evald ?? [];
    let env = cont.env;
    const [_, ...forms] = cont.expr;

    for (let i = 0; i < evald.length; i++) {
      let arcont = evald[i];
      if (!arcont.hasOwnProperty("ret")) {
        console.assert(cont.resumedFrom.hasOwnProperty("ret"));
        evald = [...evald.slice(0, i), cont.resumedFrom];
        env = cont.resumedFrom.env;
        break;
      }
    }

    if (evald.length < forms.length) {
      const arcont = { expr: forms[evald.length], env };
      evald = [...evald, arcont];
      return { ...arcont, cont: { ...cont, evald, env } };
    }
    console.assert(evald[evald.length - 1].hasOwnProperty("ret"));
    return { ...cont, evald, env, ret: evald[evald.length - 1].ret };
  }
}

function tryEvalApplication(cont) {
  if (Array.isArray(cont.expr)) {
    let evald = cont.evald ?? [];

    for (let i = 0; i < evald.length; i++) {
      const arcont = evald[i];
      if (!arcont.hasOwnProperty("ret")) {
        console.assert(cont.resumedFrom.hasOwnProperty("ret"));
        evald = [...evald.slice(0, i), cont.resumedFrom];
        break;
      }
    }
    if (evald.length < cont.expr.length) {
      const arcont = { expr: cont.expr[evald.length], env: cont.env };
      evald = [...evald, arcont];
      return { ...arcont, cont: { ...cont, evald } };
    }
    return applyc({ ...cont, evald });
  }
}

function* evale(expr, env) {
  let cont = { expr, env };
  do {
    cont = evalc(cont);
    yield cont;
  } while (!cont.hasOwnProperty("ret") || cont.cont);
  return cont.ret;
}

// Datamodeling:
// - evald: for application evaluation, and PROGN
// - evald1: for procedure application
// - tstcon: for IF
// - procd: for DEFUN
// LET
// SHIFT/RESET
