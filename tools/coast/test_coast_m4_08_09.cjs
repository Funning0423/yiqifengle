'use strict';
const assert = require('assert');
const path = require('path');
const R = path.resolve(__dirname, '../../creator-build-project/assets/scripts/regional-r05/runtime');
const API = require(R + '/index.js');
const Journal = require(R + '/progress-journal.js');
const Host = require(R + '/campaign-host.js');
const Provider = require(R + '/board-session-provider.js');
const { createHarness } = require('../board-ui/harness.cjs');

assert.equal(API.COAST_STAGE_COUNT, 9);
assert.deepEqual(API.coastPlayable.map(s => s.id), [
  'r06-coast-01','r06-coast-02','r06-coast-03','r06-coast-04','r06-coast-05',
  'r06-coast-06','r06-coast-07','r06-coast-08','r06-coast-09'
]);
assert.equal(API.allStages.filter(s => s.region === 'coast').length, 9);
assert.equal(API.catalog.some(s => s.region === 'coast'), false);

for (const id of ['r06-coast-08','r06-coast-09']) {
  const st = API.getStage(id);
  assert.ok(st.config.moves >= 14 && st.config.moves <= 24, id + ' moves');
  assert.equal(st.seedBank.length, 1, id + ' one seed');
  const s = API.createSession(id, st.seedBank[0]);
  assert.equal(s.snapshot().region, 'coast');
  assert.equal(s.engine.goals.pearls, undefined);
}

assert.equal(API.getStage('r06-coast-08').config.goals.roots, 4);
assert.equal(API.getStage('r06-coast-08').config.goals.beacons, 2);
assert.deepEqual(API.getStage('r06-coast-08').config.moss, []);
assert.equal(API.getStage('r06-coast-09').config.goals.moss, 3);
assert.equal(API.getStage('r06-coast-09').config.goals.roots, 3);
assert.deepEqual(API.getStage('r06-coast-08').seedBank, [2]);
assert.deepEqual(API.getStage('r06-coast-09').seedBank, [23]);

function mem() { return { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); } }; }
function journey(n) { const records = {}; for (let i = 0; i < n; i++) records[i] = { bestStars: 3 }; return { records, readOnly: false }; }
const j0 = new Journal(Host.createStorage(mem()), journey(12));
assert.equal(j0.isUnlocked('r06-coast-01'), true);
assert.equal(j0.isUnlocked('r06-coast-08'), false);
assert.equal(j0.isUnlocked('r06-coast-09'), false);
assert.equal(j0.claim('coast').reason, 'region-incomplete');

const cal = require('/workspace/product/2026-11-09/coast08-09/calibration.json');
for (const id of ['r06-coast-08','r06-coast-09']) {
  const st = API.getStage(id);
  const s = API.createSession(id, st.seedBank[0]);
  for (const a of cal.stages[id].solution) assert.equal(s.act(a), true, id + ' ' + JSON.stringify(a));
  assert.equal(s.engine.status, 'won', id);
}

function drain(p) { let g = 0; while (p.snapshot().state === 'run.resolving' && g++ < 80) { const v = p.snapshot().visual; assert.equal(p.finishVisualStep(v.token).ok, true); } }
function play(storage, id) {
  const st = API.getStage(id);
  const p = new Provider({ platform: storage, journey: journey(12), stageId: id, seed: st.seedBank[0] });
  for (const a of cal.stages[id].solution) {
    drain(p); if (p.snapshot().state === 'run.paused') p.resume();
    const prev = p.previewAction(a); assert.equal(prev.ok, true, id + ' ' + (prev.reason || JSON.stringify(a)));
    assert.equal(p.commitAction(prev.token).ok, true);
  }
  drain(p);
  assert.equal(p.snapshot().state, 'result.saved', id);
  p.requestExit();
}

const storage = Host.createStorage(mem());
for (const st of API.coastPlayable) {
  const j = new Journal(storage, journey(12));
  if (st.ordinal < 9) assert.equal(j.claim('coast').reason, 'region-incomplete', 'claim blocked before ' + st.id);
  play(storage, st.id);
  const after = new Journal(storage, journey(12));
  assert.ok(after.data.records[st.id], st.id + ' recorded');
  if (st.ordinal < 9) {
    const next = API.coastPlayable.find(s => s.ordinal === st.ordinal + 1);
    assert.equal(after.isUnlocked(next.id), true, next.id + ' unlocks after ' + st.id);
    assert.equal(after.claim('coast').reason, 'region-incomplete', 'still incomplete after ' + st.id);
  }
}
const complete = new Journal(storage, journey(12));
assert.equal(Object.keys(complete.data.records).filter(id => id.startsWith('r06-coast-')).length, 9);
const claimed = complete.claim('coast');
assert.equal(claimed.ok, true, 'claim after COAST09');
assert.equal(claimed.claimed, true);
assert.equal(claimed.duplicate, false);
assert.deepEqual(complete.data.claimedRegions, ['coast']);
const again = complete.claim('coast');
assert.equal(again.ok, true);
assert.equal(again.duplicate, true);

const H = createHarness();
const Core = H.load('ui/JourneyCore');
const catalogStages = API.catalog.map((s) => ({ id: s.id, region: s.region }));
const allCoast = catalogStages.concat(API.coastPlayable.map((s) => ({ id: s.id, region: s.region })));
const row = Core.regionRow('coast', { records: journey(12).records, stages: allCoast, regionDone: { coast: 9 } });
assert.equal(row.total, 9);
assert.equal(row.done, 9);
assert.equal(row.state, 'done', 'journal/journey show 9/9 after COAST09');

console.log('PASS coast M4 08/09 wiring + solutions + unlock + 9/9 claim');
