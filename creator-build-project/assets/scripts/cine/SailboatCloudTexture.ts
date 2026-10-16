/**
 * Procedural cloud texture + staggered dissolve for the sailboat cloud bank.
 * No engine imports, no downloaded art: node tests and the web proxy use the same code.
 * Texture: value-noise fBm billows, opaque core, ragged fBm edge, soft shaded underside.
 */
export const SAILBOAT_CLOUD_TEX_SIZE = 128;
/** How far the last puff lags the first, as a fraction of the cover ramp. */
export const SAILBOAT_DISSOLVE_SPREAD = 0.55;

function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smooth(t: number): number { return t * t * (3 - 2 * t); }
/** Tileable value noise on a period-p lattice. */
function vnoise(x: number, y: number, p: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = smooth(x - xi), fy = smooth(y - yi);
  const w = (a: number) => ((a % p) + p) % p;
  const a = hash2(w(xi), w(yi), seed), b = hash2(w(xi + 1), w(yi), seed);
  const c = hash2(w(xi), w(yi + 1), seed), d = hash2(w(xi + 1), w(yi + 1), seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function cloudFbm(u: number, v: number, seed: number): number {
  let sum = 0, amp = 0.5, freq = 4, norm = 0;
  for (let o = 0; o < 5; o++) {
    sum += amp * vnoise(u * freq, v * freq, freq, seed + o * 17);
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

/**
 * RGBA8 pixels, size×size. Quad spans uv 0..1; centre is opaque (alpha 255 for r < 0.5),
 * the edge is eaten by fBm so the silhouette is a billowy cloud, not a disc.
 */
export function sailboatCloudPixels(size: number, seed: number): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size, v = (y + 0.5) / size;
    const dx = u * 2 - 1, dy = v * 2 - 1;
    const r = Math.sqrt(dx * dx + dy * dy);
    const n = cloudFbm(u, v, seed);
    const edge = r + (n - 0.5) * 0.55;
    let a = edge <= 0.52 ? 1 : edge >= 0.82 ? 0 : 1 - smooth((edge - 0.52) / 0.3);
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    // Lit tops, cool shaded bellies (v = 1 is the bottom in texture space), billow detail from fBm.
    const belly = smooth(Math.min(1, Math.max(0, v * 1.1 - 0.2)));
    const detail = cloudFbm(u * 1.7 + 0.3, v * 1.7, seed + 101);
    const lum = 1 - 0.26 * belly - 0.22 * (1 - detail) * (0.6 + 0.4 * belly) + 0.04 * (1 - belly);
    const i = (y * size + x) * 4;
    // Shadows go cool blue-grey, tops stay warm white.
    out[i] = Math.round(255 * Math.min(1, Math.max(0, lum * 0.97 + 0.02 * (1 - belly))));
    out[i + 1] = Math.round(255 * Math.min(1, Math.max(0, lum * 0.985)));
    out[i + 2] = Math.round(255 * Math.min(1, Math.max(0, lum + 0.05 * belly)));
    out[i + 3] = Math.round(255 * a);
  }
  return out;
}

/**
 * Per-puff alpha for the soft dissolve. Puffs come in (and leave) one after another,
 * order by `rank` 0..1. At cover >= 1 every puff is fully opaque, at 0 every puff is gone,
 * so cloudBankCovers() still means the screen is shut.
 */
export function puffDissolveAlpha(cover: number, rank: number): number {
  if (!(cover > 0)) return 0;
  if (cover >= 1) return 1;
  const lag = rank * SAILBOAT_DISSOLVE_SPREAD;
  const t = (cover * (1 + SAILBOAT_DISSOLVE_SPREAD) - lag);
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return smooth(c);
}

/**
 * Where a puff sits for its own dissolve alpha `a` (view fractions / view-heights).
 * Arriving puffs slide in from outside the frame and swell; leaving puffs part outwards,
 * so the cover reads as sailing through cloud, not a cross-fade.
 */
export function puffPlacement(x: number, y: number, scale: number, a: number): { x: number; y: number; scale: number } {
  const away = 1 - (a < 0 ? 0 : a > 1 ? 1 : a);
  const len = Math.sqrt(x * x + y * y);
  const dx = len > 1e-3 ? x / len : 0, dy = len > 1e-3 ? y / len : 1;
  const push = 0.38 * away;
  return { x: x + dx * push, y: y + dy * push, scale: scale * (0.82 + 0.18 * (1 - away)) };
}

/** Moonlit cloud multiplier: white clouds at night read as a flash. w = world night weight 0..1. */
export const SAILBOAT_CLOUD_NIGHT_RGB: readonly number[] = [0.4, 0.47, 0.64];
export function cloudNightTint(rgb: readonly number[], w: number): [number, number, number] {
  const t = w > 0 ? (w < 1 ? w : 1) : 0;
  const k = SAILBOAT_CLOUD_NIGHT_RGB;
  return [0, 1, 2].map(i => Math.round(rgb[i] * (1 + (k[i] - 1) * t))) as [number, number, number];
}
