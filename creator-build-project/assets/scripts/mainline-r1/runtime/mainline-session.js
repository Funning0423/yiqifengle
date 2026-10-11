'use strict';

// Deterministic orchestration of the frozen original engine, not a new ruleset.
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
var Engine = require('./vendor/engine');
var ENGINE_REVISION = 'a1f89a0deb942268bfdbed931a3ab28f85970f4b9186f344bba9a937c7b6bd1b';
var serial = 0;
var EARNED_TOOLS = ['windBell', 'tideBottle', 'tideNet', 'sunSeed', 'starShears'];
var REGION_TOOLS = ['tideNet', 'sunSeed', 'starShears'];
function copy(x) {
  return x === undefined ? undefined : JSON.parse(JSON.stringify(x));
}
function freeze(x) {
  if (x && _typeof(x) === 'object' && !Object.isFrozen(x)) {
    Object.keys(x).forEach(function (k) {
      freeze(x[k]);
    });
    Object.freeze(x);
  }
  return x;
}
function need(x, message) {
  if (!x) throw Error(message);
}
function rng(seed) {
  var _f = function f() {
    _f.state = Math.imul(_f.state, 1664525) + 1013904223 >>> 0;
    return _f.state / 4294967296;
  };
  _f.state = seed >>> 0;
  return _f;
}
function levelOf(id) {
  var match = typeof id === 'string' && /^mainline-(0[1-9]|1[0-2])$/.exec(id);
  return match ? Number(match[1]) - 1 : -1;
}
function stageId(level) {
  return 'mainline-' + String(level + 1).padStart(2, '0');
}
function Session(level, seed) {
  need(Number.isInteger(level) && level >= 0 && level < 12, 'Unknown mainline level');
  need(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, 'Invalid mainline seed');
  this.level = level;
  this.seed = seed;
  this.random = rng(seed);
  this.engine = new Engine(level, this.random);
  this.actions = [];
  this.frames = [];
  this.pending = null;
  this.serial = ++serial;
  this.tokenSerial = 0;
}
Session.prototype.state = function () {
  var e = this.engine;
  return {
    board: copy(e.board),
    moves: e.moves,
    bombs: e.bombs,
    score: e.score,
    status: e.status,
    goals: copy(e.goals),
    moss: Array.from(e.moss).sort(function (a, b) {
      return a - b;
    }),
    roots: Array.from(e.roots).sort(function (a, b) {
      return a[0] - b[0];
    }),
    nextId: e._nextId,
    version: e._version,
    random: this.random.state,
    beaconCursor: e.beaconCursor
  };
};
Session.prototype.snapshot = function () {
  var e = this.engine,
    s = this.state();
  return freeze(Object.assign(s, {
    level: this.level,
    stageId: stageId(this.level),
    seed: this.seed,
    theme: ['seaBeach', 'orchard', 'autumn'][Math.floor(this.level / 4)],
    name: e.config.name,
    initialGoals: copy(e.initialGoals),
    goalOrder: Array.from(e.goalOrder),
    actions: copy(this.actions),
    beaconTarget: null
  }));
};
Session.prototype.valid = function (a) {
  if (!Array.isArray(a)) return false;
  var e = this.engine;
  if (a[0] === 'tool' && a.length === 3 && EARNED_TOOLS.indexOf(a[1]) >= 0) {
    var region = REGION_TOOLS.indexOf(a[1]);
    if (region >= 0 && region !== Math.floor(this.level / 4)) return false;
    return region >= 0 ? e.planRegionTool(a[1], a[2]).valid : e.planRewardTool(a[1], a[2]).valid;
  }
  return a[0] === 'swap' && a.length === 3 ? e.planSwap(a[1], a[2]).valid : a[0] === 'activate' && a.length === 2 ? e.planActivation(a[1]).valid : a[0] === 'bomb' && a.length === 2 ? e.planBomb(a[1]).valid : false;
};
Session.prototype.preview = function (a) {
  if (!this.valid(a)) return {
    ok: false,
    reason: 'illegal-or-unsupported-action'
  };
  var token = 'mlp:' + this.serial + ':' + ++this.tokenSerial;
  this.pending = {
    token: token,
    action: a.slice(),
    state: JSON.stringify(this.state())
  };
  return freeze({
    ok: true,
    token: token,
    action: a.slice(),
    moveCost: a[0] === 'bomb' || a[0] === 'tool' ? 0 : 1
  });
};
Session.prototype.cancelPreview = function () {
  this.pending = null;
};
Session.prototype.act = function (a, renderFrames) {
  if (!this.valid(a)) return false;
  var e = this.engine,
    frames = [],
    before = this.snapshot(),
    ok = a[0] === 'swap' ? e.swap(a[1], a[2]) : a[0] === 'activate' ? e.activate(a[1]) : a[0] === 'bomb' ? e.bomb(a[1]) : REGION_TOOLS.indexOf(a[1]) >= 0 ? e.useRegionTool(a[1], a[2]) : e.useRewardTool(a[1], a[2]);
  if (!ok) return false;
  function frame(kind, beforeState, extra) {
    if (renderFrames !== false) frames.push(Object.assign({
      kind: kind,
      beforeState: beforeState,
      afterState: copyState(),
      before: beforeState.board,
      after: copy(e.board)
    }, extra || {}));
  }
  var self = this;
  function copyState() {
    return self.snapshot();
  }
  frame('action', before, {
    action: a.slice(),
    tiles: a[0] === 'swap' ? [{
      id: before.board[a[1]].id,
      from: a[1],
      to: a[2]
    }, {
      id: before.board[a[2]].id,
      from: a[2],
      to: a[1]
    }] : []
  });
  for (var waveCount = 0; waveCount < Engine.MAX_CASCADES; waveCount++) {
    var wave = e.nextWave();
    if (!wave || !wave.indexes.size) break;
    var clearBefore = copyState(),
      display = {
        kind: wave.kind,
        indexes: Array.from(wave.indexes),
        removed: copy(wave.removed),
        created: copy(wave.created),
        effects: copy(wave.effects),
        specialTriggered: copy(wave.specialTriggered),
        obstacleHits: copy(wave.obstacleHits),
        goalsBefore: copy(wave.goalsBefore),
        goalsAfter: copy(wave.goalsAfter),
        goalsDelta: copy(wave.goalsDelta),
        scoreDelta: wave.scoreDelta
      };
    need(e.clearWave(wave), 'Original engine rejected its own wave');
    frame('clear', clearBefore, {
      wave: display,
      goalsAfter: copy(e.goals)
    });
    var dropBefore = copyState(),
      changes = e.fall();
    frame('drop', dropBefore, {
      changes: copy(changes),
      board: copy(e.board)
    });
    if (waveCount + 1 === Engine.MAX_CASCADES) {
      var shuffleBefore = copyState(),
        report = e.shuffle();
      frame('shuffle', shuffleBefore, {
        changes: copy(report),
        board: copy(e.board)
      });
      e.lastShuffle = null;
    }
  }
  var settledBefore = copyState();
  e.settleDone();
  if (e.lastShuffle) {
    frame('shuffle', settledBefore, {
      changes: copy(e.lastShuffle),
      board: copy(e.board)
    });
    e.lastShuffle = null;
  }
  this.actions.push(a.slice());
  this.frames = frames;
  this.pending = null;
  return true;
};
Session.prototype.checkpoint = function () {
  var extended = this.actions.some(function (a) { return a[0] === 'tool'; });
  return freeze({
    version: extended ? 2 : 1,
    format: extended ? 'mainline-replay-2' : 'mainline-replay-1',
    engineRevision: ENGINE_REVISION,
    level: this.level,
    stageId: stageId(this.level),
    seed: this.seed,
    contentSignature: JSON.stringify(Engine.levels[this.level]),
    actions: copy(this.actions),
    expectedState: JSON.stringify(this.state())
  });
};
Session.restore = function (cp) {
  need(cp && (cp.version === 1 && cp.format === 'mainline-replay-1' || cp.version === 2 && cp.format === 'mainline-replay-2') && cp.engineRevision === ENGINE_REVISION && cp.stageId === stageId(cp.level), 'Incompatible mainline checkpoint');
  need(Number.isInteger(cp.level) && cp.level >= 0 && cp.level < 12 && cp.contentSignature === JSON.stringify(Engine.levels[cp.level]), 'Mainline content changed');
  need(Array.isArray(cp.actions) && cp.actions.length <= Engine.levels[cp.level].moves + 2 + (cp.version === 2 ? 9 : 0) && typeof cp.expectedState === 'string' && cp.expectedState.length < 30000, 'Invalid mainline replay');
  // Original inventory can supply at most four bells, four bottles, and one
  // region-matching gift per attempt. Legacy replay-1 accepts no tool actions.
  var counts = {};
  cp.actions.forEach(function (a) {
    if (Array.isArray(a) && a[0] === 'tool') {
      need(cp.version === 2, 'Tool actions require replay-2');
      counts[a[1]] = (counts[a[1]] || 0) + 1;
      need(counts[a[1]] <= (a[1] === 'windBell' || a[1] === 'tideBottle' ? 4 : 1), 'Impossible original tool count');
    }
  });
  var s = new Session(cp.level, cp.seed);
  for (var i = 0; i < cp.actions.length; i++) need(s.act(cp.actions[i], false), 'Illegal action in mainline replay');
  need(JSON.stringify(s.state()) === cp.expectedState, 'Mainline replay mismatch');
  s.frames = [];
  return s;
};
Session.prototype.trial = function (token) {
  var p = this.pending;
  if (!p || p.token !== token || p.state !== JSON.stringify(this.state())) return null;
  var candidate = Session.restore(this.checkpoint());
  need(candidate.act(p.action), 'Original engine rejected previewed action');
  return candidate;
};
Session.prototype.hint = function () {
  var e = this.engine;
  if (!e._canStart()) return null;
  // The frozen rules count roots only when their final layer is removed.
  // Guidance must also value earlier layer hits, otherwise it can repeatedly
  // recommend colour collection while leaving every multi-layer root intact.
  var best = null;
  function consider(action, wave) {
    var score = 0;
    Object.keys(wave.goalsDelta).forEach(function (key) {
      score += wave.goalsDelta[key] * (key === 'roots' ? 8 : key === 'moss' ? 5 : key === 'lines' || key === 'specials' ? 10 : 1);
    });
    if (e.goals.roots > 0) wave.obstacleHits.forEach(function (hit) {
      if (hit.kind === 'roots') score += (hit.before - hit.after) * 3;
    });
    // Creating a board special is useful preparation for the remaining fixed
    // obstacles; it is not a goal completion or an inventory grant.
    if (e.goals.roots > 0 || e.goals.moss > 0) score += wave.created.length * 6;
    score += wave.removed.length * .01;
    if (!best || score > best.score) best = {action: action, score: score};
  }
  e.possibleMoves().forEach(function (cells) {
    var p = e.planSwap(cells[0], cells[1]);
    if (p.valid) consider(['swap', cells[0], cells[1]], p.wave);
  });
  e.possibleActivations().forEach(function (index) {
    var p = e.planActivation(index);
    if (p.valid) consider(['activate', index], p.wave);
  });
  return best ? {action: best.action, cells: best.action.slice(1)} : null;
};
Session.copy = copy;
Session.freeze = freeze;
Session.stageId = stageId;
Session.levelOf = levelOf;
Session.Engine = Engine;
Session.EARNED_TOOLS = EARNED_TOOLS;
Session.REGION_TOOLS = REGION_TOOLS;
module.exports = Session;
