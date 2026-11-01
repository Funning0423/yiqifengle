'use strict';
// r10 time domain: real FreeOrbit drag / release / step, plus the return's critically damped closed form.
// docs/r5/room-orbit/R10_SPEC.md §4, §5.1, §7, §8.
const assert = require('node:assert/strict');
const M = require('./r10/r10_model.cjs');
const C = M.C;
const L = C.ORBIT_LIMITS.home;
const D2R = Math.PI / 180;
const W_BAR = 0.28;

function poseOf(o) {
  const p = C.roomPoseAt(o.yaw, o.pitch, o.dist);
  const g = C.roomViewDir(o.yaw, o.pitch, L.roomLook);
  return { yaw: o.yaw, pitch: o.pitch, dist: o.dist, w: p.w, f: p.dir, lens: p.pos, g: g };
}
function runCase(fps, y0, rate, dur) {
  const o = new C.FreeOrbit('home'), dt = 1 / fps;
  o.yaw = y0; o.pitch = 10; o.dist = L.distMax; o.mode = 'free';
  const F = [];
  const rec = function (t) { const p = poseOf(o); p.t = t; F.push(p); };
  rec(0);
  let t = 0;
  const nDrag = Math.round(dur / dt);
  for (let i = 0; i < nDrag; i++) { o.drag(rate * dt / C.ORBIT_FEEL.yawPerScreen, 0, dt); o.step(dt); t += dt; rec(t); }
  o.release();
  const nCoast = Math.round(2 / dt);
  for (let i = 0; i < nCoast; i++) { o.step(dt); t += dt; rec(t); }
  let camAcc = 0, camMove = 0, camCoast = 0, back = 0, centreOut = 0;
  const sgn = Math.sign(rate);
  const W = [];
  for (let i = 0; i < F.length - 1; i++) {
    W.push([
      M.omegaPer(F[i].f, F[i + 1].f, dt).map(function (v) { return v * D2R; }),
      M.omegaPer(F[i].g, F[i + 1].g, dt).map(function (v) { return v * D2R; }),
    ]);
  }
  for (let i = 1; i < W.length; i++) {
    const a = [0, 1, 2].map(function (k) { return ((W[i][0][k] - W[i - 1][0][k]) - (W[i][1][k] - W[i - 1][1][k])) / dt / D2R; });
    const m = M.nrm(a);
    if (m > camAcc) camAcc = m;
    if (F[i].t <= dur + 1e-9) { if (m > camMove) camMove = m; }
    else if (m > camCoast) camCoast = m;
  }
  for (let i = 0; i < W.length; i++) if (W[i][0][1] * sgn < -1e-3 * D2R) back++;
  for (let i = 0; i < F.length; i++) if (F[i].w <= W_BAR && M.onScreen(F[i].lens, F[i].f, M.HER_C).e > 1) centreOut++;
  const hd = function (f) { return Math.atan2(f.f[0], f.f[2]) / D2R; };
  const fin = hd(F[F.length - 1]);
  let over = 0;
  const iRel = F.findIndex(function (f) { return f.t > dur - 1e-9; });
  const d0 = M.wrap180(hd(F[iRel]) - fin);
  for (let i = iRel; i < F.length; i++) {
    const d = M.wrap180(hd(F[i]) - fin);
    if (d * d0 < 0) over = Math.max(over, Math.abs(d));
  }
  return { fps: fps, finalYaw: o.yaw, camMove: camMove, camCoast: camCoast, camAcc: camAcc, back: back, centreOut: centreOut, over: over };
}

const cases = [
  ['drag 30 CCW', 0, 30, 2.4],
  ['drag 90 CCW', 0, 90, 1.2],
  ['drag 30 CW', 0, -30, 2.4],
  ['drag 90 CW', 0, -90, 1.2],
  ['flick 160 CCW', 354, 160, 0.2],
  ['flick 160 CW', 354, -160, 0.2],
  ['release mid CCW', 0, 30, 0.9],
  ['release mid CW', 0, -30, 1.4],
  ['release core edge', 0, 30, 0.4],
];
const rows = [];
let centreOut = 0, back = 0, over = 0, coast30 = 0, drag30 = 0, spread = 0;
for (let c = 0; c < cases.length; c++) {
  const name = cases[c][0], y0 = cases[c][1], rate = cases[c][2], dur = cases[c][3];
  const yaw = [];
  for (const fps of [30, 60, 120]) {
    const r = runCase(fps, y0, rate, dur);
    r.name = name;
    rows.push(r);
    yaw.push(r.finalYaw);
    centreOut += r.centreOut;
    back += r.back;
    if (r.over > over) over = r.over;
    if (Math.abs(rate) <= 30) {
      if (r.camCoast > coast30) coast30 = r.camCoast;
      if (r.camMove > drag30) drag30 = r.camMove;
    }
  }
  let d = 0;
  for (let i = 1; i < yaw.length; i++) d = Math.max(d, Math.abs(M.wrap180(yaw[i] - yaw[0])));
  if (d > spread) spread = d;
}

