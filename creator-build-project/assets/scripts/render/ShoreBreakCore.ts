/**
 * Shore swell (engine-free). The authored env_sea_surface stays the only sea. Daytime blue is that mesh's
 * COLOR_0 (RGB floats about 0.37, 0.81, 0.90), not mainColor and not a second material. A dynamic copy
 * uploaded those floats as a new color stream and the device still shaded the sea black, so this module
 * does not rebuild the sea mesh. The whole sheet lifts by seaSheetLift — seaHeight at the door-facing
 * waterline — on the amb_waves_loop clock (8.064 s, crashes at 2.369 s and 6.300 s). The white lip uses
 * that same lift, so it sits on the surface instead of leading it. White water stays off while the crest
 * center is still offshore, then runs back down and disappears. Between the two beats the lip is gone.
 * Night is a mainColor multiply of that same lip (foamMultiply), not a second mesh or a second sea.
 * The sea material's mainColor is never written here. The beach lip draws with the exterior layer.
 * A faint far lip draws with the backdrop so the rear window sees the same beat. Nothing is emitted
 * inside the house footprint.
 * tools/scene-fx/test_shore_break.cjs
 */
export type V3 = [number, number, number];
export type ShoreGeometry = { positions: number[]; colors: number[]; indices: number[]; min: V3; max: V3 };
export type Swell = { strength: number; travel: number; foamU: number; foamA: number };
export type SeaPhase = { strength: number; travel: number };

