'use strict';
/* COAST01 book target. Not coast-dev, not a catalog row, not a 9-stage chapter. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const R = path.join(ROOT, 'creator-build-project/assets/scripts/regional-r05/runtime');
const API = require(path.join(R, 'index.js'));
const Journal = require(path.join(R, 'progress-journal.js'));
const Host = require(path.join(R, 'campaign-host.js'));
const Provider = require(path.join(R, 'board-session-provider.js'));
const { createHarness } = require('../board-ui/harness.cjs');

function mem() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}
function journey(done) {
  return { readOnly: false, records: Array.from({ length: 12 }, (_, i) => ({ bestStars: i < done ? 2 : 0 })) };
}
const SOLVE = [['swap', 15, 22], ['swap', 2, 9], ['swap', 3, 4], ['swap', 25, 26], ['swap', 18, 19]];
function drain(p) { let g = 0; while (p.snapshot().state === 'run.resolving' && g++ < 40) { const v = p.snapshot().visual; assert.equal(p.finishVisualStep(v.token).ok, true); } }

const stage = API.getStage('r06-coast-01');
assert.equal(stage.config.moves, 19);
assert.equal(stage.config.goals.type5, 18);
assert.equal(stage.legacyMoves, 26);
assert.deepEqual(stage.seedBank, [22, 9, 13]);
assert.equal(API.catalog.some((s) => s.id === 'r06-coast-01' || s.region === 'coast'), false);
assert.equal(API.coastPlayable.length, 3);

const locked = API.coastPlayerEntry({ mainlineRecords: journey(11).records, journalRecord: null });
assert.equal(locked.ok, true);
assert.equal(locked.state, 'not-a-player-entry');
assert.equal(locked.productApproved, false);
assert.equal(locked.officialGate, null);
assert.equal(locked.tappable, false);
assert.equal(locked.unlocked, false);
assert.equal(locked.enter, null);
assert.equal(locked.inCatalog, false);
assert.equal(locked.devEntry, false);
assert.equal(locked.devKey, null);
assert.equal(locked.seed, 22);
assert.equal(locked.moves, 19);
assert.equal(locked.goalType5, 18);
assert.equal(locked.registeredStages, 3);
assert.equal(locked.specChapterStages, 9);
assert.equal(locked.includeInJourneyBar, false);
assert.equal(locked.route, null);
assert.equal(locked.stamp, false);
assert.equal(locked.enterRegion, null);
assert.equal(locked.exit, 'exitLevel');
assert.equal(locked.selectionRegion, 'island');
assert.equal(locked.stageId, 'r06-coast-01');
assert.notEqual(locked.kind, 'coast-dev');

const open = API.coastPlayerEntry({ mainlineRecords: journey(12).records, journalRecord: null });
assert.equal(open.state, 'not-a-player-entry');
assert.equal(open.tappable, false);
assert.equal(open.productApproved, false);
const cleared = API.coastPlayerEntry({ mainlineRecords: journey(12).records, journalRecord: { clears: 1, bestMoves: 15 } });
assert.equal(cleared.state, 'not-a-player-entry');
assert.equal(cleared.tappable, false);
assert.equal(cleared.bestMoves, 15);
assert.equal(API.coastPlayerEntry({ mainlineRecords: [] }).state, 'not-a-player-entry');

const src = fs.readFileSync(path.join(R, 'index.js'), 'utf8');
const fn = src.slice(src.indexOf('function coastPlayerEntry'), src.indexOf('module.exports'));
assert.equal(fn.includes('coast-dev'), false);
assert.equal(fn.includes('qfPre'), false);
const keys = fs.readFileSync(path.join(ROOT, 'creator-build-project/assets/scripts/world-r2/PreTransitionKeys.ts'), 'utf8');
const at = keys.indexOf("key:'coast-dev'");
assert.ok(at > keys.lastIndexOf('/*QF_TRIAL_BEGIN*/', at) && at < keys.indexOf('/*QF_TRIAL_END*/', at));
const wnc = fs.readFileSync(path.join(ROOT, 'creator-build-project/assets/scripts/world-r2/WorldNativeComposition.ts'), 'utf8');
const sel = wnc.slice(wnc.indexOf('private selectionRegion'), wnc.indexOf('private async ensureRegion'));
assert.equal(sel.includes("'coast'"), false);

