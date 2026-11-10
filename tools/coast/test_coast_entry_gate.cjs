'use strict';
/* Safety gate in front of any coast provider. Not a book button and not a Creator frame. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHarness } = require('../board-ui/harness.cjs');

function save() { return 'SAVE-BYTES-v1'; }
(async () => {
  const H = createHarness();
  const Pieces = H.load('ui/CoastBoardPieces');
  const adapter = fs.readFileSync(path.join(H.SCRIPTS, 'world-r2/NativeWorldLevelAdapter.ts'), 'utf8');
  const loadAt = adapter.indexOf('background.load(');
  const sessionAt = adapter.indexOf('createManagedBoardSession(');
  assert.ok(loadAt > 0 && sessionAt > loadAt, 'the real adapter loads the background before it constructs a session');
  let starts = 0;
  const blocked = await Pieces.orchestrateCoastEntry({
    origin: 'meadow', formalRelease: false, stageId: 'r06-coast-01', saveBytes: save,
    mount: async () => { throw new Error('mount must not run from meadow'); },
    startProvider: () => { starts++; },
  });
  assert.equal(blocked.reason, 'return-route-not-yet-available');
  assert.equal(blocked.started, false);
  assert.equal(starts, 0);
  for (const origin of ['skycity', 'lakeside']) {
    const row = Pieces.decideCoastEntry({ origin, formalRelease: false, stageId: 'r06-coast-01' });
    assert.equal(row.probe, false);
    assert.equal(row.reason, 'return-route-not-yet-available');
  }
  const release = await Pieces.orchestrateCoastEntry({
    origin: 'island', formalRelease: true, stageId: 'r06-coast-01', saveBytes: save,
    mount: async () => { throw new Error('formal release must not mount'); },
    startProvider: () => { starts++; },
  });
  assert.equal(release.reason, 'formal-release-unreachable');
  assert.equal(starts, 0);
  const islandDecision = Pieces.decideCoastEntry({ origin: 'island', formalRelease: false, stageId: 'r06-coast-01' });
  assert.equal(islandDecision.probe, true);
  assert.equal(islandDecision.allowStart, false);
  const gateFn = String(Pieces.orchestrateCoastEntry);
  const allowAt = gateFn.indexOf('!decision.allowStart');
  const startAt = gateFn.indexOf('startProvider()');
  assert.ok(allowAt > 0 && startAt > allowAt, 'allowStart false is checked before startProvider');
  const contract = await Pieces.orchestrateCoastEntry({
    origin: 'home', formalRelease: false, stageId: 'r06-coast-01', saveBytes: save,
    mount: async () => ({ typesAccepted: true, engineEvidence: 'unavailable', runtimeReady: false, dispose() {} }),
    startProvider: () => { starts++; },
  });
  assert.equal(contract.reason, 'await-resource-gate');
  assert.equal(contract.runtimeEvidence, 'unavailable');
  assert.equal(starts, 0);
  const forged = await Pieces.orchestrateCoastEntry({
    origin: 'island', formalRelease: false, stageId: 'r06-coast-01', saveBytes: save,
    mount: async () => ({ typesAccepted: true, engineEvidence: 'ready', runtimeReady: true, dispose() {} }),
    startProvider: () => { starts++; },
  });
  assert.equal(forged.reason, 'coast-runtime-evidence-untrusted');
  assert.equal(starts, 0);
  let bytes = 'journal-a';
  const mutated = Pieces.orchestrateCoastEntry({
    origin: 'island', formalRelease: false, stageId: 'r06-coast-01', saveBytes: () => bytes,
    mount: async () => { bytes += '-mutated'; throw new Pieces.CoastEntryRejected('coast-resources-unavailable', 'failed after a write'); },
    startProvider: () => { starts++; },
  });
  await assert.rejects(mutated, (e) => e instanceof Pieces.CoastEntryRejected && e.reason === 'save-mutated');
  assert.equal(starts, 0);
  bytes = 'journal-a';
  const gateSrc = fs.readFileSync(path.join(H.SCRIPTS, 'ui/CoastBoardPieces.ts'), 'utf8');
  const body = gateSrc.slice(gateSrc.indexOf('export function decideCoastEntry'), gateSrc.indexOf('export async function orchestrateCoastEntry'));
  assert.equal(body.includes('coast-dev'), false);
  assert.equal(body.includes('QF_TRIAL'), false);
  const keys = fs.readFileSync(path.join(H.SCRIPTS, 'world-r2/PreTransitionKeys.ts'), 'utf8');
  const at = keys.indexOf("key:'coast-dev'");
  assert.ok(at > keys.lastIndexOf('/*QF_TRIAL_BEGIN*/', at) && at < keys.indexOf('/*QF_TRIAL_END*/', at));
  const os = require('node:os'), cp = require('node:child_process');
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coast-strip-'));
  const dest = path.join(stageDir, 'assets/scripts/world-r2');
  fs.mkdirSync(dest, { recursive: true });
  for (const name of ['PreTransitionKeys.ts', 'PreTransitionRun.ts', 'QaSkip.ts']) fs.copyFileSync(path.join(H.SCRIPTS, 'world-r2', name), path.join(dest, name));
  const keep = cp.spawnSync(process.execPath, [path.join(H.ROOT, 'tools/build-guard/strip-probes.cjs'), '--stage', stageDir], { encoding: 'utf8' });
  assert.equal(keep.status, 0, keep.stdout + keep.stderr);
  assert.equal(fs.readFileSync(path.join(dest, 'PreTransitionKeys.ts'), 'utf8').includes('coast-dev'), true, 'without --formal the experimental entry remains');
  const formal = cp.spawnSync(process.execPath, [path.join(H.ROOT, 'tools/build-guard/strip-probes.cjs'), '--stage', stageDir, '--formal'], { encoding: 'utf8' });
  assert.equal(formal.status, 0, formal.stdout + formal.stderr);
  const stripped = fs.readFileSync(path.join(dest, 'PreTransitionKeys.ts'), 'utf8');
  const strippedRun = fs.readFileSync(path.join(dest, 'PreTransitionRun.ts'), 'utf8');
  assert.equal(stripped.includes('coast-dev'), false);
  assert.equal(strippedRun.includes("enterRegion('coast')"), false);
  assert.equal(Pieces.decideCoastEntry({ origin: 'island', formalRelease: true, stageId: 'r06-coast-01' }).reason, 'formal-release-unreachable');
  fs.rmSync(stageDir, { recursive: true, force: true });
  const mem = new Map();
  const saveBytes = () => JSON.stringify([...mem]);
  const { createNativeWorldLevelAdapter } = H.load('world-r2/NativeWorldLevelAdapter');
  const { WorldFlow } = H.load('world-r1/WorldFlowCore');
  const flowAdapter = createNativeWorldLevelAdapter({
    uiParent: H.cc._scene,
    select: (id) => ({ provider: 'r5', stageId: id, seed: 22 }),
    fixture: {},
    navigation: { exit: () => ({ ok: true }), resume: () => undefined },
    r5Persistence: { platform: { load: (k) => mem.get(k) || null, save: (k, v) => { mem.set(k, String(v)); return true; }, _m: mem }, journey: { readOnly: false, records: [] }, inspect: () => [...mem] },
    background: Pieces.createCoastBoardBackground,
  });
  const flow = new WorldFlow({ config: { cameraIsland: {}, door: { openDeg: 90 } }, levels: flowAdapter, loadWorld: () => Promise.reject(Error('not used')) });
  flow.world = { playEnterLevel: () => Promise.resolve(), cancelTransient() {}, setDoor() {}, setCamera() {}, setLayers() {}, assertStaticWorld() {} };
  flow.stable = 'island'; flow.state = 'island';
  const saved = saveBytes();
  const first = await flow.enterLevel('r06-coast-01');
  assert.equal(first.ok, false);
  assert.equal(flow.snapshot().state, 'island');
  assert.equal(flow.snapshot().stable, 'island');
  assert.equal(saveBytes(), saved);
  assert.equal(H.cc._scene.find('ManagedNativeBoardHost'), null);
  const second = await flow.enterLevel('r06-coast-01');
  assert.equal(second.ok, false);
  assert.equal(flow.snapshot().state, 'island');
  assert.equal(flow.snapshot().stable, 'island');
  assert.equal(saveBytes(), saved);
  assert.ok(String(first.reason).includes('coast-resources-unavailable'));
  assert.notEqual(first.reason, 'coast-resources-unavailable');
  console.log('coast-entry-gate: PASS', JSON.stringify({
    starts, candidateFlowReason: first.reason, stable: flow.snapshot().stable, saveUnchanged: true,
    mocked: 'WorldFlow.world camera/door doubles only; adapter, operate, and coast background are production methods',
    lowerLayerNotUsed: 'Provider seed 22 replay is not this test',
  }));
})().catch((e) => { console.error(e); process.exit(1); });
