(define gen-tag (make-prompt-tag))

(define (make-gen body)
  (let ((next (lambda () (body) #f))
        (current #nil))
    (lambda (msg)
      (cond ((eq? msg 'next) (call-with-prompt gen-tag
                               next
                               (lambda (k n)
                                 (set! next k)
                                 (set! current n)
                                 #t)))
            ((eq? msg 'current) current)))))

(define (yield value)
  (abort-to-prompt gen-tag value))

(define (yield* gen)
  (while (gen 'next)
    (yield (gen 'current))))


(define g (make-gen (lambda ()
                      (yield 1)
                      (yield 2)
                      (yield 3)
                      (yield* (make-gen (lambda ()
                                          (yield 4)
                                          (yield 5)
                                          (yield 6)))))))
