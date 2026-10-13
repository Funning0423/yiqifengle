'use strict';

var Session = require('./mainline-session'),
  seedBanks = require('./verified-seeds'),
  Journey = require('./journey-bridge'),
  Store = require('./durable-store'),
  copy = Store.clone;
var KEY = 'forest-mainline-cocos-r1-active',
  PACK = 'mainline-v33',
  instance = 0;
function need(ok, message) {
  if (!ok) throw Error(message);
}
function validate(r) {
  need(r && r.version === 1 && r.format === 'mainline-active-1' && Number.isSafeInteger(r.sequence) && r.sequence > 0 && /^mla-[0-9]{12,16}$/.test(r.attemptId) && r.attemptId === 'mla-' + String(r.sequence).padStart(12, '0') && typeof r.discarded === 'boolean', 'Invalid mainline active record');
  var s = Session.restore(r.checkpoint);
  if (r.toolSpend) {
    need(Journey.validateToolSpend(r.toolSpend) && !r.discarded, 'Invalid tool charge journal');
    var last = s.actions[s.actions.length - 1];
    need(last && last[0] === 'tool' && last[1] === r.toolSpend.kind, 'Tool journal/replay mismatch');
  }
  need(s.engine.status === 'won' ? typeof r.completionBase === 'string' && r.completionBase.length < 1000000 : r.completionBase === null, 'Invalid completion boundary');
}
function Controller(options) {
  options = options || {};
  this.platform = options.platform;
  this.journey = options.journeyBridge || new Journey(this.platform);
  if (this.journey.platform !== this.platform) throw Error('Journey bridge must use the controller storage port');
  this.store = new Store(this.platform, KEY, validate);
  this.session = null;
  this.active = null;
  this.frames = [];
  this.frameIndex = 0;
  this.paused = true;
  this.hidden = false;
  this.id = ++instance;
  this.generation = 0;
  this.work = null;
  this.error = null;
  this.readOnly = false;
  this.completion = null;
  try {
    if (this.store.readOnly) {
      this._fail(this.store.error.code);
      return;
    }
    if (this.journey.snapshot().readOnly) {
      this._fail('journey-readonly');
      return;
    }
    if (this.store.value) {
      this.active = copy(this.store.value);
      if (!this.active.discarded) {
        this.session = Session.restore(this.active.checkpoint);
        need(this.session.level <= this.journey.snapshot().unlocked, 'Active mainline level lacks real unlock progress');
        if (this.active.toolSpend) {
          this.work = {kind: 'tool'};
          this._drain();
        }
        if (!this.work && !this.readOnly && this.session.engine.status === 'won') {
          var receipt = this._receipt();
          if (receipt) this.completion = {
            ok: true,
            duplicate: true,
            result: copy(receipt.result)
          };else {
            this.work = {
              kind: 'complete'
            };
            this._drain();
          }
        }
      }
    }
  } catch (e) {
    this._fail(String(e.message || e));
  }
}
Controller.KEY = KEY;
Controller.PROGRESS_KEY = Journey.KEY;
Controller.VERSION = 1;
Controller.prototype._fail = function (reason) {
  this.readOnly = true;
  this.error = {
    code: reason,
    retryable: false
  };
  return {
    ok: false,
    reason: reason,
    readOnly: true
  };
};
Controller.prototype._storageFailure = function () {
  this.error = copy(this.store.error);
  if (this.store.readOnly) this.readOnly = true;
  return {
    ok: false,
    reason: this.error ? this.error.code : 'save-failed',
    saved: false,
    newlyGrantedRewards: []
  };
};
Controller.prototype._receipt = function () {
  if (!this.active) return null;
  var r = this.journey.receipt(this.active.attemptId);
  if (r) {
    var saved = JSON.parse(this.active.checkpoint.expectedState),
      budget = Session.Engine.levels[this.active.checkpoint.level].moves,
      stars = 1 + (saved.moves / budget >= .25 ? 1 : 0) + (saved.moves / budget >= .5 ? 1 : 0);
    if (r.level !== this.active.checkpoint.level || saved.status !== 'won' || r.result.earnedStars !== stars) {
      this._fail('Mainline attempt receipt mismatch');
      return null;
    }
  }
  return r;
};
Controller.prototype._drain = function () {
  if (this.readOnly) return {
    ok: false,
    reason: 'read-only'
  };
  try {
    if (!this.store.current()) return this._storageFailure();
    if (this.work && this.work.kind === 'save') {
      var w = this.work;
      if (!this.store.write(w.record)) return this._storageFailure();
      this.active = copy(w.record);
      this.session = w.record.discarded ? null : w.candidate;
      this.frames = [];
      this.frameIndex = 0;
      this.generation++;
      this.completion = null;
      this.work = this.active.toolSpend ? {kind: 'tool'} : this.session && this.session.engine.status === 'won' ? {
        kind: 'complete'
      } : null;
    }
    if (this.work && this.work.kind === 'tool') {
      var charged = this.journey.commitToolSpend(this.active.toolSpend);
      if (!charged.ok) {
        this.error = {code: charged.reason, retryable: !charged.readOnly};
        if (charged.readOnly) this.readOnly = true;
        return {ok: false, reason: charged.reason, saved: false, newlyGrantedRewards: []};
      }
      var clean = copy(this.active);delete clean.toolSpend;
      clean.completionBase = this.session.engine.status === 'won' ? this.journey.inspect().signature : null;
      if (!this.store.write(clean)) return this._storageFailure();
      this.active = clean;
      this.work = this.session.engine.status === 'won' ? {kind: 'complete'} : null;
    }
    if (this.work && this.work.kind === 'complete') {
      var receipt = this._receipt();
      if (this.readOnly) return {
        ok: false,
        reason: this.error.code
      };
      if (receipt) {
        this.completion = {
          ok: true,
          duplicate: true,
          result: copy(receipt.result)
        };
        this.work = null;
      } else {
        var proven = Session.restore(this.active.checkpoint);
        need(proven.engine.status === 'won', 'Mainline completion requires a durable winning replay');
        var e = proven.engine,
          done = this.journey.mutate('recordWin', [proven.level, {
            score: e.score,
            movesRemaining: e.moves,
            totalMoves: e.config.moves,
            attemptId: this.active.attemptId
          }], this.active.completionBase);
        if (!done.ok) {
          this.error = {
            code: done.reason,
            retryable: !done.readOnly
          };
          if (done.readOnly) this.readOnly = true;
          return {
            ok: false,
            reason: done.reason,
            saved: false,
            newlyGrantedRewards: []
          };
        }
        this.completion = done;
        this.work = null;
      }
    }
    this.error = null;
    return {
      ok: true,
      saved: true,
      newlyGrantedRewards: []
    };
  } catch (e) {
    return this._fail(String(e.message || e));
  }
};
Controller.prototype._state = function () {
  if (this.readOnly || this.store.readOnly) return 'error.readonly';
  if (this.work) return this.session && this.session.engine.status === 'won' ? 'result.unsaved' : 'run.unsaved';
  if (!this.session) return 'book.ready';
  if (this.frames.length) return 'run.resolving';
  if (this.session.engine.status !== 'playing') return 'result.saved';
  return this.hidden || this.paused ? 'run.paused' : 'run.ready';
};
Controller.prototype.snapshot = function () {
  var view = this.journey.snapshot();
  if (view.readOnly && !this.readOnly) this._fail('journey-readonly');
  var active = this.session ? copy(this.session.snapshot()) : null,
    visual = null,
    receipt = this.session && this.session.engine.status === 'won' ? this._receipt() : null,
    result = null;
  if (active) active.attemptId = this.active.attemptId;
  if (active && active.status === 'won' && !receipt && !this.work && !this.readOnly) this._fail('Mainline completion receipt disappeared');
  if (this.frames.length) {
    visual = copy(this.frames[this.frameIndex]);
    visual.token = 'mlv:' + this.id + ':' + this.generation + ':' + this.frameIndex;
  }
  if (active && active.status !== 'playing') {
    result = {
      outcome: active.status,
      saved: active.status === 'won' ? !!receipt : !this.work,
      completionRecorded: !!receipt,
      firstClear: !!(this.completion && !this.completion.duplicate && this.completion.result && this.completion.result.chestAwarded),
      duplicate: !!(this.completion && this.completion.duplicate),
      stars: receipt ? receipt.result.earnedStars : 0,
      newChest: receipt ? receipt.result.newChest : null
    };
  }
  var self = this,
    stages = Session.Engine.levels.map(function (level, i) {
      return {
        id: Session.stageId(i),
        level: i,
        region: ['tide', 'meadow', 'sky'][Math.floor(i / 4)],
        ordinal: i + 1,
        name: level.name,
        chapter: level.chapter,
        chapterName: level.chapterName,
        description: level.description,
        moves: level.moves,
        seedBank: seedBanks[i].slice(),
        goals: copy(level.goals),
        unlocked: !self.readOnly && !view.readOnly && i <= view.unlocked,
        record: copy(view.records[i])
      };
    });
  return Session.freeze({
    provider: PACK,
    storageKey: KEY,
    progressKey: Journey.KEY,
    state: this._state(),
    active: active,
    visual: visual,
    hidden: this.hidden,
    readOnly: this.readOnly,
    error: copy(this.error),
    stages: stages,
    regions: [],
    journey: view,
    result: result,
    nextStageId: receipt && active.level < 11 && stages[active.level + 1].unlocked ? Session.stageId(active.level + 1) : null,
    capabilities: {
      swap: true,
      activate: true,
      bomb: true,
      earnedTools: true,
      oceanEvents: false,
      goals: active ? active.goalOrder : [],
      maxGoalSlots: 4
    }
  });
};
Controller.prototype.startStage = function (id, options) {
  options = options || {};
  if (this.readOnly || this.work) return {
    ok: false,
    reason: 'pending-or-readonly'
  };
  if (!this.store.current()) return this._storageFailure();
  var level = Session.levelOf(id),
    view = this.journey.snapshot();
  if (view.readOnly) return this._fail('journey-readonly');
  if (level < 0 || level > view.unlocked) return {
    ok: false,
    reason: 'stage-locked'
  };
  if (this.session && (this.session.engine.status === 'playing' || this.session.engine.status === 'won' && !this._receipt())) return {
    ok: false,
    reason: 'active-attempt-exists'
  };
  // Explicit seeds and existing checkpoints retain their original replay identity.
  // Unspecified new openings come only from the shipped, zero-tool witness bank.
  var seed = options.seed === undefined ? seedBanks[level][Math.floor(Math.random() * seedBanks[level].length)] : options.seed,
    candidate;
  try {
    candidate = new Session(level, seed);
  } catch (e) {
    return {
      ok: false,
      reason: String(e.message || e)
    };
  }
  var seq = this.active ? this.active.sequence : 0;
  view.attempts.forEach(function (r) {
    if (/^mla-[0-9]{12,16}$/.test(r.id)) seq = Math.max(seq, Number(r.id.slice(4)));
  });
  if (!Number.isSafeInteger(seq + 1)) return this._fail('attempt-sequence-exhausted');
  seq++;
  var record = {
    version: 1,
    format: 'mainline-active-1',
    sequence: seq,
    attemptId: 'mla-' + String(seq).padStart(12, '0'),
    checkpoint: candidate.checkpoint(),
    completionBase: null,
    discarded: false
  };
  this.work = {
    kind: 'save',
    record: record,
    candidate: candidate
  };
  this.paused = false;
  return this._drain();
};
Controller.prototype.previewAction = function (action) {
  if (Array.isArray(action) && action[0] === 'tool') {
    var view = this.journey.snapshot();
    if (view.readOnly) return this._fail('journey-readonly');
    if (!(view.inventory.tools[action[1]] > 0)) return {ok: false, reason: 'tool-empty'};
  }
  return this._state() === 'run.ready' ? this.session.preview(action) : {
    ok: false,
    reason: 'input-disabled'
  };
};
Controller.prototype.cancelPreview = function (token) {
  var p = this.session && this.session.pending;
  if (!p || p.token !== token) return {
    ok: false,
    reason: 'stale-token'
  };
  this.session.cancelPreview();
  return {
    ok: true
  };
};
Controller.prototype.commitAction = function (token) {
  if (this._state() !== 'run.ready') return {
    ok: false,
    reason: 'input-disabled'
  };
  var candidate;
  try {
    candidate = this.session.trial(token);
  } catch (e) {
    return {
      ok: false,
      reason: 'resolution-error',
      detail: String(e.message || e)
    };
  }
  if (!candidate) return {
    ok: false,
    reason: 'stale-token'
  };
  if (this.journey.snapshot().readOnly) return this._fail('journey-readonly');
  var pendingAction = this.session.pending.action, toolSpend = null;
  if (pendingAction[0] === 'tool') {
    toolSpend = this.journey.prepareToolSpend(pendingAction[1]);
    if (!toolSpend) return {ok: false, reason: 'tool-empty-or-readonly'};
  }
  this.session.cancelPreview();
  var record = copy(this.active);
  if (toolSpend) record.toolSpend = toolSpend;
  record.checkpoint = candidate.checkpoint();
  record.completionBase = candidate.engine.status === 'won' ? this.journey.inspect().signature : null;
  this.work = {
    kind: 'save',
    record: record,
    candidate: candidate
  };
  var out = this._drain();
  if (out.ok) {
    this.frames = copy(candidate.frames);
    this.frameIndex = 0;
    this.generation++;
  } else this.paused = true;
  return out;
};
Controller.prototype.finishVisualStep = function (token) {
  var v = this.snapshot().visual;
  if (!v || token !== v.token) return {
    ok: false,
    reason: 'stale-token'
  };
  this.frameIndex++;
  if (this.frameIndex >= this.frames.length) {
    this.frames = [];
    this.frameIndex = 0;
    this.generation++;
  }
  return {
    ok: true
  };
};
Controller.prototype.pause = function () {
  if (this.session) this.session.cancelPreview();
  this.frames = [];
  this.frameIndex = 0;
  this.generation++;
  this.paused = true;
  return this.work || this.readOnly ? {
    ok: false,
    reason: this.readOnly ? 'read-only' : 'save-required'
  } : {
    ok: true
  };
};
Controller.prototype.onHide = function () {
  this.hidden = true;
  return this.pause();
};
Controller.prototype.onShow = function () {
  this.hidden = false;
  return {
    ok: true
  };
};
Controller.prototype.resume = function () {
  if (this.hidden || this.work || this.readOnly || !this.session) return {
    ok: false,
    reason: 'resume-blocked'
  };
  this.paused = false;
  return {
    ok: true
  };
};
Controller.prototype.resumeActive = Controller.prototype.resume;
Controller.prototype.requestExit = function () {
  var result = this.pause();
  // Navigation may leave a protected record without clearing protection or
  // attempting any write. A later explicit entry creates a fresh reader.
  return this.readOnly ? { ok: true, readOnly: true, preserved: true } : result;
};
Controller.prototype.retrySave = function () {
  if (this.readOnly || !this.work) return {
    ok: false,
    reason: 'nothing-retryable'
  };
  var out = this._drain();
  this.paused = true;
  return out;
};
Controller.prototype.finish = function () {
  if (this.readOnly || !this.session || this.session.engine.status !== 'won') return {
    ok: false,
    reason: 'not-won'
  };
  if (this.work) return this.retrySave();
  if (this._receipt()) return {
    ok: true,
    saved: true,
    duplicate: true,
    newlyGrantedRewards: []
  };
  this.work = {
    kind: 'complete'
  };
  return this._drain();
};
Controller.prototype.discardActive = function () {
  if (this.readOnly || this.work || !this.session) return {
    ok: false,
    reason: 'discard-blocked'
  };
  if (this.session.engine.status === 'won' && !this._receipt()) return {
    ok: false,
    reason: 'unsaved-win'
  };
  this.pause();
  var r = copy(this.active);
  r.discarded = true;
  this.work = {
    kind: 'save',
    record: r,
    candidate: null
  };
  return this._drain();
};
Controller.prototype.hint = function () {
  return this._state() === 'run.ready' ? this.session.hint() : null;
};
Controller.prototype._claim = function (method, args) {
  if (this.readOnly || this.work) return {
    ok: false,
    reason: 'pending-or-readonly',
    newlyGrantedRewards: []
  };
  if (!this.store.current()) return this._storageFailure();
  var r = this.journey.mutate(method, args);
  if (r.readOnly) this._fail(r.reason);
  return r;
};
Controller.prototype.openChest = function (level) {
  return this._claim('openChest', [level]);
};
Controller.prototype.claimRegion = function (region) {
  return this._claim('claimRegion', [region]);
};
Controller.prototype.equipCharm = function (id) {
  return this._claim('equipCharm', [id]);
};
module.exports = Controller;
