'use strict';
/* Exclusive dev ownership on one real WorldFlow and the real native adapter.
 * background.load is delayed inside LevelBackgroundBinding. Not a fake enterLevel promise.
 * cc, the world camera port, and the background port are doubles. Not a GLB load. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHarness } = require('../board-ui/harness.cjs');
const ROOT = path.resolve(__dirname, '../..');
const Host = require(path.join(ROOT, 'creator-build-project/assets/scripts/regional-r05/runtime/campaign-host.js'));

function mem() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}
function journey() {
  return { readOnly: false, records: Array.from({ length: 12 }, () => ({ bestStars: 2 })) };
}
function mockPort() {
  return {
    label: 'labeled-mock-background-port',
    engineLoaded: false,
    engineEvidence: 'unavailable',
    frame() {},
    setVisible() {},
    setPaused() {},
    dispose() {},
    diagnostics() { return { label: 'labeled-mock-background-port', engineLoaded: false, engineEvidence: 'unavailable' }; },
  };
}
(async () => {
  const H = createHarness();
  const Pieces = H.load('ui/CoastBoardPieces');
  const flowSrc = fs.readFileSync(path.join(H.SCRIPTS, 'world-r1/WorldFlowCore.ts'), 'utf8');
  assert.equal(flowSrc.includes('dev-world-busy'), false);
  const zero = [0, 0, 0];
  const shot = { position: [-12, 15.5, 48], fovVerticalDeg: 42 };
  const seat = { position: zero, back: [0, 0, -1], yawRad: 0, seatedFoot: zero, standingFoot: zero, seatedControllerRoot: zero, standingControllerRoot: zero };
  const actor = { calibrated: true, coordinates: { units: 'm', up: '+Y', forward: '+Z', rootMotion: 'controller-only', standingRoot: zero, seatedRoot: zero, seatYawRad: 0, clearanceRadiusM: 0.1 }, advance() {}, perform: async () => {}, cancelAndReset() {}, setVisible() {}, dispose() {} };
  const config = { seat, toDoor: [zero, [0, 0, 1]], outCrossing: [[0, 0, 1], [0, 0, 2]], toIsland: [[0, 0, 2], [0, 0, 3]], toThreshold: [[0, 0, 3], [0, 0, 2]], inCrossing: [[0, 0, 2], [0, 0, 1]], toSeat: [[0, 0, 1], zero], cameraHome: shot, cameraIsland: shot, door: { openDeg: 90 }, openDeg: 90, speed: 1 };
  const { createNativeWorldLevelAdapter } = H.load('world-r2/NativeWorldLevelAdapter');
  const { WorldFlow } = H.load('world-r1/WorldFlowCore');
  function host() { return H.cc._scene.find('ManagedNativeBoardHost'); }
  function rig(refuseExit, delay) {
    let pose = shot;
    const calls = { camera: 0, cancel: 0 };
    let token = null;
    const world = {
      label: 'world-camera-double',
      visualProof: false,
      camera: () => pose,
      setCamera(p) { pose = p; calls.camera += 1; },
      setDoor() {},
      setLayers() {},
      cancelTransient() { calls.cancel += 1; },
      assertStaticWorld() {},
      playEnterLevel(next) { token = next; return Promise.resolve(); },
    };
    let session = null;
    const seen = [];
    let hold = null;
    let armDelay = delay;
    let refuses = refuseExit;
    const persistence = Host.createPersistence(mem(), journey());
    const adapter = createNativeWorldLevelAdapter({
      uiParent: H.cc._scene,
      select: (id) => ({ provider: 'r5', stageId: id, seed: 22 }),
      fixture: {},
      navigation: { exit: () => (refuses > 0 ? (refuses -= 1, { ok: false, reason: 'exit-refused' }) : { ok: true }), resume: () => undefined },
      r5Persistence: persistence,
      background: () => {
        if (!armDelay) return Promise.resolve(mockPort());
        armDelay = false;
        return new Promise((resolve) => { hold = () => resolve(mockPort()); });
      },
      onSession: (value) => { session = value; seen.push(value); },
    });
    const flow = new WorldFlow({
      config, character: actor, levels: adapter, loadWorld: () => Promise.reject(Error('not used')),
      journey: { snapshot: () => ({ region: 'island', target: null }), isInTransit: () => false, hasCheckpoint: () => false, position: () => ({ kind: 'standing', controllerRoot: zero, yawRad: 0 }), restore(_c, port) { port.setCamera(shot); } },
    });
    flow.world = world;
    flow.state = 'island';
    flow.stable = 'island';
    return { flow, world, calls, token: () => token, session: () => session, seen, releaseLoad: () => { if (!hold) throw new Error('background.load delay was not armed'); hold(); } };
  }
  function picture(box, releaseCount) {
    const own = Pieces.coastDevOwnership(box.world);
    return {
      state: box.flow.state,
      stable: box.flow.stable,
      camera: box.world.camera().position.slice(),
      fov: box.world.camera().fovVerticalDeg,
      cancel: box.calls.cancel,
      session: box.session(),
      host: host(),
      seen: box.seen.length,
      release: releaseCount,
      generation: own.generation,
      inflight: own.inflight,
    };
  }
  async function overlap(box, ownerRelease) {
    await H.flush();
    assert.equal(box.flow.snapshot().state, 'level-loading');
    assert.ok(host(), 'the real adapter creates the host before background.load resolves');
    const before = picture(box, ownerRelease.count);
    let bystander = 0;
    const busy = await Pieces.coastDevTeleport({
      origin: 'island', formalRelease: false, port: 'labeled-mock', flow: box.flow, world: box.world, door: 90, layers: 'island',
      release() { bystander += 1; },
    });
    assert.equal(busy.reason, 'dev-world-busy');
    assert.equal(busy.restored, false);
    assert.equal(bystander, 0);
    assert.deepEqual(picture(box, ownerRelease.count), before);
  }
  async function nextEntry(box) {
    const again = await Pieces.coastDevTeleport({
      origin: 'island', formalRelease: false, port: 'labeled-mock', flow: box.flow, world: box.world, door: 90, layers: 'island',
    });
    assert.equal(again.ok, true, JSON.stringify(again));
    assert.equal(again.returned, 'island');
    assert.equal(again.engineLoaded, false);
    assert.equal(host(), null);
    assert.equal(box.session(), null);
    assert.equal(Pieces.coastDevOwnership(box.world).inflight, false);
  }
  const rows = [];
  {
    const box = rig(0, true);
    const ownerRelease = { count: 0 };
    const first = Pieces.coastDevTeleport({
      origin: 'island', formalRelease: false, port: 'labeled-mock', flow: box.flow, world: box.world, door: 90, layers: 'island',
      release() { ownerRelease.count += 1; if (box.flow.level) box.flow.level.dispose(); },
    });
    await overlap(box, ownerRelease);
    box.token().cancel();
    const stopped = await first;
    assert.equal(stopped.reason, 'cancelled');
    assert.equal(stopped.restored, true);
    assert.equal(box.flow.snapshot().state, 'island');
    assert.equal(box.flow.snapshot().stable, 'island');
    assert.equal(host(), null);
    assert.equal(box.session(), null);
    assert.equal(ownerRelease.count, 1);
    assert.equal(Pieces.coastDevOwnership(box.world).inflight, false);
    await nextEntry(box);
    rows.push({ variant: 'cancel', nextEntry: true, orphanHost: false });
  }
  {
    const box = rig(0, true);
    const ownerRelease = { count: 0 };
    const first = Pieces.coastDevTeleport({
      origin: 'island', formalRelease: false, port: 'labeled-mock', flow: box.flow, world: box.world, door: 90, layers: 'island',
      release() { ownerRelease.count += 1; if (box.flow.level) box.flow.level.dispose(); },
    });
    await overlap(box, ownerRelease);
    box.releaseLoad();
    const done = await first;
    assert.equal(done.ok, true, JSON.stringify(done));
    assert.equal(done.returned, 'island');
    assert.equal(done.engineLoaded, false);
    assert.equal(host(), null);
    assert.equal(box.session(), null);
    assert.equal(ownerRelease.count, 1);
    assert.equal(Pieces.coastDevOwnership(box.world).inflight, false);
    await nextEntry(box);
    rows.push({ variant: 'success-exit', nextEntry: true, orphanHost: false });
  }
  {
    const box = rig(0, false);
    const ownerRelease = { count: 0 };
    let otherRelease = 0;
    const otherWorld = { label: 'other-world-camera-double', camera: () => shot, setCamera() { otherRelease += 1; }, cancelTransient() { otherRelease += 1; }, setDoor() {}, setLayers() {}, assertStaticWorld() {} };
    const failed = await Pieces.coastDevTeleport({
      origin: 'island', formalRelease: false, port: 'labeled-mock', flow: box.flow, world: box.world, door: 90, layers: 'island',
      play() { box.session().dispose(); },
      release() { ownerRelease.count += 1; if (box.flow.level) box.flow.level.dispose(); },
    });
    assert.equal(failed.reason, 'disposed');
    assert.equal(failed.restored, true);
    assert.equal(box.flow.snapshot().error, 'disposed');
    assert.equal(box.flow.snapshot().state, 'island');
    assert.equal(box.flow.snapshot().stable, 'island');
    assert.equal(host(), null);
    assert.equal(box.session(), null);
    assert.equal(ownerRelease.count, 1);
    assert.equal(otherRelease, 0);
    assert.equal(Pieces.coastDevOwnership(otherWorld).generation, 0);
    assert.equal(Pieces.coastDevOwnership(otherWorld).inflight, false);
    await nextEntry(box);
    rows.push({ variant: 'exit-failure', diagnostics: failed.reason, cleaned: true, otherReleased: false });
  }
  console.log(JSON.stringify({
    status: 'PASS',
    rows,
    chain: 'coastDevTeleport → WorldFlow.enterLevel → NativeWorldLevelAdapter.enter → LevelBackgroundBinding.load delay → exclusive dev-world-busy',
    doubles: 'cc harness, world-camera-double, labeled-mock-background-port',
    notEngine: true,
    engineLoaded: false,
    worldFlowCancellationUnchanged: true,
  }));
})().catch((error) => { console.error(error); process.exit(1); });