assert.equal(centreOut, 0, 'centre left the frame while w ≤ 0.28');
assert.equal(back, 0, 'view turned against the hand');
assert.ok(over <= 0.5, 'overshoot ' + over);
assert.ok(spread <= 0.05, 'final-yaw spread ' + spread);
assert.ok(coast30 <= 110, '30°/s coast accel ' + coast30);
assert.ok(drag30 <= 110, '30°/s drag accel ' + drag30);

// Scalar critical damping: e0·v0 ≥ 0 never crosses 0, and the step is exact.
function crossings(e0, v0) {
  let e = e0, v = v0, n = 0, prev = e0;
  for (let i = 0; i < 400; i++) {
    const ev = C.critDamp(e, v, 2.5, 1 / 60);
    e = ev[0]; v = ev[1];
    if (prev * e < 0) n++;
    prev = e;
  }
  return n;
}
assert.equal(crossings(1.2, 0), 0, 'from rest');
assert.equal(crossings(1.2, 0.4), 0, 'e0·v0 > 0');
assert.equal(crossings(-0.8, -0.2), 0, 'both negative');
const one = C.critDamp(1, 0.25, 3, 0.1);
const mid = C.critDamp(1, 0.25, 3, 0.05);
const two = C.critDamp(mid[0], mid[1], 3, 0.05);
assert.ok(Math.abs(one[0] - two[0]) < 1e-9 && Math.abs(one[1] - two[1]) < 1e-9, 'critDamp step size');

// Return from rest, and from a same-sign initial view rate, does not overshoot the goal heading.
const FEET = [0.4327299768730942, 0, -4.207611558444886];
function viewOf(pose) {
  const x = pose.target[0] - pose.position[0], y = pose.target[1] - pose.position[1], z = pose.target[2] - pose.position[2];
  const n = Math.hypot(x, y, z) || 1;
  return [x / n, y / n, z / n];
}
function returnOver(fps) {
  const o = new C.FreeOrbit('home'), dt = 1 / fps;
  o.yaw = 64; o.pitch = 10; o.dist = L.distMax; o.mode = 'free';
  o.drag(0.01, 0, dt); o.release();
  const goal = C.roomPoseAt(o.yaw, o.pitch, o.dist);
  const cine = { position: [0.6, 1.9, -1.2], target: [0.43, 1.0, -4.2], fovVerticalDeg: 60 };
  o.beginReturn(cine);
  const heads = [];
  for (let i = 0; i < Math.round(12 / dt); i++) {
    o.step(dt);
    const f = viewOf(o.solve(FEET, [], 0));
    heads.push(Math.atan2(f[0], f[2]) / D2R);
    if (o.mode === 'free' && i > 5) break;
  }
  assert.equal(o.mode, 'free', 'return did not finish at ' + fps + ' fps');
  const fin = heads[heads.length - 1];
  const d0 = M.wrap180(heads[0] - fin);
  let overR = 0;
  for (let i = 0; i < heads.length; i++) {
    const d = M.wrap180(heads[i] - fin);
    if (d * d0 < -1e-6) overR = Math.max(overR, Math.abs(d));
  }
  const end = viewOf(o.solve(FEET, [], 0));
  const dot = end[0] * goal.dir[0] + end[1] * goal.dir[1] + end[2] * goal.dir[2];
  assert.ok(dot > 0.999, 'return did not reach the pure pose');
  return overR;
}
let retOver = 0;
for (const fps of [30, 60, 120]) retOver = Math.max(retOver, returnOver(fps));
assert.ok(retOver <= 0.5, 'return overshoot ' + retOver);

// Camera angular accel of the from-rest return stays ≤ 110.
{
  const o = new C.FreeOrbit('home'), dt = 1 / 60;
  o.yaw = 64; o.pitch = 10; o.dist = L.distMax; o.mode = 'free'; o.drag(0.01, 0, dt); o.release();
  const cine = { position: [0.6, 1.9, -1.2], target: [0.43, 1.0, -4.2], fovVerticalDeg: 60 };
  o.beginReturn(cine);
  const F = [];
  for (let i = 0; i < 12 * 60; i++) {
    o.step(dt);
    const p = o.solve(FEET, [], 0);
    const x = p.target[0] - p.position[0], y = p.target[1] - p.position[1], z = p.target[2] - p.position[2];
    const n = Math.hypot(x, y, z) || 1;
    F.push([x / n, y / n, z / n]);
    if (o.mode === 'free') break;
  }
  let acc = 0;
  const W = [];
  for (let i = 0; i < F.length - 1; i++) W.push(M.omegaPer(F[i], F[i + 1], dt).map(function (v) { return v * D2R; }));
  for (let i = 1; i < W.length; i++) {
    const a = M.nrm([0, 1, 2].map(function (k) { return (W[i][k] - W[i - 1][k]) / dt / D2R; }));
    if (a > acc) acc = a;
  }
  assert.ok(acc <= 110, 'return angular accel ' + acc);
  var returnAcc = +acc.toFixed(1);
}

console.log(JSON.stringify({
  status: 'PASS',
  spreadDeg: +spread.toFixed(4),
  overshootDeg: +over.toFixed(4),
  coast30: +coast30.toFixed(1),
  drag30: +drag30.toFixed(1),
  returnOvershootDeg: +retOver.toFixed(4),
  returnAcc: returnAcc,
  centreOut: centreOut,
  backward: back,
}, null, 1));
