mkGlobalEnv();


run1(`((lambda (x) (+ x 1)) 10)`);
evalc(_);

tryEvalSelfEvaluating({ expr: 12 });
tryEvalSelfEvaluating({ expr: true });

tryEvalVariable({ expr: "FOO", env: new Env(null, "FOO", "bar") });

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

run(`*global-this*`);
run(`(js-get *global-this* "console")`);
run(`(js-call (js-get *global-this* "console") "log" "YAYAYAYAYA!")`);
run(`
       (defun fetch (url)
         (js-call *global-this* "fetch" url))

       (js-then (fetch "https://matteolandi.net")
         (lambda (res) (dbg (js-get res "status"))))

        `);
run(`
       (defun fetch (url)
         (js-call *global-this* "fetch" url))

       (defun await (p)
         (abort :async p))

       (prompt :async (lambda ()
                        (let ((res (await (fetch "https://matteolandi.net"))))
                          (dbg (js-get res "status"))))
          (lambda (k p) (js-then p (lambda (v) (call k v)))))

       `);
