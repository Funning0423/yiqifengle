/**
 * Free orbit around the girl. No engine import: the math is the same in the WeChat build and in node tests.
 * Yaw is unlimited except on the board. Pitch and distance come from ORBIT_LIMITS.
 * A cinematic calls pause(); the next free frame calls beginReturn() and eases back to the saved orbit.
 * Collision is a handful of AABBs plus a ground plane and, indoors, a keep-inside box. No per-frame mesh raycast.
 */
export type Vec3 = readonly [number, number, number];
export type LookPose = Readonly<{ position: Vec3; target: Vec3; fovVerticalDeg: number }>;
export type OrbitPlace = 'home' | 'island' | 'meadow' | 'skycity' | 'lakeside' | 'board';
export type OrbitMode = 'idle' | 'free' | 'paused' | 'board' | 'returning';
/** `name` (node name) is optional; indoors it lets the room's own volumes be skipped (see orbitIgnoresBox). */
export type OrbitBox = Readonly<{ min: Vec3; max: Vec3; name?: string }>;
/**
 * 运镜bot r5 room look (docs/r5/room-orbit/RESULT.md). Indoors the arm toward a wall gets short. Instead of hugging her
 * face, the lens blends toward a fixed point near the room centre and turns in place there, so every yaw shows the room.
 * The view direction is the orbit's own at every blend weight (she may leave the frame), so turning never jumps.
 * w = smootherstep((blendFromM - r) / (blendFromM - blendFullM)). r is the smooth wall-limited arm: soft-min of the
 * keepInside exits in XZ, divided by cos(pitch). pivotOffset: the orbit pivots on her seated body centre (in plan)
 * instead of the look point. viewTiltDeg: the view looks this much further down than the orbit direction.
 * r6: only the lens POSITION is rate-limited / accel-capped / wall-guarded. The view direction is the orbit direction
 * itself, -u(yaw, pitch + viewTiltDeg), at every blend weight: a pure function of the player's yaw/pitch, so it never
 * lags the input and the blend never turns it; only a cinematic return turns it with
 * the capped angular follower (drag is ignored while returning), and the first drag inherits the authored view.
 */
/* r7 framing: in the orbit-her zone the view aims from the static goal lens at her body centre (pivot + frameOffset),
 * fading to the room view as w goes aimFadeFromW → aimFadeW: still a pure function of the input (no lag), and it frames her even where the
 * lens height is clamped (low pitch) or the blend has moved the lens off the orbit axis. framePts (relative to the pivot:
 * her seated body's extremes) re-centre that aim on her projected extent (smooth max/min, so it never kinks).
 * lensMaxY: soft ceiling for the lens (keeps it out from under the hanging props' clearance, where clearPose would pull
 * the arm short). pivotShift: around yawDeg ± halfDeg (smooth cosine window) the orbit pivot moves by `offset`, so a
 * wall-limited arm (yaw ~300-315, the west wall) runs longer and frames her whole body; the framing still aims at her. */
/** r10 (docs/r5/room-orbit/R10_SPEC.md): one yaw weight, analytic wall envelope, pure pose. blendFromM / aim fades stay on the type and are unused on this path. */
export type RoomR10 = Readonly<{ edgeA: number; edgeB: number; bandDeg: number; satDeg: number; envK: number; gazeM: number }>;
export type RoomLook = Readonly<{ center: Vec3; blendFromM: number; blendFullM: number; pivotOffset?: Vec3; viewTiltDeg?: number; frameOffset?: Vec3; aimFadeW?: number; aimFadeFromW?: number; framePts?: readonly Vec3[]; lensMaxY?: number; pivotShift?: Readonly<{ yawDeg: number; halfDeg: number; offset: Vec3 }>; lensCentreOffset?: Vec3; armGrowZM?: number; viewDownMinDeg?: number; viewDownMaxDeg?: number; viewDownSoftDeg?: number; centreFadeW?: number; r10?: RoomR10 }>;
export type OrbitLimits = Readonly<{
  pitchMinDeg: number;
  pitchMaxDeg: number;
  distMin: number;
  distMax: number;
  /** Half-width around the heading captured when the board opens. Infinity = free yaw. */
  yawHalfDeg: number;
  lookM: number;
  fovDeg: number;
  /** Indoor only: the lens stays inside this volume and shortens the arm instead of crossing a wall. */
  keepInside?: Readonly<{ min: Vec3; max: Vec3; cornerM?: number }>;
  /** Indoor only: blend toward the room centre when the wall-limited arm is short. Needs keepInside. */
  roomLook?: RoomLook;
  /** Distance-based pitch floor (meadow): pitchMin(d) = nearDeg + (farDeg - nearDeg) * smoothstep(fromM, toM, d), d = arm.
   *  pitchMinDeg stays the absolute floor (= farDeg). See orbitPitchFloor and PITCH_FLOOR_FEEL. */
  pitchFloor?: Readonly<{ nearDeg: number; farDeg: number; fromM: number; toM: number }>;
  /** b15 reveal (lakeside): FOV widens by up to fovAddDeg as the orbit yaw leaves the seeded (board) yaw, smootherstep over
   *  fullDeg. A pure function of yaw: zero deviation = the seeded lens exactly; turning back restores it with no state. */
  revealWiden?: Readonly<{ fovAddDeg: number; fullDeg: number }>;
  /** b16 reveal compose (lakeside): the aim point rises by up to aimUpM with the same smootherstep weight as revealWiden
   *  (0 at the seeded board yaw, full at revealWiden.fullDeg), so the balloon + her block sits centred instead of her
   *  at the frame centre with an empty foreground. Lens position (pivot, arm, clearance) is unchanged. */
  revealLift?: Readonly<{ aimUpM: number }>;
  /** b15 seed aim blend: the first drags carry the seeded lens's own aim point (on its view ray, at the arm's reach, held
   *  relative to her look point) over to her look point, smootherstep on accumulated |yaw|+|pitch| input over
   *  max(minDeg, perJumpDeg × the seed aim gap in deg). A pure function of input: no jump at drag start, no overshoot. */
  seedAimBlend?: Readonly<{ minDeg: number; perJumpDeg: number }>;
}>;

/** revealWiden FOV add (deg) at a yaw deviation (deg, any wrap). 0 when the place has none. */
/** revealLift aim rise (m) at a yaw deviation (deg). 0 without revealLift/revealWiden. */
export function revealLiftM(limits: OrbitLimits, devDeg: number): number {
  const l = limits.revealLift, r = limits.revealWiden;
  if (!l || !r || !(r.fovAddDeg > 0)) return 0;
  return l.aimUpM * revealWidenDeg(limits, devDeg) / r.fovAddDeg;
}
export function revealWidenDeg(limits: OrbitLimits, devDeg: number): number {
  const r = limits.revealWiden;
  if (!r || !(r.fullDeg > 0)) return 0;
  let d = devDeg % 360; if (d > 180) d -= 360; if (d < -180) d += 360;
  const u = Math.min(1, Math.abs(d) / r.fullDeg);
  return r.fovAddDeg * u * u * u * (u * (u * 6 - 15) + 10);
}
/** Pitch is the camera's elevation above her chest. Distance is metres from that point. */
export const ORBIT_LIMITS: Readonly<Record<OrbitPlace, OrbitLimits>> = Object.freeze({
  home: { pitchMinDeg: -14, pitchMaxDeg: 26, distMin: 1.9, distMax: 3.35, yawHalfDeg: Infinity, lookM: 1.05, fovDeg: 60,
    // 运镜bot r5 (docs/r5/room-keepinside/RESULT.md): measured from the room's inner walls (round shell, inradius 2.31 m about
    // x 0, z -2.6), the wall cabinets and the desk. Every point of this box is ≥0.30 m from the inner walls; the old
    // -1.85..1.05 x -4.72..-1.55 box reached through the round wall at yaw 270 and into the west cabinet at 315 (black frames).
    keepInside: { min: [-1.1, 0.85, -4.45], max: [1.05, 2.2, -0.9], cornerM: 0.5 },
    // r6 framing: seated A1 (sit_hold, frame 24) body box x -0.19..0.62, y 0..1.19, z -4.63..-4.02. The pivot moves 0.2 m
    // toward its plan centre in x (x 0.23; z cannot move: the pivot must stay inside the 0.2 m inset keepInside, z ≥ -4.25;
    // the look height stays, so the arm still keeps ≥1.0 m off her look point) and the view tilts 8° down, so a short arm
    // (yaw ~315) frames her body instead of her hat.
    roomLook: { center: [0, 1.55, -2.5], blendFromM: 2.1, blendFullM: 1.6, pivotOffset: [-0.2, 0, 0], viewTiltDeg: 8, lensMaxY: 1.55, lensCentreOffset: [-0.017, 0, -0.12], armGrowZM: 0.15,
      viewDownMinDeg: 9, viewDownMaxDeg: 31, viewDownSoftDeg: 3, centreFadeW: 0.5,
      r10: { edgeA: 330, edgeB: 14, bandDeg: 50, satDeg: 30, envK: 3, gazeM: 1.9 },
      framePts: [[-0.42,-1.05,-0.23],[-0.33,-0.83,0.02],[-0.32,-0.57,-0.29],[-0.36,-0.53,-0.17],[-0.36,-0.6,-0.07],[0.08,0.01,0.15],[0.1,0.05,-0.15],[0.03,0.05,-0.03],[-0.29,-1.05,-0.35],[-0.33,-1.05,-0.13],[-0.21,-0.74,-0.41],[0.16,0.14,0.01],[-0.15,-1.05,-0.24],[0.26,-0.74,0.09],[-0.14,-0.83,-0.42],[0.25,0.1,0.14],[0.04,-0.97,-0.13],[0.27,-0.03,0.16],[0.29,0.01,-0.19],[0.29,0.12,-0.07],[0.38,-0.03,-0.06],[0.37,0.07,0.08]] } },
  island: { pitchMinDeg: -8, pitchMaxDeg: 58, distMin: 4.2, distMax: 52, yawHalfDeg: Infinity, lookM: 1.15, fovDeg: 42 },
  // r5 meadow pitch floor (场景特效bot): close in, the lens may not dip as far below her chest: -8 at 3.2 m to -12 at 14 m.
  meadow: { pitchMinDeg: -12, pitchMaxDeg: 48, distMin: 3.2, distMax: 14, yawHalfDeg: Infinity, lookM: 1.15, fovDeg: 48,
    pitchFloor: { nearDeg: -8, farDeg: -12, fromM: 3.2, toM: 14 } },
  skycity: { pitchMinDeg: -6, pitchMaxDeg: 55, distMin: 4, distMax: 22, yawHalfDeg: Infinity, lookM: 1.25, fovDeg: 48 },
  // b15: pitchMax 42 -> 54 and distMax 16 -> 16.5 so the landscape board lens (pitch 53.3, 16.16 m from her look point)
  // seeds without a clamp (the old limits moved the lens on the first drag). revealWiden: moored balloon reveal (+8 deg max).
  lakeside: { pitchMinDeg: -10, pitchMaxDeg: 54, distMin: 3.6, distMax: 16.5, yawHalfDeg: Infinity, lookM: 1.15, fovDeg: 48,
    revealWiden: { fovAddDeg: 8, fullDeg: 70 }, revealLift: { aimUpM: 2.0 }, seedAimBlend: { minDeg: 18, perJumpDeg: 1.6 } },
  board: { pitchMinDeg: -2, pitchMaxDeg: 2, distMin: 6.6, distMax: 7.8, yawHalfDeg: 4, lookM: 1.1, fovDeg: 48 },
});

