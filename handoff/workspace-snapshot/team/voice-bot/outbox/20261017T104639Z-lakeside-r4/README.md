# 风铃湖畔 lakeside r4: engine-camera reference + water/sky/fog/light refit (Voice Bot)

Branch `voice/build05-lakeside-r4`, HEAD `9581c232a9aae3dbec449d80eaef5edc2f7a8b8c` (local, not pushed).
Base: GGbot `ggbot/build05-r4-prep` @ `97b761d11f14f8d24e3b690e370cb0da04ff9127`, i.e. f3d3614 + 10 GGbot commits.

| commit | what |
|---|---|
| 193b4f1 | D (= 10a7820) diag, gated `DEBUG && ?lakediag=1` (one conflict with GGbot's applyLakesideWaterMode line, resolved: keep his call + the diag call) |
| c4965cb | S (= f492dc1) v_color double-decode fix |
| ed2e532 | drop `linear: true` on the water colour uniforms (the sand cause, see below) |
| eaf2072 | day refit: values only, in GGbot's single source |
| 9581c23 | night: per-mode reflected sky (dark blue-teal); tests lock sky reflection > 0 |

`patches/` = `git format-patch f3d3614..voice/build05-lakeside-r4` (15: GGbot's 10, then my 5).
`voice-build05-lakeside-r4.bundle` = `f3d3614..voice/build05-lakeside-r4`, verified.
Stacks cleanly on 运镜bot's a8ba19a: all 15 cherry-pick with no conflict, and every tools/lakeside test passes there (checked in a throwaway worktree, since removed).

**Diag flag: `?lakediag=1`** (DEBUG build). The r3 README said `?qfLakeDiag=1`, which was wrong.

## Suite
`suite.log`: fresh full run on 9581c23 after GGbot's 06:45-06:50 EDT `pkill`. The earlier runs from that window were discarded and no partial log is shipped.
Result: 78/83 PASS. Only the known 5 fail: production-integrity, legacy-board-ui-pure, reward-background-return, cloud-web-contract, and navigation-guard (BLOCKED_BROWSER).
New: lakeside-sky-reflection. Extended: lakeside-shared-water (GGbot's).

## Shared water + sky source (for GGbot)
No parallel mechanism. Everything goes through GGbot's `lakesideWaterMaterial()` (static) and `applyLakesideWaterMode(mat, mode)` (per mode), on the board copy and on the journey lake copy alike.
- The values live only in `LakesideSceneData.ts`:
  - `LAKESIDE_DIR_LIGHT_PARAMS.water*` (day / static)
  - `LAKESIDE_NIGHT_LIGHT_PARAMS.water*` (night)
  - `lakesideModeLighting(mode)` returns both.
- r4 adds these per-mode fields to `LakesideModeLighting`, and `applyLakesideWaterMode` now writes them:
  - `waterTintLinear`
  - `waterSkyReflectFloor`
  - `waterSkyZenithLinear`, `waterSkyLowLinear`, `waterSkyHorizonLinear`
- **Sky values for the sky sphere:** read `lakesideModeLighting(mode).waterSkyZenithLinear / waterSkyLowLinear / waterSkyHorizonLinear`.
  - They are linear. Use `lakesideCocosLightColor()` (×255) for a light/ambient Color, or `linearToSrgb8()` for an unlit or sRGB colour.
  - They are what the water reflects at reflection elevation ≥0.38 / 0.16 / ≤0.
  - Day horizon (0.204/0.297/0.003) is the reflected olive *shore*, so it is not a sky colour. For a sphere, use zenith/low.
- The clear colour is unchanged and still comes from `lakesideModeLighting(mode).clearColor`: day 28/143/184, night #1c2740.
- Fog colour and layered-fog changes reach the journey through the existing `lakesideModeLighting(mode).fogColorSrgb` and `LAKESIDE_LAYERED_FOG`.

## Exposure (3.8.8 source, Mac diag enums)
- aperture 19 = F16, shutter 7 = 1/125 s, iso 0 = ISO100, so EV100 = log2(16²·125) = 14.97.
- exposure = 0.833333 / 2^EV100 = 2.604e-5.
- Main light 87500 → 2.279. skyIllum 61250 → 1.595.
- HDR on, ToneMapping 0 = ACES (min 8, 2.51/0.03/2.43/0.59/0.14), then LinearToSRGB = sqrt, no post-process. The stand-in uses exactly this.

## Camera
运镜bot's background_camera_pose.json, 390x844 entry:
- pos (2.94478, 3.58, 31.16376)
- quat (-0.105171, 0.075737, 0.008033, 0.991533)
- fov 57.3526

It is identical to `lakesideAlignedBoardPose`, so there is no disagreement. 360x640 (no JSON entry) comes from the same code and is used for the Mac calibration.

## TASK A: new reference
`reference/` = `art/regions/lakeside/ENGINE_COLOR_REFERENCE/engine_cam_r5h3/`. It is a new subfolder; scene design's files are untouched. It holds:
- REFERENCE.md, targets.json, sample.py
- the poses
- graded and pre-grade renders at 390x844 and 360x640
- box overlays on the reference and on the Mac r3 shots

## Sand cause and fix
1. **Main cause:** Cocos 3.8.8 `Material._uploadProperty` squares any property tagged `linear: true` (SRGBToLinear). waterTint, skyZenith, skyLow and skyHorizon were tagged, so the linear values went in squared.
2. The low engine camera (y 3.58) sees reflection elevations of only 0.07-0.16 at the lake centre, with Fresnel mix 0.43-0.71. The centre therefore showed mostly the r5h3 *low/horizon* colours (beige 0.92/0.58/0.27, orange 1/0.55/0.14), and after squaring these became saturated orange-beige.
3. Peach layered fog added 12-26% on top.
4. It was not opacity (the shader is opaque), not a lakebed (single opaque plane), and not the floor.

Fix:
- Drop `linear: true`.
- Refit the reflection colours (horizon = reflected shore, low = blue, zenith = dusk lavender), the tint and the lights.
- Make the fog softer.

Night was orange-brown for the same reason: the day orange low/horizon were reused at night, ×0.12. Night now has its own dark blue-teal reflected sky, with sky reflection still on.

## Stand-in calibration (r3 values + squaring vs Mac r3, 360x640)
- Day: 0-3 per point, stripe 13.8 vs 14.4.
- Night: 0-3, except near_mid 9 and near_bottom 8; stripe 3.1 vs 6.1.
- Details are at the end of SAMPLE_TABLE.md.

## r4 stand-in vs bar
- Day 390x844: max |diff| 10 (bridge_left G), stripe 1.9.
- Day 360x640: max 9, stripe 2.3.
- All 10 points pass.
- Night: no reference. The lake is dark blue-teal everywhere (centre 11/32/54, near 13/48/78), stripe 1.0-1.1.

Tables: SAMPLE_TABLE.md / samples.json. Images:
- side_by_side_ref_vs_r4_day_390x844.png
- side_by_side_ref_vs_r4_day_360x640.png (ref | r4 | Mac r3)
- side_by_side_night_r4_vs_mac_r3_360x640.png
- renders/

## Final values (LakesideSceneData.ts)
**Day (LAKESIDE_DIR_LIGHT_PARAMS)**
- sunIlluminanceScale 0.95 (was 0.7)
- ambientSkyColorLinear 0.0107/0.0656/0.082
- ambientGroundColorLinear 0.97/0.533/0.296
- ambientSkyIllumToSun 0.236 (was 0.49)
- fogColorSrgb 231/165/125
- water:
  - waterTintLinear 0.714/0.858/1
  - waterMainLightScale 2.51
  - waterAmbientScale 2.87
  - waterSkyStrength 0.387
  - waterSkyReflectFloor 0.323
  - waterSkyZenithLinear 0.3/0.15/0.465
  - waterSkyLowLinear 0.173/0.221/0.481
  - waterSkyHorizonLinear 0.204/0.297/0.003
  - Fresnel/spec/wave unchanged

**LAKESIDE_LAYERED_FOG:** top 4.16 / range 74 / atten 59.2 (was 1.5/30/17)

**Night (LAKESIDE_NIGHT_LIGHT_PARAMS)**
- sunIlluminanceScale 1.173 and ambientSkyIllumToSun 0.643. These are re-derived to keep moon/sun 0.857 and ambient 0.219.
- water:
  - main 0.8
  - amb 1.0
  - skyStrength 0.6
  - floor 0.28
  - tint 0.7/0.95/1
  - zenith 0.011/0.02/0.051
  - low 0.014/0.045/0.065
  - horizon 0.018/0.06/0.068

The effect defaults equal the day values. One conversion is kept: `lakesideCocosLightColor`.

## Open / risks
- **Land regression (not in the bar):**
  - The refit lights that bring the water and bridge onto the reference also darken the land and make it browner. The reference land is lit by Blender's world and can't be matched with these global lights.
  - Day 360x640, Mac r3 → r4 stand-in: far hills 149/164/155 → 79/79/75, snow 155/170/160 → 106/91/82, grass 57/97/22 → 47/92/13. Clouds read orange-brown.
  - Night land is about half as bright as r3.
  - Giving the land a bluer or brighter ambient pushes the water/bridge out of the bar (grid in emulator/). This needs a Grok Bot decision.
- Device verification is still needed: these are emulator numbers.
- Pre-existing, GGbot/journey scope:
  - The journey model is yawed 180° but the sun is set in world space, so the sun relative to the lake is mirrored versus the board.
  - The journey `loadLakesideWaterAsset` catch sets the asset to null with no `[QF_LAKE]` log (silent fallback to the old look).
  - The water material variant compiles at journey show, a possible hitch.
- The superseded local branch `voice/build05-lakeside-r4-on-f492dc1` (my first port, on f492dc1) is still in the repo. I have not deleted it.
