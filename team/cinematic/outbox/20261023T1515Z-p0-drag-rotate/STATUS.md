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

## r17 — 界面验收部 c5889aa2 FAIL (arm collapse / island distance / walk yaw)  ·  commits 176f4ad8, 76a957a1
- P0 root cause (meadow/skycity 0.5–1.5 m): `regionBounds()` returned the stage graph's exploreBox in MODEL-LOCAL coordinates and FreeOrbit.clearPose treated it as a world xz box. The meadow/skycity copies sit far off the origin, so every lens counted as "outside" and clearPose pulled it in to `arm−0.8` → 0.55 m on the first drag (it only appears once the orbit takes over from the follow lens). Our harness stubbed regionBounds=undefined with the models at the origin, so it never hit this path.
- Fix: box corners go through toWorld; `clampArm` keeps the written arm in [3.5, 12] m before the ground guard and ≥ 1.6 m (LensGuard floor) after occlusion; distMax 12 for island/meadow/skycity (island was 52 → the 30–40 m); first drag off a far lens glides (≤ 3 s) instead of cutting; the LensGuard swing nudge is off while walking (island yaw drift).
- Test explore-arm (real regionBounds, off-origin model matrix): before → meadow/skycity settled arm 0.55 m (jumps 883 m/s), island 16.1 m, lakeside 14.6 m: FAIL 4. After → 12.0 / 12.0 / 12.06 / 12.28 m, min ≥ 10.8 m: ok. A3 walk-end yaw gap 0° and A4 island walk drift pass both before and after: the harness does NOT reproduce the lakeside 171° snap or the island 36° drift.
- NOT FIXED / unverified: lakeside walking occlusion (canopy, boardwalk post, bridge rails) and the walk-end yaw snap. Their root cause is not found; they need engine capture.
- Suite: 168/171, 0 FAIL (3 BLOCKED: node<22.6 ×2, browser ×1). suite-r17.log.

## p0drag5 — lakeside explore entry is a fixed wide shot until a ground tap (Mac r16c fc742aa2) · branch cine/p0drag5 from 2b5f435a · commit 7a872914
- Cause (from the code path, NOT ENGINE-confirmed): after 「离开棋盘」 explore opens via the 4 Hz syncExplore poll → openExplore, and the r16 entry pre-solve/glide + orbit writer DO run on the stage camera. But the board's own live LakesideBackgroundCamera (fixed shot, priority 44) stays enabled and keeps drawing over it. Only groundTap raises the cover (disables *BackgroundCamera), which is why following "starts" at the first tap. The state guards, entry hook and hold path are not involved (the harness shows writer :orbit+entry from frame 1, holdPose null).
- Fix: syncExplore → takeSyncView(region) disables the enabled *BackgroundCamera(s), hands the region's background shot to the stage camera (so the r16 entry glide starts from what is on screen, no cut), then openExplore. releaseSyncCams() restores them on sync close and in restoreBoard.
- Test explore-entry-follow (real syncExplore/openExplore/tickLens + CamTrace sub-paths, stubbed scene with the background camera): before → F1 FAIL (background camera still on at 0.1 s), F2 FAIL (no hand-off of the on-screen shot). After → writer region.node-lens:orbit+entry from frame 1, bg camera off by 0.1 s, first pose 0.00 m from the shot, max step 0.29 m/frame, glide done at 2.8 s, standing 1 m drift (no tap) → lens +0.74 m, aim +1.18 m, bg camera restored on close.
- Mac camTrace check wanted: frame 1 after board exit should show `region.node-lens:orbit+entry` AND the LakesideBackgroundCamera disabled.
- Suite: 170/173, 0 FAIL (3 BLOCKED: node<22.6 ×2, browser ×1). suite-p0drag5.log.

## p0drag5b — GGbot review of 8d6d6279: background-camera release risk · commits d2661bc5, 25a6fb4a
- New region/BgCamGate.ts. The owner's setVisible is the source of truth: the Lakeside, Meadow and Skycity background owners call bgCamWant(camera, visible), which records what they want and draws only if explore isn't holding the camera.
- takeSyncView holds only the current region's camera (exact name: Lakeside/Meadow/SkycityBackgroundCamera) and records the region and model instance.
- releaseSyncCams → bgCamRelease re-enables a camera only if all of these hold: its owner still wants it visible, it is valid and in the hierarchy, and the region and model are the same as at take time. Otherwise it only drops the hold, and the owner's next setVisible decides.
- explore-entry-follow adds G1–G4:
  - G1: other regions' cameras are untouched.
  - G2: an owner setVisible(true) while held keeps the camera off; a normal exit restores it.
  - G3: a background hidden during explore stays off after exit; the owner can show it again.
  - G4: after a region change during explore, the old camera stays off.
  - On 8d6d6279, G1, G2 and G4 fail; G3 couldn't be cleanly measured there.
  - With the fix, F1–F4 and G1–G4 all pass.
- lakeside-board-preload source regex updated for bgCamWant. Added BgCamGate.ts.meta.
- Suite: 170/173, 0 FAIL (3 BLOCKED: node<22.6 ×2, browser ×1). suite-p0drag5b.log.