export const ORBIT_FEEL = Object.freeze({
  yawPerScreen: 128,
  pitchPerScreen: 72,
  velTauS: 0.16,
  maxYawVel: 160,
  maxPitchVel: 80,
  maxDistVel: 8,
  returnS: 0.55,
  clearM: 0.6,
  groundClearM: 0.45,
  /** Shells bigger than this are sky, sea or a merged island. Being inside one is not a hit. */
  shellM: 16,
});
/** Pitch floor at arm length `dist`: limits.pitchMinDeg unless the place has a distance-based pitchFloor. */
export function orbitPitchFloor(limits: OrbitLimits, dist: number): number {
  const f = limits.pitchFloor;
  if (!f) return limits.pitchMinDeg;
  const t = Math.max(0, Math.min(1, (dist - f.fromM) / (f.toM - f.fromM)));
  return Math.max(limits.pitchMinDeg, f.nearDeg + (f.farDeg - f.nearDeg) * t * t * (3 - 2 * t));
}
/** When a pinch raises the pitch floor above the current pitch, the pitch eases up to it (never snaps): rate follows a
 *  braking curve sqrt(2 * brake * gap), capped at vMax, and changes by at most accDegS2 (pitch accel = the view's angular
 *  accel here, the view looks along the arm). brake <= acc / 2 keeps the last step onto the floor inside acc too.
 *  Well inside the 120 deg/s^2 HANDOFF cap. */
export const PITCH_FLOOR_FEEL = Object.freeze({ accDegS2: 60, brakeDegS2: 25, vMaxDegS: 20 });
const SMOOTH = (u: number) => { const x = Math.max(0, Math.min(1, u)); return x * x * x * (x * (x * 6 - 15) + 10); };
/** Room look tuning. softK: soft-min sharpness (larger = closer to a hard min). edgeSoftM: width of the smooth clamp to
 *  the keepInside height. insetM: the goal stays this far inside the rounded keepInside. goalSpeedMS: the goal moves
 *  through valid static poses (filtered yaw/pitch/arm) at no more than this speed, so along the edges it never outruns the
 *  tracker. The lens then follows that goal with a critically damped tracker (natural frequency omega)
 *  whose acceleration is capped below HANDOFF §4 (3 m/s², 120°/s²), so nothing indoors can jump: not the blend, not a
 *  keepInside corner, not the first drag after the authored lens, not the return after a cinematic. The goal keeps
 *  insetM inside keepInside. seedFadeS: the authored view's leftover tilt fades over this after the first drag.
 *  Last, a wall-normal safety: from safeFromM inside the rounded keepInside edge to safeToM
 *  outside it, the outward normal velocity is cancelled smoothly (tangential motion untouched), so the lens cannot cross
 *  keepInside + safeToM, which is still ≥0.25 m from the inner walls. */
export const ROOM_LOOK_FEEL = Object.freeze({ softK: 8, edgeSoftM: 0.08, insetM: 0.2, goalSpeedMS: 0, seedFadeS: 0.8, omega: 24, linAccMS2: 2.0, angAccDegS2: 100, safeFromM: 0.03, safeToM: 0.06,
  jerkMS3: 30, ffMaxMS: 0, ffTauS: 0.08, brakeMS2: 2.0, vMaxMS: 1.8, barrierAccMS2: 2.0, barrierK: 12, barrierWallM: -0.15, barrierLookS: 0.25, barrierHerM: 1.06 });
/** r7 position follower (docs/r5/room-orbit/RESULT.md): goalSpeedMS 0 = the goal is the input's own static goal (no
 *  parameter rate limit). The lens tracks it with velocity feed-forward (goal velocity, capped ffMaxMS), natural frequency
 *  omega, |accel| ≤ linAccMS2 and |jerk| ≤ jerkMS3. Two smooth barriers shape the commanded accel: the outward speed toward
 *  keepInside + barrierWallM, and the speed toward her (look point) inside barrierHerM, may not exceed √(2·barrierAccMS2·d)
 *  (d = room left), enforced with gain barrierK. The wall-normal velocity cancel (safeFromM..safeToM) stays as a last resort. */
/** Room volumes that wrap the whole interior. Indoors they say nothing about obstacles; keepInside does that job. */
const ROOM_VOLUME = /interior_shell|interior_props_merged|lighthouse_ext/i;
function contains(b: OrbitBox, p: Vec3): boolean {
  return p[0] >= b.min[0] && p[0] <= b.max[0] && p[1] >= b.min[1] && p[1] <= b.max[1] && p[2] >= b.min[2] && p[2] <= b.max[2];
}
/** A box that holds both her (look point) and the lens is a room or a hull around them, not an obstacle. Indoors the
 *  room shell, the merged furniture and the lighthouse exterior are skipped by name as well. */
export function orbitIgnoresBox(b: OrbitBox, her: Vec3, lens: Vec3, indoor: boolean): boolean {
  if (contains(b, her) && contains(b, lens)) return true;
  return indoor && !!b.name && ROOM_VOLUME.test(b.name);
}
/** p-norm soft minimum of two positive lengths, always ≤ the hard min and C∞ while both stay positive. */
/**
 * r8 view (docs/r5/room-orbit/RESULT.md). In the orbit-her zone the view looks at her body centre from the lens itself
 * (L: look-at, framed with frameCentre); in the room-centre zone it is the input's own view G. The view V (yaw, pitch) is
 * carried from frame to frame: each solve it turns by s·ΔG + (1−s)·ΔL, i.e. it passes on the share s of the input's own turn
 * and the share 1−s of her direction's turn, and a correction rate c (braking curve, |c'| ≤ corrAccDegS2, jerk-limited)
 * pulls it onto V* = L + s·(G − L). The weight s follows its target with |s'|·|ω_G − ω_L| ≤ blendAccDegS2 (the view's
 * accel from re-weighting the two turn rates) and |s''|·|ω_G − ω_L| ≤ blendJerkDegS3, so the transition never steps the
 * angular velocity: what the camera adds to the input's accel is s'·(ω_G − ω_L) + (1−s)·α_L + c'. Target: the input's
 * w, except when the input will reach the orbit zone within predictBaseS + |input rate|/predictAccDegS2 (then the smallest
 * w on the way, so the view slows onto her before), or will leave it (then at most what keeps her centre within exitDeg).
 * (The r7 aim-assist bias is gone.) seedAccDegS2: the first-drag leftover fades within this accel.
 */
