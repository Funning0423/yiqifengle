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
/** THE single writer: position, rotation, then fov. Invalid poses are rejected (logged, camera untouched). */
export function applyCameraPose(camera: CameraLike, pose: CameraPose, source: string, opts?: { allowRoll?: boolean }): boolean {
  let bad = validateCameraPose(pose); if (bad === 'roll-not-zero' && opts?.allowRoll) bad = null;
  if (bad) { cameraWriteLog.rejected++; console.warn('applyCameraPose rejected', source, bad, pose); return false; }
  camera.node.setWorldPosition(pose.position[0], pose.position[1], pose.position[2]);
  camera.node.setWorldRotation(pose.rotation[0], pose.rotation[1], pose.rotation[2], pose.rotation[3]);
  camera.fov = pose.fovVerticalDeg;
  cameraWriteLog.writes++; cameraWriteLog.last = pose; cameraWriteLog.lastSource = source;
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
export function createCameraTrack(camera: CameraLike, path: readonly LookAtPose[], source: string) {
  const status = { samples: 0, accepted: 0, aborted: false, abortReason: '', ended: 'running' as 'running' | 'end-pose' | 'last-accepted' | 'none' };
  let fallbackFov: number | undefined, lastAccepted: CameraPose | null = null;
  const write = (pose: CameraPose, tag: string) => { const ok = applyCameraPose(camera, pose, tag); if (ok) lastAccepted = pose; return ok; };
  const abort = (p: number, reason: string): never => {
    status.aborted = true; status.abortReason = reason;
    status.ended = lastAccepted ? 'last-accepted' : 'none';
    cameraWriteLog.trackAborts++; cameraWriteLog.lastAbort = `${source}@${p.toFixed(4)}: ${reason}`;
    console.error('[0007] camera track failed', source, 'progress', p, reason, '-> keeping last valid camera pose');
    throw new CameraTrackFailure(p, reason);
  };
  const tick = (p: number) => {
    if (status.aborted) return;
    if (fallbackFov === undefined) fallbackFov = camera.fov; // legacy waypoints without fov inherit the start fov
    status.samples++;
    let pose: CameraPose;
    try { pose = sampleLookAtPath(path, path.map(k => (k as any).progress as number | undefined), p, fallbackFov); }
    catch (e) { abort(p, 'sample: ' + String(e)); return; }
    if (!write(pose, source)) { abort(p, 'applyCameraPose rejected: ' + (validateCameraPose(pose) ?? 'unknown')); return; }
    status.accepted++;
    if (p >= 1) status.ended = 'end-pose';
  };
  return { tick, status };
}
