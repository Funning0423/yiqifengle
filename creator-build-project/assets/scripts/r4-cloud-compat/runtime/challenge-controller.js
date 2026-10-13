/* Portable R4 orchestration. No renderer, platform SDK, clock, or rule reimplementation. */
'use strict';

function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, e) { if ("object" != _typeof(t) || !t) return t; var r; if ("undefined" != typeof Symbol && void 0 !== (r = t[Symbol.toPrimitive])) { var i = r.call(t, e || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === e ? String : Number)(t); }
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
var Engine = require('./engine');
var Session = require('./challenge-session');
var Progress = require('./challenge-progress');
var Catalog = require('./challenge-catalog');
var privateState = new WeakMap();
var instanceSerial = 0;
var REGIONS = ['tide', 'meadow', 'sky'];
var clone = function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
};
var plain = function plain(value) {
  return !!value && _typeof(value) === 'object' && !Array.isArray(value);
};
var promise = function promise(value) {
  return !!value && typeof value.then === 'function';
};
var rejectAsync = function rejectAsync(value) {
  Promise.resolve(value).catch(function () {});
};
var _freeze = function freeze(value) {
  if (value && _typeof(value) === 'object') {
    Object.values(value).forEach(_freeze);
    Object.freeze(value);
  }
  return value;
};
var publicCopy = function publicCopy(value) {
  return _freeze(JSON.parse(JSON.stringify(value, function (key, x) {
    return x instanceof Set ? Array.from(x) : x instanceof Map ? Array.from(x) : x;
  })));
};
var parse = function parse(value) {
  return typeof value === 'string' && value !== '' ? JSON.parse(value) : value;
};
var equivalent = function equivalent(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
};
var actionValid = function actionValid(a) {
  return Array.isArray(a) && (a[0] === 'swap' && a.length === 3 || a[0] === 'activate' && a.length === 2) && a.slice(1).every(function (i) {
    return Number.isInteger(i) && i >= 0 && i < 49;
  });
};
var state = function state(controller) {
  return privateState.get(controller);
};
var ok = function ok(extra) {
  return _objectSpread({
    ok: true
  }, extra);
};
var fail = function fail(reason) {
  return {
    ok: false,
    reason: reason
  };
};
function invalidate(s) {
  s.generation++;
  s.visual = null;
  s.preview = null;
}
function readonly(s, reason) {
  invalidate(s);
  s.readOnly = true;
  s.error = reason;
  s.screen = 'storage.readOnly';
}
function blocked(s) {
  if (s.readOnly || s.progress.blocked) {
    readonly(s, s.error || s.progress.lastError || 'journal-read-only');
    return true;
  }
  return false;
}
function token(s, kind, data) {
  var value = "".concat(s.instance, ":").concat(s.generation, ":").concat(++s.sequence, ":").concat(kind);
  s.visual = _objectSpread({
    kind: kind,
    token: value
  }, data);
  return value;
}
function event(s, kind, data) {
  s.events.push(publicCopy(_objectSpread({
    id: ++s.eventSerial,
    kind: kind
  }, data)));
  if (s.events.length > 32) s.events.shift();
}
function storage(platform, s) {
  var known = new Map();
  function read(key) {
    if (typeof platform.load !== 'function') throw Error('Synchronous storage.load is required');
    var value = platform.load(key);
    if (promise(value)) {
      rejectAsync(value);
      readonly(s, 'asynchronous-storage-not-supported');
      throw Error(s.error);
    }
    return clone(value);
  }
  function confirm(key, before, expected) {
    var after;
    try {
      after = read(key);
    } catch (error) {
      readonly(s, 'uncertain-storage-readback');
      throw error;
    }
    var matches = false;
    try {
      matches = equivalent(parse(after), expected);
    } catch (_) {/* Invalid new bytes are uncertain, never retryable. */}
    if (matches) {
      known.set(key, clone(after));
      return true;
    }
    if (!equivalent(after, before)) readonly(s, 'uncertain-storage-write');
    return false;
  }
  return {
    load: function load(key) {
      var value = read(key);
      known.set(key, clone(value));
      return value;
    },
    save: function save(key, value) {
      if (s.readOnly) throw Error(s.error || 'storage-read-only');
      var current = read(key);
      if (!known.has(key) || !equivalent(current, known.get(key))) {
        readonly(s, 'concurrent-storage-change');
        throw Error(s.error);
      }
      if (typeof platform.save !== 'function') throw Error('Synchronous storage.save is required');
      var result;
      try {
        result = platform.save(key, clone(value));
      } catch (error) {
        // Some stores write before throwing. Recognize only an exact synchronous readback.
        if (confirm(key, current, value)) return true;
        throw error;
      }
      if (promise(result)) {
        rejectAsync(result);
        readonly(s, 'asynchronous-storage-not-supported');
        throw Error(s.error);
      }
      if (confirm(key, current, value)) return true;
      throw Error(result === false ? 'Storage rejected write' : 'Storage readback did not confirm write');
    }
  };
}
function envelope(s, checkpoint) {
  var _s$durable;
  var pendingAction = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
  var receipt = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
  return {
    version: 1,
    packId: s.catalog.packId,
    revision: (((_s$durable = s.durable) === null || _s$durable === void 0 ? void 0 : _s$durable.revision) || 0) + 1,
    checkpoint: clone(checkpoint),
    pendingAction: clone(pendingAction),
    receipt: clone(receipt)
  };
}
function write(s, data, after) {
  try {
    if (blocked(s)) return false;
    if (!Number.isSafeInteger(data.revision) || data.revision >= Number.MAX_SAFE_INTEGER) {
      readonly(s, 'active-journal-revision-exhausted');
      return false;
    }
    s.store.save(s.key, data);
    s.durable = clone(data);
    s.pendingSave = null;
    s.error = null;
    return true;
  } catch (error) {
    if (!s.readOnly) {
      s.error = String(error.message || error);
      s.pendingSave = {
        data: clone(data),
        after: after
      };
      s.screen = 'storage.unsaved';
    }
    return false;
  }
}
function postStable(s) {
  if (s.run.engine.status === 'won') {
    s.screen = 'result.unsaved';
    return _finish(s);
  }
  if (s.run.engine.status === 'lost') {
    s.result = {
      saved: true,
      outcome: 'lost',
      stageId: s.run.stage.id
    };
    s.screen = 'result.saved';
    return true;
  }
  s.screen = s.paused ? 'run.paused' : 'run.ready';
  return true;
}
function resultEvent(s) {
  event(s, 'result-saved', {
    stageId: s.run.stage.id,
    attemptId: s.run.attemptId,
    firstClear: s.result.firstClear,
    duplicate: s.result.duplicate
  });
}
function _finish(s) {
  var _s$durable2;
  if (blocked(s)) return false;
  if (!s.run || s.run.engine.status !== 'won' || s.committed || s.pendingSave) return false;
  if ((_s$durable2 = s.durable) !== null && _s$durable2 !== void 0 && _s$durable2.receipt) {
    s.result = _objectSpread(_objectSpread({}, clone(s.durable.receipt.result)), {}, {
      firstClear: false,
      duplicate: true
    });
    s.screen = 'result.saved';
    return true;
  }
  var result = s.run.finish();
  if (!result.saved) {
    s.result = clone(result);
    s.error = s.progress.lastError || result.reason || 'Result save failed';
    s.screen = s.readOnly || s.progress.blocked ? 'storage.readOnly' : 'result.unsaved';
    return false;
  }
  s.result = _objectSpread(_objectSpread({}, result), {}, {
    outcome: 'won'
  });
  var data = envelope(s, s.run.checkpoint(), null, {
    attemptId: s.run.attemptId,
    result: s.result
  });
  if (!write(s, data, 'result')) return false;
  s.screen = 'result.saved';
  resultEvent(s);
  return true;
}
function settled(s) {
  s.run.engine.settleDone();
  if (s.run.engine._turnActive || s.run.engine._pendingPlan || s.run.engine.matches().size || s.run.engine.board.some(function (x) {
    return !x;
  })) throw Error('Engine did not settle');
  if (s.committed) s.run.actions.push(s.committed.action.slice());
  s.committed = null;
  s.wave = null;
  s.visual = null;
  var data = envelope(s, s.run.checkpoint());
  if (write(s, data, 'stable')) postStable(s);
}
function advance(s) {
  var e = s.run.engine,
    kind = s.visual.kind;
  s.visual = null;
  if (kind === 'clear') {
    if (!e.clearWave(s.wave)) throw Error('Engine rejected committed wave');
    var changes = e.fall();
    s.committed.waves++;
    token(s, 'drop', {
      changes: publicCopy(changes)
    });
    return;
  }
  if (kind === 'drop' && s.committed.waves >= Engine.MAX_CASCADES) {
    e.shuffle();
    settled(s);
    return;
  }
  var wave = e.nextWave();
  if (!wave.indexes.size) {
    settled(s);
    return;
  }
  s.wave = wave;
  token(s, 'clear', {
    wave: publicCopy(wave)
  });
}
function recoverError(s, error) {
  // Preserve the durable intent; reload can replay it. Never guess a partial engine state.
  readonly(s, 'run-recovery-required: ' + String(error.message || error));
}
function settleCommitted(s) {
  if (!s.committed) return true;
  try {
    var count = 0;
    while (s.committed && !s.readOnly) {
      if (++count > Engine.MAX_CASCADES * 2 + 3) throw Error('Cascade guard exceeded');
      advance(s);
    }
    return !s.pendingSave && !s.readOnly;
  } catch (error) {
    recoverError(s, error);
    return false;
  }
}
function validateEnvelope(s, d) {
  if (!plain(d) || d.version !== 1 || d.packId !== s.catalog.packId || !Number.isSafeInteger(d.revision) || d.revision < 1 || d.revision >= Number.MAX_SAFE_INTEGER || !Object.prototype.hasOwnProperty.call(d, 'checkpoint') || !Object.prototype.hasOwnProperty.call(d, 'pendingAction') || !Object.prototype.hasOwnProperty.call(d, 'receipt')) throw Error('Unsupported active challenge journal');
  if (d.checkpoint === null) {
    if (d.pendingAction !== null || d.receipt !== null) throw Error('Invalid empty active journal');
    return;
  }
  if (!plain(d.checkpoint) || d.pendingAction !== null && !actionValid(d.pendingAction)) throw Error('Invalid active checkpoint or action');
  if (d.receipt !== null && (!plain(d.receipt) || d.pendingAction !== null || d.receipt.attemptId !== d.checkpoint.attemptId || !plain(d.receipt.result) || d.receipt.result.saved !== true || d.receipt.result.outcome !== 'won' || d.receipt.result.stageId !== d.checkpoint.stageId || !s.progress.records[d.checkpoint.stageId])) throw Error('Invalid active result receipt');
}
function validateReceipt(s, receipt) {
  var e = s.run.engine,
    r = receipt.result,
    expectedStars = 1 + (e.moves / s.run.stage.config.moves >= .25 ? 1 : 0) + (e.moves / s.run.stage.config.moves >= .5 ? 1 : 0);
  var attempt = s.progress.attempts.find(function (a) {
      return a.id === s.run.attemptId && a.stageId === s.run.stage.id;
    }),
    record = s.progress.records[s.run.stage.id];
  if (e.status !== 'won' || !attempt || typeof r.firstClear !== 'boolean' || typeof r.duplicate !== 'boolean' || r.duplicate && r.firstClear || r.stars !== expectedStars || !Number.isInteger(r.bestStars) || r.bestStars < r.stars || r.bestStars > 3 || !Number.isSafeInteger(r.bestScore) || r.bestScore < e.score || r.bestStars > record.bestStars || r.bestScore > record.bestScore || r.stars !== attempt.result.stars || r.bestStars !== attempt.result.bestStars || r.bestScore !== attempt.result.bestScore) throw Error('Invalid active result receipt metrics');
}
function applyIntent(s, action, plan) {
  var e = s.run.engine;
  try {
    var accepted = action[0] === 'swap' ? e.swap(action[1], action[2]) : e.activate(action[1]);
    if (!accepted) throw Error('Committed intent rejected by engine');
    s.committed = {
      action: action.slice(),
      waves: 0
    };
    s.screen = 'run.resolving';
    token(s, 'action', {
      action: action.slice(),
      tiles: (plan === null || plan === void 0 ? void 0 : plan.tiles) || []
    });
    return ok();
  } catch (error) {
    recoverError(s, error);
    return fail('recovery-required');
  }
}
var ChallengeController = /*#__PURE__*/function () {
  function ChallengeController() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      platform = _ref.platform,
      journey = _ref.journey,
      _ref$catalog = _ref.catalog,
      catalog = _ref$catalog === void 0 ? Catalog : _ref$catalog,
      attemptIdFactory = _ref.attemptIdFactory;
    _classCallCheck(this, ChallengeController);
    var s = {
      catalog: catalog,
      key: Progress.keyForPack(catalog.packId) + '-active',
      instance: ++instanceSerial,
      generation: 0,
      sequence: 0,
      eventSerial: 0,
      events: [],
      screen: 'book.ready',
      region: null,
      selected: null,
      run: null,
      committed: null,
      visual: null,
      preview: null,
      wave: null,
      result: null,
      durable: null,
      pendingSave: null,
      paused: false,
      hidden: false,
      readOnly: false,
      error: null,
      attemptIdFactory: attemptIdFactory
    };
    privateState.set(this, s);
    s.store = storage(platform || {}, s);
    s.progress = new Progress(s.store, journey, catalog);
    if (blocked(s)) return;
    try {
      var raw = s.store.load(s.key);
      if (raw == null || raw === '') return;
      var d = parse(raw);
      validateEnvelope(s, d);
      s.durable = clone(d);
      if (!d.checkpoint) return;
      s.run = Session.restore(s.progress, d.checkpoint);
      s.selected = s.run.stage.id;
      s.region = s.run.stage.region;
      s.paused = true;
      if (d.receipt) validateReceipt(s, d.receipt);
      if (d.pendingAction) {
        if (!s.run.act(d.pendingAction)) throw Error('Invalid committed action replay');
        event(s, 'intent-recovered', {
          stageId: s.selected,
          attemptId: s.run.attemptId
        });
        if (write(s, envelope(s, s.run.checkpoint()), 'stable')) postStable(s);
      } else postStable(s);
    } catch (error) {
      readonly(s, String(error.message || error));
    }
  }
  return _createClass(ChallengeController, [{
    key: "snapshot",
    value: function snapshot() {
      var _s$run;
      var s = state(this),
        e = (_s$run = s.run) === null || _s$run === void 0 ? void 0 : _s$run.engine;
      if (!s.readOnly && s.progress.blocked) blocked(s);
      return publicCopy({
        state: s.screen,
        generation: s.generation,
        region: s.region,
        selectedStageId: s.selected,
        hidden: s.hidden,
        readOnly: s.readOnly,
        error: s.error,
        storageKey: s.key,
        progressKey: s.progress.key,
        result: s.result,
        visual: s.visual,
        events: s.events,
        regions: REGIONS.map(function (region) {
          return {
            id: region,
            mementoClaimed: s.progress.claimedRegions.includes(region),
            completed: s.catalog.stages.filter(function (x) {
              return x.region === region && s.progress.records[x.id];
            }).length
          };
        }),
        stages: s.catalog.stages.filter(function (x) {
          return !s.region || x.region === s.region;
        }).map(function (x) {
          return {
            id: x.id,
            region: x.region,
            ordinal: x.ordinal,
            name: x.config.name,
            unlocked: !s.readOnly && s.progress.isUnlocked(x.id),
            record: s.progress.records[x.id] || null
          };
        }),
        active: s.run ? {
          stageId: s.run.stage.id,
          theme: s.run.stage.theme,
          seed: s.run.seed,
          attemptId: s.run.attemptId,
          contentRevision: s.run.stage.contentRevision,
          actions: s.run.actions,
          moves: e.moves,
          bombs: e.bombs,
          score: e.score,
          goals: e.goals,
          initialGoals: e.initialGoals,
          goalOrder: e.goalOrder,
          board: e.board,
          moss: Array.from(e.moss),
          roots: Array.from(e.roots),
          beaconTarget: e.beaconTarget(),
          beaconRoute: Array.from(e.beaconRoute || []),
          status: e.status
        } : null
      });
    }
  }, {
    key: "selectRegion",
    value: function selectRegion(region) {
      var s = state(this);
      if (blocked(s)) return fail('read-only');
      if (!REGIONS.includes(region)) return fail('unknown-region');
      if (!['book.ready', 'stage.detail'].includes(s.screen)) return fail('exit-run-first');
      invalidate(s);
      s.region = region;
      s.selected = null;
      s.screen = 'book.ready';
      return ok();
    }
  }, {
    key: "selectStage",
    value: function selectStage(id) {
      var s = state(this);
      if (blocked(s)) return fail('read-only');
      if (!['book.ready', 'stage.detail'].includes(s.screen)) return fail('exit-run-first');
      var stage = s.catalog.get(id);
      if (!stage) return fail('unknown-stage');
      invalidate(s);
      s.region = stage.region;
      s.selected = id;
      s.screen = 'stage.detail';
      return ok({
        unlocked: s.progress.isUnlocked(id)
      });
    }
  }, {
    key: "startStage",
    value: function startStage() {
      var _s$durable3;
      var id = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : state(this).selected;
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var s = state(this);
      if (blocked(s)) return fail('read-only');
      if (!['book.ready', 'stage.detail'].includes(s.screen) || s.hidden) return fail('invalid-state');
      if (s.run || (_s$durable3 = s.durable) !== null && _s$durable3 !== void 0 && _s$durable3.checkpoint) return fail('resume-or-discard-active-run');
      var run;
      try {
        var _s$attemptIdFactory;
        run = new Session(s.progress, id, {
          seed: options.seed,
          attemptId: options.attemptId || ((_s$attemptIdFactory = s.attemptIdFactory) === null || _s$attemptIdFactory === void 0 ? void 0 : _s$attemptIdFactory.call(s, id))
        });
      } catch (error) {
        return fail(String(error.message || error));
      }
      if (s.progress.attempts.some(function (a) {
        return a.id === run.attemptId;
      })) return fail('attempt-id-already-used');
      var data = envelope(s, run.checkpoint());
      // A failed start retains the candidate only for exact retry; it never becomes playable.
      s.startCandidate = run;
      if (!write(s, data, 'start')) return fail('save-failed');
      s.startCandidate = null;
      s.run = run;
      s.region = run.stage.region;
      s.selected = id;
      s.paused = false;
      s.hidden = false;
      s.result = null;
      invalidate(s);
      s.screen = 'run.ready';
      return ok();
    }
  }, {
    key: "previewAction",
    value: function previewAction(action) {
      var s = state(this);
      if (blocked(s)) return fail('read-only');
      if (s.screen !== 'run.ready' || !actionValid(action) || s.hidden) return fail('invalid-action-or-state');
      var e = s.run.engine,
        plan = action[0] === 'swap' ? e.planSwap(action[1], action[2]) : e.planActivation(action[1]);
      if (!plan.valid) return fail('illegal-action');
      s.preview = {
        action: action.slice(),
        plan: plan
      };
      s.screen = 'run.preview';
      var value = token(s, 'preview', {
        action: action.slice(),
        plan: publicCopy(plan)
      });
      return ok({
        token: value
      });
    }
  }, {
    key: "cancelPreview",
    value: function cancelPreview(value) {
      var _s$visual;
      var s = state(this);
      if (s.screen !== 'run.preview' || ((_s$visual = s.visual) === null || _s$visual === void 0 ? void 0 : _s$visual.token) !== value) return fail('stale-token');
      invalidate(s);
      s.screen = 'run.ready';
      return ok();
    }
  }, {
    key: "commitAction",
    value: function commitAction(value) {
      var _s$visual2;
      var s = state(this);
      if (blocked(s)) return fail('read-only');
      if (s.screen !== 'run.preview' || ((_s$visual2 = s.visual) === null || _s$visual2 === void 0 ? void 0 : _s$visual2.token) !== value) return fail('stale-token');
      var action = s.preview.action.slice(),
        plan = publicCopy(s.preview.plan),
        data = envelope(s, s.run.checkpoint(), action);
      invalidate(s);
      // Intent is persisted and read back before the first engine mutation.
      if (!write(s, data, 'intent')) return fail('save-failed');
      return applyIntent(s, action, plan);
    }
  }, {
    key: "finishVisualStep",
    value: function finishVisualStep(value) {
      var _s$visual3;
      var s = state(this);
      if (blocked(s)) return fail('read-only');
      if (s.screen !== 'run.resolving' || ((_s$visual3 = s.visual) === null || _s$visual3 === void 0 ? void 0 : _s$visual3.token) !== value) return fail('stale-token');
      try {
        advance(s);
        return s.pendingSave ? fail('save-failed') : ok();
      } catch (error) {
        recoverError(s, error);
        return fail('recovery-required');
      }
    }
  }, {
    key: "pause",
    value: function pause() {
      var _s$run2;
      var s = state(this);
      if (blocked(s)) return fail('read-only');
      s.paused = true;
      if (s.screen === 'run.preview') {
        invalidate(s);
        s.screen = 'run.ready';
      }
      if (!settleCommitted(s)) return fail('save-failed');
      invalidate(s);
      if (s.pendingSave) return fail('save-failed');
      if (((_s$run2 = s.run) === null || _s$run2 === void 0 ? void 0 : _s$run2.engine.status) === 'playing') s.screen = 'run.paused';
      return ok();
    }
  }, {
    key: "onHide",
    value: function onHide() {
      var s = state(this);
      s.hidden = true;
      return this.pause();
    }
  }, {
    key: "onShow",
    value: function onShow() {
      var s = state(this);
      s.hidden = false;
      return s.readOnly ? fail('read-only') : ok();
    }
  }, {
    key: "resume",
    value: function resume() {
      var s = state(this);
      if (blocked(s)) return fail('read-only');
      if (s.screen !== 'run.paused' || !s.run || s.hidden) return fail('invalid-state');
      invalidate(s);
      s.hidden = false;
      s.paused = false;
      s.screen = 'run.ready';
      return ok();
    }
  }, {
    key: "resumeActive",
    value: function resumeActive() {
      var s = state(this);
      if (blocked(s)) return fail('read-only');
      if (!s.run || s.hidden || !['book.ready', 'stage.detail', 'run.paused'].includes(s.screen)) return fail('no-resumable-run');
      s.region = s.run.stage.region;
      s.selected = s.run.stage.id;
      s.hidden = false;
      s.paused = false;
      invalidate(s);
      postStable(s);
      return ok();
    }
  }, {
    key: "requestExit",
    value: function requestExit() {
      var s = state(this);
      // Navigation out of an already confirmed protected reader needs no save.
      // Retain its checkpoint/readonly flag; only a later explicit entry rereads.
      if (s.screen === 'storage.readOnly' && s.readOnly) return ok({
        readOnly: true,
        preserved: true
      });
      if (blocked(s)) return fail('read-only');
      if (!this.pause().ok || s.screen === 'result.unsaved') return fail('save-failed');
      if (s.run && s.run.engine.status !== 'playing') {
        if (!write(s, envelope(s, null), 'exit')) return fail('save-failed');
        s.run = null;
        s.result = null;
      }
      invalidate(s);
      s.screen = 'book.ready';
      s.selected = null;
      return ok({
        resumable: !!s.run
      });
    }
  }, {
    key: "discardActive",
    value: function discardActive() {
      var s = state(this);
      if (blocked(s)) return fail('read-only');
      if (!['book.ready', 'stage.detail', 'run.paused'].includes(s.screen) || s.pendingSave || s.committed) return fail('exit-and-save-first');
      if (!write(s, envelope(s, null), 'discard')) return fail('save-failed');
      invalidate(s);
      s.run = null;
      s.result = null;
      s.screen = 'book.ready';
      s.selected = null;
      return ok();
    }
  }, {
    key: "retrySave",
    value: function retrySave() {
      var s = state(this);
      if (blocked(s)) return fail('read-only');
      if (s.pendingSave) {
        var pending = s.pendingSave;
        if (!write(s, pending.data, pending.after)) return fail('save-failed');
        if (pending.after === 'start') {
          s.run = s.startCandidate;
          s.startCandidate = null;
          s.region = s.run.stage.region;
          s.selected = s.run.stage.id;
          s.paused = s.paused || s.hidden;
          s.result = null;
          invalidate(s);
          s.screen = s.paused ? 'run.paused' : 'run.ready';
        } else if (pending.after === 'intent') {
          var a = pending.data.pendingAction;
          var p = a[0] === 'swap' ? s.run.engine.planSwap(a[1], a[2]) : s.run.engine.planActivation(a[1]);
          applyIntent(s, a, p);
          if (s.paused || s.hidden) settleCommitted(s);
        } else if (pending.after === 'exit' || pending.after === 'discard') {
          invalidate(s);
          s.run = null;
          s.result = null;
          s.selected = null;
          s.screen = 'book.ready';
        } else if (pending.after === 'result') {
          s.screen = 'result.saved';
          resultEvent(s);
        } else postStable(s);
        return s.pendingSave || s.screen === 'result.unsaved' ? fail('save-failed') : ok();
      }
      return _finish(s) ? ok() : fail('nothing-saved');
    }
  }, {
    key: "finish",
    value: function finish() {
      var _s$run3;
      var s = state(this);
      if (blocked(s)) return fail('read-only');
      if (s.screen === 'result.saved' && ((_s$run3 = s.run) === null || _s$run3 === void 0 ? void 0 : _s$run3.engine.status) === 'won') return publicCopy(_objectSpread(_objectSpread({
        ok: true
      }, s.result), {}, {
        firstClear: false,
        duplicate: true
      }));
      if (!_finish(s)) return fail(s.screen === 'result.unsaved' ? 'save-failed' : 'not-won-or-unsettled');
      return publicCopy(_objectSpread({
        ok: true
      }, s.result));
    }
  }, {
    key: "claimMemento",
    value: function claimMemento(region) {
      var _result$newlyGranted;
      var s = state(this);
      if (blocked(s)) return fail('read-only');
      if (s.pendingSave || s.committed || s.screen === 'result.unsaved') return fail('save-run-first');
      var result = s.progress.claimRegionMemento(region);
      // Only the persisted journal owns the memento; there is no inventory mutation here.
      if ((_result$newlyGranted = result.newlyGranted) !== null && _result$newlyGranted !== void 0 && _result$newlyGranted.length) event(s, 'memento-saved', {
        region: region,
        ids: result.newlyGranted.map(function (x) {
          return x.id;
        })
      });
      return publicCopy(_objectSpread({
        ok: !!result.claimed
      }, result));
    }
  }]);
}();
ChallengeController.VERSION = 1;
ChallengeController.keyForPack = function (id) {
  return Progress.keyForPack(id) + '-active';
};
module.exports = ChallengeController;
