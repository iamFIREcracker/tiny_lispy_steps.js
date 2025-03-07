var Env = function (parent = null, ...bindings) {
  this.parent = parent;
  this.bindings = new Map();
  for (let i = 0; i < bindings.length; i += 2) {
    this.bindings.set(bindings[i], bindings[i + 1]);
  }
};
Env.prototype.has = function (symbol) {
  if (this.bindings.has(symbol)) {
    return this.bindings.get(symbol);
  }
  if (this.parent) {
    return this.parent.has(symbol);
  }
};
Env.prototype.hasf = function (symbol) {
  return this.has(`__f_${symbol}`);
};
Env.prototype.hasm = function (symbol) {
  return this.has(`__m_${symbol}`);
};
Env.prototype.lookup = function (symbol) {
  const value = this.has(symbol);
  if (value != null) {
    return value;
  }
  throw new Error(`Undefined symbol: ${symbol}`);
};
Env.prototype.flookup = function (symbol) {
  return this.lookup(`__f_${symbol}`);
};
Env.prototype.mlookup = function (symbol) {
  return this.lookup(`__m_${symbol}`);
};
Env.prototype.define = function (symbol, value) {
  this.bindings.set(symbol, value);
  return value;
};
Env.prototype.fdefine = function (symbol, value) {
  return this.define(`__f_${symbol}`, value);
};
Env.prototype.mdefine = function (symbol, value) {
  return this.define(`__m_${symbol}`, value);
};

var COMPILED_PROCEDURES = {
  "+": function plus(...args) {
    return args.reduce((a, b) => a + b, 0);
  },
  "-": function sub(a, ...args) {
    return args.length ? args.reduce((acc, val) => acc - val, a) : -a;
  },
  "*": function mul(...args) {
    return args.reduce((a, b) => a * b, 1);
  },
  "/": function div(a, b) {
    return a / b;
  },
  "=": function eq(a, b) {
    return a === b;
  },
  "<": function lessThan(a, b) {
    return a < b;
  },
  "<=": function lessThanOrEq(a, b) {
    // Vim matchit seems to trip over <=...  So we reverse it!
    return !(a > b);
  },
  ">": function greaterThan(a, b) {
    return a > b;
  },
  ">=": function greaterThanOrEq(a, b) {
    return a >= b;
  },
  "JS-GET": function jsGet(target, key) {
    return target[key];
  },
  "JS-CALL": function jsCall(target, method, ...args) {
    const methodFn = target[method];
    return methodFn.apply(target, args);
  },
  // XXX move to system.lisp once we have &rest
  LIST: function list(...x) {
    return x;
  },
  // XXX move to system.lisp once we have &rest
  DBG: function dbg(...args) {
    console.log("#=>", ...args);
    return args[0];
  },
};

function mkGlobalEnv() {
  const env = new Env();

  for (const [name, fn] of Object.entries(COMPILED_PROCEDURES)) {
    env.fdefine(name, ["COMPILED", fn]);
  }

  env.define("T", "T");
  env.define("NIL", "NIL");

  env.define("*GLOBAL-THIS*", ["JS-OBJ", globalThis]);

  return env;
}

function taggedList(expr, tag) {
  return Array.isArray(expr) && expr[0] === tag;
}

function hostToGuest(x) {
  if (x == null) {
    return "NIL";
  } else if (x === true) {
    return "T";
  } else if (x === false) {
    return "NIL";
  } else if (!isNaN(x)) {
    return x;
  } else if (typeof x === "string") {
    return ["STRING", x];
  } else if (Array.isArray(x)) {
    return ["JS-ARRAY", ...x.map(hostToGuest)];
  } else if (typeof x === "function") {
    return ["COMPILED", x];
  } else if (x == null) {
    return "NIL";
  } else {
    assert(typeof x === "object", `Expected Object but got: ${x}`);
    return ["JS-OBJ", x];
  }
}