## p0drag6 — every board-background camera switch goes through BgCamGate · branch cine/p0drag6 from c7a0c4e4 · commit 036ea4ae
- BgCamGate holds are now per holder ('explore', 'cover'), so they can overlap. The camera draws again only when the last hold is released, and then only if its owner still wants it (bgCamWant from setVisible), it is valid, and it is in the hierarchy. New helpers: bgCamWanted, bgCamWarmOn, bgCamSettled.
- Walk cover (RegionNodeStage.showWorld/restoreBoard) uses bgCamHold(c,'cover') and bgCamRelease(c,true,'cover',x.on). The old on/off snapshot is used only as a fallback for a camera whose owner never recorded what it wants.
- Board warm-up (RegionBoardStaging) camOn skips a held camera and turns the camera on through bgCamWarmOn. camOff sets bgCamSettled(cam,saved), i.e. the owner's current want and holds, not the stale snapshot.
- Other direct `.enabled=` writes on cameras (grep) only switch them off and are left as is: owner dispose/construction, GLB-embedded cameras, and the SailShot QA tool.
- Test bgcam-gate (real showWorld/restoreBoard/syncExplore/RegionBoardStaging, NOT ENGINE):
  - W1: walk cover + owner setVisible(true) mid-walk → off during the walk, on after it.
  - W2: walk cover + owner setVisible(false) mid-walk → off after it.
  - W3: explore and cover overlap → off until both are released.
  - W4: warm-up during a hold never draws; W4b: warm-up without a hold still runs.
  - W5: another region's camera follows its own owner.
  - W6: source scan finds no ungated camera switch-on.
  - Results: on c7a0c4e4 all checks fail except W4b; on 036ea4ae all pass.
- test_region_board_staging loader maps ./BgCamGate.
- Suite: 172/175, 0 FAIL (3 BLOCKED: node<22.6 ×2, browser ×1). suite-p0drag6.log.

## p0drag7 — Mac p0drag6 (42d0982f) FAIL items 1/2/3/5 · branch cine/p0drag7 from 42d0982f · commits ce258d9f, 0edb5a0d, f-tests
- 1 Skycity entry. Cause: syncExplore snapped her to the nearest node (standOnWalk), but openExplore then seeded the orbit from the shot on screen, measured from her NEW spot (≈29 m, aim at the old spot = sky). preSolveEntry/LensGuard only run where proxies exist, so nothing wrote the lens until the first drag. Fix: standOnWalk returns whether it snapped. After a snap, openExplore re-seats the orbit on her (follow lens, as qaTeleport), runs preSolveEntry where proxies exist, and glides from the on-screen shot (≤ 2.5 s). tickLens writes the orbit while an entry glide is running.
- 2 Lakeside 9.7↔6.5 m flips. Cause, from trace_lake_walkdrag (lg.cost 0, share 1, fo.arm 9.08 constant): LensGuard is idle; FreeOrbit.clearPose's renderer-AABB pull-in switches on/off as the dragged yaw crosses a box edge (yaw 223→227, 219→215, 216→220). Fix: region/ArmSmoother on the written arm:
  - hysteresis: a goal > 0.35 m away must persist 4 frames; a push-out also needs ≥ 0.45 s since the last switch;
  - then a critically damped spring (ω 7) rate-limited to 6 m/s in, 3 m/s out.
  - The entry glide bypasses it.
- 3 Skycity houses. New region/SkycityLensOccluders.ts: 354 boxes, 8.2 KB, generated by tools/region-nodes/gen-skycity-lens-occluders.cjs. Source: env_skycity.glb (Draco) ruins + static palette, voxels at 0.5 m, floors and slabs below 2.2 m dropped, 2 m columns.
  - Skycity now has LensGuard on these proxies, plus outOfProxies: if the look→lens segment enters a box, the lens climbs (same arm, ≤ 78°) or swings (least yaw, ≤ ±90°).
  - Only if neither is clear does it stop 0.3 m in front of the box.
- 5 update() calls traceFrame every frame when ?camTrace=1 is on.
- Test p0drag7 (real stage code + Mac trace data; NOT ENGINE):

  | Check | before (42d0982f) | after |
  |---|---|---|
  | K1 snap entry | FAIL: no writer, lens 47.6 m, her 28.9° off axis | PASS: orbit+entry from frame 1, arm 9.0 m, 0° |
  | K2 trace replay (300 frames, raw max jump 3.38 m) | FAIL: written max jump 3.38 m | PASS: 0.10 m |
  | K3 east o0/o1/o5 | FAIL: no proxies; o1's raw lens is inside a house box | PASS: 7.3 / 8.0 / 7.5 m arms, outside all boxes, clear sight line |
  | K4 trace rows in explore | FAIL: 0 rows in 30 updates | PASS: 30 rows |
- Item 4 (S3 walk detours / kind none) → 场景设计部; item 6 (QA strings in the wechat package) not touched.
- Suite: 173/176, 0 FAIL (3 BLOCKED as before). suite-p0drag7.log.
