/**
 * Shore wash (engine-free; 场景特效bot r5 S3, after the ACNH shoreline breakdown). ONE dedicated ribbon along the waterline,
 * drawn by resources/world/shore-foam.effect (no depth texture, no new texture):
 *  - rolling wave lines in the shallows (v 0..0.5), moving shoreward,
 *  - a white foam lip that runs up the sand and slides back (swash front),
 *  - a darker wet-sand band behind it that follows the lip and dries more slowly.
 * Ribbon UV: u = metres along the shore, v = 0 offshore .. 0.5 waterline .. 1 up the sand. COLOR_0: r = share of the sea lift the
 * vertex takes (island water edge rides the heaving sea, the sand edge stays), a = end / house fade.
 * Island: driven by ShoreBreak's clock (amb_waves_loop playhead); the swash starts on each hit (islandFront), night = foamMultiply.
 * Lakeside: the effect's USE_CC_TIME branch (no script tick), lit by the scene lights (USE_LIT); the ribbon is LK_shore_foam.glb
 * (tools/scene-fx/lakeside_shore_ribbon.cjs). sampleShoreFoam() mirrors the fragment shader for tests and previews.
 * Loose ES5: no spread of iterables, no Array.from / Object.entries / padStart.
 * tools/scene-fx/test_shore_foam.cjs
 */
import { SHORE, clamp01, smoothstep, keptShoreLips, ribbons, foamMultiply } from './ShoreBreakCore';
import type { V3 } from './ShoreBreakCore';

export type ShoreFoamParams = {
  foamColor: number[]; wetColor: number[]; bandParams: number[]; lineParams: number[]; cycle: number[]; tint: number[]; lightParams: number[];
};
export type ShoreRibbon = { positions: number[]; uvs: number[]; colors: number[]; indices: number[]; min: V3; max: V3; length: number };
export type Swash = { front: number; foamA: number; wet: number; t: number };

const TAU = 6.283185307179586;
/** Across-shore rows (v). The shader draws the lip / lines / wet band from v per pixel, so rows only have to follow the ground:
 *  the island beach is the lip table's straight water -> sand line (3 rows are exact); the lake bank follows the terrain. */
