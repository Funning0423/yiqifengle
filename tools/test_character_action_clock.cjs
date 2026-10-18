'use strict';
// Actual production adapter, motion clock and WorldFlow entry. Only Cocos nodes/clips are structural doubles.
const fs = require('node:fs'), assert = require('node:assert/strict'), vm = require('node:vm');
const ts = require('./qf-env.cjs').typescript();
const W = require('./camera-frame-test/load_ts.cjs').load(['CameraPose', 'WorldFlowCore']).WorldFlowCore;
const file = process.env.QF_ACTION_CLOCK_BOOT || 'creator-build-project/assets/scripts/WorldIntegrationBoot.ts';
const src = fs.readFileSync(file, 'utf8');
const classText = src.slice(src.indexOf('class FlowReferenceStandin'), src.indexOf("@ccclass('WorldIntegrationBoot')"));
const REF = { standingRoot: [1, 0, 0], seatedRoot: [0, 0, 0], seatYawRad: 0 };
const durations = { sit_hold: 1.2916667, idle_breathing_loop: 4, wind_sway_loop: 4, stand_up: 1.25, sit_down: 1.25, walk_loop: 1, door_reach: 1 };
function joint(name) {
  return { name, children: [], position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 },
    setPosition(x, y, z) { this.position = { x, y, z }; }, setRotation(x, y, z, w) { this.rotation = { x, y, z, w }; }, setScale(x, y, z) { this.scale = { x, y, z }; } };
}
function rig() {
  const clips = Object.entries(durations).map(([name, duration]) => ({ name, duration }));
  const states = new Map(clips.map(clip => [clip.name, { clip, time: 0, playing: false, paused: false, samples: [],
    play() { this.playing = true; this.paused = false; }, pause() { this.paused = true; }, stop() { this.playing = false; },
    setTime(t) { this.time = t; }, sample() { this.samples.push(this.time); } }]));
  const arm = joint('Armature');
  // A minimal rest hierarchy lets the real settle pipeline capture joints after a completed long walk.
  // It makes no claim about actual skeletal deformation or foot contact.
  arm.children = ['root', 'hips', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R', 'foot.L', 'foot.R'].map(joint);
  arm.children.forEach(n => { n.parent = arm; });
  const anim = { node: arm, clips, play: n => states.get(n).play(), getState: n => states.get(n), createState() { throw Error('Unexpected creation'); } };
  const node = { active: true, worldPosition: { x: 0, y: 0, z: 0 }, writes: [],
    setWorldPosition(x, y, z) { this.worldPosition = { x, y, z }; this.writes.push([x, y, z]); }, setRotationFromEuler() {}, destroy() { this.destroyed = true; } };
  return { node, states, anim, visual: { getComponent: () => anim, getComponentInChildren: () => null } };
}
const transpile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const motion = {};
vm.runInNewContext(transpile(fs.readFileSync('creator-build-project/assets/scripts/CharacterMotion.ts', 'utf8')), { exports: motion, Math, Float64Array, RegExp, Object, Array, String, Number, isFinite });
const context = { ...motion, REF, Cancelled: W.Cancelled, AnimationClip: { WrapMode: { Loop: 2, Normal: 1 } }, SkeletalAnimation: function () {}, pointOnPath: W.pointOnPath, exports: {}, console };
vm.runInNewContext(transpile(classText + '\nexports.Adapter=FlowReferenceStandin;'), context);
const Adapter = context.exports.Adapter;
const seat = { standingControllerRoot: REF.standingRoot, seatedControllerRoot: REF.seatedRoot, yawRad: 0, position: [0, 0, 0], back: [0, 0, -1], seatedFoot: [0, 0, 0], standingFoot: [1, 0, 0] };
const rows = [];
// Intermediate accumulated times may have ordinary IEEE-754 error. Terminal roots below remain strict equality.
const near = (actual, expected, label) => assert(Math.abs(actual - expected) < 1e-12, `${label}: ${actual} vs ${expected}`);
const root = r => Object.values(r.node.worldPosition);
function make() { const r = rig(), a = new Adapter(r.node); a.bindVisual(r.visual); return { r, a }; }
async function finish(a, p) { assert.equal(a.diagnostics().action, null, 'action must actually settle; do not await a promise that can silently abandon a Node test'); await p; }
(async () => {
  const { r, a } = make();
  assert(r.states.get('sit_hold').samples.length > 0 && !r.states.get('sit_hold').playing, 'controller owns the clock');
  const standToken = new W.Cancellation(); let resolutions = 0;
  const stand = a.perform({ kind: 'stand', seat }, standToken).then(() => { resolutions++; });
  for (let i = 0; i < 6; i++) a.advance(.1); a.advance(.025);
  near(r.node.worldPosition.x, .5, 'stand half root'); near(r.states.get('stand_up').time, .625, 'stand half clip');
  assert(!r.states.get('stand_up').playing); assert.equal(a.playDoorReach(), false);
  for (let i = 0; i < 7; i++) a.advance(.1);
  await finish(a, stand); assert.deepEqual(root(r), [1, 0, 0]); assert.equal(a.diagnostics().clip, 'idle_breathing_loop');
  const writes = r.node.writes.length; standToken.cancel(); a.advance(2); await Promise.resolve();
  assert.equal(resolutions, 1); assert.equal(r.node.writes.length, writes, 'completed stand cannot write a late root');
  rows.push({ check: 'stand-half-clock-exact-endpoint-and-single-completion', resolutions });

  const walkToken = new W.Cancellation(), walk = a.perform({ kind: 'walk', path: [[1, 0, 0], [3, 0, 0]], duration: 2 }, walkToken);
  const caught = walk.catch(e => e); a.advance(.1);
  near(r.node.worldPosition.x, 1.1, 'walk root'); near(r.states.get('walk_loop').time, .1 / .7, 'distance-driven clip');
  walkToken.cancel(); assert((await caught) instanceof W.Cancelled); a.cancelAndReset({ kind: 'seated', seat });
  const old = r.states.get('walk_loop').samples.length; a.advance(2);
  assert.deepEqual(root(r), [0, 0, 0]); assert.equal(r.states.get('walk_loop').samples.length, old);
  assert.equal(a.diagnostics().clip, 'sit_hold'); rows.push({ check: 'cancel-no-late-walk-or-clip-writes' });

  // Adapter consumes the supplied frame fully; production WorldFlow below owns the long-frame cap.
  a.cancelAndReset({ kind: 'standing', controllerRoot: [1, 0, 0], yawRad: 0 });
  const longWalk = a.perform({ kind: 'walk', path: [[1, 0, 0], [11, 0, 0]], duration: 10 }, new W.Cancellation());
  a.advance(5); near(r.node.worldPosition.x, 6, 'full adapter long frame'); assert.equal(a.diagnostics().action, 'walk');
  near(a.walkProgress(), .5, 'half walk'); a.advance(5); await finish(a, longWalk); assert.deepEqual(root(r), [11, 0, 0]);
  a.advance(.5); assert.equal(a.diagnostics().clip, 'idle_breathing_loop'); assert.deepEqual(root(r), [11, 0, 0]);
  rows.push({ check: 'adapter-120Hz-substeps-consume-full-frame-and-settle', suppliedSeconds: 10, end: root(r) });

  a.cancelAndReset({ kind: 'standing', controllerRoot: [1, 0, 0], yawRad: 0 }); assert(a.playDoorReach());
  a.advance(.5); near(r.states.get('door_reach').time, .5, 'door manual time'); assert(!r.states.get('door_reach').playing);
  const doorSamples = r.states.get('door_reach').samples.length;
  a.cancelAndReset({ kind: 'seated', seat }); a.advance(.1); assert.equal(r.states.get('door_reach').samples.length, doorSamples);
  assert.equal(a.diagnostics().clip, 'sit_hold'); rows.push({ check: 'door-manual-clock-and-reset-cancellation' });

  a.cancelAndReset({ kind: 'standing', controllerRoot: [1, 0, 0], yawRad: 0 });
  const sit = a.perform({ kind: 'sit', seat }, new W.Cancellation());
  for (let i = 0; i < 6; i++) a.advance(.1); a.advance(.025);
  near(r.node.worldPosition.x, .5, 'sit half root'); near(r.states.get('sit_down').time, .625, 'sit half clip');
  for (let i = 0; i < 7; i++) a.advance(.1);
  await finish(a, sit); assert.deepEqual(root(r), [0, 0, 0]); rows.push({ check: 'sit-half-clock-exact-endpoint' });

  // Exercise the actual completion tolerance, rather than making the assertion tolerant of an unfinished root.
  for (const kind of ['stand', 'sit']) {
    const start = kind === 'stand' ? [0, 0, 0] : [1, 0, 0];
    a.cancelAndReset({ kind: 'standing', controllerRoot: start, yawRad: 0 });
    const p = a.perform({ kind, seat }, new W.Cancellation());
    a.advance(1.25 - 2e-6); assert.equal(a.diagnostics().action, kind, 'outside completion tolerance stays pending');
    a.advance(1.5e-6); await finish(a, p);
    assert.deepEqual(root(r), kind === 'stand' ? [1, 0, 0] : [0, 0, 0]);
  }
  // Exact copy also avoids cancellation error in from + (target - from), even with valid nonzero target values.
  const offsetSeat = { ...seat, standingControllerRoot: [.1, .2, .3], seatedControllerRoot: [1e5, -1e5, 1e5] };
  a.cancelAndReset({ kind: 'seated', seat: offsetSeat }); const offsetStand = a.perform({ kind: 'stand', seat: offsetSeat }, new W.Cancellation());
  a.advance(1.25); await finish(a, offsetStand); assert.deepEqual(root(r), offsetSeat.standingControllerRoot);
  rows.push({ check: 'completion-tolerance-canonicalizes-root-before-resolve', terminalEquality: 'strict', outsideTolerancePending: true });

  const missing = make(); missing.r.anim.clips = missing.r.anim.clips.filter(c => c.name !== 'walk_loop');
  await assert.rejects(missing.a.perform({ kind: 'walk', path: [[0, 0, 0], [1, 0, 0]], duration: 1 }, new W.Cancellation()), /Character clip missing/);
  missing.a.dispose(); a.dispose(); assert.equal(a.playDoorReach(), false); a.advance(.1); assert(r.node.destroyed);
  rows.push({ check: 'missing-action-clip-rejects-and-disposal-never-revives' });

  const real = make(), pose = { position: [0, 3, -6], target: [0, 1, 0] }, path = [[1, 0, 0], [3, 0, 0]];
  const config = { seat, toDoor: path, outCrossing: path, toIsland: path, toThreshold: path, inCrossing: path, toSeat: path,
    cameraHome: pose, cameraToDoor: [pose, pose], cameraInside: pose, cameraOutside: pose, cameraIsland: pose, openDeg: 90, speed: 1 };
  const lease = { setCamera() {}, setLayers() {}, setDoor() {}, cancelTransient() {}, assertStaticWorld() {}, dispose() {}, animateCamera: async () => {}, animateDoor: async () => {} };
  const flow = new W.WorldFlow({ config, character: real.a, mode: 'motion', levels: { enter: async () => { throw Error('unused'); } }, loadWorld: async () => lease });
  assert((await flow.load()).ok);
  const standing = real.a.perform({ kind: 'stand', seat }, new W.Cancellation());
  flow.advance(5); near(real.r.node.worldPosition.x, .1 / 1.25, 'production flow caps a long frame to 0.1 seconds');
  flow.hide(); assert.equal(flow.snapshot().state, 'home'); assert.equal(flow.snapshot().needsResume, true);
  const pausedRoot = root(real.r), pausedSamples = [...real.r.states.values()].reduce((n, s) => n + s.samples.length, 0);
  for (let i = 0; i < 10; i++) flow.advance(5);
  assert.deepEqual(root(real.r), pausedRoot, 'hidden seated clip does not advance'); assert.equal([...real.r.states.values()].reduce((n, s) => n + s.samples.length, 0), pausedSamples);
  flow.show(); assert.equal(flow.snapshot().needsResume, false); assert.equal(flow.snapshot().state, 'home'); assert.equal(flow.resume().ok, false);
  for (let i = 0; i < 13; i++) flow.advance(5);
  await finish(real.a, standing); assert.deepEqual(root(real.r), [1, 0, 0]);
  flow.dispose(); rows.push({ check: 'actual-WorldFlow-long-frame-cap-hide-show-seated-continues', hostFrameCapSeconds: .1, pausedNoRootOrClipWrites: true, seatedContinuesWithoutResume: true });

  const report = { status: 'PASS_PURE_NODE_STUBS_NOT_RENDER_ACCEPTANCE', checks: rows, typescript: ts.version,
    scope: 'Actual production FlowReferenceStandin + AnimRig + CharacterMotion + WorldFlow. Cocos node/clip boundaries are structural doubles; no Creator, GUI, asset import, browser, physical-device or visual acceptance.' };
  if (process.env.QF_ACTION_CLOCK_REPORT) fs.writeFileSync(process.env.QF_ACTION_CLOCK_REPORT, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
