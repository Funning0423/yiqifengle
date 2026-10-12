'use strict';
/** Fixed sitting mesh: fade state machine + home stance (window after return / 起身, chair at cold start). */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
const repo = path.resolve(__dirname, '..');
const root = path.join(repo, 'creator-build-project/assets/scripts/world-r1');

function loadSwap() {
  const s = fs.readFileSync(path.join(root, 'SitStaticSwap.ts'), 'utf8').replace(/\bexport\s+/g, '');
  const js = stripTypeScriptTypes(s, { mode: 'transform' });
  const ctx = { console };
  vm.runInNewContext(js + '\nthis.exports={SitStaticSwap,SIT_SWAP_FADE_S};', ctx, { filename: 'SitStaticSwap.ts' });
  return ctx.exports;
}

function loadFlow() {
  const cache = {};
  function load(name) {
    if (cache[name]) return cache[name];
    let js = stripTypeScriptTypes(fs.readFileSync(path.join(root, name + '.ts'), 'utf8'), { mode: 'transform' });
    const names = [...js.matchAll(/export\s+(?:class|function|const|let)\s+(\w+)/g)].map(m => m[1]);
    js = js.replace(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)['"];?/g, (_, keys, dep) => 'const {' + keys + '}=load(' + JSON.stringify(dep) + ');').replace(/\bexport\s+/g, '');
    const ctx = { load, console, setTimeout, clearTimeout };
    vm.runInNewContext(js + '\nthis.exports={' + names.join(',') + '};', ctx, { filename: name + '.ts' });
    return cache[name] = ctx.exports;
  }
  const W = load('WorldFlowCore');
  const cfg = load('FirstsliceRoutes').createFirstsliceRoutes(load('FirstsliceFacts').FIRSTSLICE, load('CharacterReference').CHARACTER_REFERENCE);
  return { W, cfg };
}

function assertNear(a, b, m) { assert(Math.abs(a - b) < 1e-6, m || (a + ' vs ' + b)); }

(async () => {
  const { SitStaticSwap, SIT_SWAP_FADE_S } = loadSwap();
  assert.equal(SIT_SWAP_FADE_S, 0.3);
  const cold = new SitStaticSwap();
  assert.equal(cold.phase, 'static');
  assert.equal(cold.skel, 0);
  assert.equal(cold.stat, 1);
  cold.fadeToStatic();
  assert.equal(cold.phase, 'static', 'fade to static is a no-op when already static');
  cold.fadeToSkeletal();
  assert.equal(cold.phase, 'to-skeletal');
  cold.advance(0.15);
  assert(cold.busy());
  assertNear(cold.skel + cold.stat, 1, 'alphas stay complementary');
  assert(cold.skel > 0 && cold.skel < 1);
  cold.advance(0.2);
  assert.equal(cold.phase, 'skeletal');
  assert.equal(cold.skel, 1);
  assert.equal(cold.stat, 0);
  cold.fadeToSkeletal();
  assert.equal(cold.phase, 'skeletal', 'fade to skeletal is a no-op when already skeletal');
  cold.fadeToStatic();
  cold.advance(0.3);
  assert.equal(cold.phase, 'static');
  cold.showSkeletal();
  cold.showStatic();
  assert.equal(cold.phase, 'static');
  assert.equal(cold.busy(), false, 'snap does not leave a fade running');

  const src = fs.readFileSync(path.join(root, 'SitStaticSwap.ts'), 'utf8');
  const overlay = fs.readFileSync(path.join(repo, 'creator-build-project/assets/scripts/RoomExploreOverlay.ts'), 'utf8');
  assert(!/for\s*\(\s*(const|let|var)\s+[^;)]*\s+of\s/.test(src), 'SitStaticSwap has no for-of');
  assert(!/for\s*\(\s*(const|let|var)\s+[^;)]*\s+of\s/.test(overlay), 'RoomExploreOverlay has no for-of');
  const stance = fs.readFileSync(path.join(repo, 'tools/walk-driver/test_locomotion.cjs'), 'utf8');
  assert(/const STANCE_MM=6;/.test(stance), 'STANCE_MM stays 6');

  const { W, cfg } = loadFlow();
  const seat = cfg.seat;
  function harness() {
    const actions = [], waits = [];
    let fades = 0;
    const character = {
      calibrated: true,
      coordinates: { units: 'm', up: '+Y', forward: '+Z', rootMotion: 'controller-only', standingRoot: seat.standingControllerRoot, seatedRoot: seat.seatedControllerRoot, seatYawRad: seat.yawRad, clearanceRadiusM: 0.15 },
      advance() {}, perform: async (a) => { actions.push(a.kind); }, cancelAndReset() {}, setVisible() {}, dispose() {},
      actionSeconds: (k) => k === 'stand' ? 1.27 : k === 'sit' ? 1.2 : 1.5,
      beginStandFade() { fades++; return 0.3; },
    };
    const lease = {
      setCamera() {}, setLayers() {}, setDoor() {}, cancelTransient() {}, assertStaticWorld() {}, dispose() {},
      animateDoor: async () => {}, animateCamera: async () => {}, wait: async (s) => { waits.push(s); },
    };
    const flow = new W.WorldFlow({ config: cfg, mode: 'motion', character, levels: { enter: async () => { throw Error('unused'); } }, loadWorld: async () => lease });
    return { flow, actions, waits, fadeCount: () => fades };
  }

  const coldHome = harness();
  assert((await coldHome.flow.load()).ok);
  assert.equal(coldHome.flow.seatLabel(), '起身', 'cold start is seated on the chair');
  const already = await coldHome.flow.sitDown();
  assert.equal(already.ok, false);
  assert.equal(already.reason, 'already-seated');
  assert.equal(coldHome.actions.length, 0, 'already seated does not play sit_down');
  const up = await coldHome.flow.standUp();
  assert.equal(up.ok, true);
  assert.equal(coldHome.fadeCount(), 1);
  assert.equal(coldHome.waits[0], 0.3, '起身 waits out the fade before stand_up');
  assert.equal(coldHome.actions[0], 'stand');
  assert.equal(coldHome.flow.seatLabel(), '坐下');
  coldHome.actions.length = 0;
  const down = await coldHome.flow.sitDown();
  assert.equal(down.ok, true);
  assert.equal(coldHome.actions[0], 'sit', '坐下 plays the existing sit action');
  assert.equal(coldHome.flow.seatLabel(), '起身');

  const leave = harness();
  assert((await leave.flow.load()).ok);
  assert((await leave.flow.standUp()).ok);
  leave.actions.length = 0;
  assert((await leave.flow.leaveHome()).ok);
  assert.equal(leave.actions[0], 'turn', 'leaving from the window does not play stand_up');
  assert(!leave.actions.includes('stand'), 'no stand action on a window exit');
  assert(!leave.actions.includes('sit'), 'the return-shaped leave does not sit');

  const firstLeave = harness();
  assert((await firstLeave.flow.load()).ok);
  assert((await firstLeave.flow.leaveHome()).ok);
  assert.equal(firstLeave.actions[0], 'stand', 'the first leave, from the chair, still plays stand_up');

  console.log('PASS sit static swap');
})().catch((e) => { console.error(e); process.exit(1); });
