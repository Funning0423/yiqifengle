'use strict';

var Progression = require('./vendor/progression'),
  Store = require('./durable-store'),
  Session = require('./mainline-session'),
  copy = Store.clone,
  serial = Store.serial;
var KEYS = [Progression.KEY, 'forest-v3-progress', 'forest-v3-completed'];
function synchronous(value) {
  if (value && typeof value.then === 'function') {
    if (typeof value.catch === 'function') value.catch(function () {});
    throw Error('Asynchronous storage is not supported');
  }
  return value;
}
// Capture reads once. Progression always calls _save(false) in its constructor:
// this isolated staging platform NEVER forwards that call to real storage.
function inspect(platform) {
  var raw = {},
    errors = {},
    writes = {},
    building = true;
  KEYS.forEach(function (key) {
    try {
      raw[key] = copy(synchronous(platform.load(key)));
    } catch (e) {
      errors[key] = String(e.message || e);
    }
  });
  var progression = new Progression({
    load: function load(key) {
      if (errors[key]) throw Error(errors[key]);
      return copy(raw[key]);
    },
    save: function save(key, value) {
      if (!building) writes[key] = copy(value);
      return true;
    }
  });
  building = false;
  return {
    raw: raw,
    progression: progression,
    writes: writes,
    errors: errors
  };
}
function viewOf(state) {
  var p = state.progression;
  return Session.freeze(Object.assign(p.export(), {
    chests: p.chests(),
    regionRewards: [0, 1, 2].map(function (region) { return { region: region, unlocked: p.regionUnlocked(region), claimed: p.regionClaimed(region) }; }),
    readOnly: p.readOnly,
    storageWarning: p.storageWarning,
    persistenceErrors: copy(p.persistenceErrors)
  }));
}
function JourneyBridge(platform) {
  if (!platform || typeof platform.load !== 'function' || typeof platform.save !== 'function') throw Error('Synchronous real storage is required');
  this.platform = platform;
  this.error = null;
  this.uncertain = false;
}
JourneyBridge.prototype.inspect = function () {
  var s = inspect(this.platform);
  var v = viewOf(s);
  if (this.uncertain) v = Session.freeze(Object.assign({}, v, {
    readOnly: true,
    storageWarning: 'Journey write could not be verified. Reload after storage recovers.'
  }));
  return {
    view: v,
    raw: copy(s.raw),
    signature: serial(s.raw)
  };
};
JourneyBridge.prototype.snapshot = function () {
  return this.inspect().view;
};
JourneyBridge.prototype.readOnlyView = function () {
  var self = this,
    view = {};
  ['readOnly', 'records', 'unlocked', 'completed', 'inventory', 'totalStars'].forEach(function (key) {
    Object.defineProperty(view, key, {
      enumerable: true,
      get: function get() {
        var s = self.snapshot();
        return key === 'totalStars' ? s.records.reduce(function (sum, r) {
          return sum + r.bestStars;
        }, 0) : s[key];
      }
    });
  });
  return Object.freeze(view);
};
JourneyBridge.prototype.receipt = function (attemptId) {
  var s = this.snapshot();
  return s.readOnly ? null : s.attempts.find(function (x) {
    return x.id === attemptId;
  }) || null;
};
JourneyBridge.prototype.mutate = function (method, args, expectedSignature) {
  var s = inspect(this.platform),
    p = s.progression;
  if (this.uncertain || p.readOnly) return {
    ok: false,
    reason: 'journey-readonly'
  };
  if (expectedSignature !== undefined && serial(s.raw) !== expectedSignature) return {
    ok: false,
    reason: 'journey-changed',
    readOnly: true
  };
  var allowed = ['recordWin', 'openChest', 'claimRegion', 'equipCharm'];
  if (allowed.indexOf(method) < 0) return {
    ok: false,
    reason: 'unsupported-journey-operation'
  };
  var result;
  try {
    result = p[method].apply(p, args || []);
  } catch (e) {
    return {
      ok: false,
      reason: String(e.message || e)
    };
  }
  if (result && result.persistenceError) return {
    ok: false,
    reason: 'journey-stage-failed'
  };
  if (!Object.prototype.hasOwnProperty.call(s.writes, Progression.KEY)) return {
    ok: true,
    result: copy(result),
    duplicate: !!(result && result.duplicate),
    newlyGrantedRewards: []
  };
  var store = new Store(this.platform, Progression.KEY);
  if (store.readOnly || serial(store.raw) !== serial(s.raw[Progression.KEY])) return {
    ok: false,
    reason: 'journey-changed',
    readOnly: true
  };
  // Legacy inputs also participate in migration; protect them from stale commits.
  for (var i = 1; i < KEYS.length; i++) {
    try {
      if (serial(synchronous(this.platform.load(KEYS[i]))) !== serial(s.raw[KEYS[i]])) return {
        ok: false,
        reason: 'journey-changed',
        readOnly: true
      };
    } catch (e) {
      return {
        ok: false,
        reason: 'journey-unverifiable',
        readOnly: true
      };
    }
  }
  if (!store.write(s.writes[Progression.KEY])) {
    this.error = copy(store.error);
    if (store.readOnly) this.uncertain = true;
    return {
      ok: false,
      reason: store.error.code,
      readOnly: store.readOnly,
      newlyGrantedRewards: []
    };
  }
  // Original legacy counters are best-effort mirrors, not a second authority.
  var warnings = [];
  for (var k = 1; k < KEYS.length; k++) {
    var key = KEYS[k];
    if (Object.prototype.hasOwnProperty.call(s.writes, key)) {
      try {
        var r = synchronous(this.platform.save(key, copy(s.writes[key])));
        if (r === false) throw Error('Legacy mirror rejected');
      } catch (e) {
        warnings.push({
          key: key,
          message: String(e.message || e)
        });
      }
    }
  }
  this.error = null;
  return {
    ok: true,
    result: copy(result),
    newlyGrantedRewards: result && result.newlyGrantedRewards ? copy(result.newlyGrantedRewards) : [],
    warnings: warnings
  };
};
JourneyBridge.KEY = Progression.KEY;
JourneyBridge.KEYS = KEYS;
module.exports = JourneyBridge;