export const FOAM_ROWS = [0, 0.5, 0.625, 0.75, 0.875, 1];   // island: v 0.5..1 rows sit on the baked beach heights h1..h4
export const LAKE_FOAM_ROWS = [0, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

export const ISLAND_FOAM: ShoreFoamParams = {
  foamColor: [0.96, 0.98, 0.99, 0.82],                 // SHORE.foamRgb, peak alpha = SHORE.shorePeak
  wetColor: [0.05, 0.04, 0.025, 0.26],                  // near-black: the wet band only darkens the sand (dst x (1 - a)), unlit foam can't lift it at night
  bandParams: [0.5, 0.42, 0.075, 0.06],                // waterline, swash reach (v), lip width, wet edge softness
  lineParams: [5, 2 / SHORE.loopS, 0.55, 0.32],        // 5 lines / unit v (1.2 m apart over 3 m), 2 whole lines per loop: no jump at the wrap
  cycle: [SHORE.loopS, 0.32, 0.14, 0],
  tint: [1, 1, 1, 1],
  lightParams: [0, 0, 16, 40],
};
export const LAKE_FOAM: ShoreFoamParams = {
  foamColor: [0.93, 0.95, 0.96, 0.5],                  // a lake: softer, thinner lip than the sea (0.62 read as a pale kerb close up)
  wetColor: [0.07, 0.075, 0.03, 0.3],                  // lakeside shore is grass: wet = darker olive, not grey sand
  bandParams: [0.5, 0.1, 0.04, 0.05],                  // a lake laps ~0.4 m up the bank (v 0.5 = 2.0 m inland); lip ~0.16 m
  lineParams: [4, 0.2, 0.42, 0.22],
  cycle: [7, 0.32, 0.16, 0],                            // 7 s swash, run-up in the first 32 %, wet trails 16 % behind
  tint: [1, 1, 1, 1],
  lightParams: [2.51, 2.87, 18, 46],                    // day: LAKESIDE_DIR_LIGHT_PARAMS water scales (night: lakesideShoreLight)
};
/** Island ribbon reach offshore (m, along water - sand) and the lift applied on the water edge. */
export const ISLAND_RIBBON = { offshore: 3.0, inland: 2.3, lift: SHORE.foamLift, sandOffset: 0.04 };   // inland: max metres up an open beach from the real waterline
/**
 * Where the island ground really meets the sea on each SHORE.lip line, baked from combined_visual_m.glb (sha 77bff8b3, pinned in
 * FirstsliceFacts) by tools/scene-fx/blender_island_waterline.py: [deg, k, clear, h1, h2, h3, h4] - k = fraction water -> sand point
 * at the first ground above the sea; clear = metres of open beach up from there before a rock (0 = the waterline is the rock ring);
 * h1..h4 = ground height at 1/4 .. 4/4 of min(clear, inland) (NaN = rock). The beach is concave, so the inland rows follow h, not a line. The lip table's water points sit up to 5.7 m offshore on the front beach (a ribbon hung on them
 * floats on open sea), and most of the island is a rock ring with a near-vertical bank: there the swash must not climb.
 */
export const ISLAND_WATERLINE: number[][] = [[-180, 0.165, 0.0, NaN, NaN, NaN, NaN], [-172, 0.385, 0.0, NaN, NaN, NaN, NaN], [-164, 0.115, 0.0, NaN, NaN, NaN, NaN], [-132, 0.115, 0.0, NaN, NaN, NaN, NaN], [-124, 0.53, 0.0, NaN, NaN, NaN, NaN], [-116, 0.27, 0.0, NaN, NaN, NaN, NaN], [-108, 0.315, 0.0, NaN, NaN, NaN, NaN], [-100, 0.285, 0.0, NaN, NaN, NaN, NaN], [-92, 0.265, 0.0, NaN, NaN, NaN, NaN], [-84, 0.155, 0.0, NaN, NaN, NaN, NaN], [-76, 0.0, 0.0, NaN, NaN, NaN, NaN], [-68, 0.0, 0.0, NaN, NaN, NaN, NaN], [-60, 0.1, 0.0, NaN, NaN, NaN, NaN], [-52, 0.155, 0.0, NaN, NaN, NaN, NaN], [-44, 0.075, 0.0, NaN, NaN, NaN, NaN], [-36, 0.2, 0.0, NaN, NaN, NaN, NaN], [-28, 0.56, 0.0, NaN, NaN, NaN, NaN], [-20, 0.235, 0.0, NaN, NaN, NaN, NaN], [-12, 0.04, 0.0, NaN, NaN, NaN, NaN], [-4, 0.69, 2.3, -0.554, -0.193, 0.03, 0.001], [4, 0.695, 2.3, -0.603, -0.319, -0.07, 0.014], [12, 0.53, 0.0, NaN, NaN, NaN, NaN], [20, 0.705, 2.3, -0.541, -0.268, -0.073, 0.011], [28, 0.65, 0.9, -0.797, -0.7, -0.599, -0.509], [36, 0.65, 2.3, -0.659, -0.385, -0.155, 0.031], [44, 0.665, 2.1, -0.617, -0.33, -0.083, 0.144], [52, 0.705, 0.8, -0.732, -0.58, -0.411, -0.24], [60, 0.305, 0.0, NaN, NaN, NaN, NaN], [68, 0.66, 0.0, NaN, NaN, NaN, NaN], [76, 0.665, 0.0, NaN, NaN, NaN, NaN], [84, 0.22, 0.0, NaN, NaN, NaN, NaN], [92, 0.45, 0.0, NaN, NaN, NaN, NaN], [100, 0.43, 0.0, NaN, NaN, NaN, NaN], [148, 0.69, 0.0, NaN, NaN, NaN, NaN], [156, 0.74, 0.0, NaN, NaN, NaN, NaN], [164, 0.395, 0.0, NaN, NaN, NaN, NaN], [172, 0.34, 0.0, NaN, NaN, NaN, NaN]];
/** Rocky lines (clear < ISLAND_ROCK.minClear): the inland edge stops ISLAND_ROCK.inland m past the waterline, flat, and fades out;
 *  the waterline row keeps ISLAND_ROCK.edgeA of the alpha (a soft wash at the rock foot, no wet band / lip on the stone). */
export const ISLAND_ROCK = { minClear: 0.3, inland: 0.15, edgeA: 0.5 };
function isBeach(segs: number[][], j: number): boolean { return j >= 0 && j < segs.length && waterlineOf(segs[j][0])[2] >= ISLAND_ROCK.minClear; }
function waterlineOf(deg: number): number[] {
  for (let i = 0; i < ISLAND_WATERLINE.length; i++) if (ISLAND_WATERLINE[i][0] === deg) return ISLAND_WATERLINE[i];
  return [deg, 0, 0, NaN, NaN, NaN, NaN];
}

function houseFade(x: number, z: number): number {
  const h = SHORE.house, m = 0.6;
  const dx = Math.max(h.minX - x, 0, x - h.maxX), dz = Math.max(h.minZ - z, 0, z - h.maxZ);
  return smoothstep(0, m, Math.max(dx, dz));
}
function endFade(i: number, n: number): number { if (n <= 2) return 1; const e = Math.min(i, n - 1 - i); return 0.2 + 0.8 * smoothstep(0, 1.5, e); }
function bounds(P: number[]): { min: V3; max: V3 } {
  const min: V3 = [1e9, 1e9, 1e9], max: V3 = [-1e9, -1e9, -1e9];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { const v = P[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
  if (!P.length) return { min: [0, 0, 0], max: [0, 0, 0] };
  return { min: min, max: max };
}
/** Upward-facing triangles (the ribbon is seen from above; cull none anyway). */
function quad(I: number[], P: number[], a: number, b: number, c: number, d: number): void {
  const tri = function (x: number, y: number, z: number) {
    const ny = (P[y * 3 + 2] - P[x * 3 + 2]) * (P[z * 3] - P[x * 3]) - (P[y * 3] - P[x * 3]) * (P[z * 3 + 2] - P[x * 3 + 2]);
    if (ny >= 0) I.push(x, y, z); else I.push(x, z, y);
  };
  tri(a, c, b); tri(b, c, d);
}
/**
 * Island ribbon on the same lip lines ShoreBreak uses (keptShoreLips, same cliff gaps), centred on the real waterline (ISLAND_WATERLINE):
 * 3 m offshore at seaBaseY + foamLift (the effect adds swash lift * COLOR.r), 2.3 m up the beach at the baked ground height + sandLift.
 */
export function islandShoreRibbon(): ShoreRibbon {
  const P: number[] = [], UV: number[] = [], C: number[] = [], I: number[] = [];
  const groups = ribbons(keptShoreLips()), R = FOAM_ROWS.length, y0 = SHORE.seaBaseY + ISLAND_RIBBON.lift;
  let total = 0;
  for (let g = 0; g < groups.length; g++) {
    const segs = groups[g], n = segs.length; if (n < 2) continue;
    const base = P.length / 3; let u = 0;
    let px = 0, pz = 0;
    for (let i = 0; i < n; i++) {
      const s = segs[i], wl = waterlineOf(s[0]);
      let dx = s[3] - s[1], dz = s[4] - s[2]; const l = Math.sqrt(dx * dx + dz * dz) || 1; dx /= l; dz /= l;   // shoreward
      const wx = s[1] + dx * l * wl[1], wz = s[2] + dz * l * wl[1];                                        // real waterline
      if (i > 0) u += Math.sqrt((wx - px) * (wx - px) + (wz - pz) * (wz - pz)); px = wx; pz = wz;
      const rock = !isBeach(segs, i);
      // a rock line next to a beach line borrows that beach's inland shape (alpha 0 inland): the shared quad is not sheared, so the
      // lip / wet edge runs along the shore into the rock and fades, instead of cutting diagonally across the sand
      const src = !rock ? i : isBeach(segs, i - 1) ? i - 1 : isBeach(segs, i + 1) ? i + 1 : -1, G = src >= 0 ? waterlineOf(segs[src][0]) : null;
      const inl = G ? Math.min(ISLAND_RIBBON.inland, G[2], rock ? ISLAND_RIBBON.inland : l * (1 - wl[1])) : ISLAND_ROCK.inland, along = endFade(i, n);
      for (let r = 0; r < R; r++) {
        const v = FOAM_ROWS[r]; let x: number, y: number, z: number, lift: number;
        if (v <= 0.5) { const k = (0.5 - v) / 0.5 * ISLAND_RIBBON.offshore; x = wx - dx * k; z = wz - dz * k; y = y0; lift = 1; }
        else { const k = (v - 0.5) / 0.5, hq = G ? G[2 + Math.round(k * 4)] : NaN; x = wx + dx * inl * k; z = wz + dz * inl * k; y = hq !== hq ? y0 : Math.max(y0, hq + ISLAND_RIBBON.sandOffset); lift = 1 - k; }
        const rk = !rock ? 1 : v > 0.5 ? 0 : v === 0.5 ? ISLAND_ROCK.edgeA : 1;
        P.push(x, y, z); UV.push(total + u, v); C.push(lift, 1, 1, clamp01(along * houseFade(x, z) * rk));
      }
    }
    for (let i = 0; i < n - 1; i++) for (let r = 0; r < R - 1; r++) { const a = base + i * R + r; quad(I, P, a, a + 1, a + R, a + R + 1); }
    total += u + 4;   // a gap in u between ribbons: the breakup does not line up across a cliff
  }
  const b = bounds(P);
  return { positions: P, uvs: UV, colors: C, indices: I, min: b.min, max: b.max, length: total };
}
/** Island swash on the amb_waves_loop clock: on each hit the lip runs up the sand (ISLAND_SWASH.up s), then slides back
 *  (ISLAND_SWASH.back s) and fades. Starts AT the hit, when the crest is on the waterline (ShoreBreak: earlier white water sat on
 *  the sand while the crest was still 2.3 m out). Continuous in time (0 at both ends), so nothing pops. */
export const ISLAND_SWASH = { up: 0.6, back: 1.6, dry: 2.6 };
function wrapDt(time: number, hit: number): number {
  const L = SHORE.loopS; let d = time - hit; d = d - Math.floor(d / L) * L; if (d > L * 0.5) d -= L; return d;
}
export function islandFront(time: number): { front: number; foamA: number } {
  let front = 0, foamA = 0; const W = ISLAND_SWASH;
  for (let i = 0; i < SHORE.swells.length; i++) {
    const d = wrapDt(time, SHORE.swells[i].hit); let f = 0, a = 0;
    if (d >= 0 && d < W.up) { const k = d / W.up; f = smoothstep(0, 1, k); a = smoothstep(0, 0.8, k); }
    else if (d >= W.up && d < W.up + W.back) { const k = (d - W.up) / W.back; f = 1 - smoothstep(0, 1, k); a = 1 - smoothstep(0.4, 1, k); }
    if (f > front) front = f; if (a > foamA) foamA = a;
  }
  return { front: front, foamA: foamA };
}
/** Wet level 0..1 behind the lip: the recent maximum of the front, drying linearly over ISLAND_SWASH.dry s (pure function of time). */
export function islandWetLevel(time: number): number {
  let w = 0; const n = 13, dt = ISLAND_SWASH.dry / n;
  for (let k = 0; k <= n; k++) { const f = islandFront(time - k * dt).front * (1 - k / (n + 1)); if (f > w) w = f; }
  return w;
}
/** Island swash for this ShoreBreak clock (the same playhead as the sea heave and the hits). */
export function islandSwash(time: number): Swash {
  const p = islandFront(time);
  return { front: p.front, foamA: p.foamA, wet: 0.25 + 0.75 * islandWetLevel(time), t: time };
}
/** Lakeside swash (the effect's USE_CC_TIME branch, same maths). */
function frontAt(ph: number, cyc: number[]): number { return smoothstep(0, cyc[1], ph) * (1 - smoothstep(cyc[1], 1, ph)); }
function fract(x: number): number { return x - Math.floor(x); }
export function lakeSwash(time: number, p?: ShoreFoamParams): Swash {
  const P = p || LAKE_FOAM, c = P.cycle, ph = fract(time / c[0]);
  return { front: frontAt(ph, c), foamA: smoothstep(0, 0.12, ph) * (1 - smoothstep(c[1] + 0.15, 0.95, ph)), wet: 0.35 + 0.65 * frontAt(fract(ph - c[2]), c), t: time };
}
/** Island night: the old lip's multiply. */
export function islandFoamTint(night: number): number[] { const m = foamMultiply(night); return [m[0], m[1], m[2], 1]; }
/** Lakeside per-mode light scales (the water's own scales, so foam and lake take the same light). */
export function lakesideShoreLight(main: number, ambient: number, p?: ShoreFoamParams): number[] {
  const P = p || LAKE_FOAM; return [main, ambient, P.lightParams[2], P.lightParams[3]];
}
/**
 * CPU mirror of shore-foam.effect frag() before lighting and fog: straight albedo rgb + alpha (vertex fade included).
 * light: optional rgb multiplier (USE_LIT term, already scaled); it is clamped at 1 like the shader's min(.., albedo).
 */
export function sampleShoreFoam(P: ShoreFoamParams, s: Swash, u: number, v: number, dist: number, fade: number, light?: number[]): number[] {
  const s0 = P.bandParams[0], reach = P.bandParams[1], lp = P.lineParams, t = s.t;
  const far = smoothstep(P.lightParams[2], P.lightParams[3], dist);
  const b = 0.62 + 0.38 * Math.sin(u * lp[2] + 1.7 * Math.sin(u * 0.31 * lp[2] + t * TAU / P.cycle[0]));
  const fv = s0 + reach * s.front, w = P.bandParams[2] * (1 + 1.5 * far);
  const lip = smoothstep(fv - w, fv - 0.3 * w, v) * (1 - smoothstep(fv - 0.015, fv + 0.012, v));
  const trail = smoothstep(s0 - 0.05, fv, v) * (1 - smoothstep(fv - 0.015, fv + 0.012, v)) * 0.12;
  const foam = (lip * b + trail) * s.foamA;
  const ln = fract(v * lp[0] - t * lp[1]);
  let line = smoothstep(0.8, 0.95, ln) * (1 - smoothstep(0.95, 1, ln));
  line *= smoothstep(0.04, 0.24, v) * (1 - smoothstep(s0 - 0.1, s0 + 0.01, v)) * lp[3] * (0.55 + 0.45 * b) * (1 - far);
  const wv = s0 + reach * s.wet;
  const wetA = P.wetColor[3] * smoothstep(s0 - 0.04, s0 + 0.03, v) * (1 - smoothstep(wv - P.bandParams[3], wv + 0.02, v));
  const fa = Math.max(0, Math.min(P.foamColor[3], foam + line));
  let a = fa + wetA * (1 - fa);
  const out = [0, 0, 0, 0];
  for (let k = 0; k < 3; k++) {
    let c = (P.foamColor[k] * fa + P.wetColor[k] * wetA * (1 - fa)) / Math.max(a, 1e-4);
    if (light) c = c * Math.min(1, light[k]);
    out[k] = c * P.tint[k];
  }
  a *= fade * P.tint[3] * smoothstep(0, 0.06, v) * (1 - smoothstep(0.94, 1, v));
  out[3] = a; return out;
}
