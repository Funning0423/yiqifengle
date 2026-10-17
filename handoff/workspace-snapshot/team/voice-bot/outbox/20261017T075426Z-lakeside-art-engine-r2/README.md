# Voice Bot — lakeside art/engine r2 (one colour conversion + brightness/warm fill), on GGbot r2 228df2f

Branch `voice/build05-lakeside-art-engine-r2`, 5 commits on **228df2f** (GGbot r2, integration/build05-next-20261017T0725Z).
Nothing pushed, no force push, mainline untouched. Author Voice Bot.

- HEAD `c60ac55acb028e7cdf4ca519385fbd2db75137e3`, tree `3941d025e1ddbe96fec1c0988fce0a944156459a`
- Bundle `voice-build05-lakeside-art-engine-r2.bundle` (prerequisite 228df2f, `git bundle verify` OK) or `git am patches/*.patch` on 228df2f.

| # | commit | what |
|---|---|---|
| 1 | 7176c56 | (= 55bc6bc) bridge whiteness: lights really linear, sun 0.5, ambient 0.2 |
| 2 | a90b2cf | (= 751951f) v3.4 near-water refit |
| 3 | 78b23c5 | (= 48e71ba) pavilion finding + guard test `lakeside-pavilion` (nothing restored, no ghosts) |
| 4 | de093cd | **one conversion** on every light path (board, journey end, day + night), water fallback, night ratios, test `lakeside-light-encoding` |
| 5 | c60ac55 | **brightness**: sun 0.7 + warm hemisphere-ambient fill (0 lights, 0 DC), water refit, night ratios follow |

Cherry-picks 1–3 applied cleanly (auto-merge in LakesideSceneData.ts and run-suite.cjs, no conflicts). GGbot's day/night,
journey and restore control flow is unchanged; only colour-conversion calls and data values moved.
run-suite.cjs: one line only (the pavilion + light-encoding entries appended to the existing static-merge line) to ease
stacking with 运镜bot's 26be951. Journey mount code (prepareLakesideJourney) not touched (GGbot's 55d1922 can stack).

## Encoding-path finding (228df2f)
Cocos 3.8.8 reads `DirectionalLight.color`, `Ambient.skyLightingColor/groundLightingColor` and the legacy-standard albedo
uniform (`mainColor`: `baseColor = albedo`, no SRGBToLinear; `linear: true` is only an editor flag) as **Color bytes/255 = linear**.
Only fog colour is linearised by the engine; the camera clear colour is sRGB.

228df2f converted with `linearToSrgb8(param)` at the call sites:
- `LakesideBoardBackground.applyDir` (line 138): main light + ambient sky/ground, day and night via `lakesideModeLighting(mode)`;
- `LakesideJourneyAtmosphere.lakesideAtmosphereTarget` (line 37): journey end values; the day/night toggle mid-journey goes through it;
- `LakesideBoardBackground` line 181: **water FALLBACK mainColor** (only if lakeside-water.mtl fails to load).
- line 200 (clear colour) and fog: sRGB by design, **left as is**.

With v3.4 on top, the day params were pre-encoded, so day was converted once, but **night was not**. The night colours went
in sRGB-as-linear, so they came out too bright and pale (moon 0.635/0.710/0.898 instead of 0.36/0.46/0.78; sky ambient
0.114/0.188/0.333 instead of 0.012/0.030/0.090; ground 0.153/0.161/0.220 instead of 0.020/0.022/0.040). The journey night
targets had the same problem. The water fallback came out 0.953/1/1 instead of 0.9/1/1.

Fix (commit 4): `lakesideCocosLightColor(lin)` is now THE conversion, `round(clamp(lin)×255)`. All `*ColorLinear` params
(day and night) are authored linear and are not pre-encoded. The board applyDir, the journey targets and the water fallback
call it **once**, with no `linearToSrgb8` stacked on top. The `waterTint`/sky Vec4 uniforms of lakeside-water are raw linear
floats, which is already one conversion. Journey end (w=1) now equals the board bytes in both modes, so there is no jump on
board entry or on a day/night switch. Locked by `lakeside-light-encoding`: byte contract, params within 0..1, journey end ==
board bytes in day and night, no linearToSrgb8 or stacked conversion on the light call sites, clear/fog stay sRGB, and the
night balance.

Night balance: GGbot's night hues were kept as authored. The illuminance ratios were re-derived so night/day keeps r2's
per-term luminance balance (moon/sun 0.857, hemisphere ambient night/day 0.219) against the current day:

| night param | 228df2f | commit 4 (day sun .5/amb .2) | commit 5 (day sun .7/amb .49) |
|---|---|---|---|
| sunIlluminanceScale | 1.0 | 0.617 | **0.864** |
| ambientSkyIllumToSun | 0.6 | 0.694 | **1.76** |
| effective moon colour (linear) | 0.635/0.710/0.898 | 0.36/0.46/0.78 | 0.36/0.46/0.78 |
| night water main/amb/sky | 0.8/0.6/0.12 | unchanged | unchanged |

Night emulator medians, 228df2f → after: near water 11/73/81 → 9/57/84; bridge deck 76/87/99 → 37/53/83;
grass_L 39/103/43 → 21/66/38; roof 43/24/12 → 25/14/10. The new night is bluer and about as much darker as the day became
darker than v3.2. These are proxy values; the Mac night screenshot decides. `evidence/compare_night_before_after.png`.

