# Exit camera B5.4.3: about 30 s, peak 2.55 m/s (local only, NOT pushed)
Commit 1a17266cef7167410cb6b12e921ba31a4bcc1c88, tree 3b7c479384e631162add68cffd4820cc365411d4, on top of B5.4.2 911a954.

## What changed
- Only `crane.settleSeconds` 29 → 22 and `cruiseRamp` (ramp-out) 0.12 → 0.15.
- Unchanged: path shape, the clearance lift, and the end pose v24-readable (camera (-12, 15.5, 48) looking at (1, 0.5, 1), FOV 42).
- Test peak cap 2.0 → 2.6 m/s. The 1.1 m `exit-prop-clearance` test is kept.

## Metrics
- Total 30.67 s. Peak 2.545 m/s at 12.0 s.
- Max acceleration after the door: 1.30 m/s² (brief cap 1.5). Max jerk 12.0 m/s³, only at the doorway handoff (about 3.8 s).
- Last ~3 s: speed goes 1.96 → 1.08 → 0.22 → 0 m/s at 3, 2 and 1 s before the end (about 0.7–1.0 m/s² of slowing).
- Non-exempt clearance minimum 1.303 m (island props, 5.3 s).
- 0 frames on her left. Face, head and chest never occluded. Final frame: sunlit; face, chest and head clear; feet hidden by a low bush, as in the game.
- Speed curve note: a cruise of 2.55 m/s steps down to 2.2 m/s at about 16–17 s, when the height rise finishes. Acceleration there is at most 1.1 m/s², and it is the same shape as B5.4.2.

## Timing (30 fps frames)
| event | frame |
|---|---|
| door key | 76 |
| walk end | 260 |
| speed peak | 360 |
| wind full | 418–480 |
| crane start | 425 |
| settled = sailboat start | 920 (30.67 s) |

## Preview sea
`scripts/seafix.py` is used by both video sides and the stills.
- Game inputs: M_env_sea = COLOR_0 vertex colour × the Sea_CalmWavelets_64 texture, roughness 0.22, specular 0.7, no colour factor.
- Why the preview was dark: the Blender importer ignores COLOR_0, and EEVEE does not reproduce the Cocos sky reflection.
- Fix: COLOR_0 × wavelet × a linear tint (0.95, 1.6, 1.75) as emission. The tint is calibrated to the game sea colour measured in the screenshot (sRGB ≈ 48, 157, 180). Preview sea now samples about (29–51, 150–177, 178–193).

## Final frame vs screenshot
`stills/B543_final_vs_screenshot_0.46.png`, offsets in `stills/landmark_offsets_px.json`:
- lighthouse top 0/0 px, cottage roof 0/0 px, door arch 0/0 px
- horizon -1 px

## Sail check
`sail/summary.json`: start pose equals the B5.4.3 last frame. 0 occluded frames. Minimum distances: sign 49.7 m, palm 40.7 m, island 16.4 m. Scene uses the current T9 prop placement.
