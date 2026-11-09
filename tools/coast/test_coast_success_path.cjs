'use strict';
/* Dev teleport success path. Production coast background stays fail-closed.
 * The board session is the real adapter session. The scene port is an explicit labeled mock.
 * Camera commands are doubles, not a Creator frame. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { createHarness } = require('../board-ui/harness.cjs');
const ROOT = path.resolve(__dirname, '../..');
const R = path.join(ROOT, 'creator-build-project/assets/scripts/regional-r05/runtime');
const Host = require(path.join(R, 'campaign-host.js'));
const Journal = require(path.join(R, 'progress-journal.js'));
const SOLVE = [['swap', 15, 22], ['swap', 2, 9], ['swap', 3, 4], ['swap', 25, 26], ['swap', 18, 19]];
const ORIGINS = ['island', 'meadow', 'skycity', 'lakeside'];
const CAM = {
  island: { position: [-12, 15.5, 48], fovVerticalDeg: 42 },
  meadow: { position: [1, 2, 3], fovVerticalDeg: 40 },
  skycity: { position: [4, 8, 12], fovVerticalDeg: 38 },
  lakeside: { position: [6, 1, 9], fovVerticalDeg: 36 },
};
function mem() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}
function journey(done) {
  return { readOnly: false, records: Array.from({ length: 12 }, (_, i) => ({ bestStars: i < done ? 2 : 0 })) };
}
function drain(controller) {
  let g = 0;
  while (controller.snapshot().state === 'run.resolving' && g++ < 40) {
    const visual = controller.snapshot().visual;
    assert.equal(controller.finishVisualStep(visual.token).ok, true);
  }
}
function labeledMock() {
  return {
    label: 'labeled-mock',
    engineLoaded: false,
    engineEvidence: 'unavailable',
    frame() {},
    setVisible() {},
    setPaused() {},
    dispose() {},
    diagnostics() { return { label: 'labeled-mock', engineLoaded: false, engineEvidence: 'unavailable' }; },
  };
}
(async () => {
  const H = createHarness();
  const Pieces = H.load('ui/CoastBoardPieces');
  const loader = fs.readFileSync(path.join(H.SCRIPTS, 'ui/CoastSceneLoader.ts'), 'utf8');
  assert.equal(loader.includes('engineLoaded: false'), true);
  assert.equal(loader.includes('engineLoaded: true'), false);
  const gate = fs.readFileSync(path.join(H.SCRIPTS, 'ui/CoastBoardPieces.ts'), 'utf8');
  const devAt = gate.indexOf('export async function coastDevTeleport');
  assert.ok(devAt > gate.lastIndexOf('/*QF_TRIAL_BEGIN*/', devAt) && devAt < gate.indexOf('/*QF_TRIAL_END*/', devAt));
  assert.equal(Pieces.coastRegionIdentity('r06-coast-01'), 'coast');
  assert.equal(Pieces.decideCoastEntry({ origin: 'island', formalRelease: false, stageId: 'r06-coast-01' }).allowStart, false);
  const wnc = fs.readFileSync(path.join(H.SCRIPTS, 'world-r2/WorldNativeComposition.ts'), 'utf8');
  const sel = wnc.slice(wnc.indexOf('private selectionRegion'), wnc.indexOf('private async ensureRegion'));
  assert.equal(sel.includes("'coast'"), false, 'candidate selectionRegion still has no coast identity; that change is the unapplied proposal');
  const dummyWorld = {
    camera: () => CAM.island,
    setCamera() {},
    cancelTransient() {},
    setDoor() {},
    setLayers() {},
    assertStaticWorld() {},
  };
  const closedFlow = { state: 'island', stable: 'island', enterLevel() { throw new Error('production must not enter'); }, exitLevel() { return { ok: true }; }, snapshot() { return { state: 'island', stable: 'island' }; } };
  const closed = await Pieces.coastDevTeleport({ origin: 'island', formalRelease: false, port: 'production', flow: closedFlow, world: dummyWorld, door: 90, layers: 'ISLAND' });
  assert.equal(closed.reason, 'production-entry-closed');
  const formal = await Pieces.coastDevTeleport({ origin: 'island', formalRelease: true, port: 'labeled-mock', flow: closedFlow, world: dummyWorld, door: 90, layers: 'ISLAND' });
  assert.equal(formal.reason, 'formal-release-unreachable');
  const releaseHost = { wx: { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release' } }) } };
  const gated = await Pieces.coastDevTeleport({ origin: 'meadow', formalRelease: false, host: releaseHost, port: 'labeled-mock', flow: closedFlow, world: dummyWorld, door: 90, layers: 'ISLAND' });
  assert.equal(gated.reason, 'formal-release-unreachable');
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coast-dev-strip-'));
  const dest = path.join(stageDir, 'assets/scripts/ui');
  fs.mkdirSync(dest, { recursive: true });
  fs.copyFileSync(path.join(H.SCRIPTS, 'ui/CoastBoardPieces.ts'), path.join(dest, 'CoastBoardPieces.ts'));
  const keep = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools/build-guard/strip-probes.cjs'), '--stage', stageDir], { encoding: 'utf8' });
  assert.equal(keep.status, 0, keep.stdout + keep.stderr);
  assert.equal(fs.readFileSync(path.join(dest, 'CoastBoardPieces.ts'), 'utf8').includes('coastDevTeleport'), true);
  const formalStrip = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools/build-guard/strip-probes.cjs'), '--stage', stageDir, '--formal'], { encoding: 'utf8' });
  assert.equal(formalStrip.status, 0, formalStrip.stdout + formalStrip.stderr);
  const stripped = fs.readFileSync(path.join(dest, 'CoastBoardPieces.ts'), 'utf8');
  assert.equal(stripped.includes('coastDevTeleport'), false);
  assert.equal(stripped.includes('QF_TRIAL'), false);
  assert.equal(stripped.includes('coastRegionIdentity'), true);
  assert.equal(stripped.includes('allowStart: false'), true);
  const ts = require(process.env.QF_TYPESCRIPT_MODULE || 'typescript');
  assert.equal(typeof ts.transpileModule(stripped, { compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS } }).outputText, 'string');
  fs.rmSync(stageDir, { recursive: true, force: true });

  const zero = [0, 0, 0];
  const seat = { position: zero, back: [0, 0, -1], yawRad: 0, seatedFoot: zero, standingFoot: zero, seatedControllerRoot: zero, standingControllerRoot: zero };
  const actor = { calibrated: true, coordinates: { units: 'm', up: '+Y', forward: '+Z', rootMotion: 'controller-only', standingRoot: zero, seatedRoot: zero, seatYawRad: 0, clearanceRadiusM: 0.1 }, advance() {}, perform: async () => {}, cancelAndReset() {}, setVisible() {}, dispose() {} };
  const config = { seat, toDoor: [zero, [0, 0, 1]], outCrossing: [[0, 0, 1], [0, 0, 2]], toIsland: [[0, 0, 2], [0, 0, 3]], toThreshold: [[0, 0, 3], [0, 0, 2]], inCrossing: [[0, 0, 2], [0, 0, 1]], toSeat: [[0, 0, 1], zero], cameraHome: CAM.island, cameraIsland: CAM.island, door: { openDeg: 90 }, openDeg: 90, speed: 1 };
  const other = mem();
  const untouched = Host.createPersistence(other, journey(12));
  const rows = [];
  async function open(origin, background, playEnterLevel) {
    const box = mem();
    const persistence = Host.createPersistence(box, journey(12));
    const cameras = [];
    let pose = CAM[origin];
    const world = {
      label: 'world-port-double',
      visualProof: false,
      camera: () => pose,
      setCamera(p) { pose = p; cameras.push(p); },
      setDoor() {},
      setLayers() {},
      cancelTransient() {},
      assertStaticWorld() {},
      playEnterLevel,
    };
    const tokens = [];
    const wrappedPlay = (token) => { tokens.push(token); return playEnterLevel(token); };
    world.playEnterLevel = wrappedPlay;
    let session = null;
    const { createNativeWorldLevelAdapter } = H.load('world-r2/NativeWorldLevelAdapter');
    const { WorldFlow } = H.load('world-r1/WorldFlowCore');
    const adapter = createNativeWorldLevelAdapter({
      uiParent: H.cc._scene,
      select: (id) => ({ provider: 'r5', stageId: id, seed: 22 }),
      fixture: {},
      navigation: { exit: () => ({ ok: true }), resume: () => undefined },
      r5Persistence: persistence,
      background,
      onSession: (value) => { session = value; },
    });
    const journeyPort = {
      snapshot: () => ({ region: origin, target: null }),
      isInTransit: () => false,
      hasCheckpoint: () => origin !== 'island',
      position: () => ({ kind: 'standing', controllerRoot: zero, yawRad: 0 }),
      restore(_character, port) { port.setCamera(CAM[origin]); },
    };
    const flow = new WorldFlow({ config, character: actor, journey: journeyPort, levels: adapter, loadWorld: () => Promise.reject(Error('not used')) });
    flow.world = world;
    flow.state = origin;
    flow.stable = origin;
    return { flow, world, box, persistence, cameras, tokens, session: () => session };
  }
  async function win(session) {
    const controller = session.controller;
    for (const step of SOLVE) {
      drain(controller);
      if (controller.snapshot().state === 'run.paused') controller.resume();
      const played = session.submit(step);
      assert.equal(played.ok, true, played.reason);
    }
    drain(controller);
    const saved = controller.snapshot();
    assert.equal(saved.state, 'result.saved');
    assert.equal(saved.active.status, 'won');
    assert.equal(saved.result.firstClear, true);
  }
  for (const origin of ORIGINS) {
    const opened = await open(origin, async () => labeledMock(), () => Promise.resolve());
    const result = await Pieces.coastDevTeleport({
      origin, formalRelease: false, port: 'labeled-mock', flow: opened.flow, world: opened.world, door: 90, layers: 'region',
      play: async () => { await win(opened.session()); },
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.returned, origin);
    assert.equal(result.engineLoaded, false);
    assert.equal(opened.flow.snapshot().state, origin);
    assert.equal(opened.flow.snapshot().stable, origin);
    assert.equal(opened.cameras.at(-1).fovVerticalDeg, CAM[origin].fovVerticalDeg);
    assert.deepEqual(opened.cameras.at(-1).position, CAM[origin].position);
    const journal = new Journal(opened.persistence.platform, journey(12));
    assert.equal(journal.data.records['r06-coast-01'].clears, 1);
    assert.equal(journal.data.records['r06-coast-01'].bestMoves, 15);
    assert.equal(journal.claim('coast').reason, 'region-incomplete');
    assert.equal(new Journal(untouched.platform, journey(12)).data.records['r06-coast-01'], undefined);
    assert.equal(H.cc._scene.find('ManagedNativeBoardHost'), null);
    rows.push({ origin, returned: result.returned, clears: 1, cameraDouble: true, visualProof: false });
  }
  {
    const origin = 'island';
    let cancel = true;
    const opened = await open(origin, async () => labeledMock(), (token) => { if (cancel) { cancel = false; token.cancel(); } return Promise.resolve(); });
    const stopped = await Pieces.coastDevTeleport({ origin, formalRelease: false, port: 'labeled-mock', flow: opened.flow, world: opened.world, door: 90, layers: 'region' });
    assert.equal(stopped.ok, false);
    assert.equal(stopped.reason, 'cancelled');
    assert.equal(stopped.restored, true);
    assert.equal(opened.flow.snapshot().state, origin);
    assert.equal(new Journal(opened.persistence.platform, journey(12)).data.records['r06-coast-01'], undefined);
    const again = await Pieces.coastDevTeleport({
      origin, formalRelease: false, port: 'labeled-mock', flow: opened.flow, world: opened.world, door: 90, layers: 'region',
      play: async () => { await win(opened.session()); },
    });
    assert.equal(again.ok, true, JSON.stringify(again));
    assert.equal(again.returned, origin);
    assert.notEqual(opened.tokens[0], opened.tokens[1]);
    assert.equal(opened.tokens.length, 2);
    assert.equal(new Journal(opened.persistence.platform, journey(12)).data.records['r06-coast-01'].clears, 1);
    rows.push({ origin, cancelThenReentry: true, sequentialNotConcurrencyProof: true, tokens: 2, returned: origin });
  }
  {
    const origin = 'lakeside';
    let fault = true;
    const opened = await open(origin, async () => { if (fault) { fault = false; throw new Error('dev-port-fault'); } return labeledMock(); }, () => Promise.resolve());
    const failed = await Pieces.coastDevTeleport({ origin, formalRelease: false, port: 'labeled-mock', flow: opened.flow, world: opened.world, door: 90, layers: 'region' });
    assert.equal(failed.ok, false);
    assert.equal(failed.restored, true);
    assert.equal(opened.flow.snapshot().state, origin);
    assert.equal(opened.flow.snapshot().stable, origin);
    assert.equal(new Journal(opened.persistence.platform, journey(12)).data.records['r06-coast-01'], undefined);
    const recovered = await Pieces.coastDevTeleport({
      origin, formalRelease: false, port: 'labeled-mock', flow: opened.flow, world: opened.world, door: 90, layers: 'region',
      play: async () => { await win(opened.session()); },
    });
    assert.equal(recovered.ok, true, JSON.stringify(recovered));
    assert.equal(recovered.returned, origin);
    rows.push({ origin, errorRestored: true, returned: origin });
  }
  assert.equal(untouched.inspect().every((row) => row[1] == null), true);
  console.log(JSON.stringify({
    status: 'PASS',
    callChain: 'coastDevTeleport → WorldFlow.enterLevel → NativeWorldLevelAdapter.enter → labeled-mock background → createManagedBoardSession → session.submit seed 22 → exitLevel → stable origin',
    productionBackground: 'createCoastBoardBackground unchanged and not used on this path',
    engineLoaded: false,
    engineBoundary: 'Creator bundle, GLB importer, material refcount, and the rendered camera were not exercised',
    mocked: 'labeled-mock scene port; WorldFlow.world camera/door/layer double; journey.restore double. Not visual proof.',
    rows,
  }));
})().catch((error) => { console.error(error); process.exit(1); });
