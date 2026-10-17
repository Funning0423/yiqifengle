# Lakeside (r5h3) camera: journey, Landing A arrival, board framing

Branch `cine/lakeside-cam` (local only, not pushed), worktree `/workspace/wechat-game/work/wt-lk`, stacked on Voice Bot's
`voice/build05-lakeside-playable` 0932b6b (L5: 34 ASSETS templates skipped, 431 instances) on d8cd409.

| commit | content |
|---|---|
| 7595b85 | island→lakeside journey layout + Landing A arrival overrides + K1–K7 test (from c8a63b8 on 09a1b8e → d8cd409 → 0932b6b; run-suite conflict resolved, lakeside-entry and lakeside-camera both kept) |
| eee4dfe | S-curve Hermite arrival (replaces settle easing) + board framing that lays the 3D lake grid under the 2D board |
| c375304 (HEAD, tree 1bd56b6) | test scene geometry skips the 34 ASSETS templates (431 real instances = lakesideSceneInstances) |

## Files touched (camera / framing only)
- `world-r1/RegionJourneyCore.ts`: optional `JourneyRoute.landing` overrides on the Landing A machinery (bc418c5/2607de6):
  arrivalSideM/LiftM, `arrivalHermite` (quintic Hermite lens position into the arrival pose, C2, lens at rest when she stops),
  `anchorSmoothM` (exact triangular smoothing of the follow anchor + heading). Defaults 0 → 04→05 / 08→09 unchanged (K1).
- `region/LakesideCameraLayout.ts` (new): journey placement/route (`lakesideJourney`) and board framing
  (`lakesideAlignedBoardPose(frame)`, `lakesideAlignedLookAt`, `lakesideBoardRect`).
- `region/LakesideBoardBackground.ts` (Voice Bot's lease): only the camera call in `frame()` changed
  (`lakesideBoardPose(aspect)` → `lakesideAlignedBoardPose(layout)`). No node, light, instance or geometry change.
- `world-r2/LevelBackground.ts`: `LevelBackgroundFrame.board?` (optional 2D grid rect). `ManagedMobileBoardUI.ts`: passes
  `board: g.grid` in the existing backgroundFrame call (1 line). Meadow / sky leases ignore it.
- tests: `tools/journey-integration/test-lakeside-camera.cjs` (K1–K7, in run-suite), `lakeside/lakeside-scene.cjs`
  (mirrors `lakesideSceneInstances`: no 3D pieces / shadows / ripples / frame).

## Board framing: 3D grid aligned to the 2D board
The 2D tray (board_art/board/tray_frame.png) is opaque. The camera is solved per BoardLayout frame (closed form): view pitch 64°
below horizontal facing the board, portrait FOV = Voice Bot's `lakesideBoardPose` rule (61.928°, widened on tall screens,
cap 75°); 3D board centre lands on the 2D grid centre, 3D centre row width = 2D grid width (both ≤ 0.001 px in K6).
A perspective camera cannot map a tilted plane onto a square exactly (only a 90° top-down camera can), so the residual is
the near row slightly wider / far row narrower: corner error 0.66–0.87 cell, cell-centre error 0.53–0.70 cell, and the whole
3D grid stays ≥ 7 px (≥ 0.15 cell) inside the opaque tray on every layout, so the player never sees the mismatch; lily pads,
buoy lanterns, chime rafts and the rope ring frame the tray. Landscape (desktop preview) uses pitch 75°, FOV 40°.
Trade-off: steeper = better alignment, less scenery. At 64° the strip above the tray (HUD area, top ~23–29%) shows the moon
bridge and far lake, not the village/mountains that Voice Bot's handoff camera shows. One-number knob: `board.pitchDeg`
(58° → corner 1.07 cell, more bridge; 90° → exact, water only).

K6 layouts (BoardLayout + safe areas): 360×780, 390×844 notch+capsule, 375×667, 414×896, 330×770, 390×520, 768×1024,
844×390. Per-layout pose and errors: tests/lakeside-camera_c375304.json → K6.layouts.