export const ROOM_VIEW = { blendAccDegS2: 30, blendJerkDegS3: 900, sAccMax: 6, sVMax: 3, sOmega: 12, corrAccDegS2: 65, corrBrakeDegS2: 50,
  corrVMaxDegS: 90, corrOmega: 20, corrJerkDegS3: 1500, exitDeg: 9, seedAccDegS2: 45, predictBaseS: 0.8, predictAccDegS2: 90, predictMaxS: 1.2,
  predictSteps: 8, rateTauS: 0.15 };
export function softMin(a: number, b: number, k: number = ROOM_LOOK_FEEL.softK): number {
  if (!(a > 0) || !(b > 0)) return 0;
  return Math.pow(Math.pow(a, -k) + Math.pow(b, -k), -1 / k);
}
const softplus = (x: number) => (x > 30 ? x : Math.log(1 + Math.exp(x)));
/** Smooth clamp into (lo, hi): C∞, equal to v (to ~1e-6 m) more than 1 m inside, never outside. */
export function softClamp(v: number, lo: number, hi: number, s: number = ROOM_LOOK_FEEL.edgeSoftM): number {
  const a = lo + s * softplus((v - lo) / s);
  return hi - s * softplus((hi - a) / s);
}
/** Signed distance (plan, XZ) to keepInside with rounded corners: < 0 inside. `inset` shrinks it. Also returns the
 *  outward normal. The rounded rectangle is convex and C1, so the exit distance below is smooth in yaw. */
export function roomEdge(x: number, z: number, box: Readonly<{ min: Vec3; max: Vec3; cornerM?: number }>, inset: number = 0): { s: number; nx: number; nz: number } {
  const cx = (box.min[0] + box.max[0]) / 2, cz = (box.min[2] + box.max[2]) / 2;
  const hx = (box.max[0] - box.min[0]) / 2 - inset, hz = (box.max[2] - box.min[2]) / 2 - inset;
  const r = Math.max(0, Math.min(box.cornerM || 0, hx - 0.01, hz - 0.01));
  const qx = Math.abs(x - cx) - (hx - r), qz = Math.abs(z - cz) - (hz - r), sx = x >= cx ? 1 : -1, sz = z >= cz ? 1 : -1;
  if (qx > 0 && qz > 0) { const L = Math.hypot(qx, qz); return { s: L - r, nx: sx * qx / L, nz: sz * qz / L }; }
  if (qx > qz) return { s: qx - r, nx: sx, nz: 0 };
  return { s: qz - r, nx: 0, nz: sz };
}
/** Wall-limited arm from the look point along yaw/pitch to the (inset, rounded) keepInside edge in XZ, / cos pitch. */
export function roomArm(look: Vec3, yawDeg: number, pitchDeg: number, box: Readonly<{ min: Vec3; max: Vec3; cornerM?: number }>, inset: number = 0): number {
  const yr = yawDeg * Math.PI / 180, hx = Math.sin(yr), hz = Math.cos(yr);
  if (roomEdge(look[0], look[2], box, inset).s >= 0) return 0;
  let t = 0;
  for (let i = 0; i < 80; i++) { const e = roomEdge(look[0] + hx * t, look[2] + hz * t, box, inset); if (e.s > -1e-6) break; t += -e.s; }
  return t / Math.max(0.2, Math.cos(pitchDeg * Math.PI / 180));
}
/** Re-aim h (from q) so the smooth extent of `pts` (relative to `pivot`) is centred, in tan space; two passes. */
export function frameCentre(q: Vec3, h0: Vec3, pivot: Vec3, pts: readonly Vec3[]): Vec3 {
  let h: Vec3 = [h0[0], h0[1], h0[2]];
  const K = 40;
  for (let it = 0; it < 2; it++) {
    const rn = Math.hypot(h[2], h[0]) || 1, r: Vec3 = [-h[2] / rn, 0, h[0] / rn], u: Vec3 = [r[1] * h[2] - r[2] * h[1], r[2] * h[0] - r[0] * h[2], r[0] * h[1] - r[1] * h[0]];
    let mx = -1e9, Mx = -1e9, my = -1e9, My = -1e9;
    const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const d0 = pivot[0] + pts[i][0] - q[0], d1 = pivot[1] + pts[i][1] - q[1], d2 = pivot[2] + pts[i][2] - q[2];
      const z = Math.max(0.05, d0 * h[0] + d1 * h[1] + d2 * h[2]), x = (d0 * r[0] + d1 * r[1] + d2 * r[2]) / z, y = (d0 * u[0] + d1 * u[1] + d2 * u[2]) / z;
      xs.push(x); ys.push(y); Mx = Math.max(Mx, x); mx = Math.max(mx, -x); My = Math.max(My, y); my = Math.max(my, -y);
    }
    let sMx = 0, smx = 0, sMy = 0, smy = 0;
    for (let i = 0; i < xs.length; i++) { sMx += Math.exp(K * (xs[i] - Mx)); smx += Math.exp(K * (-xs[i] - mx)); sMy += Math.exp(K * (ys[i] - My)); smy += Math.exp(K * (-ys[i] - my)); }
    const cx = ((Mx + Math.log(sMx) / K) - (mx + Math.log(smx) / K)) / 2, cy = ((My + Math.log(sMy) / K) - (my + Math.log(smy) / K)) / 2;
    const m: Vec3 = [h[0] + r[0] * cx + u[0] * cy, h[1] + r[1] * cx + u[1] * cy, h[2] + r[2] * cx + u[2] * cy], n = Math.hypot(m[0], m[1], m[2]) || 1;
    h = [m[0] / n, m[1] / n, m[2] / n];
  }
  return h;
}
/** Lateral lens shift (along the view's horizontal right) that centres the smooth x-extent of `pts` (relative to
 *  `pivot`) seen from q along the fixed view f. Position only: the view is not touched. Two passes. */
