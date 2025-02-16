var assert = require("node:assert/strict").ok;
var assertEqual = require("node:assert/strict").deepEqual;

mkGlobalEnv();

tryApplyProcedure({
  expr: [["LAMBDA", ["X"], ["+", "X", 1]], 10],
  evald: [{ ret: [PROCEDURE, ["X"], ["+", "X", 1]] }, { ret: 10 }],
  env: mkGlobalEnv(),
});
evalc(_);

tryEvalSelfEvaluating({ expr: 12 });
tryEvalSelfEvaluating({ expr: true });

tryEvalVariable({ expr: "FOO", env: new Env(null, "FOO", "bar") });

tryEvalLambda({ expr: ["LAMBDA", ["X"], ["+", "X", 1]] });

tryEvalIf({ expr: ["IF", true, 1, 0] });
evalc(_);

tryEvalDefun({ expr: ["DEFUN", "1+", ["X"], ["+", "X", 1]]})
evalc(_);

tryEvalProgn({
  expr: ["PROGN", ["+", "X", 1], 2],
  env: new Env(mkGlobalEnv(), "X", 10),
});
evalc(_);

tryEvalApplication({ expr: ["+", 1, 2], env: mkGlobalEnv() });
evalc(_);

evalc({ expr: [["LAMBDA", ["X"], ["+", "X", 1]], 10], env: mkGlobalEnv() });
evalc(_);

function run(expr) {
  var ret = null;
  for (const cont of evale(expr, mkGlobalEnv())) {
    ret = cont.ret;
    // console.log(cont);
  }
  return ret;
}
assertEqual(run([["LAMBDA", ["X"], ["+", "X", 1]], 10]), 11);
run(["PROGN", ["DEFUN", "FACTORIAL", ["N"],
                ["IF", ["=", "N", 1],
                    1,
                    ["*", ["FACTORIAL", ["-", "N", 1]], "N"]]],
              "FACTORIAL"]);
assertEqual(run(["PROGN", ["DEFUN", "FACTORIAL", ["N"],
                            ["IF", ["=", "N", 1],
                                1,
                                ["*", ["FACTORIAL", ["-", "N", 1]], "N"]]],
                          ["FACTORIAL", 10]]),
                3628800);
run(["PROGN", ["DEFUN", "FACTORIAL", ["N"],
                            ["IF", ["=", "N", 1],
                                1,
                                ["*", ["FACTORIAL", ["-", "N", 1]], "N"]]],
                          ["FACTORIAL", 100]]);