assertEqual(hostToGuest(null), "NIL");
assertEqual(hostToGuest(undefined), "NIL");
assertEqual(hostToGuest(12), 12);
assertEqual(hostToGuest(true), "T");
assertEqual(hostToGuest(false), "NIL");
assertEqual(hostToGuest("foo"), ["STRING", "foo"]);
assertEqual(hostToGuest([12, "foo"]), ["JS-ARRAY", 12, ["STRING", "foo"]]);
assertEqual(hostToGuest(console.log), ["COMPILED", console.log]);
assertEqual(hostToGuest({ foo: "bar" }), ["JS-OBJ", { foo: "bar" }]);

function guestToHost(x) {
  if (!isNaN(x)) {
    return x;
  } else if (taggedList(x, "STRING")) {
    return x[1];
  } else if (taggedList(x, "JS-OBJ")) {
    return x[1];
  } else if (taggedList(x, "COMPILED")) {
    return x[1];
  } else if (taggedList(x, "JS-ARRAY")) {
    return x.slice(1).map(guestToHost);
  } else if (x === "NIL") {
    return undefined;
  } else {
    assert(false, `Unexpected value: ${x}`);
  }
}

assertEqual(guestToHost(12), 12);
assertEqual(guestToHost(["STRING", "foo"]), "foo");
assertEqual(guestToHost(["JS-OBJ", { foo: "bar" }]), { foo: "bar" });
assertEqual(guestToHost(["COMPILED", console.log]), console.log);
assertEqual(guestToHost(["JS-ARRAY", 12, ["STRING", "foo"]]), [12, "foo"]);
assertEqual(guestToHost("NIL"), undefined);

function evalc(cont) {
  // console.log({ type: "EVALC", cont });
  return (
    resumePrevContinuation(cont) ??
    doNothingIfFinished(cont) ??
    tryEvalSelfEvaluating(cont) ??
    tryEvalVariable(cont) ??
    tryEvalSpecialOperator(cont) ??
    tryEvalMacroExpansion(cont) ??
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
    tryApplyCompiled(cont) ??
    tryApplyProcedure(cont) ??
    tryApplyContinuation(cont) ??
    notSupportedError()
  );

  function notSupportedError() {
    throw new Error(`Not supported application: ${cont}`);
  }
}

function tryApplyCompiled(cont) {
  const [proc, ...args] = cont.evald.map((p) => p.ret);
  if (taggedList(proc, "COMPILED")) {
    return {
      ...cont,
      ret: hostToGuest(proc[1].apply(proc[1], args.map(guestToHost))),
    };
  }
}

function tryApplyProcedure(cont) {
  const [proc, ...args] = cont.evald.map((p) => p.ret);
  if (taggedList(proc, "PROCEDURE")) {
    let evald1 = cont.evald1;
    if (!evald1) {
      const env = new Env(cont.env);
      let [_, params, body] = proc;
      for (let i = 0; i < params.length; i++) {
        env.define(params[i], args[i] ?? "NIL");
      }

      const bdcont = {
        expr: body,
        env,
      };
      return { ...bdcont, cont: { ...cont, evald1: bdcont } };
    } else if (!evald1.hasOwnProperty("ret")) {
      assert(cont.resumedFrom.hasOwnProperty("ret"));
      evald1 = cont.resumedFrom;
    }
    return { ...cont, evald1, ret: evald1.ret };
  }
}

function tryApplyContinuation(cont) {
  const [proc, ..._] = cont.evald.map((p) => p.ret);
  if (taggedList(proc, "CONTINUATION")) {
    let evald1 = cont.evald1;
    if (!evald1) {
      const [_, kcont] = proc;
      assert(cont.evald[1].hasOwnProperty("ret")); // XXX multipleargs
      const evald1 = {};
      const cont1 = { ...cont, evald1 };
      const kcont1 = reify(kcont, cont1);
      Object.assign(evald1, kcont1); // XXX cyclic dependency here...
      // dbg(cont.evald[1].ret);
      // printK(kcont1);
      return {
        ...kcont1,
        // XXX multipleargs
        resumedFrom: { ...cont, ret: cont.evald[1].ret },
      };

      function reify(cont, bottom) {
        if (!cont) return bottom;
        return { ...cont, cont: reify(cont.cont, bottom) };
      }
    } else if (!evald1.hasOwnProperty("ret")) {
      assert(cont.resumedFrom.hasOwnProperty("ret"));
      evald1 = cont.resumedFrom;
    }
    return { ...cont, evald1, ret: evald1.ret };
  }
}

