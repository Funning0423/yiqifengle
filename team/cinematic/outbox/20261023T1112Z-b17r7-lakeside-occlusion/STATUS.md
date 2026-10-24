# b17r7 lakeside occlusion + balloon 15 s — 运镜bot — DONE (code + Node tests); Mac/engine capture NOT done
Branch cine/b17r7-lakeside-occlusion, base 1c5adec5. Commits: fdb863cc (LensPullIn + proxies + hard test), 262cd02d (.meta),
01892b6e (night env_cloud_layer hide), c40d5f54 (suite fixes); this outbox commit on top. Not pushed.

## (1) Lakeside follow lens into trees / pillars
- Cause: lakeside is static-merged; FreeOrbit skips renderer AABBs > 14 m, so neither follow nor orbit lens saw any tree/post/house.
- Fix: 1017 generated proxy boxes (tree trunk+crown, bushes, posts, houses/bridge/pavilion in 1 m cells, lakeside-local, converted
  with the model worldMatrix). LensPullIn casts head (1.5 m) and chest (1.1 m) to the lens: pull in with 1.1 m clearance, ease in fast
  (tau 0.06 s, ≤9 m/s) / out slow (0.6 s, ≤2.5 m/s), crane up / swing round her when pull-in leaves < 55 % of the arm; arm floor 1.6 m.
  Orientation unchanged (no snap). No fade-out of occluders was needed for the follow lens.
- Hard test lakeside-lens-occlusion (geometry, real GLB triangles + real TS, NOT a render), 12 seeded walks, 30 fps, 7 portrait screens:
  full grid (QF_LKO_FULL=1): follow lens hidden head/chest frames 2138/80983 (2.64 %) before -> 0 after;
  orbit 36 poses 17491 -> 1536 (-91 %); ≥1.1 m clearance share 94.4 % -> 97.1 %; max extra step 1.27 m/frame (orbit), follow 0.50.
  Suite grid (orbit arm 9 m): before 8253/219811 occluded (L1 FAIL) -> after 499 (L1/L2/L3/L4 PASS).
  Residual (orbit only): she hugs house A wall / clothesline inside the 1.6 m arm floor.
- Night grey: GGbot's bisect (mac-diag-5095dfe) proved the island room's env_cloud_layer (unlit shell wrapping the lens) is the night
  dark-blue/grey block. SkycityCloudsea night branch now hides it too (restored on hide). RISK: if the lakeside free walk happens
  after the last SkycityCloudsea owner releases, the layer comes back; needs Mac night check. Lens-inside-mesh is also covered by (1).

## (2) Balloon ~15 s "cloud -> sea hard cut"
- NOT the cloud-sea seam (SEAM_T = 11.4 s). Lens is continuous 13–18 s: max 14.8 m/s, max 22.5°/s, FOV 48 fixed, no step.
- The lens climbs y -4.5 -> +1 through 15–16 s and crosses world y≈-0.9 at ~15.8 s = the leftover SailArt sea_plane that 1c5adec5
  already hides in flight. Below it the one-sided plane is culled (clouds), above it the sea appears: that is the "cut". Fixed by 1c5adec5; no lens change.
  Evidence: balloon_cam_13-18s_trace.txt, balloon_cam_los_13-17.6s.txt.

## Suite
159/162 (baseline 158/161 + new lakeside-lens-occlusion). Fails = env only: 2x Node>=22.6, navigation-guard browser.
## Package
Source +~40 KB added lines (proxies table 29.1 KB). No build measured.
## Evidence (NOT engine capture)
lens_occlusion_before_after_GEOMETRY_NOT_RENDER.png, lens-occlusion_full-grid_before-after.log, lakeside-lens-occlusion_suite-grid.json, suite_159of162.log.
## Open
Mac recording day+night of lakeside free walk (toward the boardwalk) and balloon 15–17 s.
