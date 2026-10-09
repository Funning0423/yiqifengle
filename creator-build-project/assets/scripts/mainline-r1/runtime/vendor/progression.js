function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, e) { if ("object" != _typeof(t) || !t) return t; var r; if ("undefined" != typeof Symbol && void 0 !== (r = t[Symbol.toPrimitive])) { var i = r.call(t, e || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === e ? String : Number)(t); }
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
(function (root, factory) {
  if ((typeof module === "undefined" ? "undefined" : _typeof(module)) === 'object' && module.exports) module.exports = factory();else root.ForestProgression = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var KEY = 'forest-v33-journey',
    PROGRESS = 'forest-v3-progress',
    COMPLETED = 'forest-v3-completed',
    COUNT = 12,
    ATTEMPT_LIMIT = 128,
    ERROR_LIMIT = 24;
  var integer = function integer(value, max) {
    var fallback = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
    if (typeof value !== 'number' && typeof value !== 'string' || value === '') return fallback;
    var n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.min(max, Math.floor(n)) : fallback;
  };
  var metric = function metric(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
  };
  var empty = function empty() {
    return {
      bestStars: 0,
      bestScore: null,
      bestMoves: null,
      clears: 0
    };
  };
  var clone = function clone(value) {
    return JSON.parse(JSON.stringify(value));
  };
  var LEGACY_TOOLS = ['windBell', 'tideBottle'],
    REGION_TOOLS = ['tideNet', 'sunSeed', 'starShears'],
    TOOLS = LEGACY_TOOLS.concat(REGION_TOOLS);
  var validRegion = function validRegion(i) {
    return Number.isInteger(i) && i >= 0 && i < 3;
  };
  var REWARDS = [[{
    kind: 'charm',
    id: 'seaRibbon',
    count: 1
  }], [{
    kind: 'tool',
    id: 'windBell',
    count: 1
  }], [{
    kind: 'tool',
    id: 'tideBottle',
    count: 1
  }], [{
    kind: 'charm',
    id: 'paperPlane',
    count: 1
  }], [{
    kind: 'tool',
    id: 'windBell',
    count: 1
  }], [{
    kind: 'tool',
    id: 'tideBottle',
    count: 1
  }], [{
    kind: 'charm',
    id: 'pairedBells',
    count: 1
  }], [{
    kind: 'tool',
    id: 'tideBottle',
    count: 1
  }], [{
    kind: 'tool',
    id: 'windBell',
    count: 1
  }], [{
    kind: 'charm',
    id: 'cloudCrown',
    count: 1
  }], [{
    kind: 'tool',
    id: 'tideBottle',
    count: 1
  }], [{
    kind: 'charm',
    id: 'starBrooch',
    count: 1
  }, {
    kind: 'tool',
    id: 'windBell',
    count: 1
  }]];
  var validLevel = function validLevel(level) {
    return Number.isInteger(level) && level >= 0 && level < COUNT;
  };
  var Progression = /*#__PURE__*/function () {
    function Progression(platform) {
      var _this = this;
      _classCallCheck(this, Progression);
      this.platform = platform || {};
      this.persistenceErrors = [];
      this._readOnly = false;
      var read = function read(key) {
        try {
          var value = _this.platform.load ? _this.platform.load(key) : null;
          if (value === null || value === undefined || value === '') return {
            missing: true,
            value: null
          };
          if (typeof value === 'string') {
            try {
              value = JSON.parse(value);
            } catch (error) {
              if (key === KEY) throw error;
            }
          }
          return {
            missing: false,
            value: value
          };
        } catch (error) {
          _this._recordError({
            operation: 'load',
            key: key,
            message: String(error)
          });
          return {
            failed: true,
            value: null
          };
        }
      };
      var authoritative = read(KEY),
        loaded = authoritative.value;
      var object = function object(value) {
        return value !== null && _typeof(value) === 'object' && !Array.isArray(value);
      };
      var bounded = function bounded(value, max) {
        return Number.isSafeInteger(value) && value >= 0 && value <= max;
      };
      var validRecord = function validRecord(r) {
        return object(r) && bounded(r.bestStars, 3) && bounded(r.clears, Number.MAX_SAFE_INTEGER) && (r.bestScore === null || metric(r.bestScore) !== null) && (r.bestMoves === null || metric(r.bestMoves) !== null);
      };
      var valid = object(loaded) && (loaded.version === undefined || loaded.version === 1 || loaded.version === 2 || loaded.version === 3);
      if (valid) {
        // Accept historical partial record arrays, but do not replace structurally corrupt save data.
        valid = (!('records' in loaded) || Array.isArray(loaded.records) && loaded.records.length <= COUNT && loaded.records.every(function (r) {
          return r === null || validRecord(r);
        })) && (!('completed' in loaded) || bounded(loaded.completed, COUNT)) && (!('unlocked' in loaded) || bounded(loaded.unlocked, COUNT - 1)) && ('records' in loaded || 'completed' in loaded || 'unlocked' in loaded);
        if (loaded.version >= 2) valid = valid && Array.isArray(loaded.records) && loaded.records.length === COUNT && loaded.records.every(validRecord) && Array.isArray(loaded.openedChests) && loaded.openedChests.every(validLevel) && (!('toolsSpent' in loaded) || object(loaded.toolsSpent) && (loaded.version === 3 ? TOOLS : LEGACY_TOOLS).every(function (id) {
          return bounded(loaded.toolsSpent[id], Number.MAX_SAFE_INTEGER);
        }));
        if (loaded.version !== 2 && loaded.version !== 3 && ('openedChests' in loaded || 'toolsSpent' in loaded)) valid = false;
        if (loaded.version === 3) valid = valid && Array.isArray(loaded.regionClaims) && loaded.regionClaims.length === 3 && loaded.regionClaims.every(function (x) {
          return typeof x === 'boolean';
        });
      }
      if (authoritative.failed || !authoritative.missing && !valid) {
        this._readOnly = true;
        if (!authoritative.failed) this._recordError({
          operation: 'load',
          key: KEY,
          message: 'Unsupported or corrupt journey data; original save was preserved.'
        });
      }
      var data = object(loaded) ? loaded : {};
      this.records = Array.from({
        length: COUNT
      }, function (_, i) {
        var r = Array.isArray(data.records) && data.records[i];
        if (!r || _typeof(r) !== 'object') return empty();
        var stars = integer(r.bestStars, 3),
          clears = integer(r.clears, Number.MAX_SAFE_INTEGER);
        return stars || clears ? {
          bestStars: Math.max(1, stars),
          bestScore: metric(r.bestScore),
          bestMoves: metric(r.bestMoves),
          clears: Math.max(1, clears)
        } : empty();
      });
      // Unlocking level N proves that earlier stages were cleared, but says nothing about performance.
      var legacyProgress = read(PROGRESS),
        legacyCompletion = read(COMPLETED);
      if (authoritative.missing && (legacyProgress.failed || legacyCompletion.failed)) this._readOnly = true;
      var legacyUnlocked = integer(legacyProgress.value, 11),
        legacyCompleted = integer(legacyCompletion.value, 12);
      var knownCompleted = Math.max(legacyUnlocked, legacyCompleted, integer(data.completed, 12), integer(data.unlocked, 11), this.records.reduce(function (last, r, i) {
        return r.bestStars ? i + 1 : last;
      }, 0));
      for (var i = 0; i < knownCompleted; i++) if (!this.records[i].bestStars) this.records[i] = {
        bestStars: 1,
        bestScore: null,
        bestMoves: null,
        clears: 1
      };
      this._mementos = new Set(Array.isArray(data.mementos) ? data.mementos.filter(function (id) {
        return Number.isInteger(id) && id >= 0 && id < 3;
      }) : []);
      this._attempts = new Map();
      if (Array.isArray(data.attempts)) {
        var _iterator = _createForOfIteratorHelper(data.attempts.slice(-ATTEMPT_LIMIT)),
          _step;
        try {
          for (_iterator.s(); !(_step = _iterator.n()).done;) {
            var entry = _step.value;
            if (entry && typeof entry.id === 'string' && Number.isInteger(entry.level) && entry.level >= 0 && entry.level < 12 && entry.result && _typeof(entry.result) === 'object') this._attempts.set(entry.id, {
              level: entry.level,
              result: entry.result
            });
          }
        } catch (err) {
          _iterator.e(err);
        } finally {
          _iterator.f();
        }
      }
      this._refresh();
      this._award();
      // Old saves prove clears, never claims. Version 2 claims are restricted to earned chests.
      this._opened = new Set(data.version >= 2 && Array.isArray(data.openedChests) ? data.openedChests.filter(function (level) {
        return validLevel(level) && _this.records[level].bestStars > 0;
      }) : []);
      this._regionClaims = Array.from({
        length: 3
      }, function (_, i) {
        var _data$regionClaims;
        return data.version === 3 && ((_data$regionClaims = data.regionClaims) === null || _data$regionClaims === void 0 ? void 0 : _data$regionClaims[i]) === true && _this.records[i * 4].bestStars > 0;
      });
      this._spent = Object.fromEntries(TOOLS.map(function (id) {
        return [id, 0];
      }));
      var grants = this._grants();
      var _iterator2 = _createForOfIteratorHelper(TOOLS),
        _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var id = _step2.value;
          if (data.version !== 2 && data.version !== 3) continue;
          var spent = data.toolsSpent && data.toolsSpent[id];
          if (Number.isSafeInteger(spent) && spent >= 0) this._spent[id] = Math.min(grants.tools[id], spent);else if (!Object.prototype.hasOwnProperty.call(data, 'toolsSpent')) {
            // Transitional v2 saves may carry balances only; clamp them to proven claims.
            var balance = data.inventory && data.inventory.tools && data.inventory.tools[id];
            this._spent[id] = grants.tools[id] - (Number.isSafeInteger(balance) && balance >= 0 ? Math.min(grants.tools[id], balance) : 0);
          } else this._spent[id] = grants.tools[id]; // Corrupt spend data cannot mint tools.
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
      this._equipped = typeof data.equippedCharm === 'string' && grants.charms.includes(data.equippedCharm) ? data.equippedCharm : null;
      this._save(false);
    }
    return _createClass(Progression, [{
      key: "_refresh",
      value: function _refresh() {
        this.completed = this.records.filter(function (r) {
          return r.bestStars > 0;
        }).length;
        var frontier = 0;
        while (frontier < COUNT && this.records[frontier].bestStars > 0) frontier++;
        this.unlocked = Math.min(11, frontier);
      }
    }, {
      key: "_award",
      value: function _award() {
        var added = [];
        for (var chapter = 0; chapter < 3; chapter++) if (this.completed >= (chapter + 1) * 4 && !this._mementos.has(chapter)) {
          this._mementos.add(chapter);
          added.push(chapter);
        }
        return added;
      }
    }, {
      key: "_recordError",
      value: function _recordError(error) {
        this.persistenceErrors.push(error);
        if (this.persistenceErrors.length > ERROR_LIMIT) this.persistenceErrors.splice(0, this.persistenceErrors.length - ERROR_LIMIT);
      }
    }, {
      key: "_save",
      value: function _save(includeLegacy) {
        if (this._readOnly) return false;
        var entries = [[KEY, this.export()]];
        if (includeLegacy) entries.push([PROGRESS, this.unlocked], [COMPLETED, this.completed]);
        for (var _i = 0, _entries = entries; _i < _entries.length; _i++) {
          var _entries$_i = _slicedToArray(_entries[_i], 2),
            key = _entries$_i[0],
            value = _entries$_i[1];
          try {
            if (typeof this.platform.save !== 'function' || this.platform.save(key, value) === false) throw Error('Save did not succeed');
            if (key === KEY) this._authoritativeFailure = false;
          } catch (error) {
            this._recordError({
              operation: 'save',
              key: key,
              message: String(error)
            });
            if (key === KEY) {
              this._authoritativeFailure = true;
              return false;
            }
          }
        }
        return true;
      }
    }, {
      key: "readOnly",
      get: function get() {
        return this._readOnly;
      }
    }, {
      key: "retryRequired",
      get: function get() {
        return this._readOnly;
      }
    }, {
      key: "storageWarning",
      get: function get() {
        if (this._readOnly) return 'Saved progress could not be read safely. Rewards and saving are paused. Reload to retry; your existing save has been preserved.';
        return this._authoritativeFailure ? 'Progress could not be fully saved. Keep this session open and try again.' : null;
      }
    }, {
      key: "_grants",
      value: function _grants() {
        var inventory = {
          tools: Object.fromEntries(TOOLS.map(function (id) {
            return [id, 0];
          })),
          charms: []
        };
        for (var i = 0; i < 3; i++) {
          var _this$_regionClaims;
          if ((_this$_regionClaims = this._regionClaims) !== null && _this$_regionClaims !== void 0 && _this$_regionClaims[i]) inventory.tools[REGION_TOOLS[i]] = 1;
        }
        var _iterator3 = _createForOfIteratorHelper(_toConsumableArray(this._opened).sort(function (a, b) {
            return a - b;
          })),
          _step3;
        try {
          for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
            var level = _step3.value;
            var _iterator4 = _createForOfIteratorHelper(REWARDS[level]),
              _step4;
            try {
              for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
                var reward = _step4.value;
                if (reward.kind === 'tool') inventory.tools[reward.id] += reward.count;else if (!inventory.charms.includes(reward.id)) inventory.charms.push(reward.id);
              }
            } catch (err) {
              _iterator4.e(err);
            } finally {
              _iterator4.f();
            }
          }
        } catch (err) {
          _iterator3.e(err);
        } finally {
          _iterator3.f();
        }
        return inventory;
      }
    }, {
      key: "inventory",
      get: function get() {
        var inventory = this._grants();
        var _iterator5 = _createForOfIteratorHelper(TOOLS),
          _step5;
        try {
          for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
            var id = _step5.value;
            inventory.tools[id] -= this._spent[id];
          }
        } catch (err) {
          _iterator5.e(err);
        } finally {
          _iterator5.f();
        }
        return inventory;
      }
    }, {
      key: "equippedCharm",
      get: function get() {
        return this._equipped;
      }
    }, {
      key: "chests",
      value: function chests() {
        var _this2 = this;
        return REWARDS.map(function (rewards, level) {
          return {
            level: level,
            earned: _this2.records[level].bestStars > 0,
            opened: _this2._opened.has(level),
            rewards: clone(rewards)
          };
        });
      }
    }, {
      key: "openChest",
      value: function openChest(level) {
        if (!validLevel(level)) throw new RangeError('Level must be an integer from 0 to 11.');
        var duplicate = this._opened.has(level),
          result = {
            level: level,
            rewards: [],
            newlyGrantedRewards: [],
            duplicate: duplicate,
            opened: duplicate
          };
        if (this._readOnly) return _objectSpread(_objectSpread({}, result), {}, {
          persistenceError: true,
          readOnly: true
        });
        if (duplicate || !this.records[level].bestStars) return result;
        this._opened.add(level);
        // Claims and use commit only if the authoritative save succeeds; never show a reward that can be claimed again on reload.
        if (!this._save(false)) {
          this._opened.delete(level);
          return _objectSpread(_objectSpread({}, result), {}, {
            persistenceError: true
          });
        }
        return _objectSpread(_objectSpread({}, result), {}, {
          rewards: clone(REWARDS[level]),
          newlyGrantedRewards: clone(REWARDS[level]),
          opened: true
        });
      }
    }, {
      key: "regionUnlocked",
      value: function regionUnlocked(region) {
        return validRegion(region) && this.records[region * 4].bestStars > 0;
      }
    }, {
      key: "regionClaimed",
      value: function regionClaimed(region) {
        return validRegion(region) && this._regionClaims[region] === true;
      }
    }, {
      key: "claimRegion",
      value: function claimRegion(region) {
        var duplicate = this.regionClaimed(region),
          base = {
            region: region,
            claimed: duplicate,
            duplicate: duplicate,
            newlyGrantedRewards: []
          };
        if (this._readOnly) return _objectSpread(_objectSpread({}, base), {}, {
          claimed: false,
          persistenceError: true,
          readOnly: true
        });
        if (!this.regionUnlocked(region) || duplicate) return base;
        this._regionClaims[region] = true;
        if (!this._save(false)) {
          this._regionClaims[region] = false;
          return _objectSpread(_objectSpread({}, base), {}, {
            persistenceError: true
          });
        }
        return _objectSpread(_objectSpread({}, base), {}, {
          claimed: true,
          newlyGrantedRewards: [{
            kind: 'tool',
            id: REGION_TOOLS[region],
            count: 1
          }]
        });
      }
    }, {
      key: "equipCharm",
      value: function equipCharm(id) {
        if (this._readOnly) return false;
        if (id !== null && !this.inventory.charms.includes(id)) return false;
        var previous = this._equipped;
        this._equipped = id;
        if (!this._save(false)) {
          this._equipped = previous;
          return false;
        }
        return true;
      }
    }, {
      key: "consumeTool",
      value: function consumeTool(id) {
        if (this._readOnly) return false;
        if (!TOOLS.includes(id) || this.inventory.tools[id] < 1) return false;
        this._spent[id]++;
        if (!this._save(false)) {
          this._spent[id]--;
          return false;
        }
        return true;
      }
    }, {
      key: "totalStars",
      value: function totalStars() {
        return this.records.reduce(function (sum, r) {
          return sum + r.bestStars;
        }, 0);
      }
    }, {
      key: "mementos",
      value: function mementos() {
        var _this3 = this;
        return Array.from({
          length: 3
        }, function (_, chapter) {
          return {
            chapter: chapter,
            unlocked: _this3._mementos.has(chapter),
            completedCount: _this3.records.slice(chapter * 4, chapter * 4 + 4).filter(function (r) {
              return r.bestStars > 0;
            }).length,
            total: 4,
            unlockedAt: (chapter + 1) * 4
          };
        });
      }
    }, {
      key: "export",
      value: function _export() {
        return {
          version: 3,
          regionClaims: this._regionClaims.slice(),
          openedChests: _toConsumableArray(this._opened).sort(function (a, b) {
            return a - b;
          }),
          toolsSpent: _objectSpread({}, this._spent),
          inventory: this.inventory,
          equippedCharm: this._equipped,
          unlocked: this.unlocked,
          completed: this.completed,
          records: clone(this.records),
          mementos: _toConsumableArray(this._mementos).sort(),
          attempts: _toConsumableArray(this._attempts).map(function (_ref) {
            var _ref2 = _slicedToArray(_ref, 2),
              id = _ref2[0],
              entry = _ref2[1];
            return {
              id: id,
              level: entry.level,
              result: clone(entry.result)
            };
          })
        };
      }
    }, {
      key: "recordWin",
      value: function recordWin(level, details) {
        if (!Number.isInteger(level) || level < 0 || level >= COUNT) throw new RangeError('Level must be an integer from 0 to 11.');
        if (level > this.unlocked) throw new RangeError('Cannot complete a locked level.');
        if (this._readOnly) return {
          earnedStars: 1,
          previousStars: this.records[level].bestStars,
          improvement: 0,
          newMementos: [],
          totalStars: this.totalStars(),
          duplicate: false,
          chestAwarded: false,
          newChest: null,
          persistenceError: true,
          readOnly: true
        };
        details = details || {};
        var id = typeof details.attemptId === 'string' && details.attemptId.length ? details.attemptId : null;
        if (id && this._attempts.has(id)) {
          var previous = this._attempts.get(id);
          if (previous.level !== level) throw new Error('Attempt ID already belongs to another level.');
          return _objectSpread(_objectSpread({}, clone(previous.result)), {}, {
            newMementos: [],
            chestAwarded: false,
            newChest: null,
            totalStars: this.totalStars(),
            duplicate: true
          });
        }
        if (level > this.unlocked) throw new RangeError('Cannot complete a locked level.');
        var backup = {
          records: clone(this.records),
          mementos: new Set(this._mementos),
          attempts: new Map(this._attempts)
        };
        var r = this.records[level],
          previousStars = r.bestStars,
          previousScore = r.bestScore,
          score = metric(details.score),
          moves = metric(details.movesRemaining),
          total = metric(details.totalMoves);
        // Invalid or impossible move counts never manufacture performance stars.
        var ratio = total !== null && total > 0 && moves !== null && moves <= total ? moves / total : 0;
        var earnedStars = 1 + (ratio >= .25 ? 1 : 0) + (ratio >= .5 ? 1 : 0);
        r.bestStars = Math.max(r.bestStars, earnedStars);
        if (score !== null) r.bestScore = r.bestScore === null ? score : Math.max(r.bestScore, score);
        if (moves !== null && total !== null && moves <= total) r.bestMoves = r.bestMoves === null ? moves : Math.max(r.bestMoves, moves);
        r.clears = Math.min(Number.MAX_SAFE_INTEGER, r.clears + 1);
        this._refresh();
        var result = {
          chestAwarded: previousStars === 0,
          newChest: previousStars === 0 ? level : null,
          earnedStars: earnedStars,
          previousStars: previousStars,
          previousScore: previousScore,
          bestScore: r.bestScore,
          scoreImproved: score !== null && (previousScore === null || score > previousScore),
          improvement: r.bestStars - previousStars,
          newMementos: this._award(),
          totalStars: this.totalStars(),
          duplicate: false
        };
        if (id) this._attempts.set(id, {
          level: level,
          result: clone(result)
        });
        while (this._attempts.size > ATTEMPT_LIMIT) this._attempts.delete(this._attempts.keys().next().value);
        if (!this._save(true)) {
          this.records = backup.records;
          this._mementos = backup.mementos;
          this._attempts = backup.attempts;
          this._refresh();
          return _objectSpread(_objectSpread({}, result), {}, {
            chestAwarded: false,
            newChest: null,
            newMementos: [],
            improvement: 0,
            scoreImproved: false,
            bestScore: previousScore,
            totalStars: this.totalStars(),
            persistenceError: true
          });
        }
        return result;
      }
    }]);
  }();
  Progression.KEY = KEY;
  Progression.REGION_TOOLS = REGION_TOOLS;
  Progression.SAVE_VERSION = 3;
  Progression.ATTEMPT_LIMIT = ATTEMPT_LIMIT;
  Progression.ERROR_LIMIT = ERROR_LIMIT;
  return Progression;
});
