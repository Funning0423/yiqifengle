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
export type RoomLook = Readonly<{ center: Vec3; blendFromM: number; blendFullM: number; pivotOffset?: Vec3; viewTiltDeg?: number; frameOffset?: Vec3; aimFadeW?: number; aimFadeFromW?: number; framePts?: readonly Vec3[]; lensMaxY?: number; pivotShift?: Readonly<{ yawDeg: number; halfDeg: number; offset: Vec3 }>; lensCentreOffset?: Vec3; armGrowZM?: number; viewDownMinDeg?: number; viewDownMaxDeg?: number; viewDownSoftDeg?: number; centreFadeW?: number; yawWarp?: Readonly<{ yawDeg: number; halfDeg: number; ampDeg: number }> }>;
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
}>;

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
      viewDownMinDeg: 9, viewDownMaxDeg: 31, viewDownSoftDeg: 3, centreFadeW: 0.5, yawWarp: { yawDeg: 300, halfDeg: 75, ampDeg: 13 },
      framePts: [[-0.42,-1.05,-0.23],[-0.33,-0.83,0.02],[-0.32,-0.57,-0.29],[-0.36,-0.53,-0.17],[-0.36,-0.6,-0.07],[0.08,0.01,0.15],[0.1,0.05,-0.15],[0.03,0.05,-0.03],[-0.29,-1.05,-0.35],[-0.33,-1.05,-0.13],[-0.21,-0.74,-0.41],[0.16,0.14,0.01],[-0.15,-1.05,-0.24],[0.26,-0.74,0.09],[-0.14,-0.83,-0.42],[0.25,0.1,0.14],[0.04,-0.97,-0.13],[0.27,-0.03,0.16],[0.29,0.01,-0.19],[0.29,0.12,-0.07],[0.38,-0.03,-0.06],[0.37,0.07,0.08]] } },
  island: { pitchMinDeg: -8, pitchMaxDeg: 58, distMin: 4.2, distMax: 52, yawHalfDeg: Infinity, lookM: 1.15, fovDeg: 42 },
  meadow: { pitchMinDeg: -12, pitchMaxDeg: 48, distMin: 3.2, distMax: 14, yawHalfDeg: Infinity, lookM: 1.15, fovDeg: 48 },
  skycity: { pitchMinDeg: -6, pitchMaxDeg: 55, distMin: 4, distMax: 22, yawHalfDeg: Infinity, lookM: 1.25, fovDeg: 48 },
  lakeside: { pitchMinDeg: -10, pitchMaxDeg: 42, distMin: 3.6, distMax: 16, yawHalfDeg: Infinity, lookM: 1.15, fovDeg: 48 },
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
/** Blend weight 0 (orbit her) .. 1 (look out from the room centre). Smootherstep, C2. */
export function roomBlend(arm: number, look: RoomLook): number {
  return SMOOTH((look.blendFromM - arm) / (look.blendFromM - look.blendFullM));
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
  return /sky|cloud|sea_|foam|wave|gull|smoke|beam|blind_card|sprite|particle|rainbow/i.test(name);
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
  constructor(place: OrbitPlace = 'island') {
    this.placeName = place;
    this.limits = ORBIT_LIMITS[place];
    this.fov = this.limits.fovDeg;
    this.dist = Math.min(this.limits.distMax, Math.max(this.limits.distMin, this.dist));
  }
  get place(): OrbitPlace { return this.placeName; }
  limitsOf(): OrbitLimits { return this.limits; }
  engaged(): boolean { return this.engagedFlag; }
  setPlace(place: OrbitPlace): void {
    const changed = this.placeName !== place;
    this.placeName = place;
    this.limits = ORBIT_LIMITS[place];
    if (changed && !this.seeded) this.fov = this.limits.fovDeg;
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
    this.yaw += y;
    this.pitch += p;
    this.yawVel = Math.max(-ORBIT_FEEL.maxYawVel, Math.min(ORBIT_FEEL.maxYawVel, y / frame));
    this.pitchVel = Math.max(-ORBIT_FEEL.maxPitchVel, Math.min(ORBIT_FEEL.maxPitchVel, p / frame));
    this.clampAll();
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
      // indoors the return ends when the view follower has reached the input's view (6 s backstop)
      const turning = !!this.limits.roomLook && this.roomTurning && this.returnT < 6;
      if (this.returnT >= ORBIT_FEEL.returnS && !turning) { this.returnT = ORBIT_FEEL.returnS; this.mode = 'free'; this.fromPose = null; this.roomTurning = false; }
      return;
    }
    if (this.mode === 'paused' || this.held || t === 0) return;
    const k = Math.exp(-t / ORBIT_FEEL.velTauS);
    this.yaw += this.yawVel * t;
    this.pitch += this.pitchVel * t;
    this.dist += this.distVel * t;
    this.yawVel *= k;
    this.pitchVel *= k;
    this.distVel *= k;
    if (Math.abs(this.yawVel) < 0.05) this.yawVel = 0;
    if (Math.abs(this.pitchVel) < 0.05) this.pitchVel = 0;
    if (Math.abs(this.distVel) < 0.01) this.distVel = 0;
    this.clampAll();
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
  rawPose(feet: Vec3): LookPose {
    const look = this.lookPoint(feet);
    const pr = this.pitch * Math.PI / 180, yr = this.yaw * Math.PI / 180;
    const cp = Math.cos(pr), sp = Math.sin(pr);
    const pos: Vec3 = [look[0] + Math.sin(yr) * cp * this.dist, look[1] + sp * this.dist, look[2] + Math.cos(yr) * cp * this.dist];
    return { position: pos, target: look, fovVerticalDeg: this.fov };
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
  /** Room look goal before scenery collision: `aim` is where clearPose pushes the lens back toward. */
  /** Static room goal for given orbit parameters: blend of the orbit lens (arm shortened to the inset rounded keepInside)
   *  and the room-centre lens, both looking along the orbit direction. Then scenery collision toward `aim`. */
  roomGoalAt(look: Vec3, yaw: number, pitch: number, dist: number, boxes: readonly OrbitBox[], groundY: number, xz?: readonly [number, number, number, number]): { pos: Vec3; dir: Vec3; w: number; arm: number } {
    const R = this.limits.roomLook!, box = this.limits.keepInside!, n = ROOM_LOOK_FEEL.insetM;
    // yawWarp: a smooth monotonic remap of the input yaw (bump of ampDeg over yawDeg ± halfDeg, slope stays > 0) so the
    // west-wall sector, where no lens on her axis is far enough to frame her, is passed quickly and yaw ~315 frames her
    const yw = R.yawWarp, yd = yw ? wrap180(yaw - yw.yawDeg) : 0, ye = yw && Math.abs(yd) < yw.halfDeg ? yaw + yw.ampDeg * 0.5 * (1 + Math.cos(Math.PI * yd / yw.halfDeg)) : yaw;
    const pr = pitch * Math.PI / 180, yr = ye * Math.PI / 180, cp = Math.cos(pr);
    const u: Vec3 = [Math.sin(yr) * cp, Math.sin(pr), Math.cos(yr) * cp];
    const ps = R.pivotShift, sk = ps ? Math.max(0, Math.cos(Math.min(Math.PI, Math.abs(wrap180(yaw - ps.yawDeg)) * Math.PI / ps.halfDeg)) * 0.5 + 0.5) : 0;
    const ks = ps && Math.abs(wrap180(yaw - ps.yawDeg)) < ps.halfDeg ? sk : 0;
    const lc = R.lensCentreOffset || [0, 0, 0];
    const lo: Vec3 = [look[0] + lc[0] + (ps ? ps.offset[0] * ks : 0), look[1] + lc[1] + (ps ? ps.offset[1] * ks : 0), look[2] + lc[2] + (ps ? ps.offset[2] * ks : 0)];
    const gz = R.armGrowZM || 0, abox = gz > 0 ? { min: [box.min[0], box.min[1], box.min[2] - gz] as Vec3, max: box.max, cornerM: box.cornerM } : box;
    const arm = roomArm(lo, ye, pitch, abox, n), d = softMin(dist, arm);
    const po: Vec3 = [lo[0] + u[0] * d, softClamp(lo[1] + u[1] * d, box.min[1] + n, Math.min(box.max[1] - n, R.lensMaxY || 1e9)), lo[2] + u[2] * d];
    const w = roomBlend(arm, R), c = R.center;
    const pos: Vec3 = [po[0] + (c[0] - po[0]) * w, po[1] + (c[1] - po[1]) * w, po[2] + (c[2] - po[2]) * w];
    let dv = roomViewDir(ye, pitch, R);
    if (R.framePts) {   // slide the lens sideways so her body is centred for this (input) view; fades out with w
      const kc = 1 - SMOOTH(w / (R.centreFadeW || 0.5)), sh = kc > 0 ? frameShift(pos, dv, look, R.framePts) * kc : 0, rn = Math.hypot(dv[2], dv[0]) || 1;
      pos[0] += -dv[2] / rn * sh; pos[2] += dv[0] / rn * sh;
    }
    const reach = Math.max(1, d);
    const target: Vec3 = [pos[0] + dv[0] * reach, pos[1] + dv[1] * reach, pos[2] + dv[2] * reach];
    const aim: Vec3 = [look[0] + (c[0] - look[0]) * w, look[1] + (c[1] - look[1]) * w, look[2] + (c[2] - look[2]) * w];
    const cl = this.clearPose({ position: pos, target, fovVerticalDeg: this.fov }, aim, boxes, groundY, xz, look, target);
    const fo = R.frameOffset, sw = fo ? SMOOTH((w - (R.aimFadeFromW || 0)) / ((R.aimFadeW || 0.35) - (R.aimFadeFromW || 0))) : 1;
    if (sw < 1) {
      const q = cl.position;
      let h = unitToward(q, [look[0] + fo![0], look[1] + fo![1], look[2] + fo![2]]);
      if (R.framePts) h = frameCentre(q, h, look, R.framePts);
      const m: Vec3 = [h[0] + (dv[0] - h[0]) * sw, h[1] + (dv[1] - h[1]) * sw, h[2] + (dv[2] - h[2]) * sw], mn = Math.hypot(m[0], m[1], m[2]) || 1;
      dv = [m[0] / mn, m[1] / mn, m[2] / mn];
    }
    return { pos: cl.position, dir: dv, w, arm };
  }
  /** The room blend weight w of the static goal at yaw/pitch (it does not depend on the arm). */
  roomWeightAt(look: Vec3, yaw: number, pitch: number): number {
    const R = this.limits.roomLook!, box = this.limits.keepInside!, n = ROOM_LOOK_FEEL.insetM, yw = R.yawWarp;
    const yd = yw ? wrap180(yaw - yw.yawDeg) : 0, ye = yw && Math.abs(yd) < yw.halfDeg ? yaw + yw.ampDeg * 0.5 * (1 + Math.cos(Math.PI * yd / yw.halfDeg)) : yaw;
    const lc = R.lensCentreOffset || [0, 0, 0], lo: Vec3 = [look[0] + lc[0], look[1] + lc[1], look[2] + lc[2]];
    const gz = R.armGrowZM || 0, abox = gz > 0 ? { min: [box.min[0], box.min[1], box.min[2] - gz] as Vec3, max: box.max, cornerM: box.cornerM } : box;
    return roomBlend(roomArm(lo, ye, pitch, abox, n), R);
  }
  private solveRoom(look: Vec3, boxes: readonly OrbitBox[], groundY: number, xz?: readonly [number, number, number, number]): LookPose {
    this.roomCtx = { look: [look[0], look[1], look[2]], boxes, groundY, xz };
    let seedD: Vec3 | null = null;
    if (this.roomSeedDir) {
      // first solve after seed: redo the view match with the real boxes, keeping any drag made since the seed
      const sd = this.roomSeedDir, curY = this.yaw, curP = this.pitch, sy = this.roomSeedYP[0], sp = this.roomSeedYP[1];
      seedD = sd; this.roomSeedDir = null;
      this.yaw = sy; this.pitch = sp; this.roomMatchView(sd, look, boxes, groundY);
      this.yaw = curY + (this.yaw - sy); this.pitch = curP + (this.pitch - sp); this.clampPitch();
    }
    if (!this.roomParams) { this.roomYaw = this.yaw; this.roomPitch = this.pitch; this.roomDist = this.dist; this.roomParams = true; }
    // the view: the static goal's at the player's own yaw/pitch/arm (no lag); with goalSpeedMS 0 that is the position goal too
    const gv = this.roomGoalAt(look, this.yaw, this.pitch, this.dist, boxes, groundY, xz);
    const g = ROOM_LOOK_FEEL.goalSpeedMS > 0 ? this.roomGoalAt(look, this.roomYaw, this.roomPitch, this.roomDist, boxes, groundY, xz) : gv;
    this.roomWeight = g.w; this.roomArmM = g.arm;
    this.roomGoalPos = [g.pos[0], g.pos[1], g.pos[2]];
    if (!this.roomInit) { this.roomPos = [g.pos[0], g.pos[1], g.pos[2]]; this.roomVel = [0, 0, 0]; this.roomAcc = [0, 0, 0]; this.roomGoalPrevOk = false; this.roomGoalVel = [0, 0, 0]; this.roomInit = true; }
    // r8: look at her from the lens (orbit zone) blended with the input's view (room zone) by s, in yaw/pitch
    if (!this.roomSInit) { this.roomS = gv.w; this.roomSV = 0; this.roomSA = 0; this.roomSInit = true; }
    let wMin = gv.w, wMax = gv.w;
    const R8 = this.limits.roomLook!, hl0 = unitToward(this.roomPos, this.roomHerCentre(look)), hl = R8.framePts ? frameCentre(this.roomPos, hl0, look, R8.framePts) : hl0, gd = gv.dir;
    {   // input rate (from the solves) and the predicted blend weight: the view starts turning toward her before the input
      // reaches the orbit zone (target = the smallest w over the next predictS), and leaves her only once the input has left
      const dt = this.roomDtAcc, ip = this.roomInPrev; this.roomDtAcc = 0;
      if (ip && dt > 0) { const k = 1 - Math.exp(-dt / ROOM_VIEW.rateTauS), ry = (this.yaw - ip[0]) / dt, rp = (this.pitch - ip[1]) / dt; this.roomInRate = [this.roomInRate[0] + (ry - this.roomInRate[0]) * k, this.roomInRate[1] + (rp - this.roomInRate[1]) * k]; }
      this.roomInPrev = [this.yaw, this.pitch];
      this.roomGapDt = dt;
      wMin = gv.w; wMax = gv.w;
      for (let i = 1; i <= ROOM_VIEW.predictSteps && (Math.abs(this.roomInRate[0]) + Math.abs(this.roomInRate[1]) > 1e-6); i++) {
        const tp = Math.min(ROOM_VIEW.predictMaxS, ROOM_VIEW.predictBaseS + Math.hypot(this.roomInRate[0], this.roomInRate[1]) / ROOM_VIEW.predictAccDegS2) * i / ROOM_VIEW.predictSteps, pp = Math.max(this.limits.pitchMinDeg, Math.min(this.limits.pitchMaxDeg, this.pitch + this.roomInRate[1] * tp));
        const wp = this.roomWeightAt(look, this.yaw + this.roomInRate[0] * tp, pp); wMin = Math.min(wMin, wp); wMax = Math.max(wMax, wp);
      }
    }
    const ly = Math.atan2(hl[0], hl[2]), lp = Math.asin(Math.max(-1, Math.min(1, hl[1]))), gyw = Math.atan2(gd[0], gd[2]), gpt = Math.asin(Math.max(-1, Math.min(1, gd[1])));
    let dyw = gyw - ly; while (dyw > Math.PI) dyw -= 2 * Math.PI; while (dyw < -Math.PI) dyw += 2 * Math.PI;
    this.roomGap = Math.hypot(dyw * Math.cos((lp + gpt) / 2), gpt - lp);
    // target: entering the orbit zone soon -> the smallest predicted w (turn to her early); leaving it soon while still in
    // it -> the largest predicted w, but no more than keeps her centre within exitDeg of the screen centre
    this.roomWIn = wMin < gv.w - 1e-6 ? wMin : wMax > gv.w + 1e-6 && gv.w <= 0.1 ? Math.max(gv.w, Math.min(wMax, ROOM_VIEW.exitDeg * Math.PI / 180 / Math.max(1e-3, this.roomGap))) : gv.w;
    {   // carry the view: share s of the input's turn + share 1−s of her direction's turn since the last solve
      const pl = this.roomLYP, pg = this.roomGYP, sw = this.roomS, V = this.roomV;
      if (!pl || !pg) { V[0] = ly + sw * dyw; V[1] = lp + (gpt - lp) * sw; this.roomCV = [0, 0]; this.roomCA = [0, 0]; }
      else {
        let dl = ly - pl[0]; while (dl > Math.PI) dl -= 2 * Math.PI; while (dl < -Math.PI) dl += 2 * Math.PI;
        let dg = gyw - pg[0]; while (dg > Math.PI) dg -= 2 * Math.PI; while (dg < -Math.PI) dg += 2 * Math.PI;
        V[0] += sw * dg + (1 - sw) * dl; V[1] += sw * (gpt - pg[1]) + (1 - sw) * (lp - pl[1]);
        while (V[0] > Math.PI) V[0] -= 2 * Math.PI; while (V[0] < -Math.PI) V[0] += 2 * Math.PI;
        const dt = this.roomGapDt;
        if (dt > 0) { const k = 1 - Math.exp(-dt / ROOM_VIEW.rateTauS), dd = Math.hypot((dg - dl) * Math.cos(V[1]), (gpt - pg[1]) - (lp - pl[1])) / dt; this.roomDOm += (dd - this.roomDOm) * k; }
      }
      this.roomLYP = [ly, lp]; this.roomGYP = [gyw, gpt];
      this.roomVS = [ly + sw * dyw, lp + (gpt - lp) * sw];
    }
    const by = this.roomV[0], bp = Math.max(-1.5, Math.min(1.5, this.roomV[1])), bc = Math.cos(bp);
    let vd: Vec3 = [Math.sin(by) * bc, Math.sin(bp), Math.cos(by) * bc];
    if (seedD) {
      // r8: what the authored lens's view differs from this first view by is a yaw/pitch offset faded out after the first
      // drag (smootherstep, peak accel ≤ seedAccDegS2): no turn on the first drag
      const sd = seedD; let dy = Math.atan2(sd[0], sd[2]) - by; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      this.roomOffYP = [dy, Math.asin(Math.max(-1, Math.min(1, sd[1]))) - bp];
      this.roomOffAngle = Math.hypot(this.roomOffYP[0] * Math.cos(bp), this.roomOffYP[1]); this.roomOffT = 0;
      this.roomOffDur = Math.max(ROOM_LOOK_FEEL.seedFadeS, Math.sqrt(5.78 * this.roomOffAngle / (ROOM_VIEW.seedAccDegS2 * Math.PI / 180)));
    }
    if (this.roomOffAngle > 0) {
      // r7: the leftover is a yaw/pitch offset (not a fixed-axis turn), so a drag turns the view exactly as the input does
      const e = 1 - SMOOTH(this.roomOffT / this.roomOffDur), gy = Math.atan2(vd[0], vd[2]) + this.roomOffYP[0] * e;
      const gp = Math.asin(Math.max(-1, Math.min(1, vd[1]))) + this.roomOffYP[1] * e, c = Math.cos(gp);
      vd = [Math.sin(gy) * c, Math.sin(gp), Math.cos(gy) * c];
      if (this.roomOffT >= this.roomOffDur) this.roomOffAngle = 0;
    }
    this.roomGoalDir = [vd[0], vd[1], vd[2]]; this.roomGoalFresh = true;
    if (this.roomTurning) {
      const gy = Math.atan2(vd[0], vd[2]), gp = Math.asin(Math.max(-1, Math.min(1, vd[1])));
      let dy = gy - this.roomRetFrom[0]; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      const dp = gp - this.roomRetFrom[1], amax = ROOM_LOOK_FEEL.angAccDegS2 * Math.PI / 180;
      if (!(this.roomRetDur > 0)) this.roomRetDur = Math.max(ORBIT_FEEL.returnS, Math.sqrt((5.78 * (Math.abs(dy) + Math.abs(dp)) + 3.52 * Math.abs(dy * dp)) / amax));
      const e = SMOOTH(this.roomRetT / this.roomRetDur), y = this.roomRetFrom[0] + dy * e, pp = this.roomRetFrom[1] + dp * e, c = Math.cos(pp);
      this.roomDir = [Math.sin(y) * c, Math.sin(pp), Math.cos(y) * c];
      if (this.roomRetT >= this.roomRetDur) { this.roomTurning = false; this.roomDir = [vd[0], vd[1], vd[2]]; }
    } else this.roomDir = [vd[0], vd[1], vd[2]];
    const p = this.roomPos, d = this.roomDir, reach = Math.max(1, Math.hypot(look[0] - p[0], look[1] - p[1], look[2] - p[2]));
    return { position: [p[0], p[1], p[2]], target: [p[0] + d[0] * reach, p[1] + d[1] * reach, p[2] + d[2] * reach], fovVerticalDeg: this.fov };
  }
  /** Start the tracker at a lens someone else wrote (authored home lens, end of a cinematic), at rest. The goal parameters
   *  start at the player's orbit; the goal is rebuilt on the next solve. */
  private roomFrom(pose: LookPose, turning: boolean): void {
    const d = unitToward(pose.position, pose.target);
    this.roomPos = [pose.position[0], pose.position[1], pose.position[2]]; this.roomDir = [d[0], d[1], d[2]];
    this.roomVel = [0, 0, 0]; this.roomAcc = [0, 0, 0]; this.roomGoalPrevOk = false; this.roomGoalVel = [0, 0, 0]; this.roomInit = true; this.roomTurning = turning; this.roomOffAngle = 0; this.roomGoalFresh = false;
    this.roomRetFrom = [Math.atan2(d[0], d[2]), Math.asin(Math.max(-1, Math.min(1, d[1])))]; this.roomRetT = 0; this.roomRetDur = 0;
    this.roomSInit = false; this.roomSV = 0; this.roomSA = 0; this.roomLYP = null; this.roomGYP = null; this.roomDOm = 0; this.roomCV = [0, 0]; this.roomCA = [0, 0]; this.roomInPrev = null; this.roomInRate = [0, 0]; this.roomDtAcc = 0;
    this.roomGoalPos = [this.roomPos[0], this.roomPos[1], this.roomPos[2]]; this.roomGoalDir = [d[0], d[1], d[2]];
    this.roomParams = false;
  }
  /** Per frame: (1) move the position goal's parameters toward the player's yaw/pitch/arm with the goal point capped at
   *  goalSpeedMS; (2) critically damped position follow with capped accel; (3) wall-normal safety on the outward velocity;
   *  (4) only while a cinematic return is turning the view: capped angular follow toward the input's view. */
  private roomTrack(t: number): void {
    const F = ROOM_LOOK_FEEL, w = F.omega, n = Math.max(1, Math.ceil(t / (1 / 120))), h = t / n;
    const amax = F.linAccMS2, box = this.limits.keepInside, ctx = this.roomCtx;
    // goal velocity (feed-forward): how far the goal moved since the last step, capped
    const gp = this.roomGoalPos, lp = this.roomGoalPrev;
    let gvel = this.roomGoalPrevOk ? [(gp[0] - lp[0]) / t, (gp[1] - lp[1]) / t, (gp[2] - lp[2]) / t] : [0, 0, 0];
    const gs = Math.hypot(gvel[0], gvel[1], gvel[2]); if (gs > F.ffMaxMS) gvel = [gvel[0] * F.ffMaxMS / gs, gvel[1] * F.ffMaxMS / gs, gvel[2] * F.ffMaxMS / gs];
    // low-pass the feed-forward (a blend crossing moves the goal in bursts)
    const fk = 1 - Math.exp(-t / F.ffTauS), fv = this.roomGoalVel;
    for (let k = 0; k < 3; k++) fv[k] += (gvel[k] - fv[k]) * fk;
    gvel = [fv[0], fv[1], fv[2]];
    this.roomGoalPrev = [gp[0], gp[1], gp[2]]; this.roomGoalPrevOk = true;
    const po = (this.limits.roomLook && this.limits.roomLook.pivotOffset) || [0, 0, 0];
    const her: Vec3 | null = ctx ? [ctx.look[0] - po[0], ctx.look[1] - po[1], ctx.look[2] - po[2]] : null;   // her look point
    for (let s = 0; s < n; s++) {
      if (ctx && this.roomParams && F.goalSpeedMS > 0) {
        const dy = this.yaw - this.roomYaw, dp = this.pitch - this.roomPitch, dd = this.dist - this.roomDist;
        if (Math.abs(dy) + Math.abs(dp) + Math.abs(dd) > 1e-9) {
          let f = 1;
          for (let it = 0; it < 3; it++) {
            const g = this.roomGoalAt(ctx.look, this.roomYaw + dy * f, this.roomPitch + dp * f, this.roomDist + dd * f, ctx.boxes, ctx.groundY, ctx.xz);
            const mv = Math.hypot(g.pos[0] - this.roomGoalPos[0], g.pos[1] - this.roomGoalPos[1], g.pos[2] - this.roomGoalPos[2]), cap = F.goalSpeedMS * h;
            if (mv <= cap * 1.0001) break;
            f *= cap / mv * 0.98;
          }
          this.roomYaw += dy * f; this.roomPitch += dp * f; this.roomDist += dd * f;
          const g = this.roomGoalAt(ctx.look, this.roomYaw, this.roomPitch, this.roomDist, ctx.boxes, ctx.groundY, ctx.xz);
          this.roomGoalPos = [g.pos[0], g.pos[1], g.pos[2]];
          this.roomWeight = g.w; this.roomArmM = g.arm;
        }
      }
      const p = this.roomPos, v = this.roomVel, g = this.roomGoalPos, gvv = F.goalSpeedMS > 0 ? [0, 0, 0] : gvel;
      // approach on a braking curve: wanted velocity = goal velocity + toward the goal at √(2·brake·e) (linear near 0, slope
      // omega), capped vMaxMS; accel = omega·(wanted − v). A static goal is reached without overshoot.
      const ex = g[0] - p[0], ey = g[1] - p[1], ez = g[2] - p[2], el = Math.hypot(ex, ey, ez), c0 = 3 * F.brakeMS2 / w;   // curve slope omega/4: with the omega velocity loop, critically damped
      const vr = el > 1e-9 ? Math.min(F.vMaxMS, Math.sqrt(2 * F.brakeMS2 * el + c0 * c0) - c0) / el : 0;
      let a = [w * (gvv[0] + ex * vr - v[0]), w * (gvv[1] + ey * vr - v[1]), w * (gvv[2] + ez * vr - v[2])];
      // barriers: limit the commanded accel along n so the speed toward a limit stays ≤ √(2·B·d)
      const bars: Array<[number, number, number, number]> = [];
      if (box) {
        const e = roomEdge(p[0], p[2], box); bars.push([e.nx, 0, e.nz, F.barrierWallM - e.s]);
        // look-ahead: the wall where the lens will be in barrierLookS (a corner turns the normal into the path)
        const q = roomEdge(p[0] + v[0] * F.barrierLookS, p[2] + v[2] * F.barrierLookS, box);
        if (q.nx * e.nx + q.nz * e.nz < 0.999) bars.push([q.nx, 0, q.nz, F.barrierWallM - q.s + Math.max(0, v[0] * q.nx + v[2] * q.nz) * F.barrierLookS]);
      }
      if (her) { const dx = her[0] - p[0], dy = her[1] - p[1], dz = her[2] - p[2], L = Math.hypot(dx, dy, dz) || 1; bars.push([dx / L, dy / L, dz / L, L - F.barrierHerM]); }
      let m = Math.hypot(a[0], a[1], a[2]); if (m > amax) a = [a[0] * amax / m, a[1] * amax / m, a[2] * amax / m];
      let hard: number[] | null = null;
      for (let b = 0; b < bars.length; b++) {
        const nb = bars[b], vn = v[0] * nb[0] + v[1] * nb[1] + v[2] * nb[2], allow = Math.sqrt(2 * F.barrierAccMS2 * Math.max(0, nb[3] - Math.max(0, vn) * amax / F.jerkMS3));
        const an = a[0] * nb[0] + a[1] * nb[1] + a[2] * nb[2], cap = Math.max(-amax, F.barrierK * (allow - vn));
        if (an > cap) { const d = an - cap; a = [a[0] - nb[0] * d, a[1] - nb[1] * d, a[2] - nb[2] * d]; hard = nb; }
      }
      m = Math.hypot(a[0], a[1], a[2]);
      if (m > amax) {
        if (hard) {   // keep the barrier's braking; give up tangential accel first
          const an = a[0] * hard[0] + a[1] * hard[1] + a[2] * hard[2], t3 = [a[0] - hard[0] * an, a[1] - hard[1] * an, a[2] - hard[2] * an];
          const tm = Math.hypot(t3[0], t3[1], t3[2]), room = Math.sqrt(Math.max(0, amax * amax - an * an)), kt = tm > room ? room / tm : 1, an2 = Math.max(-amax, Math.min(amax, an));
          a = [hard[0] * an2 + t3[0] * kt, hard[1] * an2 + t3[1] * kt, hard[2] * an2 + t3[2] * kt];
        } else a = [a[0] * amax / m, a[1] * amax / m, a[2] * amax / m];
      }
      // jerk limit on the actual acceleration
      const ac = this.roomAcc, da = [a[0] - ac[0], a[1] - ac[1], a[2] - ac[2]], dm = Math.hypot(da[0], da[1], da[2]), jm = F.jerkMS3 * h;
      const jf = dm > jm ? jm / dm : 1;
      for (let k = 0; k < 3; k++) { ac[k] += da[k] * jf; v[k] += ac[k] * h; }
      if (box) {
        const e = roomEdge(p[0], p[2], box), vn = v[0] * e.nx + v[2] * e.nz;
        if (vn > 0) { const k = SMOOTH((e.s - F.safeFromM) / (F.safeToM - F.safeFromM)); v[0] -= e.nx * vn * k; v[2] -= e.nz * vn * k; }
      }
      for (let k = 0; k < 3; k++) p[k] += v[k] * h;
      {   // r8: the weight s -> its target (rate and accel scaled by |ω_G − ω_L|), and the correction rate pulling V onto V*
        const VV = ROOM_VIEW, D2R = Math.PI / 180, dw = Math.max(1e-3, this.roomDOm), e = this.roomWIn - this.roomS, el = Math.abs(e);
        const am = Math.min(VV.sAccMax, VV.blendJerkDegS3 * D2R / dw), vm = Math.min(VV.sVMax, VV.blendAccDegS2 * D2R / dw), br = 0.8 * am, c0 = 4 * br / VV.sOmega;
        const vt = el > 1e-12 ? (e > 0 ? 1 : -1) * Math.min(vm, Math.sqrt(2 * br * el + c0 * c0) - c0) : 0;
        let sa = VV.sOmega * (vt - this.roomSV); sa = sa > am ? am : sa < -am ? -am : sa;
        this.roomSA = sa; this.roomSV += sa * h;
        if (Math.abs(this.roomSV) > vm) this.roomSV = this.roomSV > 0 ? vm : -vm;
        this.roomS += this.roomSV * h;
        if (Math.abs(e) < 1e-4 && Math.abs(this.roomSV) < 2e-3) { this.roomS = this.roomWIn; this.roomSV = 0; this.roomSA = 0; }
        const V = this.roomV, VS = this.roomVS, cp = Math.cos(V[1]);
        let ey = VS[0] - V[0]; while (ey > Math.PI) ey -= 2 * Math.PI; while (ey < -Math.PI) ey += 2 * Math.PI;
        const ex = ey * cp, ez = VS[1] - V[1], cl = Math.hypot(ex, ez), cbr = VV.corrBrakeDegS2 * D2R, cc0 = 4 * cbr / VV.corrOmega;
        const cs = cl > 1e-9 ? Math.min(VV.corrVMaxDegS * D2R, Math.sqrt(2 * cbr * cl + cc0 * cc0) - cc0) / cl : 0, cv = this.roomCV, ca = this.roomCA;
        let ax = VV.corrOmega * (ex * cs - cv[0]), az = VV.corrOmega * (ez * cs - cv[1]);
        const amc = VV.corrAccDegS2 * D2R, an = Math.hypot(ax, az); if (an > amc) { ax *= amc / an; az *= amc / an; }
        const jx = ax - ca[0], jz = az - ca[1], jn = Math.hypot(jx, jz), jm = VV.corrJerkDegS3 * D2R * h, jf = jn > jm ? jm / jn : 1;
        ca[0] += jx * jf; ca[1] += jz * jf; cv[0] += ca[0] * h; cv[1] += ca[1] * h;
        V[0] += cv[0] / Math.max(0.05, cp) * h; V[1] += cv[1] * h;
        // s moves V* along G − L; V follows through c (the view never jumps when s or the target changes)
        this.roomVS = [VS[0], VS[1]];
      }
      // view: a cinematic return turns it on a timed yaw/pitch curve (solveRoom); otherwise it is the input's own
      if (this.roomTurning && this.roomGoalFresh) this.roomRetT += h;
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
