(mac def (n . rest)
  `(set ,n (fn ,@rest)))

(mac macro args
  `(lit mac (fn ,@args)))

(mac let (parm val . body)
  `((fn (,parm) ,@body) ,val))

(def list x x)
