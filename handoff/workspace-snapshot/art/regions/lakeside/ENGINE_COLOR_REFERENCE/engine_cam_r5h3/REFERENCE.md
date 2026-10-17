# Engine-camera r5h3 colour reference (Voice Bot, build05 lakeside r4)

New subfolder; the scene-design files one level up (REFERENCE.md, compare_r5h3_vs_engine.jpg, work/) are untouched.

## What this is
The graded r5h3 look (r5h3.blend, its own world/materials, then the r5h3 `postgrade16` grade) rendered through the **engine's
board-background camera**, not the old high r5h3 camera. Use this, not the old r5h3 renders, to judge the in-game board water.

- Pose: 运镜bot's measured `background_camera_pose.json` (team/cinematic/outbox/20261017T0940Z-lakeside-hook-v3-on-r3), 390x844 entry:
  Cocos pos (2.94478, 3.58, 31.16376), quat xyzw (-0.105171, 0.075737, 0.008033, 0.991533), vertical fov 57.3526°.
  It matches `LakesideCameraLayout.lakesideAlignedBoardPose` for 390x844 exactly (no disagreement).
  `pose_390x844.json` = that pose; `pose_360x640.json` = the same code path for 360x640 (fov 55.8197°; the JSON has no 360x640 entry).
  360x640 exists because the Mac r3 bg-only captures are 360x640; it lines up with them pixel-exact.
- Blender 5.2.2 EEVEE, 24 samples, @2x (780x1688 / 720x1280). Only the 431 objects the runtime mounts are shown (201 r5h3-only hidden, 0 missing).
- 12 frames (1, 17, …, 177) = 12 wave phases. Each one is graded (postgrade16, seed = frame), then a per-pixel temporal median.
  `ref_*_graded.png` = targets. `ref_*_pre.png` = the same before the grade.
- `*_boxes.png`: the sample boxes on the reference and on the Mac r3 day/night shots.
  Red = the 10 bar points, yellow = the mid stripe, cyan = land (regression only).
- 390x844 boxes are the 360x640 boxes moved onto the same world points with the G-buffer world positions (corner reprojection, <0.5 m).

## Pass bar
Every point within ±12 per channel of the graded target, and mid-stripe std ≤ 10 (mean over channels of the std of the row means).
`python3 sample.py <capture.png>` checks a 780x1688 or 720x1280 bg-only capture, and exits 1 on FAIL.

## Targets (sRGB 0-255, box median)
| point | 390x844 graded | 390x844 pre-grade | 390x844 box (x0,y0,x1,y1) | 360x640 graded | 360x640 box |
|---|---|---|---|---|---|
| far_water | 109/130/103 | 114/128/110 | 352/608/596/638 | 110/128/99 | 330/505/520/528 |
| mid_water | 83/128/128 | 94/124/124 | 326/687/607/703 | 84/128/126 | 310/566/530/579 |
| mid_water_R | 72/106/115 | 84/106/112 | 544/704/723/719 | 75/106/114 | 480/579/620/591 |
| under_bridge | 98/138/128 | 107/133/127 | 441/664/531/682 | 100/137/126 | 400/548/470/562 |
| near_mid_water | 88/146/137 | 101/139/134 | 342/759/505/771 | 88/146/136 | 322/622/450/632 |
| near_water_bottom | 114/172/153 | 124/162/150 | 136/955/644/980 | 114/172/153 | 160/776/560/796 |
| near_water_L | 119/172/153 | 128/162/150 | 0/909/24/975 | 116/171/152 | 14/742/72/792 |
| bridge_stone_deck | 125/94/53 | 118/98/71 | 358/568/422/581 | 124/94/53 | 335/474/385/484 |
| bridge_stone_left | 132/99/58 | 120/103/75 | 154/651/230/664 | 130/92/56 | 176/538/236/548 |
| bridge_rail_top | 164/128/84 | 151/129/100 | 390/527/398/537 | 163/128/84 | 360/442/366/450 |
| grass_near | 116/168/38 | 122/156/71 | 61/1174/717/1361 | 116/168/38 | 100/950/620/1100 |
| far_hills | 96/121/129 | 104/120/125 | 247/211/468/289 | 96/120/129 | 250/200/420/260 |
| mtn_snow | 139/142/142 | 139/140/140 | 312/92/416/157 | 139/142/142 | 300/110/380/160 |
| tree_crown | 42/108/5 | 59/102/34 | 351/368/390/400 | 42/108/5 | 330/320/360/345 |
| house_wall | 128/74/0 | 107/77/16 | 120/563/184/602 | 128/74/0 | 150/470/200/500 |
| far_shore | 92/136/128 | 102/131/126 | 646/679/722/698 | 95/136/126 | 560/560/620/575 |

Mid stripe std: 390x844 graded 1.5 (pre 1.2); 360x640 graded 1.8 (pre 1.4).

## Mac r3 at the same points (360x640, before r4)
Day: far 196/150/106, mid 178/131/92, mid_R 179/128/87, under 184/141/100, near_mid 170/135/96, near_bottom 61/136/128,
near_L 95/142/125, deck 175/164/110, left 163/147/104, rail 207/200/154, stripe 14.4.
Result: FAIL (the beige/orange "sand" lake centre).
Night: the lake centre is orange-brown (far 106/58/48, mid 91/51/43).

## Notes
- The reference land (grass, hills, snow) is lit by Blender's r5h3 world and is much brighter and more saturated than the engine can be
  with the board's global lights. It is reported as a regression check only, not in the bar.
- There is no night r5h3 reference. Night is judged by hue: the lake should read dark blue-teal (B ≥ G > R).
