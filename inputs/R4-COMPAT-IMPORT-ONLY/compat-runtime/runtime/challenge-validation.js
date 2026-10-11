/* Content-only validation. No storage, drawing, RNG or gameplay mutation. */
'use strict';

function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, e) { if ("object" != _typeof(t) || !t) return t; var r; if ("undefined" != typeof Symbol && void 0 !== (r = t[Symbol.toPrimitive])) { var i = r.call(t, e || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === e ? String : Number)(t); }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
var REGION_KEYS = ['tide', 'meadow', 'sky'],
  GOAL = /^(type[0-5]|moss|roots|lines|specials|beacons)$/;
var cell = function cell(i) {
    return Number.isInteger(i) && i >= 0 && i < 49;
  },
  positive = function positive(n) {
    return Number.isInteger(n) && n > 0;
  };
function transform(i, mode) {
  var r = Math.floor(i / 7),
    c = i % 7;
  if (mode >= 4) c = 6 - c;
  for (var n = 0; n < mode % 4; n++) {
    var x = r;
    r = c;
    c = 6 - x;
  }
  return r * 7 + c;
}
function structuralFingerprint(stage) {
  var c = stage.config || {},
    goalKinds = Object.keys(c.goals || {}).filter(function (k) {
      return !k.startsWith('type');
    }).sort(),
    typeGoals = Object.keys(c.goals || {}).filter(function (k) {
      return k.startsWith('type');
    }).length;
  var variants = [];
  var _loop = function _loop(mode) {
    var rotate = mode % 2 === 1,
      map = function map(i) {
        return transform(i, mode);
      },
      route = (c.beacons || []).map(map),
      typePattern = [],
      seen = new Map();
    var _iterator = _createForOfIteratorHelper(c.beaconTypes || []),
      _step;
    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var t = _step.value;
        if (!seen.has(t)) seen.set(t, seen.size);
        typePattern.push(seen.get(t));
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
    var starters = (c.starters || []).map(function (s) {
      return [map(s.index), rotate ? s.special === 'row' ? 'column' : s.special === 'column' ? 'row' : s.special : s.special];
    }).sort(function (a, b) {
      return a[0] - b[0] || a[1].localeCompare(b[1]);
    });
    variants.push(JSON.stringify({
      moss: (c.moss || []).map(map).sort(function (a, b) {
        return a - b;
      }),
      roots: (c.roots || []).map(function (x) {
        return [map(x.index), x.layers];
      }).sort(function (a, b) {
        return a[0] - b[0];
      }),
      route: route,
      typePattern: typePattern,
      typeGoalMembership: (c.beaconTypes || []).map(function (t) {
        return Object.prototype.hasOwnProperty.call(c.goals || {}, 'type' + t);
      }),
      starters: starters,
      goalKinds: goalKinds,
      typeGoals: typeGoals
    }));
  };
  for (var mode = 0; mode < 8; mode++) {
    _loop(mode);
  }
  return variants.sort()[0];
}
function validateStage(stage) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
    themes = _ref.themes,
    _ref$packId = _ref.packId,
    packId = _ref$packId === void 0 ? 'c01' : _ref$packId,
    _ref$perRegion = _ref.perRegion,
    perRegion = _ref$perRegion === void 0 ? 12 : _ref$perRegion;
  var errors = [];
  var fail = function fail(code, detail) {
    return errors.push({
      code: code,
      detail: detail
    });
  };
  if (!stage || _typeof(stage) !== 'object') return [{
    code: 'stage-object'
  }];
  var region = REGION_KEYS.indexOf(stage.region),
    expected = typeof stage.region === 'string' && typeof packId === 'string' && Number.isInteger(stage.ordinal) ? stage.region + '-' + packId + '-' + String(stage.ordinal).padStart(3, '0') : null;
  if (region < 0) fail('region', 'Must reuse tide/meadow/sky.');
  if (!Number.isInteger(stage.ordinal) || stage.ordinal < 1 || stage.ordinal > perRegion) fail('ordinal', 'Ordinal must fit this pack region size.');
  if (stage.id !== expected) fail('stable-id', expected);
  if (!['core', 'variant'].includes(stage.kind)) fail('kind');
  if (typeof stage.coreId !== 'string' || !stage.coreId) fail('core-id');
  if (!['warmup', 'strategy', 'challenge', 'breather'].includes(stage.difficultyIntent)) fail('difficulty-intent');
  if (typeof stage.designIntent !== 'string' || stage.designIntent.length < 8) fail('design-intent');
  if (typeof stage.choiceTradeoff !== 'string' || stage.choiceTradeoff.length < 8) fail('choice-tradeoff');
  if (themes && (typeof stage.theme !== 'string' || !Object.prototype.hasOwnProperty.call(themes, stage.theme))) fail('theme', 'Must use an existing theme.');
  var c = stage.config;
  if (!c || _typeof(c) !== 'object') return errors.concat({
    code: 'config'
  });
  if (!Number.isInteger(c.moves) || c.moves < 8 || c.moves > 50) fail('moves', 'Candidate budget must be 8..50, not unlimited padding.');
  var goals = c.goals;
  if (!goals || _typeof(goals) !== 'object' || Array.isArray(goals) || !Object.keys(goals).length) fail('goals');else {
    if (Object.keys(goals).length > 5) fail('hud-goals', 'Existing board HUD supports at most five targets.');
    for (var _i = 0, _Object$entries = Object.entries(goals); _i < _Object$entries.length; _i++) {
      var _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
        k = _Object$entries$_i[0],
        v = _Object$entries$_i[1];
      if (!GOAL.test(k) || !positive(v)) fail('goal-value', k);
    }
  }
  var moss = Array.isArray(c.moss) ? c.moss : [];
  if (!Array.isArray(c.moss) || !Array.from(c.moss).every(cell) || new Set(c.moss).size !== c.moss.length) fail('moss');
  var roots = Array.isArray(c.roots) ? c.roots : [];
  if (!Array.isArray(c.roots) || !Array.from(c.roots).every(function (x) {
    return x && cell(x.index) && Number.isInteger(x.layers) && x.layers >= 1 && x.layers <= 3;
  }) || new Set((c.roots || []).map(function (x) {
    return x.index;
  })).size !== (c.roots || []).length) fail('roots');
  if (roots.filter(function (x) {
    return x && x.layers === 3;
  }).length > 1) fail('durability-grind', 'At most one deliberate three-layer center in this pack.');
  if (Number.isInteger(goals === null || goals === void 0 ? void 0 : goals.moss) && goals.moss > moss.length) fail('impossible-moss');
  if (Number.isInteger(goals === null || goals === void 0 ? void 0 : goals.roots) && goals.roots > roots.length) fail('impossible-roots');
  var route = Array.isArray(c.beacons) ? c.beacons : [];
  if (c.beacons !== undefined && !Array.isArray(c.beacons) || !Array.from(route).every(cell)) fail('route');
  if (((goals === null || goals === void 0 ? void 0 : goals.beacons) || 0) !== route.length) fail('route-goal');
  if (route.length > 5) fail('route-length');
  if (c.beaconTypes !== undefined && (!Array.isArray(c.beaconTypes) || !route.length || c.beaconTypes.length !== route.length || !Array.from(c.beaconTypes).every(function (t) {
    return Number.isInteger(t) && t >= 0 && t < 6;
  }))) fail('typed-route');
  if (c.starters !== undefined && (!Array.isArray(c.starters) || c.starters.length > 4 || !Array.from(c.starters).every(function (s) {
    return s && cell(s.index) && ['row', 'column', 'bomb', 'color'].includes(s.special);
  }) || new Set(c.starters.map(function (s) {
    return s.index;
  })).size !== c.starters.length)) fail('starters');
  if (Number.isInteger(goals === null || goals === void 0 ? void 0 : goals.lines) && goals.lines > 6 || Number.isInteger(goals === null || goals === void 0 ? void 0 : goals.specials) && goals.specials > 6) fail('creation-grind');
  return errors;
}
function validateCatalog(stages) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  if (!Array.isArray(stages)) return {
    valid: false,
    stageCount: 0,
    counts: {
      tide: 0,
      meadow: 0,
      sky: 0
    },
    coreCounts: {
      tide: 0,
      meadow: 0,
      sky: 0
    },
    uniqueStructures: 0,
    errors: [{
      code: 'catalog-array'
    }]
  };
  var errors = [],
    ids = new Set(),
    fingerprints = new Map(),
    counts = {
      tide: 0,
      meadow: 0,
      sky: 0
    },
    coreCounts = {
      tide: 0,
      meadow: 0,
      sky: 0
    };
  var _iterator2 = _createForOfIteratorHelper(stages || []),
    _step2;
  try {
    for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
      var stage = _step2.value;
      if (!stage || _typeof(stage) !== 'object') {
        errors.push({
          code: 'stage-object'
        });
        continue;
      }
      var local = validateStage(stage, options);
      var _iterator6 = _createForOfIteratorHelper(local),
        _step6;
      try {
        for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
          var e = _step6.value;
          errors.push(_objectSpread({
            id: stage === null || stage === void 0 ? void 0 : stage.id
          }, e));
        }
      } catch (err) {
        _iterator6.e(err);
      } finally {
        _iterator6.f();
      }
      if (ids.has(stage.id)) errors.push({
        id: stage.id,
        code: 'duplicate-id'
      });
      ids.add(stage.id);
      if (typeof stage.region === 'string' && stage.region in counts) {
        counts[stage.region]++;
        if (stage.kind === 'core') coreCounts[stage.region]++;
      }
      if (!local.length) {
        var fp = structuralFingerprint(stage);
        if (fingerprints.has(fp)) errors.push({
          id: stage.id,
          code: 'structural-duplicate',
          of: fingerprints.get(fp),
          detail: 'Equivalent after rotation/mirror; ignores move count, target quantities and color relabeling.'
        });else fingerprints.set(fp, stage.id);
      }
    }
  } catch (err) {
    _iterator2.e(err);
  } finally {
    _iterator2.f();
  }
  var _iterator3 = _createForOfIteratorHelper(stages),
    _step3;
  try {
    var _loop3 = function _loop3() {
      var stage = _step3.value;
      if (!stage) return 1; // continue
      var core = stages.find(function (s) {
        return s && s.id === stage.coreId;
      });
      if (!core || core.kind !== 'core' || core.region !== stage.region) errors.push({
        id: stage.id,
        code: 'missing-core',
        coreId: stage.coreId
      });
      if (stage.kind === 'core' && stage.coreId !== stage.id) errors.push({
        id: stage.id,
        code: 'core-self-reference'
      });
    };
    for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
      if (_loop3()) continue;
    }
  } catch (err) {
    _iterator3.e(err);
  } finally {
    _iterator3.f();
  }
  if (options.requireFirstBatch !== false) {
    var _iterator4 = _createForOfIteratorHelper(stages.filter(function (s) {
        return s && s.kind === 'core';
      })),
      _step4;
    try {
      var _loop2 = function _loop2() {
        var core = _step4.value;
        var count = stages.filter(function (s) {
          return s && s.kind === 'variant' && s.coreId === core.id;
        }).length;
        if (count !== (options.variantsPerCore || 3)) errors.push({
          id: core.id,
          code: 'variant-count',
          actual: count,
          expected: options.variantsPerCore || 3
        });
      };
      for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
        _loop2();
      }
    } catch (err) {
      _iterator4.e(err);
    } finally {
      _iterator4.f();
    }
  }
  if (options.requireFirstBatch !== false) {
    var _iterator5 = _createForOfIteratorHelper(REGION_KEYS),
      _step5;
    try {
      for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
        var region = _step5.value;
        if (counts[region] !== (options.perRegion || 12)) errors.push({
          region: region,
          code: 'region-count',
          actual: counts[region],
          expected: options.perRegion || 12
        });
        if (coreCounts[region] !== (options.corePerRegion || 3)) errors.push({
          region: region,
          code: 'core-count',
          actual: coreCounts[region],
          expected: options.corePerRegion || 3
        });
      }
    } catch (err) {
      _iterator5.e(err);
    } finally {
      _iterator5.f();
    }
  }
  return {
    valid: !errors.length,
    stageCount: (stages || []).length,
    counts: counts,
    coreCounts: coreCounts,
    uniqueStructures: fingerprints.size,
    errors: errors
  };
}
module.exports = {
  REGION_KEYS: REGION_KEYS,
  validateStage: validateStage,
  validateCatalog: validateCatalog,
  structuralFingerprint: structuralFingerprint
};
