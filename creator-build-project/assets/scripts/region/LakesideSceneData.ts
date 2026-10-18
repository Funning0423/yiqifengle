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
  waterGlbs: ['LK_lake.glb'] as const,
  /** r4 land fill (VB, Grok Bot approved): the r4 global lights put the water + bridge on the engine-camera r5h3 reference but leave
   *  the land too dark/brown (the reference land is lit by Blender's world). An extra flat, unshadowed fill (builtin-standard
   *  emissive, linear, added before tone mapping, NOT scaled by exposure) on the LANDFORM GLBs only - the ground surface (near) and
   *  the distant landscape (far). Not land: water, bridge, buildings, props, vegetation (trees/bushes/reeds/flowers), rocks, clouds.
   *  The day/night values are per mode in lakesideModeLighting (landFillNearLinear / landFillFarLinear). */
  landFillNearGlbs: ['LK_terrain.glb'] as const,
  landFillFarGlbs: ['LK_far_hills.glb', 'LK_far_shore.glb'] as const,
  landFillNearLinear: [0.104, 0.196, 0.025] as const, // day: grass back to the reference (fit, 390x844)
  landFillFarLinear: [0.043, 0.087, 0.107] as const, // day: far hills + snow back to the reference, cool haze
  /** r4 prop fill (VB, Grok Bot): the SAME flat emissive fill on four more classes, each with its own per-mode value in
   *  lakesideModeLighting (foliageFillLinear / wallFillLinear / rockFillLinear / cloudFillLinear). Still never filled: water
   *  (waterGlbs), bridge (LK_bridge, LK_bridge_steps), small props (posts, lanterns, boats, barrels, ...), reeds/flowers/grass cards.
   *  Day values fit to the engine-cam r5h3 reference (object pixels; stand-in); every value >= 0 (no negative emissive).
   *  foliage = the tree-like vegetation; wall = the house bodies; rock = LK_rock (not visible from either board pose, so it gets a
   *  neutral fill of the far-land luminance by day and the far-land night value); cloud = back to the reference's warm white. */
  foliageFillGlbs: ['LK_tree_conifer.glb', 'LK_tree_round.glb', 'LK_bush.glb'] as const,
  /** r5 (VB): the pavilion joins the wall class (same building palette; per-part weights below keep its roof / dark posts unlifted). */
  wallFillGlbs: ['LK_house_A.glb', 'LK_house_B.glb', 'LK_house_C.glb', 'LK_pavilion.glb'] as const,
  rockFillGlbs: ['LK_rock.glb'] as const,
  cloudFillGlbs: ['LK_cloud.glb'] as const,
  /** r5 per-part fill (VB): plants (reeds, flowers, lotus, lily pads) and small props (posts, chimes, lanterns, boats, barrel, porch
   *  steps, clothesline) get their own class. Still never filled: water, bridge (+ steps), shore foam, ripples/splashes, grass
   *  tufts, ducks / dragonfly (guests), board pieces (LK_piece_*), the untextured rope/float/shadow meshes. */
  plantFillGlbs: ['LK_reed_card.glb', 'LK_flower_clump.glb', 'LK_flowerpot.glb', 'LK_lotus.glb', 'LK_lilypad.glb'] as const,
  propFillGlbs: ['LK_chime_post.glb', 'LK_chime_raft.glb', 'LK_windchime.glb', 'LK_buoy_lantern.glb', 'LK_lantern.glb', 'LK_lantern_boat.glb',
    'LK_paper_boat.glb', 'LK_barrel.glb', 'LK_porch_steps.glb', 'LK_clothesline.glb'] as const,
  foliageFillLinear: [0.019, 0.065, 0] as const, wallFillLinear: [0.023, 0.02, 0.017] as const,
  rockFillLinear: [0.079, 0.079, 0.079] as const, cloudFillLinear: [0.33, 0.24, 0.218] as const,
  /** r5 day (stand-in fit vs engine-cam r5h3, per palette swatch with LAKESIDE_FILL_PART_WEIGHT.day): plant = green-leaning, prop = warm neutral. */
  plantFillLinear: [0.03, 0.09, 0.04] as const, propFillLinear: [0.06, 0.045, 0.035] as const,
  waterMaterialPath: 'water/lakeside-water',
  waterTintLinear: [0.714, 0.858, 1.0] as const, // r4 refit: tint saturation fitted on the engine-camera reference (r3 0.9/1/1). Was: v3.2 (VB): near-white (mild cool, VB cap) - the r5h3 vertex colours (shallow at shore / deep mid) ARE the water colour; Fresnel + streak on top
  waterFresnelF0: 0.02, waterFresnelPower: 5, waterFresnelMax: 0.85,
  /** v3.3: reflected-sky brightness 1.0 -> 0.4 (the floor 0.25 stays; this dims what the floor mixes in). Cocos multiplies the r5h3 sky
   *  colour by the ambient illuminance (x exposure), so at 1.0 the reflection alone gave the near water more blue than r5h3 shows. */
  waterSkyStrength: 0.387, // r4 refit (r3 0.35). r2 (VB): refit under the r2 lights (v3.4 0.8, v3.3 0.4)
  /** v3.3 water-only light scales (lakeside-water lightParams.xy). Fit to the Mac v3.2 pixel (near water 64/218/216, layered) toward
   *  r5h3 66/152/146 with the shader's own terms: predicted ~61/153/145 (tools/lakeside/water_tune_v33.cjs). Main light alone cannot get
   *  there - it only lights ~5-16% of the green/blue - so ambient (0.35) and sky strength (0.4) carry most of it; main light 0.8. */
  /** v3.4 (VB): with the v3.4 linear light colours (sun 0.5, ambient 0.2) the v3.3 scales left the near water too dark (emulator
   *  52/98/88); refit on the Mac-calibrated emulator (handoff camera, layered fog, wave fade on): main 1.67, ambient 1.27, sky 0.8,
   *  floor 0.30 -> near water 58/152/148 vs r5h3 66/152/146 (R is capped by the lake vertex colour). */
  waterMainLightScale: 2.51, waterAmbientScale: 2.87, // r4 refit (r3 1.37 / 1.85). r2 (VB) refit under sun 0.7 + warm hemisphere: emulator near water 59/153/146 vs r5h3 66/152/146 (v3.4 1.67 / 1.27)
  /** v3.3 wave normal fade (m from the camera): full on the board water, none past 35 m (kills the moving mid-lake bands). */
  waterWaveFadeStart: 12, waterWaveFadeEnd: 35,
  /** r4 refit. r3 used the r5h3 world ramp (zenith sky blue, low beige 0.92/0.58/0.27, horizon orange 1/0.55/0.14): the low
   *  engine camera sees reflection elevations 0.07-0.16 at the lake centre, i.e. mostly low/horizon, and Cocos squared them
   *  (`linear: true`, now dropped) -> the beige/orange "sand" centre. Now: horizon = the reflected far shore (olive),
   *  low = blue, zenith = dusk lavender. */
  waterSkyZenithLinear: [0.3, 0.15, 0.465] as const,
  waterSkyLowLinear: [0.173, 0.221, 0.481] as const,
  waterSkyHorizonLinear: [0.204, 0.297, 0.003] as const,
  waterSpecExponent: 300, waterSpecNoise: 0, waterSpecIntensity: 1.6, // v3.3 noise 0.4 -> 0: its sin(x*3.1) striped the streak into moving bands
  /** v3.2: tint white keeps the r5h3 vertex colours; the warm sun pushed near water to ~(145,173,130) vs r5h3 (81,160,151) in the proxy,
   *  so a mild cool tint (0.9,1,1 - the cap VB allowed) and a 0.25 floor on the zenith-sky reflection mix (streak unaffected). */
  waterSkyReflectFloor: 0.323, // r4 refit (r3 0.31). r2 refit (v3.4 0.30, v3.2 0.25)
  waterWaveTilt: 0.06, waterWaveFreq: 0.9, waterWaveSpeed: 0.7,
  fogEnabled: true, fogColorSrgb: [231, 165, 125] as const /* r4 refit (was 215/170/150) */, fogStart: 60, fogMaxAt: 130, fogMaxAmount: 0.4,
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
  sunIlluminanceScale: 1.173, // r4: keeps moon/sun 0.857 (luminance) vs the r4 day (sun 0.95); r2 0.864
  ambientSkyColorLinear: [0.012, 0.03, 0.09] as const,
  ambientGroundColorLinear: [0.02, 0.022, 0.04] as const,
  ambientSkyIllumToSun: 0.643, // r4: keeps hemisphere ambient night/day 0.219 vs the r4 day (fill 0.236, ground 0.97/0.533/0.296); r2 1.76
  clearColor: '#1c2740',
  fogColorSrgb: [44, 54, 84] as const,
  /** r4 (VB): the night lake reflects its OWN dark blue-teal sky. r3 reused the day dusk beige/orange low/horizon (x skyStrength
   *  0.12) -> the orange-brown night lake centre. Zenith = this clear colour #1c2740 (linear), low/horizon dark teal; the sky
   *  reflection stays on at night (0.6 of the night ambient illuminance). */
  waterMainLightScale: 0.8, waterAmbientScale: 1.0, waterSkyStrength: 0.6, // r4 (r2 amb 0.6, sky 0.12)
  waterTintLinear: [0.7, 0.95, 1.0] as const, waterSkyReflectFloor: 0.28,
  waterSkyZenithLinear: [0.011, 0.02, 0.051] as const, waterSkyLowLinear: [0.014, 0.045, 0.065] as const, waterSkyHorizonLinear: [0.018, 0.06, 0.068] as const,
  /** r4 land fill, night: cool (blue) and small - night land ~80% of the Mac r3 night land luma, no brown. */
  landFillNearLinear: [0, 0, 0.0014] as const, landFillFarLinear: [0.0049, 0.0116, 0.0356] as const,
  /** r4 prop fill, night: ~80% of the Mac r3 night luma of each class with r3's cool hue (blue >= red); rock = the far-land night value. */
  foliageFillLinear: [0.0006, 0.0058, 0.0029] as const, wallFillLinear: [0.0085, 0.013, 0.0232] as const,
  rockFillLinear: [0.0049, 0.0116, 0.0356] as const, cloudFillLinear: [0.0078, 0.0091, 0.0145] as const,
  /** r5 night: ~80% of the Mac r3 night luma per class (stand-in: plant 0.82, prop 0.81), cool (red lowest). */
  plantFillLinear: [0.016, 0.048, 0.052] as const, propFillLinear: [0.0015, 0.016, 0.026] as const,
});
export type LakesideDayNight = 'day' | 'night';
export type LakesideModeLighting = Readonly<{ sunColorLinear: readonly number[]; sunIlluminanceScale: number; ambientSkyColorLinear: readonly number[];
  ambientGroundColorLinear: readonly number[]; ambientSkyIllumToSun: number; clearColor: string; fogColorSrgb: readonly [number, number, number];
  waterMainLightScale: number; waterAmbientScale: number; waterSkyStrength: number;
  /** r4: the reflected sky + tint + mix floor are per mode too (written by applyLakesideWaterMode on the board AND journey copies). */
  waterTintLinear: readonly number[]; waterSkyReflectFloor: number; waterSkyZenithLinear: readonly number[]; waterSkyLowLinear: readonly number[]; waterSkyHorizonLinear: readonly number[];
  /** r4: land fill (emissive, linear) per landform class - see LAKESIDE_DIR_LIGHT_PARAMS.landFill*Glbs. */
  landFillNearLinear: readonly number[]; landFillFarLinear: readonly number[];
  /** r4 prop fill (emissive, linear) per class - see LAKESIDE_DIR_LIGHT_PARAMS.foliage/wall/rock/cloudFillGlbs. */
  foliageFillLinear: readonly number[]; wallFillLinear: readonly number[]; rockFillLinear: readonly number[]; cloudFillLinear: readonly number[];
  /** r5 per-part fill: plants and small props (see LAKESIDE_DIR_LIGHT_PARAMS.plantFillGlbs / propFillGlbs). */
  plantFillLinear: readonly number[]; propFillLinear: readonly number[];
  /** r4 (VB): the colour of the visible SKY DOME / backdrop for this mode, sRGB hex = the board camera clear colour (day lakesideDayClearColor(),
   *  night LAKESIDE_NIGHT_LIGHT_PARAMS.clearColor; day 28/143/184, night #1c2740 = 28/39/64). Read by
   *  lakesideSkyDomeColor(mode) (journey sky sphere target). NOT waterSkyZenith/Low/HorizonLinear: those are the
   *  water's REFLECTED-sky inputs, pre-compensated for the water tint (their mean comes out lavender), not colours of the sky itself. */
  skyDomeColor: string }>;
