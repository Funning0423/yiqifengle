'use strict';
// r10 framing of FreeOrbit.roomPoseAt (docs/r5/room-orbit/R10_SPEC.md §3, §7).
// Core (w = 0): her body stays inside the 0.9 safe frame. w ≤ 0.28: her centre stays in frame. w* ≥ 0.28.
const assert = require('node:assert/strict');
const M = require('./r10/r10_model.cjs');
const C = M.C;
const H = 0.25, W_BAR = 0.28, SAFE = 0.9;
const PITCHES = [C.ORBIT_LIMITS.home.pitchMinDeg, 10, C.ORBIT_LIMITS.home.pitchMaxDeg];
const DISTS = [C.ORBIT_LIMITS.home.distMax, 2.6, C.ORBIT_LIMITS.home.distMin];

let wStar = 1, wStarSafe = 1, coreOut = 0, coreWorst = 0, centreOut = 0, centreN = 0;
for (const pitch of PITCHES) for (const dist of DISTS) {
  const n = Math.round(360 / H);
  for (let i = 0; i <= n; i++) {
    const th = (i * H) % 360;
    const p = C.roomPoseAt(th, pitch, dist);
    const ce = M.onScreen(p.pos, p.dir, M.HER_C);
    const se = M.herEdge(p.pos, p.dir);
    if (ce.e > 1) wStar = Math.min(wStar, p.w);
    if (se > SAFE) wStarSafe = Math.min(wStarSafe, p.w);
    if (p.w === 0) {
      coreWorst = Math.max(coreWorst, se);
      if (se > SAFE) coreOut++;
    }
    if (p.w <= W_BAR) {
      centreN++;
      if (ce.e > 1) centreOut++;
    }
  }
}

assert.equal(coreOut, 0, 'core safe-frame outs ' + coreOut + ' worst ' + coreWorst);
assert.ok(coreWorst <= SAFE, 'core worst edge ' + coreWorst);
assert.ok(wStar >= W_BAR, 'w* ' + wStar + ' < ' + W_BAR);
assert.equal(centreOut, 0, 'centre leaves the frame in ' + centreOut + ' of ' + centreN + ' poses with w ≤ ' + W_BAR);
assert.equal(C.ORBIT_LIMITS.home.distMin, 1.9);
assert.ok(C.ORBIT_LIMITS.home.roomLook.lensMaxY <= 1.55);

console.log(JSON.stringify({
  status: 'PASS',
  wStar: +wStar.toFixed(3),
  wStarSafe: +wStarSafe.toFixed(3),
  coreOut: coreOut,
  coreWorstEdge: +coreWorst.toFixed(3),
  centrePoses: centreN,
  centreOut: centreOut,
}, null, 1));