export const SHORE = {
  /** amb_waves_loop.mp3 duration. Peaks sit at 0.294 and 0.781 of that loop. */
  loopS: 8.064,
  swells: [
    { hit: 2.369, attack: 1.15, release: 1.55 },
    { hit: 6.300, attack: 1.15, release: 1.55 },
  ],
  /**
   * White water stays off while the crest center is still this far offshore (metres).
   * Opening the lip at 82% of the attack put white water on the sand while the crest was still ~2.3 m out.
   */
  foamReach: 0.15,
  /** Half-width of the white lip in water→sand units. A line, not a sheet over open water. */
  washHalf: 0.08,
  shorePeak: 0.82,
  farPeak: 0.38,
  /** Authored env_sea_surface translation y. The sheet lift is added on top of this (mesh local y stays 0). */
  seaBaseY: -0.91854459,
  /** Door-facing beach waterline (lip deg 4). The rigid sheet and every lip water-edge share seaHeight here. */
  sheetX: 1.14,
  sheetZ: 16.36,
  foamLift: 0.03,
  /** How far offshore (metres past the shoreline) the crest sits at the start of an attack. */
  fetch: 13,
  /** Short ripple near the island, metres. The long heave is one slow swell across the whole sea. */
  ripple: 0.036,
  heave: 0.055,
  crest: 0.16,
  waveLen: 7.6,
  /** Long enough that a 13 m fetch does not turn the heave into a fake crest. */
  heaveLen: 180,
  crestSigma: 2.6,
  /** Short waves fade out between these radii so the coarse far mesh does not alias. */
  seaNear: 26,
  seaFar: 72,
  /** UV units. 1 unit = 8 m on env_sea_surface. Oscillates on the loop; does not replace the mesh. */
  uvDrift: 0.16,
  /** Sand higher than this is cliff, not a beach the wash can climb. */
  sandCap: 0.32,
  sandLift: 0.05,
  /** Break the ribbon here so a skipped cliff sample is not bridged. 8° table; one skip is 16°. */
  gapDeg: 12,
  house: { minX: -2.9, maxX: 5.1, minZ: -5.45, maxZ: 1.35 },
  /** Same linear multiply as env_sea_foam / the v22 foam lines in bindUnlitBackdrop. */
  night: [0.35, 0.48, 0.64] as V3,
  /** Warm flat white. Night darkens it by mainColor, the vertex colour does not change. */
  foamRgb: [0.96, 0.98, 0.99] as V3,
  /** Horizon lip in the rear-window sliver (deg 151–169, r 48 and 58 are the visible hits). */
  farDeg: [151, 157, 163, 169],
  farR: [44, 48, 53, 58, 64],
  farA: [0, 1, 1, 1, 0],
  /** Authored wave-line rings stay under the opaque sea. The lip above is the only white water. */
  sinkY: -1.24,
  /**
   * Baked waterline → sand samples from combined_visual_m.glb (deg = atan2(x,z) degrees).
   * [deg, waterX, waterZ, sandX, sandZ, sandY]. Gaps are cliffs / no lip, not a full ring.
   */
  lip: [
    [-180, 0, -9, 0, -6.7, 0.203],
    [-172, -1.25, -8.91, -0.93, -6.63, 0.242],
    [-164, -2.32, -8.07, -1.68, -5.86, 0.15],
    [-132, -5.05, -4.55, -3.34, -3.01, 0.207],
    [-124, -5.8, -3.91, -3.9, -2.63, 0.331],
    [-116, -6.29, -3.07, -4.22, -2.06, 0.285],
    [-108, -6.47, -2.1, -4.28, -1.39, 0.237],
    [-100, -6.7, -1.18, -4.43, -0.78, 0.18],
    [-92, -6.6, -0.23, -4.3, -0.15, 0.162],
    [-84, -6.76, 0.71, -4.48, 0.47, 0.152],
    [-76, -6.79, 1.69, -4.56, 1.14, 0.137],
    [-68, -6.68, 2.7, -4.54, 1.84, 0.118],
    [-60, -6.41, 3.7, -4.42, 2.55, 0.114],
    [-52, -6.15, 4.8, -4.33, 3.39, 0.134],
    [-44, -5.97, 6.19, -4.38, 4.53, 0.124],
    [-36, -5.41, 7.44, -4.06, 5.58, 0.147],
    [-28, -4.51, 8.48, -3.43, 6.45, 0.147],
    [-20, -3.28, 9.02, -2.5, 6.86, 0.134],
    [-12, -2.16, 10.17, -1.68, 7.92, 0.102],
    [-4, -1.1, 15.76, -0.52, 7.43, 0.05],
    [4, 1.14, 16.36, 0.56, 8.03, 0.05],
    [12, 3.41, 16.04, 1.67, 7.87, 0.05],
    [20, 5.68, 15.6, 2.82, 7.75, 0.067],
    [28, 7.98, 15.01, 4.06, 7.64, 0.15],
    [36, 10.11, 13.92, 5.2, 7.16, 0.179],
    [44, 11.67, 12.08, 5.87, 6.08, 0.197],
    [52, 13.08, 10.22, 6.5, 5.08, 0.158],
    [60, 14.03, 8.1, 6.8, 3.93, 0.075],
    [68, 14.83, 5.99, 7.09, 2.87, 0.067],
    [76, 15.14, 3.77, 7.03, 1.75, 0.341],
    [84, 10.14, 1.07, 7.86, 0.83, 0.35],
    [92, 9.79, -0.34, 7.5, -0.26, 0.309],
    [100, 9.65, -1.7, 7.39, -1.3, 0.263],
    [148, 4.77, -7.63, 3.55, -5.68, 0.207],
    [156, 3.66, -8.22, 2.73, -6.12, 0.174],
    [164, 2.48, -8.65, 1.85, -6.44, 0.185],
    [172, 1.25, -8.91, 0.93, -6.63, 0.183],
  ] as number[][],
};

const TAU = 6.283185307179586;
const RAD2DEG = 57.29577951308232;
let shoreLut: number[] | null = null;

