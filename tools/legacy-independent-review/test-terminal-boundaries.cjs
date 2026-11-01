'use strict';
// Independent regression: use the shipped GLB/evaluator; do not change endpoint tolerances.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { load } = require('../camera-frame-test/load_ts.cjs');
const real = require('../camera-frame-test/real_walk.cjs');
process.env.WALK_GLB = path.resolve(__dirname, '../../creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb');
const M = load(), W = M.WorldFlowCore, REF = M.CharacterReference.CHARACTER_REFERENCE;
const seat = { seatedControllerRoot: REF.seatedRoot, standingControllerRoot: REF.standingRoot, yawRad: REF.seatYawRad };
const rows = [];
function create(kind) {
  const r = real.create(M, W);
  r.standin.cancelAndReset(kind === 'stand' ? { kind: 'seated', seat } : { kind: 'standing', controllerRoot: REF.standingRoot, yawRad: REF.seatYawRad });
  return r;
}
const root = r => Array.from(r.standin.diagnostics().root);
(async () => {
  for (const kind of ['stand', 'sit']) {
    const r = create(kind), a = r.standin, token = new W.Cancellation();
    const expected = Array.from(kind === 'stand' ? REF.standingRoot : REF.seatedRoot);
    let completed = 0;
    const p = a.perform({ kind, seat }, token).then(() => completed++);
    const duration = a.actionSeconds(kind);
    a.advance(duration - 2e-6);
    assert.equal(a.diagnostics().action, kind, 'must remain pending outside existing completion tolerance');
    assert.notDeepEqual(root(r), expected, 'test must actually approach the endpoint');
    a.advance(1.5e-6);
    assert.equal(a.diagnostics().action, null, 'completion must occur inside original tolerance');
    assert.deepEqual(root(r), expected, 'resolved controller must already be exactly at authored endpoint');
    await p;
    token.cancel(); a.advance(.037); await Promise.resolve();
    assert.equal(completed, 1); assert.deepEqual(root(r), expected);
    rows.push({ kind, check: 'real-GLB-terminal-tolerance', duration, root: expected, completions: completed });
    a.dispose();

    const c = create(kind), b = c.standin, cancel = new W.Cancellation();
    let successes = 0;
    const q = b.perform({ kind, seat }, cancel).then(() => { successes++; }, e => e);
    b.advance(b.actionSeconds(kind) - 2e-6);
    const before = root(c); cancel.cancel();
    assert((await q) instanceof W.Cancelled);
    b.advance(1); assert.equal(successes, 0); assert.deepEqual(root(c), before, 'cancelled near-terminal action cannot snap root later');
    rows.push({ kind, check: 'cancel-before-terminal', successes, noLateRoot: true });
    b.dispose();
  }
  // Irregular frame sizes exercise the production subdivision and partial final interval.
  for (const kind of ['stand', 'sit']) {
    const r = create(kind), a = r.standin, p = a.perform({ kind, seat }, new W.Cancellation());
    const dts = [.1, .001, 1 / 60, .073, 1 / 144, .029];
    let n = 0;
    while (a.diagnostics().action && n < 1000) a.advance(dts[n++ % dts.length]);
    assert.equal(a.diagnostics().action, null); await p;
    assert.deepEqual(root(r), Array.from(kind === 'stand' ? REF.standingRoot : REF.seatedRoot));
    rows.push({ kind, check: 'irregular-partial-frames', frames: n, exactRoot: root(r) });
    a.dispose();
  }
  // The normalization is shared by every action kind; also cover walk/turn at the same boundary.
  for (const kind of ['walk', 'turn']) {
    const r = create(kind), a = r.standin, start = Array.from(REF.standingRoot), end = [start[0] + .17, start[1], start[2] + .31];
    const duration = kind === 'walk' ? 2 : a.actionSeconds('turn');
    const targetYaw = REF.seatYawRad + Math.PI / 2;
    const action = kind === 'walk' ? { kind, path: [start, end], duration, stopAtEnd: false } : { kind, controllerRoot: start, fromYawRad: REF.seatYawRad, toYawRad: targetYaw, direction: 'left' };
    const p = a.perform(action, new W.Cancellation());
    a.advance(duration - 2e-6); assert.equal(a.diagnostics().action, kind);
    a.advance(1.5e-6); assert.equal(a.diagnostics().action, null); await p;
    if (kind === 'walk') assert.deepEqual(root(r), end);
    else { assert.deepEqual(root(r), start); assert(Math.abs(r.node.yaw - targetYaw) < 1e-12); }
    rows.push({ kind, check: 'shared-terminal-normalization', exactRoot: root(r), yaw: r.node.yaw });
    a.dispose();
  }
  const report = { status: 'PASS', shippedGlb: path.relative(path.resolve(__dirname, '../..'), process.env.WALK_GLB), checks: rows, scope: 'Shipped GLB and real TS controller on JS Cocos-node/evaluator doubles; no Creator import, WebGL, foot-contact or visual acceptance.' };
  fs.mkdirSync(path.join(__dirname, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'reports/terminal-boundaries.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
