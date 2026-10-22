/**
 * R5 lakeside life (场景特效bot): wind chimes that swing with the global wind, wind-aligned light ripples on the lake (shader,
 * lakeside-water.effect windParams) and a few night fireflies drifting downwind. Pure module (no 'cc'), loose ES5.
 * Wind: GlobalWind gives the WORLD direction the wind blows TO. Callers turn it into the lake's local frame with
 * windToLocal(dirX, dirZ, lakeYawDeg) (lake root yaw about +Y, Cocos rotY: local = rotY(-yaw)·world).
 */
export type LifeVec = [number, number, number];
export const LAKESIDE_LIFE = {
  /** Chimes swung by code: every LK_windchime instance (origin = hanging point) plus the pavilion chime added here. */
  chimeGlb: 'LK_windchime.glb',
  /** New chime under the lake-facing eave corner of LK_pavilion_i (pavilion at (13.6,0.55,-4.6), eave corner r 2.35 at y 2.60;
   *  hung at r 2.15 on the (-1.17, 2.04) corner ray, 2.58 above its base). Lake-local. */
  pavilionChime: { name: 'LK_windchime_pavilion', pos: [12.53, 3.13, -2.73] as LifeVec },
  /** Swing: lean downwind (mean) + slow sway + small flutter, radians at strength 1. */
  chimeLeanRad: 0.10, chimeSwayRad: 0.07, chimeSwayHz: 0.42, chimeFlutterRad: 0.025, chimeFlutterHz: 1.7,
  /** Fireflies: count, lake-local box near the near shore (reeds / lawn under the board camera), drift and glow. */
  fireflyCount: 14,
  fireflyBox: { min: [-9, 0.75, 17.5] as LifeVec, max: [9, 2.1, 23.5] as LifeVec },
  fireflyDriftMps: 0.22, fireflyWanderM: 0.35, fireflySize: 0.045,
  /** Night colour (linear): soft lime-amber that sits on the blue-teal night palette; additive. */
  fireflyColor: [0.95, 0.88, 0.42] as LifeVec,
  /** Water ripple (shader): x amplitude (normal tilt), y wavenumber (rad/m), z speed (rad/s). */
  ripple: [0.035, 2.4, 1.6] as LifeVec,
};
export function windToLocal(dirX: number, dirZ: number, lakeYawDeg: number): [number, number] {
  var a = -lakeYawDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  // rotY(a): x' = x cos + z sin, z' = -x sin + z cos
  var x = dirX * c + dirZ * s, z = -dirX * s + dirZ * c, l = Math.sqrt(x * x + z * z) || 1;
  return [x / l, z / l];
}
function hash(i: number, k: number): number { var v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); }
/** Chime pose at time t (s): axis (local, unit) and angle (rad) so the hanging end (-Y) moves DOWNWIND (dx, dz).
 *  Rotating -Y about (-dz, 0, dx) by +θ moves it toward (dx, 0, dz). */
export function chimeSwing(t: number, i: number, dx: number, dz: number, strength: number): { axis: LifeVec; angle: number } {
  var L = LAKESIDE_LIFE, ph = hash(i, 1) * 6.2832, s = Math.max(0, strength);
  var ang = s * (L.chimeLeanRad + L.chimeSwayRad * Math.sin(2 * Math.PI * L.chimeSwayHz * t + ph)) + s * L.chimeFlutterRad * Math.sin(2 * Math.PI * L.chimeFlutterHz * t + 2 * ph);
  return { axis: [-dz, 0, dx], angle: ang };
}
/** Quaternion (x, y, z, w) of a rotation about unit axis by angle. */
export function axisAngleQuat(axis: LifeVec, angle: number): [number, number, number, number] {
  var h = angle / 2, s = Math.sin(h); return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(h)];
}
/** Firefly i at time t: lake-local position (drifts downwind through the box and wraps) and glow 0..1 (slow pulse). */
export function fireflyAt(t: number, i: number, dx: number, dz: number): { pos: LifeVec; glow: number } {
  var L = LAKESIDE_LIFE, b = L.fireflyBox, sx = b.max[0] - b.min[0], sy = b.max[1] - b.min[1], sz = b.max[2] - b.min[2];
  var d = L.fireflyDriftMps * t, w = L.fireflyWanderM;
  var u = hash(i, 2) * sx + dx * d + w * Math.sin(t * (0.37 + 0.2 * hash(i, 3)) + i);
  var v = hash(i, 4) * sz + dz * d + w * Math.cos(t * (0.31 + 0.2 * hash(i, 5)) + 2 * i);
  var y = b.min[1] + sy * (0.25 + 0.5 * hash(i, 6)) + 0.18 * Math.sin(t * (0.6 + 0.3 * hash(i, 7)) + 3 * i);
  u = ((u % sx) + sx) % sx; v = ((v % sz) + sz) % sz;
  // fade near the box edges so the wrap is never seen
  var edge = Math.min(u, sx - u, v, sz - v), fade = Math.min(1, edge / 0.8);
  var p = 0.5 + 0.5 * Math.sin(t * (1.1 + 0.6 * hash(i, 8)) + 6.2832 * hash(i, 9));
  return { pos: [b.min[0] + u, y, b.min[2] + v], glow: fade * (0.25 + 0.75 * p * p) };
}
/** Octahedron (8 tris) for one firefly, unit radius scaled by size; vertex colour carries the glow tint. */
export function fireflyMesh(size: number): { positions: number[]; indices: number[] } {
  var r = size, P = [r, 0, 0, -r, 0, 0, 0, r, 0, 0, -r, 0, 0, 0, r, 0, 0, -r];
  return { positions: P, indices: [0, 2, 4, 4, 2, 1, 1, 2, 5, 5, 2, 0, 4, 3, 0, 1, 3, 4, 5, 3, 1, 0, 3, 5] };
}
