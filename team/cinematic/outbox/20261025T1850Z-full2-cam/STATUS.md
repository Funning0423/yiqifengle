# full2-cam — 运镜bot (branch cine/b19-full2-cam, proxy/geometric only; no Cocos Creator on this box)

Commits on 8be85ade base: D board handoff · F3 floors 6413ce07 · Task 4 08e7ed77 · E 1bea977a (HEAD).
Suite (HEAD 1bea977a): **212 PASS / 0 FAIL / 3 BLOCKED (env: legacy-board-ui-pure, reward-background-return = Node<22.6; navigation-guard = browser)**.

## Task 4 — lake leg at mooring C (test lake-leg-c), identical on all 7 screens unless noted
| metric | value | cap |
|---|---|---|
| walk yaw / p99 accel | 13.7°/s / 43°/s² | ≤120 / ≤300 |
| board+lift+flight yaw / p99 (incl. C1 close-up) | 86.9°/s / 136°/s² | ≤90 / ≤200 |
| step per frame | ≤0.408 m | ≤0.6 |
| face/chest hidden, longest | 0.38 s | ≤0.5 |
| lens in box / min box clearance | 0 / 2.71 m | 0 / ≥1.1 |
| landing yaw (door2 local) | 96.189° | 96.189 |

## E — basket close-ups (test basket-close; her height share of frame, ≥25 % gate)
| shot | before | after | yaw stand (p99) | yaw walk (p99) | hidden | clearance |
|---|---|---|---|---|---|---|
| B1 meadow in | 10.4 % (ride lens 0) | 26.7 % min on hold (29.7 at door) | 18.9°/s (198) | 7.6°/s (12) | 0.30 s | 22.3 m |
| C1 skycity mooring C | 20.7 % | 29.8 % (side −110°) | in lake-leg-c row above | | | |
| B5 skycity landing out | 6.2 % (ride last lens) | 29.3 % min on hold | 58°/s (99) | 6.9°/s (60) | 0.17 s | 4.83 m |
| C2 lakeside door lens | — | 8.6 % (390x844/414x896/360x780), 12.0 (375x667/320x568), 13.2 (390x520), 13.1 (768x1024) | | | | |
All 7 screens give the same B1/B5/C1 numbers (the close-up pose doesn't depend on screen size).
**C2 needs a decision:** it is the approved T-03 option-B wide shot (sign/board constraints), so I didn't change it. Getting it to ≥25 % means replacing that approved framing.
Runtime: the placeholder segments B1/B4B5/C1/C2 in transition-anchors.json are **not read** (setTransitionData is never called). The shots are code-driven (BalloonTransit / SkyLakeContinuous), and those code paths are what changed here.
RegionJourneyCore: after a ride the controller no longer writes the route-end journeyCamera (that write was a hard cut). The ride keeps its last lens, and D hands it to the board.

## Task 1 / Task 5 checks
No new dedicated tests. Coverage comes from existing suite tests on HEAD, all PASS: route-occlusion, route-framing, route-continuity, t02-sky-final (F3 floors), dock-runtime, sail-dock-path, island-exit-explore, island-explore-touch, region-landing-hook, board-handoff.
Not separately verified: A1 continuity from I6, the M4→M6 walk, gangway visibility, and fence west-gate (2.6, −20.8) occlusion.

## Mac-only (needs Creator / device)
Rendered acceptance (renderedAcceptance=BLOCKED_NOT_RUN); real skinned-mesh occlusion of the close-ups; LiveHandoff blend into B1 from the live meadow lens on device; frame-time.

Images: NOT_ENGINE_* are top-down proxy plots (occluder boxes, her path, lens, basket), not renders.

---
## Addendum 2 (2026-10-25 19:xx UTC): Task 1 / Task 5 tests + C2 option B close-up
Commits: 4a9b9b15 live-start · 9545679e t02-dock · cf595be9 gangway-frame (report-only) · f6c3c095 fence-gate · 2ff1f4c0 C2 + import fix.
Suite on 2ff1f4c0: **216 PASS / 0 FAIL / 3 BLOCKED** (same env-only three).

**Bug fixed:** RegionJourneyAdapter used basketCloseSpot/basketClosePose/boardFeetAt (E, 1bea977a) and SKYCITY_LENS_OCCLUDERS (task 4, 08e7ed77) without importing them. The harness doesn't type-check, so all proxy tests passed, but on device the code would hit a ReferenceError. The imports are added, and basket-close K7 now guards against this.

### Task 1: live-start (7 screens, real controller + LiveHandoff from ExploreCameraCore.followPose)
| leg | first frame vs live | blend | yaw max | p99 accel | jumps | live→ride gap |
|---|---|---|---|---|---|---|
| A1 from I6 | 0 m / 0° | 1.48 s | 23.1°/s | 45°/s² | 0 | 4.2 m |
| B1 from M6 (M4/M5→M6) | 0 m / 0° | 6.47 s | 28.0°/s | 54°/s² | 0 | 17.9 m |
Proxy limits:
- The B1 ride lens in this test is plan.camera(0), not the B1 close-up; the close-up is covered by basket-close.
- TransportLeg.SAIL_I6 (−1.9, −0.6, 10.1) is 0.89 m from the re-baked node I6 (−1.5, −0.18, 9.3). SailRide's atI6 tolerance is 0.8 m, so after the node walk she replays a short approach walk. Not changed (scene/flow data).

### Task 5.1: t02-dock (sky_mooring_props.glb triangles, including both ropes, plus the dock occluder rows)
Same on all 7 screens:
| shot | length | lens in box | min clearance (mesh / box) | face/chest hidden |
|---|---|---|---|---|
| approach | 1.4 s | 0 | 25.0 / 24.9 m | 0 s |
| final hold | — | 0 | 25.0 / 24.9 m | 0 s |
| walk handoff | 16.1 s | 0 | 5.04 / 4.9 m | 0 s |

### Task 5.3: gangway-frame (REPORT-ONLY, proposed floor: share ≥ 0.25 % of frame AND ≥ 90 % of the bbox in frame)
| screen | boarding share min–max | disembark share min–max | in frame |
|---|---|---|---|
| 390x844 / 414x896 / 360x780 | 0.47–1.17 % | 0.63–0.67 % | 1.0 |
| 375x667 / 320x568 | 0.38–0.97 % | 0.51–0.55 % | 1.0 |
| 390x520 / 768x1024 | 0.29–0.73 % | 0.39–0.41 % | 1.0 |
Floor rationale: 0.25 % ≈ 820 px² on 390x844 (about 29×29 px), the smallest size at which a 0.6×0.5 m plank still reads as an object at ~9 m. Today's worst case is 0.29 %, on the wide-aspect screens.
Not modelled: occlusion of the plank by her body or the boat.

### Task 5.4: fence-gate (meadow_fence_merged, west gate (2.6, −20.8))
| shot | path length / closest pass to gate | face/chest hidden | fence clearance |
|---|---|---|---|
| walk M4→M6 | 10.1 m / 0.18 m | 0 s | 2.22–2.62 m |
| walk M5→M6 | 10.0 m / 0.15 m | 0 s | 1.95–2.35 m |
| B1 boarding close-up | — | 0.30 s (basket rim, fence 0) | 5.27 m |
Proxy limit: the walk lens is a plain followPose, without RegionNodeStage's orbit/occlude.

### C2 (option B → close-up), basket-close C2 rows
| screen | her at door (wide before) | yaw stand / walk (p99) | translation over cap | hidden | clearance | capsule gap | segment | pull end vs wide |
|---|---|---|---|---|---|---|---|---|
| 390x844 | 29.0 % (8.6) | 6.0 (7) / 8.9 (61) | 0 | 0.15 s | 5.43 m | 277 px | 47.78 s | 2.32 m / 8.1° |
| 414x896 | 29.0 % (8.6) | 6.0 (7) / 8.9 (61) | 0 | 0.15 s | 5.43 m | 301 px | 47.78 s | 2.32 m / 8.1° |
| 360x780 | 29.0 % (8.6) | 6.0 (7) / 8.9 (61) | 0 | 0.15 s | 5.43 m | 248 px | 47.78 s | 2.32 m / 8.1° |
| 375x667 | 29.0 % (11.9) | 5.0 (4) / 8.6 (58) | 0 | 0.15 s | 5.43 m | 221 px | 47.78 s | 2.09 m / 5.9° |
| 320x568 | 29.0 % (11.9) | 5.0 (4) / 8.6 (58) | 0 | 0.15 s | 5.43 m | 175 px | 47.78 s | 2.09 m / 5.9° |
| 390x520 | 29.5 % (13.2) | 7.1 (8) / 10.7 (69) | 0 | 0.17 s | 5.82 m | 173 px | 47.78 s | 1.78 m / 5.3° |
| 768x1024 | 29.5 % (13.1) | 7.2 (8) / 10.7 (69) | 0 | 0.15 s | 5.82 m | 440 px | 47.78 s | 1.78 m / 4.3° |
Timeline (s from touchdown):
- −2.2 → 1.2: blend in from the descent lens. Starting before touchdown keeps the ~9 m move within 5 m/s.
- Hold through stand-up, door reach and the step down (door 1.77 → step lands 4.4).
- 4.4 → 7.8: pull back onto the option-B lens path. It lands exactly on that path (0 m).
- The option-B board blend already starts at 5.3, so the landing point is 1.8–2.3 m / 4–8° from the held wide.
Unchanged: sign, board blend start (5.3 s), boardByS and her walk speed. The capsule is modelled as WeChat's 87×32 button.
Mac-only: the sign now shows over the close-up instead of the wide; its placement uses __qfLakesideAvoid, so check it on device.
