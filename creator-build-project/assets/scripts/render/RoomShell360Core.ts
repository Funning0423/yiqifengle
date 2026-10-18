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
 * - Option B for the same window (ROOM360_RIGHT_WINDOW = 'open'): no shutter; the lighthouse wall facet that closes the
 *   window from outside is cut away along the real arched opening of the shell (cutWallOpening, exact convex-polygon
 *   subtraction with interpolated normals/UVs), and a wooden trim + sill (buildWindowTrim) lines the cut on the outside.
 *   The glass and mullions stay, so it reads as a clear glazed window with whatever is really outside behind it.
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
/** Right-front window variant: 'shutter' = A (closed louvred shutter), 'open' = B (wall cut open, real view). */
export type Room360WindowMode = 'shutter' | 'open';
export const ROOM360_RIGHT_WINDOW: Room360WindowMode = 'open';

/** The shell's arched opening for that window, measured from env_interior_shell's jamb (window-local: t along
 *  windowFrame().u from its centre, absolute y). Convex, counter-clockwise in (t, y). */
export const ROOM360_OPENING: ReadonlyArray<[number, number]> = Object.freeze([
  [-0.397, 1.816], [0.394, 1.816], [0.394, 2.607], [0.381, 2.709], [0.341, 2.805], [0.278, 2.887], [0.196, 2.95],
  [0.101, 2.99], [-0.002, 3.003], [-0.104, 2.99], [-0.2, 2.95], [-0.282, 2.887], [-0.344, 2.805], [-0.384, 2.709],
  [-0.397, 2.607],
] as [number, number][]);
/** The outer wall facet over the opening lies at n 0.014..0.057; the cut only touches wall-facing triangles there. */
export const ROOM360_CUT = Object.freeze({ nMin: -0.02, nMax: 0.12, minFacing: 0.5, trimW: 0.05, trimN0: -0.004, trimN1: 0.085 });

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

type CutVert = { p: V3; nr: V3; uv: [number, number]; t: number; y: number };

function lerpV(a: CutVert, b: CutVert, k: number): CutVert {
  return {
    p: [a.p[0] + (b.p[0] - a.p[0]) * k, a.p[1] + (b.p[1] - a.p[1]) * k, a.p[2] + (b.p[2] - a.p[2]) * k],
    nr: [a.nr[0] + (b.nr[0] - a.nr[0]) * k, a.nr[1] + (b.nr[1] - a.nr[1]) * k, a.nr[2] + (b.nr[2] - a.nr[2]) * k],
    uv: [a.uv[0] + (b.uv[0] - a.uv[0]) * k, a.uv[1] + (b.uv[1] - a.uv[1]) * k],
    t: a.t + (b.t - a.t) * k, y: a.y + (b.y - a.y) * k,
  };
}

/** Sutherland-Hodgman against one half-plane: keep side(v) >= 0 (keepPositive) or <= 0. */
function clipHalf(poly: CutVert[], side: (v: CutVert) => number, keepPositive: boolean): CutVert[] {
  const out: CutVert[] = [], sg = keepPositive ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = sg * side(a), db = sg * side(b);
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) out.push(lerpV(a, b, da / (da - db)));
  }
  return out;
}

/** Remove the convex opening ROOM360_OPENING from the wall-facing triangles of `src` (room-model coordinates).
 *  Untouched triangles keep their vertices; cut ones are re-emitted as exact pieces (tri minus polygon = one convex
 *  piece per polygon edge), so the hole edge follows the shell's arch exactly. */
