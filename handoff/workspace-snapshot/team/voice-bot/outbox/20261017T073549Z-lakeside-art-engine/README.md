# Voice Bot — lakeside art/engine (bridge whiteness, near water, pavilion, DC check)

Branch `voice/build05-lakeside-art-engine`, 3 commits on **c2eaf64** (= be1cd5a + 51aaa85 + c2eaf64, GGbot's
`…-optional-water-dc` tip; GGbot's r2 was not in his outbox when this was cut). Nothing pushed; mainline untouched.

- HEAD `48e71ba7fecd1dc329f96fbfb5504060045b8506`, tree `8b2954bba3e5769612063601b273386a710d6e57`
- Base `c2eaf64a3f9b1fa868051776e5150b8ebac0d494` (bundle prerequisite)

| commit | what |
|---|---|
| 55bc6bc | bridge whiteness: light/ambient colours really linear (data only in LakesideSceneData), sun 0.5, ambient 0.2 |
| 751951f | near water: 51aaa85 water scales refit under the new lights (main 1.67, amb 1.27, sky 0.8, floor 0.30) |
| 48e71ba | pavilion finding + guard test `lakeside-pavilion` (nothing restored, no ghosts) |

Apply: `git fetch voice-build05-lakeside-art-engine.bundle voice/build05-lakeside-art-engine` or `git am patches/*.patch` on c2eaf64.

## Bridge whiteness: cause
Cocos 3.8.8 uses DirectionalLight colour and Ambient sky/ground `Color` bytes/255 **as linear** (only the fog colour gets
linearised). The lease sent `linearToSrgb8(r5h3 linear)`. So sky ambient was 0.110/0.565/0.718 instead of 0.0116/0.2747/0.4793 (about 2× and
cyan), sun 1/0.796/0.604 instead of 1/0.6/0.32, and ambient w was 0.75× sun. ACES then pushed the pale stone bridge to cyan-white.
The same cause gives the lime grass. Fix: `lakesideCocosLightColor()` pre-encodes the params, so `linearToSrgb8(param)` = linear×255.
The call sites (applyDir, journey atmosphere, day/night) are **not edited**. GGbot's r2 owns those. **If r2 changes the conversion at
the call site, drop the pre-encoding here (double fix = too dark).**

## Numbers: Blender G-buffer emulator of the Cocos shading, NOT Creator
The emulator was calibrated on the Mac v3.2 frame (bridge 173/216/218 vs Mac 179/217/214, near water 68/223/223 vs 64/218/216).
All images use the same handoff camera (0, 13.2, 26.5), q(-0.22109, 0, 0, 0.97525), vFOV 61.928 at 720×1280. Medians, sRGB:

| region | r5h3 | Mac v3.2 (real) | emu c2eaf64 | emu after |
|---|---|---|---|---|
| near_water_L | 66/152/146 | 64/218/216 | 60/187/181 | 58/152/148 |
| near_water_R | 39/118/127 | 81/170/193 | 82/140/157 | 80/112/127 |
| mid_water | 92/139/138 | 195/191/182 | 169/165/154 | 157/144/132 |
| bridge_deck | 104/128/116 | 179/217/214 | 173/216/213 | 119/142/140 |
| bridge_side | 108/110/88 | 189/220/213 | 188/220/212 | 117/120/92 |
| bridge_rail | 107/132/133 | 206/212/204 | 133/172/169 | 128/144/142 |
| grass_L | 81/107/24 | 156/225/136 | 138/225/129 | 99/138/64 |
| far_trees | 71/83/20 | 73/177/98 | 53/177/90 | 17/53/22 |
| roof (left house) | 131/37/2 | 190/140/57 | 188/140/57 | 75/34/15 |

Mid-lake stripe band: the emulator's temporal std (8 frames, 0–14 s) is 0.00 for both c2eaf64 and after. 51aaa85's wave fade
12–35 m and noise 0 already remove it.
Image: `evidence/compare_r5h3_mac_before_after.png`.

## Pavilion
The "pavilion on the bridge" before 0932b6b was the ASSETS template `LK_pavilion` at the origin. That spot is the bridge centre. The template
is hide_render in the .blend and is never in the r5h3 render. 0932b6b filtered it; 0cbce91 stopped exporting it.
The only real placement is `LK_pavilion_i` at (13.6, 0.55, -4.6) on the right shore. It is kept (431 runtime instances). It sits
just outside the r5h3 board camera (min NDC x 1.029, so u 1.015) and outside every aligned in-game board camera (390×844 etc., min u ≈1.30),
exactly as the r5h3 frame shows. **Nothing was restored.** Restoring it on the bridge would re-add the ghost.

## Draw calls (c2eaf64, verified independently from the GLB headers + transforms)
Counting method: one draw per visible mesh × material group after instancing/merge. Shadows are off, there is no shadow pass, and post is off.
Runtime 431 = 411 palette pieces (35 GLBs, COLOR_0+N+P+UV, 57,010 v → 1 merged chunk ≤65,535)
+ 18 `rope_float` (N+P, 1,080 v → 1 chunk) + 1 `float_rope_soft` (no COLOR_0, 1 draw) + 1 lake (water material, 1 draw).
Background = **4** (was 36), well under 15. Total = 4 + board/UI ~43 = **~47** (was 79), under 60. Asserted by `lakeside-static-merge` (bg ≤8, total ≤55).
These commits add no draws.

## Package size
No assets added. The effect is the same size (5,838 B). LakesideSceneData.ts source is +2,403 B (mostly comments).
Compiled JS is about +619 B (comments stripped, not minified), so the package grows by **≤ ~0.6 KB**.

## Suite
`QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript node tools/journey-integration/run-suite.cjs`: **64/69**. Only the 5 known
failures: production-integrity, legacy-board-ui-pure, reward-background-return, cloud-web-contract FAIL, navigation-guard BLOCKED.
Log: `evidence/suite.log`.

## Mac must measure (cannot be done on the box)
FPS (M4 Chromium + device), real DC (bg/total, with `?lakemerge=off` A/B), and the near-water / bridge / grass / far-trees / roof pixels in the same
regions. Also: lakeside-water.effect compile, journey DC/memory (界面验收部), and the lakeside↔journey light hand-off with GGbot's r2.

## Risks
1. Overlap with GGbot's r2 light work (see above).
2. Far trees and the left house roof come out darker than r5h3. They are backlit, and r5h3 had fill suns that the lease drops. A device check is needed; a per-region fill or a slightly higher ambient is the knob.
3. Near water R is about 8 low. Mid-lake and near_R are warmer and brighter than r5h3 because of the layered fog (a product decision; fog untouched).
4. Every colour number comes from the emulator: gamma-2 Cocos chunks, ACES, byte-as-linear lights, no IBL.
