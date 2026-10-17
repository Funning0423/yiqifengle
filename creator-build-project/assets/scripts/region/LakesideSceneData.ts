/**
 * 风铃湖畔 (region_lakeside, r5h3) scene facts for the board background. Engine-independent (no 'cc'), unit-tested in Node.
 * Source: art/regions/lakeside/COCOS_HANDOFF.md §3–§5 and bundles/region_lakeside/scene_r5h3_lighting.json.
 * Units: metres, glTF/Cocos Y-up. The board is a 7×7 grid on the water: cell centre x=-3.3+1.1·col, z=8.7+1.1·row.
 */
export const LAKESIDE_BUNDLE = 'region_lakeside';
export const LAKESIDE_TRANSFORMS = 'scene_r5h_slim_transforms';
export const LAKESIDE_MODELS_DIR = 'models';
/** Lakeside challenge ids from LEVELS_DRAFT_lakeside.json ('r04-lake-0N'); a future r05 renumbering also matches. */
export function isLakesideStage(id: unknown): boolean { return /^r0[45]-lake-\d+$/.test(String(id || '')); }
export const LAKESIDE_GRID = Object.freeze({ cols: 7, rows: 7, cell: 1.1, x0: -3.3, z0: 8.7, y: 0 });
export function lakesideCellCenter(index: number): [number, number, number] {
  if (!Number.isInteger(index) || index < 0 || index >= 49) throw Error('lakeside cell out of range: ' + index);
  const col = index % 7, row = Math.floor(index / 7);
  return [+(LAKESIDE_GRID.x0 + LAKESIDE_GRID.cell * col).toFixed(4), LAKESIDE_GRID.y, +(LAKESIDE_GRID.z0 + LAKESIDE_GRID.cell * row).toFixed(4)];
}
/** Outer edges of the 7×7 cells (half a cell beyond the outer centres). */
export const LAKESIDE_BOARD_BOUNDS = Object.freeze({ min: [-3.85, 0, 8.15] as const, max: [3.85, 0, 15.85] as const, center: [0, 0, 12] as const });
/** Handoff §4 board camera, authored for 720×1280 portrait. */
export const LAKESIDE_BOARD_CAMERA = Object.freeze({
  position: [0.0, 13.2, 26.5] as const, rotation: [-0.22109, 0, 0, 0.97525] as const, forward: [0.0, -0.4312, -0.9022] as const,
  fovVerticalDeg: 61.928, near: 0.1, far: 1000, referenceAspect: 720 / 1280,
});
/** Same pose at any aspect: taller-than-reference screens keep the authored horizontal coverage (wider vertical FOV, capped at
 *  the 75° camera limit); wider screens keep the authored vertical FOV. Position/rotation never change, so a later
 *  travel/landing camera can end exactly on this pose. */
export function lakesideBoardPose(aspect: number): { position: [number, number, number]; rotation: [number, number, number, number]; fovVerticalDeg: number } {
  const c = LAKESIDE_BOARD_CAMERA, a = Number.isFinite(aspect) && aspect > 0 ? aspect : c.referenceAspect;
  let fov = c.fovVerticalDeg;
  if (a < c.referenceAspect) fov = 2 * Math.atan(Math.tan(c.fovVerticalDeg * Math.PI / 360) * c.referenceAspect / a) * 180 / Math.PI;
  return { position: [...c.position] as [number, number, number], rotation: [...c.rotation] as [number, number, number, number], fovVerticalDeg: +Math.min(75, fov).toFixed(3) };
}
export type LakesideLight = Readonly<{ name: string; forward: readonly number[]; colorLinear: readonly number[]; ratio: number; onlyLayer?: string }>;
/** Handoff §5 suns. Cocos has one main DirectionalLight (owned by the world scene), so the lease places each sun as a
 *  far SphereLight on the layer, `LAKESIDE_SUN_DISTANCE` m up-light from the board centre (nearly parallel over the board),
 *  with luminance scaled by the handoff ratios 1 / 0.08 / 0.22 / 0.31. SUN_mtn_sky only lights MTN_RECV → skipped. */
