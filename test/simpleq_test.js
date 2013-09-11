// simpleq_test.js

// vendor
var redis = require('redis').createClient(),
  redis2 = require('redis').createClient(),
  Moniker = require('moniker'),
  async = require('async'),
  _ = require('underscore');

// local
var simpleq = require('../simpleq');

// Setup
var tests = exports.tests = {},
  Q, Q2, Qc;

tests.setUp = function setUp (callback) {
  Q = new simpleq.Q(redis, 'simpleq-test:' + Moniker.choose());
  Q2 = new simpleq.Q(redis, 'simpleq-test:' + Moniker.choose());
  Qc = new simpleq.Q(redis2, Q._key);
  callback();
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
    _.bind(Qc.push, Qc, 'urukai')
  ], function (err, results) {
    test.ifError(err);
    test.deepEqual(results[0], 'urukai');
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
      Q.bpoppipe(Q2, function (err, el) {
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
  ], test.done);
};

tests.testPullPipe = function (test) {
  async.series([
    _.bind(Q.push, Q, 'darth'),
    _.bind(Q.push, Q, 'vader'),
    _.bind(Q.push, Q, 'mothe-vada'),
    _.bind(Q.pullpipe, Q, Q2, 'vader'),
    checkByList(test, Q, ['mothe-vada', 'darth']),
    checkByList(test, Q2, ['vader'])
  ], test.done);
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