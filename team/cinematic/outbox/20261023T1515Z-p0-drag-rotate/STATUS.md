# P0 drag-rotate (camera side) — 运镜bot
Branch cine/p0-drag-rotate. Base 410e1bd5 (GGbot input fix) + clean MERGE of 31b21344 (b17r13 LensGuard) = c9419546.
Commits: 87174392 (fix + test), 235651a0 (LensGuard held-yaw rotation only while held). Not pushed.

## Root cause per region (camera side)
- island: the touch never reached ExploreInput (fixed by GGbot 410e1bd5). Camera side: WorldFlow settleOrbit stands down on exploreEnabled(); IslandHome feed returns before its own orbit; the only writer is RegionNodeStage.tickLens → orbit. LensGuard (island occluders) could swing the lens up to ±75° in world space against the drag → now holds the user's yaw.
- meadow / skycity: no camera-side fighter found. Drag → orbit engaged → shouldWrite → orbit wins over followPose every frame; guardOrbitGround only lifts/pulls in. Test proves yaw turns and stays (drift 0°).
- lakeside: LensGuard (b17r13) offset in world space + swing candidates pulled the yaw back after release (measured before fix: 4.1° drift S1/S4, would grow near dense canopy). Fix: when orbit engaged (user owns yaw) plan with swing=0 only (crane/pull-in stay), and rotate the spring offset with the raw lens yaw around her.
- 'returning'/'board' mode drops (hypothesis b/d) did NOT reproduce through the real path (handOrbitBack disarms before explore), so FreeOrbit was left unchanged.

## Test
tools/region-nodes/test_explore_drag_rotate.cjs (in run-suite as explore-drag-rotate): real ExploreInput (global input; island via IslandLighthouseTouch feed) → sink → real RegionNodeStage.onGesture/aimOrbit/tickLens/writeOrbit/occlude (transpiled from source; scene stubs) → real FreeOrbit + LensGuard.
4 regions × 4 states (S1 MapExplore after board, S2 ground-walking, S3 FollowWalk unengaged, S4 drag during return). D1 turn ≥80% of 128°×120/390; D2 drift ≤4° over 3 s after settling. All 16 PASS (report explore-drag-rotate.json). NOT engine capture — logic test.
Also refactor: RegionNodeStage.update's lens branch moved verbatim into tickLens(dt).

## Suite
HEAD 235651a0: 166/169 PASS, 0 FAIL; 3 baseline env blocks (2× Node ≥22.6, navigation-guard browser). Interim run at 87174392 had lakeside-lens-guard G4 FAIL → fixed in 235651a0.

## Steps for GGbot (Mac WeChat DevTools)
1. `pgrep -f MacOS/CocosCreator` — if Funning is in Cocos, wait.
2. `git fetch` from the box worktree / checkout cine/p0-drag-rotate @ 235651a0 (local, not pushed: copy via the usual bundle).
3. Cocos Creator 3.8.8 → Build wechatgame (same settings as b17r14), open the build in WeChat DevTools, simulator iPhone 12/13 (390×844).
4. For each region island, meadow, skycity, lakeside: enter explore; (a) standing still drag one finger ~1/3 screen right → camera orbits ≈40°+ and STAYS for 5 s; (b) tap ground / walk, drag during the walk → yaw holds while she walks; (c) during a node walk (FollowWalk) drag → orbit takes over and holds; (d) drag vertical → pitch changes (direction: up = lower camera, per r14 — design confirm); (e) lakeside: repeat (a) beside the ring trees / under canopy — no swing-back after release, lens still lifts/pulls in to avoid trees.
5. Record a short screen video per region, delete builds/recordings afterwards (Mac ~4 GB free), keep ms-playwright, cursor-tasks, QIFENGLE-test-build05.

## P0 pitch follow-up (Grok Bot 2026-10-23: keep r14 direction — drag up lowers the lens — no invert)
Commit 98425e8d (on e22143e8). NOT merged anywhere; WeChat DevTools test still pending.
Limits (FreeOrbit.ORBIT_LIMITS, elevation of the lens over her look point):
- island 5°..58°, meadow 5°..48° (distance floor 9° at 3.2 m → 5° at 14 m, was -8 → -12), skycity 5°..55°, lakeside 5°..54° (board lens 53.3 still fits).
  Old minimums: island -8, meadow -12, skycity -6, lakeside -10.
- LensGuard crane ceiling (over her head pivot) 80° → 68° (CRANE_MAX_ELEV_DEG); swing is already off while the player holds the orbit.
- Ground: lens ≥ 1.0 m over her feet everywhere (min measured 1.79 m); LensGuard floor (feet + 1.2 m / walk floor + 0.8 m) still applies on lakeside/island.
Test explore-drag-rotate extended: 5 stands (4 regions + lakeside deck at the raised walk floor) × 7 route screens × 6 extreme vertical scripts
(slow 1.5-screen up/down, 2-frame flicks up/down, alternating flicks, flick while walking) = 210 cases. Asserts P1 elevation in [4.5°, 70°] and
orbit pitch within limits ⊂ [5°, 65°]; P2 ≥1.0 m over her feet, ≥0.5 m over deck; P3 plan distance ≥0.5 m, no yaw jump >20°/frame, view never upward; P4 up ends lower than down.
Before (old limits) → after, worst case per region (min elevation / min height over feet):
- island 0.4° / 1.21 m → 5.0° / 1.79 m (max elev 61.5 → 69.0 with crane, ≤70)
- meadow -7.6° / 0.45 m → 7.7° / 2.13 m
- skycity -5.2° / 0.48 m → 5.8° / 1.89 m
- lakeside 0.4° / 1.20 m → 5.0° / 1.79 m; deck stand: deck clearance 4.22 m (deck case added with the fix)
- before: 168/168 pitch cases failed (lens under her chest, looking upward); after: 210/210 pass. Yaw jump 0° in all cases.
test_meadow_pitchfloor updated to the new curve (9→5) and allows the 4 explore regions to differ from the old base/outdoor baseline (board + home still bit-identical).
Suite at 98425e8d: 165/169 — 3 baseline env blocks + lakeside-lens-guard killed by the 180 s per-test cap under full-suite load
(standalone PASS in 155 s; focused rerun `run-suite.cjs lakeside-lens-guard explore-drag-rotate free-orbit` 3/3 PASS). Timing flake, not a regression.
GGbot DevTools step 4d: drag up = lens lowers (kept); also flick hard up/down in each region: never under ground/deck, never over her head.