export const LAKESIDE_LIGHTS: readonly LakesideLight[] = Object.freeze([
  { name: 'Sun', forward: [-0.4182, -0.3983, 0.8164], colorLinear: [1.0, 0.6, 0.32], ratio: 1.0 },
  { name: 'Sun.001', forward: [0.5014, -0.6217, -0.6017], colorLinear: [0.212, 0.631, 0.745], ratio: 0.08 },
  { name: 'SUN_mtn_sky', forward: [-0.7318, -0.575, -0.3659], colorLinear: [1.0, 0.72, 0.48], ratio: 0.22, onlyLayer: 'MTN_RECV' },
  { name: 'SUN_dusk_side', forward: [-0.9629, -0.223, 0.152], colorLinear: [1.0, 0.55, 0.28], ratio: 0.31 },
]);
export const LAKESIDE_SUN_DISTANCE = 220;
export function lakesideLightPosition(l: LakesideLight): [number, number, number] {
  const c = LAKESIDE_BOARD_BOUNDS.center, d = LAKESIDE_SUN_DISTANCE;
  return [+(c[0] - l.forward[0] * d).toFixed(3), +(c[1] - l.forward[1] * d).toFixed(3), +(c[2] - l.forward[2] * d).toFixed(3)];
}
/** D1 lighting mode: 'dir' = the r5h3 suns as they were authored (parallel lights): main Sun 1.0 -> the scene's single main
 *  DirectionalLight (reused while the lake shows, restored after), SUN_dusk_side 0.31 -> ambient sky/ground, Sun.001 0.08 dropped,
 *  SUN_mtn_sky (MTN_RECV only) not placed, no point lights, shadows untouched. 'points' = the previous 3 SphereLights. */
export const LAKESIDE_LIGHT_MODE: 'dir' | 'points' = 'dir';
/** ALL lakeside 'dir' lighting / water / fog values (one block; v3 = Voice Bot's verified r5h3 values where given, 20261017T051017Z):
 *  - sun*: scene_r5h3_lighting.json Sun exactly. ambientSky = r5h3 world zenith; ambientGround = r5h3 below-horizon clamp (VB).
 *  - ambientSkyIllumToSun: v3.4 0.2 (see lakesideCocosLightColor; v2/v3.3 0.75 compensated sRGB-bytes-as-linear) - device check.
 *  - water*: lakeside-water.effect. Tint (VB/v2), Schlick F0 0.02 / power 5 (VB), reflection colour by reflect-vector elevation
 *    across zenith / low sky / horizon = the r5h3 sky ramp stops (VB), Blinn exponent 300 +-40% sin noise for a streak (VB 200–500).
 *  - fog*: v3.1 sRGB 215/170/150; mode in LAKESIDE_FOG_MODE. linear60: 60 m -> 0.4 at 130 m; Cocos LINEAR has no max amount, so
 *    the end is stretched to 60 + 70/0.4 = 235 m (clouds at ~163 m reach ~0.44). Board 16–24 m, near shore <30 m: clear. */
/** v3.4 (VB, bridge whiteness): Cocos 3.8.8 uses a light's Color bytes / 255 AS LINEAR (DirectionalLight.color -> colorTemperature-free
 *  path, Ambient.skyLightingColor / groundLightingColor -> Color.x without SRGBToLinear; only fog colour is linearised). The lease sends
 *  linearToSrgb8(<linear r5h3 colour>), so Cocos saw sRGB bytes as linear: sky ambient (0.110,0.565,0.718) instead of r5h3
 *  (0.0116,0.2747,0.4793) - ~2x too bright and cyan - and ambient w = 0.75 x sun; ACES then washed the light stone bridge to
 *  cyan-white (Mac v3.2 bridge 179/217/214 vs r5h3 104/128/116; same cause for the lime grass).
 *  r2 (VB, owner of the light colour conversion): EXACTLY ONE conversion. Every *ColorLinear light param (day AND night) is authored
 *  linear; the light call sites (LakesideBoardBackground.applyDir main light + ambient sky/ground, LakesideJourneyAtmosphere
 *  lakesideAtmosphereTarget = journey end values, also used by the day/night toggle) turn it into Cocos Color bytes with
 *  lakesideCocosLightColor(lin) = round(lin x 255), which Cocos reads back as lin. No linearToSrgb8 on those paths (test
 *  lakeside-light-encoding). linearToSrgb8 stays for colours Cocos treats as sRGB: clear colour, water fallback mainColor. Fog is sRGB. */
