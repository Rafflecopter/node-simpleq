# simpleq

A super simple Redis-backed queue.

## Operation

Install:

```
npm install simpleq
```

Creation:

```javascript
var redis = require('redis'),
  cli = redis.createClient();

var simpleq = require('simpleq'),
  q = new simpleq.Q(cli, 'my-simpleq');
```

Operations:

- `q.push(el)`
- `q.pop()` and `q.bpop()` (blocking)
- `q.pull(el)` Pull out a specific el from the queue
- `q1.pullpipe(q2, el)` Pull and push into another queue atomicly
- `q1.poppipe(q2)` and `q1.bpoppipe(q2)` (blocking): Pop and push to another queue; returns el (also atomic)

## Tests

```
npm install --dev
nodeunit test
```

## License

See LICENSE file.