function tryEvalSelfEvaluating(cont) {
  if (
    typeof cont.expr === "number" ||
    typeof cont.expr === "boolean" ||
    taggedList(cont.expr, "STRING") ||
    taggedList(cont.expr, "JS-ARRAY") ||
    taggedList(cont.expr, "JS-OBJ") ||
    taggedList(cont.expr, "PROCEDURE") ||
    taggedList(cont.expr, "CONTINUATION") ||
    (typeof cont.expr === "string" && cont.expr.charAt(0) === ":")
  ) {
    return { ...cont, ret: cont.expr };
  }
}

function tryEvalVariable(cont) {
  if (typeof cont.expr === "string") {
    return { ...cont, ret: cont.env.lookup(cont.expr) };
  }
}

var SPECIAL_OPERATORS = {
  "SYMBOL-FUNCTION": (s) => tryEvalSymbolFunction(s),
  LAMBDA: (s) => tryEvalLambda(s),
  IF: (s) => tryEvalIf(s),
  DEFUN: (s) => tryEvalDefun(s),
  PROGN: (s) => tryEvalProgn(s),
  LET: (s) => tryEvalLet(s),
  PROMPT: (s) => tryEvalPrompt(s),
  ABORT: (s) => tryEvalAbort(s),
  CALL: (s) => tryEvalCall(s),
  PAUSE: (s) => tryEvalPause(s),
  LOAD: (s) => tryEvalLoad(s),
  QUOTE: (s) => tryEvalQuote(s),
  QUASIQUOTE: (s) => tryEvalQuasiquote(s),
  DEFMACRO: (s) => tryEvalDefmacro(s),
  "JS-THEN": (s) => tryEvalJsThen(s),
};

function tryEvalSpecialOperator(cont) {
  for (const evaler of Object.values(SPECIAL_OPERATORS)) {
    const cont1 = evaler(cont);
    if (cont1) {
      return cont1;
    }
  }
}

function tryEvalSymbolFunction(cont) {
  if (taggedList(cont.expr, "SYMBOL-FUNCTION")) {
    return { ...cont, ret: cont.env.flookup(cont.expr[1]) };
  }
}

function tryEvalLambda(cont) {
  if (taggedList(cont.expr, "LAMBDA")) {
    let [params, ...body] = cont.expr.slice(1);
    return {
      ...cont,
      ret: mkProcedure(params, ...body),
    };
  }
}

function mkProcedure(params, ...body) {
  return ["PROCEDURE", params, prognify(body)];
}

function prognify(body) {
  if (body.length === 1) {
    body = body[0];
  } else {
    body = ["PROGN", ...body];
  }
  return body;
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
      assert(cont.resumedFrom.hasOwnProperty("ret"));
      tstcon = cont.resumedFrom;
    }
    if (tstcon.ret !== "NIL") {
      return { ...cont, tstcon, expr: then };
    }
    return { ...cont, tstcon, expr: else_ };
  }
}

function tryEvalDefun(cont) {
  if (taggedList(cont.expr, "DEFUN")) {
    let [_, name, params, ...body] = cont.expr;
    let procd;
    if (!cont.procd) {
      procd = { expr: ["LAMBDA", params, prognify(body)], env: cont.env };
      return { ...procd, cont: { ...cont, procd } };
    }
    if (!cont.procd.hasOwnProperty("ret")) {
      assert(cont.resumedFrom.hasOwnProperty("ret"));
      procd = cont.resumedFrom;
    }
    const env = new Env(cont.env);
    env.fdefine(name, procd.ret);
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
        assert(cont.resumedFrom.hasOwnProperty("ret"));
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
    assert(evald[evald.length - 1].hasOwnProperty("ret"));
    return { ...cont, evald, env, ret: evald[evald.length - 1].ret };
  }
}