export function lakesideCocosLightColor(lin: readonly number[]): [number, number, number] {
  const b = (x: number) => Math.round(Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0)) * 255);
  return [b(lin[0]), b(lin[1]), b(lin[2])];
}
export const LAKESIDE_R5H3_LIGHT_LINEAR = Object.freeze({
  sun: [1.0, 0.6, 0.32] as const, ambientSky: [0.0116, 0.2747, 0.4793] as const, ambientGround: [1.0, 0.5457, 0.1441] as const,
});
export const LAKESIDE_DIR_LIGHT_PARAMS = Object.freeze({
  sunForward: [-0.4182, -0.3983, 0.8164] as const,
  /** linear (r5h3); the call sites convert once with lakesideCocosLightColor. */
  sunColorLinear: LAKESIDE_R5H3_LIGHT_LINEAR.sun as readonly number[],
  /** r2 brightness (VB, Grok Bot review "too dark, lost the warm sunset"): sun 0.5 -> 0.7; the warm fill for the backlit far
   *  trees / roofs is the HEMISPHERE ambient (zero lights, zero draw calls): sky dimmed + less blue, ground warm, ambient
   *  0.2 -> 0.49 of base. Emulator (Mac-calibrated, board camera) vs r5h3 luma: near water 0.99, bridge deck 1.11, grass_L 1.29,
   *  far trees 1.00, roof 1.12 - grass stays bright at sun >= 0.7 (see the r2 README). History: v3.4: 1.0 -> 0.5 and ambient 0.75 -> 0.2 of the base illuminance (= 0.4 x lakeside sun). With the colours now really linear,
   *  a grid search on the Mac-calibrated Blender G-buffer emulator vs r5h3 (bridge, grass, trees, roof) put the land score 1535 -> 326. */
  /** r4 (VB): refit on the engine-camera r5h3 reference (ENGINE_COLOR_REFERENCE/engine_cam_r5h3, Mac-calibrated HDR+ACES stand-in). */
  sunIlluminanceScale: 0.95,
  /** r2 warm hemisphere fill (linear; r5h3 sky 0.0116/0.2747/0.4793, ground 1/0.5457/0.1441). Up faces get the sky, the
   *  camera-facing backlit faces about half sky / half ground. */
  ambientSkyColorLinear: [0.0107, 0.0656, 0.082] as readonly number[], // r4 refit (B was 0.1106)
  /** r2b (Grok Bot: warm fill too strong, rails yellow): ground warm saturation halved toward its own luminance (c60ac55 1/0.841/0.0687,
   *  luminance 0.819 kept, so the night ratios are unchanged). */
  ambientGroundColorLinear: [0.97, 0.533, 0.296] as readonly number[], // r4 refit (was 0.9095/0.83/0.4439)
  ambientSkyIllumToSun: 0.236, // r4 refit (was 0.49): the engine-camera reference bridge/water is darker than the r3 Mac shot

  clearColorLinear: [0.0116, 0.2747, 0.4793] as const,
  fogEnabled: true, fogColorSrgb: [231, 165, 125] as const /* r4 refit (was 215/170/150) */, fogStart: 60, fogMaxAt: 130, fogMaxAmount: 0.4,
});
/** r4 (VB): THE one source of every lakeside water + reflected-sky value (lakeside-water.effect uniforms), day and night. Read by
 *  the board background (LakesideBoardBackground) AND the island->lakeside journey lake (RegionJourneyAdapter), both only through
 *  applyLakesideWaterUniforms (LakesideWaterUniforms.ts) -> lakesideWaterUniforms(mode); no other file holds a water number
 *  (test lakeside-water-shared). All colours are LINEAR and reach the shader unchanged (the effect has no `linear: true`).
 *  sky.zenith/low/horizon = what the water reflects at reflection elevation >= 0.38 / 0.16 / <= 0 (effect smoothstep stops); the sky
 *  sphere (GGbot) can read LAKESIDE_WATER_SKY[mode].sky for the same colours (linear; x255 for Cocos light bytes, linearToSrgb8 for
 *  an unlit/sRGB colour). Mode values: tint x vertex colour, water-only light scales (lightParams.xy), reflection strength (x ambient
 *  illuminance, fresnelParams.w) and the reflection-mix floor (specParams.w). */
export type LakesideWaterSkyMode = Readonly<{ tintLinear: readonly number[]; mainLightScale: number; ambientScale: number; skyStrength: number; skyReflectFloor: number;
  sky: Readonly<{ zenithLinear: readonly number[]; lowLinear: readonly number[]; horizonLinear: readonly number[] }> }>;
