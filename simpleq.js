// simpleq
// A simple queuing system

// builtin
var path = require('path');

// vendor
var reval = require('redis-eval');

// local
var Listener = require('./listener');

var safepullpipe_filename = path.join(__dirname, '/scripts/safepullpipe.lua');

// -- Master Type: Q --
// The master type, a queue of course
function Q(redisClient, key) {
  // handle forgetting a 'new'
  if (!(this instanceof Q)) {
    return new Q(redisClient, key);
  }

  this._redis = redisClient;
  this._key = key;
}

// Clone this Q by creating a new redis connection
Q.prototype.clone = function clone(redisClone, callback) {
  var key = this._key
    , q = new Q(redisClone, key);

  if (redisClone.ready) {
    return callback(null, q);
  }

  redisClone.on('ready', function () {
    callback(null, new Q(redisClone, key))
  })
};

// Push an element onto the queue
// Returns length of queue
Q.prototype.push = function push(el, cb) {
  this._redis.lpush(this._key, el, cb);
};

// Pop an element off the queue
// Returns element or nil
Q.prototype.pop = function pop(cb) {
  this._redis.rpop(this._key, cb);
};

// Block and Pop an element off the queue
// Returns element
Q.prototype.bpop = function bpop(timeout, cb) {
  if (cb === undefined) {
    cb = timeout;
    timeout = 0;
  }

  this._redis.brpop(this._key, timeout, function (err, result) {
    cb(err, result && result.length === 2 && result[1]);
  });
};

// Pull n element out of a queue. (The highest/oldest one if elements are repeated)
// Returns the number of elements removed (0 or 1)
Q.prototype.pull = function pull(el, cb) {
  this._redis.lrem(this._key, -1, el, cb);
};

// Pull an element out of a queue and put in another queue atomically.
// Return the number of elements in the other queue
// Note: This will insert an element into the second queue regardless of whether it exists in the first queue
Q.prototype.pullpipe = function pullpipe(otherQ, el, cb) {
  this._redis.multi()
    .lrem(this._key, -1, el)
    .lpush(otherQ._key, el)
    .exec(function (err, replies) {
      if (err) {
        return cb(err);
      }
      cb(undefined, replies && replies.length > 1 && replies[1]);
    });
};

// Safely pull an element out of a queue and put in another atomically.
// If the element does not exist in the queue, it is not inserted in the second queue
// Returns 0 for non-existance in first queue, or length of second queue
Q.prototype.spullpipe = function spullpipe(otherQ, el, cb) {
  reval(this._redis, safepullpipe_filename, [this._key, otherQ._key], [el], cb);
}

// Pop an element out of a queue and put it in another queue atomically
// Return the element being popped and pushed or nil
Q.prototype.poppipe = function poppipe(otherQ, cb) {
  this._redis.rpoplpush(this._key, otherQ._key, cb);
};

// Block and Pop an element out of a queue and put it in another queue atomically
// Return the element being popped and pushed
Q.prototype.bpoppipe = function bpoppipe(otherQ, timeout, cb) {
  if (cb === undefined) {
    cb = timeout;
    timeout = 0;
  }

  this._redis.brpoplpush(this._key, otherQ._key, timeout, cb);
};

// Clear the queue of elements
Q.prototype.clear = function clear(cb) {
  this._redis.del(this._key, cb);
};

// List all the elements in the queue
Q.prototype.list = function list(cb) {
  this._redis.lrange(this._key, 0, -1, cb);
};


// Create an event emitter for elements as we pip them
// options:
//  - max_out: Maximum callbacks allowed out at once (default 0 ~ infinity)
/*
    var listener = q.poplisten(otherQ, {max_out: 10})
      .on('ready', function () {
        // listener is ready to go and running
      })
      .on('message', function (msg, done) {
        // do something...
        done();
      })
      .on('error', function (err) {...});
    });

    listener.end();
*/
Q.prototype.poplisten = function poplisten(options) {
  if (this._listened) {
    throw new Error('You can\'t call a listen function more than once. Its not prudent.');
  }
  this._listened = true;

  options = options || {};

  var max_out = options.max_out || options.max_concurrent_callbacks || 0
    , timeout = options.blocking_timeout || 0
    , clone
    , listener = new Listener(blockfunc, max_out)

  listener.once('end', function () {
    this._listened = false;
    clone._redis.end();
  });

  this.clone(options.redisClone, function (err, theclone) {
    if (err) throw err

    clone = theclone
    listener.ready()
  });

  function blockfunc(callback) {
    if (clone._redis.ready) {
      clone.bpop(timeout, callback);
    } else {
      setTimeout(callback.bind(null, new Error('Redis connection is not ready. Cannot listen on it')), 1000);
    }
  };

  return listener;
};

// Create an event emitter for elements as we poppipe them
// otherQ - the otherQ parameter to poppipe
// options:
//  - max_out: Maximum callbacks allowed out at once (default 0 ~ infinity)
/*
    var listener = q.poppipelisten(otherQ, {max_out: 10})
      .on('ready', function () {
        // listener is ready to go and running
      })
      .on('message', function (msg, done) {
        // do something...
        done();
      })
      .on('error', function (err) {...});
    });

    listener.end();
*/
Q.prototype.poppipelisten = function poppipelisten(otherQ, options) {
  if (this._listened) {
    throw new Error('You can\'t call a listen function more than once. Its not prudent.');
  }
  this._listened = true;

  options = options || {};

  var max_out = options.max_out || options.max_concurrent_callbacks || 0
    , timeout = options.blocking_timeout || 0
    , clone
    , ended = false
    , listener = new Listener(blockfunc, max_out)

  listener.once('end', function () {
    this._listened = false;
    if (clone)
      clone._redis.end();

    // its possible for the listener to be closed before the clone is ready
    ended = true;
  });

  this.clone(options.redisClone, function (err, theclone) {
    if (err) throw err

    clone = theclone

    if (ended)
      clone._redis.end()
    else
      listener.ready()
  });

  function blockfunc(callback) {
    if (clone._redis.ready) {
      clone.bpoppipe(otherQ, timeout, callback);
    } else {
      setTimeout(callback.bind(null, new Error('Redis connection is not ready. Cannot listen on it')), 1000);
    }
  };

  return listener
};


exports.Q = exports.Queue = Q;