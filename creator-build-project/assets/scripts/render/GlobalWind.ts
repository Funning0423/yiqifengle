/**
 * R5 S3 global wind (场景特效bot). One world-space wind DIRECTION + STRENGTH shared by meadow grass, the sailboat pennant and the sails.
 * Pure module (no 'cc' import, loose ES5): consumers read getGlobalWind() each frame.
 *
 * Frame: world xz, glTF/Cocos axes (+x right, +z toward the default island camera). `dir` is where the wind blows TO.
 * Defaults keep today's look:
 *  - dir (0.944, -0.330) is the axis the meadow grass shader already used (meadow-grass-wind.effect) and the direction its
 *    baked gust phase (UV1.y) travels: phase slope 0.2415 rad/m along it (r 0.87-0.91 on all 5 merged grass meshes).
 *    The board meadow root is unrotated, so board grass is unchanged. The island smoke leanDir (0.99, 0, -0.14) and the
 *    sail trim (main sail on the boat's +x side, boat heading +z) blow the same way to within 11 deg.
 *  - strength 1 = today's grass amplitude (shader multiplies by it). 0 = still.
 *  - pennantMps 0.524: true-wind speed the pennant feels. With the cruise speed 3.35 m/s it gives the authored pennant angle
 *    (172 deg, almost straight aft), so the cruising boat looks the same; moored, the pennant swings downwind.
 * Not driven here: WorldFlow getWindStrength() (0..1 exit-walk gust for her skirt/apron and smoke lean) stays its own
 * channel; skycity pennants are a baked clip; island smoke keeps its authored leanDir.
 */
export type GlobalWindState = { dirX: number; dirZ: number; strength: number; pennantMps: number };
export const GLOBAL_WIND_DEFAULT: GlobalWindState = { dirX: 0.944, dirZ: -0.330, strength: 1, pennantMps: 0.524 };
/** Authored pennant_flag direction in boat-local xz (centroid/tip azimuth from the staff, atan2(x, z)), degrees. */
export const PENNANT_AUTHORED_DEG = 172;
/** Grass gust phase slope baked by GGbot meadow v0.8.0 (rad per metre along the default dir). */
export const GRASS_PHASE_K = 0.2415;

let state: GlobalWindState = { dirX: GLOBAL_WIND_DEFAULT.dirX, dirZ: GLOBAL_WIND_DEFAULT.dirZ, strength: GLOBAL_WIND_DEFAULT.strength, pennantMps: GLOBAL_WIND_DEFAULT.pennantMps };
let revision = 0;

function finite(v: number, d: number): number { return typeof v === 'number' && isFinite(v) ? v : d; }

export function getGlobalWind(): GlobalWindState { return { dirX: state.dirX, dirZ: state.dirZ, strength: state.strength, pennantMps: state.pennantMps }; }
/** Increments on every effective change (cheap dirty check for consumers). */
export function globalWindRevision(): number { return revision; }

/** Set direction (any length, normalised; a zero vector keeps the old direction) and optionally strength (>= 0). */
export function setGlobalWind(dirX: number, dirZ: number, strength?: number): GlobalWindState {
  const x = finite(dirX, 0), z = finite(dirZ, 0), l = Math.sqrt(x * x + z * z);
  const next: GlobalWindState = { dirX: state.dirX, dirZ: state.dirZ, strength: state.strength, pennantMps: state.pennantMps };
  if (l > 1e-6) { next.dirX = x / l; next.dirZ = z / l; }
  if (strength !== undefined) next.strength = Math.max(0, finite(strength, state.strength));
  if (next.dirX !== state.dirX || next.dirZ !== state.dirZ || next.strength !== state.strength) { state = next; revision++; }
  return getGlobalWind();
}
/** Direction as a compass-style azimuth: degrees of atan2(x, z) (0 = +z, 90 = +x). */
export function setGlobalWindAzimuth(deg: number, strength?: number): GlobalWindState {
  const r = finite(deg, 0) * Math.PI / 180; return setGlobalWind(Math.sin(r), Math.cos(r), strength);
}
export function globalWindAzimuthDeg(w?: GlobalWindState): number { const s = w || state; return Math.atan2(s.dirX, s.dirZ) * 180 / Math.PI; }
export function setGlobalWindStrength(strength: number): GlobalWindState { return setGlobalWind(state.dirX, state.dirZ, strength); }
export function resetGlobalWind(): GlobalWindState {
  const d = GLOBAL_WIND_DEFAULT; state = { dirX: d.dirX, dirZ: d.dirZ, strength: d.strength, pennantMps: d.pennantMps }; revision++; return getGlobalWind();
}

/** meadow-grass-wind.effect `windDir` uniform: [world dir x, world dir z, strength, 0]. The shader turns it into mesh space. */
export function grassWindUniform(w?: GlobalWindState): number[] { const s = w || state; return [s.dirX, s.dirZ, s.strength, 0]; }

/** World xz vector into a node's local frame for a yaw (radians, Cocos euler Y: local (0,0,1) -> world (sin y, 0, cos y)). */
export function worldToYawLocal(x: number, z: number, yaw: number): number[] {
  const c = Math.cos(yaw), s = Math.sin(yaw); return [x * c - z * s, x * s + z * c];
}
/** Apparent wind (blows-to vector, m/s) in boat-local xz: true wind x strength x pennantMps minus the boat's own motion. */
export function apparentWindLocal(yaw: number, speed: number, w?: GlobalWindState): number[] {
  const s = w || state, k = s.strength * s.pennantMps, v = Math.max(0, finite(speed, 0));
  const t = worldToYawLocal(s.dirX * k, s.dirZ * k, finite(yaw, 0));
  return [t[0], t[1] - v];
}
function wrapPi(a: number): number { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
/** Pennant yaw (radians, about the staff, added to the authored pose). Null when there is no apparent wind (keep the last pose). */
export function pennantYawTarget(app: number[]): number | null {
  if (!(Math.sqrt(app[0] * app[0] + app[1] * app[1]) > 1e-4)) return null;
  return wrapPi(Math.atan2(app[0], app[1]) - PENNANT_AUTHORED_DEG * Math.PI / 180);
}
/** Frame-rate independent ease toward the target angle (shortest way). rate: 1/s. */
export function easeAngle(cur: number, target: number, dt: number, rate: number): number {
  const k = 1 - Math.exp(-Math.max(0, finite(dt, 0)) * rate); return wrapPi(cur + wrapPi(target - cur) * k);
}
/** Which side the sails set on: +1 = authored (+x, leeward when the wind blows toward +x), -1 = mirrored.
 *  Hysteresis: flip only once the apparent wind is clearly (> ~8.6 deg) on the other side. */
export function sailSide(app: number[], prev: number): number {
  const l = Math.sqrt(app[0] * app[0] + app[1] * app[1]); if (!(l > 1e-4)) return prev < 0 ? -1 : 1;
  const sx = app[0] / l; if (prev < 0) return sx > 0.15 ? 1 : -1; return sx < -0.15 ? -1 : 1;
}