export const LAKESIDE_WATER_SKY = Object.freeze({
  shared: Object.freeze({
    glbs: Object.freeze(['LK_lake.glb']) as readonly string[], materialPath: 'water/lakeside-water',
    fresnelF0: 0.02, fresnelPower: 5, fresnelMax: 0.85,
    specExponent: 300, specIntensity: 1.6, specNoise: 0, // v3.3 noise 0.4 -> 0: its sin(x*3.1) striped the streak into moving bands
    waveTilt: 0.06, waveFreq: 0.9, waveSpeed: 0.7,
    waveFadeStart: 12, waveFadeEnd: 35, // v3.3 wave normal fade (m from the camera): full on the board water, none past 35 m
  }),
  day: Object.freeze({
    // r4 refit (r3: tint 0.9/1/1, main 1.37, amb 1.85, sky 0.35, floor 0.31, zenith r5h3 sky blue, low/horizon r5h3 dusk beige/orange =
    // the sand look once Cocos squared them). Horizon = the reflected far shore (olive), low = blue, zenith = dusk lavender.
    tintLinear: Object.freeze([0.714, 0.858, 1.0]), mainLightScale: 2.51, ambientScale: 2.87, skyStrength: 0.387, skyReflectFloor: 0.323,
    sky: Object.freeze({ zenithLinear: Object.freeze([0.3, 0.15, 0.465]), lowLinear: Object.freeze([0.173, 0.221, 0.481]), horizonLinear: Object.freeze([0.204, 0.297, 0.003]) }),
  }) as LakesideWaterSkyMode,
  night: Object.freeze({
    tintLinear: Object.freeze([0.9, 1.0, 1.0]), mainLightScale: 0.8, ambientScale: 0.6, skyStrength: 0.12, skyReflectFloor: 0.31,
    sky: Object.freeze({ zenithLinear: Object.freeze([0.0116, 0.2747, 0.4793]), lowLinear: Object.freeze([0.9216, 0.5776, 0.2705]), horizonLinear: Object.freeze([1.0, 0.5457, 0.1441]) }),
  }) as LakesideWaterSkyMode,
});
export type LakesideWaterUniformName = 'waterTint' | 'skyZenith' | 'skyLow' | 'skyHorizon' | 'fresnelParams' | 'specParams' | 'waveParams' | 'lightParams';
export const LAKESIDE_WATER_UNIFORM_NAMES: readonly LakesideWaterUniformName[] = Object.freeze(['waterTint', 'skyZenith', 'skyLow', 'skyHorizon', 'fresnelParams', 'specParams', 'waveParams', 'lightParams'] as LakesideWaterUniformName[]);
/** The 8 lakeside-water.effect vec4 uniforms for a mode, straight from LAKESIDE_WATER_SKY (pure; board and journey both use it). */
export function lakesideWaterUniforms(mode: LakesideDayNight): Record<LakesideWaterUniformName, [number, number, number, number]> {
  const S = LAKESIDE_WATER_SKY.shared, M: LakesideWaterSkyMode = mode === 'night' ? LAKESIDE_WATER_SKY.night : LAKESIDE_WATER_SKY.day;
  const c = (v: readonly number[]): [number, number, number, number] => [v[0], v[1], v[2], 1];
  return { waterTint: c(M.tintLinear), skyZenith: c(M.sky.zenithLinear), skyLow: c(M.sky.lowLinear), skyHorizon: c(M.sky.horizonLinear),
    fresnelParams: [S.fresnelPower, S.fresnelF0, S.fresnelMax, M.skyStrength], specParams: [S.specExponent, S.specIntensity, S.specNoise, M.skyReflectFloor],
    waveParams: [S.waveTilt, S.waveFreq, S.waveSpeed, 0], lightParams: [M.mainLightScale, M.ambientScale, S.waveFadeStart, S.waveFadeEnd] };
}
/** build05-next r2 (lead): lakeside's own NIGHT look for the day/night toggle (board + journey). Same structure as the day values
 *  (LAKESIDE_DIR_LIGHT_PARAMS, the r5h3 dusk); relative to the island's current-mode main light, so the island's 0.35 night scale
 *  carries over. Moonlight from the same direction (shadows do not jump), cool blue ambient, dark blue clear and fog; water: more
 *  ambient share (night ambient is dark), much less reflected (dusk-orange) sky. Proxy values - Mac day/night screenshots decide.
 *  r2 (VB, one conversion): the colours are now really linear in Cocos (before, linearToSrgb8 bytes were read as linear: moon
 *  0.635/0.710/0.898, sky 0.114/0.188/0.333, ground 0.153/0.161/0.220). The illuminance ratios are re-derived so night/day keeps
 *  the r2 balance per term (luminance): moon/sun 0.857, hemisphere ambient night/day 0.219, against the CURRENT day values. */
