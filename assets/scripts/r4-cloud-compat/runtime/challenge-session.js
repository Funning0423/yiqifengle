/* Headless, replayable challenge session. UI integration is a separate acceptance step. */
'use strict';

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, e) { if ("object" != _typeof(t) || !t) return t; var r; if ("undefined" != typeof Symbol && void 0 !== (r = t[Symbol.toPrimitive])) { var i = r.call(t, e || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === e ? String : Number)(t); }
var Engine = require('./engine');
function seededRandom(seed) {
  var value = seed >>> 0;
  return function () {
    value = Math.imul(value, 1664525) + 1013904223 >>> 0;
    return value / 4294967296;
  };
}
function stateOf(e) {
  return JSON.stringify({
    board: e.board,
    moves: e.moves,
    bombs: e.bombs,
    score: e.score,
    goals: e.goals,
    moss: Array.from(e.moss),
    roots: Array.from(e.roots),
    cursor: e.beaconCursor,
    status: e.status
  });
}
var ChallengeSession = /*#__PURE__*/function () {
  function ChallengeSession(progress, id) {
    var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
      seed = _ref.seed,
      attemptId = _ref.attemptId;
    _classCallCheck(this, ChallengeSession);
    this.progress = progress;
    this.stage = progress.catalog.get(id);
    if (!progress.isUnlocked(id)) throw Error('Challenge is locked or unavailable');
    this.seed = seed === undefined ? this.stage.seedBank[0] : seed;
    if (!this.stage.seedBank.includes(this.seed)) throw Error('Use a verified seed from this challenge');
    this.attemptId = attemptId || id + ':' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2);
    if (typeof this.attemptId !== 'string' || !this.attemptId || this.attemptId.length > 160) throw Error('Invalid attempt ID');
    this.engine = new Engine(['tide', 'meadow', 'sky'].indexOf(this.stage.region) * 4, seededRandom(this.seed), this.stage.config);
    this.engine.bombs = 0;
    this.actions = [];
    this.error = null;
  }
  return _createClass(ChallengeSession, [{
    key: "act",
    value: function act(action) {
      var e = this.engine;
      if (this.error || !action || e.status !== 'playing' || !e._canStart()) return false;
      var a = Array.isArray(action) ? action : null;
      if (!a) return false;
      var accepted = false;
      if (a[0] === 'swap' && a.length === 3) accepted = e.swap(a[1], a[2]);else if (a[0] === 'activate' && a.length === 2) accepted = e.activate(a[1]);else if (a[0] === 'bomb' && a.length === 2) accepted = e.bomb(a[1]);
      if (!accepted) return false;
      try {
        for (var n = 0; n < Engine.MAX_CASCADES; n++) {
          var wave = e.nextWave();
          if (!wave.indexes.size) break;
          if (!e.clearWave(wave)) throw Error('Challenge wave rejected');
          e.fall();
          if (n === Engine.MAX_CASCADES - 1) e.shuffle();
        }
        e.settleDone();
        this.actions.push(a.slice());
        return true;
      } catch (error) {
        this.error = String(error.message || error);
        return false;
      }
    }
  }, {
    key: "finish",
    value: function finish() {
      if (this.error || this.engine.status !== 'won') return {
        saved: false,
        reason: this.error ? 'run-error' : 'not-won'
      };
      return this.progress.recordWin(this.stage.id, {
        attemptId: this.attemptId,
        seed: this.seed,
        score: this.engine.score,
        movesRemaining: this.engine.moves,
        totalMoves: this.stage.config.moves
      });
    }
  }, {
    key: "checkpoint",
    value: function checkpoint() {
      var e = this.engine;
      if (this.error || e._turnActive || e._pendingPlan || e.board.some(function (t) {
        return !t;
      }) || e.matches().size) throw Error('Checkpoint only at a settled boundary');
      return {
        version: 1,
        stageId: this.stage.id,
        contentRevision: this.stage.contentRevision,
        seed: this.seed,
        attemptId: this.attemptId,
        actions: this.actions.map(function (x) {
          return x.slice();
        }),
        expectedState: stateOf(e)
      };
    }
  }], [{
    key: "restore",
    value: function restore(progress, data) {
      if (!data || data.version !== 1 || !Array.isArray(data.actions) || typeof data.expectedState !== 'string' || data.expectedState.length > 100000 || typeof data.attemptId !== 'string' || !data.attemptId || !Number.isInteger(data.seed) || data.seed < 0 || data.seed > 0xffffffff) throw Error('Invalid challenge checkpoint');
      var stage = progress.catalog.get(data.stageId);
      if (!stage || data.contentRevision !== stage.contentRevision || data.actions.length > stage.config.moves + 2) throw Error('Checkpoint is not compatible with this stage');
      var run = new ChallengeSession(progress, data.stageId, {
        seed: data.seed,
        attemptId: data.attemptId
      });
      var _iterator = _createForOfIteratorHelper(data.actions),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var action = _step.value;
          if (!run.act(action)) throw Error('Invalid checkpoint action');
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
      if (stateOf(run.engine) !== data.expectedState) throw Error('Checkpoint state failed deterministic replay');
      return run;
    }
  }]);
}();
ChallengeSession.seededRandom = seededRandom;
ChallengeSession.stateOf = stateOf;
module.exports = ChallengeSession;
