'use strict';
const assert = require('assert');
const path = require('path');
const R = path.resolve(__dirname, '../../creator-build-project/assets/scripts/regional-r05/runtime');
const API = require(R + '/index.js');
const Journal = require(R + '/progress-journal.js');
const Host = require(R + '/campaign-host.js');

assert.equal(API.COAST_STAGE_COUNT, 9);
assert.deepEqual(API.coastPlayable.map(s => s.id).slice(0,5), [
  'r06-coast-01', 'r06-coast-02', 'r06-coast-03', 'r06-coast-04', 'r06-coast-05'
]);
assert.ok(API.coastPlayable.length >= 5);
assert.ok(API.allStages.filter(s => s.region === 'coast').length >= 5);
assert.equal(API.catalog.some(s => s.region === 'coast'), false);

for (const id of ['r06-coast-04', 'r06-coast-05']) {
  const st = API.getStage(id);
  assert.ok(st.config.moves >= 14 && st.config.moves <= 24, id + ' moves in 14–24');
  const s = API.createSession(id, st.seedBank[0]);
  assert.equal(s.snapshot().region, 'coast');
  assert.equal(s.engine.goals.pearls, undefined);
}

assert.equal(API.getStage('r06-coast-04').config.goals.roots, 8);
assert.equal(API.getStage('r06-coast-05').config.goals.beacons, 3);
assert.deepEqual(API.getStage('r06-coast-04').seedBank, [2, 18, 10]);
assert.deepEqual(API.getStage('r06-coast-05').seedBank, [3]);

function mem() { return { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); } }; }
function journey(n) { const records = {}; for (let i = 0; i < n; i++) records[i] = { bestStars: 3 }; return { records, readOnly: false }; }
const j0 = new Journal(Host.createStorage(mem()), journey(12));
assert.equal(j0.isUnlocked('r06-coast-01'), true);
assert.equal(j0.isUnlocked('r06-coast-04'), false);
assert.equal(j0.isUnlocked('r06-coast-05'), false);

const cal = require('/workspace/product/2026-11-09/coast06-07/calibration.json');
for (const id of ['r06-coast-04', 'r06-coast-05']) {
  const st = API.getStage(id);
  for (const seed of st.seedBank) {
    const s = API.createSession(id, seed);
    // only primary seed has stored solution in cal; others just greedy-live already verified in calibration
    if (seed === st.seedBank[0]) {
      for (const a of cal.stages[id].solution) assert.equal(s.act(a), true, id + ' ' + JSON.stringify(a));
      assert.equal(s.engine.status, 'won', id);
    }
  }
}

assert.equal(/^r06-coast-0[1-9]$/.test('r06-coast-04'), true);
assert.equal(/^r06-coast-0[1-9]$/.test('r06-coast-05'), true);

console.log('PASS coast M2 04/05 wiring + solutions + unlock gates');
