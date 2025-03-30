(mac fn (parms body1 . body2)
  (if body2
      `(list 'lit 'clo scope ',parms 'body1)
      `(list 'lit 'clo scope ',parms '(progn ,body1 ,@body2))))

(mac def (n . rest)
  `(set ,n (fn ,@rest)))

(mac macro args
  `(lit mac (fn ,@args)))

(mac let (parm val . body)
  `((fn (,parm) ,@body) ,val))

(def list x x)
