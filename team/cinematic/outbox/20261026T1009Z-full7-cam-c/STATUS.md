# full7-cam-c — 运镜bot, cine/b19-full7-cam (base baf51b13), after 295c6c92
Commits: 94f43bdb M6 extras · f7b2f3b3 ACTOR_STALL trace · 8549de8f test_c1_node_path (report-only finding)
Suite at 8549de8f: 227 PASS / 0 FAIL / 3 BLOCKED (env). No camera pose changed → visibility unchanged (235,257 cams, 0 holes).
"Stalled clock → door wide" hold: NOT built (cancelled), so nothing to revert. No WorldFlowComponent edits since 4bda3728.

## 1 M6 extras (NOT_ENGINE; e4ae91c1 data; tools/transitions-continuous/measure_m6_extras.cjs <tree> [M6local])
Meadow obstacle triangles (windmill_static, fence, trees, wind_bell, river), segment lens→face (+1.55 m) and lens→chest (+1.2 m).
RegionNodeStage.frame() meadow QA shot at M6 (she is reset at M6, world yaw 0). The star-ring variant of finale/look needs the
skycity rig, so the base finalePose was measured:
| shot | screens | her share | face/chest | lens clear (any) | to windmill |
| follow | 5 tall | 25.7 % | clear | 3.75 m (old M6 3.21) | 8.36 m (old 7.64) |
| follow | 375x667, 390x520 | 24.8 % | clear | 4.02 (3.53) | 8.52 (7.82) |
| finale/look | 5 tall | 52.6 % | clear | 3.75 | 8.36 |
| finale/look | 375x667, 390x520 | 50.7 % | clear | 4.02 | 8.52 |
Windmill base: never occludes, at either M6. The move improves both clearances by ~0.5–0.7 m.
M6→B1 start blend (approximation: the live follow at M6 min-jerk blended over 6.38 s onto the ride lens, her held AT M6):
her share 6.1–25.7 %; face hidden by wind_bell_frame 1.03 s (5 tall) / 1.10 s (375x667, 390x520). The old M6 gives 0.80 / 0.90 s.
Lens ≥0.35 m from wind_bell_frame (0.70 on the short screens), ≥4.84 m from the windmill.
Caveat: in game she walks to the basket during B1, and the B1 close-up gate (test_basket_close 'B1 meadow in') measures
hid 0.3 s with the real lens/her path. So the wind-bell figure is a pessimistic proxy, not a gate failure. Engine check pending.
→ Answer to 场景设计部: no adjustment needed for the windmill. The wind_bell_frame proxy flag should be checked in the next Mac run.

## 2 ACTOR_STALL (trace only)
While the trace is on, during an active C1 walk/board step (`!boarded`) or the B1 close-up: her position unchanged (<2 cm) for
>3 s (proposed N = 3 s) → `[QF_CAM_TRACE] t=… ACTOR_STALL step=C1|B1 heldS=… her=x,y,z`, repeated every 3 s. The camera is never moved.
Tested (walking: none; stalled: lines; inactive: none; off: none; wiring).

## C1 follow on a cornered node path — FINDING (test_c1_node_path, report-only, not in suite)
SkyWalkShot over routeKeys('skycity',X,'S6') + the 5a walk to the basket:
- from S6: PASS. Yaw 11.4 °/s, p99 75 °/s², no occlusion, clearance 4.6 m, her in frame.
- from S5 (10.8 m): her leaves frame (margin −0.98) on 6 of 7 screens. Yaw 25 / p99 107 °/s².
- from S3 (48 m) and S0 (94 m, out-and-back corners at S2/S4): yaw pinned at the 120 °/s / 300 °/s² caps, her out of frame on all 7.
- No occlusion and no lens-in-box in any case.
SkyWalkShot was built for the straight 5a walk and can't keep her framed on corners. The S0→S6 pre-walk needs its own follow
(like the meadow pre-walk: ExploreCameraCore.followPose, eased, then blended onto the walk lens at S6). This goes in GGbot's new
S6 start code, which isn't on this branch yet, so I didn't build it. Note: this test uses test_sky_walk_shot's screen list
(430x932 and 844x390 instead of 320x568 and 390x520).

## Not done: solid-colour gate + false-positive sweep (and the flat-sky sub-check proposal); meadow continuous follow in BalloonB1Start.ts.
