/* Independent challenge journal. Never reads/writes legacy journey keys or inventory. */
'use strict';

function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, e) { if ("object" != _typeof(t) || !t) return t; var r; if ("undefined" != typeof Symbol && void 0 !== (r = t[Symbol.toPrimitive])) { var i = r.call(t, e || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === e ? String : Number)(t); }
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
var KEY = 'forest-challenges-c01',
  VERSION = 1,
  ATTEMPT_LIMIT = 192;
var clone = function clone(x) {
    return JSON.parse(JSON.stringify(x));
  },
  plain = function plain(x) {
    return x !== null && _typeof(x) === 'object' && !Array.isArray(x);
  },
  metric = function metric(x) {
    return Number.isSafeInteger(x) && x >= 0;
  };
var ChallengeProgress = /*#__PURE__*/function () {
  function ChallengeProgress(platform, journey, catalog) {
    _classCallCheck(this, ChallengeProgress);
    this.p = platform || {};
    this.journey = journey;
    this.catalog = catalog;
    this.key = ChallengeProgress.keyForPack(catalog.packId);
    this.records = {};
    this.claimedRegions = [];
    this.attempts = [];
    this.readOnly = false;
    this.lastError = null;
    try {
      var _this$p$load, _this$p;
      var d = (_this$p$load = (_this$p = this.p).load) === null || _this$p$load === void 0 ? void 0 : _this$p$load.call(_this$p, this.key);
      if (d == null || d === '') return;
      if (typeof d === 'string') d = JSON.parse(d);
      if (!plain(d) || d.version !== VERSION || d.packId !== catalog.packId || !plain(d.records) || !Array.isArray(d.claimedRegions) || !Array.isArray(d.attempts) || d.attempts.length > ATTEMPT_LIMIT) throw Error('Unsupported challenge journal');
      for (var _i = 0, _Object$entries = Object.entries(d.records); _i < _Object$entries.length; _i++) {
        var _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
          id = _Object$entries$_i[0],
          x = _Object$entries$_i[1];
        var stage = catalog.get(id);
        if (!stage || !plain(x) || !Number.isInteger(x.bestStars) || x.bestStars < 1 || x.bestStars > 3 || !metric(x.bestScore) || !metric(x.bestMoves) || x.bestMoves > stage.config.moves || !metric(x.clears) || x.clears < 1 || x.contentRevision !== stage.contentRevision) throw Error('Invalid challenge record');
      }
      if (new Set(d.claimedRegions).size !== d.claimedRegions.length || !d.claimedRegions.every(function (k) {
        return ['tide', 'meadow', 'sky'].includes(k) && catalog.stages.filter(function (s) {
          return s.region === k;
        }).every(function (s) {
          var _d$records$s$id;
          return ((_d$records$s$id = d.records[s.id]) === null || _d$records$s$id === void 0 ? void 0 : _d$records$s$id.bestStars) > 0;
        });
      })) throw Error('Unproven challenge memento');
      var _iterator = _createForOfIteratorHelper(d.attempts),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var a = _step.value;
          if (!plain(a) || typeof a.id !== 'string' || !a.id || a.id.length > 160 || !catalog.get(a.stageId) || !plain(a.result) || !d.records[a.stageId] || a.result.saved !== true || a.result.stageId !== a.stageId || typeof a.result.firstClear !== 'boolean' || a.result.duplicate !== false || !Number.isInteger(a.result.stars) || a.result.stars < 1 || a.result.stars > 3 || !Number.isInteger(a.result.bestStars) || a.result.bestStars < 1 || a.result.bestStars > 3 || !metric(a.result.bestScore)) throw Error('Invalid challenge attempt');
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
      if (new Set(d.attempts.map(function (a) {
        return a.id;
      })).size !== d.attempts.length) throw Error('Duplicate challenge attempt');
      this.records = clone(d.records);
      this.claimedRegions = d.claimedRegions.slice();
      this.attempts = clone(d.attempts);
    } catch (error) {
      this.readOnly = true;
      this.lastError = String(error.message || error);
    }
  }
  return _createClass(ChallengeProgress, [{
    key: "blocked",
    get: function get() {
      return this.readOnly || !this.journey || this.journey.readOnly;
    }
  }, {
    key: "export",
    value: function _export() {
      return {
        version: VERSION,
        packId: this.catalog.packId,
        records: clone(this.records),
        claimedRegions: this.claimedRegions.slice(),
        attempts: clone(this.attempts)
      };
    }
  }, {
    key: "_save",
    value: function _save() {
      try {
        if (this.blocked || typeof this.p.save !== 'function' || this.p.save(this.key, this.export()) === false) throw Error('Challenge save did not succeed');
        this.lastError = null;
        return true;
      } catch (error) {
        this.lastError = String(error.message || error);
        return false;
      }
    }
  }, {
    key: "isUnlocked",
    value: function isUnlocked(id) {
      var _stage$seedBank, _this$journey$records, _this$records$previou;
      var stage = this.catalog.get(id);
      if (!stage || !stage.qualified || !((_stage$seedBank = stage.seedBank) !== null && _stage$seedBank !== void 0 && _stage$seedBank.length) || this.blocked) return false;
      var region = ['tide', 'meadow', 'sky'].indexOf(stage.region);
      if (!((_this$journey$records = this.journey.records) !== null && _this$journey$records !== void 0 && (_this$journey$records = _this$journey$records[region * 4 + 3]) !== null && _this$journey$records !== void 0 && _this$journey$records.bestStars)) return false;
      if (stage.ordinal === 1) return true;
      var previous = this.catalog.stages.find(function (s) {
        return s.region === stage.region && s.ordinal === stage.ordinal - 1;
      });
      return !!previous && !!((_this$records$previou = this.records[previous.id]) !== null && _this$records$previou !== void 0 && _this$records$previou.bestStars);
    }
  }, {
    key: "recordWin",
    value: function recordWin(id, details) {
      var stage = this.catalog.get(id),
        base = {
          saved: false,
          firstClear: false,
          duplicate: false
        };
      if (!stage) return _objectSpread(_objectSpread({}, base), {}, {
        reason: 'unknown-stage'
      });
      if (this.blocked) return _objectSpread(_objectSpread({}, base), {}, {
        readOnly: true
      });
      var attemptId = details === null || details === void 0 ? void 0 : details.attemptId;
      if (typeof attemptId !== 'string' || !attemptId || attemptId.length > 160) return _objectSpread(_objectSpread({}, base), {}, {
        reason: 'attempt-id-required'
      });
      var oldAttempt = this.attempts.find(function (a) {
        return a.id === attemptId;
      });
      if (oldAttempt) {
        if (oldAttempt.stageId !== id) return _objectSpread(_objectSpread({}, base), {}, {
          reason: 'attempt-id-conflict'
        });
        return _objectSpread(_objectSpread({}, clone(oldAttempt.result)), {}, {
          saved: true,
          firstClear: false,
          duplicate: true
        });
      }
      if (!this.isUnlocked(id)) return _objectSpread(_objectSpread({}, base), {}, {
        reason: 'locked'
      });
      if (!metric(details.score) || !metric(details.movesRemaining) || details.totalMoves !== stage.config.moves || details.movesRemaining > details.totalMoves || !stage.seedBank.includes(details.seed)) return _objectSpread(_objectSpread({}, base), {}, {
        reason: 'invalid-result'
      });
      var before = this.export(),
        previous = this.records[id],
        ratio = details.movesRemaining / details.totalMoves,
        stars = 1 + (ratio >= .25 ? 1 : 0) + (ratio >= .5 ? 1 : 0);
      this.records[id] = {
        contentRevision: stage.contentRevision,
        bestStars: Math.max((previous === null || previous === void 0 ? void 0 : previous.bestStars) || 0, stars),
        bestScore: Math.max((previous === null || previous === void 0 ? void 0 : previous.bestScore) || 0, details.score),
        bestMoves: Math.max((previous === null || previous === void 0 ? void 0 : previous.bestMoves) || 0, details.movesRemaining),
        clears: Math.min(Number.MAX_SAFE_INTEGER, ((previous === null || previous === void 0 ? void 0 : previous.clears) || 0) + 1)
      };
      var result = {
        saved: true,
        firstClear: !previous,
        duplicate: false,
        stageId: id,
        stars: stars,
        bestStars: this.records[id].bestStars,
        bestScore: this.records[id].bestScore
      };
      this.attempts.push({
        id: attemptId,
        stageId: id,
        result: clone(result)
      });
      if (this.attempts.length > ATTEMPT_LIMIT) this.attempts.splice(0, this.attempts.length - ATTEMPT_LIMIT);
      if (!this._save()) {
        this.records = before.records;
        this.claimedRegions = before.claimedRegions;
        this.attempts = before.attempts;
        return _objectSpread(_objectSpread({}, base), {}, {
          persistenceError: true
        });
      }
      return result;
    }
  }, {
    key: "claimRegionMemento",
    value: function claimRegionMemento(region) {
      var _this = this;
      var duplicate = this.claimedRegions.includes(region),
        base = {
          claimed: duplicate,
          duplicate: duplicate,
          newlyGranted: []
        };
      if (this.blocked) return _objectSpread(_objectSpread({}, base), {}, {
        claimed: false,
        readOnly: true
      });
      if (duplicate) return base;
      var stages = this.catalog.stages.filter(function (s) {
        return s.region === region;
      });
      if (stages.length !== (this.catalog.perRegion || 12) || !stages.every(function (s) {
        var _this$records$s$id;
        return (_this$records$s$id = _this.records[s.id]) === null || _this$records$s$id === void 0 ? void 0 : _this$records$s$id.bestStars;
      })) return base;
      this.claimedRegions.push(region);
      if (!this._save()) {
        this.claimedRegions.pop();
        return _objectSpread(_objectSpread({}, base), {}, {
          persistenceError: true
        });
      }
      return _objectSpread(_objectSpread({}, base), {}, {
        claimed: true,
        newlyGranted: [{
          kind: 'challenge-memento',
          id: region + '-' + this.catalog.packId + '-complete',
          count: 1
        }]
      });
    }
  }]);
}();
ChallengeProgress.keyForPack = function (packId) {
  if (typeof packId !== 'string' || !/^c[0-9]{2,4}$/.test(packId)) throw Error('Invalid challenge pack ID');
  return 'forest-challenges-' + packId;
};
ChallengeProgress.KEY = KEY;
ChallengeProgress.VERSION = VERSION;
ChallengeProgress.ATTEMPT_LIMIT = ATTEMPT_LIMIT;
module.exports = ChallengeProgress;
