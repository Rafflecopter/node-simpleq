// simpleq
// A simple queuing system

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

Q.prototype.push = function push(el, cb) {
  this._redis.lpush(this._key, el, cb);
};

Q.prototype.pop = function pop(cb) {
  this._redis.rpop(this._key, cb);
};
Q.prototype.bpop = function bpop(cb) {
  this._redis.brpop(this._key, 0, cb);
};

Q.prototype.pull = function pull(el, cb) {
  this._redis.lrem(this._key, 0, el, cb);
};

Q.prototype.pullpipe = function pullpipe(otherQ, el, cb) {
  this._redis.multi()
    .lrem(this._key, 0, el)
    .lpush(otherQ._key, el)
    .exec(function (err, replies) {
      if (err) {
        return cb(err);
      }
      cb(undefined, replies && replies.length > 1 && replies[1]);
    });
};

Q.prototype.poppipe = function poppipe(otherQ, cb) {
  this._redis.rpoplpush(this._key, otherQ._key, cb);
};
Q.prototype.bpoppipe = function bpoppipe(otherQ, cb) {
  this._redis.brpoplpush(this._key, otherQ._key, 0, cb);
};

Q.prototype.clear = function clear(cb) {
  this._redis.del(this._key, cb);
};

Q.prototype.list = function list(cb) {
  this._redis.lrange(this._key, 0, -1, cb);
};

exports.Q = exports.Queue = Q;