export const clamp01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t);
}
function hash01(i: number): number { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

export function wrapLoop(t: number): number {
  const loop = SHORE.loopS;
  if (!isFinite(t)) return 0;
  let x = t % loop; if (x < 0) x += loop; return x;
}
/** Playhead wins while the wave source is playing; otherwise the window clock keeps moving. dt clamped to 0.1 s. */
export function stepShoreClock(clock: number, dt: number, playhead: number | null): number {
  if (playhead !== null && typeof playhead === 'number' && isFinite(playhead)) return wrapLoop(playhead);
  const step = isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;
  return wrapLoop((isFinite(clock) ? clock : 0) + step);
}
/** Foam follows how close the crest center is to the waterline, not how far the attack has progressed. */
function foamClimb(travel: number): { foamU: number; foamA: number } {
  const reach = SHORE.foamReach;
  const off = (1 - clamp01(travel)) * SHORE.fetch;
  if (!(reach > 0) || off >= reach) return { foamU: 0, foamA: 0 };
  const k = 1 - off / reach;
  const e = k * k * (3 - 2 * k);
  return { foamU: e, foamA: e };
}
export function swellState(time: number, hit: number, attack: number, release: number): Swell {
  const t = wrapLoop(time);
  let dt = t - hit;
  if (dt > SHORE.loopS * 0.5) dt -= SHORE.loopS;
  if (dt < -SHORE.loopS * 0.5) dt += SHORE.loopS;
  if (dt >= -attack && dt <= 0) {
    const s = smoothstep(0, 1, (dt + attack) / attack);
    const foam = foamClimb(s);
    return { strength: s, travel: s, foamU: foam.foamU, foamA: foam.foamA };
  }
  if (dt > 0 && dt <= release) {
    const s = 1 - smoothstep(0, 1, dt / release);
    return { strength: s, travel: 1, foamU: s, foamA: s };
  }
  return { strength: 0, travel: 0, foamU: 0, foamA: 0 };
}
/** line01 follows the first swell, line02 the second. The lip uses whichever is stronger (they do not overlap). */
export function shorePhase(time: number): { strength: number; travel: number; foamU: number; foamA: number; line01: Swell; line02: Swell } {
  const a = SHORE.swells[0], b = SHORE.swells[1];
  const line01 = swellState(time, a.hit, a.attack, a.release);
  const line02 = swellState(time, b.hit, b.attack, b.release);
  const pick = line01.strength >= line02.strength ? line01 : line02;
  return { strength: pick.strength, travel: pick.travel, foamU: pick.foamU, foamA: pick.foamA, line01: line01, line02: line02 };
}
export function foamMultiply(night: number): V3 {
  const k = clamp01(night), n = SHORE.night;
  return [1 + (n[0] - 1) * k, 1 + (n[1] - 1) * k, 1 + (n[2] - 1) * k];
}
/** Flat authored rings stay under the sea for the whole loop. scale 1 keeps the imported size. */
export function waveLinePose(): { y: number; scale: number } {
  return { y: SHORE.sinkY, scale: 1 };
}
/** Exterior owns the beach lip. Backdrop owns the far horizon, including the rear window. */
export function washVisible(exterior: boolean, backdrop: boolean, foamA: number): { shore: boolean; far: boolean } {
  const on = foamA > 1 / 255;
  return { shore: !!exterior && on, far: !!backdrop && on };
}
export function farWashAlpha(foamA: number): number {
  return (foamA > 0 ? foamA : 0) * SHORE.farPeak;
}
/** Oscillating UV shift, one cycle per loop in u and two in v (the two crashes). Metres = shift * 8. */
export function seaUvShift(time: number): { u: number; v: number } {
  const w = wrapLoop(time) / SHORE.loopS * TAU;
  return { u: Math.sin(w) * SHORE.uvDrift, v: Math.sin(w * 2) * SHORE.uvDrift * 0.7 };
}
/**
 * COLOR_0 → RGBA floats. env_sea_surface stores the daytime blue as RGB (3 floats). builtin-standard
 * multiplies albedo by a_color; a missing color attribute is (0,0,0,1), so a rebuilt sea draws black.
 * RGB gets alpha 1 (the glTF w default). Byte colors (BYTES_PER_ELEMENT 1) are scaled from 0..255.
 * The sea is not rebuilt: uploading this stream still left the device sea black, so the authored mesh
 * keeps its own COLOR_0. Returns null when the stream is too short to be the blue.
 */
export function seaAlbedoColors(src: ArrayLike<number> | null, count: number, bytesPerElement: number): Float32Array | null {
  if (!src || !(count > 0) || src.length < count * 3) return null;
  const comps = src.length >= count * 4 ? 4 : 3;
  const scale = bytesPerElement === 1 ? 1 / 255 : 1;
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const s = i * comps, d = i * 4;
    out[d] = src[s] * scale;
    out[d + 1] = src[s + 1] * scale;
    out[d + 2] = src[s + 2] * scale;
    out[d + 3] = comps === 4 ? src[s + 3] * scale : 1;
  }
  return out;
}

