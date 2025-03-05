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
- `PAUSE` to pause the execution and allow you to inspect the current
  continuation.  To resume, simply call `evalc` or `evalca` that continuation.
- `LOAD` to load forms from a file

### JavaScript interoperability

- `JS-GET` to get the value of the property of a JavaScript object
- `JS-CALL` to get the value of the property of a JavaScript object
- `JS-THEN` to register a callback to an existing promise

## TODO:

- Environment is kind of fucked up at the moment... all the variables are
  _dynamic_ -- no concept of lexical scope
- BREAKPOINT to pause the evaluation: could wrap the whole execution around
  a `(PROMPT :DEBUG ... (lambda (k) k))`
- JS-CATCH
- Error handling
- Async single-step evaluation -- or how to get rid of that `evalca` inside
  JS-THEN.  Maybe we store all the async tasks somewhere, so that `run` can
  switch to a different async stream when the current one is done; similarly
  for manually stepping through the execution via `evalc`.

## Links:

- [The Metacircular Evaluator](https://sarabander.github.io/sicp/html/4_002e1.xhtml)
- [Guile: 6.11.5.1 Prompt Primitives](https://www.gnu.org/software/guile/manual/html_node/Prompt-Primitives.html)