const H = createHarness();
const Core = H.load('ui/JourneyCore');
const catalogStages = API.catalog.map((s) => ({ id: s.id, region: s.region }));
const far = Core.regionRow('coast', { records: journey(12).records, stages: catalogStages, regionDone: {} });
assert.equal(far.state, 'far');
assert.equal(far.tappable, false);
const inflated = Core.regionRow('coast', { records: journey(12).records, stages: catalogStages.concat([{ id: 'r06-coast-01', region: 'coast' }]), regionDone: {} });
assert.equal(inflated.total, 1, 'display denominator follows actually listed coast rows');
assert.equal(inflated.hasData, true);
assert.notEqual(inflated.total, locked.registeredStages);
const three = Core.regionRow('coast', { records: journey(12).records, stages: catalogStages.concat(API.coastPlayable.map((s) => ({ id: s.id, region: s.region }))), regionDone: { coast: 3 } });
assert.equal(three.total, 3);
assert.equal(three.state, 'progress', '通关 still needs REGION_DEFS.stages=9 even when all registered rows are cleared');
const doneish = Core.regionRow('coast', { records: journey(12).records, stages: catalogStages.concat(API.coastPlayable.map((s) => ({ id: s.id, region: s.region }))), regionDone: { coast: 9 } });
assert.equal(doneish.state, 'done');

const a = mem(), b = mem();
const storeA = Host.createStorage(a), storeB = Host.createStorage(b);
const emptyB = new Journal(storeB, journey(12));
assert.equal(emptyB.data.records['r06-coast-01'], undefined);
const started = new Provider({ platform: storeA, journey: journey(12), stageId: 'r06-coast-01', seed: open.seed });
assert.equal(started.session.stage.id, 'r06-coast-01');
assert.equal(started.session.seed, 22);
const early = started.discardActive();
assert.equal(early.ok, true);
assert.equal(new Journal(storeA, journey(12)).data.records['r06-coast-01'], undefined, 'cancel before a win writes no clear');
assert.equal(new Journal(storeB, journey(12)).data.records['r06-coast-01'], undefined);

const again = started.startStage('r06-coast-01', { seed: 22 });
assert.equal(again.ok, true);
for (const step of SOLVE) {
  drain(started);
  if (started.snapshot().state === 'run.paused') started.resume();
  const prev = started.previewAction(step);
  assert.equal(prev.ok, true, prev.reason);
  assert.equal(started.commitAction(prev.token).ok, true);
}
drain(started);
const saved = started.snapshot();
assert.equal(saved.state, 'result.saved');
assert.equal(saved.result.outcome, 'won');
assert.equal(saved.result.firstClear, true);
assert.equal(started.session.engine.goals.type5, 0);
assert.equal(started.session.engine.moves, 14);
const ja = new Journal(storeA, journey(12));
assert.equal(ja.data.records['r06-coast-01'].clears, 1);
assert.equal(ja.data.records['r06-coast-01'].bestMoves, 14);
assert.equal(ja.claim('coast').reason, 'region-incomplete');
assert.equal(new Journal(storeB, journey(12)).data.records['r06-coast-01'], undefined, 'the other storage is unchanged');
assert.equal(started.requestExit().ok, true);
assert.equal(started.discardActive().ok, true);
const re = started.startStage('r06-coast-01', { seed: 22 });
assert.equal(re.ok, true);
assert.equal(started.session.engine.status, 'playing');
assert.equal(started.session.engine.moves, 19);
assert.equal(started.session.engine.goals.type5, 18);
assert.equal(new Journal(storeA, journey(12)).data.records['r06-coast-01'].clears, 1);
const after = API.coastPlayerEntry({ mainlineRecords: journey(12).records, journalRecord: ja.data.records['r06-coast-01'] });
assert.equal(after.state, 'not-a-player-entry');
assert.equal(after.tappable, false);
assert.equal(after.seed, 22);

console.log('coast-book-entry: PASS', JSON.stringify({
  layer: 'Provider seed 22 replay is the lower layer only; it does not press a book button',
  stageId: open.stageId, seed: open.seed, moves: open.moves, goalType5: open.goalType5,
  productApproved: false, tappable: false, journeyRow: far.state, specChapterStages: inflated.total,
}));
