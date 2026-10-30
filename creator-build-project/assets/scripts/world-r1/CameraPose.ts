/**
 * 0007 v1.2 / 0006 v1.2 §B camera contract. The ONLY code that may write the world camera node transform or camera.fov
 * is applyCameraPose() below. setCamera/lookAt-style callers convert to CameraPose first (fromLookAt) and call it.
 * Engine-independent on purpose (no 'cc' import): the math is unit-testable in plain Node.
 * Units: metres, Cocos world space (+Y up, outdoor forward +Z), quaternion (x,y,z,w), vertical FOV in degrees.
 */
export type V3 = readonly [number, number, number];
export type Q4 = readonly [number, number, number, number];
export type CameraPose = Readonly<{ position: V3; rotation: Q4; fovVerticalDeg: number }>;
/** Look-at form used for route waypoints (fov optional = inherit) and for every interpolated transition. */
export type LookAtPose = Readonly<{ position: V3; target: V3; fovVerticalDeg?: number }>;
/**
 * 0007 v1.3 AUTHORED pose contract (regionCamera data, island_camera_pose.json 'yunjing-final'):
 * position + target + fovVerticalDeg are ALL mandatory; rotation is always DERIVED (fromLookAt, up=+Y, roll 0).
 * A rotation-only pose is not accepted, because transitions interpolate position/target (horizon kept).
 */
export type AuthoredPose = Readonly<{ position: V3; target: V3; fovVerticalDeg: number }>;
export function assertAuthoredPose(p: any, name: string): AuthoredPose {
  const v3 = (v: any) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
  if (!p || !v3(p.position) || !v3(p.target) || !Number.isFinite(p.fovVerticalDeg)) throw Error(`[0007] authored pose "${name}" needs position[3], target[3], fovVerticalDeg`);
  if ('rotation' in p) throw Error(`[0007] authored pose "${name}": rotation is derived, do not author it (v1.3 contract)`);
  const bad = validateCameraPose(fromLookAt(p)); if (bad) throw Error(`[0007] authored pose "${name}" invalid: ${bad}`);
  return p as AuthoredPose;
}
export const CAMERA_FIXED = Object.freeze({ fovAxis: 'vertical' as const, near: 0.05, far: 1000, defaultFovVerticalDeg: 45, minFov: 30, maxFov: 75 });

const sub = (a: V3, b: V3): [number, number, number] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): [number, number, number] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): [number, number, number] => { const l = Math.hypot(a[0], a[1], a[2]); if (!(l > 1e-9)) throw Error('Zero-length vector'); return [a[0] / l, a[1] / l, a[2] / l]; };

/**
 * Same result as Cocos Node.lookAt(target, +Y): view = normalize(position - target) (camera looks down its -Z),
 * then Quat.fromViewUp(view, up). NOTE (v1.2 correction of 0006 §B1 text): the view vector is position - target.
 */
export function rotationFromLookAt(position: V3, target: V3, up: V3 = [0, 1, 0]): Q4 {
  const z = norm(sub(position, target));
  const x = norm(cross(up, z));
  const y = cross(z, x);
  // Rotation matrix with columns x, y, z -> quaternion (Shepperd), same as Quat.fromMat3.
  const m00 = x[0], m01 = y[0], m02 = z[0], m10 = x[1], m11 = y[1], m12 = z[1], m20 = x[2], m21 = y[2], m22 = z[2];
  const tr = m00 + m11 + m22;
  let q: [number, number, number, number];
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); q = [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]; }
  else if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  else if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
  else { const s = 2 * Math.sqrt(1 + m22 - m00 - m11); q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]; }
  return normalizeQuat(q);
}
export function normalizeQuat(q: Q4): Q4 { const l = Math.hypot(q[0], q[1], q[2], q[3]); if (!(l > 1e-9)) throw Error('Zero quaternion'); return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }

