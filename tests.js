assertEqual(skipWhitespace(new StringStream("      foo")), 6);
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
  parseList(
    new StringStream(`(defun hello-world ()
                        (format t "Hello!"))`),
  ),
  ["DEFUN", "HELLO-WORLD", [], ["FORMAT", "T", ["STRING", "Hello!"]]],
);

assert(taggedList(run(`*global-this*`), "JS-OBJ"));
assertEqual(run(`(js-get "Hello" 0)`), ["STRING", "H"]);
assertEqual(run(`(js-call (js-get *global-this* "Math") "max" 1 12)`), 12);
assertEqual(run(`(js-call "Hello" "toUpperCase")`), ["STRING", "HELLO"]);

assertEqual(run(`((lambda (x) (+ x 1)) 10)`), 11);
assertEqual(
  run(`(progn
         (defun factorial (n)
           (if (= n 1)
             1
             (* (factorial (- n 1)) n)))

        (factorial 100))`),
  9.33262154439441e157,
);
assertEqual(
  run(`(progn
         (defun fib (n)
           (if (< n 2)
             n
             (+ (fib (- n 1)) (fib (- n 2)))))

        (fib 10))`),
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

assertEqual(
  run(`(let ((x 10)
             (y 32))
         (+ x y))`),
  42,
);
