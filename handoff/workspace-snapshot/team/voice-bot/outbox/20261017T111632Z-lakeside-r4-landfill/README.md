# Lakeside r4 land fill (Voice Bot)

Branch `voice/build05-lakeside-r4`, HEAD **c7141d6f1d7823e0e999f0ddd72784610a31a488**. Base: GGbot `ggbot/build05-r4-journey-fixes` 939049ceb815434fbb65c4dfdc187d8266d08a24 (on 9581c23).

| commit | what |
|---|---|
| de2e195 | flat emissive fill on the landform GLBs only, per mode from lakesideModeLighting (board + journey) |
| 9cbef12 | test tools/lakeside/test_lakeside_land_fill.cjs (registered in run-suite as lakeside-land-fill) |
| c7141d6 | fixups after the rebase on 939049c (es5-iterator-spread / journey-water-prewarm test regexes accept the new code) + `skyDomeColorSrgb` |

- `patches/`: `git format-patch 939049c..c7141d6`. 3 patches. `git am` on 939049c gives a tree identical to c7141d6.
- `lakeside-r4-landfill.bundle`: `939049c..voice/build05-lakeside-r4` (prerequisite 939049c). `git bundle verify` reports it okay.
- Global lights are exactly as in r4: sun, ambient, illuminance, exposure and clear colour are unchanged. The night ratios stay at moon/sun 0.857 and ambient 0.219.

## Which materials get the fill (rule)
Land is the walkable or visible **ground surface** of the scene. It does not include objects standing on the ground.
- **near** = `LK_terrain.glb` (ground, grass)
- **far** = `LK_far_hills.glb`, `LK_far_shore.glb` (far hills, mountains, snow caps, far shore)
- **not land, never filled:** water (`waterGlbs`), bridge (`LK_bridge`, `LK_bridge_steps`), buildings, props, vegetation (trees, bushes, reeds, flowers), rocks, clouds.

Both lists live in `LAKESIDE_DIR_LIGHT_PARAMS.landFillNearGlbs` / `landFillFarGlbs`. `lakesideLandFillClass(glb)` decides the class and returns 'near', 'far' or null. Every GLB in the bundle is classified, and the test locks the list against the bundle's GLBs.

## Mechanism (single source)
- The values are in `lakesideModeLighting(mode).landFillNearLinear` / `.landFillFarLinear`, which are linear emissiveScale values.
  - day (from `LAKESIDE_DIR_LIGHT_PARAMS`): near 0.104/0.196/0.025; far 0.043/0.087/0.107
  - night (`LAKESIDE_NIGHT_LIGHT_PARAMS`): near 0/0/0.0014; far 0.0049/0.0116/0.0356
- `enableLakesideInstancing` gives land renderers their own material copy, so water, bridge and others keep their plain copy.
  - All the GLBs share the one palette material M_LK_palette. That is why land needs separate copies.
  - `initLakesideLandFill` sets `emissive` to white. If the effect has no emissive handles, it logs `[QF_LAKE] {"event":"land-fill-unsupported",...}`; there is no silent fallback.
  - `writeLakesideLandFill` is the only `emissiveScale` writer.
- Day/night switching:
  - board: `applyDir` → `applyLakesideLandFill(scenery, mode)`
  - journey: `RegionJourneyAdapter` `offLand = onDayNightChange(...)`, released together with offWater.
- Emissive is added after lighting and before tonemapping, so the sun/ambient lighting of every other material does not change.
- The water path (`applyLakesideWaterMode`) and the bridge never reach the fill writer. The test checks this on a stand-in scene with the real transpiled functions: land copies get the day fill; water, bridge and other materials stay plain with props {}; the night writer touches only the 2 land materials.

## skyDomeColorSrgb (new, documented, not wired)
`lakesideModeLighting(mode).skyDomeColorSrgb` is the colour of the visible sky dome / backdrop. It equals the board clear colour:
- day: `lakesideDayClearColor()`
- night: `LAKESIDE_NIGHT_LIGHT_PARAMS.clearColor` (#1c2740)

It is derived from the clear colour and never written as a second literal; the test locks both points. `waterSkyZenith/Low/HorizonLinear` are the water's *reflected* sky inputs, pre-compensated for the water tint. Their mean comes out lavender, so they are not sky colours. GGbot's sky-sphere code (939049c) is **not** changed here; switching it to this value is his call.

## Sun
The stand-in uses sunForward [-0.4182,-0.3983,0.8164]. That equals `lakesideSunForward(LAKESIDE_BOARD_YAW_DEG=0)` from `LakesideSunDirection.ts`, the board frame. The fill is a flat emissive and does not read the sun direction.

## Numbers (stand-in, Mac-calibrated emulator; see SAMPLE_TABLE.md / samples.json)
Day, target = engine-cam r5h3, bar ±12:

| point | 390x844 | 360x640 |
|---|---|---|
| grass_near | 116/168/38, error 0/0/0 | (same) |
| far_hills | 106/127/133, error +10/+6/+4 | error +10/+7/+4 |
| mtn_snow | 127/135/138, error -12/-7/-4 | (same) |

- All 10 water/bridge points are identical to r4 (max |diff| on water and bridge pixels = 0). Worst: 390x844 bridge_left G -10; 360x640 deck R +9.
- Stripe std 1.9 / 2.3.

Night 360x640 vs Mac r3 night land (target about 80%, cool hue):

| point | r4+fill | Mac r3 | luma ratio | hue |
|---|---|---|---|---|
| grass | 11/40/14 | 13/47/17 | 0.85 | 126° |
| far_hills | 13/26/66 | 16/31/79 | 0.84 | 225° |
| snow | 16/30/73 | 20/39/94 | 0.77 | 225° |

R is the lowest channel at all three points, so none is brown. The lake stays blue-teal, hue 207-212° (mid 11/32/54).

## Verification
- Full suite (`suite.log`) on c7141d6: 87 total, 82 pass. Only the known 5 fail: production-integrity, legacy-board-ui-pure, reward-background-return, cloud-web-contract, navigation-guard BLOCKED_BROWSER.
- Stack on a8ba19a: `cherry-pick f3d3614..c7141d6` (22 commits) onto a8ba19a applies cleanly. All 32 lakeside, es5 and lakeside-journey tests pass. a8ba19a is a sibling of f3d3614, not an ancestor.

## Open
- Trees (-19/-43/+9) and the house wall (-48/-5/+25) are still dark. They are not land under the rule, so they are out of scope here. Clouds are still orange-brown.
- Land has its own merge chunks / instanced batches (about +2 draw calls). The land copies carry emissive (an extra variant/props).
- The journey applies the full fill whatever the atmosphere blend weight is.
- Stand-in numbers only; check on a device. Debug print: `?lakediag=1` (DEBUG builds).