function shoreRadiusRaw(deg: number): number {
  const lip = SHORE.lip, n = lip.length;
  let d = deg;
  while (d < -180) d += 360;
  while (d > 180) d -= 360;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a0 = lip[i][0], a1 = lip[j][0];
    const span = j === 0 ? (a1 + 360) - a0 : a1 - a0;
    let rel = d - a0; if (rel < 0) rel += 360;
    if (rel <= span + 1e-4) {
      const t = span < 1e-6 ? 0 : rel / span;
      const r0 = Math.sqrt(lip[i][1] * lip[i][1] + lip[i][2] * lip[i][2]);
      const r1 = Math.sqrt(lip[j][1] * lip[j][1] + lip[j][2] * lip[j][2]);
      return r0 + (r1 - r0) * t;
    }
  }
  return 9;
}
/** Shoreline radius (metres) at this xz, from the baked lip. 0.5° table. */
export function shoreRadius(x: number, z: number): number {
  if (!shoreLut) {
    shoreLut = new Array(720);
    for (let i = 0; i < 720; i++) shoreLut[i] = shoreRadiusRaw(i / 2 - 180);
  }
  let i = Math.round((Math.atan2(x, z) * RAD2DEG + 180) * 2);
  i = i % 720; if (i < 0) i += 720;
  return shoreLut[i];
}
/**
 * Mesh-local Y offset of the swell at one xz. Crest of each swell lands on the shoreline
 * (travel 1, crestOff 0) at that swell's hit; between beats only the small heave/ripple remain.
 * Pass phase from shorePhase when sampling many points. The visible sea does not rewrite vertices
 * (that replacement shaded black); seaSheetLift samples this at the waterline and moves the node.
 */
export function seaHeight(x: number, z: number, time: number, phase?: SeaPhase): number {
  const S = SHORE;
  const ph = phase ? phase : shorePhase(time);
  const r = Math.sqrt(x * x + z * z);
  const off = r - shoreRadius(x, z);
  const far = smoothstep(S.seaNear, S.seaFar, r);
  // Along-shore phase, not a ring: a ring of chop can sit higher than the crest that is still offshore.
  const ripple = Math.sin(off * (TAU / S.waveLen) + Math.atan2(x, z) * 2.5 + time * (TAU * 2 / S.loopS));
  const heave = Math.sin(r * (TAU / S.heaveLen) + time * (TAU / S.loopS));
  const crestOff = (1 - clamp01(ph.travel)) * S.fetch;
  const d = off - crestOff;
  const crest = Math.exp(-(d * d) / (S.crestSigma * S.crestSigma));
  return (1 - far) * (S.ripple * ripple + S.crest * ph.strength * crest) + S.heave * heave;
}
/** One height for the whole sheet, the lip, and the far wash. Peaks when the crest is on this waterline. */
export function seaSheetLift(time: number, phase?: SeaPhase): number {
  return seaHeight(SHORE.sheetX, SHORE.sheetZ, time, phase);
}

