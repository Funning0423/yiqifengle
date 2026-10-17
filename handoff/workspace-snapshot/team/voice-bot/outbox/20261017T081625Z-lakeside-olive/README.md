# Voice Bot — lakeside olive recolour (r5h3 alignment), on f7f892f

This is branch `voice/build05-lakeside-olive`: **one commit** on f7f892f, so it can stack after r3. Author Voice Bot. Nothing pushed; mainline untouched.
- HEAD `a6f39edba9cebca9eb735d154107d817f229b661`, tree `ef7abc1a659670099510a0b363e8b799e4079bd7`
- Apply with `git fetch voice-build05-lakeside-olive.bundle voice/build05-lakeside-olive` (prerequisite f7f892f, verified),
  or `git am 0001-*.patch` on f7f892f.

## Why the palette path, not vertex colours
COLOR_0 only **multiplies** the palette albedo. The far hills' palette red is tiny: linear 0.06, with vc 0.82. Reaching r5h3's olive
needs about 6× more linear red, and a vertex colour can give at most 1.2×. So these meshes get **their own palette cells**.
Grass tufts, bushes, trees and every other asset keep the shared cells.

## What changed
| asset | change | bytes (raw) |
|---|---|---|
| `T_LK_palette_256.png` | 6 new cells in row 10, which was all black and sampled by no GLB. Shared cells unchanged. Still RGB, with the sRGB/gAMA/cHRM/eXIf/oFFs/pHYs chunks kept; only the IDAT was re-encoded. | 1,803 → **1,007** (−796) |
| `LK_far_hills.glb` | 1,491 UVs moved: 4fa0a0→**93a77c**, 2f6446→**5b6835**, 3f7f52→**77853e**, 5a93a8→**a69982**. Pale peak cells 8fb3d6 and b7c9e2 kept. | 95,180 → 95,180 (0) |
| `LK_terrain.glb` | 994 UVs: grass 6dbe45→**398f12** (path/soil cells kept) | 113,816 → 113,816 (0) |
| `LK_far_shore.glb` | 656 UVs: 6dbe45→**398f12**, a8d64a→**5ca214** | 39,852 → 39,852 (0) |
| `tools/lakeside/olive_recolour.py` | the idempotent tool that wrote the above. **Re-run it after any .blend re-export**, because a re-export reverts the UVs. | new |
| `tools/lakeside/test_lakeside_olive.cjs` | guard: cell colours, rest of row 10 free, only these 3 GLBs sample row 10, shared cells unchanged, vertex counts, same image and material, PNG format | new |
| `run-suite.cjs` | one line: `lakeside-olive` appended next to light-encoding | 1 line |

The UVs are float32, rewritten in place. Vertex counts, COLOR_0, normals, image (`T_LK_palette_256.png`) and material (`M_LK_palette`)
are unchanged. Because the material content and layout are the same, the static merge and instancing behave as before:
**0 added draw calls**. Merged chunk sizes are unchanged (57,010 v ≤ 65,535). The journey loads the same GLBs and PNG, so there's no pop.
The texture filter is nearest with no mipmaps, so the new cells can't bleed into neighbours.

Package impact: −796 B on the PNG. GLB raw sizes are unchanged. The meshopt-encoded (quantised) mesh data for the 3 GLBs goes
67,821 → 67,751 B (−70), or 44,768 → 44,592 B (−176) after deflate (`evidence/meshopt_*.txt`, GGbot's meshopt_measure.mjs).
Net ≈ **−0.9 KB**.

## Stand-in check (emulator, not Creator; f7f892f lights, board handoff camera; one pass)
`evidence/compare_olive_r5h3_before_after.png`, labelled stand-in.

| region | r5h3 | before (f7f892f) | after |
|---|---|---|---|
| far hills only (pixels in the far region) | — | 26/78/30 | **71/84/20** |
| far_trees region (hills + trees) | 71/83/20 | 29/94/30 | 51/94/28 |
| grass_L | 81/107/24 | 109/134/59 | **87/107/45** |
| grass_R | 72/120/22 | 114/138/61 | 93/111/48 |
| near water / bridge / roof | — | unchanged | unchanged |

## Suite
**67/72**. The only failures are the known 5: production-integrity, legacy-board-ui-pure, reward-background-return and cloud-web-contract FAIL, and
navigation-guard BLOCKED_BROWSER. production-integrity still fails on the pre-existing `audio_bgm_island/audio/bgm_main.mp3` hash.
I checked that it fails identically on f7f892f, and its frozen list contains no lakeside asset, so no hash test needed updating.
lakeside-olive, meshopt, static-merge, daynight, pavilion, light-encoding and all other lakeside tests PASS. Log: `suite.log`.

## Risks
1. **The far trees stay bright green.** The far_trees region is about 49% LK_tree_round/LK_tree_conifer, which share their GLBs and cells
   with the near trees, so the region median is only 51/94/28. To match r5h3 fully, trees would get their own cells too
   (same tool; but the near trees by the house would also turn olive unless far instances got a separate GLB).
2. Grass blue stays about 45 against 24: the blue comes from ambient and fog, not the albedo (cell blue is already about 0).
3. All numbers are from the stand-in. Mac screenshots and Funning decide.
4. A re-export from `art/regions/lakeside/blend` reverts the UVs (re-run `olive_recolour.py`; the guard test catches it).
5. The night look changes the same way (same albedo); not separately checked.