/** Authoring -> runtime. fallbackFov is used only when the authoring pose has no FOV (e.g. legacy route waypoints). */
export function fromLookAt(p: LookAtPose, fallbackFov: number = CAMERA_FIXED.defaultFovVerticalDeg): CameraPose {
  const fov = p.fovVerticalDeg ?? fallbackFov;
  return Object.freeze({ position: [p.position[0], p.position[1], p.position[2]] as V3, rotation: rotationFromLookAt(p.position, p.target), fovVerticalDeg: fov });
}
export function validateCameraPose(p: CameraPose): string | null {
  if (!p.position.every(Number.isFinite) || !p.rotation.every(Number.isFinite) || !Number.isFinite(p.fovVerticalDeg)) return 'non-finite';
  if (Math.abs(Math.hypot(...p.rotation) - 1) > 1e-4) return 'rotation-not-unit';
  if (p.fovVerticalDeg < CAMERA_FIXED.minFov || p.fovVerticalDeg > CAMERA_FIXED.maxFov) return 'fov-out-of-range';
  // roll must be 0: camera right vector (+X rotated) must be horizontal.
  const r = rotate(p.rotation, [1, 0, 0]); if (Math.abs(r[1]) > 1e-3) return 'roll-not-zero';
  return null;
}

export const easing = Object.freeze({
  linear: (t: number) => t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
});
export type EasingName = keyof typeof easing;
const lerp3 = (a: V3, b: V3, w: number): V3 => [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w];
/**
 * v1.3 transition rule (keeps the horizon): lerp position, lerp target, lerp fov, THEN rotation = fromLookAt(up=+Y).
 * No quaternion slerp between poses (v1.2 bug: slerp between two roll-0 poses is not roll-0 in between).
 * Fov omitted on an endpoint = that endpoint uses fallbackFov.
 */
export function blendLookAt(a: LookAtPose, b: LookAtPose, t: number, ease: EasingName = 'linear', fallbackFov: number = CAMERA_FIXED.defaultFovVerticalDeg): CameraPose {
  const w = easing[ease](Math.max(0, Math.min(1, t)));
  const fa = a.fovVerticalDeg ?? fallbackFov, fb = b.fovVerticalDeg ?? fallbackFov;
  return fromLookAt({ position: lerp3(a.position, b.position, w), target: lerp3(a.target, b.target, w), fovVerticalDeg: fa + (fb - fa) * w });
}
/** Sample a keyed look-at path (progress per key, or evenly spaced). Same segment rule as the original animateCamera. */
export function sampleLookAtPath(path: readonly LookAtPose[], progress: readonly (number | undefined)[], p: number, fallbackFov: number): CameraPose {
  if (path.length === 0) throw Error('Empty camera path');
  if (path.length < 2) return fromLookAt(path[0], fallbackFov);
  const timed = path.length > 2 && progress.length === path.length && progress.every(k => k !== undefined) && progress[0] === 0 && progress[path.length - 1] === 1;
  const key = (j: number) => (timed ? progress[j]! : j / (path.length - 1));
  let i = 0; while (i < path.length - 2 && p > key(i + 1)) i++;
  const local = (p - key(i)) / Math.max(1e-9, key(i + 1) - key(i));
  return blendLookAt(path[i], path[i + 1], local, 'linear', fallbackFov);
}
/**
 * T2/T3a (运镜bot 2026-10-11) opt-in track timing/shape. Omitted options = the original linear keyed track, bit for bit.
 * - interpolation 'pchip': per-component monotone cubic Hermite (Fritsch-Carlson) over the key progress values for
 *   position, target and fov. Passes exactly through every key (approved compositions unchanged at keys), C1 (no velocity
 *   kink at keys), never overshoots between keys. Rotation is still derived by fromLookAt (roll 0).
 * - easeIn / easeOut: fraction of the track time used to accelerate from / decelerate to zero speed. C2 time remap
 *   (velocity AND acceleration continuous at the joins); the end pose is still reached exactly at p=1.
 */
