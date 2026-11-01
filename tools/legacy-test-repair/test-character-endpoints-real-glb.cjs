'use strict';
const assert = require('node:assert/strict');
const { load } = require('../camera-frame-test/load_ts.cjs'), real = require('../camera-frame-test/real_walk.cjs');
const M = load(), W = M.WorldFlowCore, REF = M.CharacterReference.CHARACTER_REFERENCE;
const seat = { seatedControllerRoot: REF.seatedRoot, standingControllerRoot: REF.standingRoot, yawRad: REF.seatYawRad };
const checks = [];
(async () => {
  for (const kind of ['stand', 'sit']) for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
    const r = real.create(M, W), a = r.standin;
    a.cancelAndReset(kind === 'stand' ? { kind: 'seated', seat } : { kind: 'standing', controllerRoot: REF.standingRoot, yawRad: REF.seatYawRad });
    const duration = a.actionSeconds(kind); assert(duration > 0);
    let completions = 0; const p = a.perform({ kind, seat }, new W.Cancellation()).then(() => completions++);
    let frames = 0;
    while (a.diagnostics().action !== null && frames < 1000) { a.advance(dt); frames++; }
    assert.equal(a.diagnostics().action, null, 'real GLB action cannot silently hang'); await p;
    const expected = kind === 'stand' ? REF.standingRoot : REF.seatedRoot;
    assert.deepEqual(Array.from(a.diagnostics().root), Array.from(expected), 'exact authored controller endpoint');
    for (let i = 0; i < 20; i++) a.advance(dt);
    assert.deepEqual(Array.from(a.diagnostics().root), Array.from(expected)); assert.equal(completions, 1);
    checks.push({ kind, fps: Math.round(1 / dt), clipDuration: duration, frames, exactRoot: Array.from(expected), completions });
    a.dispose();
  }
  console.log(JSON.stringify({ status: 'PASS_REAL_GLB_NODE_FK_NOT_COCOS_OR_RENDER', checks, scope: 'Actual shipped GLB and anim_meta evaluated with real controller/AnimRig and JS FK. Strict controller root only; skeletal contact, imported Cocos rendering and visual quality not accepted.' }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