export function frameShift(q: Vec3, f: Vec3, pivot: Vec3, pts: readonly Vec3[]): number {
  const rn = Math.hypot(f[2], f[0]) || 1, r: Vec3 = [-f[2] / rn, 0, f[0] / rn], K = 40;
  let sh = 0;
  for (let it = 0; it < 2; it++) {
    let Mx = -1e9, mx = -1e9, zc = 0;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const d0 = pivot[0] + pts[i][0] - q[0] - r[0] * sh, d1 = pivot[1] + pts[i][1] - q[1], d2 = pivot[2] + pts[i][2] - q[2] - r[2] * sh;
      const z = Math.max(0.3, d0 * f[0] + d1 * f[1] + d2 * f[2]), x = (d0 * r[0] + d2 * r[2]) / z;
      xs.push(x); zc += z; Mx = Math.max(Mx, x); mx = Math.max(mx, -x);
    }
    let a = 0, b = 0;
    for (let i = 0; i < xs.length; i++) { a += Math.exp(K * (xs[i] - Mx)); b += Math.exp(K * (-xs[i] - mx)); }
    const cx = ((Mx + Math.log(a) / K) - (mx + Math.log(b) / K)) / 2;
    sh += cx * zc / xs.length;
  }
  return sh;
}
/** The room view direction: the orbit direction (toward the pivot), tilted down by viewTiltDeg. Input only. */
export function roomViewDir(yawDeg: number, pitchDeg: number, look: RoomLook): Vec3 {
  let vd = pitchDeg + (look.viewTiltDeg || 0);
  if (look.viewDownMinDeg !== undefined && look.viewDownMaxDeg !== undefined) vd = softClamp(vd, look.viewDownMinDeg, look.viewDownMaxDeg, look.viewDownSoftDeg || 3);
  const yr = yawDeg * Math.PI / 180, pv = vd * Math.PI / 180, c = Math.cos(pv);
  return [-Math.sin(yr) * c, -Math.sin(pv), -Math.cos(yr) * c];
}
/** Blend weight 0 (orbit her) .. 1 (look out from the room centre). Smootherstep, C2. Kept for callers; r10 does not use the arm band. */
export function roomBlend(arm: number, look: RoomLook): number {
  return SMOOTH((look.blendFromM - arm) / (look.blendFromM - look.blendFullM));
}
/** Exact critically damped step (R10_SPEC §4.3). e(t)=(e0+(v0+ω e0)t)e^{−ωt}, v(t)=(v0−ω(v0+ω e0)t)e^{−ωt}. */
export function critDamp(e0: number, v0: number, omega: number, dt: number): [number, number] {
  if (!(dt > 0) || !(omega > 0)) return [e0, v0];
  const decay = Math.exp(-omega * dt), b = v0 + omega * e0;
  return [(e0 + b * dt) * decay, (v0 - omega * b * dt) * decay];
}
const R10_FEET: Vec3 = [0.4327299768730942, 0, -4.207611558444886];
function r10of(look: RoomLook): RoomR10 {
  return look.r10 || { edgeA: 330, edgeB: 14, bandDeg: 50, satDeg: 30, envK: 3, gazeM: 1.9 };
}
/** Angular distance outside the orbit core [edgeA, edgeB], and which side (±1, or 0 inside). */
function roomBand(theta: number, edgeA: number, edgeB: number): { e: number; side: number } {
  const a = wrap180(theta - edgeA), b = wrap180(theta - edgeB), span = wrap180(edgeB - edgeA), c = wrap180(theta - edgeA);
  if (c >= 0 && c <= span + 1e-9) return { e: 0, side: 0 };
  const ea = -a, eb = b;
  if (ea > 0 && (eb <= 0 || ea < eb)) return { e: ea, side: -1 };
  return { e: eb, side: 1 };
}
function roomOrbitYaw(theta: number, edgeA: number, edgeB: number, satW: number): number {
  const o = roomBand(theta, edgeA, edgeB);
  if (o.side === 0) return theta;
  const t = o.e / satW, g = t < 1 ? t - t * t / 2 : 0.5, edge = o.side < 0 ? edgeA : edgeB;
  return edge + o.side * satW * g;
}
/** §2.1 weight. Smootherstep of the yaw distance outside the core; pitch and distance do not enter. */
export function roomYawWeight(theta: number, look: RoomLook): number {
  const P = r10of(look);
  return SMOOTH(roomBand(theta, P.edgeA, P.edgeB).e / P.bandDeg);
}
function lensOrigin(look: Vec3, R: RoomLook): Vec3 {
  const lc = R.lensCentreOffset || [0, 0, 0];
  return [look[0] + lc[0], look[1] + lc[1], look[2] + lc[2]];
}
/** Horizontal wall radius E(ψ): p-norm of the east, west and north inset walls (R10_SPEC §2.3). */
function wallRadius(lo: Vec3, yawDeg: number, box: Readonly<{ min: Vec3; max: Vec3 }>, inset: number, k: number): number {
  const yr = yawDeg * Math.PI / 180, s = Math.sin(yr), c = Math.cos(yr);
  const gE = box.max[0] - inset - lo[0], gW = lo[0] - (box.min[0] + inset), gN = box.max[2] - inset - lo[2];
  const pe = s > 0 && gE > 0 ? Math.pow(s / gE, k) : 0;
  const pw = -s > 0 && gW > 0 ? Math.pow(-s / gW, k) : 0;
  const pn = c > 0 && gN > 0 ? Math.pow(c / gN, k) : 0;
  const sum = pe + pw + pn;
  if (!(sum > 0)) return 1e6;
  return Math.pow(sum, -1 / k);
}
function planRho(lo: Vec3, yawDeg: number, pitchDeg: number, dist: number, box: Readonly<{ min: Vec3; max: Vec3 }>, inset: number, k: number): number {
  return softMin(dist * Math.cos(pitchDeg * Math.PI / 180), wallRadius(lo, yawDeg, box, inset, k));
}
/**
 * r10 plan envelope ρh = softMin(dist·cos pitch, E(ψ)) about the seated home pivot (R10_SPEC §2.3).
 * `roomArm` stays for other callers; the room orbit does not use it.
 */
export function roomEnvelope(yawDeg: number, pitchDeg: number, dist: number): number {
  const L = ORBIT_LIMITS.home, R = L.roomLook!, P = r10of(R), o = R.pivotOffset || [0, 0, 0];
  const look: Vec3 = [R10_FEET[0] + o[0], R10_FEET[1] + L.lookM + o[1], R10_FEET[2] + o[2]];
  const psi = roomOrbitYaw(yawDeg, P.edgeA, P.edgeB, P.satDeg);
  return planRho(lensOrigin(look, R), psi, pitchDeg, dist, L.keepInside!, ROOM_LOOK_FEEL.insetM, P.envK);
}
function bodyCentre(look: Vec3, pts: readonly Vec3[] | undefined): Vec3 {
  if (!pts || !pts.length) return [look[0], look[1], look[2]];
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    if (p[2] < z0) z0 = p[2]; if (p[2] > z1) z1 = p[2];
  }
  return [look[0] + (x0 + x1) / 2, look[1] + (y0 + y1) / 2, look[2] + (z0 + z1) / 2];
}
export type RoomPose = { pos: Vec3; dir: Vec3; w: number; arm: number };
/** Seated-home r10 pose. Same numbers as roomGoalAt at the seated pivot. */
export function roomPoseAt(yaw: number, pitch: number, dist: number): RoomPose {
  const L = ORBIT_LIMITS.home, R = L.roomLook!, o = R.pivotOffset || [0, 0, 0];
  const look: Vec3 = [R10_FEET[0] + o[0], R10_FEET[1] + L.lookM + o[1], R10_FEET[2] + o[2]];
  return roomPoseLook(L, look, yaw, pitch, dist);
}
function roomPoseLook(limits: OrbitLimits, look: Vec3, yaw: number, pitch: number, dist: number): RoomPose {
  const R = limits.roomLook!, box = limits.keepInside!, n = ROOM_LOOK_FEEL.insetM, P = r10of(R);
  const w = roomYawWeight(yaw, R), psi = roomOrbitYaw(yaw, P.edgeA, P.edgeB, P.satDeg);
  const lo = lensOrigin(look, R);
  const pr = pitch * Math.PI / 180, yr = psi * Math.PI / 180, cp = Math.cos(pr);
  const rho = planRho(lo, psi, pitch, dist, box, n, P.envK), d = cp > 0.2 ? rho / cp : rho / 0.2;
  const u0 = Math.sin(yr) * cp, u1 = Math.sin(pr), u2 = Math.cos(yr) * cp;
  const yTop = Math.min(box.max[1] - n, R.lensMaxY || 1e9);
  const orbit: Vec3 = [lo[0] + u0 * d, softClamp(lo[1] + u1 * d, box.min[1] + n, yTop), lo[2] + u2 * d];
  const c = R.center;
  const pos: Vec3 = [orbit[0] + (c[0] - orbit[0]) * w, orbit[1] + (c[1] - orbit[1]) * w, orbit[2] + (c[2] - orbit[2]) * w];
  const her = bodyCentre(look, R.framePts);
  const hx = her[0] - orbit[0], hy = her[1] - orbit[1], hz = her[2] - orbit[2], hr = Math.hypot(hx, hy, hz) || 1;
  let aimH: Vec3 = [hx / hr, hy / hr, hz / hr];
  if (R.framePts) aimH = frameCentre(orbit, aimH, look, R.framePts);
  const herAim: Vec3 = [orbit[0] + aimH[0] * hr, orbit[1] + aimH[1] * hr, orbit[2] + aimH[2] * hr];
  const gv = roomViewDir(yaw, pitch, R);
  const gaze: Vec3 = [c[0] + gv[0] * P.gazeM, c[1] + gv[1] * P.gazeM, c[2] + gv[2] * P.gazeM];
  const aim: Vec3 = [herAim[0] + (gaze[0] - herAim[0]) * w, herAim[1] + (gaze[1] - herAim[1]) * w, herAim[2] + (gaze[2] - herAim[2]) * w];
  const dx = aim[0] - pos[0], dy = aim[1] - pos[1], dz = aim[2] - pos[2], ln = Math.hypot(dx, dy, dz) || 1;
  return { pos: pos, dir: [dx / ln, dy / ln, dz / ln], w: w, arm: rho };
}

const wrap180 = (d: number) => { let x = d; while (x > 180) x -= 360; while (x < -180) x += 360; return x; };
function spanOf(b: OrbitBox): number {
  return Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
}
/** Distance to an AABB. A lens inside a huge shell is not a collision. */
export function boxGap(p: Vec3, b: OrbitBox): number {
  let inside = true;
  const c = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const v = k === 0 ? p[0] : k === 1 ? p[1] : p[2];
    const lo = k === 0 ? b.min[0] : k === 1 ? b.min[1] : b.min[2];
    const hi = k === 0 ? b.max[0] : k === 1 ? b.max[1] : b.max[2];
    if (v < lo || v > hi) inside = false;
    c[k] = Math.max(lo, Math.min(hi, v));
  }
  if (inside && spanOf(b) > ORBIT_FEEL.shellM) return 1e9;
  if (inside) return 0;
  return Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
}
function unitToward(from: Vec3, to: Vec3): [number, number, number] {
  const x = to[0] - from[0], y = to[1] - from[1], z = to[2] - from[2];
  const L = Math.hypot(x, y, z) || 1;
  return [x / L, y / L, z / L];
}
/** Names that are backdrops or effects. They must not shove the lens. */
export function orbitColliderName(name: string): boolean {
  return /sky|cloud|sea_|foam|wave|gull|smoke|beam|blind_card|sprite|particle/i.test(name);
}

