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
 * keepInside exits in XZ, divided by cos(pitch).
 */
export type RoomLook = Readonly<{ center: Vec3; blendFromM: number; blendFullM: number }>;
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
  keepInside?: Readonly<{ min: Vec3; max: Vec3 }>;
  /** Indoor only: blend toward the room centre when the wall-limited arm is short. Needs keepInside. */
  roomLook?: RoomLook;
}>;

/** Pitch is the camera's elevation above her chest. Distance is metres from that point. */
export const ORBIT_LIMITS: Readonly<Record<OrbitPlace, OrbitLimits>> = Object.freeze({
  home: { pitchMinDeg: -14, pitchMaxDeg: 26, distMin: 1.25, distMax: 3.35, yawHalfDeg: Infinity, lookM: 1.05, fovDeg: 60,
    // 运镜bot r5 (docs/r5/room-keepinside/RESULT.md): measured from the room's inner walls (round shell, inradius 2.31 m about
    // x 0, z -2.6), the wall cabinets and the desk. Every point of this box is ≥0.30 m from the inner walls; the old
    // -1.85..1.05 x -4.72..-1.55 box reached through the round wall at yaw 270 and into the west cabinet at 315 (black frames).
    keepInside: { min: [-1.1, 0.85, -4.45], max: [1.05, 2.2, -0.9] },
    roomLook: { center: [0, 1.55, -2.5], blendFromM: 1.45, blendFullM: 0.95 } },
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
 *  the keepInside height. The lens then follows that goal with a critically damped tracker (natural frequency omega)
 *  whose acceleration is capped below HANDOFF §4 (3 m/s², 120°/s²), so nothing indoors can jump: not the blend, not a
 *  keepInside corner, not the first drag after the authored lens, not the return after a cinematic. The goal keeps
 *  insetM (0.2 m band) inside keepInside, and inside that band the tracker eases its speed toward a face (≤ brakeMS2),
 *  so its lag around a corner stays off the walls without a hard stop. */
export const ROOM_LOOK_FEEL = Object.freeze({ softK: 8, edgeSoftM: 0.08, omega: 10, linAccMS2: 2.8, brakeMS2: 1.6, brakeGain: 6, angAccDegS2: 110, insetM: 0.2 });
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
/** Wall-limited arm from the look point along yaw/pitch inside the keepInside box (XZ soft exit / cos pitch). */
export function roomArm(look: Vec3, yawDeg: number, pitchDeg: number, box: OrbitBox, k: number = ROOM_LOOK_FEEL.softK): number {
  const yr = yawDeg * Math.PI / 180, hx = Math.sin(yr), hz = Math.cos(yr);
  const gx = hx >= 0 ? box.max[0] - look[0] : look[0] - box.min[0], gz = hz >= 0 ? box.max[2] - look[2] : look[2] - box.min[2];
  if (!(gx > 0) || !(gz > 0)) return 0;
  const inv = Math.pow(Math.abs(hx) / gx, k) + Math.pow(Math.abs(hz) / gz, k);
  const tH = inv > 0 ? Math.pow(inv, -1 / k) : 1e9;
  return tH / Math.max(0.2, Math.cos(pitchDeg * Math.PI / 180));
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
  /** Room look tracker: goal (from the last solve) and the followed lens (position, velocity, view dir, angular velocity). */
  private roomInit = false;
  private roomGoalPos: [number, number, number] = [0, 0, 0];
  private roomGoalDir: [number, number, number] = [0, 0, -1];
  private roomPos: [number, number, number] = [0, 0, 0];
  private roomVel: [number, number, number] = [0, 0, 0];
  private roomDir: [number, number, number] = [0, 0, -1];
  private roomSpin: [number, number, number] = [0, 0, 0];
  /** Last geometric room blend weight and wall-limited arm (diagnostics / tests). */
  roomWeight = 0;
  roomArmM = 0;
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
    const look = this.lookPoint(feet);
    const dx = pose.position[0] - look[0], dy = pose.position[1] - look[1], dz = pose.position[2] - look[2];
    const dist = Math.hypot(dx, dy, dz) || this.limits.distMin;
    this.dist = this.clampDist(dist);
    this.pitch = Math.asin(Math.max(-1, Math.min(1, dy / Math.max(dist, 1e-4)))) * 180 / Math.PI;
    this.yaw = Math.atan2(dx, dz) * 180 / Math.PI;
    if (Number.isFinite(pose.fovVerticalDeg)) this.fov = pose.fovVerticalDeg;
    this.clampPitch();
    this.seeded = true;
    // Indoors the orbit goal is not the authored lens (keepInside / room look): the tracker starts from it and glides.
    if (this.limits.roomLook) this.roomFrom(pose);
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
    if (this.limits.roomLook) this.roomFrom(from);
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
    if (this.roomInit && t > 0 && this.limits.roomLook) this.roomTrack(t);
    if (this.mode === 'returning') {
      this.returnT += t;
      if (this.returnT >= ORBIT_FEEL.returnS) { this.returnT = ORBIT_FEEL.returnS; this.mode = 'free'; this.fromPose = null; }
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
    const look = this.lookPoint(feet);
    if (this.limits.roomLook && this.limits.keepInside) return this.solveRoom(look, boxes, groundY, xz);
    const goal = this.rawPose(feet);
    let pose = this.mode === 'returning' && this.fromPose ? this.blend(this.fromPose, goal, SMOOTH(this.returnT / ORBIT_FEEL.returnS)) : goal;
    pose = this.clearPose(pose, look, boxes, groundY, xz, look, null);
    return pose;
  }
  /** Room look goal before scenery collision: `aim` is where clearPose pushes the lens back toward. */
  roomGoal(look: Vec3): { pose: LookPose; aim: Vec3; w: number; arm: number } {
    const R = this.limits.roomLook!, kb = this.limits.keepInside!, n = ROOM_LOOK_FEEL.insetM;
    // the goal stays insetM inside keepInside so the tracker has room to lag around a corner without touching a face
    const box: OrbitBox = { min: [kb.min[0] + n, kb.min[1] + n, kb.min[2] + n], max: [kb.max[0] - n, kb.max[1] - n, kb.max[2] - n] };
    const pr = this.pitch * Math.PI / 180, yr = this.yaw * Math.PI / 180, cp = Math.cos(pr);
    const u: Vec3 = [Math.sin(yr) * cp, Math.sin(pr), Math.cos(yr) * cp];
    const arm = roomArm(look, this.yaw, this.pitch, box), d = softMin(this.dist, arm);
    const po: Vec3 = [look[0] + u[0] * d, softClamp(look[1] + u[1] * d, box.min[1], box.max[1]), look[2] + u[2] * d];
    const w = roomBlend(arm, R), c = R.center;
    const pos: Vec3 = [po[0] + (c[0] - po[0]) * w, po[1] + (c[1] - po[1]) * w, po[2] + (c[2] - po[2]) * w];
    const toHer = Math.hypot(look[0] - po[0], look[1] - po[1], look[2] - po[2]) || 1;
    const dir = [(look[0] - po[0]) / toHer * (1 - w) - u[0] * w, (look[1] - po[1]) / toHer * (1 - w) - u[1] * w, (look[2] - po[2]) / toHer * (1 - w) - u[2] * w];
    const L = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const reach = Math.max(1, toHer);  // = toHer whenever w = 0 (then the arm is ≥ ~1.15 m), so the target is exactly her
    const target: Vec3 = [pos[0] + dir[0] / L * reach, pos[1] + dir[1] / L * reach, pos[2] + dir[2] / L * reach];
    const aim: Vec3 = [look[0] + (c[0] - look[0]) * w, look[1] + (c[1] - look[1]) * w, look[2] + (c[2] - look[2]) * w];
    return { pose: { position: pos, target, fovVerticalDeg: this.fov }, aim, w, arm };
  }
  private solveRoom(look: Vec3, boxes: readonly OrbitBox[], groundY: number, xz?: readonly [number, number, number, number]): LookPose {
    const g = this.roomGoal(look);
    this.roomWeight = g.w; this.roomArmM = g.arm;
    const goal = this.clearPose(g.pose, g.aim, boxes, groundY, xz, look, g.pose.target);
    const gp = goal.position, gd = unitToward(gp, goal.target);
    this.roomGoalPos = [gp[0], gp[1], gp[2]]; this.roomGoalDir = [gd[0], gd[1], gd[2]];
    if (!this.roomInit) { this.roomPos = [gp[0], gp[1], gp[2]]; this.roomDir = [gd[0], gd[1], gd[2]]; this.roomVel = [0, 0, 0]; this.roomSpin = [0, 0, 0]; this.roomInit = true; }
    const p = this.roomPos, d = this.roomDir, reach = Math.max(1, Math.hypot(look[0] - p[0], look[1] - p[1], look[2] - p[2]));
    return { position: [p[0], p[1], p[2]], target: [p[0] + d[0] * reach, p[1] + d[1] * reach, p[2] + d[2] * reach], fovVerticalDeg: this.fov };
  }
  /** Start the tracker at a lens someone else wrote (authored home lens, end of a cinematic), at rest. */
  private roomFrom(pose: LookPose): void {
    const d = unitToward(pose.position, pose.target);
    this.roomPos = [pose.position[0], pose.position[1], pose.position[2]]; this.roomDir = [d[0], d[1], d[2]];
    this.roomVel = [0, 0, 0]; this.roomSpin = [0, 0, 0]; this.roomInit = true;
    this.roomGoalPos = [this.roomPos[0], this.roomPos[1], this.roomPos[2]]; this.roomGoalDir = [d[0], d[1], d[2]];
  }
  /** Critically damped follow of the room goal with capped linear and angular acceleration, then kept inside keepInside. */
  private roomTrack(t: number): void {
    const F = ROOM_LOOK_FEEL, w = F.omega, n = Math.max(1, Math.ceil(t / (1 / 120))), h = t / n;
    const amax = F.linAccMS2, wmax = F.angAccDegS2 * Math.PI / 180, box = this.limits.keepInside;
    for (let s = 0; s < n; s++) {
      const p = this.roomPos, v = this.roomVel, g = this.roomGoalPos;
      let a = [w * w * (g[0] - p[0]) - 2 * w * v[0], w * w * (g[1] - p[1]) - 2 * w * v[1], w * w * (g[2] - p[2]) - 2 * w * v[2]];
      let m = Math.hypot(a[0], a[1], a[2]); if (m > amax) a = [a[0] * amax / m, a[1] * amax / m, a[2] * amax / m];
      // Soft box edge: the goal already stays insetM inside keepInside; in that band the tracker eases off its speed toward
      // a face smoothly (allowed speed sqrt(2·brake·gap), braking grows with the excess, no bang-bang, no hard stop).
      // Braking takes priority; the rest of the accel budget is scaled to fit. A lens that starts outside (an authored
      // camera) is simply pulled in by the tracker, never snapped.
      if (box) {
        const br = [0, 0, 0]; let used = 0;
        for (let k = 0; k < 3; k++) {
          const lo = k === 0 ? box.min[0] : k === 1 ? box.min[1] : box.min[2], hi = k === 0 ? box.max[0] : k === 1 ? box.max[1] : box.max[2];
          const toward = Math.abs(v[k]), gap = v[k] > 0 ? hi - p[k] : p[k] - lo;
          if (toward <= 0 || gap > F.insetM + toward * toward / (2 * F.brakeMS2)) continue;
          const excess = toward - Math.sqrt(2 * F.brakeMS2 * Math.max(0, gap));
          if (excess <= 0) continue;
          br[k] = Math.min(F.brakeMS2, F.brakeGain * excess); used += br[k] * br[k];
        }
        if (used > 0) {
          let rest = 0; for (let k = 0; k < 3; k++) if (br[k] === 0) rest += a[k] * a[k];
          const room = Math.max(0, amax * amax - used);
          const f = rest > room ? Math.sqrt(room / rest) : 1;
          for (let k = 0; k < 3; k++) a[k] = br[k] > 0 ? -Math.sign(v[k]) * br[k] : a[k] * f;
        }
      }
      for (let k = 0; k < 3; k++) { v[k] += a[k] * h; p[k] += v[k] * h; }
      const d = this.roomDir, gd = this.roomGoalDir, o = this.roomSpin;
      let ax = [d[1] * gd[2] - d[2] * gd[1], d[2] * gd[0] - d[0] * gd[2], d[0] * gd[1] - d[1] * gd[0]];
      const sn = Math.hypot(ax[0], ax[1], ax[2]), cs = d[0] * gd[0] + d[1] * gd[1] + d[2] * gd[2], e = Math.atan2(sn, cs);
      ax = sn > 1e-9 ? [ax[0] / sn, ax[1] / sn, ax[2] / sn] : cs < 0 ? [0, 1, 0] : [0, 0, 0];
      let al = [w * w * e * ax[0] - 2 * w * o[0], w * w * e * ax[1] - 2 * w * o[1], w * w * e * ax[2] - 2 * w * o[2]];
      m = Math.hypot(al[0], al[1], al[2]); if (m > wmax) al = [al[0] * wmax / m, al[1] * wmax / m, al[2] * wmax / m];
      for (let k = 0; k < 3; k++) o[k] += al[k] * h;
      // spin about the view axis does nothing to a look direction; drop it so it cannot build up
      const along = o[0] * d[0] + o[1] * d[1] + o[2] * d[2]; o[0] -= along * d[0]; o[1] -= along * d[1]; o[2] -= along * d[2];
      const ang = Math.hypot(o[0], o[1], o[2]) * h;
      if (ang > 0) {
        const k3 = [o[0] / (ang / h), o[1] / (ang / h), o[2] / (ang / h)], c = Math.cos(ang), si = Math.sin(ang);
        const kd = k3[0] * d[0] + k3[1] * d[1] + k3[2] * d[2], kx = [k3[1] * d[2] - k3[2] * d[1], k3[2] * d[0] - k3[0] * d[2], k3[0] * d[1] - k3[1] * d[0]];
        const nd = [d[0] * c + kx[0] * si + k3[0] * kd * (1 - c), d[1] * c + kx[1] * si + k3[1] * kd * (1 - c), d[2] * c + kx[2] * si + k3[2] * kd * (1 - c)];
        const L = Math.hypot(nd[0], nd[1], nd[2]) || 1; this.roomDir = [nd[0] / L, nd[1] / L, nd[2] / L];
      }
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
