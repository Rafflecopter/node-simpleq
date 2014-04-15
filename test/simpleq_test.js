// simpleq_test.js

// vendor
var redis = require('redis').createClient(6379, 'localhost', { enable_offline_queue: false }),
  redis2 = require('redis').createClient(6379, 'localhost', { enable_offline_queue: false }),
  redis3 = require('redis').createClient(6379, 'localhost', { enable_offline_queue: false }),
  Moniker = require('moniker'),
  async = require('async'),
  _ = require('underscore');

// local
var simpleq = require('../simpleq');

// Setup
var tests = exports.tests = {},
  Q, Q2, Qc;

tests.setUp = function setUp (callback) {
  async.parallel([
    redis.ready ? function (cb) {cb()} : redis.on.bind(redis, 'ready'),
    redis2.ready ? function (cb) {cb()} : redis2.on.bind(redis2, 'ready'),
    redis3.ready ? function (cb) {cb()} : redis3.on.bind(redis3, 'ready')
  ], function () {
    Q = new simpleq.Q(redis, 'simpleq-test:' + Moniker.choose());
    Q2 = new simpleq.Q(redis2, 'simpleq-test:' + Moniker.choose());
    Q.clone(redis3, function (err, qc) {
      Qc = qc

      callback(err)
    });
  })
};

tests.tearDown = function tearDown (callback) {
  if (Q && Q2) {
    return async.parallel([
      _.bind(Q.clear, Q),
      _.bind(Q2.clear, Q2)
    ], callback);
  }
  callback();
};

// Clean up redis to allow a clean escape!
exports.cleanUp = function cleanUp (test) {
  redis.end();
  redis2.end();
  redis3.end();
  test.done();
};

// -- Tests --

tests.testPush = function (test) {
  async.series([
    _.bind(Q.push, Q, 'foo123'),
    _.bind(Q.push, Q, '456bar'),

    checkByList(test, Q, ['456bar', 'foo123'])
  ], test.done);
};

tests.testPop = function (test) {
  async.series([
    function (cb) {
      Q.pop(function (err, result) {
        test.ifError(err);
        test.equal(result, null);
        cb();
      });
    },
    _.bind(Q.push, Q, 'father'),
    _.bind(Q.push, Q, 'mother'),
    _.bind(Q.push, Q, 'baby'),
    function (cb) {
      Q.pop(function (err, el) {
        test.ifError(err);
        test.equal(el, 'father');
        cb();
      });
    }
  ], test.done);
};

tests.testBpop = function (test) {
  async.parallel([
    _.bind(Q.bpop, Q),
    _.bind(Qc.push, Qc, 'urukai'),
  ], function (err, results) {
    test.ifError(err);
    test.deepEqual(results[0], 'urukai');
    test.done();
  });
};

tests.testBpopTimeout = function (test) {
  var start = new Date();
  Q.bpop(1, function (err, res) {
    test.ifError(err);
    test.equal(res, null);
    var time = new Date() - start;
    test.ok(time > 999 && time < 10000, 'time: ' + time);
    test.done();
  });
};

tests.testPull = function (test) {
  async.series([
    _.bind(Q.push, Q, 'darth'),
    _.bind(Q.push, Q, 'vader'),
    _.bind(Q.push, Q, 'mothe-vada'),
    // pull now
    _.bind(Q.pull, Q, 'mothe-vada'),
    _.bind(Q.pull, Q, 'darth'),

    checkByList(test, Q, ['vader'])
  ], test.done);
};

tests.testPopPipe = function (test) {
  async.series([
    _.bind(Q.push, Q, 'luke'),
    _.bind(Q.push, Q, 'skywalker'),
    _.bind(Q.push, Q, 'groundcrawler'),
    function (cb) {
      Q.poppipe(Q2, function (err, el) {
        test.ifError(err);
        test.equal(el, 'luke');
        cb();
      });
    },
    function (cb) {
      Q.poppipe(Q2, function (err, el) {
        test.ifError(err);
        test.equal(el, 'skywalker');
        cb();
      });
    },
    checkByList(test, Q, ['groundcrawler']),
    checkByList(test, Q2, ['skywalker', 'luke'])
  ], test.done);
};

tests.testBpopPipe = function (test) {
  async.series([
    _.bind(async.parallel, null, [
      _.bind(Q.bpoppipe, Q, Q2),
      _.bind(Qc.push, Qc, 'luke')
    ]),
    _.bind(Qc.push, Qc, 'skywalker'),
    _.bind(Qc.push, Qc, 'groundcrawler'),
    _.bind(Q.bpoppipe, Q, Q2),

    checkByList(test, Q, ['groundcrawler']),
    checkByList(test, Q2, ['skywalker', 'luke'])
  ], function (err, results) {
    test.ifError(err);
    test.equal(results[0][0],'luke');
    test.equal(results[3], 'skywalker');
    test.done();
  });
};

tests.testBpopPipeTimeout = function (test) {
  var start = new Date();
  Q.bpoppipe(Q2, 1, function (err, res) {
    test.ifError(err);
    test.equal(res, null);
    var time = new Date() - start;
    test.ok(time > 999 && time < 10000, 'time: ' + time);
    test.done();
  });
};

tests.testPullPipe = function (test) {
  async.series([
    _.bind(Q.push, Q, 'darth'),
    _.bind(Q.push, Q, 'vader'),
    _.bind(Q.push, Q, 'mothe-vada'),
    _.bind(Q.pullpipe, Q, Q2, 'vader'),
    _.bind(Q.pullpipe, Q, Q2, 'emperor'), // This is an unsafe version of pullpipe
    checkByList(test, Q, ['mothe-vada', 'darth']),
    checkByList(test, Q2, ['emperor', 'vader'])
  ], test.done);
};

tests.testSpullPipe = function (test) {
  async.series([
    _.bind(Q.push, Q, 'tobias'),
    _.bind(Q.push, Q, 'gob'),
    _.bind(Q.push, Q, 'maybe'),
    _.bind(Q.spullpipe, Q, Q2, 'gob'),
    _.bind(Q.spullpipe, Q, Q2, 'george-michael'),

    checkByList(test, Q, ['maybe', 'tobias']),
    checkByList(test, Q2, ['gob'])
  ], function (err, results) {
    test.ifError(err);
    test.equal(results[3], 1);
    test.equal(results[4], 0);
    test.done();
  })
}

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