## Journey + landing (Landing A style), K1–K7 (tests/lakeside-camera_c375304.json)
Route: island exit (same approach as 04→05) → 24 m rainbow bridge → south bank → 11.5 m walk toward the lake, facing the board.
Total 39.204 m / 32.67 s at 1.2 m/s, bridge 3.30–27.70 m. Feet vs bank −1.1…+0.9 cm.
- Clearance/occlusion (K2, every 0.05 m, island + 431 lakeside instances + bridge strip): min lens clearance 1.367 m
  (island palm_lean_01 at d 14.35); face 1.5 m / head 1.6 / chest 0.9 never hidden. Reported, not hidden: the same
  set-off exemption as 04→05 (first 1 m, only her legs behind the island prop strip).
- Right side (K3): lens ≥ 1.943 m to her right for the whole leg.
- Final landing frame (K4): her x 41.8% (0.46) / 44.9% (0.75), feet 37.4% above bottom, height 0.148 of screen, board
  centre in frame (50%, 54.9%). Lens [-3.257, 2, 32.113] (world), fov 48.
- No crane-up (K5): lens world height never rises over the arrival (max climb/step 0 m); turn ≤ 2.17°/s.
- Kinematics (K7, real walk driver, 60 Hz): new peak speed 1.21 m/s, |a| 0.35 m/s², |jerk| 2.06 m/s³, last 0.5 s ≤ 0.014 m/s,
  0 at stop. Fallback (same route, default follow): |a| 56.7, |jerk| 3400 (stops dead) plus 11–23 m/s² corner spikes.
Curves: curves/lakeside_speed_accel_jerk_c375304.png, curves_new_vs_fallback.json, summary.txt, walk_real_driver.json.

## Previews, not in-game
Lakeside has no physical journey in the game yet (Voice Bot starts lake stages at the island stop), so the comparison
video and landing stills are Blender 5.2.2 EEVEE previews of the committed route/lens maths
(scripts/render_lk.py, lakeside_r5h3.blend placed like LakesideCameraLayout; the 3D pieces, rings and ASSETS templates are
hidden, as in the live lease). Lighting in the previews is the blend's own, not the game's (GGbot is reworking board lighting;
nothing here depends on lighting).
- video/lakeside_fallback_vs_new_360x780.mp4 (12 fps, left fallback, right new)
- stills_c375304/landing_final_{new,fallback}_{360x780,390x520}.png
- stills_c375304/board_{new,handoff}_{360x780,390x520}.png (3D only), *_ui.png (with the opaque 2D tray at BoardLayout's rect),
  *_align.png (tray at 35% + the 2D grid in red over the 3D wb_line grid)

## Tests and size
- Full suite c375304: 50/55; base 0932b6b: 49/54. Same failures in both (production-integrity, legacy-board-ui-pure,
  reward-background-return, cloud-web-contract; navigation-guard BLOCKED_BROWSER). The one extra test (lakeside-camera) passes.
- Size: Creator 3.8.8 web-mobile on the Mac, both builds exit 36: 19,895,199 → 19,900,046 B = +4,847 B, all in assets/main/index.js.

## Depends on Voice Bot (not done here: outside camera/framing scope)
1. Journey wiring: add a 'lakeside' JourneyRegion (WorldFlowCore Place/State types too), RegionCameraData entry, ensureRegion
   order, selectionRegion → 'lakeside' for r04-lake-*, and an adapter prepare that mounts the lakeside model with
   `lakesideJourney(start)` (yawDeg/root/path/route {focus, landing, startBlendM 0}). Until then the journey is test + preview only.
2. Landing → board: Landing A copied exactly ends on the arrival pose; the board then opens on the lease camera
   (`lakesideAlignedBoardPose`, written by frame()). An interpolating `landing?(from, seconds)` hook was not added.
3. Board lease reads the optional `LevelBackgroundFrame.board` (ManagedMobileBoardUI passes it). Older callers fall back to an
   estimate that is exact only when the pitch is limited by the width (K6 reports it).

## Process
Detached resumable renders at nice 19 (scripts/render_all.sh, renders/progress.log, blender.log); raw journey frames
(2×411 PNG, ~1 GB) were deleted after the video was composed; render_all.sh regenerates them. The box rebooted mid-run
(/tmp wiped). The branch was safe in the main repo. The worktree is now /workspace/wechat-game/work/wt-lk, and Blender 5.2.2 was
re-downloaded for the remaining frames, so all frames come from the same Blender version. Box and Mac temp are cleaned.
