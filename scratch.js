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
tryEvalLambda({ expr: ["LAMBDA", ["X"], ["+", "X", 1], 42] });
tryEvalLambda({ expr: ["LAMBDA", ["X"], ["PROGN", ["+", "X", 1], 42]] });
JSON.stringify(_);

tryEvalIf({ expr: ["IF", true, 1, 0] });
evalc(_);

tryEvalDefun({ expr: ["DEFUN", "1+", ["X"], ["+", "X", 1]] });
evalc(_);

tryEvalProgn({
  expr: ["PROGN", ["+", "X", 1], 2],
  env: new Env(mkGlobalEnv(), "X", 10),
});
evalc(_);

tryEvalPrompt({
  expr: [
    "PROMPT",
    "'FOO",
    ["LAMBDA", [], ["+", 34, ["ABORT", "'FOO"]]],
    ["LAMBDA", ["K"], "K"],
  ],
  env: mkGlobalEnv(),
});
evalc(_);

tryApplyCompiled({
  evald: [{ ret: [COMPILED, (a, b) => a + b] }, { ret: 1 }, { ret: 2 }],
});
evalc(_);

evalc({ expr: [["LAMBDA", ["X"], ["+", "X", 1]], 10], env: mkGlobalEnv() });
evalc(_);