export type TrackOptions = Readonly<{ interpolation?: 'linear' | 'pchip'; easeIn?: number; easeOut?: number; /** createProgressFollower tau (s) for distance-driven progress; default 0.25 */ followTauSeconds?: number }>;
/** C2 ease-in / linear / ease-out remap of [0,1] onto [0,1], f(0)=0, f(1)=1, f'(0)=0 if easeIn>0, f'(1)=0 if easeOut>0. */
export function remapProgress(p: number, o?: TrackOptions): number {
  const x = Math.max(0, Math.min(1, p)); if (!o) return x;
  const a = Math.max(0, Math.min(0.5, o.easeIn ?? 0)), b = Math.max(0, Math.min(0.5, o.easeOut ?? 0));
  if (a === 0 && b === 0) return x;
  const s = 1 / (1 - (a + b) / 3);
  if (a > 0 && x < a) { const u = x / a; return s * a * (u + Math.pow(1 - u, 3) / 3 - 1 / 3); }
  if (b > 0 && x > 1 - b) { const u = (x - (1 - b)) / b; return Math.min(1, s * (2 * a / 3 + (1 - a - b)) + s * b * (u - u * u * u / 3)); }
  return s * (2 * a / 3 + (x - a));
}
/** Walk-duration contract: camera track progress = time progress + a smoothed correction toward the reported
 * distance-travelled progress. The correction ignores a dead band (deadbandSeconds; one-frame job scheduling lag is not a
 * walk-profile deviation, so a constant-speed walk is exactly time-driven) and follows the rest with a critically damped
 * second-order filter (omega = 1/tauSeconds): no velocity step, bounded acceleration. Null distance -> correction decays.
 * Monotone; exactly 1 when the job ends. */
