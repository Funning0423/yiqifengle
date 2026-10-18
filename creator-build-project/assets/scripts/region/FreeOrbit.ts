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
export type OrbitBox = Readonly<{ min: Vec3; max: Vec3 }>;
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
}>;

/** Pitch is the camera's elevation above her chest. Distance is metres from that point. */
export const ORBIT_LIMITS: Readonly<Record<OrbitPlace, OrbitLimits>> = Object.freeze({
  home: { pitchMinDeg: -14, pitchMaxDeg: 26, distMin: 1.25, distMax: 3.35, yawHalfDeg: Infinity, lookM: 1.05, fovDeg: 60,
    keepInside: { min: [-1.85, 0.7, -4.72], max: [1.05, 2.2, -1.55] } },
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
    const goal = this.rawPose(feet);
    let pose = this.mode === 'returning' && this.fromPose ? this.blend(this.fromPose, goal, SMOOTH(this.returnT / ORBIT_FEEL.returnS)) : goal;
    pose = this.clearPose(pose, this.lookPoint(feet), boxes, groundY, xz);
    return pose;
  }
  private blend(a: LookPose, b: LookPose, e: number): LookPose {
    const p: Vec3 = [a.position[0] + (b.position[0] - a.position[0]) * e, a.position[1] + (b.position[1] - a.position[1]) * e, a.position[2] + (b.position[2] - a.position[2]) * e];
    const t: Vec3 = [a.target[0] + (b.target[0] - a.target[0]) * e, a.target[1] + (b.target[1] - a.target[1]) * e, a.target[2] + (b.target[2] - a.target[2]) * e];
    return { position: p, target: t, fovVerticalDeg: a.fovVerticalDeg + (b.fovVerticalDeg - a.fovVerticalDeg) * e };
  }
  private clearPose(pose: LookPose, look: Vec3, boxes: readonly OrbitBox[], groundY: number, xz?: readonly [number, number, number, number]): LookPose {
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
        const g = Math.min(boxGap(p, boxes[i]), boxGap(near, boxes[i]));
        if (g < ORBIT_FEEL.clearM) push = Math.max(push, ORBIT_FEEL.clearM - g + 0.05);
      }
      if (push <= 0) break;
      const dir = unitToward(look, p);
      const back = Math.min(push, Math.max(0.05, Math.hypot(p[0] - look[0], p[1] - look[1], p[2] - look[2]) - 0.8));
      p = [p[0] - dir[0] * back, p[1] - dir[1] * back, p[2] - dir[2] * back];
    }
    if (Number.isFinite(groundY) && p[1] < groundY + ORBIT_FEEL.groundClearM) p[1] = groundY + ORBIT_FEEL.groundClearM;
    return { position: p, target: [look[0], look[1], look[2]], fovVerticalDeg: pose.fovVerticalDeg };
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