function inHouse(x: number, z: number): boolean {
  const h = SHORE.house; return x >= h.minX && x <= h.maxX && z >= h.minZ && z <= h.maxZ;
}
function lipPoint(seg: number[], u: number, time: number, phase: SeaPhase): V3 {
  const y0 = SHORE.seaBaseY + seaSheetLift(time, phase) + SHORE.foamLift;
  const y1 = seg[5] + SHORE.sandLift;
  return [seg[1] + (seg[3] - seg[1]) * u, y0 + (y1 - y0) * u, seg[2] + (seg[4] - seg[2]) * u];
}
function rotXZ(p: V3, deg: number): V3 {
  if (Math.abs(deg) < 1e-6) return p;
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}
export function keptShoreLips(): number[][] {
  const out: number[][] = [], lip = SHORE.lip;
  for (let i = 0; i < lip.length; i++) {
    const s = lip[i];
    if (s[5] > SHORE.sandCap) continue;
    if (inHouse(s[1], s[2]) || inHouse(s[3], s[4])) continue;
    out.push(s);
  }
  return out;
}
export function ribbons(segs: number[][]): number[][][] {
  const sorted: number[][] = [], n0 = segs.length;
  for (let i = 0; i < n0; i++) sorted.push(segs[i]);
  sorted.sort(function (a, b) { return a[0] - b[0]; });
  const n = sorted.length; if (!n) return [];
  const gap = SHORE.gapDeg;
  const forward = function (i: number) {
    const a = sorted[i][0], b = sorted[(i + 1) % n][0];
    return i + 1 < n ? b - a : (b + 360) - a;
  };
  let start = 0;
  for (let i = 0; i < n; i++) if (forward(i) > gap) { start = (i + 1) % n; break; }
  const groups: number[][][] = []; let cur: number[][] = [sorted[start]];
  for (let k = 1; k < n; k++) {
    const i = (start + k - 1) % n, j = (start + k) % n;
    if (forward(i) > gap) { groups.push(cur); cur = [sorted[j]]; } else cur.push(sorted[j]);
  }
  groups.push(cur); return groups;
}
function boundsOf(positions: number[]): { min: V3; max: V3 } {
  const min: V3 = [1e9, 1e9, 1e9], max: V3 = [-1e9, -1e9, -1e9];
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) {
    const v = positions[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v;
  }
  if (!positions.length) return { min: [0, 0, 0], max: [0, 0, 0] };
  return { min: min, max: max };
}
function pushTri(indices: number[], positions: number[], a: number, b: number, c: number): void {
  const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
  const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
  const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];
  const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
  if (ny >= 0) indices.push(a, b, c); else indices.push(a, c, b);
}
function acrossAlpha(uu: number, center: number, u0: number, u1: number): number {
  const left = uu <= center, span = left ? center - u0 : u1 - center;
  if (span < 1e-5) return left ? 1 : 0;
  const d = Math.abs(uu - center) / span;
  const t = d <= 0.2 ? 0 : d >= 1 ? 1 : (d - 0.2) / 0.8, s = t * t * (3 - 2 * t);
  return 1 - s;
}
function alongAlpha(i: number, n: number): number {
  if (n <= 1) return 1;
  const e = Math.min(i, n - 1 - i);
  const t = e >= 1 ? 1 : e;
  const s = t * t * (3 - 2 * t);
  return 0.15 + 0.85 * s;
}
function emptyGeo(): ShoreGeometry { return { positions: [], colors: [], indices: [], min: [0, 0, 0], max: [0, 0, 0] }; }

