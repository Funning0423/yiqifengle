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