export const LAKESIDE_NIGHT_LIGHT_PARAMS = Object.freeze({
  sunColorLinear: [0.36, 0.46, 0.78] as const,
  sunIlluminanceScale: 1.173, // r4: keeps moon/sun 0.857 (luminance) vs the r4 day (sun 0.95); r2 0.864
  ambientSkyColorLinear: [0.012, 0.03, 0.09] as const,
  ambientGroundColorLinear: [0.02, 0.022, 0.04] as const,
  ambientSkyIllumToSun: 0.643, // r4: keeps hemisphere ambient night/day 0.219 vs the r4 day (fill 0.236, ground 0.97/0.533/0.296); r2 1.76
  clearColor: '#1c2740',
  fogColorSrgb: [44, 54, 84] as const,
});
export type LakesideDayNight = 'day' | 'night';
export type LakesideModeLighting = Readonly<{ sunColorLinear: readonly number[]; sunIlluminanceScale: number; ambientSkyColorLinear: readonly number[];
  ambientGroundColorLinear: readonly number[]; ambientSkyIllumToSun: number; clearColor: string; fogColorSrgb: readonly [number, number, number] }>;
/** The lakeside look for a day/night mode: day = the v3.2/v3.3 dusk values (unchanged), night = LAKESIDE_NIGHT_LIGHT_PARAMS. */
export function lakesideModeLighting(mode: LakesideDayNight): LakesideModeLighting {
  if (mode === 'night') return LAKESIDE_NIGHT_LIGHT_PARAMS;
  const P = LAKESIDE_DIR_LIGHT_PARAMS;
  return { sunColorLinear: P.sunColorLinear, sunIlluminanceScale: P.sunIlluminanceScale, ambientSkyColorLinear: P.ambientSkyColorLinear, ambientGroundColorLinear: P.ambientGroundColorLinear,
    ambientSkyIllumToSun: P.ambientSkyIllumToSun, clearColor: lakesideDayClearColor(), fogColorSrgb: P.fogColorSrgb };
}
/** Cocos LINEAR fog end that reproduces "amount fogMaxAmount at fogMaxAt" with a linear ramp from fogStart. */
/** v3.1 fog mode (lead + VB): 'layered' = Cocos LAYERED height fog, a thin golden slab just above the water (y=0) so the
 *  mountains (LK_far_hills y -2..40.8, far-shore trees from y~5.7) keep their upper halves deep green; 'linear60' = LINEAR from
 *  60 m (same end logic: 0.4 at 130 m -> end 60+70/0.4 = 235 m); 'off' = no fog. Colour sRGB 215/170/150 for both.
 *  Web builds can override once per lakeside load with ?lakefog=layered|linear60|off (no rebuild); WeChat has no location -> constant. */
export type LakesideFogMode = 'layered' | 'linear60' | 'off';
export const LAKESIDE_FOG_MODE: LakesideFogMode = 'layered';
/** LAYERED: Cocos 3.8.8 LayeredFog(): camera (y 13.2) above fogTop -> density ~ (2D/fogAtten)*(fogTop-y)/fogRange for low slabs, so it grows
 *  with horizontal distance D and with depth below fogTop. top 1.5 m = just above water/far shore (0..0.3 m), range 30 / atten 17:
 *  water at the far shore (~77 m) 0.36, lake end (100 m) 0.44, anything above 1.5 m none; board water (18-24 m) ~0.10-0.13. */
