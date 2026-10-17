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
  sunIlluminanceScale: 0.7,
  /** r2 warm hemisphere fill (linear; r5h3 sky 0.0116/0.2747/0.4793, ground 1/0.5457/0.1441). Up faces get the sky, the
   *  camera-facing backlit faces about half sky / half ground. */
  ambientSkyColorLinear: [0.0107, 0.0656, 0.1106] as readonly number[],
  /** r2b (Grok Bot: warm fill too strong, rails yellow): ground warm saturation halved toward its own luminance (c60ac55 1/0.841/0.0687,
   *  luminance 0.819 kept, so the night ratios are unchanged). */
  ambientGroundColorLinear: [0.9095, 0.83, 0.4439] as readonly number[],
  ambientSkyIllumToSun: 0.49,
  clearColorLinear: [0.0116, 0.2747, 0.4793] as const,
  waterGlbs: ['LK_lake.glb'] as const,
  waterMaterialPath: 'water/lakeside-water',
  waterTintLinear: [0.9, 1.0, 1.0] as const, // v3.2 (VB): near-white (mild cool, VB cap) - the r5h3 vertex colours (shallow at shore / deep mid) ARE the water colour; Fresnel + streak on top
  waterFresnelF0: 0.02, waterFresnelPower: 5, waterFresnelMax: 0.85,
  /** v3.3: reflected-sky brightness 1.0 -> 0.4 (the floor 0.25 stays; this dims what the floor mixes in). Cocos multiplies the r5h3 sky
   *  colour by the ambient illuminance (x exposure), so at 1.0 the reflection alone gave the near water more blue than r5h3 shows. */
  waterSkyStrength: 0.35, // r2 (VB): refit under the r2 lights (v3.4 0.8, v3.3 0.4)
  /** v3.3 water-only light scales (lakeside-water lightParams.xy). Fit to the Mac v3.2 pixel (near water 64/218/216, layered) toward
   *  r5h3 66/152/146 with the shader's own terms: predicted ~61/153/145 (tools/lakeside/water_tune_v33.cjs). Main light alone cannot get
   *  there - it only lights ~5-16% of the green/blue - so ambient (0.35) and sky strength (0.4) carry most of it; main light 0.8. */
  /** v3.4 (VB): with the v3.4 linear light colours (sun 0.5, ambient 0.2) the v3.3 scales left the near water too dark (emulator
   *  52/98/88); refit on the Mac-calibrated emulator (handoff camera, layered fog, wave fade on): main 1.67, ambient 1.27, sky 0.8,
   *  floor 0.30 -> near water 58/152/148 vs r5h3 66/152/146 (R is capped by the lake vertex colour). */
  waterMainLightScale: 1.37, waterAmbientScale: 1.85, // r2 (VB) refit under sun 0.7 + warm hemisphere: emulator near water 59/153/146 vs r5h3 66/152/146 (v3.4 1.67 / 1.27)
  /** v3.3 wave normal fade (m from the camera): full on the board water, none past 35 m (kills the moving mid-lake bands). */
  waterWaveFadeStart: 12, waterWaveFadeEnd: 35,
  waterSkyZenithLinear: [0.0116, 0.2747, 0.4793] as const,
  waterSkyLowLinear: [0.9216, 0.5776, 0.2705] as const,
  waterSkyHorizonLinear: [1.0, 0.5457, 0.1441] as const,
  waterSpecExponent: 300, waterSpecNoise: 0, waterSpecIntensity: 1.6, // v3.3 noise 0.4 -> 0: its sin(x*3.1) striped the streak into moving bands
  /** v3.2: tint white keeps the r5h3 vertex colours; the warm sun pushed near water to ~(145,173,130) vs r5h3 (81,160,151) in the proxy,
   *  so a mild cool tint (0.9,1,1 - the cap VB allowed) and a 0.25 floor on the zenith-sky reflection mix (streak unaffected). */
  waterSkyReflectFloor: 0.31, // r2 refit (v3.4 0.30, v3.2 0.25)
  waterWaveTilt: 0.06, waterWaveFreq: 0.9, waterWaveSpeed: 0.7,
  fogEnabled: true, fogColorSrgb: [215, 170, 150] as const, fogStart: 60, fogMaxAt: 130, fogMaxAmount: 0.4,
});
/** build05-next r2 (lead): lakeside's own NIGHT look for the day/night toggle (board + journey). Same structure as the day values
 *  (LAKESIDE_DIR_LIGHT_PARAMS, the r5h3 dusk); relative to the island's current-mode main light, so the island's 0.35 night scale
 *  carries over. Moonlight from the same direction (shadows do not jump), cool blue ambient, dark blue clear and fog; water: more
 *  ambient share (night ambient is dark), much less reflected (dusk-orange) sky. Proxy values - Mac day/night screenshots decide.
 *  r2 (VB, one conversion): the colours are now really linear in Cocos (before, linearToSrgb8 bytes were read as linear: moon
 *  0.635/0.710/0.898, sky 0.114/0.188/0.333, ground 0.153/0.161/0.220). The illuminance ratios are re-derived so night/day keeps
 *  the r2 balance per term (luminance): moon/sun 0.857, hemisphere ambient night/day 0.219, against the CURRENT day values. */
export const LAKESIDE_NIGHT_LIGHT_PARAMS = Object.freeze({
  sunColorLinear: [0.36, 0.46, 0.78] as const,
  sunIlluminanceScale: 0.864, // r2: keeps moon/sun 0.857 (luminance) vs the r2 day (sun 0.7)
  ambientSkyColorLinear: [0.012, 0.03, 0.09] as const,
  ambientGroundColorLinear: [0.02, 0.022, 0.04] as const,
  ambientSkyIllumToSun: 1.76, // r2: keeps hemisphere ambient night/day 0.219 vs the r2 day (warm fill 0.49)
  clearColor: '#1c2740',
  fogColorSrgb: [44, 54, 84] as const,
  waterMainLightScale: 0.8, waterAmbientScale: 0.6, waterSkyStrength: 0.12,
});
export type LakesideDayNight = 'day' | 'night';
export type LakesideModeLighting = Readonly<{ sunColorLinear: readonly number[]; sunIlluminanceScale: number; ambientSkyColorLinear: readonly number[];
  ambientGroundColorLinear: readonly number[]; ambientSkyIllumToSun: number; clearColor: string; fogColorSrgb: readonly [number, number, number];
  waterMainLightScale: number; waterAmbientScale: number; waterSkyStrength: number }>;
/** The lakeside look for a day/night mode: day = the v3.2/v3.3 dusk values (unchanged), night = LAKESIDE_NIGHT_LIGHT_PARAMS. */
export function lakesideModeLighting(mode: LakesideDayNight): LakesideModeLighting {
  if (mode === 'night') return LAKESIDE_NIGHT_LIGHT_PARAMS;
  const P = LAKESIDE_DIR_LIGHT_PARAMS;
  return { sunColorLinear: P.sunColorLinear, sunIlluminanceScale: P.sunIlluminanceScale, ambientSkyColorLinear: P.ambientSkyColorLinear, ambientGroundColorLinear: P.ambientGroundColorLinear,
    ambientSkyIllumToSun: P.ambientSkyIllumToSun, clearColor: lakesideDayClearColor(), fogColorSrgb: P.fogColorSrgb, waterMainLightScale: P.waterMainLightScale, waterAmbientScale: P.waterAmbientScale, waterSkyStrength: P.waterSkyStrength };
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
export const LAKESIDE_LAYERED_FOG = Object.freeze({ fogTop: 1.5, fogRange: 30, fogAtten: 17 });
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
