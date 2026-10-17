# Lakeside (r5h3) camera, round 2: 17 s timed journey, close landing = board camera, 1 s landing→board hook

Branch `cine/lakeside-cam` (local only, NOT pushed), worktree `/workspace/wechat-game/work/wt-lk`, on Voice Bot's 0932b6b.
**HEAD f49ce47 (tree afe6fe3484d3f746d106cf7ff6e0cfc4933444a6)** — the SHA to hand to GGbot. Previous round: README_c375304_round.md.

| commit | content |
|---|---|
| 0e39055 | route.timing (17 s S-curve), softClamp C2, board pitch 58, first blend hook (superseded parts below) |
| b0c21d2 | close fallback-like landing + board lens; pitch 58 void; blend = one smootherstep for position / slerp / FOV |
| 68478d9 | reverts the FlowReferenceStandin hunk of 0e39055 (controller-integrity guard; see "Walk driver") |
| f49ce47 | landing END pose = board camera at the 360×780 reference; `arrivalFovDeg`; hook `gap` + `done()` |

Files (camera/framing only; no geometry, no lighting, no L1–L4 content): `world-r1/RegionJourneyCore.ts`,
`world-r1/WorldFlowCore.ts` (optional type field), `region/LakesideCameraLayout.ts`, `tools/journey-integration/test-lakeside-camera.cjs`.
`WorldIntegrationBoot.ts` is byte-identical to 0932b6b again.

## Hook for Voice Bot (region wiring)
```ts
import {lakesideJourney,lakesideLandingBlend} from './region/LakesideCameraLayout';
// route for RegionJourneyController: {...,path,focus:j.focus,landing:j.landing,timing:j.timing,startBlendM:0}
const j=lakesideJourney(start);
// 1. PRELOAD the board scene (lakeside lease + board UI, hidden) before the journey arrives.
// 2. when the journey reports 'arrived':
const b=lakesideLandingBlend(world.readCamera() /* final journey pose */, boardFrame /* LakesideBoardFrame from the board UI */, j /* {yawDeg,root} */);
// 3. each frame: world.setCamera(b.at(elapsed));
// 4. on the first frame where b.done(elapsed) is true, at(elapsed) === b.boardWorld: swap to the board on that frame
//    (the lease's frame() camera = lakesideAlignedBoardPose(boardFrame) = b.boardWorld seen from the lease origin → identical pose).
```
Signature: `lakesideLandingBlend(from: Pose, frame: LakesideBoardFrame, journey: {yawDeg:number; root:Vec}, seconds = 1)`
→ `{seconds, from, boardLocal: AuthoredPose, boardWorld: Pose, gap:{positionM, viewDeg, fovDeg}, at(t): Pose, done(t): boolean}`.
One smootherstep e(t/seconds) drives position (lerp), view direction (slerp, look-at, no roll) and FOV (lerp):
zero velocity and acceleration at both ends, monotonic, no overshoot. The journey lens itself is at rest when she stops
(0 m/s, 0.00005 °/s), so the seam into the hook is continuous.
Assumption carried from round 1: the lease rig is at the lakeside root (boardWorld = toWorld(boardLocal)).
Lighting of the last stretch: GGbot (not touched here).

