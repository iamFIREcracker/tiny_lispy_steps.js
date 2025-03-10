assertEqual(skipWhitespace(new StringStream("      foo")), 6);

assertEqual(parseAtom(new StringStream("")), undefined);
assertEqual(parseAtom(new StringStream("foo")), "FOO");
assertEqual(parseAtom(new StringStream("1.2")), 1.2);
assertEqual(parseAtom(new StringStream("t")), "T");
assertEqual(parseAtom(new StringStream("nil")), "NIL");
assertEqual(parseAtom(new StringStream('"foo"')), ["STRING", "foo"]);

assertEqual(parseList(new StringStream("()")), []);
assertEqual(parseList(new StringStream(`(123 "foo" x)`)), [
  123,
  ["STRING", "foo"],
  "X",
]);
assertEqual(parseList(new StringStream(`(0)`)), [0]);
assertEqual(parseList(new StringStream('("")')), [["STRING", ""]]);

assertEqual(
  readFromString(
    `(defun hello-world ()
       (format t "Hello!"))`,
  ),
  ["DEFUN", "HELLO-WORLD", [], ["FORMAT", "T", ["STRING", "Hello!"]]],
);
assertEqual(
  readAllFromString(
    `(defun hello-world ()
       (format t "Hello!"))

     (hello)`,
  ),
  [
    ["DEFUN", "HELLO-WORLD", [], ["FORMAT", "T", ["STRING", "Hello!"]]],
    ["HELLO"],
  ],
);

assertEqual(run(`(if t       42 lookup-error)`), 42);
assertEqual(run(`(if nil     lookup-error 42)`), 42);
assertEqual(run(`(if 0       42 lookup-error)`), 42);
assertEqual(run(`(if (> 1 0) 42 lookup-error)`), 42);

assert(taggedList(run(`*global-this*`), "JS-OBJ"));
assertEqual(run(`(js-get "Hello" 0)`), ["STRING", "H"]);
assertEqual(run(`(js-call (js-get *global-this* "Math") "max" 1 12)`), 12);
assertEqual(run(`(js-call "Hello" "toUpperCase")`), ["STRING", "HELLO"]);

assertEqual(run(`((lambda (x) (+ x 1)) 10)`), 11);
assertEqual(
  run(`
         (defun factorial (n)
           (if (= n 1)
             1
             (* (factorial (- n 1)) n)))

         (factorial 100)

      `),
  9.33262154439441e157,
);
assertEqual(
  run(`
         (defun fib (n)
           (if (< n 2)
             n
             (+ (fib (- n 1)) (fib (- n 2)))))

         (fib 10)

      `),
  55,
);

assertEqual(
  run(`(prompt :foo (lambda () (+ 34 (abort :foo 42)))
         (lambda (k n) n))`),
  42,
);
assertEqual(
  run(`(* ((prompt :foo (lambda () (+ 34 (abort :foo)))
             (lambda (k) k))
            8)
          2)`),
  84,
);

assertEqual(run(`(list 1 "two" :three)`), ["JS-ARRAY", 1, ["STRING", "two"], ":THREE"]);

assertEqual(
  run(`(let ((x 10)
             (y 32))
         (+ x y))`),
  42,
);

assertEqual(run(`(quote 123)`), 123);
assertEqual(run(`(quote (foo "bar"))`), ["FOO", ["STRING", "bar"]]);
assertEqual(run(`(dbg (quote (+ 1 2)) (+ 1 2))`), ["+", 1, 2]);

assertEqual(evalca({ expr: ["QUASIQUOTE", ["X"]] }), ["X"]);
assertEqual(
  evalca({
    expr: ["QUASIQUOTE", [["UNQUOTE", "X"]]],
    env: new Env(null, "X", ["LAMBDA", [], "BAR"]),
  }),
  [["LAMBDA", [], "BAR"]],
);

assertEqual(
  run(`

         (defmacro dbgl (x)
           (quasiquote
             (dbg (quote (unquote x)) (unquote x))))

         (dbgl (+ 1 2))

      `),
  ["+", 1, 2],
);
