# simpleq [![Build Status][1]][2]

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
    - `q1.spullpipe(q2, el, cb)` is a safe version which will not insert el into q2 unless it has been successfully pulled out of q1. This is done atomically using a lua script.
- `q1.poppipe(q2, cb)` and `q1.bpoppipe(q2, cb)` (blocking): Pop and push to another queue; returns popped element (also atomic).
- `q.clear(cb)` Clear out the queue
- `q.list(cb)` List all elements in the queue
- `q.zrangepush(zset, min, max, cb)` Do a zrangebyscore, then a zremrangebyscore, then an lpush for all elements into the queue. This is a useful function for higher level applications.

Listeners:

simpleq's can start listeners that run `bpoppipe` or `bpop` continuously and make callbacks when they occur. These two functions are `.poplisten` and `.poppipelisten`. The both accept two options:

- `timeout` (default: 1) Number of seconds to timeout the blocking operation (to check for `.end()`; use 0 for infinity)
- `max_out` (default: 0 ~ infinity) Maximum number of callbacks allowed to be out at one time.

The callbacks on a message from a listener pass a done function that must be called when processing is complete. If not in the same closure, `listener.done()` and `listener.emit('done');` will suffice.

_Note_: Calling listen will clone the redis connection, allowing `.push` to still work because another connection is being blocked. Calling a listen function more than once will result in a thrown error, as this is not prudent.

Examples below:

```javascript
var listener = q.poplisten({timeout: 2, max_out: 10});

// or
var listener = q.poppipelistener(otherq, {timeout: 2, max_out: 10});

// then
listener.on('message', function (msg, done) {
    // do stuff
    done(); // idempotent. you can call it more than once.
  }).on('error', function (err) {
    console.error(err);
  });

// eventually
listener
  .once('end', function whenItIsReallyReadyToEnd() {...}) // after all jobs have finished
  .end(); // idempotent if you've already ended the listener
```

## Tests

```
npm install -g nodeunit
nodeunit test
```

## License

See LICENSE file.

[1]: https://travis-ci.org/Rafflecopter/node-simpleq.png?branch=master
[2]: http://travis-ci.org/Rafflecopter/node-simpleq