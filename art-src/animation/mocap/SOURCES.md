# Motion-capture sources

All character clips in `creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb`
(except `wind_sway_loop`, unchanged) are retargeted from the **CMU Graphics Lab Motion Capture Database**.

## License

> This data is free for use in research projects. You may include this data in commercially-sold products, but you may
> not resell this data directly, even in converted form.

Source: <http://mocap.cs.cmu.edu> (FAQ / info page). Acknowledgment requested by CMU:
"The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217."

The game ships only the retargeted, key-reduced joint curves inside the character GLB, i.e. the data is part of a product, not
resold. The raw ASF/AMC files are **not** committed; the build scripts read them from `CMU_DIR` (default `/tmp/cmu/raw`),
downloaded from `http://mocap.cs.cmu.edu/subjects/<NN>/<NN>.asf` and `.../<NN>_<TT>.amc`.

## Clips

| clip | CMU trial | CMU description | source window (s, 120 fps) | edits after retarget |
|---|---|---|---|---|
| `walk_loop` | 91_29 | "walks and turns" / NormalWalk | 5.425 – 6.683 (one gait cycle, foot.R heel strike to heel strike) | time ×1.139 (1.433 s cycle), stride ×0.698 to 0.7 m/s, feet planted, step lengths evened (0.67/0.73 m source asymmetry), swing knee peaks softened |
| `walk_start` | 91_29 | NormalWalk (start from standing) | 2.75 – 4.43 | time ×1.15, starts at the idle pose, from 1.533 s identical to `walk_loop` |
| `walk_stop_bodyR` | 91_29 | NormalWalk (stop before the turn) | 15.47 – 16.45 | time ×1.15, pelvis turn removed, 25 % of the sideways drift kept, small settle step, ends in the idle pose |
| `walk_stop_bodyL` | 91_29 | same, mirrored | 15.47 – 16.45 | as above, mirrored left/right |
| `walk_turn_180` | 91_29 | NormalWalk (turn to her left) | 8.25 – 9.75 | yaw scaled to exactly 180° (source 190°), drift removed, idle pose at both ends, pivot shuffles turned into short steps |
| `walk_turn_180_bodyR` | 91_29 | NormalWalk (turn to her right) | 16.0 – 17.5 | yaw scaled to −180° (source −194°), as above (the 1-frame pivot shuffle of her left foot became a 7-frame step) |
| `walk_turn_90_bodyL` | 69_16 | "walking" / turn in place | 1.70 – 3.20 | yaw scaled to 90° (source 88°), idle pose at both ends |
| `walk_turn_90_bodyR` | 69_18 | turn in place (opposite direction) | 1.10 – 2.70 | yaw scaled to −90° (source −87°), pivot foot turned into a step, idle pose at both ends |
| `idle_breathing_loop` | 91_29 | NormalWalk (standing before the walk) | 0.30 – 2.10 | loop closed, knees straightened to ~7° on the weight leg (CMU standing knees ~27°) |
| `sit_hold` | 113_15 | "Post pregnant woman" / sit in chair and get up | 2.60 – 4.60 | loop closed, seated on our 0.38 m seat, feet on the idle footprints, wrists on the thighs (CMU chair had armrests) |
| `sit_down` | 113_15 | sit in chair and get up | 1.40 – 2.60 | standing / seated phases blended by hips height, idle → sit_hold, feet fixed, hands onto the thighs |
| `stand_up` | 113_15 | sit in chair and get up | 4.70 – 5.95 | sit_hold → idle, as above |
| `door_reach` | 15_06 | "various everyday behaviors" / lean forward, reach for | 15.05 – 17.05 | hips travel ×0.5, spine 60 % of the lean, right arm IK keeps the palm centre on the handle and turns the palm to face the door (same two-bone IK, performer's reach timing) |

All clips: rotation retarget onto the 28-joint rig (uniform scale = leg length ratio), ankles moved 4 cm outward along the
pelvis axis (the CMU hip joints are much wider than ours; without this the feet land on one line and the legs cross), feet
planted without slip on the shoe sole vertices (turns: every sole vertex held where it first touched; the stance heading
of the shoe is eased through the swing so it never snaps at touch-down), hips height fitted, skirt / apron panel and arm clearance solved per frame
(`scripts/skirt_solve.py`). Body-side convention: bone `.L` = her right.

## Rejected candidates

- 144_24 (door reach candidate): boxing-like wide stance and overhead reach.
- 91_10 / 91_20 / 91_27: other 91 walks, less steady cycles than 91_29.
- 113_05 / 113_06 / 113_25: other sit takes of the same performer; 113_15 has the cleanest sit-down / stand-up with the feet
  still.