function tryEvalLet(cont) {
  if (taggedList(cont.expr, "LET")) {
    const [_, bindings, ...body] = cont.expr;
    let evald = cont.evald ?? [];
    let env = cont.env;

    for (let i = 0; i < evald.length; i++) {
      let bncont = evald[i];
      if (!bncont.hasOwnProperty("ret")) {
        assert(cont.resumedFrom.hasOwnProperty("ret"));
        evald = [...evald.slice(0, i), cont.resumedFrom];
        env = cont.resumedFrom.env;
        break;
      }
    }

    if (evald.length < bindings.length) {
      const bncont = { expr: bindings[evald.length][1], env };
      evald = [...evald, bncont];
      return { ...bncont, cont: { ...cont, evald, env } };
    }

    let evald1 = cont.evald1 ?? false;
    if (!evald1) {
      const env = new Env(cont.env);
      for (let i = 0; i < bindings.length; i++) {
        env.define(bindings[i][0], evald[i].ret);
      }

      const bdcont = {
        expr: prognify(body),
        env,
      };
      return { ...bdcont, cont: { ...cont, evald, evald1: bdcont } };
    } else if (!evald1.hasOwnProperty("ret")) {
      assert(cont.resumedFrom.hasOwnProperty("ret"));
      evald1 = cont.resumedFrom;
    }
    return { ...cont, evald1, ret: evald1.ret };
  }
}

function tryEvalPrompt(cont) {
  if (taggedList(cont.expr, "PROMPT")) {
    const [_, tag, thunk, handler] = cont.expr;
    let thunkd = cont.thunkd ?? false;
    if (!thunkd) {
      thunkd = true;
      return {
        expr: [thunk], // call the thunk!
        evald: [evalc({ expr: thunk })], // XXX review this -- saves some evaluation down the line
        env: cont.env,
        cont: { ...cont, thunkd, tag },
      };
    }

    if (cont.abortd) {
      const { k, evald } = cont.resumedFrom;
      return {
        ...cont,
        expr: [handler, k, ...evald.map((v) => v.ret)],
        evald: [evalc({ expr: handler }), { ret: k }, ...evald], // XXX review this -- saves some evaluation down the line
      };
    }

    assert(cont.resumedFrom.hasOwnProperty("ret"));
    return { ...cont, ret: cont.resumedFrom.ret };
  }
}

function tryEvalAbort(cont) {
  if (taggedList(cont.expr, "ABORT")) {
    const [_, tag, ...values] = cont.expr;

    let evald = cont.evald ?? [];
    for (let i = 0; i < evald.length; i++) {
      const arcont = evald[i];
      if (!arcont.hasOwnProperty("ret")) {
        assert(cont.resumedFrom.hasOwnProperty("ret"));
        evald = [...evald.slice(0, i), cont.resumedFrom];
        break;
      }
    }
    if (evald.length < values.length) {
      const arcont = { expr: values[evald.length], env: cont.env };
      evald = [...evald, arcont];
      return { ...arcont, cont: { ...cont, evald } };
    }

    let abortd = cont.abortd ?? false;
    if (!abortd) {
      abortd = true;

      let tcont = cont.cont;
      while (tcont && tcont.tag !== tag) {
        tcont = tcont.cont;
      }
      assert(tcont, `Could not find PROMPT with tag: ${tag}`);
      const k = ["CONTINUATION", limited({ ...cont, evald, abortd })];
      return {
        ...tcont,
        abortd: true,
        resumedFrom: { ...cont, k, evald, abortd },
      };

      function limited(cont) {
        if (!cont) return;
        else if (cont.tag === tag) return;
        else if (cont.cont) return { ...cont, cont: limited(cont.cont) };
      }
    }
    assert(cont.resumedFrom.hasOwnProperty("ret"));
    return { ...cont, ret: cont.resumedFrom.ret };
  }
}

function printK(cont) {
  if (!cont) return;
  console.log(cont.expr);
  printK(cont.cont);
}