export function createProgressFollower(seconds: number, tauSeconds = 0.25, deadbandSeconds = 0.05): (p: number, distance: number | null) => number {
  let last = 0, lastP = 0, e = 0, ev = 0; const w = tauSeconds > 0 ? 1 / tauSeconds : 0, S = seconds > 0 ? seconds : 1;
  return (p: number, distance: number | null) => {
    const dt = Math.max(0, (p - lastP) * S); lastP = p;
    let target = 0;
    if (typeof distance === 'number' && Number.isFinite(distance)) {
      const d = (Math.max(0, Math.min(1, distance)) - p) * S, m = Math.max(0, Math.abs(d) - deadbandSeconds);
      target = (d < 0 ? -m : m) / S;
    }
    if (dt > 0) { if (w > 0) { ev += (w * w * (target - e) - 2 * w * ev) * dt; e += ev * dt; } else e = target; }
    const v = p >= 1 ? 1 : Math.max(last, Math.max(0, Math.min(1, p + e))); last = v; return v;
  };
}
/** Time fraction at which the eased track reaches key progress k (remapProgress is monotone; bisection). */
export function invertProgress(k: number, o?: TrackOptions): number { let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (remapProgress(m, o) < k) lo = m; else hi = m; } return (lo + hi) / 2; }
/** Fritsch-Carlson monotone cubic tangents for knots t (strictly increasing) and values y. */
function pchipTangents(t: readonly number[], y: readonly number[]): number[] {
  const n = t.length, h: number[] = [], d: number[] = [], m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) { h.push(t[i + 1] - t[i]); d.push((y[i + 1] - y[i]) / (t[i + 1] - t[i])); }
  if (n === 2) { m[0] = m[1] = d[0]; return m; }
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] === 0 || d[i] === 0 || Math.sign(d[i - 1]) !== Math.sign(d[i])) { m[i] = 0; continue; }
    const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  }
  // Shape-preserving three-point end conditions (same as MATLAB/SciPy pchip).
  const end = (h0: number, h1: number, d0: number, d1: number) => {
    let v = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
    if (Math.sign(v) !== Math.sign(d0)) v = 0; else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(v) > Math.abs(3 * d0)) v = 3 * d0;
    return v;
  };
  m[0] = end(h[0], h[1], d[0], d[1]); m[n - 1] = end(h[n - 2], h[n - 3], d[n - 2], d[n - 3]);
  return m;
}
function hermite(t: readonly number[], y: readonly number[], m: readonly number[], x: number): number {
  let i = 0; while (i < t.length - 2 && x > t[i + 1]) i++;
  const h = t[i + 1] - t[i], u = Math.max(0, Math.min(1, (x - t[i]) / h)), u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * y[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * y[i + 1] + (u3 - u2) * h * m[i + 1];
}
/** Pre-computed pchip sampler for a timed look-at path. Falls back to the linear sampler when keys are not timed. */
export function createPathSampler(path: readonly LookAtPose[], progress: readonly (number | undefined)[], o?: TrackOptions) {
  const timed = path.length > 2 && progress.length === path.length && progress.every(k => k !== undefined) && progress[0] === 0 && progress[path.length - 1] === 1;
  const strictly = timed && progress.every((k, i) => i === 0 || (k as number) > (progress[i - 1] as number));
  if (o?.interpolation !== 'pchip' || !strictly) return (p: number, fallbackFov: number) => sampleLookAtPath(path, progress, remapProgress(p, o), fallbackFov);
  const t = progress as number[];
  let cache: { fov: number; channels: { y: number[]; m: number[] }[] } | null = null;
  const build = (fallbackFov: number) => {
    const rows: number[][] = path.map(k => [k.position[0], k.position[1], k.position[2], k.target[0], k.target[1], k.target[2], k.fovVerticalDeg ?? fallbackFov]);
    return { fov: fallbackFov, channels: [0, 1, 2, 3, 4, 5, 6].map(c => { const y = rows.map(r => r[c]); return { y, m: pchipTangents(t, y) }; }) };
  };
  return (p: number, fallbackFov: number): CameraPose => {
    if (!cache || cache.fov !== fallbackFov) cache = build(fallbackFov);
    const q = remapProgress(p, o);
    if (q >= 1) return fromLookAt(path[path.length - 1], fallbackFov);
    if (q <= 0) return fromLookAt(path[0], fallbackFov);
    const v = cache.channels.map(ch => hermite(t, ch.y, ch.m, q));
    // pchip is monotone, so fov stays inside the key range; clamp only removes float rounding (75.00000000000001 at a
    // 75-degree key would be rejected by the pose guard and abort the track).
    const fy = cache.channels[6].y, fov = Math.min(Math.max(v[6], Math.min(...fy)), Math.max(...fy));
    return fromLookAt({ position: [v[0], v[1], v[2]], target: [v[3], v[4], v[5]], fovVerticalDeg: fov });
  };
}
/** T2 lighting: smoothstep ramp of a 0..1 weight over [start,end] of walk progress (C1, monotone, exact endpoints). */
export type WeightRamp = Readonly<{ from: number; to: number; start: number; end: number }>;
export function smoothstep01(x: number): number { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); }
export function rampWeight(r: WeightRamp, p: number): number {
  const x = (p - r.start) / Math.max(1e-9, r.end - r.start);
  return r.from + (r.to - r.from) * smoothstep01(x);
}
/** For runtime-only poses (0006 §C: C0 -> cineCam(t)) that have no target: interpolate yaw (shortest arc) + pitch, keep roll 0. */
export function yawPitch(q: Q4): { yaw: number; pitch: number } {
  const f = rotate(q, [0, 0, -1]); return { yaw: Math.atan2(f[0], f[2]), pitch: Math.asin(Math.max(-1, Math.min(1, f[1]))) };
}
export function blendPoseHorizon(a: CameraPose, b: CameraPose, t: number, ease: EasingName = 'linear'): CameraPose {
  const w = easing[ease](Math.max(0, Math.min(1, t)));
  const A = yawPitch(a.rotation), B = yawPitch(b.rotation);
  let dy = B.yaw - A.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
  const yaw = A.yaw + dy * w, pitch = Math.max(-1.5, Math.min(1.5, A.pitch + (B.pitch - A.pitch) * w));
  const pos = lerp3(a.position, b.position, w), f: V3 = [Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)];
  return fromLookAt({ position: pos, target: [pos[0] + f[0], pos[1] + f[1], pos[2] + f[2]], fovVerticalDeg: a.fovVerticalDeg + (b.fovVerticalDeg - a.fovVerticalDeg) * w });
}

