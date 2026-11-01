'use strict';
// r10 curvature sweep of FreeOrbit.roomPoseAt (docs/r5/room-orbit/R10_SPEC.md §7, §8).
// QF_TYPESCRIPT_MODULE must point at typescript.
const assert = require('node:assert/strict');
const M = require('./r10/r10_model.cjs');
const C = M.C;
const KAPPA = 110 / (30 * 30);
const H = 0.25;
const PITCHES = [C.ORBIT_LIMITS.home.pitchMinDeg, 10, C.ORBIT_LIMITS.home.pitchMaxDeg];
const DISTS = [C.ORBIT_LIMITS.home.distMax, 2.6, C.ORBIT_LIMITS.home.distMin];

function sweep(poseFn) {
  let maxCurv = 0, maxCurvAt = 0, maxPos = 0, minJ = 9, maxJ = 0, minHer = 9, minWall = 9, maxY = 0;
  for (const pitch of PITCHES) for (const dist of DISTS) {
    const n = Math.round(360 / H), S = [];
    for (let i = -2; i <= n + 2; i++) {
      const th = ((i * H) % 360 + 360) % 360;
      const p = poseFn(th, pitch, dist);
      S.push({ th: i * H, f: p.f, lens: p.lens, w: p.w });
    }
    const Om = [];
    for (let i = 0; i < S.length - 1; i++) Om.push(M.omegaPer(S[i].f, S[i + 1].f, H));
    for (let i = 2; i < S.length - 2; i++) {
      const s = S[i];
      const curv = M.nrm(M.sub(Om[i], Om[i - 1])) / H;
      const J = M.nrm(Om[i]);
      const pc = M.nrm([0, 1, 2].map(function (k) { return (S[i + 1].lens[k] - 2 * s.lens[k] + S[i - 1].lens[k]) / H / H; }));
      if (curv > maxCurv) { maxCurv = curv; maxCurvAt = s.th; }
      if (pc > maxPos) maxPos = pc;
      if (Om[i][1] < minJ) minJ = Om[i][1];
      if (J > maxJ) maxJ = J;
      const her = M.herGap(s.lens);
      const wall = M.wallGap(s.lens[0], s.lens[2]);
      if (her < minHer) minHer = her;
      if (wall < minWall) minWall = wall;
      if (s.lens[1] > maxY) maxY = s.lens[1];
    }
  }
  return { maxCurv: maxCurv, maxCurvAt: maxCurvAt, maxPos: maxPos, minJ: minJ, maxJ: maxJ, minHer: minHer, minWall: minWall, maxY: maxY };
}

function codePose(th, pitch, dist) {
  const p = C.roomPoseAt(th, pitch, dist);
  return { f: p.dir, lens: p.pos, w: p.w };
}

const code = sweep(codePose);
const model = sweep(function (th, pitch, dist) { return M.poseR10(th, pitch, dist); });
const rel = Math.abs(code.maxCurv - model.maxCurv) / model.maxCurv;

assert.ok(code.maxCurv <= KAPPA + 1e-9, 'curvature ' + code.maxCurv + ' > ' + KAPPA);
assert.ok(code.minJ >= -1e-9, 'view turns against the hand, min J ' + code.minJ);
assert.ok(code.maxJ <= 1.5, 'jump per input degree ' + code.maxJ);
assert.ok(code.minHer >= 1.0, 'lens to her ' + code.minHer);
assert.ok(code.minWall >= 0.25, 'lens to wall ' + code.minWall);
assert.ok(code.maxY <= 1.55 + 1e-6, 'lens height ' + code.maxY);
assert.ok(rel <= 0.10, 'curvature differs from the spec model by ' + (rel * 100).toFixed(2) + '%');
assert.equal(C.ORBIT_LIMITS.home.distMin, 1.9);
assert.ok(C.ORBIT_LIMITS.home.roomLook.lensMaxY <= 1.55);

// Core-edge line accel (report): θ near 7.5°, dist 3.35, pitch 10. a = |d²p/dθ²| · ω².
const curve = [];
const pitch = 10, dist = C.ORBIT_LIMITS.home.distMax, h = 0.25;
for (let th = 4; th <= 11.01; th += 0.5) {
  const p0 = C.roomPoseAt(th - h, pitch, dist).pos;
  const p1 = C.roomPoseAt(th, pitch, dist).pos;
  const p2 = C.roomPoseAt(th + h, pitch, dist).pos;
  const pp = Math.hypot(p2[0] - 2 * p1[0] + p0[0], p2[1] - 2 * p1[1] + p0[1], p2[2] - 2 * p1[2] + p0[2]) / h / h;
  curve.push({ th: +th.toFixed(1), pp: +pp.toFixed(5), a30: +(pp * 900).toFixed(2), a90: +(pp * 8100).toFixed(1) });
}

console.log(JSON.stringify({
  status: 'PASS',
  maxCurv: +code.maxCurv.toFixed(4),
  modelCurv: +model.maxCurv.toFixed(4),
  curvRel: +rel.toFixed(4),
  maxCurvAt: code.maxCurvAt,
  minJ: +code.minJ.toFixed(3),
  maxJ: +code.maxJ.toFixed(3),
  minHer: +code.minHer.toFixed(3),
  minWall: +code.minWall.toFixed(3),
  maxY: +code.maxY.toFixed(3),
  maxPosCurv: +code.maxPos.toFixed(5),
  lineAt30: +(code.maxPos * 900).toFixed(2),
  lineAt90: +(code.maxPos * 8100).toFixed(1),
  edgeCurve: curve,
}, null, 1));