## Landing end = board camera
Close framing per Funning (the fallback's end frame): lens 6.8 m behind / 1.1 m right / 3.0 m above her stop. Its aim,
pitch and FOV are the board camera's at the 360×780 reference: `landing.arrivalPitchDeg -2.80422`, `arrivalFovDeg 55.2171`
(new Landing key; 0 = off, other routes unchanged). FOV eases 48 → 55.2 with the arrival weight (same smoother as the view).
Residual gap the hook closes (K8 `landingToBoardGap`, curves/landing_to_board_gap.json), position always 0 m (< 1e-15):

| layout | view ° | FOV ° |
|---|---|---|
| 360×780 (reference) | 0.0000 | 0.0000 |
| 390×844 notch | 0.297 | +2.14 |
| 414×896 | 0.587 | +2.17 |
| 330×770 | 1.508 | +3.86 |
| 768×1024 | 1.830 | −1.05 |
| 375×667 | 2.361 | −7.62 |
| 390×520 | 2.507 | +3.92 |

If BoardLayout or the landing position changes, the two numbers must be re-derived (K8 fails above 0.01° / 0.01° FOV at 360×780).

## Board camera (portrait) and grid alignment
Pitch 58 is void. Portrait board camera = the landing position; yaw/pitch (Newton) and FOV (bisection) are solved so that the 3D board
centre sits on the 2D grid centre and the 3D centre row matches the 2D grid width (K6: 0.000 px both). The view is shallow, so
the rows are strongly foreshortened: **corner error 3.14 cells, cell-centre error 2.66 cells, the 3D grid overhangs the opaque tray
by 17–36 px** (reported, no longer asserted on portrait). Per layout: pitch 9.9–14.2° below horizontal, FOV 47.6–59.1°
(360×780: 12.41°, 55.22°). Landscape unchanged (75° / 40°, corner 0.53 cell, inside the tray). This is the trade-off the
reviewer chose (close framing over exact 3D/2D overlap).

## Journey timing (17 s, route 39.2 m)
`route.timing {durationS:17, easeInS:4, easeOutS:4}`: smootherstep speed ramps, cruise 3.02 m/s. Her: peak 3.02 m/s (≤ 4.5),
|a| 1.41 m/s², |jerk| 1.09 m/s³. Lens: peak 3.02 m/s, |a| 1.95 m/s² (≤ 3), |jerk| 4.87 m/s³ (≤ 8, after the 0.6 s set-off fade),
turn ≤ 4.27 °/s, at rest at the stop. Arrival Hermite is off (the lens rides her S-curve walk); softClamp knee made C2
(removed 17–22 m/s³ jerk spikes). No crane-up: over the arrival the lens never climbs in the world (0 m), height above her 3.4 → 3.0 m.
Rules: lens ≥ 1.1 m (min 1.367 m, island palm), face/head/chest never hidden, lens on her right (min 1.745 m), landing frame:
her at 29% (360×780) / 37% (390×520) of the width (≤ 80%), height 0.205, board centre at the frame centre.

### Walk driver (ACTION NEEDED: controller review)
The S-curve needs the walk to follow `Action.walk.distanceAt` (the controller now passes `journeyDistanceAt(L, timing, t)`).
The frozen `FlowReferenceStandin` (WorldIntegrationBoot.ts) is guarded by `test-controller-integrity` (reviewed SHA manifest),
so the 2-line driver change from 0e39055 was reverted in 68478d9 and kept as `proposed/standin-distanceAt.patch`.
**Until that patch is reviewed and its manifest updated, the in-game walk is the controller's own plan for duration 17 s**
(in the box harness: linear 2.31 m/s with a hard start/stop), so the S-curve, the accel numbers above and the preview's timing
apply only with the patch. With the patch, the real driver reproduces the curve exactly (curves/walk_standin_with_proposed_patch.json:
ends at 17.0 s, peak 3.016 m/s, |a| 1.414). The walk cycle is distance-driven: at 3 m/s her legs cycle ~2.5× the 1.2 m/s rate.

## Tests (tools/journey-integration/test-lakeside-camera.cjs, 10/10 PASS, tests/lakeside-camera_f49ce47.json)
K1 route + timing validation · K2 clearance/occlusion · K3 right side · K4 landing frame 360×780 / 390×520 · K5 turn ≤ 20°/s + no crane-up ·
K7 timing/kinematics · K6 board framing (8 layouts) · K8 blend at 60 Hz: landing lens at rest, exact ends, no gap at the reference,
monotonic distance/view/FOV (no overshoot), single-peak speed/turn/FOV rates ≈ 0 at both ends, clearance ≥ 1.1 m, her never hidden,
right side, done()/at() swap frame; per-frame series in the report.
Full suite (run-suite) f49ce47: 50/54, the same 4 failures as c375304 and base (production-integrity, legacy-board-ui-pure,
reward-background-return, cloud-web-contract): tests/suite_f49ce47.log. (b0c21d2 had 49/54: controller-integrity-guard → fixed in 68478d9.)

## Deliverables
- video/lakeside_fallback_vs_new_360x780_f49ce47.mp4 — Blender preview, side by side, 24 fps: fallback (default follow, held) |
  new (17 s walk → 1 s blend → board camera). NOT in-game (in-game recording comes after Voice Bot wires the hook / GGbot's line).
- stills/final_frames_side_by_side_360x780_f49ce47.png — fallback final | new landing end | new board camera.
- stills/landing_final_{new,fallback}_{360x780,390x520}.png, stills/board_new_{360x780,390x520}.png (+ _ui / _align with the tray and the 2D grid).
- curves/lakeside_speed_accel_jerk_f49ce47.png (journey, new vs fallback), curves/lakeside_blend_perframe_f49ce47.png
  (blend per-frame turn rate / displacement / FOV, joined to the last 1 s of the journey), curves/blend_perframe_*.json, curves/*.json.
- size/size-logs-f49ce47.tgz: Creator 3.8.8 web-mobile (Mac), base 0932b6b vs f49ce47, both exit 36: 19,895,199 → 19,904,058 B = **+8,859 B**, all in assets/main/index.js (c375304 was +4,847 B). size-logs-c375304.tgz = previous round.
- scripts/: frames.cjs, walk_curve.cjs, curves.cjs, plot_curves.py, plot_blend.py, render_lk.py, render_all.sh, compose_*.py, suite.sh.