export function rotate(q: Q4, v: V3): [number, number, number] {
  const [x, y, z, w] = q; const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}
/** Debug: project a world point to NDC (x right, y up, both in [-1,1] when on screen). depth<=near => behind. */
export function projectPoint(pose: CameraPose, aspect: number, point: V3): { x: number; y: number; depth: number } {
  const inv: Q4 = [-pose.rotation[0], -pose.rotation[1], -pose.rotation[2], pose.rotation[3]];
  const local = rotate(inv, sub(point, pose.position));
  const depth = -local[2], t = Math.tan((pose.fovVerticalDeg * Math.PI) / 360);
  return { x: local[0] / (depth * t * aspect), y: local[1] / (depth * t), depth };
}
export type FrameLimits = Readonly<{ maxAbsX: number; minY: number; maxY: number }>;
/** 0007 §7.4 frame rule (bbox only; says nothing about occlusion or HUD). */
export const FRAME_LIMITS: FrameLimits = Object.freeze({ maxAbsX: 0.7, minY: -0.85, maxY: 0.75 });
export function characterBox(root: V3, heightM: number, halfWidthM: number): V3[] {
  const out: V3[] = [];
  for (const dx of [-halfWidthM, halfWidthM]) for (const dz of [-halfWidthM, halfWidthM]) for (const y of [0, heightM]) out.push([root[0] + dx, root[1] + y, root[2] + dz]);
  return out;
}
export function frameCheck(pose: CameraPose, aspect: number, box: readonly V3[], limits: FrameLimits = FRAME_LIMITS) {
  const pts = box.map(p => projectPoint(pose, aspect, p));
  const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x)), minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
  const behind = pts.some(p => p.depth <= CAMERA_FIXED.near);
  const pass = !behind && Math.max(Math.abs(minX), Math.abs(maxX)) <= limits.maxAbsX && minY >= limits.minY && maxY <= limits.maxY;
  return { aspect, minX, maxX, minY, maxY, behind, pass, scope: 'bbox-only; occlusion/HUD not checked' };
}

/** Structural types so this file stays engine-free; a cc.Node / cc.Camera satisfy them. */
export type CameraNodeLike = { setWorldPosition(x: number, y: number, z: number): unknown; setWorldRotation(x: number, y: number, z: number, w: number): unknown };
export type CameraLike = { node: CameraNodeLike; fov: number };
export type CameraWriteLog = { writes: number; last: CameraPose | null; lastSource: string; rejected: number; trackAborts: number; lastAbort: string };
export const cameraWriteLog: CameraWriteLog = { writes: 0, last: null, lastSource: '', rejected: 0, trackAborts: 0, lastAbort: '' };
/** Test-only ?camTrace=1 (region/CamTrace.ts sets it); null = off. */
export const cameraWriteHook: { trace: ((source: string) => void) | null; log: ((camera: any, pose: CameraPose, source: string) => void) | null } = { trace: null, log: null };
let wfr = -1, wcam: unknown = null;
/** THE single writer: position, rotation, then fov. Invalid poses are rejected (logged, camera untouched). */
export function applyCameraPose(camera: CameraLike, pose: CameraPose, source: string, opts?: { allowRoll?: boolean }): boolean {
  let bad = validateCameraPose(pose); if (bad === 'roll-not-zero' && opts?.allowRoll) bad = null;
  if (bad) { cameraWriteLog.rejected++; console.warn('applyCameraPose rejected', source, bad, pose); return false; }
  // onewriter: a 2nd write in the same engine frame matching the 1st (≤1 cm, ≤~0.5°, ≤0.05° fov) is merged, not re-applied.
  let fr = -1; try { fr = (globalThis as any).cc.director.getTotalFrames(); } catch { }
  const l = cameraWriteLog.last, q = pose.position, r = pose.rotation;
  if (fr >= 0 && fr === wfr && camera === wcam && l && (q[0] - l.position[0]) ** 2 + (q[1] - l.position[1]) ** 2 + (q[2] - l.position[2]) ** 2 <= 1e-4 && Math.abs(r[0] * l.rotation[0] + r[1] * l.rotation[1] + r[2] * l.rotation[2] + r[3] * l.rotation[3]) >= 0.99999 && Math.abs(pose.fovVerticalDeg - l.fovVerticalDeg) <= 0.05) return true;
  wfr = fr; wcam = camera;
  camera.node.setWorldPosition(pose.position[0], pose.position[1], pose.position[2]);
  camera.node.setWorldRotation(pose.rotation[0], pose.rotation[1], pose.rotation[2], pose.rotation[3]);
  camera.fov = pose.fovVerticalDeg;
  cameraWriteLog.writes++; cameraWriteLog.last = pose; cameraWriteLog.lastSource = source;
  if (cameraWriteHook.trace) cameraWriteHook.trace(source);
  if (cameraWriteHook.log) cameraWriteHook.log(camera, pose, source); // region/CamTraceLog (?camTrace=1 / __QF_CAM_TRACE)
  return true;
}

