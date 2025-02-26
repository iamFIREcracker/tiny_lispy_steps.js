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

// Promise chaining via JS-THEN
run(`
       (defun fetch (url)
         (js-call *global-this* "fetch" url))

       (js-then (fetch "https://matteolandi.net")
         (lambda (res) (dbg (js-get res "status"))))

        `);
// poor man's async / await in userland
// Note: only one AWAIT call per :ASYNC prompt.  For a more generic solution
// see the next example, where we use macros to allow nesting of AWAIT calls.
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
// With PAUSE
run(`
       (defun fetch (url)
         (js-call *global-this* "fetch" url))

       (defun await (p)
         (abort :async p))

       (prompt :async (lambda ()
                        (let ((res (await (fetch "https://matteolandi.net"))))
                          (pause)
                          (dbg (js-get res "status"))))
          (lambda (k p) (js-then p (lambda (v) (call k v)))))

       `);
// Unwrap promise for async task
guestToHost(_);
// Await it
await _;
// Continue evaluation
evalca(_);

// async / await in userland!
// Note: since we are using delimited continuations
// every function can call AWAIT so long as there is an
// :ASYNC tag in the call stack; no need to mark async
// functions differently from standard functions!
run(`
       (defun fetch (url)
         (js-call *global-this* "fetch" url))

       (defmacro async (fn)
         (quasiquote (prompt :async (unquote fn)
                       (lambda (k p) (js-then p (lambda (v) (async (lambda () (call k v)))))))))

       (defun await (p)
         (abort :async p))

       (defun main()
         (let ((res (await (fetch "https://matteolandi.net"))))
           (dbg (js-get res "status"))))

       (async
         (lambda ()
           (main)))

       `);
// Multiple AWAIT calls
run(`
       (defun fetch (url)
         (js-call *global-this* "fetch" url))

       (defmacro async (fn)
         (quasiquote (prompt :async (unquote fn)
                       (lambda (k p) (js-then p (lambda (v) (async (lambda () (call k v)))))))))

       (defun await (p)
         (abort :async p))

       (defun main()
         (let ((res1 (await (fetch "https://matteolandi.net")))
               (res2 (await (fetch "https://matteolandi.net/cg.html"))))
           (dbg (js-get res1 "url") (js-get res1 "status")
                (js-get res2 "url") (js-get res2 "status"))))

       (async
         (lambda ()
           (main)))

       `);
