/* Portable R4 orchestration. No renderer, platform SDK, clock, or rule reimplementation. */
'use strict';
const Engine = require('./engine');
const Session = require('./challenge-session');
const Progress = require('./challenge-progress');
const Catalog = require('./challenge-catalog');
const privateState = new WeakMap();
let instanceSerial = 0;
const REGIONS = ['tide', 'meadow', 'sky'];
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const promise = value => !!value && typeof value.then === 'function';
const rejectAsync = value => { Promise.resolve(value).catch(() => {}); };
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const publicCopy = value => freeze(JSON.parse(JSON.stringify(value, (key, x) => x instanceof Set ? [...x] : x instanceof Map ? [...x] : x)));
const parse = value => typeof value === 'string' && value !== '' ? JSON.parse(value) : value;
const equivalent = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const actionValid = a => Array.isArray(a) && ((a[0] === 'swap' && a.length === 3) || (a[0] === 'activate' && a.length === 2)) && a.slice(1).every(i => Number.isInteger(i) && i >= 0 && i < 49);
const state = controller => privateState.get(controller);
const ok = extra => ({ok: true, ...extra});
const fail = reason => ({ok: false, reason});
function invalidate(s) { s.generation++; s.visual = null; s.preview = null; }
function readonly(s, reason) { invalidate(s); s.readOnly = true; s.error = reason; s.screen = 'storage.readOnly'; }
function blocked(s) { if (s.readOnly || s.progress.blocked) { readonly(s, s.error || s.progress.lastError || 'journal-read-only'); return true; } return false; }
function token(s, kind, data) { const value = `${s.instance}:${s.generation}:${++s.sequence}:${kind}`; s.visual = {kind, token: value, ...data}; return value; }
function event(s, kind, data) { s.events.push(publicCopy({id: ++s.eventSerial, kind, ...data})); if (s.events.length > 32) s.events.shift(); }
function storage(platform, s) {
  const known = new Map();
  function read(key) {
    if (typeof platform.load !== 'function') throw Error('Synchronous storage.load is required');
    const value = platform.load(key);
    if (promise(value)) { rejectAsync(value); readonly(s, 'asynchronous-storage-not-supported'); throw Error(s.error); }
    return clone(value);
  }
  function confirm(key, before, expected) {
    let after;
    try { after = read(key); }
    catch (error) { readonly(s, 'uncertain-storage-readback'); throw error; }
    let matches = false;
    try { matches = equivalent(parse(after), expected); } catch (_) { /* Invalid new bytes are uncertain, never retryable. */ }
    if (matches) { known.set(key, clone(after)); return true; }
    if (!equivalent(after, before)) readonly(s, 'uncertain-storage-write');
    return false;
  }
  return {
    load(key) { const value = read(key); known.set(key, clone(value)); return value; },
    save(key, value) {
      if (s.readOnly) throw Error(s.error || 'storage-read-only');
      const current = read(key);
      if (!known.has(key) || !equivalent(current, known.get(key))) { readonly(s, 'concurrent-storage-change'); throw Error(s.error); }
      if (typeof platform.save !== 'function') throw Error('Synchronous storage.save is required');
      let result;
      try { result = platform.save(key, clone(value)); }
      catch (error) {
        // Some stores write before throwing. Recognize only an exact synchronous readback.
        if (confirm(key, current, value)) return true;
        throw error;
      }
      if (promise(result)) { rejectAsync(result); readonly(s, 'asynchronous-storage-not-supported'); throw Error(s.error); }
      if (confirm(key, current, value)) return true;
      throw Error(result === false ? 'Storage rejected write' : 'Storage readback did not confirm write');
    }
  };
}
function envelope(s, checkpoint, pendingAction = null, receipt = null) {
  return {version: 1, packId: s.catalog.packId, revision: (s.durable?.revision || 0) + 1, checkpoint: clone(checkpoint), pendingAction: clone(pendingAction), receipt: clone(receipt)};
}
function write(s, data, after) {
  try {
    if (blocked(s)) return false;
    if (!Number.isSafeInteger(data.revision) || data.revision >= Number.MAX_SAFE_INTEGER) { readonly(s, 'active-journal-revision-exhausted'); return false; }
    s.store.save(s.key, data); s.durable = clone(data); s.pendingSave = null; s.error = null; return true;
  } catch (error) {
    if (!s.readOnly) { s.error = String(error.message || error); s.pendingSave = {data: clone(data), after}; s.screen = 'storage.unsaved'; }
    return false;
  }
}
function postStable(s) {
  if (s.run.engine.status === 'won') { s.screen = 'result.unsaved'; return finish(s); }
  if (s.run.engine.status === 'lost') { s.result = {saved: true, outcome: 'lost', stageId: s.run.stage.id}; s.screen = 'result.saved'; return true; }
  s.screen = s.paused ? 'run.paused' : 'run.ready'; return true;
}
function resultEvent(s) { event(s, 'result-saved', {stageId: s.run.stage.id, attemptId: s.run.attemptId, firstClear: s.result.firstClear, duplicate: s.result.duplicate}); }
function finish(s) {
  if (blocked(s)) return false;
  if (!s.run || s.run.engine.status !== 'won' || s.committed || s.pendingSave) return false;
  if (s.durable?.receipt) { s.result = {...clone(s.durable.receipt.result), firstClear: false, duplicate: true}; s.screen = 'result.saved'; return true; }
  const result = s.run.finish();
  if (!result.saved) { s.result = clone(result); s.error = s.progress.lastError || result.reason || 'Result save failed'; s.screen = s.readOnly || s.progress.blocked ? 'storage.readOnly' : 'result.unsaved'; return false; }
  s.result = {...result, outcome: 'won'};
  const data = envelope(s, s.run.checkpoint(), null, {attemptId: s.run.attemptId, result: s.result});
  if (!write(s, data, 'result')) return false;
  s.screen = 'result.saved'; resultEvent(s); return true;
}
function settled(s) {
  s.run.engine.settleDone();
  if (s.run.engine._turnActive || s.run.engine._pendingPlan || s.run.engine.matches().size || s.run.engine.board.some(x => !x)) throw Error('Engine did not settle');
  if (s.committed) s.run.actions.push(s.committed.action.slice());
  s.committed = null; s.wave = null; s.visual = null;
  const data = envelope(s, s.run.checkpoint());
  if (write(s, data, 'stable')) postStable(s);
}
function advance(s) {
  const e = s.run.engine, kind = s.visual.kind;
  s.visual = null;
  if (kind === 'clear') {
    if (!e.clearWave(s.wave)) throw Error('Engine rejected committed wave');
    const changes = e.fall(); s.committed.waves++;
    token(s, 'drop', {changes: publicCopy(changes)}); return;
  }
  if (kind === 'drop' && s.committed.waves >= Engine.MAX_CASCADES) { e.shuffle(); settled(s); return; }
  const wave = e.nextWave();
  if (!wave.indexes.size) { settled(s); return; }
  s.wave = wave; token(s, 'clear', {wave: publicCopy(wave)});
}
function recoverError(s, error) {
  // Preserve the durable intent; reload can replay it. Never guess a partial engine state.
  readonly(s, 'run-recovery-required: ' + String(error.message || error));
}
function settleCommitted(s) {
  if (!s.committed) return true;
  try { let count = 0; while (s.committed && !s.readOnly) { if (++count > Engine.MAX_CASCADES * 2 + 3) throw Error('Cascade guard exceeded'); advance(s); } return !s.pendingSave && !s.readOnly; }
  catch (error) { recoverError(s, error); return false; }
}
function validateEnvelope(s, d) {
  if (!plain(d) || d.version !== 1 || d.packId !== s.catalog.packId || !Number.isSafeInteger(d.revision) || d.revision < 1 || d.revision >= Number.MAX_SAFE_INTEGER || !Object.prototype.hasOwnProperty.call(d, 'checkpoint') || !Object.prototype.hasOwnProperty.call(d, 'pendingAction') || !Object.prototype.hasOwnProperty.call(d, 'receipt')) throw Error('Unsupported active challenge journal');
  if (d.checkpoint === null) { if (d.pendingAction !== null || d.receipt !== null) throw Error('Invalid empty active journal'); return; }
  if (!plain(d.checkpoint) || (d.pendingAction !== null && !actionValid(d.pendingAction))) throw Error('Invalid active checkpoint or action');
  if (d.receipt !== null && (!plain(d.receipt) || d.pendingAction !== null || d.receipt.attemptId !== d.checkpoint.attemptId || !plain(d.receipt.result) || d.receipt.result.saved !== true || d.receipt.result.outcome !== 'won' || d.receipt.result.stageId !== d.checkpoint.stageId || !s.progress.records[d.checkpoint.stageId])) throw Error('Invalid active result receipt');
}
function validateReceipt(s, receipt) {
  const e = s.run.engine, r = receipt.result, expectedStars = 1 + (e.moves / s.run.stage.config.moves >= .25 ? 1 : 0) + (e.moves / s.run.stage.config.moves >= .5 ? 1 : 0);
  const attempt = s.progress.attempts.find(a => a.id === s.run.attemptId && a.stageId === s.run.stage.id), record = s.progress.records[s.run.stage.id];
  if (e.status !== 'won' || !attempt || typeof r.firstClear !== 'boolean' || typeof r.duplicate !== 'boolean' || (r.duplicate && r.firstClear) || r.stars !== expectedStars || !Number.isInteger(r.bestStars) || r.bestStars < r.stars || r.bestStars > 3 || !Number.isSafeInteger(r.bestScore) || r.bestScore < e.score || r.bestStars > record.bestStars || r.bestScore > record.bestScore || r.stars !== attempt.result.stars || r.bestStars !== attempt.result.bestStars || r.bestScore !== attempt.result.bestScore) throw Error('Invalid active result receipt metrics');
}
function applyIntent(s, action, plan) {
    const e = s.run.engine;
    try {
      const accepted = action[0] === 'swap' ? e.swap(action[1], action[2]) : e.activate(action[1]);
      if (!accepted) throw Error('Committed intent rejected by engine');
      s.committed = {action: action.slice(), waves: 0}; s.screen = 'run.resolving';
      token(s, 'action', {action: action.slice(), tiles: plan?.tiles || []}); return ok();
    } catch (error) { recoverError(s, error); return fail('recovery-required'); }
}