/** A rejected track is a failed transition; the last actual camera pose stays untouched. */
export class CameraTrackFailure extends Error {
  constructor(readonly progress: number, readonly reason: string) {
    super(`[0007] camera track failed at ${progress.toFixed(4)}: ${reason}`);
    this.name = 'CameraTrackFailure';
  }
}
/** Each sample goes through the single writer. Failure never writes an endpoint or reports arrival. */
export function createCameraTrack(camera: CameraLike, path: readonly LookAtPose[], source: string, options?: TrackOptions) {
  const status = { samples: 0, accepted: 0, aborted: false, abortReason: '', ended: 'running' as 'running' | 'end-pose' | 'last-accepted' | 'none' };
  let fallbackFov: number | undefined, lastAccepted: CameraPose | null = null;
  // No options = createPathSampler returns exactly the original linear sampleLookAtPath call (remap is identity).
  const sample = createPathSampler(path, path.map(k => (k as any).progress as number | undefined), options);
  const write = (pose: CameraPose, tag: string) => { const ok = applyCameraPose(camera, pose, tag); if (ok) lastAccepted = pose; return ok; };
  const abort = (p: number, reason: string): never => {
    status.aborted = true; status.abortReason = reason;
    status.ended = lastAccepted ? 'last-accepted' : 'none';
    cameraWriteLog.trackAborts++; cameraWriteLog.lastAbort = `${source}@${p.toFixed(4)}: ${reason}`;
    console.error('[0007] camera track failed', source, 'progress', p, reason, '-> keeping last valid camera pose');
    throw new CameraTrackFailure(p, reason);
  };
  /** Returns the eased key progress of the written sample (T2+ wind channel), or -1 when nothing was written. */
  const tick = (p: number): number => {
    if (status.aborted) return -1;
    if (fallbackFov === undefined) fallbackFov = camera.fov; // legacy waypoints without fov inherit the start fov
    if (!status.samples++ && p < 1) return -1; // onewriter: run() ticks 0 in the frame of the previous write (hold / last track end); start next frame
    let pose: CameraPose;
    try { pose = sample(p, fallbackFov); }
    catch (e) { abort(p, 'sample: ' + String(e)); return -1; }
    if (!write(pose, source)) { abort(p, 'applyCameraPose rejected: ' + (validateCameraPose(pose) ?? 'unknown')); return -1; }
    status.accepted++;
    if (p >= 1) status.ended = 'end-pose';
    return options ? remapProgress(p, options) : Math.max(0, Math.min(1, p));
  };
  return { tick, status };
}
