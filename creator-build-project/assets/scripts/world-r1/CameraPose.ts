/**
 * 0007 v1.2 / 0006 v1.2 §B camera contract. The ONLY code that may write the world camera node transform or camera.fov
 * is applyCameraPose() below. setCamera/lookAt-style callers convert to CameraPose first (fromLookAt) and call it.
 * Engine-independent on purpose (no 'cc' import): the math is unit-testable in plain Node.
 * Units: metres, Cocos world space (+Y up, outdoor forward +Z), quaternion (x,y,z,w), vertical FOV in degrees.
 */
export type V3 = readonly [number, number, number];
export type Q4 = readonly [number, number, number, number];
export type CameraPose = Readonly<{ position: V3; rotation: Q4; fovVerticalDeg: number }>;
/** Authoring-only form (regionCamera.json / island_camera_pose.json / route tables). Converted ONCE by fromLookAt. */
export type LookAtPose = Readonly<{ position: V3; target: V3; fovVerticalDeg?: number }>;
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

export function slerp(a: Q4, b: Q4, t: number): Q4 {
  let [bx, by, bz, bw] = b; let d = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (d < 0) { d = -d; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let s0: number, s1: number;
  if (1 - d > 1e-6) { const o = Math.acos(Math.min(1, d)), so = Math.sin(o); s0 = Math.sin((1 - t) * o) / so; s1 = Math.sin(t * o) / so; } else { s0 = 1 - t; s1 = t; }
  return normalizeQuat([s0 * a[0] + s1 * bx, s0 * a[1] + s1 * by, s0 * a[2] + s1 * bz, s0 * a[3] + s1 * bw]);
}
export const easing = Object.freeze({
  linear: (t: number) => t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
});
/** Position lerp, rotation slerp, FOV lerp; the weight is passed through the named easing first. */
export function blendPose(a: CameraPose, b: CameraPose, t: number, ease: keyof typeof easing = 'linear'): CameraPose {
  const w = easing[ease](Math.max(0, Math.min(1, t)));
  return Object.freeze({
    position: [a.position[0] + (b.position[0] - a.position[0]) * w, a.position[1] + (b.position[1] - a.position[1]) * w, a.position[2] + (b.position[2] - a.position[2]) * w] as V3,
    rotation: slerp(a.rotation, b.rotation, w),
    fovVerticalDeg: a.fovVerticalDeg + (b.fovVerticalDeg - a.fovVerticalDeg) * w,
  });
}
/** Sample a keyed path (progress in [0,1] per key, or evenly spaced). Same segment rule as the old animateCamera. */
export function samplePath(path: readonly CameraPose[], progress: readonly (number | undefined)[], p: number): CameraPose {
  if (path.length === 0) throw Error('Empty camera path');
  if (path.length < 2) return path[0];
  const timed = path.length > 2 && progress.length === path.length && progress.every(k => k !== undefined) && progress[0] === 0 && progress[path.length - 1] === 1;
  const key = (j: number) => (timed ? progress[j]! : j / (path.length - 1));
  let i = 0; while (i < path.length - 2 && p > key(i + 1)) i++;
  const local = (p - key(i)) / Math.max(1e-9, key(i + 1) - key(i));
  return blendPose(path[i], path[i + 1], local, 'linear');
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
export type CameraWriteLog = { writes: number; last: CameraPose | null; lastSource: string; rejected: number };
export const cameraWriteLog: CameraWriteLog = { writes: 0, last: null, lastSource: '', rejected: 0 };
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