/** r4 (VB) refit (was top 1.5 / range 30 / atten 17): a thicker, softer golden slab; still below the hills and tree crowns. */
export const LAKESIDE_LAYERED_FOG = Object.freeze({ fogTop: 4.16, fogRange: 74, fogAtten: 59.2 });
export function lakesideFogMode(search?: string | null, fallback: LakesideFogMode = LAKESIDE_FOG_MODE): LakesideFogMode {
  const m = /[?&]lakefog=([a-z0-9]+)/.exec(search || '');
  return m && (m[1] === 'layered' || m[1] === 'linear60' || m[1] === 'off') ? m[1] : fallback;
}
/** Reads window.location.search only when it exists (web); WeChat mini-game -> null -> constant. Never throws. */
export function lakesideFogModeFromEnv(): LakesideFogMode {
  let q: string | null = null;
  try { const w: any = typeof window !== 'undefined' ? window : null; q = w && w.location && typeof w.location.search === 'string' ? w.location.search : null; } catch { q = null; }
  return lakesideFogMode(q);
}
export function lakesideFogEnd(p: { fogStart: number; fogMaxAt: number; fogMaxAmount: number } = LAKESIDE_DIR_LIGHT_PARAMS): number { return p.fogStart + (p.fogMaxAt - p.fogStart) / p.fogMaxAmount; }
export function linearToSrgb8(c: readonly number[]): [number, number, number] { return [linToSrgb8(c[0]), linToSrgb8(c[1]), linToSrgb8(c[2])]; }
const linToSrgb8 = (c: number) => Math.round(255 * Math.max(0, Math.min(1, c <= .0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - .055)));
export function lakesideLightSrgb(l: LakesideLight): [number, number, number] { return [linToSrgb8(l.colorLinear[0]), linToSrgb8(l.colorLinear[1]), linToSrgb8(l.colorLinear[2])]; }
/** Warm dusk clear colour behind the far hills (no skybox in the bundle). */
export const LAKESIDE_CLEAR_COLOR = '#f2b98a';
/** Day clear colour, sRGB bytes as '#rrggbb' (clear colour is never light-encoded). dir mode: the r5h3 sky clear
 *  linearToSrgb8(LAKESIDE_DIR_LIGHT_PARAMS.clearColorLinear) (~28/143/184); points mode: LAKESIDE_CLEAR_COLOR. One source for the board
 *  init clear, the day pack (board toggle) and the journey's day end target, so they cannot drift. */
export function lakesideDayClearColor(mode: 'dir' | 'points' = LAKESIDE_LIGHT_MODE): string {
  if (mode !== 'dir') return LAKESIDE_CLEAR_COLOR;
  return '#' + linearToSrgb8(LAKESIDE_DIR_LIGHT_PARAMS.clearColorLinear).map(v => ('0' + v.toString(16)).slice(-2)).join('');
}
export type LakesideInstance = Readonly<{ name: string; glb: string; group: string; pos: readonly number[]; rot_quat_xyzw: readonly number[]; scale: readonly number[]; animated?: boolean }>;
/** The 2D board UI draws pieces, cells and selection. The live scene keeps the background and the static water dressing
 *  (lily pads, rope floats, buoy lanterns, white-balance lines, chime rafts), and drops what the 2D board already shows:
 *  3D match pieces, their contact shadows / ripple rings, and the board frame whose GLB is not in the subpackage. */
export const LAKESIDE_SKIPPED_GLB: readonly string[] = Object.freeze(['LK_board_frame.glb', 'LK_contact_shadow.glb', 'LK_ripple_ring.glb']);
export function lakesideSceneInstances(instances: readonly LakesideInstance[]): LakesideInstance[] {
  if (!Array.isArray(instances) || !instances.length) throw Error('lakeside transforms empty');
  return instances.filter(i => i && typeof i.glb === 'string' && !LAKESIDE_SKIPPED_GLB.includes(i.glb) && !/^LK_piece_/.test(i.glb) && !isLakesideAssetTemplate(i));
}
/** The r5h3 export also wrote the 34 source meshes of the Blender ASSETS collection (hide_render, never visible in the
 *  reference) as instances named exactly after their GLB, all at the origin with identity transform. At the origin they stack a
 *  house A/B/C + pavilion + trees + clouds on the bridge and double the lake/terrain/bridge (z-fighting). Real placements are
 *  always suffixed (`_i`, `_i.001`, `LK_tree_mid_*`…), so an instance whose name equals its GLB basename is a template. */
export function isLakesideAssetTemplate(i: LakesideInstance): boolean { return !!i && i.name === lakesidePrefabName(i.glb); }
export function lakesidePrefabName(glb: string): string { return String(glb).replace(/\.glb$/i, ''); }