class ChallengeController {
  constructor({platform, journey, catalog = Catalog, attemptIdFactory} = {}) {
    const s = {catalog, key: Progress.keyForPack(catalog.packId) + '-active', instance: ++instanceSerial, generation: 0, sequence: 0, eventSerial: 0, events: [], screen: 'book.ready', region: null, selected: null, run: null, committed: null, visual: null, preview: null, wave: null, result: null, durable: null, pendingSave: null, paused: false, hidden: false, readOnly: false, error: null, attemptIdFactory};
    privateState.set(this, s); s.store = storage(platform || {}, s); s.progress = new Progress(s.store, journey, catalog);
    if (blocked(s)) return;
    try {
      const raw = s.store.load(s.key); if (raw == null || raw === '') return;
      const d = parse(raw); validateEnvelope(s, d); s.durable = clone(d); if (!d.checkpoint) return;
      s.run = Session.restore(s.progress, d.checkpoint); s.selected = s.run.stage.id; s.region = s.run.stage.region; s.paused = true;
      if (d.receipt) validateReceipt(s, d.receipt);
      if (d.pendingAction) {
        if (!s.run.act(d.pendingAction)) throw Error('Invalid committed action replay');
        event(s, 'intent-recovered', {stageId: s.selected, attemptId: s.run.attemptId});
        if (write(s, envelope(s, s.run.checkpoint()), 'stable')) postStable(s);
      } else postStable(s);
    } catch (error) { readonly(s, String(error.message || error)); }
  }
  snapshot() {
    const s = state(this), e = s.run?.engine;
    if (!s.readOnly && s.progress.blocked) blocked(s);
    return publicCopy({state: s.screen, generation: s.generation, region: s.region, selectedStageId: s.selected, hidden: s.hidden, readOnly: s.readOnly, error: s.error,
      storageKey: s.key, progressKey: s.progress.key, result: s.result, visual: s.visual, events: s.events,
      regions: REGIONS.map(region => ({id: region, mementoClaimed: s.progress.claimedRegions.includes(region), completed: s.catalog.stages.filter(x => x.region === region && s.progress.records[x.id]).length})),
      stages: s.catalog.stages.filter(x => !s.region || x.region === s.region).map(x => ({id: x.id, region: x.region, ordinal: x.ordinal, name: x.config.name, unlocked: !s.readOnly && s.progress.isUnlocked(x.id), record: s.progress.records[x.id] || null})),
      active: s.run ? {stageId: s.run.stage.id, theme: s.run.stage.theme, seed: s.run.seed, attemptId: s.run.attemptId, contentRevision: s.run.stage.contentRevision, actions: s.run.actions, moves: e.moves, bombs: e.bombs, score: e.score, goals: e.goals, initialGoals: e.initialGoals, goalOrder: e.goalOrder, board: e.board, moss: [...e.moss], roots: [...e.roots], beaconTarget: e.beaconTarget(), status: e.status} : null});
  }
  selectRegion(region) {
    const s = state(this); if (blocked(s)) return fail('read-only');
    if (!REGIONS.includes(region)) return fail('unknown-region');
    if (!['book.ready', 'stage.detail'].includes(s.screen)) return fail('exit-run-first');
    invalidate(s); s.region = region; s.selected = null; s.screen = 'book.ready'; return ok();
  }
  selectStage(id) {
    const s = state(this); if (blocked(s)) return fail('read-only');
    if (!['book.ready', 'stage.detail'].includes(s.screen)) return fail('exit-run-first');
    const stage = s.catalog.get(id); if (!stage) return fail('unknown-stage');
    invalidate(s); s.region = stage.region; s.selected = id; s.screen = 'stage.detail'; return ok({unlocked: s.progress.isUnlocked(id)});
  }
  startStage(id = state(this).selected, options = {}) {
    const s = state(this); if (blocked(s)) return fail('read-only');
    if (!['book.ready', 'stage.detail'].includes(s.screen) || s.hidden) return fail('invalid-state');
    if (s.run || s.durable?.checkpoint) return fail('resume-or-discard-active-run');
    let run;
    try { run = new Session(s.progress, id, {seed: options.seed, attemptId: options.attemptId || s.attemptIdFactory?.(id)}); }
    catch (error) { return fail(String(error.message || error)); }
    if (s.progress.attempts.some(a => a.id === run.attemptId)) return fail('attempt-id-already-used');
    const data = envelope(s, run.checkpoint());
    // A failed start retains the candidate only for exact retry; it never becomes playable.
    s.startCandidate = run;
    if (!write(s, data, 'start')) return fail('save-failed');
    s.startCandidate = null; s.run = run; s.region = run.stage.region; s.selected = id; s.paused = false; s.hidden = false; s.result = null; invalidate(s); s.screen = 'run.ready'; return ok();
  }
  previewAction(action) {
    const s = state(this); if (blocked(s)) return fail('read-only');
    if (s.screen !== 'run.ready' || !actionValid(action) || s.hidden) return fail('invalid-action-or-state');
    const e = s.run.engine, plan = action[0] === 'swap' ? e.planSwap(action[1], action[2]) : e.planActivation(action[1]);
    if (!plan.valid) return fail('illegal-action');
    s.preview = {action: action.slice(), plan}; s.screen = 'run.preview';
    const value = token(s, 'preview', {action: action.slice(), plan: publicCopy(plan)}); return ok({token: value});
  }
  cancelPreview(value) {
    const s = state(this); if (s.screen !== 'run.preview' || s.visual?.token !== value) return fail('stale-token');
    invalidate(s); s.screen = 'run.ready'; return ok();
  }
  commitAction(value) {
    const s = state(this); if (blocked(s)) return fail('read-only');
    if (s.screen !== 'run.preview' || s.visual?.token !== value) return fail('stale-token');
    const action = s.preview.action.slice(), plan = publicCopy(s.preview.plan), data = envelope(s, s.run.checkpoint(), action);
    invalidate(s);
    // Intent is persisted and read back before the first engine mutation.
    if (!write(s, data, 'intent')) return fail('save-failed');
    return applyIntent(s, action, plan);
  }
  finishVisualStep(value) {
    const s = state(this); if (blocked(s)) return fail('read-only');
    if (s.screen !== 'run.resolving' || s.visual?.token !== value) return fail('stale-token');
    try { advance(s); return s.pendingSave ? fail('save-failed') : ok(); }
    catch (error) { recoverError(s, error); return fail('recovery-required'); }
  }
  pause() {
    const s = state(this); if (blocked(s)) return fail('read-only');
    s.paused = true;
    if (s.screen === 'run.preview') { invalidate(s); s.screen = 'run.ready'; }
    if (!settleCommitted(s)) return fail('save-failed');
    invalidate(s);
    if (s.pendingSave) return fail('save-failed');
    if (s.run?.engine.status === 'playing') s.screen = 'run.paused'; return ok();
  }
  onHide() { const s = state(this); s.hidden = true; return this.pause(); }
  onShow() { const s = state(this); s.hidden = false; return s.readOnly ? fail('read-only') : ok(); }
  resume() {
    const s = state(this); if (blocked(s)) return fail('read-only');
    if (s.screen !== 'run.paused' || !s.run || s.hidden) return fail('invalid-state');
    invalidate(s); s.hidden = false; s.paused = false; s.screen = 'run.ready'; return ok();
  }
  resumeActive() {
    const s = state(this); if (blocked(s)) return fail('read-only');
    if (!s.run || s.hidden || !['book.ready', 'stage.detail', 'run.paused'].includes(s.screen)) return fail('no-resumable-run');
    s.region = s.run.stage.region; s.selected = s.run.stage.id; s.hidden = false; s.paused = false; invalidate(s); postStable(s); return ok();
  }
  requestExit() {
    const s = state(this); if (blocked(s)) return fail('read-only');
    if (!this.pause().ok || s.screen === 'result.unsaved') return fail('save-failed');
    if (s.run && s.run.engine.status !== 'playing') {
      if (!write(s, envelope(s, null), 'exit')) return fail('save-failed');
      s.run = null; s.result = null;
    }
    invalidate(s); s.screen = 'book.ready'; s.selected = null; return ok({resumable: !!s.run});
  }
  discardActive() {
    const s = state(this); if (blocked(s)) return fail('read-only');
    if (!['book.ready', 'stage.detail', 'run.paused'].includes(s.screen) || s.pendingSave || s.committed) return fail('exit-and-save-first');
    if (!write(s, envelope(s, null), 'discard')) return fail('save-failed');
    invalidate(s); s.run = null; s.result = null; s.screen = 'book.ready'; s.selected = null; return ok();
  }
  retrySave() {
    const s = state(this); if (blocked(s)) return fail('read-only');
    if (s.pendingSave) {
      const pending = s.pendingSave;
      if (!write(s, pending.data, pending.after)) return fail('save-failed');
      if (pending.after === 'start') {
        s.run = s.startCandidate; s.startCandidate = null; s.region = s.run.stage.region; s.selected = s.run.stage.id; s.paused = s.paused || s.hidden; s.result = null; invalidate(s); s.screen = s.paused ? 'run.paused' : 'run.ready';
      } else if (pending.after === 'intent') {
        const a = pending.data.pendingAction;
        const p = a[0] === 'swap' ? s.run.engine.planSwap(a[1], a[2]) : s.run.engine.planActivation(a[1]);
        applyIntent(s, a, p); if (s.paused || s.hidden) settleCommitted(s);
      } else if (pending.after === 'exit' || pending.after === 'discard') {
        invalidate(s); s.run = null; s.result = null; s.selected = null; s.screen = 'book.ready';
      } else if (pending.after === 'result') { s.screen = 'result.saved'; resultEvent(s); }
      else postStable(s);
      return s.pendingSave || s.screen === 'result.unsaved' ? fail('save-failed') : ok();
    }
    return finish(s) ? ok() : fail('nothing-saved');
  }
  finish() {
    const s = state(this); if (blocked(s)) return fail('read-only');
    if (s.screen === 'result.saved' && s.run?.engine.status === 'won') return publicCopy({ok: true, ...s.result, firstClear: false, duplicate: true});
    if (!finish(s)) return fail(s.screen === 'result.unsaved' ? 'save-failed' : 'not-won-or-unsettled');
    return publicCopy({ok: true, ...s.result});
  }
  claimMemento(region) {
    const s = state(this); if (blocked(s)) return fail('read-only');
    if (s.pendingSave || s.committed || s.screen === 'result.unsaved') return fail('save-run-first');
    const result = s.progress.claimRegionMemento(region);
    // Only the persisted journal owns the memento; there is no inventory mutation here.
    if (result.newlyGranted?.length) event(s, 'memento-saved', {region, ids: result.newlyGranted.map(x => x.id)});
    return publicCopy({ok: !!result.claimed, ...result});
  }
}
ChallengeController.VERSION = 1;
ChallengeController.keyForPack = id => Progress.keyForPack(id) + '-active';
module.exports = ChallengeController;
