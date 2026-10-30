# Island→Coast transition — camera DRAFT (cine/b20-coast-transition-draft)
Blockout previs only. No runtime integration, no new camera writer. Regenerate: `python3 previs.py` (about 7 min; `--norender` gives gates only).

## Path frame P (re-anchor to the real mesh at delivery)
Origin D = hut door threshold. +z runs down the sand path toward the sea, +y is up, +x is her right when she faces the sea.
S0 = top of the steps (z 6.0). S1 = foot of the steps (z 7.2, y −0.6; 3 steps × 0.2 m drop, 0.4 m tread). E = terrace edge (z 13.2). LH = lighthouse (placeholder (9, 7, 60)).
Camera keys are offsets from her smoothed root (0.24 s box filter), given as azimuth, radius and height and interpolated around her. Shots 1 and 7 blend to world poses: the live island lens and the 55° board pose. All joins use quintic ease, with no cuts.

## Shot list
| # | t (s) | Her action | Lens (relative to her, P frame) | Look | vFOV | Move | Join to next |
|---|---|---|---|---|---|---|---|
| 1 | 0.0–1.0 | stands at the door, facing +x (porch) | from the LIVE island lens down to (1.5, 1.75, +3.0): seaward front-right 3/4 medium | her +0.9 m | 45→44 | descending ease-in/out (same as §4.3 shot 1) | continuous, no stop |
| 2 | 1.0–1.8 | 90° turn to face the sea (and the lens), full turn kept | (1.4, 1.7, +3.0) | her +0.9 | 44 | near-hold | she starts walking; the lens starts retreating |
| 3 | 1.8–6.8 | walks the sand path to S0, about 5.65 m | (1.3, 1.7, +3.0) leading dolly, backing down the path | her +0.9, shifted 0.3 m so she sits on the left third | 44 | leading dolly | orbits right with no cut |
| 4 | 6.8–8.6 | steps down 3 sand steps, 1.2 m, full step-down kept | orbits to (3.6, 2.6, +0.2): right profile | her +0.8 | 45 | truck/orbit 90° | keeps orbiting |
| 5 | 8.6–13.6 | walks 6 m to near E | orbits to (1.8, 2.9, −3.2), then (1.4, 2.7, −3.6): rear-right 3/4, high | her +0.8, 0.6–1.8 m ahead, so the terrace comes in from the bottom of frame | 46 | follow | eases into the pull-back |
| 6 | 13.6–14.2 | stops 0.25 m from E and looks back at the lighthouse | pulls back 0.5 m to (1.6, 2.5, −4.1) | her +1.0, offset to the right | 46 | small pull-back | rises |
| 7 | 14.2–16.2 | stands | rises to the board pose: 14 m away at 55° elevation, aimed at (0, −0.6, 16) | board | 45 | crane | hands to the board camera (end pose = board pose) |

There are no cuts, so nothing goes in the hard-cut register. Walking is never cut.

## Gates (blockout, 60 fps; details in out/gates.json)
- Yaw:
  - Standing: max 30.6°/s, p99 acceleration 128°/s². Pass (limits 90 / 200).
  - Walking: max 73.1°/s, p99 acceleration 151°/s². Pass (limits 120 / 300).
- Lens clearance: minimum 1.138 m from blockout and ground. Pass (≥1.1).
- First frame equals the live lens: pass, but only against a PLACEHOLDER island pose.
- Largest lens step: 0.205 m/frame (the descent in shot 1). No hard cuts.
- All 7 screens:
  - Face/chest blocked: 0 s. Pass.
  - Face under the menu button: 0 frames. Pass.
  - Minimum frame margin: 0.101 (portrait) and 0.150 (390x520 and 768x1024). Pass (≥0.08).
- Narrow screens use fit-width, holding the horizontal FOV of aspect 0.62. That is an assumption, and a camera-fit rule like this has to exist in the runtime.

## Needs the real mesh / open items
1. Occlusion and penetration against the v2.2 rebuild: dry rock hollows, the gull rock, the reef rocks, the palm and the hut overhang. The blockout boxes are guesses.
2. The final positions of anchors D, S0, S1 and E in subpackage-local coordinates, plus the placement transform beside the island.
3. The live island lens pose at handover (the shot 1 start is a placeholder) and her starting facing direction (assumed +x, a 90° turn).
4. Shot 6: the lighthouse is not yet in the upper right in the previs, because the placeholder LH sits too far and too high. This needs the real lighthouse position, then a retune of the look offset or yaw.
5. Shot 3 pace: she starts 0.35 m out from the door, so she walks 5.65 m in 5.0 s (1.13 m/s). Either hold 1.2 m/s with a 4.7 s shot, or confirm the 6.0 m path length.
6. Step-down speed: 1.2 m in 1.8 s is 0.67 m/s. This must match the step animation's root motion.
7. Rule between levels (3–5 steps, about 4.5 s): reuse the rear-3/4 key from shot 5 and the pull-back from shot 6 as a 2-key loop. Not previs'd yet.

## Runtime size estimate
Data only: about 10 keys × (t, 3 offset, 3 look, fov) ≈ 0.4–0.6 KB of JSON/TS constants, plus about 0.6 KB for the orbit-interp/ease helper if SkyRunLens does not already have one. Total ≈ 1–1.2 KB raw.
All writes go through the existing CameraPose single writer (the SkyRunLens style). No new writer.