/** The lakeside look for a day/night mode: day = the v3.2/v3.3 dusk values (unchanged), night = LAKESIDE_NIGHT_LIGHT_PARAMS. */
export function lakesideModeLighting(mode: LakesideDayNight): LakesideModeLighting {
  if (mode === 'night') return LAKESIDE_NIGHT_MODE_LIGHTING;
  const P = LAKESIDE_DIR_LIGHT_PARAMS;
  return { sunColorLinear: P.sunColorLinear, sunIlluminanceScale: P.sunIlluminanceScale, ambientSkyColorLinear: P.ambientSkyColorLinear, ambientGroundColorLinear: P.ambientGroundColorLinear,
    ambientSkyIllumToSun: P.ambientSkyIllumToSun, clearColor: lakesideDayClearColor(), fogColorSrgb: P.fogColorSrgb, waterMainLightScale: P.waterMainLightScale, waterAmbientScale: P.waterAmbientScale, waterSkyStrength: P.waterSkyStrength,
    waterTintLinear: P.waterTintLinear, waterSkyReflectFloor: P.waterSkyReflectFloor, waterSkyZenithLinear: P.waterSkyZenithLinear, waterSkyLowLinear: P.waterSkyLowLinear, waterSkyHorizonLinear: P.waterSkyHorizonLinear,
    landFillNearLinear: P.landFillNearLinear, landFillFarLinear: P.landFillFarLinear,
    foliageFillLinear: P.foliageFillLinear, wallFillLinear: P.wallFillLinear, rockFillLinear: P.rockFillLinear, cloudFillLinear: P.cloudFillLinear,
    plantFillLinear: P.plantFillLinear, propFillLinear: P.propFillLinear, skyDomeColor: lakesideDayClearColor() };
}
/** night mode lighting = the night params + the derived sky dome colour (same value as the night clear colour, no second literal). */
const LAKESIDE_NIGHT_MODE_LIGHTING: LakesideModeLighting = Object.freeze(Object.assign({}, LAKESIDE_NIGHT_LIGHT_PARAMS, { skyDomeColor: LAKESIDE_NIGHT_LIGHT_PARAMS.clearColor }));
export type LakesideLandFillClass = 'near' | 'far' | 'foliage' | 'wall' | 'rock' | 'cloud' | 'plant' | 'prop';
/** r4 land fill: which landform class a GLB is (null = not land: never filled). */
export function lakesideLandFillClass(glb: string): LakesideLandFillClass | null {
  const P = LAKESIDE_DIR_LIGHT_PARAMS;
  if ((P.landFillNearGlbs as readonly string[]).includes(glb)) return 'near';
  if ((P.landFillFarGlbs as readonly string[]).includes(glb)) return 'far';
  if ((P.foliageFillGlbs as readonly string[]).includes(glb)) return 'foliage';
  if ((P.wallFillGlbs as readonly string[]).includes(glb)) return 'wall';
  if ((P.rockFillGlbs as readonly string[]).includes(glb)) return 'rock';
  if ((P.cloudFillGlbs as readonly string[]).includes(glb)) return 'cloud';
  if ((P.plantFillGlbs as readonly string[]).includes(glb)) return 'plant';
  if ((P.propFillGlbs as readonly string[]).includes(glb)) return 'prop';
  return null;
}
/** The fill (emissiveScale, linear) of a class in a mode - the only class -> value map (board and journey writers read it). */
export function lakesideFillLinear(mode: LakesideDayNight, cls: LakesideLandFillClass): readonly number[] {
  const M = lakesideModeLighting(mode);
  return cls === 'near' ? M.landFillNearLinear : cls === 'far' ? M.landFillFarLinear : cls === 'foliage' ? M.foliageFillLinear
    : cls === 'wall' ? M.wallFillLinear : cls === 'rock' ? M.rockFillLinear : cls === 'plant' ? M.plantFillLinear : cls === 'prop' ? M.propFillLinear
    : M.cloudFillLinear;
}
/** r5 per-part fill (VB). Every lakeside GLB is ONE palette material (T_LK_palette_256: 16x16 cells of 16 px, nearest, UV into a cell), so
 *  the "parts" of a model (roof, wall, door trim, trunk, crown, cliff...) are its palette swatches. The fill copy samples a 16x16 mask
 *  texture with the same UV (builtin-standard USE_EMISSIVE_MAP: emissive = SRGBToLinear(map) x emissiveScale), so each swatch gets
 *  weight x class fill; emissiveScale also carries the journey atmosphere weight. Rows 10..15 of the palette (rows 0..9 are black). */
