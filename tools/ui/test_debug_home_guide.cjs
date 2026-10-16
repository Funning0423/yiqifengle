'use strict';
// Debug Home while the meadow-01 onboarding guide is still open.
// The guide (and a tool intro it is holding) is a board modal. Leaving it up never
// reaches home. Home must dismiss those modals first, then snap with debugPlace.
// The tap is a DOM/simulator touch: the guide's BlockInputEvents can swallow the Cocos hit.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), Module = require('node:module');
const { stripTypeScriptTypes } = Module;
const root = path.resolve(__dirname, '../../creator-build-project/assets/scripts');

const panelSrc = fs.readFileSync(path.join(root, 'ui/DebugJumpPanel.ts'), 'utf8');
const helpersStart = panelSrc.indexOf('export function debugPanelLabels');
const helpersEnd = panelSrc.indexOf('export class DebugJumpPanel');
assert(helpersStart > 0 && helpersEnd > helpersStart, 'panel hit helpers must sit above the class');
const helperJs = stripTypeScriptTypes(panelSrc.slice(helpersStart, helpersEnd), { mode: 'strip' }).replace(/\bexport\s+/g, '');
const helpers = {};
vm.runInNewContext(helperJs + '\nthis.api={debugPanelLabels,debugPanelButtons,debugPanelHit,debugSheetTap};', helpers);
const { debugPanelLabels, debugPanelButtons, debugPanelHit, debugSheetTap } = helpers.api;

const bootSrc = fs.readFileSync(path.join(root, 'WorldIntegrationBoot.ts'), 'utf8');
const bootStart = bootSrc.indexOf(' private runDebug(');
const bootEnd = bootSrc.indexOf(' private createNavigation()');
assert(bootStart > 0 && bootEnd > bootStart, 'runDebug must stay ahead of createNavigation');
const Boot = new Function(stripTypeScriptTypes('class Boot {' + bootSrc.slice(bootStart, bootEnd) + '}', { mode: 'transform' }) + ';return Boot;')();

