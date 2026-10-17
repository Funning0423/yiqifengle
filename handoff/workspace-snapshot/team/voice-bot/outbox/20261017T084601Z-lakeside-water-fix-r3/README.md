# lakeside-water-fix-r3 (Voice Bot)

Branch `voice/build05-lakeside-water-fix-r3` on r3 **f3d3614**. Not pushed.

| commit | SHA | tree | content |
|---|---|---|---|
| D | 10a78208412ca31b0903c7865feccefe9136f4bd | 832770215b5e | gated one-time `[QF_LAKE_DIAG]` print (DEBUG or `?lakediag=1`) in LakesideBoardBackground applyDir, failures → console.error; test `lakeside-diag` added to run-suite |
| S | f492dc1898300f270bf7d55478efd2666737b1c2 | 6a837cc7b1c6 | lakeside-water.effect line 89: `albedo *= v_color.rgb;` (glTF COLOR_0 is linear; the old line decoded it a second time); water_fog test now asserts no `SRGBToLinear(v_color` |

**Supersedes 803b59c and a47c8fe** (branch voice/build05-lakeside-water-ref). D has the same content as a47c8fe. S contains the decode fix only. The refit (tint 0.507/0.981/1, main 1.28, amb 2.0, sky 0, floor 0.39) is **not** included. All water params are the f3d3614 values: main 1.37, amb 1.85, sky 0.35, floor 0.31, tint 0.9/1/1. The daynight and tint test expectations are unchanged from f3d3614.

## D applies alone
`git apply --check` and `git am` of patches/0001 on a clean f3d3614 give tree 832770215b5e, the same as D. See evidence/D-alone-check.txt.

## Suite
`QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript node tools/journey-integration/run-suite.cjs`
- At D: 70/75. Failures are the known 5 only (production-integrity, legacy-board-ui-pure, reward-background-return, cloud-web-contract, navigation-guard BLOCKED_BROWSER). lakeside-diag, water-fog and daynight pass. See suite-D.log.
- At S: same result, 70/75 with the known 5. See suite-S.log.

## Stand-in (Blender G-buffer emulator, one pass, no tuning; NOT a device measurement)
| point | graded target | f3d3614 | S (fix only) |
|---|---|---|---|
| far_water | 92/88/80 | 183/153/129 ✗ Δ90 | 183/161/144 ✗ Δ90 |
| mid_water | 77/120/125 | 161/141/128 ✗ Δ84 | 163/157/149 ✗ Δ86 |
| mid_water_R | 107/150/140 | 160/146/133 ✗ Δ53 | 165/162/153 ✗ Δ58 |
| under_bridge | 34/95/117 | 90/109/124 ✗ Δ55 | 96/136/149 ✗ Δ61 |
| near_mid_water | 34/116/129 | 77/113/127 ✗ Δ42 | 89/140/152 ✗ Δ54 |
| near_water_bottom | 55/148/147 | 56/152/145 ✓ Δ4 | 91/168/166 ✗ Δ35 |
| near_water_L | 67/151/146 | 59/153/146 ✓ Δ8 | 93/169/166 ✗ Δ25 |
| bridge_stone_deck | 138/129/95 | 159/141/118 ✗ Δ23 | 159/141/118 ✗ Δ23 |
| bridge_stone_left | 146/115/74 | 183/175/124 ✗ Δ60 | 183/175/124 ✗ Δ60 |
| bridge_rail_top | 88/134/133 | 129/148/142 ✗ Δ40 | 140/164/160 ✗ Δ51 |
| mid stripe std (≤10) | 7.7 | 5.0 | 4.2 |

Reading: with the fix alone, the vertex-colour albedo goes up roughly 2–4× at low R, so all the water gets lighter and less saturated. R rises the most, so the water looks redder and less cyan. Near water was inside the bar before (Δ4/Δ8) only because the params were fitted against the double-decoded albedo. With the fix alone it misses by Δ35/Δ25. Far and mid water miss either way, because of the layered fog (out of scope). Bridge stone does not change; the rail gets lighter. Fitting the water params after the fix is left for r4, using the Mac measurements (`[QF_LAKE_DIAG]` output).

Image: evidence/compare_water_fix_only.png (graded r5h3 | f3d3614 | S, stand-in labelled).

## Risks
- Shipping S without the r4 refit makes near water visibly lighter and washed out compared with the current build.
- The stand-in numbers come from an emulator, not from WeChat or the device.