type Memory = { yaw: number; pitch: number; dist: number; fov: number; seeded: boolean; engaged: boolean };

export class FreeOrbit {
  mode: OrbitMode = 'idle';
  yaw = 0;
  pitch = 12;
  dist = 7;
  fov = 48;
  seeded = false;
  private engagedFlag = false;
  private held = false;
  private yawVel = 0;
  private pitchVel = 0;
  private distVel = 0;
  /** Pitch-floor ease rate (deg/s), see PITCH_FLOOR_FEEL. */
  private floorVel = 0;
  private yawLock = 0;
  private limits: OrbitLimits = ORBIT_LIMITS.island;
  private placeName: OrbitPlace = 'island';
  private boardSnap: Memory | null = null;
  private fromPose: LookPose | null = null;
  private returnT = 0;
  /** Room look tracker: position goal (from the last solve), the followed lens (position, velocity), its view dir. */
  private roomInit = false;
  private roomGoalPos: [number, number, number] = [0, 0, 0];
  private roomGoalDir: [number, number, number] = [0, 0, -1];
  private roomPos: [number, number, number] = [0, 0, 0];
  private roomVel: [number, number, number] = [0, 0, 0];
  private roomAcc: [number, number, number] = [0, 0, 0];
  private roomGoalPrev: [number, number, number] = [0, 0, 0];
  private roomGoalPrevOk = false;
  private roomGoalVel: [number, number, number] = [0, 0, 0];
  private roomDir: [number, number, number] = [0, 0, -1];
  /** Last geometric room blend weight and wall-limited arm (diagnostics / tests). */
  roomWeight = 0;
  roomArmM = 0;
  /** Filtered orbit parameters the goal is built from, and what the goal needs between solves. */
  private roomYaw = 0;
  private roomPitch = 0;
  private roomDist = 0;
  private roomParams = false;
  private roomCtx: { look: Vec3; boxes: readonly OrbitBox[]; groundY: number; xz?: readonly [number, number, number, number] } | null = null;
  /** True while a cinematic return turns the view with the capped follower; otherwise the view is the input's own. */
  private roomTurning = false;
  /** roomGoalDir is the input's view from a solve (not a placeholder from roomFrom): only then does the return run. */
  private roomGoalFresh = false;
  /** Cinematic return of the view: from yaw/pitch (rad) of the cinematic's last view to the input's view, smootherstep
   *  over roomRetDur, chosen so |yaw''| + |pitch''| + |yaw'·pitch'| (a roll-free camera's angular accel) ≤ angAccDegS2. */
  private roomRetFrom: [number, number] = [0, 0];
  private roomRetT = 0;
  private roomRetDur = 0;
  /** First drag off an authored lens: that lens's view direction, matched again (with the real boxes) at the first solve. */
  private roomSeedDir: Vec3 | null = null;
  private roomSeedYP: [number, number] = [0, 0];
  /** What the yaw/pitch match could not reach (pitch limits): the authored view = this rotation (axis, angle) of the
   *  input's view, faded out over seedFadeS after the first drag with smootherstep (≤ a few degrees, so lag stays small). */
  private roomOffAxis: Vec3 = [0, 1, 0];
  private roomOffAngle = 0;
  private roomOffT = 0;
  private roomOffDur = 0.8;
  private roomOffYP: [number, number] = [0, 0];
  /** Residual seed-view offset (rad) and its rate, critically damped (R10_SPEC §4.3). */
  private roomOffYPV: [number, number] = [0, 0];
  private roomOffOm = 0;
  /** Return follower state: view yaw/pitch (rad), rates, and the constant natural frequencies chosen at the start. */
  private roomViewYP: [number, number] = [0, 0];
  private roomViewYPV: [number, number] = [0, 0];
  private roomOmAng = 0;
  private roomOmPos = 2.6;
  private roomDampReady = false;
  /** r8 view: weight s (0 her, 1 the input) with rate / accel and its target; the carried view V and the pull-in
   *  target V* (yaw, pitch; rad); correction rate / accel (tangent plane, rad/s); L and G at the last solve; |ω_G − ω_L|
   *  (filtered); the input's rate (deg/s, filtered); time since the last solve; her body centre around the pivot. */
  private roomS = 0;
  private roomSV = 0;
  private roomSA = 0;
  private roomSInit = false;
  private roomWIn = 0;
  private roomGap = 0;
  private roomV: [number, number] = [0, 0];
  private roomVS: [number, number] = [0, 0];
  private roomCV: [number, number] = [0, 0];
  private roomCA: [number, number] = [0, 0];
  private roomLYP: [number, number] | null = null;
  private roomGYP: [number, number] | null = null;
  private roomDOm = 0;
  private roomInRate: [number, number] = [0, 0];
  private roomInPrev: [number, number] | null = null;
  private roomDtAcc = 0;
  private roomGapDt = 0;
  private roomHerC: Vec3 | null = null;
  /** The view blend weight s (0 = looking at her, 1 = the input's own view) — for tests / traces. */
  get roomViewBlend(): number { return this.roomS; }
  /** Her body centre (world) the orbit-zone view looks at: centre of roomLook.framePts' box around the pivot. */
  roomHerCentre(pivot: Vec3): Vec3 {
    const R = this.limits.roomLook;
    if (!this.roomHerC) {
      const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], pts: readonly Vec3[] = (R && R.framePts) || [[0, 0, 0]];
      for (let i = 0; i < pts.length; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pts[i][k]); mx[k] = Math.max(mx[k], pts[i][k]); }
      this.roomHerC = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    }
    const c = this.roomHerC;
    return [pivot[0] + c[0], pivot[1] + c[1], pivot[2] + c[2]];
  }
  /** Yaw captured by seed(): revealWiden measures the deviation from it. */
  private seedYaw = 0;
  /** seedAimBlend state: aim offset from her look point at seed, accumulated input since seed, blend span (deg). */
  private seedAimOff: Vec3 | null = null;
  private seedInput = 0;
  private seedSpan = 18;
  constructor(place: OrbitPlace = 'island') {
    this.placeName = place;
    this.limits = ORBIT_LIMITS[place];
    this.fov = this.limits.fovDeg;
    this.dist = Math.min(this.limits.distMax, Math.max(this.limits.distMin, this.dist));
  }
  get place(): OrbitPlace { return this.placeName; }
  limitsOf(): OrbitLimits { return this.limits; }
  /** The pitch floor at the current arm (limits.pitchMinDeg where the place has no pitchFloor). */
  get pitchFloorDeg(): number { return orbitPitchFloor(this.limits, this.dist); }
  engaged(): boolean { return this.engagedFlag; }
  setPlace(place: OrbitPlace): void {
    const changed = this.placeName !== place;
    this.placeName = place;
    this.limits = ORBIT_LIMITS[place];
    if (changed && !this.seeded) this.fov = this.limits.fovDeg;
    if (changed) this.floorVel = 0;
    this.clampAll();
  }
  /** Match an authored lens without taking ownership. The first drag is what engages the orbit. */
  seed(pose: LookPose, feet: Vec3): void {
    const look = this.orbitPivot(feet);
    const dx = pose.position[0] - look[0], dy = pose.position[1] - look[1], dz = pose.position[2] - look[2];
    const dist = Math.hypot(dx, dy, dz) || this.limits.distMin;
    this.dist = this.clampDist(dist);
    this.pitch = Math.asin(Math.max(-1, Math.min(1, dy / Math.max(dist, 1e-4)))) * 180 / Math.PI;
    this.yaw = Math.atan2(dx, dz) * 180 / Math.PI;
    this.seedYaw = this.yaw;
    this.seedAimOff = null; this.seedInput = 0;
    const sb = this.limits.seedAimBlend;
    if (sb && !this.limits.roomLook) {
      const pos = this.rawPosAt(look), d = unitToward(pose.position, pose.target), reach = Math.hypot(look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]);
      const aim: Vec3 = [pos[0] + d[0] * reach, pos[1] + d[1] * reach, pos[2] + d[2] * reach], off: Vec3 = [aim[0] - look[0], aim[1] - look[1], aim[2] - look[2]];
      const her = unitToward(pos, look), gap = Math.acos(Math.max(-1, Math.min(1, her[0] * d[0] + her[1] * d[1] + her[2] * d[2]))) * 180 / Math.PI;
      if (gap > 1e-3) { this.seedAimOff = off; this.seedSpan = Math.max(sb.minDeg, sb.perJumpDeg * gap); }
    }
    if (Number.isFinite(pose.fovVerticalDeg)) this.fov = pose.fovVerticalDeg;
    this.clampPitch();
    this.seeded = true;
    // Indoors the orbit goal is not the authored lens (keepInside / room look): the tracker starts from it and glides.
    if (this.limits.roomLook) {
      this.roomFrom(pose, false);
      // the view follows the input directly, so pick the yaw/pitch whose view is the authored one: no turn on the first drag
      this.roomSeedDir = unitToward(pose.position, pose.target);
      this.roomMatchView(this.roomSeedDir, look, this.roomCtx ? this.roomCtx.boxes : [], this.roomCtx ? this.roomCtx.groundY : feet[1]);
      this.roomSeedYP = [this.yaw, this.pitch];
    }
  }
  /** Adjust yaw/pitch so the room view at the current arm looks along `dir` (fixed-point on the static goal's view). */
  private roomMatchView(dir: Vec3, look: Vec3, boxes: readonly OrbitBox[], groundY: number): void {
    const want = Math.atan2(dir[0], dir[2]) * 180 / Math.PI, wantP = Math.asin(Math.max(-1, Math.min(1, dir[1]))) * 180 / Math.PI;
    for (let i = 0; i < 12; i++) {
      const g = this.roomGoalAt(look, this.yaw, this.pitch, this.dist, boxes, groundY);
      const gy = Math.atan2(g.dir[0], g.dir[2]) * 180 / Math.PI, gp = Math.asin(Math.max(-1, Math.min(1, g.dir[1]))) * 180 / Math.PI;
      const ey = wrap180(want - gy), ep = wantP - gp;
      if (Math.abs(ey) + Math.abs(ep) < 1e-4) break;
      this.yaw += ey; this.pitch -= ep; this.clampPitch();
    }
  }
  /** dx, dy are fractions of the screen. UI y grows upward: finger up looks up (pitch falls). */
  drag(dx: number, dy: number, dt = 1 / 60): boolean {
    if (this.mode === 'paused' || this.mode === 'returning') return false;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
    const frame = Math.max(1 / 120, Math.min(0.05, dt));
    const y = dx * ORBIT_FEEL.yawPerScreen;
    const p = -dy * ORBIT_FEEL.pitchPerScreen;
    const pitch0 = this.pitch;
    this.yaw += y;
    this.pitch += p;
    this.seedInput += Math.abs(y) + Math.abs(p);
    this.yawVel = Math.max(-ORBIT_FEEL.maxYawVel, Math.min(ORBIT_FEEL.maxYawVel, y / frame));
    this.pitchVel = Math.max(-ORBIT_FEEL.maxPitchVel, Math.min(ORBIT_FEEL.maxPitchVel, p / frame));
    this.clampAll();
    if (this.limits.pitchFloor) this.floorAfterInput(pitch0);
    this.held = true;
    this.engagedFlag = true;
    this.seeded = true;
    if (this.mode === 'idle') this.mode = this.placeName === 'board' ? 'board' : 'free';
    return true;
  }
  /** scale > 1 (fingers apart) moves closer. Values outside 0.25..4 are ignored so a screen point cannot collapse the arm. */
  pinch(scale: number): boolean {
    if (this.mode === 'paused' || this.mode === 'returning') return false;
    if (!(scale > 0.25 && scale < 4) || Math.abs(scale - 1) < 1e-4) return false;
    const before = this.dist;
    this.dist = this.clampDist(this.dist / scale);
    this.distVel = Math.max(-ORBIT_FEEL.maxDistVel, Math.min(ORBIT_FEEL.maxDistVel, (this.dist - before) * 60));
    this.held = true;
    this.engagedFlag = true;
    this.seeded = true;
    if (this.mode === 'idle') this.mode = this.placeName === 'board' ? 'board' : 'free';
    return this.dist !== before;
  }
  release(): void { this.held = false; }
  /** Cinematic owns the lens. Angles stay stored. Drag is ignored until beginReturn or disarm. */
  pause(): void {
    this.held = false;
    this.yawVel = 0;
    this.pitchVel = 0;
    this.distVel = 0;
    if (this.mode !== 'board') this.mode = 'paused';
  }
  /** Same place, cinematic finished. `from` is the lens the track left behind. */
  beginReturn(from: LookPose): void {
    if (!this.engagedFlag) { this.mode = this.placeName === 'board' ? 'board' : 'idle'; this.fromPose = null; return; }
    this.fromPose = { position: [from.position[0], from.position[1], from.position[2]], target: [from.target[0], from.target[1], from.target[2]], fovVerticalDeg: from.fovVerticalDeg };
    this.returnT = 0;
    this.held = false;
    this.mode = 'returning';
    if (this.limits.roomLook) this.roomFrom(from, true);
  }
  /** A new place keeps its authored lens. The previous orbit is not carried across a journey. */
  forget(): void {
    this.engagedFlag = false;
    this.seeded = false;
    this.held = false;
    this.yawVel = 0;
    this.pitchVel = 0;
    this.distVel = 0;
    this.fromPose = null;
    this.boardSnap = null;
    this.seedAimOff = null;
    this.seedInput = 0;
    this.roomInit = false;
    this.roomParams = false;
    this.roomTurning = false;
    this.roomSeedDir = null;
    this.roomOffAngle = 0;
    this.roomSInit = false;
    this.roomLYP = null;
    this.mode = 'idle';
  }
  /** Match-3: keep the saved orbit, and only allow the board row of ORBIT_LIMITS. */
  armBoard(): void {
    if (this.seeded && !this.boardSnap) this.boardSnap = this.capture();
    this.yawLock = this.yaw;
    this.placeName = 'board';
    this.limits = ORBIT_LIMITS.board;
    this.held = false;
    this.yawVel = 0;
    this.pitchVel = 0;
    this.distVel = 0;
    this.fromPose = null;
    this.clampAll();
    this.mode = 'board';
  }
  /** Leave the board and put the saved orbit back, still paused until beginReturn. */
  disarm(place: Exclude<OrbitPlace, 'board'>): void {
    this.placeName = place;
    this.limits = ORBIT_LIMITS[place];
    if (this.boardSnap) {
      this.yaw = this.boardSnap.yaw;
      this.pitch = this.boardSnap.pitch;
      this.dist = this.boardSnap.dist;
      this.fov = this.boardSnap.fov;
      this.seeded = this.boardSnap.seeded;
      this.engagedFlag = this.boardSnap.engaged;
      this.boardSnap = null;
    }
    this.clampAll();
    this.mode = this.engagedFlag ? 'paused' : 'idle';
  }
  /** The track finished and the player never took the lens. A drag may start a new orbit. */
  unlock(): void { if (!this.engagedFlag && this.mode === 'paused') this.mode = 'idle'; }
  step(dt: number): void {
    const t = Number.isFinite(dt) && dt > 0 ? Math.min(0.1, dt) : 0;
    if (this.roomInit && t > 0 && this.limits.roomLook) { this.roomDtAcc += t; this.roomTrack(t); if (this.roomOffAngle > 0 && this.engagedFlag) this.roomOffT += t; }
    if (this.mode === 'returning') {
      this.returnT += t;
      // indoors the return ends when the critically damped follower has reached the pure pose (12 s backstop)
      const turning = !!this.limits.roomLook && this.roomTurning && this.returnT < 12;
      if (this.returnT >= ORBIT_FEEL.returnS && !turning) { this.returnT = ORBIT_FEEL.returnS; this.mode = 'free'; this.fromPose = null; this.roomTurning = false; }
      return;
    }
    if (this.limits.pitchFloor && this.mode === 'free' && t > 0) this.easeToFloor(t);
    if (this.mode === 'paused' || this.held || t === 0) return;
    const tau = ORBIT_FEEL.velTauS, k = Math.exp(-t / tau);
    // Room coast is the r10 exact integral. Other places keep the pre-r10 step (vel * dt) so meadow pitch floor and outdoor orbits stay put.
    const coast = this.limits.roomLook ? tau * (1 - k) : t;
    const pitch0 = this.pitch;
    this.yaw += this.yawVel * coast;
    this.pitch += this.pitchVel * coast;
    this.dist += this.distVel * coast;
    this.yawVel *= k;
    this.pitchVel *= k;
    this.distVel *= k;
    if (Math.abs(this.yawVel) < 0.05) this.yawVel = 0;
    if (Math.abs(this.pitchVel) < 0.05) this.pitchVel = 0;
    if (Math.abs(this.distVel) < 0.01) this.distVel = 0;
    this.clampAll();
    if (this.limits.pitchFloor) this.floorAfterInput(pitch0);
    if (this.pitch <= this.limits.pitchMinDeg + 1e-4 && this.pitchVel < 0) this.pitchVel = 0;
    if (this.pitch >= this.limits.pitchMaxDeg - 1e-4 && this.pitchVel > 0) this.pitchVel = 0;
  }
  /** True while the orbit, not an authored track, should write the lens. */
  shouldWrite(): boolean {
    return this.engagedFlag && (this.mode === 'free' || this.mode === 'returning');
  }
  lookPoint(feet: Vec3): Vec3 { return [feet[0], feet[1] + this.limits.lookM, feet[2]]; }
  /** Indoors: what the room orbit pivots on (look point + roomLook.pivotOffset). Elsewhere the look point. */
  orbitPivot(feet: Vec3): Vec3 {
    const o = this.limits.roomLook && this.limits.roomLook.pivotOffset, l = this.lookPoint(feet);
    return o ? [l[0] + o[0], l[1] + o[1], l[2] + o[2]] : l;
  }
  /** Orbit placement after clamps, before scenery collision. */
  private rawPosAt(look: Vec3): Vec3 {
    const pr = this.pitch * Math.PI / 180, yr = this.yaw * Math.PI / 180;
    const cp = Math.cos(pr), sp = Math.sin(pr);
    return [look[0] + Math.sin(yr) * cp * this.dist, look[1] + sp * this.dist, look[2] + Math.cos(yr) * cp * this.dist];
  }
  /** seedAimBlend weight left on the seed aim (1 at seed, 0 once the span of input is spent). */
  get seedAimLeft(): number {
    if (!this.seedAimOff) return 0;
    const u = Math.min(1, this.seedInput / this.seedSpan);
    return 1 - u * u * u * (u * (u * 6 - 15) + 10);
  }
  rawPose(feet: Vec3): LookPose {
    const look = this.lookPoint(feet);
    const pos = this.rawPosAt(look), k = this.seedAimLeft, o = this.seedAimOff;
    const lift = revealLiftM(this.limits, this.yaw - this.seedYaw);
    const target: Vec3 = o && k > 0 ? [look[0] + o[0] * k, look[1] + o[1] * k + lift, look[2] + o[2] * k] : [look[0], look[1] + lift, look[2]];
    if (o && k <= 0) this.seedAimOff = null;
    return { position: pos, target: target, fovVerticalDeg: this.fov + revealWidenDeg(this.limits, this.yaw - this.seedYaw) };
  }
  /**
   * Shorten the arm until the lens and a 0.2 m near point clear every solid box, stay above the ground,
   * and (indoors) stay inside keepInside. `xz` is minX, minZ, maxX, maxZ of the explorable ground.
   */
  solve(feet: Vec3, boxes: readonly OrbitBox[], groundY: number, xz?: readonly [number, number, number, number]): LookPose {
    if (this.limits.roomLook && this.limits.keepInside) return this.solveRoom(this.orbitPivot(feet), boxes, groundY, xz);
    const look = this.lookPoint(feet);
    const goal = this.rawPose(feet);
    let pose = this.mode === 'returning' && this.fromPose ? this.blend(this.fromPose, goal, SMOOTH(this.returnT / ORBIT_FEEL.returnS)) : goal;
    pose = this.clearPose(pose, look, boxes, groundY, xz, look, null);
    return pose;
  }
  /** r10 static pose (R10_SPEC §2): a pure function of yaw, pitch and distance. Boxes are not part of it. */
  roomGoalAt(look: Vec3, yaw: number, pitch: number, dist: number, _boxes?: readonly OrbitBox[], _groundY?: number, _xz?: readonly [number, number, number, number]): RoomPose {
    return roomPoseLook(this.limits, look, yaw, pitch, dist);
  }
  /** r10 blend weight. It depends only on yaw (R10_SPEC §2.1). */
  roomWeightAt(_look: Vec3, yaw: number, _pitch: number): number {
    return roomYawWeight(yaw, this.limits.roomLook!);
  }
  private solveRoom(look: Vec3, boxes: readonly OrbitBox[], groundY: number, xz?: readonly [number, number, number, number]): LookPose {
    this.roomCtx = { look: [look[0], look[1], look[2]], boxes: boxes, groundY: groundY, xz: xz };
    if (this.roomSeedDir) {
      const sd = this.roomSeedDir, curY = this.yaw, curP = this.pitch, sy = this.roomSeedYP[0], sp = this.roomSeedYP[1];
      this.roomSeedDir = null;
      this.yaw = sy; this.pitch = sp;
      this.roomMatchView(sd, look, boxes, groundY);
      const matchedY = this.yaw, matchedP = this.pitch;
      const g0 = this.roomGoalAt(look, matchedY, matchedP, this.dist, boxes, groundY, xz);
      const gy = Math.atan2(g0.dir[0], g0.dir[2]), gp = Math.asin(Math.max(-1, Math.min(1, g0.dir[1])));
      let dy = Math.atan2(sd[0], sd[2]) - gy;
      while (dy > Math.PI) dy -= 2 * Math.PI;
      while (dy < -Math.PI) dy += 2 * Math.PI;
      const dp = Math.asin(Math.max(-1, Math.min(1, sd[1]))) - gp;
      this.yaw = curY + (matchedY - sy);
      this.pitch = curP + (matchedP - sp);
      this.clampPitch();
      this.roomOffYP = [dy, dp];
      this.roomOffYPV = [0, 0];
      this.roomOffAngle = Math.hypot(dy * Math.cos(gp), dp);
      const amax = ROOM_LOOK_FEEL.angAccDegS2 * Math.PI / 180;
      this.roomOffOm = this.roomOffAngle > 1e-6 ? Math.sqrt(amax / this.roomOffAngle) : 0;
      if (this.roomOffAngle < 1e-5) this.roomOffAngle = 0;
    }
    const g = this.roomGoalAt(look, this.yaw, this.pitch, this.dist, boxes, groundY, xz);
    this.roomWeight = g.w; this.roomArmM = g.arm; this.roomS = g.w;
    this.roomGoalPos = [g.pos[0], g.pos[1], g.pos[2]];
    this.roomGoalDir = [g.dir[0], g.dir[1], g.dir[2]];
    this.roomGoalFresh = true;
    let dir: Vec3 = g.dir;
    if (this.roomOffAngle > 0 && !this.roomTurning) {
      const gy = Math.atan2(dir[0], dir[2]), gp = Math.asin(Math.max(-1, Math.min(1, dir[1])));
      const y = gy + this.roomOffYP[0], p = gp + this.roomOffYP[1], c = Math.cos(p);
      dir = [Math.sin(y) * c, Math.sin(p), Math.cos(y) * c];
    }
    if (!this.roomTurning) {
      this.roomPos = [g.pos[0], g.pos[1], g.pos[2]];
      this.roomDir = [dir[0], dir[1], dir[2]];
      this.roomVel = [0, 0, 0];
    }
    this.roomInit = true;
    const p = this.roomPos, d = this.roomDir, reach = Math.max(1, Math.hypot(look[0] - p[0], look[1] - p[1], look[2] - p[2]));
    const target: Vec3 = [p[0] + d[0] * reach, p[1] + d[1] * reach, p[2] + d[2] * reach];
    return this.clearPose({ position: [p[0], p[1], p[2]], target: target, fovVerticalDeg: this.fov }, look, boxes, groundY, xz, look, target);
  }
  /** Start a return or a seed at `pose`, at rest. The goal is the pure pose, filled in on the next solve, so the first frame does not jump. */
  private roomFrom(pose: LookPose, turning: boolean): void {
    const d = unitToward(pose.position, pose.target);
    this.roomPos = [pose.position[0], pose.position[1], pose.position[2]];
    this.roomDir = [d[0], d[1], d[2]];
    this.roomVel = [0, 0, 0];
    this.roomViewYP = [Math.atan2(d[0], d[2]), Math.asin(Math.max(-1, Math.min(1, d[1])))];
    this.roomViewYPV = [0, 0];
    this.roomInit = true;
    this.roomTurning = turning;
    this.roomDampReady = false;
    this.roomOffAngle = 0;
    this.roomGoalFresh = false;
    this.roomOmPos = 2.6;
    this.roomOmAng = 0;
    this.roomGoalPos = [this.roomPos[0], this.roomPos[1], this.roomPos[2]];
    this.roomGoalDir = [d[0], d[1], d[2]];
  }
  /** Return and seed-fade only (R10_SPEC §4.3). Every other frame the pose is roomGoalAt, applied in solveRoom. */
  private roomTrack(t: number): void {
    if (!(t > 0)) return;
    if (this.roomTurning && this.roomGoalFresh) this.dampReturn(t);
    else if (this.roomOffAngle > 0 && this.roomOffOm > 0) this.dampSeed(t);
  }
  private dampSeed(t: number): void {
    const ey = critDamp(this.roomOffYP[0], this.roomOffYPV[0], this.roomOffOm, t);
    const ep = critDamp(this.roomOffYP[1], this.roomOffYPV[1], this.roomOffOm, t);
    this.roomOffYP = [ey[0], ep[0]];
    this.roomOffYPV = [ey[1], ep[1]];
    this.roomOffAngle = Math.hypot(ey[0], ep[0]);
    if (this.roomOffAngle < 1e-5 && Math.hypot(ey[1], ep[1]) < 1e-4) this.roomOffAngle = 0;
  }
  private dampReturn(t: number): void {
    const gp = this.roomGoalPos, gd = this.roomGoalDir;
    const gy = Math.atan2(gd[0], gd[2]), gpit = Math.asin(Math.max(-1, Math.min(1, gd[1])));
    if (!this.roomDampReady) {
      let ey0 = this.roomViewYP[0] - gy;
      while (ey0 > Math.PI) ey0 -= 2 * Math.PI;
      while (ey0 < -Math.PI) ey0 += 2 * Math.PI;
      const ep0 = this.roomViewYP[1] - gpit;
      const ang = Math.hypot(ey0 * Math.cos(this.roomViewYP[1]), ep0);
      const amax = ROOM_LOOK_FEEL.angAccDegS2 * Math.PI / 180;
      this.roomOmAng = ang > 1e-6 ? Math.sqrt(amax / ang) : 8;
      this.roomDampReady = true;
    }
    for (let k = 0; k < 3; k++) {
      const ev = critDamp(this.roomPos[k] - gp[k], this.roomVel[k], this.roomOmPos, t);
      this.roomPos[k] = gp[k] + ev[0];
      this.roomVel[k] = ev[1];
    }
    let ey = this.roomViewYP[0] - gy;
    while (ey > Math.PI) ey -= 2 * Math.PI;
    while (ey < -Math.PI) ey += 2 * Math.PI;
    const ep = this.roomViewYP[1] - gpit;
    const evy = critDamp(ey, this.roomViewYPV[0], this.roomOmAng, t);
    const evp = critDamp(ep, this.roomViewYPV[1], this.roomOmAng, t);
    this.roomViewYP = [gy + evy[0], gpit + evp[0]];
    this.roomViewYPV = [evy[1], evp[1]];
    const c = Math.cos(this.roomViewYP[1]);
    this.roomDir = [Math.sin(this.roomViewYP[0]) * c, Math.sin(this.roomViewYP[1]), Math.cos(this.roomViewYP[0]) * c];
    const posErr = Math.hypot(this.roomPos[0] - gp[0], this.roomPos[1] - gp[1], this.roomPos[2] - gp[2]);
    const angErr = Math.hypot(evy[0] * Math.cos(this.roomViewYP[1]), evp[0]);
    const spd = Math.hypot(this.roomVel[0], this.roomVel[1], this.roomVel[2]);
    const asp = Math.hypot(this.roomViewYPV[0], this.roomViewYPV[1]);
    if (posErr < 1e-4 && angErr < 1e-4 && spd < 1e-3 && asp < 1e-3) {
      this.roomTurning = false;
      this.roomPos = [gp[0], gp[1], gp[2]];
      this.roomDir = [gd[0], gd[1], gd[2]];
      this.roomVel = [0, 0, 0];
      this.roomViewYPV = [0, 0];
    }
  }
  private blend(a: LookPose, b: LookPose, e: number): LookPose {
    const p: Vec3 = [a.position[0] + (b.position[0] - a.position[0]) * e, a.position[1] + (b.position[1] - a.position[1]) * e, a.position[2] + (b.position[2] - a.position[2]) * e];
    const t: Vec3 = [a.target[0] + (b.target[0] - a.target[0]) * e, a.target[1] + (b.target[1] - a.target[1]) * e, a.target[2] + (b.target[2] - a.target[2]) * e];
    return { position: p, target: t, fovVerticalDeg: a.fovVerticalDeg + (b.fovVerticalDeg - a.fovVerticalDeg) * e };
  }
  /** `look` is where the arm shortens toward; `her` is her look point (for orbitIgnoresBox); `aim` is the returned target
   *  (null = `look`, as before). */
  private clearPose(pose: LookPose, look: Vec3, boxes: readonly OrbitBox[], groundY: number, xz: readonly [number, number, number, number] | undefined, her: Vec3, aim: Vec3 | null): LookPose {
    const indoor = !!this.limits.keepInside;
    let p: [number, number, number] = [pose.position[0], pose.position[1], pose.position[2]];
    const inside = this.limits.keepInside;
    for (let n = 0; n < 6; n++) {
      let push = 0;
      if (inside) {
        for (let k = 0; k < 3; k++) {
          const v = p[k], lo = k === 0 ? inside.min[0] : k === 1 ? inside.min[1] : inside.min[2];
          const hi = k === 0 ? inside.max[0] : k === 1 ? inside.max[1] : inside.max[2];
          if (v < lo) push = Math.max(push, lo - v + 0.02);
          else if (v > hi) push = Math.max(push, v - hi + 0.02);
        }
      }
      if (xz) {
        const m = 2;
        if (p[0] < xz[0] - m) push = Math.max(push, xz[0] - m - p[0] + 0.05);
        if (p[0] > xz[2] + m) push = Math.max(push, p[0] - (xz[2] + m) + 0.05);
        if (p[2] < xz[1] - m) push = Math.max(push, xz[1] - m - p[2] + 0.05);
        if (p[2] > xz[3] + m) push = Math.max(push, p[2] - (xz[3] + m) + 0.05);
      }
      if (Number.isFinite(groundY) && p[1] < groundY + ORBIT_FEEL.groundClearM) push = Math.max(push, groundY + ORBIT_FEEL.groundClearM - p[1] + 0.02);
      const near: Vec3 = [p[0] + (look[0] - p[0]) * 0.04, p[1] + (look[1] - p[1]) * 0.04, p[2] + (look[2] - p[2]) * 0.04];
      for (let i = 0; i < boxes.length; i++) {
        if (orbitIgnoresBox(boxes[i], her, p, indoor)) continue;
        const g = Math.min(boxGap(p, boxes[i]), boxGap(near, boxes[i]));
        if (g < ORBIT_FEEL.clearM) push = Math.max(push, ORBIT_FEEL.clearM - g + 0.05);
      }
      if (push <= 0) break;
      const dir = unitToward(look, p);
      const back = Math.min(push, Math.max(0.05, Math.hypot(p[0] - look[0], p[1] - look[1], p[2] - look[2]) - 0.8));
      p = [p[0] - dir[0] * back, p[1] - dir[1] * back, p[2] - dir[2] * back];
    }
    if (Number.isFinite(groundY) && p[1] < groundY + ORBIT_FEEL.groundClearM) p[1] = groundY + ORBIT_FEEL.groundClearM;
    const tg = aim || look;
    return { position: p, target: [tg[0], tg[1], tg[2]], fovVerticalDeg: pose.fovVerticalDeg };
  }
  /** Pitch floor after a drag or coast moved the pitch from `before`. A move that crosses the floor stops on it. Below the
   *  floor (a pinch raised it) the input may still lift the pitch but not push it lower; easeToFloor lifts it. */
  private floorAfterInput(before: number): void {
    const f = orbitPitchFloor(this.limits, this.dist);
    if (this.pitch >= f) return;
    if (before >= f - 1e-6) this.pitch = f;
    else if (this.pitch < before) this.pitch = before;
    else return;
    if (this.pitchVel < 0) this.pitchVel = 0;
  }
  /** Ease the pitch up to a floor that a pinch raised above it: the ease rate follows a braking curve on the gap,
   *  min(vMax, sqrt(2 * brake * gap)), and changes by at most PITCH_FLOOR_FEEL.accDegS2 per second. brake <= acc / 2, so
   *  the last step onto the floor also stays inside the accel cap. The pitch never passes the floor (no overshoot) and the
   *  ease only ever lifts it. */
  private easeToFloor(t: number): void {
    const F = PITCH_FLOOR_FEEL, gap = orbitPitchFloor(this.limits, this.dist) - this.pitch;
    if (gap <= 0) { this.floorVel = 0; return; }
    const want = Math.min(F.vMaxDegS, Math.sqrt(2 * F.brakeDegS2 * gap));
    this.floorVel = Math.max(0, this.floorVel + Math.max(-F.accDegS2 * t, Math.min(F.accDegS2 * t, want - this.floorVel)));
    const d = this.floorVel * t;
    if (d >= gap) { this.pitch += gap; this.floorVel = gap / t; } else this.pitch += d;
  }
  private clampDist(d: number): number {
    return Math.max(this.limits.distMin, Math.min(this.limits.distMax, d));
  }
  private clampPitch(): void {
    if (this.pitch < this.limits.pitchMinDeg) this.pitch = this.limits.pitchMinDeg;
    else if (this.pitch > this.limits.pitchMaxDeg) this.pitch = this.limits.pitchMaxDeg;
  }
  private clampAll(): void {
    this.clampPitch();
    this.dist = this.clampDist(this.dist);
    if (this.limits.yawHalfDeg < 1e8) {
      const d = Math.max(-this.limits.yawHalfDeg, Math.min(this.limits.yawHalfDeg, wrap180(this.yaw - this.yawLock)));
      this.yaw = this.yawLock + d;
    }
  }
  private capture(): Memory {
    return { yaw: this.yaw, pitch: this.pitch, dist: this.dist, fov: this.fov, seeded: this.seeded, engaged: this.engagedFlag };
  }
}