function tryEvalCall(cont) {
  if (taggedList(cont.expr, "CALL")) {
    let evald = cont.evald ?? [];

    for (let i = 0; i < evald.length; i++) {
      const arcont = evald[i];
      if (!arcont.hasOwnProperty("ret")) {
        assert(cont.resumedFrom.hasOwnProperty("ret"));
        evald = [...evald.slice(0, i), cont.resumedFrom];
        break;
      }
    }

    const args = cont.expr.slice(1);
    if (evald.length < args.length) {
      const expr = args[evald.length];
      const arcont = { expr, env: cont.env };
      evald = [...evald, arcont];
      return { ...arcont, cont: { ...cont, evald } };
    }
    return applyc({ ...cont, evald });
  }
}

function tryEvalPause(cont) {
  if (taggedList(cont.expr, "PAUSE")) {
    return { ...cont, ret: { ...cont, ret: "T" } };
  }
}

function tryEvalLoad(cont) {
  if (taggedList(cont.expr, "LOAD")) {
    let evald1 = cont.evald1 ?? false;
    if (!evald1) {
      evald1 = true;
      const arg = cont.expr[1];
      assert(
        taggedList(arg, "STRING"),
        `LOAD expects a STRING literal argument`,
      );
      const s = fs.readFileSync(guestToHost(arg), "utf-8");
      const expr = prognify(readAllFromString(s));
      return { expr, env: cont.env, cont: { ...cont, evald1 } };
    }
    assert(cont.resumedFrom.hasOwnProperty("ret"));
    return {
      ...cont,
      env: cont.resumedFrom.env,
      ret: cont.resumedFrom.ret,
      cont: { ...cont.cont, env: cont.resumedFrom.env },
    };
  }
}

function tryEvalQuote(cont) {
  if (taggedList(cont.expr, "QUOTE")) {
    return { ...cont, ret: cont.expr[1] };
  }
}

// XXX this is a very naive implementation which
// will fail, spectacularly, in pretty much all
// the non-trivial usages
function tryEvalQuasiquote(cont) {
  if (taggedList(cont.expr, "QUASIQUOTE")) {
    const expr = tryUnquote(cont.expr[1]);
    return { ...cont, ret: expr };

    function tryUnquote(expr) {
      if (taggedList(expr, "UNQUOTE")) {
        return cont.env.lookup(expr[1]);
      } else if (Array.isArray(expr)) {
        return expr.map(tryUnquote);
      } else {
        return expr;
      }
    }
  }
}

function tryEvalDefmacro(cont) {
  if (taggedList(cont.expr, "DEFMACRO")) {
    let [_, name, params, ...body] = cont.expr;
    let macrod;
    if (!cont.macrod) {
      macrod = { expr: ["LAMBDA", params, prognify(body)], env: cont.env };
      return { ...macrod, cont: { ...cont, macrod } };
    }
    if (!cont.macrod.hasOwnProperty("ret")) {
      assert(cont.resumedFrom.hasOwnProperty("ret"));
      macrod = cont.resumedFrom;
    }
    const env = new Env(cont.env);
    env.mdefine(name, macrod.ret);
    return { ...cont, macrod, env, ret: macrod.ret };
  }
}

function tryEvalMacroExpansion(cont) {
  if (Array.isArray(cont.expr) && cont.env.hasm(cont.expr[0])) {
    let expnd = cont.expnd ?? false;
    if (!expnd) {
      expnd = true;
      const [macro, ...args] = cont.expr;
      const evald = [
        { expr: macro, ret: cont.env.mlookup(macro) },
        ...args.map((v) => ({
          expr: ["QUOTE", v],
          ret: v,
        })),
      ];
      return applyc({ ...cont, evald, expnd, cont: { ...cont, expnd } });
    }

    let expnd1 = cont.expnd1 ?? false;
    if (!expnd1) {
      expnd1 = true;
      assert(cont.resumedFrom.hasOwnProperty("ret"));
      const expr = cont.resumedFrom.ret;
      return { expr, env: cont.env, expnd, cont: { ...cont, expnd1 } };
    }

    assert(cont.resumedFrom.hasOwnProperty("ret"));
    // XXX this is ridicolous -- too many k chaining...
    // still, it works, so whatever
    const ccont = cont.cont.cont;

    return { ...cont, cont: ccont, ret: cont.resumedFrom.ret };
  }
}

