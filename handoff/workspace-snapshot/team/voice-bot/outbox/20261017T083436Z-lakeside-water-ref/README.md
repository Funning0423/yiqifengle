# Voice Bot — lakeside water-ref CANDIDATE (not for r3 unless Grok Bot approves), on r3 f3d3614

Branch `voice/build05-lakeside-water-ref`: 2 commits on **f3d3614** (r3 HEAD). Author Voice Bot. Nothing pushed; mainline untouched.
- HEAD `a47c8fe672777cea88343b94a941ed19d71e8f6b`, tree `72d38cd73ef101efec92c53f70555fa56e373d8a`
- `803b59c`: v_color double-decode fix plus a water refit to the r5h3 **graded** targets.
- `a47c8fe`: a one-time `[QF_LAKE_DIAG]` print, gated by `DEBUG && ?lakediag=1`, with the test `lakeside-diag`.
- Bundle `voice-build05-lakeside-water-ref.bundle` (prerequisite f3d3614, verified), or `git am 000*.patch` on f3d3614.

## (b) The double decode is real for this data
- `lakeside-water.effect` line 89 `albedo *= SRGBToLinear(v_color.rgb)`. Cocos 3.8.8's `SRGBToLinear` is `x*x`.
- LK_lake.glb COLOR_0 is UNSIGNED_BYTE normalized and **linear**, which is what the glTF spec requires and what Blender writes:
  shallow #7FE0CF = 0.212/0.745/0.624, deep 0.012/0.275/0.365.
- Cocos maps COLOR_0 to `a_color` unchanged. The 3.8 glTF docs list only the attribute rename, and the water VS passes it through
  (`v_color = a_color`). Our Mac-calibrated emulator reproduces the real Mac v3.2 near water (64/218/216) only with exactly
  one `x²` on the vertex colour, which is the shader's.
- So the shallow R goes 0.212 → 0.045. This is the "R in single digits, pure cyan" effect.
- Note: Cocos builtin-standard also runs `SRGBToLinear` on vertex colours. That is Cocos' convention, so "the standard shader does not do this" is
  not accurate. For the palette meshes those vertex colours are grey AO, a mild darkening (0.93 → 0.86), and I left them alone here.

## Commit 1: fix + refit (graded targets; global lights and fog untouched)
- `albedo *= v_color.rgb`.
- waterTint 0.9/1/1 → **0.507/0.981/1.0**. With linear vertex colours, the graded saturation (×1.35) needs a saturating tint;
  a 1/1/1 tint fails near water by about 26.
- main 1.37 → 1.28, ambient 1.85 → 2.0.
- sky strength 0.35 → **0** (the fit drops the sky-ramp reflection; night 0.12 → 0 to match).
- floor 0.31 → 0.39 (with sky 0 this is a 39% darkening mix).
- The params and the effect defaults are updated together. The water fallback mainColor becomes 129/250/255.
- Commit "2" from the brief, skyHorizon/skyLow per scene design (c), was **not committed**. In the first fit it moved
  mid/far by ≤5 and made near water worse (63/125/131, Δ23). With sky strength 0 it has no effect at all.

## Stand-in table (emulator, not Creator; sample.py boxes at 720×1280; target = r5h3 GRADED, median over 24 frames of the 8 s graded clip)
| point | graded target | a6f39ed / f3d3614 | candidate a47c8fe |
|---|---|---|---|
| far_water | 92/88/80 | 183/153/129 ✗ Δ90 | 155/135/129 ✗ Δ62 |
| mid_water | 77/120/125 | 161/141/128 ✗ Δ84 | 137/133/130 ✗ Δ60 |
| mid_water_R | 107/150/140 | 160/146/133 ✗ Δ53 | 138/140/135 ✗ Δ31 |
| under_bridge | 34/95/117 | 90/109/124 ✗ Δ55 | 92/113/117 ✗ Δ57 |
| near_mid_water | 34/116/129 | 77/113/127 ✗ Δ42 | 81/117/119 ✗ Δ46 |
| near_water_bottom | 55/148/147 | 56/152/145 ✓ Δ4 | 67/147/137 ✓ Δ11 |
| near_water_L | 67/151/146 | 59/153/146 ✓ Δ8 | 70/148/138 ✓ Δ8 |
| bridge_stone_deck | 138/129/95 | 159/141/118 ✗ Δ23 | unchanged ✗ |
| bridge_stone_left | 146/115/74 | 183/175/124 ✗ Δ60 | unchanged ✗ |
| bridge_rail_top | 88/134/133 | 129/148/142 ✗ Δ40 | 124/146/138 ✗ Δ35 |
| mid stripe std (≤10) | 7.7 | 5.0 ✓ | 4.0 ✓ |

The pass bar is **not met** (within 12 per channel at every point). Why:
- **far / mid:** the layered fog (color 215/170/150) lifts the water. That isn't fixable inside the water shader, and fog is out of scope.
- **under-bridge / near-mid:** need R ≈ 34, but in the stand-in R stays about 80–90 from the ambient and fog terms.
- **bridge points:** global lights only, untouched.
- I assumed a6f39ed and f3d3614 render the same in these boxes: r3's extra commits (clear colour, journey merge, hook) touch no shading.
- Image: `evidence/compare_water_ref.png` (stand-in labelled).

## Commit 2: diagnostic
`[QF_LAKE_DIAG]` is printed once, at the first board light apply, only when cc/env `DEBUG` is true AND the URL has `?lakediag=1`. DEBUG is false in
release builds, so release never runs or prints it. Fields: isHDR, toneMappingType (pipelineSceneData.postSettings), pipeline,
usePostProcess, render-camera exposure, aperture/shutter/iso, main-light illuminance, skyIllum, and a `missing` list of undefined
fields. Failures go to `console.error`. The test `lakeside-diag` locks the gate.

## Suite
**70/75**, only the known 5 (production-integrity, legacy-board-ui-pure, reward-background-return, cloud-web-contract FAIL; navigation-guard BLOCKED_BROWSER). lakeside-diag, water-fog, daynight, olive, light-encoding, pavilion, es5-iterator-spread and all lakeside tests PASS. Log: `suite.log`.

## Risks
1. Stand-in only. The emulator itself assumes HDR + ACES and a default exposure; the diag print is there to confirm that on Mac.
2. Sky strength 0 removes the reflection ramp, so the water is diffuse plus the sun streak. Grazing-angle reflection is gone, and night water reflects nothing.
3. The saturating tint (R 0.507) bakes the graded saturation into the scene. If post (LUT + saturation) is ever enabled, the water will be double-saturated.
4. Gains are modest: near water passes, mid improves 84 → 60, but 6 of the 10 points still fail. The rest needs fog/global-light changes, which are not mine to make.
5. The palette meshes' vertex-colour decode (builtin-standard) is untouched.