const boardSrc = fs.readFileSync(path.join(root, 'ManagedMobileBoardUI.ts'), 'utf8');
assert(/dismissHostModals\(\)/.test(boardSrc) && /hostModalsSealed/.test(boardSrc), 'the board seals and clears the guide');
assert(/popups\?\.clear\(\)/.test(boardSrc), 'guide close is immediate, not the 0.15s animation');
assert(/activateDom\(/.test(panelSrc) && /onTouchEnd[\s\S]{0,400}activateDom\(/.test(panelSrc), 'DOM touchend activates the sheet button');

const coreSrc = fs.readFileSync(path.join(root, 'world-r1/WorldFlowCore.ts'), 'utf8');
const coreJs = stripTypeScriptTypes(coreSrc, { mode: 'strip' }).replace(/import \{ CameraTrackFailure \} from '\.\/CameraPose';/, 'class CameraTrackFailure extends Error {}').replace(/\bexport\s+/g, '');
const ctx = {};
vm.runInNewContext(coreJs + '\nthis.api={WorldFlow,layerStates};', ctx);
const { WorldFlow, layerStates } = ctx.api;
const layerName = (l) => Object.entries(layerStates).find(([, v]) => JSON.stringify(v) === JSON.stringify(l))[0];

function fixture(levelLease) {
  const zero = [0, 0, 0], one = [0, 0, 1], far = [0, 0, 4], pose = { position: [0, 2, 3], target: zero };
  const seat = { position: zero, back: zero, yawRad: 0, seatedFoot: zero, standingFoot: zero, seatedControllerRoot: zero, standingControllerRoot: zero };
  const log = [];
  const config = { seat, toDoor: [zero, one], outCrossing: [one, one], toIsland: [one, far], toThreshold: [far, one], inCrossing: [one, one], toSeat: [one, zero], cameraHome: pose, cameraToDoor: [pose, pose], cameraInside: pose, cameraOutside: pose, cameraIsland: pose, openDeg: 60, speed: 0.5 };
  const world = { setLayers: (x) => log.push('layers:' + layerName(x)), setDoor() {}, setCamera() {}, animateDoor: async () => {}, animateCamera: async () => {}, cancelTransient() {}, assertStaticWorld() {}, dispose() {}, setRoomLightWeight() { return true; }, setExteriorKey() { return true; } };
  const character = { calibrated: true, coordinates: { units: 'm', up: '+Y', forward: '+Z', rootMotion: 'controller-only', standingRoot: zero, seatedRoot: zero, seatYawRad: 0, clearanceRadiusM: 0.15 }, advance() {}, perform: async (a) => { log.push('act:' + a.kind); }, cancelAndReset() {}, setVisible() {}, dispose() {} };
  const f = new WorldFlow({ config, character, levels: { enter: async () => levelLease }, loadWorld: async () => world });
  return { f, log };
}

(async () => {
  const meadow = debugPanelLabels('meadow');
  assert.equal(meadow[0], '草甸01', 'the debug sheet can jump to meadow 01');
  const labels = debugPanelLabels('root');
  assert.equal(labels[0], '主页');
  let at = panelSrc.indexOf('private items()');
  for (const label of labels) {
    const hit = panelSrc.indexOf("label: '" + label + "'", at);
    assert(hit > at, 'sheet order keeps ' + label);
    at = hit;
  }
  const homeRect = debugPanelButtons(402, 874, labels)[0];
  const clientX = 402 / 2 + homeRect.x, clientY = 874 / 2 - homeRect.y;
  assert.equal(debugPanelHit(402, 874, labels, clientX, clientY), '主页', 'a DOM tap on the Home button resolves while a full-screen guide would take the Cocos hit');
  assert.equal(debugPanelHit(402, 874, labels, 8, 8), null, 'the guide shade is not Home');
  const chord = { multi: false };
  debugSheetTap(chord, 'start', 1); debugSheetTap(chord, 'start', 2); debugSheetTap(chord, 'start', 3);
  assert.equal(debugSheetTap(chord, 'end', 3), false);
  assert.equal(debugSheetTap(chord, 'end', 2), false);
  assert.equal(debugSheetTap(chord, 'end', 1), false, 'the last finger of the chord that opened the sheet is not Home');
  const finger = { multi: false };
  debugSheetTap(finger, 'start', 1);
  assert.equal(debugSheetTap(finger, 'end', 1), true, 'a one-finger release is the Home tap');
  assert.equal(debugPanelHit(600, 800, labels, 600 / 2 + debugPanelButtons(600, 800, labels)[0].x, 800 / 2 - debugPanelButtons(600, 800, labels)[0].y), '主页');

  const guide = ['RuleGuidePanel', 'ToolIntroPanel'];
  const order = [];
  const disposed = { n: 0 };
  const lease = { show() {}, hide() {}, showPaused() {}, resume() { return { ok: true }; }, requestExit() { return { ok: true }; }, dispose() { disposed.n++; } };
  const x = fixture(lease);
  await x.f.load();
  await x.f.leaveHome();
  assert.equal((await x.f.enterLevel('r05-meadow-01')).ok, true, 'debug jump to 草甸 01 lands in the level');
  assert.equal(x.f.snapshot().state, 'level');
  const before = x.log.filter((v) => v.startsWith('act:')).length;

  const boot = new Boot();
  boot.opGen = 0;
  boot.busy = false;
  boot.error = '';
  boot.paintNavigation = () => order.push('paint');
  boot.islandJourney = { close() { order.push('journey'); } };
  boot.debugJump = { close() { order.push('panel'); } };
  boot.board = () => ({
    dismissHostModals() {
      order.push('dismiss:' + guide.join('+'));
      guide.length = 0;
    },
  });
  boot.composition = {
    debugJump: async (cmd) => {
      order.push('jump:' + cmd.place);
      // Device failure: the open guide keeps the level lease. Home never arrives.
      if (guide.length) return await new Promise(() => {});
      return x.f.debugPlace(cmd.place);
    },
  };

  const tapped = debugPanelHit(402, 874, labels, clientX, clientY);
  assert.equal(tapped, '主页');
  const pending = boot.runDebug({ kind: 'place', place: 'home' });
  const result = await Promise.race([pending, new Promise((r) => setTimeout(() => r('hung'), 200))]);
  assert.notEqual(result, 'hung', 'Home must not wait out the 180s device timeout');
  assert.equal(result.ok, true);
  assert.deepEqual(guide, [], 'the rule guide and the modal it holds are gone before the snap');
  assert.equal(x.f.snapshot().state, 'home');
  assert.equal(x.f.snapshot().needsResume, false);
  assert.equal(x.log.filter((v) => v.startsWith('layers:')).at(-1), 'layers:HOME');
  assert.equal(disposed.n, 1, 'the meadow level is disposed instead of walked out of');
  assert.equal(x.log.filter((v) => v.startsWith('act:')).length, before, 'debug Home does not start the return walk');
  assert.ok(order.indexOf('dismiss:RuleGuidePanel+ToolIntroPanel') < order.indexOf('jump:home'), 'dismiss runs before debugPlace');
  console.log(JSON.stringify({ status: 'PASS', checks: ['meadow-01 guide open', 'DOM tap hits 主页', 'dismiss then debugPlace', 'no walk'] }));
})().catch((e) => { console.error(e); process.exitCode = 1; });