function tryEvalJsThen(cont) {
  if (taggedList(cont.expr, "JS-THEN")) {
    let evald = cont.evald ?? [];

    for (let i = 0; i < evald.length; i++) {
      const arcont = evald[i];
      if (!arcont.hasOwnProperty("ret")) {
        assert(cont.resumedFrom.hasOwnProperty("ret"));
        evald = [...evald.slice(0, i), cont.resumedFrom];
        break;
      }
    }
    const args = cont.expr.slice(1);
    if (evald.length < args.length) {
      const arcont = { expr: args[evald.length], env: cont.env };
      evald = [...evald, arcont];
      return { ...arcont, cont: { ...cont, evald } };
    }

    const [{ ret: promise }, { ret: callback }] = evald;
    assert(
      taggedList(promise, "JS-OBJ"),
      `Expected Promise/JS-OBJ but got: ${promise}`,
    );
    assert(
      taggedList(callback, "PROCEDURE") || taggedList(callback, "CONTINUATION"),
      `Expected Procedure/Continuation but got: ${callback}`,
    );
    const ret = promise[1].then((v) =>
      evalca({
        env: cont.env,
        expr: [callback, hostToGuest(v)],
        evald: [evald[1], evalc({ expr: hostToGuest(v) })],
      }),
    );
    return { ...cont, evald, ret: hostToGuest(ret) };
  }
}

function tryEvalApplication(cont) {
  if (Array.isArray(cont.expr)) {
    let evald = cont.evald ?? [];

    for (let i = 0; i < evald.length; i++) {
      const arcont = evald[i];
      if (!arcont.hasOwnProperty("ret")) {
        assert(cont.resumedFrom.hasOwnProperty("ret"));
        evald = [...evald.slice(0, i), cont.resumedFrom];
        break;
      }
    }
    if (evald.length < cont.expr.length) {
      const expr = cont.expr[evald.length];
      let arcont;

      if (evald.length === 0 && typeof expr === "string") {
        arcont = { expr: ["SYMBOL-FUNCTION", expr], env: cont.env };
      } else {
        arcont = { expr, env: cont.env };
      }

      evald = [...evald, arcont];
      return { ...arcont, cont: { ...cont, evald } };
    }
    return applyc({ ...cont, evald });
  }
}

function evalca(cont) {
  do {
    cont = evalc(cont);
    if (cont.expr?.[0] === "PAUSE" && cont.hasOwnProperty("ret"))
      return cont.ret;
  } while (!cont.hasOwnProperty("ret") || cont.cont);
  return cont.ret;
}

function* evale(expr, env) {
  let cont = { expr, env };
  do {
    cont = evalc(cont);
    yield cont;
    if (cont.expr?.[0] === "PAUSE" && cont.hasOwnProperty("ret")) return;
  } while (!cont.hasOwnProperty("ret") || cont.cont);
  return cont.ret;
}

function run(s) {
  const expr = [
    "PROGN",
    ["LOAD", ["STRING", "./system.lisp"]],
    ...readAllFromString(s),
  ];
  let ret = null;
  for (const cont of evale(expr, mkGlobalEnv())) {
    ret = cont.ret;
  }
  return ret;
}

function run1(s) {
  const expr = [
    "PROGN",
    ["LOAD", ["STRING", "./system.lisp"]],
    ...readAllFromString(s),
  ];
  return evalc({ expr, env: mkGlobalEnv() });
}

// Datamodeling:
// - evald: for application evaluation, and PROGN
// - evald1: for procedure application
// - tstcon: for IF
// - procd: for DEFUN
// - k, abortd: for ABORT
// - macrod, expnd, expnd1: for DEFMACRO
