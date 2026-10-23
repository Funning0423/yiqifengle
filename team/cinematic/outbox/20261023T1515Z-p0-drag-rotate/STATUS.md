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

## r16 lakeside occlusion round 3 (GGbot r15 web check e3b881d8: ①–④) — commit cf50fcd8 on ebd316a7. NOT merged, not pushed.
Causes:
- ① entry canopy: explore opened on the board-exit lens and NOTHING wrote the lens in MapExplore until she walked (orbit not engaged,
  not FollowWalk), so LensGuard never ran for the first 2–3 s. Also the tree TRUNK proxies were broken: the generator boxed per vertex
  below the 38 % cut, and a trunk is one prism whose only low vertices are its foot ring → the trunk box collapsed to the foot.
  Fix: RegionNodeStage.preSolveEntry (pick the clear orbit yaw/pitch/arm nearest the seed by LensGuard cost, warm LensGuard to
  convergence, glide there at ≤ 7 m/s peak), MapExplore keeps writing through LensGuard while she stands (lakeside/island);
  generator boxes per TRIANGLE clipped at the cut.
- ② boardwalk "post": reed cards (LK_reed_card 1.4 m, 47×), west reeds, chime cells, buoy lanterns had no proxies (the tall beige
  slabs in lkd_m). Added. Near-lens clutter now also costs linearly (one or two of the 9 rays within 3 m already move the lens).
  NOTE: my geometry boardwalk walk did not reproduce a block BEFORE either (0/7803 frames) — the exact Mac post is unconfirmed.
- ③ arch bridge: no elevation rule on decks. New LAKESIDE_DECK_ZONES (14 plan boxes: boardwalk, bridge, steps); on them LensGuard
  raises the designed lens to ≥ 28° over her chest, eased at ≤ 2.5 m/s.
- ④ island palm after pitch-down: with the player holding the yaw no swing was allowed and crane/pull-in alone cannot clear a palm
  right behind her. Now, only while her HEAD is blocked, a ±30° swing nudge is allowed (drag test still: yaw holds, gap ≤ 4°).
Test lakeside-entry-deck (geometry: real GLB triangles incl. reeds, NOT a render; BEFORE = ebd316a7 code):
- E1 entry, 19 blocked/cluttered exit lenses beside trees: hidden frames after glide BEFORE 1425 / AFTER 0; near-lens fill 375 / 0;
  hidden at 0.8 s 19/19 → 2/19 (still gliding); glide ≤ 3.03 s, peak 6.91 m/s (≤ 9). During the glide her body is still hidden
  in ~0.6 s on average (326 frames / 19 cases) — the glide starts from the blocked lens by definition.
- E2 boardwalk (9 lenses × 2 ways, 7803 frames): hidden 0 / 0, fill 0 / 0 (not reproduced before, guard only).
- E3 arch bridge side-on (2060 bridge frames): min elevation 15.4° → 28°, frames < 25°: 1050 → 0, hidden 21 → 0.
- E4 island palm, pitch 5° held: hidden-by-palm frames after 1 s 120 → 0 (4 cases).
lakeside-lens-guard: its low orbit lens moved from −8° to the new 5° floor (−8° is unreachable since 98425e8d); still PASS (G1–G5).
run-suite: lakeside-lens-guard and explore-drag-rotate timeout 360 s (others 180 s); lakeside-entry-deck added.
Size: source +2301 B LensOcclusion, +3364 B LakesideLensOccluders (1373→1446 boxes + 14 deck zones), +3246 B RegionNodeStage;
  transpiled ES5 w/o comments ≈ +7.95 KB (pre-minify estimate; the build will be smaller). Of the 1,102,067 B left. NOT measured in a real build.
Renders r16_{entry,post,bridge}_before-left_after-right_NOT_ENGINE.png: software ray-cast of the real triangles, flat colours, her = yellow capsule.
Suite at cf50fcd8: 166/170 — 3 baseline env blocks + exit-footsteps FAIL under full-suite load (stdout all PASS, killed; alone PASS in 20 s;
  audio-timing test, not camera). New tests explore-drag-rotate, lakeside-entry-deck, lakeside-lens-guard all PASS in the suite.
GGbot DevTools additions: open lakeside explore and stand 3 s (no canopy after ≤ 3 s glide), walk the boardwalk (reeds/posts), cross the arch
bridge (lens looks down over the railing), island: drag down beside a palm (lens nudges/lifts so she shows).
