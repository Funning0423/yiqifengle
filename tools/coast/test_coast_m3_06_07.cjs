'use strict';
const assert = require('assert');
const path = require('path');
const R = path.resolve(__dirname, '../../creator-build-project/assets/scripts/regional-r05/runtime');
const API = require(R + '/index.js');
const Journal = require(R + '/progress-journal.js');
const Host = require(R + '/campaign-host.js');

assert.equal(API.COAST_STAGE_COUNT, 9);
assert.deepEqual(API.coastPlayable.map(s => s.id).slice(0,7), [
  'r06-coast-01','r06-coast-02','r06-coast-03','r06-coast-04','r06-coast-05','r06-coast-06','r06-coast-07'
]);
assert.ok(API.coastPlayable.length >= 7);
assert.ok(API.allStages.filter(s => s.region === 'coast').length >= 7);
assert.equal(API.catalog.some(s => s.region === 'coast'), false);

for (const id of ['r06-coast-06','r06-coast-07']) {
  const st = API.getStage(id);
  assert.ok(st.config.moves >= 14 && st.config.moves <= 24, id + ' moves');
  assert.equal(st.seedBank.length, 1, id + ' one seed');
  const s = API.createSession(id, st.seedBank[0]);
  assert.equal(s.snapshot().region, 'coast');
  assert.equal(s.engine.goals.pearls, undefined);
}

assert.equal(API.getStage('r06-coast-06').config.goals.roots, 5);
assert.equal(API.getStage('r06-coast-06').config.goals.lines, 1);
assert.deepEqual(API.getStage('r06-coast-06').config.beacons, []);
assert.deepEqual(API.getStage('r06-coast-06').config.moss, []);
assert.equal(API.getStage('r06-coast-07').config.goals.beacons, 2);
assert.deepEqual(API.getStage('r06-coast-06').seedBank, [11]);
assert.deepEqual(API.getStage('r06-coast-07').seedBank, [7]);

function mem() { return { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); } }; }
function journey(n) { const records = {}; for (let i = 0; i < n; i++) records[i] = { bestStars: 3 }; return { records, readOnly: false }; }
const j0 = new Journal(Host.createStorage(mem()), journey(12));
assert.equal(j0.isUnlocked('r06-coast-01'), true);
assert.equal(j0.isUnlocked('r06-coast-06'), false);
assert.equal(j0.isUnlocked('r06-coast-07'), false);

const cal = require('/workspace/product/2026-11-09/coast06-07/calibration.json');
for (const id of ['r06-coast-06','r06-coast-07']) {
  const st = API.getStage(id);
  const s = API.createSession(id, st.seedBank[0]);
  for (const a of cal.stages[id].solution) assert.equal(s.act(a), true, id + ' ' + JSON.stringify(a));
  assert.equal(s.engine.status, 'won', id);
}

assert.equal(/^r06-coast-0[1-9]$/.test('r06-coast-06'), true);
assert.equal(/^r06-coast-0[1-9]$/.test('r06-coast-07'), true);
console.log('PASS coast M3 06/07 wiring + solutions + unlock gates');