## Brightness (commit 5): Grok Bot review "too dark, lost the warm sunset"
This uses zero extra lights and zero draw calls. Materials, vertex colours and fog are untouched.
- sun 0.5 → **0.7** of base illuminance (low end of the requested 0.7–0.8; see the grass note);
- **warm hemisphere ambient fill**, ambient 0.2 → **0.49** of base:
  - sky 0.0107/0.0656/0.1106 (r5h3 zenith 0.0116/0.2747/0.4793, dimmed and less blue);
  - ground 1/0.841/0.0687 (r5h3 1/0.5457/0.1441, warmer).
  Up faces get the dim sky; the camera-facing backlit trees and roofs get about half warm ground.
- water refit for the near-water target: main 1.67 → 1.37, ambient 1.27 → 1.85, sky 0.8 → 0.35, floor 0.30 → 0.31
  (params plus effect lightParams/specParams defaults; fresnelParams default untouched).

Stand-in renderer: the previous evidence scripts still work on this base. It is the Blender G-buffer emulator of the Cocos
shading, calibrated on Mac v3.2, **not Creator**. Board camera, layered fog. Medians:

| region | r5h3 | Mac v3.2 (real) | emu v3.4 48e71ba | **emu r2 c60ac55** | luma vs r5h3 |
|---|---|---|---|---|---|
| near_water_L | 66/152/146 | 64/218/216 | 58/152/148 | **59/153/146** | 0.99 ✓ |
| bridge_deck | 104/128/116 | 179/217/214 | 119/142/140 | **121/141/117** | 1.11 (≈) |
| grass_L | 81/107/24 | 156/225/136 | 99/138/64 | **109/134/59** | 1.29 ✗ |
| far_trees | 71/83/20 | 73/177/98 | 17/53/22 | **31/95/16** | 1.00 ✓ (not darker) |
| roof (left) | 131/37/2 | 190/140/57 | 75/34/15 | **135/44/10** | 1.12 (≈, not darker) |
| bridge_side | 108/110/88 | 189/220/213 | 117/120/92 | 140/126/70 | 1.16 |
| near_water_R | 39/118/127 | 81/170/193 | 80/112/127 | 81/114/127 | 1.06 |
| mid_water | 92/139/138 | 195/191/182 | 157/144/132 | 159/145/131 | 1.14 |

`evidence/compare_r5h3_mac_v34_r2.png`.

**Not all five are within ±10%.** The emulator says these knobs alone cannot get there:
- **grass_L** is lit by the sun (N up, N·L 0.40). It was already +27% luma at sun 0.5 and is +29% at 0.7.
- **far_trees** reach the luma, but the hue stays green (R 31 vs 71). That region is mostly LK_far_hills
  (linear albedo 0.06/0.33/0.09). A light-only change cannot turn it olive without pushing every other region far off.

Optimiser trade-off with every global knob free (sun, ambient level, sky and ground colour; evidence/opt_*.json):

| | bridge | grass | trees | roof |
|---|---|---|---|---|
| sun 0.34 / ambient 1.53× sun | 0.93 | 1.12 | 0.97 | 1.11 |
| sun 0.5 | 1.03 | 1.20 | 0.98 | 1.10 |
| sun 0.7 (shipped) | 1.11 | 1.29 | 1.00 | 1.12 |

Under the rule "trees/roof not darker", nothing reaches ±10% on grass. The zero-DC ways to close the rest are asset
recolours, which need art sign-off: the LK_far_hills / terrain palette cells or vertex colours. Fill lights are excluded
because they cost passes. r5h3's olive and its fill suns are probably also part of its grade (T_LK_grade_lut_32 is not used
in game; post-processing would add a pass).

## Pavilion
Kept as is: nothing restored, no ghosts. The guard test `lakeside-pavilion` passes (431 instances, 1 real placement, 0 templates).

## Draw calls / package
No lights, materials or meshes added, so DC is unchanged from c2eaf64: background ~4, total ~47 (`lakeside-static-merge` passes).
Package: TS/test text only, plus 2 numbers in the effect. Under 2 KB of source.

## Suite
`QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript node tools/journey-integration/run-suite.cjs`: **66/71**, only the known 5 (production-integrity, legacy-board-ui-pure, reward-background-return, cloud-web-contract FAIL; navigation-guard BLOCKED_BROWSER). lakeside-daynight, lakeside-pavilion, lakeside-light-encoding and all other lakeside tests PASS. Log: `suite.log`.

## Risks / Mac must check
1. All colour numbers come from the emulator (gamma-2 chunks, ACES, byte-as-linear lights, no IBL). The Mac day and night
   pixels in the same regions decide.
2. The warm fill shifts ground-facing and side faces warmer. Bridge sides and rails read yellow-ish (140/126/70 vs
   108/110/88), and the far hills look yellow-green. Funning judges the look.
3. Grass is +29% at sun 0.7. If Funning prefers the r5h3 grass, sun 0.5 is a one-number change (grass 1.20, bridge 1.03).
4. Night is darker and bluer than 228df2f showed (that version was bright from the double sRGB). The night water factors
   (0.8/0.6/0.12) were kept as GGbot's.
5. The day toggle sets clear colour `LAKESIDE_CLEAR_COLOR` #f2b98a (lakesideModeLighting day), while the board init uses
   `clearColorLinear` (28/143/184). This is a pre-existing r2 difference that I left alone (line 200/clear is out of scope);
   GGbot should confirm.
6. The journey blend mixes island bytes with target bytes. Both are Cocos-linear bytes, so the mix is consistent.