export function cutWallOpening(src: FlatMesh): { mesh: FlatMesh; touched: number; removedArea: number } {
  const f = windowFrame(), K = ROOM360_OPENING, C = ROOM360_CUT;
  const out: FlatMesh = { positions: src.positions.slice(), normals: src.normals.slice(), uvs: src.uvs.slice(), indices: [] };
  let tMin = 1e9, tMax = -1e9, yMin = 1e9, yMax = -1e9;
  for (let i = 0; i < K.length; i++) { tMin = Math.min(tMin, K[i][0]); tMax = Math.max(tMax, K[i][0]); yMin = Math.min(yMin, K[i][1]); yMax = Math.max(yMax, K[i][1]); }
  const vert = (i: number): CutVert => {
    const p: V3 = [src.positions[i * 3], src.positions[i * 3 + 1], src.positions[i * 3 + 2]], d = sub(p, f.c);
    return { p, nr: [src.normals[i * 3], src.normals[i * 3 + 1], src.normals[i * 3 + 2]], uv: [src.uvs[i * 2], src.uvs[i * 2 + 1]],
      t: d[0] * f.u[0] + d[1] * f.u[1] + d[2] * f.u[2], y: p[1] };
  };
  const nOf = (v: CutVert): number => { const d = sub(v.p, f.c); return d[0] * f.n[0] + d[1] * f.n[1] + d[2] * f.n[2]; };
  const edgeSide = (k: number) => (v: CutVert): number => {
    const a = K[k], b = K[(k + 1) % K.length];
    return (b[0] - a[0]) * (v.y - a[1]) - (b[1] - a[1]) * (v.t - a[0]);  // > 0 = inside (left of a CCW edge)
  };
  const area2 = (q: CutVert[]): number => { let s = 0; for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; s += a.t * b.y - b.t * a.y; } return Math.abs(s) / 2; };
  let touched = 0, removed = 0;
  for (let i = 0; i < src.indices.length; i += 3) {
    const ia = src.indices[i], ib = src.indices[i + 1], ic = src.indices[i + 2];
    const tri3 = [vert(ia), vert(ib), vert(ic)];
    const fn = norm(cross(sub(tri3[1].p, tri3[0].p), sub(tri3[2].p, tri3[0].p)));
    const facing = Math.abs(fn[0] * f.n[0] + fn[1] * f.n[1] + fn[2] * f.n[2]);
    let lo = 1e9, hi = -1e9, t0 = 1e9, t1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let k = 0; k < 3; k++) { const n = nOf(tri3[k]); lo = Math.min(lo, n); hi = Math.max(hi, n); t0 = Math.min(t0, tri3[k].t); t1 = Math.max(t1, tri3[k].t); y0 = Math.min(y0, tri3[k].y); y1 = Math.max(y1, tri3[k].y); }
    const overlaps = facing >= C.minFacing && hi >= C.nMin && lo <= C.nMax && t1 > tMin && t0 < tMax && y1 > yMin && y0 < yMax;
    if (!overlaps) { out.indices.push(ia, ib, ic); continue; }
    touched++;
    let inside: CutVert[] = tri3;
    const before = area2(tri3);
    let kept = 0;
    for (let k = 0; k < K.length && inside.length >= 3; k++) {
      const piece = clipHalf(inside, edgeSide(k), false);  // outside edge k, inside all previous edges
      if (piece.length >= 3) {
        kept += area2(piece);
        const base = out.positions.length / 3;
        for (let q = 0; q < piece.length; q++) {
          const v = piece[q], nl = norm(v.nr);
          out.positions.push(v.p[0], v.p[1], v.p[2]); out.normals.push(nl[0], nl[1], nl[2]); out.uvs.push(v.uv[0], v.uv[1]);
        }
        for (let q = 1; q + 1 < piece.length; q++) out.indices.push(base, base + q, base + q + 1);
      }
      inside = clipHalf(inside, edgeSide(k), true);
    }
    removed += before - kept;
  }
  return { mesh: out, touched, removedArea: removed };
}

/** Wooden trim around the cut on the outside face (and a deeper sill), boxes along every opening edge. */
export function buildWindowTrim(): FlatMesh {
  const f = windowFrame(), K = ROOM360_OPENING, C = ROOM360_CUT, P = ROOM360_PALETTE, m = emptyMesh();
  const nMid = (C.trimN0 + C.trimN1) / 2, hn = (C.trimN1 - C.trimN0) / 2;
  const at = (t: number, y: number, n: number): V3 => [f.c[0] + f.u[0] * t + f.n[0] * n, y + f.n[1] * n, f.c[2] + f.u[2] * t + f.n[2] * n];
  for (let k = 0; k < K.length; k++) {
    const a = K[k], b = K[(k + 1) % K.length], dt = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dt * dt + dy * dy);
    const et = dt / L, ey = dy / L, ot = ey, oy = -et;  // outward (right of a CCW edge)
    const sill = k === 0, w = sill ? C.trimW * 1.4 : C.trimW, ext = sill ? 0.06 : w * 0.6;
    const ct = (a[0] + b[0]) / 2 + ot * w / 2, cy = (a[1] + b[1]) / 2 + oy * w / 2;
    const u = norm([f.u[0] * et, ey, f.u[2] * et]), v = norm([f.u[0] * ot, oy, f.u[2] * ot]);
    box(m, at(ct, cy, sill ? nMid + 0.02 : nMid), u, v, f.n, L / 2 + ext, w / 2, sill ? hn + 0.02 : hn, P.frame);
  }
  return m;
}
