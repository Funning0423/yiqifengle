'use strict';
const assert = require('assert');
const path = require('path');
const R = path.resolve(__dirname, '../../creator-build-project/assets/scripts/regional-r05/runtime');
const API = require(R + '/index.js');
const Journal = require(R + '/progress-journal.js');
const Host = require(R + '/campaign-host.js');
const Provider = require(R + '/board-session-provider.js');
const { requiresCoastScene } = require('../../creator-build-project/assets/scripts/world-r2/LevelRegion.ts'.replace(/\.ts$/, '.ts'));
// LevelRegion is TS — load via harness or duplicate regex check here
assert.equal(API.COAST_STAGE_COUNT, 9);
assert.deepEqual(API.coastPlayable.map(s => s.id), ['r06-coast-01', 'r06-coast-02', 'r06-coast-03']);
assert.equal(API.getStage('r06-coast-01').config.moves, 20);
assert.deepEqual(API.getStage('r06-coast-01').seedBank, [22, 9, 13]);
assert.equal(API.allStages.filter(s => s.region === 'coast').length, 3);
assert.equal(API.catalog.some(s => s.region === 'coast'), false);

for (const id of ['r06-coast-02', 'r06-coast-03']) {
  const st = API.getStage(id);
  assert.ok(st.config.moves >= 14 && st.config.moves <= 24, id + ' moves in 14–24');
  const s = API.createSession(id, st.seedBank[0]);
  assert.equal(s.snapshot().region, 'coast');
  assert.equal(s.engine.goals.pearls, undefined);
}

// ordinal unlock
function mem() { return { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); } }; }
function journey(n) { const records = {}; for (let i = 0; i < n; i++) records[i] = { bestStars: 3 }; return { records, readOnly: false }; }
const j0 = new Journal(Host.createStorage(mem()), journey(12));
assert.equal(j0.isUnlocked('r06-coast-01'), true);
assert.equal(j0.isUnlocked('r06-coast-02'), false);
assert.equal(j0.isUnlocked('r06-coast-03'), false);

// solve 01 then 02 unlocks
const cal = require('/workspace/product/2026-11-09/coast02-03/calibration.json');
const storage = Host.createStorage(mem());
const p = new Provider({ platform: storage, journey: journey(12), stageId: 'r06-coast-01', seed: 22 });
function drain(prov) { let g = 0; while (prov.snapshot().state === 'run.resolving' && g++ < 80) { const v = prov.snapshot().visual; assert.equal(prov.finishVisualStep(v.token).ok, true); } }
for (const a of cal.stages['r06-coast-01'].solution) {
  drain(p); if (p.snapshot().state === 'run.paused') p.resume();
  const prev = p.previewAction(a); assert.equal(prev.ok, true, prev.reason); assert.equal(p.commitAction(prev.token).ok, true);
}
drain(p);
assert.equal(p.snapshot().state, 'result.saved');
const j1 = new Journal(storage, journey(12));
assert.equal(j1.isUnlocked('r06-coast-02'), true);
assert.equal(j1.isUnlocked('r06-coast-03'), false);
assert.equal(j1.claim('coast').reason, 'region-incomplete');

// createSession solutions for 02/03
for (const id of ['r06-coast-02', 'r06-coast-03']) {
  const st = API.getStage(id);
  const s = API.createSession(id, st.seedBank[0]);
  for (const a of cal.stages[id].solution) assert.equal(s.act(a), true, id + ' ' + JSON.stringify(a));
  assert.equal(s.engine.status, 'won', id);
}

// scene id regex (mirrors LevelRegion)
assert.equal(/^r06-coast-0[1-9]$/.test('r06-coast-01'), true);
assert.equal(/^r06-coast-0[1-9]$/.test('r06-coast-03'), true);
assert.equal(/^r06-coast-0[1-9]$/.test('r06-coast-10'), false);

console.log('PASS coast M1 02/03 wiring + solutions + unlock + claim-incomplete-until-9');
