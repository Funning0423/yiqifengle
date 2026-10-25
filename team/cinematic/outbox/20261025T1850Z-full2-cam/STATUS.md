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