function appendStrip(positions: number[], colors: number[], indices: number[], columns: { seg: number[]; spin: number }[], rows: number[], center: number, u0: number, u1: number, time: number, phase: SeaPhase): void {
  const n = columns.length, R = rows.length; if (n < 2 || R < 2) return;
  const base = positions.length / 3, rgb = SHORE.foamRgb;
  for (let i = 0; i < n; i++) {
    const along = alongAlpha(i, n);
    for (let r = 0; r < R; r++) {
      const u = rows[r];
      const p = rotXZ(lipPoint(columns[i].seg, u, time, phase), columns[i].spin);
      const house = inHouse(p[0], p[2]) ? 0 : 1;
      const lump = 0.9 + 0.1 * hash01(i * 17 + r * 3);
      const a = acrossAlpha(u, center, u0, u1) * along * house * lump;
      positions.push(p[0], p[1], p[2]); colors.push(rgb[0], rgb[1], rgb[2], clamp01(a));
    }
  }
  for (let i = 0; i < n - 1; i++) for (let r = 0; r < R - 1; r++) {
    const a = base + i * R + r, b = a + 1, c = a + R, d = c + 1;
    pushTri(indices, positions, a, c, b); pushTri(indices, positions, b, c, d);
  }
}
/** A lone sample (one beach point between cliffs) is not fanned into a patch. That fan was the white water on the rocks. */
function columnsOf(ribbon: number[][]): { seg: number[]; spin: number }[] {
  const out: { seg: number[]; spin: number }[] = [];
  if (ribbon.length < 2) return out;
  for (let i = 0; i < ribbon.length; i++) out.push({ seg: ribbon[i], spin: 0 });
  return out;
}
/**
 * Thin lip at water→sand coordinate u (0 = waterline, 1 = up the sand). The water edge is seaBaseY +
 * seaSheetLift, the same height the sea node uses, so the white sits on the sheet. Vertex alpha is the
 * soft edge; the wrapper multiplies mainColor.a by foamA and hides the node when foamA is 0.
 */
export function shoreWashGeometry(u: number, time: number): ShoreGeometry {
  const uu = clamp01(u);
  let u0 = uu - SHORE.washHalf, u1 = uu + SHORE.washHalf;
  if (u0 < 0) u0 = 0; if (u1 > 1) u1 = 1;
  const mid = (u0 + u1) * 0.5;
  const rows = [u0, mid, u1];
  const phase = shorePhase(time);
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const groups = ribbons(keptShoreLips());
  for (let g = 0; g < groups.length; g++) appendStrip(positions, colors, indices, columnsOf(groups[g]), rows, mid, u0, u1, time, phase);
  const b = boundsOf(positions);
  return { positions: positions, colors: colors, indices: indices, min: b.min, max: b.max };
}
function polar(deg: number, r: number, y: number): V3 {
  const a = deg * Math.PI / 180; return [Math.sin(a) * r, y, Math.cos(a) * r];
}
/** Faint horizon lip at rest sea height. The wrapper lifts the node by seaSheetLift and fades it with the beach beat. */
export function farShoreGeometry(): ShoreGeometry {
  const degs = SHORE.farDeg, rs = SHORE.farR, fa = SHORE.farA, rgb = SHORE.foamRgb;
  const y = SHORE.seaBaseY + SHORE.foamLift;
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const n = degs.length, R = rs.length; if (n < 2 || R < 2) return emptyGeo();
  for (let i = 0; i < n; i++) {
    const along = alongAlpha(i, n);
    for (let r = 0; r < R; r++) {
      const p = polar(degs[i], rs[r], y);
      positions.push(p[0], p[1], p[2]); colors.push(rgb[0], rgb[1], rgb[2], clamp01(fa[r] * along));
    }
  }
  for (let i = 0; i < n - 1; i++) for (let r = 0; r < R - 1; r++) {
    const a = i * R + r, b = a + 1, c = a + R, d = c + 1;
    pushTri(indices, positions, a, c, b); pushTri(indices, positions, b, c, d);
  }
  const b = boundsOf(positions);
  return { positions: positions, colors: colors, indices: indices, min: b.min, max: b.max };
}
/** Sample point the far lip lifts with, so the rear window's white sits on that sea. */
export function farSeaPoint(): V3 {
  const deg = 160, r = 53, a = deg * Math.PI / 180;
  return [Math.sin(a) * r, SHORE.seaBaseY, Math.cos(a) * r];
}