export const LAKESIDE_PALETTE_CELL_ROW0 = 10;
export const LAKESIDE_PALETTE_CELLS: readonly string[] = Object.freeze([
  '93a77c 5b6835 77853e a69982 398f12 5ca214 000000 000000 000000 000000 000000 000000 000000 000000 000000 000000',
  'a48a78 7e6a60 ff9ec0 000000 000000 000000 000000 000000 000000 000000 000000 000000 000000 000000 000000 000000',
  'f3eee4 e39a3b f2e7c9 5e9a5a bfe3e6 d9b98c 8ff6ff e8483a fff8ec a98bea 3e9a57 7cc55a 8c6a4f d8c08a 5fd3cc b7c9e2',
  'd6cbb6 cc9670 2c7a3e ff9ec0 4e9a5c eaf8f4 8fb3d6 5a93a8 3f7f52 2f6446 b9805e 9c6a55 c9532a 2f7a4a 6a4630 9aa3ab',
  'e6d9c2 b9b2a6 3f9a4a 8ccb4e ffffff ff8fb1 ffd84a fff6e8 4e8f3a 2e8c8c 8a5a3a 5e3b28 e9cf94 d9a867 b98a55 b8ac98',
  '1e9aa8 c27a45 ff9a2e f2d58a 5a3524 ffb765 e2622f d9862f fff1d6 6dbe45 a8d64a d9a441 ffd27a 2d7e96 4fa0a0 1b3a55',
]);
/** Per-swatch fill weight (linear 0..1; a swatch not listed = 1, the r4 whole-object fill). Only the filled classes read it.
 *  day: fit on the Cocos-3.8.8 stand-in against the engine-cam r5h3 reference, per (class, swatch) pixel median (both poses):
 *    roofs (e2622f/d9862f/c9532a), dark wood trim (5a3524), warm wood (c27a45), stone trim (e6d9c2), trunks (6a4630), cliffs
 *    (8a5a3a/5e3b28), sand/path (e9cf94/d9a867/b98a55), lanterns/bells (ff9a2e/d9a441) and the buoy red read darker and more saturated in
 *    the reference -> 0 or small. Pinned at 1 so the r4 sampled points stay put: grass 398f12, house wall fff1d6, the tree_round crowns
 *    in the tree_crown box (2c7a3e/3f9a4a/8ccb4e), cloud fff6e8, far haze/snow (8fb3d6/b7c9e2/a69982).
 *  night: fit per swatch to ~80% of the Mac r3 night luma (the night bar), crowns/wall/cloud/grass pinned at 1. */
