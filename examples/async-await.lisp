; async / await in userland!
; Note: since we are using delimited continuations every function can call AWAIT
; so long as there is an :ASYNC tag in the call stack; no need to mark async
; functions differently from standard functions!

(defmacro async (fn)
  (quasiquote
    (prompt :async (unquote fn)
            (lambda (k p)
              (js-then p (lambda (v) (async (lambda () (call k v)))))))))

(defun await (p)
  (abort :async p))


(defun fetch (url)
  (js-call *global-this* "fetch" url))


(defun single-await ()
  (let ((res (await (fetch "https://matteolandi.net"))))
    (dbg "single-await" (js-get res "status"))))

(defun sequential-awaits ()
  (let ((res1 (await (fetch "https://matteolandi.net")))
        (res2 (await (fetch "https://matteolandi.net/cg.html"))))
    (dbg "sequential-awaits" (js-get res1 "url") (js-get res1 "status")
         (js-get res2 "url") (js-get res2 "status"))))

(defun promise-all ()
  (let ((promises (list (fetch "https://matteolandi.net")
                        (fetch "https://matteolandi.net/cg.html")
                        (fetch "https://matteolandi.net/tmux-externalpipe.html"))))
    (let ((responses (await (js-call (js-get *global-this* "Promise") "all" promises))))
      (dbg "promise-all"
           (js-get (nth 0 responses) "url") (js-get (nth 0 responses) "status")
           (js-get (nth 1 responses) "url") (js-get (nth 1 responses) "status")
           (js-get (nth 2 responses) "url") (js-get (nth 2 responses) "status")))))


(async
  (lambda ()
    (single-await)
    (sequential-awaits)
    (promise-all)))
