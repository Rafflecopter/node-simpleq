// simpleq_test.js
require('longjohn');

// vendor
var redis = require('redis').createClient(),
  Moniker = require('moniker'),
  async = require('async'),
  _ = require('underscore');

// local
var simpleq = require('../simpleq');

// Setup
var tests = exports.ListenerTest = {},
  Q, Q2, L;

tests.setUp = function setUp (callback) {
  Q = new simpleq.Q(redis, 'simpleq-test:' + Moniker.choose());
  Q2 = new simpleq.Q(redis, 'simpleq-test:' + Moniker.choose());
  L = null;
  callback();
};

tests.tearDown = function tearDown (callback) {
  async.parallel([
    _.bind(Q.clear, Q),
    _.bind(Q2.clear, Q2),
    function (cb) {
      if (!L) {
        return cb();
      }
      L.end(); // Skip waiting for the timeout to end.
      cb();
    }
  ], function () {
    callback();
  });
};

// Clean up redis to allow a clean escape!
exports.cleanUp = function cleanUp (test) {
  redis.end();
  test.done();
};

// -- Tests --

tests.testBasicPop = function (test) {
  L = Q.poplisten()
    .on('error', test.ifError)
    .on('message', function (msg, done) {
      test.equal(msg, 'hello');
      checkByList(test, Q, [])(test.ifError);
      process.nextTick(done);

      L.once('end', function (err) {
        test.done(err);
      })
        .end();
    });

  Q.push('hello', test.ifError);
};

tests.testBasicPopPipe = function (test) {
  L = Q.poppipelisten(Q2)
    .on('error', test.ifError)
    .on('message', function (msg, done) {
      test.equal(msg, 'world');
      process.nextTick(done);

      async.parallel([
        checkByList(test, Q, []),
        checkByList(test, Q2, ['world'])
      ], function (e,r) {
        L.once('end', function (err) {
          test.done(err);
        })
        .end();
      });
    });

  Q.push('world', test.ifError);
};

tests.testListenerDone = function (test) {

  var outexp = 3;

  L = Q.poplisten()
    .on('error', test.ifError)
    .on('message', function (msg, done) {;
      if (msg === 'hello') {
        setTimeout(function () { L.done(); test.equal(L._out, 0); }, 100);
      } else if (msg === 'world') {
        setTimeout(function () { L.emit('done'); test.equal(L._out, 1); }, 35);
      } else if (msg === '!') {
        process.nextTick(function () { done(); test.equal(L._out, 2); });
        setTimeout(function () { done(); test.equal(L._out, 2); }, 5);
        setTimeout(function () { done(); test.equal(L._out, 2); }, 10);

        L.once('end', function () {
          test.equal(L._out, 0);
          test.done();
        }).end();
      } else {
        test.ifError(new Error('Didnt understand message ' + msg));
      }
    });

  L.on('done', function () {
    test.equal(L._out, --outexp);
  });

  Q.push('hello', test.ifError);
  Q.push('world', test.ifError);
  Q.push('!', test.ifError);
};

tests.testMaximumOut = function (test) {
  var out = 0, n = 0;

  L = Q.poplisten({max_out: 1})
    .on('error', test.ifError)
    .on('message', function (msg, done) {
      out++;
      n++;
      test.ok(out === 1);
      setTimeout(done, 10);

      if (n === 3) {
        test.done();
      }
    });

  L.on('done', function () {
    out--;
  });

  Q.push('hello', test.ifError);
  Q.push('world', test.ifError);
  Q.push('!', test.ifError);
};

tests.testTimeout = function (test) {
  var start = new Date();
  L = Q.poppipelisten(Q2, {timeout: 2})
    .on('error', test.ifError)
    .once('end', function () {
      var time = new Date() - start;
      test.ok(time > 1999, 'time sould be more than 2 seconds ' + time);
      test.done();
    });

  process.nextTick(function () {
    L.end();
  });
};

// -- helpers --
function checkByList(test, Q, exp) {
  return function (cb) {
    Q.list(function (err, list) {
      test.ifError(err);
      test.deepEqual(list, exp);
      cb();
    });
  };
}