/** 场景特效bot r5 S2-2 (engine-free, loose ES5): 360-degree fixes for the room interior, in room-model coordinates
 * (room_no_original_chair.glb scene_root is identity, Y-up, metres). Geometry only; RoomShell360.ts mounts it.
 *
 * - env_window_blind_cards was a painted day-view quad in the small window beside the door. The lighthouse wall
 *   (env_lighthouse_ext) is solid 3-4 cm behind it, so there is no outside to show there. It becomes a real closed
 *   louvred shutter: two leaves (stiles, rails, 12 tilted slats each) and a dark backing board, all boxes with
 *   thickness, fitted in the 7.7 cm gap between the window glass (-4.2 cm) and the wall (+3.3 cm): frame -1.8..+0.6 cm,
 *   slats -3.4..+1.4 cm, backing +1.6..+2.2 cm.
 * - env_rear_window_plant was a 20-triangle leaf card standing in the terracotta pot of env_rear_window_detail.
 *   It becomes a small solid leaf clump (core + six thick leaf lobes), parented to the same node so it keeps the
 *   RoomLightingRig sway.
 * Colours are cells of the shared env_palette_256 (M_env_palette): row r centre v = (r + 0.5) / 16. */

export type FlatMesh = { positions: number[]; normals: number[]; uvs: number[]; indices: number[] };
type V3 = [number, number, number];

/** Window quad measured from env_window_blind_cards (decoded GLB): bottom corners A/B, y 1.79..3.03. */
export const ROOM360_WINDOW = Object.freeze({
  a: [2.1, 1.79, -1.07] as V3, b: [1.48, 1.79, -0.48] as V3, yMin: 1.79, yMax: 3.03,
  /** Offsets along the outward window normal from the card plane: glass -0.042, wall +0.033. */
  glassOff: -0.042, wallOff: 0.033,
  halfWidth: 0.385, halfHeight: 0.52, slatsPerLeaf: 12, slatTiltDeg: 30,
});
/** Pot top centre of the rear-window plant (node translation of env_rear_window_plant). */
export const ROOM360_PLANT_ORIGIN: V3 = [1.3670506400771107, 1.91, -4.5682290187413335];

const PAL = (row: number, u: number): [number, number] => [Math.min(0.97, Math.max(0.03, u)), (row + 0.5) / 16];
export const ROOM360_PALETTE = Object.freeze({
  frame: PAL(10, 0.42), slat: PAL(10, 0.56), backing: PAL(8, 0.12),
  leafA: PAL(11, 0.3), leafB: PAL(11, 0.45), leafC: PAL(11, 0.58), leafCore: PAL(0, 0.3),
});

