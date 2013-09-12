// simpleq
// A simple queuing system

// local
var scripts = require('./scripts'); // lua script execution

// -- Master Type: Q --
// The master type, a queue of course
function Q(redis, key) {
  // handle forgetting a 'new'
  if (!(this instanceof Q)) {
    return new Q(redis);
  }

  this._redis = redis;
  this._key = key;
}

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
Q.prototype.bpop = function bpop(cb) {
  this._redis.brpop(this._key, 0, function (err, result) {
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
  scripts.eval(this._redis, 'safepullpipe', [this._key, otherQ._key], [el], cb);
}

// Pop an element out of a queue and put it in another queue atomically
// Return the element being popped and pushed or nil
Q.prototype.poppipe = function poppipe(otherQ, cb) {
  this._redis.rpoplpush(this._key, otherQ._key, cb);
};

// Block and Pop an element out of a queue and put it in another queue atomically
// Return the element being popped and pushed
Q.prototype.bpoppipe = function bpoppipe(otherQ, cb) {
  this._redis.brpoplpush(this._key, otherQ._key, 0, cb);
};

// Clear the queue of elements
Q.prototype.clear = function clear(cb) {
  this._redis.del(this._key, cb);
};

// List all the elements in the queue
Q.prototype.list = function list(cb) {
  this._redis.lrange(this._key, 0, -1, cb);
};

exports.Q = exports.Queue = Q;