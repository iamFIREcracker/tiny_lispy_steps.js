## Hack

```
$ node-rlwrap
> .load bootstrap.js
> .load reader.js
> .load eval.js
> ...
```

## SUPPORTED:

- `SET`
- `FN`
- `QUOTE`
- `QUASIQUOTE`, `UNQUOTE`
- 'MACRO'
- `IF`
- `DEF`
- 'MAC'
- `PROGN`
- `LET`
- `LOAD`

### JavaScript interoperability

- `JS-GET` to get the value of the property of a JavaScript object
- `JS-CALL` to get the value of the property of a JavaScript object
- `JS-THEN` to register a callback to an existing promise

## Rest Parameters

The interpreter supports variable arguments (rest parameters) in three ways:

1. **Dotted Lists**: Similar to Scheme, you can use a dot notation in parameter lists:
   ```lisp
   (def first-n (n . rest) 
     (if (= n 0) 
         nil 
         (cons (car rest) (first-n (- n 1) (cdr rest)))))
   ```

2. **Single Symbol Parameter**: If a function or macro has a single symbol as its parameter list (not in a list), it collects all arguments:
   ```lisp
   (def list args args)  ; args receives all arguments as a list
   ```

3. **Implementation Details**:
   - The reader parses dotted lists by detecting the dot character and treating what follows as the rest parameter
   - The evaluator handles both dotted lists and single symbol parameters by:
     - Extracting regular parameters before the dot
     - Collecting remaining arguments into the rest parameter
     - For single symbol parameters, all arguments go into that parameter

## TODO:

- `PROMPT` / `ABORT`
- `PAUSE` to pause the execution and allow you to inspect the current
  continuation.  To resume, simply call `evalc` or `evalca` that continuation.
- SPLICE
- BREAKPOINT to pause the evaluation: could wrap the whole execution around
  a `(PROMPT :DEBUG ... (lambda (k) k))`
- JS-CATCH
- Error handling
- Async single-step evaluation -- or how to get rid of that `evalca` inside
  JS-THEN.  Maybe we store all the async tasks somewhere, so that `run` can
  switch to a different async stream when the current one is done; similarly
  for manually stepping through the execution via `evalc`.
- Make SET work with places, e.g., (car v), and not just symbols

## Links:

- [The Metacircular Evaluator](https://sarabander.github.io/sicp/html/4_002e1.xhtml)
- [Guile: 6.11.5.1 Prompt Primitives](https://www.gnu.org/software/guile/manual/html_node/Prompt-Primitives.html)
- [Bel](https://paulgraham.com/bel.html)
- https://x.com/meekaale/status/1510004560152211458
- https://x.com/paulg/status/1260138502974570497
