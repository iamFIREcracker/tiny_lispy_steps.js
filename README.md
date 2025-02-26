## Hack

```
$ node-rlwrap
> .load bootstrap.js
> .load reader.js
> .load index.js
> ...
```

## SUPPORTED:

- `SYMBOL-FUNCTION`
- `LAMBDA`
- `IF`
- `DEFUN`
- `PROGN`
- `LET`
- `PROMPT` / `ABORT`
- `CALL`

### JavaScript interoperability

- `JS-GET` to get the value of the property of a JavaScript object
- `JS-CALL` to get the value of the property of a JavaScript object
- `JS-THEN` to register a callback to an existing promise

## TODO:

- `QUOTE`, `QUASIQUOTE`, `UNQUOTE`, `DEFMACRO`
- BREAKPOINT to pause the evaluation: could wrap the whole execution around
  a `(PROMPT :DEBUG ... (lambda (k) k))`
- JS-CATCH
- Error handling
- Async single-step evaluation -- or how to get rid of that `evalca` inside
  JS-THEN


## Links:

- [The Metacircular Evaluator](https://sarabander.github.io/sicp/html/4_002e1.xhtml)
- [Guile: 6.11.5.1 Prompt Primitives](https://www.gnu.org/software/guile/manual/html_node/Prompt-Primitives.html)
