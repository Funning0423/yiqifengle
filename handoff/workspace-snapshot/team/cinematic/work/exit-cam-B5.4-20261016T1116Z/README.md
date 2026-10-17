# Exit camera B5.4: end on island HOME pose (local only, NOT pushed)
Commit 10009b7891b49239b47c78e2ad627d1ae3d2e75c, tree 80665ee03c1bd9591755cdffd876bf4fe97511f6, on cine/exit-cam-B5. Parent: B5.3 00fea63.

## Home pose (found in the repo, not solved)
- `REGION_CAMERA.island.variants['v24-readable']` = pos (-12, 15.5, 48) → target (1, 0.5, 1), FOV 42.
- This was `islandPoseSource` on base b14067c. `islandPoseEntry()` returns it, and the sailboat transition starts from it.
- B5.4 sets `islandPoseSource = 'v24-readable'`.
- Rendered against Funning's screenshot (`stills/B54_final_vs_screenshot_0.46.png`), the lighthouse, cottage, island outline and horizon line up by eye, within a few px. I did not compute a numeric residual. The 继续旅程 sign and HUD are UI overlays and are not in the preview.

## Motion
- Follow on her right: side 2.0, sideIn 3.6.
- Then one rise/pull-back along a straight line (offset blend) to the home pose.
- Speed profile: s5 ramps, ramp-in 0.30, ramp-out 0.25. heightShare 0.52, settle 32 s.
- **Total 40.68 s** (37.7 s after the door key).
- Timing (30 fps): door 76, walk end 260, wind full 514–581, crane 523, peak 547, settled / sailboat start 1221.

## Results
- Peak speed: 1.99 m/s (real walk 1.99).
- Max accel: 1.35–1.74 m/s². Max jerk: 12.1–17.2 m/s³.
- Max left offset: 0.06 m (doorway only).
- From the wind peak to settle, the camera is never more than 19.9° off her front (never behind her face). During the follow segment it is behind her by design.
- Clearance:
  - suite near-geometry 1 m grid: PASS
  - my point-clearance probe: props 0.94 m at 7.5 s (just under 1 m)
  - lighthouse wall at the doorway: 0.50 m (exempt)
  - gull flight path: 2.18 m
- Occlusion: face/head/chest 0 frames.
- Final frame:
  - sunlit (game Main Light)
  - face/chest/head line of sight clear
  - feet ray grazes the low island props/grass at her feet (as in the screenshot)
- Return trip: starting from the home pose, real-walk linear-velocity-continuity failed at 17.4 m/s² (limit 15). Fixed with craneDown.leadSeconds 0.861 → 1.6; now 14.1 m/s².
- Suite: everything passes except composition and real-walk return-entry-continuous, which also failed before.
- Sail check: the start is the v24 home pose, identical to the original sail-cam-signcheck run, which found no occlusion (`sail/summary_v24_start.json`).

## Progress
- [x] commit, patch, tests, timing, final still + screenshot comparison, curve plot
- [x] video/exit_B5.3_vs_B5.4_0.46.mp4 (486x610, 40.8 s, 10 fps, 408 frames; B5.3 last frame held after its 20 s end)