export const LAKESIDE_FILL_PART_WEIGHT = Object.freeze({
  day: Object.freeze<Record<string, number>>({
    '398f12': 1, '8a5a3a': 0, '5e3b28': 0, 'e9cf94': 0, 'b98a55': 0, 'd9a867': 0, // near land: grass on, cliffs / sand / path off
    // r5.1: far-hill base swatches and conifers at 0.1/0/0.2/0.4 left the tree line + hill base a near-black band (18-22% of the comparison sheet).
    '93a77c': 0.8, '5b6835': 0.7, '77853e': 0.7, 'a69982': 1, 'b7c9e2': 1, '8fb3d6': 1, '5ca214': 0, // far hills / far shore
    '3f9a4a': 1, '8ccb4e': 1, '2c7a3e': 1, '4e9a5c': 0.9, '2f6446': 0.7, '2f7a4a': 0.8, '6a4630': 0, // foliage: conifers mostly filled, trunks off
    'fff1d6': 1, 'e2622f': 0, 'd9862f': 0, 'c9532a': 0, '5a3524': 0, 'c27a45': 0.1, 'e6d9c2': 0, 'd9b98c': 0.6, // buildings
    '2e8c8c': 1, 'ffd27a': 1, '4e8f3a': 0.5, 'ff8fb1': 0.3,
    'f2d58a': 1, '3e9a57': 0.9, '7cc55a': 0, '5e9a5a': 0, 'ff9ec0': 0.3, 'ffffff': 0.5, 'ffd84a': 0.4, // plants
    'f3eee4': 1, 'e8483a': 0, 'ff9a2e': 0, 'd9a441': 0, 'eaf8f4': 1, // props
    'fff6e8': 1, // cloud
  }),
  night: Object.freeze<Record<string, number>>({
    '398f12': 1, '8a5a3a': 0.4, '5e3b28': 0.9, 'e9cf94': 0.3, 'b98a55': 1, 'd9a867': 0,
    '93a77c': 0.7, '5b6835': 0.6, '77853e': 0.6, 'a69982': 0.5, 'b7c9e2': 1, '8fb3d6': 0.9, '5ca214': 0.6,
    '3f9a4a': 1, '8ccb4e': 1, '2c7a3e': 1, '4e9a5c': 1, '2f6446': 0.6, '2f7a4a': 0.7, '6a4630': 0.1,
    'fff1d6': 1, 'e2622f': 0.1, 'd9862f': 0.4, 'c9532a': 0.2, '5a3524': 0.3, 'c27a45': 0.5, 'e6d9c2': 1, 'd9b98c': 0.2,
    '2e8c8c': 0, 'ffd27a': 0, '4e8f3a': 1, 'ff8fb1': 0.4,
    'f2d58a': 0.7, '3e9a57': 0.1, '7cc55a': 0.3, '5e9a5a': 0, 'ff9ec0': 0.2, 'ffffff': 0.5, 'ffd84a': 0.7,
    'f3eee4': 0.3, 'e8483a': 0.1, 'ff9a2e': 0.2, 'd9a441': 0.1, 'eaf8f4': 1,
    'fff6e8': 1,
  }),
});
/** The weight of one palette swatch in a mode (1 when unlisted). */
export function lakesideFillPartWeight(mode: LakesideDayNight, hex: string): number {
  const t = mode === 'night' ? LAKESIDE_FILL_PART_WEIGHT.night : LAKESIDE_FILL_PART_WEIGHT.day, k = String(hex).replace('#', '').toLowerCase();
  const w = Object.prototype.hasOwnProperty.call(t, k) ? t[k] : 1;
  return Math.max(0, Math.min(1, Number.isFinite(w) ? w : 1));
}
/** RGBA8 bytes of the 16x16 mask (row 0 = the palette's top row = glTF v 0, same as the palette image). Byte = round(255 x sqrt(w)):
 *  the effect reads the map with SRGBToLinear (x*x in Cocos 3.8.8 gamma.chunk), so the shader sees w back (+-0.4%). Plain loops, no
 *  spread / for-of (WeChat loose ES5). Rows 0..9 are black in the palette (unused) and get weight 1. */
export function lakesideFillMaskBytes(mode: LakesideDayNight): Uint8Array {
  const out = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) {
    const row = y >= LAKESIDE_PALETTE_CELL_ROW0 ? LAKESIDE_PALETTE_CELLS[y - LAKESIDE_PALETTE_CELL_ROW0].split(' ') : null;
    for (let x = 0; x < 16; x++) {
      const w = row ? lakesideFillPartWeight(mode, row[x]) : 1, b = Math.round(255 * Math.sqrt(w)), o = (y * 16 + x) * 4;
      out[o] = b; out[o + 1] = b; out[o + 2] = b; out[o + 3] = 255;
    }
  }
  return out;
}
/** Journey: the fill follows the atmosphere blend weight (0 on the island side, 1 at the board). */
export function lakesideFillWeight(w: number): number { return Math.max(0, Math.min(1, Number.isFinite(w) ? w : 1)); }
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
/** r4 (VB) refit (was top 1.5 / range 30 / atten 17): a thicker, much softer golden slab - far shore water ~14%, board water ~4%,
 *  nothing above 4.16 m (hills, tree crowns). */
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
