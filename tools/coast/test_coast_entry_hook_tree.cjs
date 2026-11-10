'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHarness } = require('../board-ui/harness.cjs');
const H = createHarness();
const source = fs.readFileSync(path.join(H.SCRIPTS, 'world-r2/WorldNativeComposition.ts'), 'utf8');
const flowSource = fs.readFileSync(path.join(H.SCRIPTS, 'world-r1/WorldFlowCore.ts'), 'utf8');
const backgroundSource = fs.readFileSync(path.join(H.SCRIPTS, 'world-r2/LevelBackground.ts'), 'utf8');
const patched = source.includes('if(!decision.allowStart)') && flowSource.includes("name==='CoastEntryRejected'") && backgroundSource.includes("name==='CoastEntryRejected'");
if (!patched) {
  assert.equal(source.includes('if(!decision.allowStart)'), false);
  console.log(JSON.stringify({ status: 'PASS', tree: 'candidate', hookApplied: false, note: 'pendingJourneySelection / allowStart / CoastEntryRejected.reason stay in the unapplied proposal' }));
  process.exit(0);
}
(async () => {
  const C = H.load('world-r2/WorldNativeComposition').WorldNativeComposition;
  const c = Object.create(C.prototype);
  c.selection = { provider: 'r5', stageId: 'r06-coast-01', seed: 22 };
  c.pendingJourneySelection = { provider: 'r5', stageId: 'r06-coast-01', seed: 22 };
  const calls = [];
  c.world = { commands: () => ({ snapshot: () => ({ state: 'meadow', journey: { region: 'meadow', target: null } }), enterLevel: async () => { calls.push('enter'); return { ok: true }; }, resume: () => ({ ok: true }) }) };
  const rejected = await c.enterSelectedLevel();
  assert.equal(rejected.reason, 'return-route-not-yet-available');
  assert.equal(c.pendingJourneySelection, null);
  assert.deepEqual(calls, []);
  const resumed = await c.resumeJourney();
  assert.equal(resumed.ok, true);
  assert.deepEqual(calls, [], 'resumeJourney does not re-enter coast after the pending selection is cleared');
  c.selection = { provider: 'r5', stageId: 'r06-coast-01', seed: 22 };
  c.pendingJourneySelection = { ...c.selection };
  c.world = { commands: () => ({ snapshot: () => ({ state: 'island', journey: { region: 'island', target: null } }), enterLevel: async () => { calls.push('start'); return { ok: true }; }, resume: () => ({ ok: true }) }) };
  const island = await c.enterSelectedLevel();
  assert.equal(island.reason, 'await-resource-gate');
  assert.equal(island.ok, false);
  assert.equal(c.pendingJourneySelection, null);
  assert.deepEqual(calls, [], 'allowStart false does not call enterLevel');
  const mem = new Map();
  const bytes = () => JSON.stringify([...mem]);
  const Pieces = H.load('ui/CoastBoardPieces');
  const { createNativeWorldLevelAdapter } = H.load('world-r2/NativeWorldLevelAdapter');
  const { WorldFlow } = H.load('world-r1/WorldFlowCore');
  const { LevelBackgroundBinding } = H.load('world-r2/LevelBackground');
  const adapter = createNativeWorldLevelAdapter({
    uiParent: H.cc._scene,
    select: (id) => ({ provider: 'r5', stageId: id, seed: 22 }),
    fixture: {},
    navigation: { exit: () => ({ ok: true }), resume: () => undefined },
    r5Persistence: { platform: { load: (k) => mem.get(k) || null, save: (k, v) => { mem.set(k, String(v)); return true; }, _m: mem }, journey: { readOnly: false, records: [] }, inspect: () => [...mem] },
    background: Pieces.createCoastBoardBackground,
  });
  const flow = new WorldFlow({ config: { cameraIsland: {}, door: { openDeg: 90 } }, levels: adapter, loadWorld: () => Promise.reject(Error('not used')) });
  flow.world = { playEnterLevel: () => Promise.resolve(), cancelTransient() {}, setDoor() {}, setCamera() {}, setLayers() {}, assertStaticWorld() {} };
  flow.stable = 'island'; flow.state = 'island';
  const saved = bytes();
  const failed = await flow.enterLevel('r06-coast-01');
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, 'coast-resources-unavailable');
  assert.equal(flow.snapshot().error, 'coast-resources-unavailable');
  assert.equal(flow.snapshot().state, 'island');
  assert.equal(flow.snapshot().stable, 'island');
  assert.equal(bytes(), saved);
  const binding = new LevelBackgroundBinding(Object.freeze({ provider: 'r5', stageId: 'r06-coast-01', seed: 22 }));
  const parent = new H.cc.Node('host');
  const token = { cancelled: false, check() {}, wait: (p) => p, onCancel() { return () => {}; } };
  await assert.rejects(binding.load(Pieces.createCoastBoardBackground, parent, token), (error) => error && error.reason === 'coast-resources-unavailable');
  assert.equal(binding.diagnostics().error, 'coast-resources-unavailable');
  binding.dispose();
  flow.world.playEnterLevel = (token) => { token.cancel(); return Promise.resolve(); };
  const cancelled = await flow.enterLevel('r06-coast-01');
  assert.equal(cancelled.reason, 'cancelled');
  assert.equal(flow.snapshot().state, 'island');
  assert.equal(flow.snapshot().stable, 'island');
  assert.equal(bytes(), saved);
  assert.equal(H.cc._scene.find('ManagedNativeBoardHost'), null);
  const again = await flow.enterLevel('r06-coast-01');
  assert.equal(again.reason, 'cancelled');
  assert.equal(flow.snapshot().stable, 'island');
  assert.equal(bytes(), saved);
  console.log(JSON.stringify({ status: 'PASS', tree: 'TEST_TREE', hookApplied: true, notCandidate: true, reason: failed.reason, cancelReason: cancelled.reason, stable: flow.snapshot().stable, saveUnchanged: true, mocked: 'WorldFlow.world camera/door doubles; enterSelectedLevel world.commands double; harness cc has no GLB importer and no wx' }));
})().catch((error) => { console.error(error); process.exit(1); });
