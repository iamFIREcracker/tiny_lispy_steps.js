## Hack

```
$ node-rlwrap
> .load bootstrap.js
> .load reader.js
> .load index.js
> ...
```

## SUPPORTED:

- `LAMBDA`
- `IF`
- `DEFUN`
- `PROGN`
- `LET`
- `PROMPT` / `ABORT`

## TODO:

- `QUOTE`, `QUASIQUOTE`, `UNQUOTE`, `DEFMACRO`
- Js/Promise support via `PROMPT` / `ABORT`
- BREAKPOINT to pause the evaluation: could wrap the whole execution around
  a `(PROMPT :DEBUG ... (lambda (k) k))`

## Links:

- [The Metacircular Evaluator](https://sarabander.github.io/sicp/html/4_002e1.xhtml)
- [Guile: 6.11.5.1 Prompt Primitives](https://www.gnu.org/software/guile/manual/html_node/Prompt-Primitives.html)
