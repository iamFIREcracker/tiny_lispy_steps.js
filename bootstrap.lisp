(mac def (n . rest)
  `(set ,n (fn ,@rest)))

(mac macro args
  `(lit mac (fn ,@args)))

(def list x x)
