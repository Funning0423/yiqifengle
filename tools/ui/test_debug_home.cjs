'use strict';
// Debug panel Home must snap. It must not play the return-home walk, and it must not wait on a hung perform().
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), Module = require('node:module');
const { stripTypeScriptTypes } = Module;
const root = path.resolve(__dirname, '../../creator-build-project/assets/scripts');
const coreSrc = fs.readFileSync(path.join(root, 'world-r1/WorldFlowCore.ts'), 'utf8');
const coreJs = stripTypeScriptTypes(coreSrc, { mode: 'strip' }).replace(/import \{ CameraTrackFailure \} from '\.\/CameraPose';/, 'class CameraTrackFailure extends Error {}').replace(/\bexport\s+/g, '');
const ctx = {};
vm.runInNewContext(coreJs + '\nthis.api={WorldFlow,layerStates};', ctx);
const { WorldFlow, layerStates } = ctx.api;
const name = (l) => Object.entries(layerStates).find(([, v]) => JSON.stringify(v) === JSON.stringify(l))[0];
function fixture(levelLease) {
  const zero = [0, 0, 0], one = [0, 0, 1], far = [0, 0, 4], pose = { position: [0, 2, 3], target: zero };
  const seat = { position: zero, back: zero, yawRad: 0, seatedFoot: zero, standingFoot: zero, seatedControllerRoot: zero, standingControllerRoot: zero };
  const log = [];
  let hang = false;
  const config = { seat, toDoor: [zero, one], outCrossing: [one, one], toIsland: [one, far], toThreshold: [far, one], inCrossing: [one, one], toSeat: [one, zero], cameraHome: pose, cameraToDoor: [pose, pose], cameraInside: pose, cameraOutside: pose, cameraIsland: pose, openDeg: 60, speed: 0.5 };
  const world = { setLayers: (x) => log.push('layers:' + name(x)), setDoor() {}, setCamera() {}, animateDoor: async () => {}, animateCamera: async () => {}, cancelTransient() {}, assertStaticWorld() {}, dispose() {}, setRoomLightWeight() { return true; }, setExteriorKey() { return true; } };
  const character = { calibrated: true, coordinates: { units: 'm', up: '+Y', forward: '+Z', rootMotion: 'controller-only', standingRoot: zero, seatedRoot: zero, seatYawRad: 0, clearanceRadiusM: 0.15 }, advance() {}, perform: async (a) => { log.push('act:' + a.kind); if (hang) await new Promise(() => {}); }, cancelAndReset() {}, setVisible() {}, dispose() {} };
  const f = new WorldFlow({ config, character, levels: { enter: async () => levelLease }, loadWorld: async () => world });
  return { f, log, setHang(v) { hang = v; } };
}
(async () => {
  const disposed = { n: 0 };
  const lease = { show() {}, hide() {}, showPaused() {}, resume() { return { ok: true }; }, requestExit() { return { ok: true }; }, dispose() { disposed.n++; } };
  const x = fixture(lease);
  await x.f.load();
  await x.f.leaveHome();
  assert.equal((await x.f.enterLevel('meadow-01')).ok, true);
  assert.equal(x.f.snapshot().state, 'level');
  const before = x.log.filter((v) => v.startsWith('act:')).length;
  const home = x.f.debugPlace('home');
  assert.equal(home.ok, true);
  assert.equal(x.f.snapshot().state, 'home');
  assert.equal(x.f.snapshot().needsResume, false);
  assert.equal(x.log.filter((v) => v.startsWith('layers:')).at(-1), 'layers:HOME');
  assert.equal(disposed.n, 1, 'the level is disposed instead of walked out of');
  assert.equal(x.log.filter((v) => v.startsWith('act:')).length, before, 'debug Home does not start the return walk');

  await x.f.leaveHome();
  x.setHang(true);
  const pending = x.f.returnHome();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(x.f.snapshot().state, 'walking-home');
  const snap = x.f.debugPlace('home');
  assert.equal(snap.ok, true);
  assert.equal(x.f.snapshot().state, 'home');
  const raced = await Promise.race([pending, new Promise((r) => setTimeout(() => r('hung'), 50))]);
  assert.equal(raced.ok, false);
  assert.equal(raced.reason, 'cancelled');
  console.log(JSON.stringify({ status: 'PASS', checks: ['level snaps home', 'hung return is cancelled'] }));
})().catch((e) => { console.error(e); process.exitCode = 1; });
