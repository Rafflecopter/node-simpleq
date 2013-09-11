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

- `q.push(el, cb)` Returns number of elements in queue.
- `q.pop(cb)` and `q.bpop(cb)` (blocking) Returns element popped or null
- `q.pull(el, cb)` Pull out a specific el (the highest/oldest el in the queue to be specific if elements are repeated) from the queue. Returns number of elements removed (0 or 1).
- `q1.pullpipe(q2, el, cb)` Pull and push into another queue atomicly. Returns elements in second queue. (Note, that if el does not exist in q1, it will still be put into q2)
- `q1.poppipe(q2, cb)` and `q1.bpoppipe(q2, cb)` (blocking): Pop and push to another queue; returns popped element (also atomic).

## Tests

```
npm install -g nodeunit
npm install --dev
nodeunit test
```

## Todo

Add a lua script to check for errors in lrem before lpush in pullpipe command.

## License

See LICENSE file.