function sub(a: V3, b: V3): V3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a: V3, b: V3): V3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function mul(a: V3, s: number): V3 { return [a[0] * s, a[1] * s, a[2] * s]; }
function cross(a: V3, b: V3): V3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a: V3): V3 { const l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

function emptyMesh(): FlatMesh { return { positions: [], normals: [], uvs: [], indices: [] }; }

/** One flat-shaded triangle; the normal is flipped toward `outHint` when given (keeps closed shapes outward). */
function tri(m: FlatMesh, p0: V3, p1: V3, p2: V3, uv: [number, number], outHint?: V3): void {
  let n = norm(cross(sub(p1, p0), sub(p2, p0)));
  if (outHint) {
    const c = mul(add(add(p0, p1), p2), 1 / 3), d = sub(c, outHint);
    if (n[0] * d[0] + n[1] * d[1] + n[2] * d[2] < 0) { const t = p1; p1 = p2; p2 = t; n = mul(n, -1); }
  }
  const base = m.positions.length / 3, pts = [p0, p1, p2];
  for (let i = 0; i < 3; i++) {
    m.positions.push(pts[i][0], pts[i][1], pts[i][2]); m.normals.push(n[0], n[1], n[2]); m.uvs.push(uv[0], uv[1]);
  }
  m.indices.push(base, base + 1, base + 2);
}

/** Closed box: centre c, orthonormal axes u/v/w, half extents. 12 triangles, outward normals. */
export function box(m: FlatMesh, c: V3, u: V3, v: V3, w: V3, hu: number, hv: number, hw: number, uv: [number, number]): void {
  const corner = (su: number, sv: number, sw: number): V3 => add(add(add(c, mul(u, su * hu)), mul(v, sv * hv)), mul(w, sw * hw));
  const faces: number[][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (let f = 0; f < faces.length; f++) {
    const ax = faces[f], q: V3[] = [];
    // four corners of this face in a consistent loop
    const loop = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let k = 0; k < 4; k++) {
      const s = loop[k];
      if (ax[0] !== 0) q.push(corner(ax[0], s[0], s[1]));
      else if (ax[1] !== 0) q.push(corner(s[0], ax[1], s[1]));
      else q.push(corner(s[0], s[1], ax[2]));
    }
    tri(m, q[0], q[1], q[2], uv, c); tri(m, q[0], q[2], q[3], uv, c);
  }
}

/** Window frame: outward normal n, along-window u, up v, centre on the card plane. */
export function windowFrame(): { c: V3; u: V3; v: V3; n: V3 } {
  const W = ROOM360_WINDOW, a = W.a, b = W.b;
  const u = norm(sub(b, a)), v: V3 = [0, 1, 0];
  let n = norm(cross(u, v));
  const c: V3 = [(a[0] + b[0]) / 2, (W.yMin + W.yMax) / 2, (a[2] + b[2]) / 2];
  // outward = away from the room centre (-0.4, y, -2.6)
  const toRoom = sub([-0.4, c[1], -2.6], c);
  if (n[0] * toRoom[0] + n[2] * toRoom[2] > 0) n = mul(n, -1);
  return { c, u, v, n };
}

export function buildWindowShutter(): FlatMesh {
  const W = ROOM360_WINDOW, P = ROOM360_PALETTE, m = emptyMesh(), f = windowFrame();
  const at = (du: number, dv: number, dn: number): V3 => add(add(add(f.c, mul(f.u, du)), mul(f.v, dv)), mul(f.n, dn));
  // backing board just in front of the wall
  box(m, at(0, 0, W.wallOff - 0.014), f.u, f.v, f.n, W.halfWidth - 0.02, W.halfHeight - 0.04, 0.003, P.backing);
  const leafW = W.halfWidth, stile = 0.035, rail = 0.05, frameN = -0.006, frameHw = 0.012;
  const tilt = W.slatTiltDeg * Math.PI / 180;
  const sv = norm(add(mul(f.v, Math.cos(tilt)), mul(f.n, Math.sin(tilt))));
  const sw = norm(cross(f.u, sv));
  for (let leaf = 0; leaf < 2; leaf++) {
    const cu = (leaf === 0 ? -0.5 : 0.5) * leafW;
    const hu = leafW / 2;
    box(m, at(cu - hu + stile / 2, 0, frameN), f.u, f.v, f.n, stile / 2, W.halfHeight, frameHw, P.frame);
    box(m, at(cu + hu - stile / 2, 0, frameN), f.u, f.v, f.n, stile / 2, W.halfHeight, frameHw, P.frame);
    box(m, at(cu, W.halfHeight - rail / 2, frameN), f.u, f.v, f.n, hu - stile, rail / 2, frameHw, P.frame);
    box(m, at(cu, -W.halfHeight + rail / 2, frameN), f.u, f.v, f.n, hu - stile, rail / 2, frameHw, P.frame);
    const inner = 2 * (W.halfHeight - rail), pitch = inner / W.slatsPerLeaf;
    for (let s = 0; s < W.slatsPerLeaf; s++) {
      const y = -W.halfHeight + rail + pitch * (s + 0.5);
      box(m, at(cu, y, -0.01), f.u, sv, sw, hu - stile, pitch * 0.52, 0.004, P.slat);
    }
  }
  return m;
}

/** Icosahedron (20 flat triangles) around c, radii per axis. */
function ico(m: FlatMesh, c: V3, rx: number, ry: number, rz: number, uv: [number, number]): void {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw: V3[] = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  const vs: V3[] = [];
  for (let i = 0; i < raw.length; i++) { const q = norm(raw[i]); vs.push([c[0] + q[0] * rx, c[1] + q[1] * ry, c[2] + q[2] * rz]); }
  const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let i = 0; i < F.length; i++) tri(m, vs[F[i][0]], vs[F[i][1]], vs[F[i][2]], uv, c);
}

/** Thick leaf lobe: a flattened octahedron from base along dir, length L, width w, thickness th (8 triangles). */
function lobe(m: FlatMesh, base: V3, dir: V3, L: number, w: number, th: number, uv: [number, number]): void {
  const d = norm(dir), side = norm(cross(d, [0, 1, 0])), up = norm(cross(side, d));
  const tip = add(base, mul(d, L)), mid = add(base, mul(d, L * 0.45));
  const l = add(mid, mul(side, w / 2)), r = add(mid, mul(side, -w / 2)), t = add(mid, mul(up, th / 2)), b = add(mid, mul(up, -th / 2));
  const c = mid;
  tri(m, base, l, t, uv, c); tri(m, base, t, r, uv, c); tri(m, base, r, b, uv, c); tri(m, base, b, l, uv, c);
  tri(m, tip, t, l, uv, c); tri(m, tip, r, t, uv, c); tri(m, tip, b, r, uv, c); tri(m, tip, l, b, uv, c);
}

/** Leaf clump in env_rear_window_plant node space (origin = pot top centre). Fits the old card: x -0.10..0.08, y 0..0.23. */
export function buildRearPlant(): FlatMesh {
  const P = ROOM360_PALETTE, m = emptyMesh();
  ico(m, [0, 0.045, 0], 0.045, 0.04, 0.04, P.leafCore);
  const cols = [P.leafA, P.leafB, P.leafC, P.leafB, P.leafA, P.leafC];
  for (let i = 0; i < 6; i++) {
    const az = i * Math.PI / 3 + 0.3, el = (i % 2 === 0 ? 58 : 42) * Math.PI / 180;
    const dir: V3 = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
    lobe(m, [0, 0.03, 0], dir, i % 2 === 0 ? 0.19 : 0.14, 0.05, 0.016, cols[i]);
  }
  return m;
}

export function meshBounds(m: FlatMesh): { min: V3; max: V3 } {
  const min: V3 = [1e9, 1e9, 1e9], max: V3 = [-1e9, -1e9, -1e9];
  for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) {
    const x = m.positions[i + k]; if (x < min[k]) min[k] = x; if (x > max[k]) max[k] = x;
  }
  return { min, max };
}
