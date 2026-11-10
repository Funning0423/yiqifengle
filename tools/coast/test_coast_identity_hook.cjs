'use strict';
/* Candidate: selectionRegion does not return coast. TEST_TREE: the unapplied identity proposal does, and it does not travel. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHarness } = require('../board-ui/harness.cjs');
const H = createHarness();
const source = fs.readFileSync(path.join(H.SCRIPTS, 'world-r2/WorldNativeComposition.ts'), 'utf8');
const sel = source.slice(source.indexOf('private selectionRegion'), source.indexOf('private async ensureRegion'));
if (!sel.includes("return 'coast'")) {
  assert.equal(source.includes('coast-route-not-a-region-journey'), false);
  console.log(JSON.stringify({ status: 'PASS', tree: 'candidate', identityHook: false }));
  process.exit(0);
}
(async () => {
  const C = H.load('world-r2/WorldNativeComposition').WorldNativeComposition;
  const c = Object.create(C.prototype);
  c.selection = { provider: 'r5', stageId: 'r06-coast-01', seed: 22 };
  c.pendingJourneySelection = { provider: 'r5', stageId: 'r06-coast-01', seed: 22 };
  const calls = [];
  c.world = { commands: () => ({ snapshot: () => ({ state: 'lakeside', journey: { region: 'lakeside', target: null } }), travelRegion: async (target) => { calls.push(['travel', target]); return { ok: true }; }, enterLevel: async (id) => { calls.push(['enter', id]); return { ok: true }; }, resume: () => ({ ok: true }) }) };
  const rejected = await c.enterSelectedLevel();
  assert.equal(rejected.reason, 'coast-route-not-a-region-journey');
  assert.equal(c.pendingJourneySelection, null);
  assert.deepEqual(calls, []);
  const resumed = await c.resumeJourney();
  assert.equal(resumed.ok, true);
  assert.deepEqual(calls, [], 'resumeJourney does not retry coast');
  console.log(JSON.stringify({ status: 'PASS', tree: 'TEST_TREE', identityHook: true, notCandidate: true, reason: rejected.reason, pending: null }));
})().catch((error) => { console.error(error); process.exit(1); });
