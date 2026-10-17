# Lakeside r4 prop fill: foliage, house walls, rocks, clouds (Voice Bot)

Branch `voice/build05-lakeside-r4-fill-props`, HEAD **32be13f677d5cca7b34aad2bccb0f0b6e029d358**. This is one commit on 467b36d (`voice/build05-lakeside-r4-landfill-5bb9e0d`, on GGbot 5bb9e0d).
- `patches/0001-*.patch`: `git format-patch 467b36d..32be13f`
- `lakeside-r4-propfill.bundle`: `467b36d..voice/build05-lakeside-r4-fill-props`. `git bundle verify` reports it okay.

## What changed
This commit adds four classes to the land-fill mechanism: a flat builtin-standard emissive (white × emissiveScale, linear, added before tone mapping). The two land classes from the previous delivery are unchanged.

**One source.** The GLB lists are in `LAKESIDE_DIR_LIGHT_PARAMS.{foliage,wall,rock,cloud}FillGlbs`. Each class has its own per-mode value in `lakesideModeLighting(mode).{foliage,wall,rock,cloud}FillLinear`:

| class | GLBs | day | night |
|---|---|---|---|
| foliage | LK_tree_conifer, LK_tree_round, LK_bush | 0.019/0.065/0 | 0.0006/0.0058/0.0029 |
| wall | LK_house_A, LK_house_B, LK_house_C | 0.023/0.020/0.017 | 0.0085/0.013/0.0232 |
| rock | LK_rock | 0.079/0.079/0.079 | 0.0049/0.0116/0.0356 |
| cloud | LK_cloud | 0.33/0.24/0.218 | 0.0078/0.0091/0.0145 |

**Reading the values.** `lakesideLandFillClass(glb)` returns near / far / foliage / wall / rock / cloud, or null. `lakesideFillLinear(mode, cls)` in LakesideSceneData.ts is the only map from class to value. The board writer (`writeLakesideLandFill`) and the journey listener both go through `applyLakesideLandFill`, so they read the same value.

**Never filled:** water (`waterGlbs`), bridge (`LK_bridge`, `LK_bridge_steps`), shore foam, small props (posts, lanterns, boats, barrels, chimes), reeds, flowers and grass cards. Every coefficient is ≥ 0; there is no negative emissive.

**Rocks.** LK_rock has 0 visible pixels in both board poses, so it cannot be fitted to the reference. It gets a neutral fill of the far-land luminance by day and the far-land night value (cool) at night.

**House-wall sample.** The old `house_wall` box was mostly trees, the chime post and porch steps, so its median was not a wall colour; that is where the -48 came from. The new sampler is the median of the house pixels inside that box; trees and clouds are sampled the same way. Measured this way, the wall in the previous delivery was already 170/125/79 against a target of 174/134/91, which is why the wall fill is small. The old plain-box numbers are still listed for continuity: -40/+32/+26, worse than before, because brighter trees now sit inside that box.

## Numbers (fresh stand-in renders: Mac-calibrated HDR+ACES emulator; full table in SAMPLE_TABLE.md / samples.json)
Day, error against the engine-cam r5h3 reference (bar ±12):

| class | 390x844 | 360x640 | before (390x844) |
|---|---|---|---|
| tree | -1/-2/+9 | +0/-1/+11 | -19/-43/+9 |
| house wall | +1/-1/-1 | +1/+0/+0 | |
| cloud | +3/+1/+0 | -3/-1/+0 | |

- Cloud: now 202/173/157, warm-leaning white. Reference 199/172/157 (390x844) and 205/174/157 (360x640); before 134/76/42, orange-brown.
- Grass, far hills and snow are unchanged from 467b36d.
- All 10 water and bridge points and the stripe std (1.9 / 2.3) are identical to the previous delivery. Max pixel |difference| on water, foam and bridge pixels is 0 (both poses, day and night).

Night 360x640 vs Mac r3 night:

| class | luma ratio | hue | colour |
|---|---|---|---|
| tree | 0.78 | 152° | 4/17/11 |
| house wall | 0.79 | 222° | 24/33/54 |
| cloud | 0.80 | 231° | 21/23/34 |

Red is the lowest channel in all three, so none is brown. The lake is unchanged (blue-teal).

## Draw calls (lakeside board, batching + static merge on)
This is the static-merge test's model, using the real bundle with the fill class added to the merge key (a filled copy has different props, so it is its own group). See `dc_estimate.cjs` and `dc_estimate.txt`.

| | merged chunks | instanced kinds | water | background | total (+43 board/UI) |
|---|---|---|---|---|---|
| before (467b36d) | 3 | 2 | 1 | 6 | **49** |
| after | 7 | 2 | 1 | 10 | **53** |

`lakeside-land-fill` now asserts this total is ≤ 60. It is a model, not an engine counter; confirm on a device or Mac with the profiler.

## Tests
`tools/lakeside/test_lakeside_land_fill.cjs` is extended. It locks:
- the per-mode values and the single source
- the class of every bundle GLB
- in the behavioural run with the real transpiled functions: the filled copies carry their class value, while water, bridge and bridge steps stay plain, and the night writer touches exactly the 6 fill materials
- night cool (red lowest) and dimmer than day; no negative values
- total draws ≤ 60

`test_lakeside_instancing.cjs` only had its type-stripping regex extended.

## Suite
`suite.log`: 87 total, 82 pass. Only the known 5 fail: production-integrity, legacy-board-ui-pure, reward-background-return, cloud-web-contract, navigation-guard BLOCKED_BROWSER.

## Open
- The flat fill brightens each whole GLB, so roofs, door trim and tree trunks get the same addition as the sampled wall or crown. Pavilion, reeds, flowers and small props are not filled.
- Rock is unmeasured (not visible).
- The draw-call count is a model; confirm it with the engine profiler.
- The journey applies the full fill regardless of the atmosphere weight, as before.
