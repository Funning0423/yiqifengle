# Lakeside journey wiring (Voice Bot)

The island→lakeside journey is now reachable from region select. There is one call site where 运镜bot's landing→board hook plugs in.

- **Branch:** `voice/build05-lakeside-journey-wire`
- **Commit:** `4728814a9b0b7daafc15b4a5a06abbe663546699`
- **Tree:** `0d0bd88b749751826ace9626450979a6f87a5fbb`
- **Base:** `c375304` (运镜bot's cine/lakeside-cam). It is one commit and was checked with `git apply --check` on a clean c375304. Not pushed.
- **Files:** `0001-*.patch`, `lakeside-journey-wire.bundle` (c375304..branch), `landing_to_board_continuity.png`, `curve.cjs`, `suite.txt`, `SHA256SUMS`.

GGbot can stack it like this: 0932b6b..c375304 (运镜bot), then this patch.

## What changed
### 1. 'lakeside' added as a journey region
- `RegionJourneyCore`: `JourneyRegion` now includes `'lakeside'`. `validateJourneyRoute` accepts island→lakeside. meadow→lakeside and lakeside→anything are still rejected.
- `WorldFlowCore`: `Place` and `State` now include `'lakeside'`. The `prepareRegion` origin list and the `leaveJourneyForIsland` state list include lakeside, so 主页 works from lakeside.
- `RegionCameraData`: added a stop `{id:'lake', pose:null}`.
- `WorldNativeComposition`:
  - `ensureRegion` uses the branch order `['island','lakeside']` for lakeside. The mainline order `['island','meadow','skycity']` is unchanged.
  - Lakeside skips the mainline `RegionCampaign.canEnterRegion`, because lake is not a campaign region. The stage gate is still `CampaignHost.inspectSelection` in `selectProvider` / `enterSelectedLevel`.
  - Lakeside is not reachable from meadow or skycity: it returns `return-route-not-yet-available`, the same as other reverse routes.
  - The selectProvider state list includes lakeside.

### 2. `selectionRegion`
`r04-lake-*` (and a future `r05-lake-*` renumbering) maps to `'lakeside'`. Mainline stages still use their campaign regionId.

### 3. Mounting the lakeside model
`RegionJourneyAdapter.prepare(to='lakeside')` calls `prepareLakesideJourney`:
- It uses the shared `mountLakesideScenery`, which was extracted from LakesideBoardBackground. It mounts the same 431 real instances on the default layer.
- Placement comes from `lakesideJourney(start)`: rotation is `setRotationFromEuler(0, yawDeg, 0)` and position is `setWorldPosition(root)`.
- The route is approach + bridge + arrival, with focus, landing and startBlendM 0.
- It uses the same rainbow bridge strips as the other legs.
- Speed comes from `REGION_JOURNEY_LAYOUT` through `lakesideJourney`. pitchDeg (64) and route speed are unchanged; 运镜bot will update them.

### 4. Landing→board hook (owned by 运镜bot)
- The single call site is in `WorldNativeComposition.enterSelectedLevel`, between `ensureRegion(region)` and `enterLevel`, inside the block marked `===== LAKESIDE LANDING → BOARD HOOK =====`.
- It calls `lakesideLandingToBoard({stageId, journey})` from the new file `region/LakesideLandingHook.ts`. This is a stub that resolves straight away, so the existing hard cut stays. It carries a `TODO(运镜bot)` marker.
- To swap in the real hook, change one import (or the stub body). It must resolve and must never reject.
- Per Grok Bot, I did not build any blend logic.

### 5. UI (WorldIntegrationBoot)
`'lakeside'` gets the same handling as meadow:
- 继续旅程 and 主页 buttons, region nav placement and the inRegion flag;
- sign-away state;
- loading notice "正在准备风铃湖畔".

### 6. Failure logging
Failures are logged with `console.error('[QF_LAKE] …')` in three places:
- lakeside journey prepare failure (then release and rethrow, so the journey shows as failed with a retry);
- board-background load failure;
- `ensureRegion` not reaching lakeside.

### 7. No Set/Map spreads (downlevel-safe)
- `[...new Set(...)]` in LakesideBoardBackground is now `Array.from(new Set(...))`.
- My new code has no spreads of Set, Map or other iterables. The only spreads left are of plain arrays.

## Skip and background behaviour (V1)
The lakeside journey runs through the same `RegionJourneyController` and `WorldFlowCore.travelRegion` / `operate` path as island→meadow:
- background: suspend → paused → `resume()` → `resumeJourney` re-enters the pending selection;
- cancel and 主页: `leaveJourneyForIsland` / `returnToIsland` dispose the lakeside lease;
- set-off fade: from the island with `startBlendM` 0, the same as 04→05.

There is no lakeside-specific code path for this. It hasn't been checked on a device.

## Audio
- **There is no lakeside BGM or ambience asset.** `SceneMusic.sceneTrackFor` already maps the lakeside board (region 'lake') and the 'lakeside' state to the **island** BGM (`audio_bgm_island`).
- `AmbienceAudio` (the sea waves bed, driven by outdoor/wind) keeps running, so the lake gets the sea waves. That's acceptable for now.
- I didn't create any audio or code change. Flag for whoever owns audio: a gentle lake or wind-chime loop would suit this region better than the sea waves.

## Camera continuity (landing→board)
`landing_to_board_continuity.png` plots the last 4 s of the Landing A arrival and then the board camera at 390×844, with `boardTop` 300. The board pose is shown in lakeside-world coordinates via `toWorld`.

With the current stub the cut is about 22.8 m, a 61° view turn, and FOV 48°→72°. This is the gap 运镜bot's hook will close.

In the game the board background is a separate rig and camera at priority 44, so the cut is also a switch of scene instance.

## Tests
- **New `test-lakeside-journey-wire.cjs`: 8/8 pass.** It covers:
  - selectionRegion mapping for all catalog stages;
  - the real `ensureRegion` class method (island→lakeside in one travel, meadow→lakeside refused);
  - `enterSelectedLevel r04-lake-01`: travel lakeside → hook → enterLevel, in that order;
  - validateJourneyRoute on the real route;
  - reachability from region select (button → enterRegion('lake') → catalog stage 1);
  - the adapter calling lakesideJourney;
  - exactly one hook call site;
  - pitch unchanged.
- `test-lakeside-camera` K1 now expects island→lakeside to be accepted, as its own comment anticipated.
- **Full suite: 51/56** = baseline 50/55 + the new test. The 5 failures are the known ones: production-integrity, legacy-board-ui-pure, reward-background-return, cloud-web-contract, and navigation-guard (BLOCKED_BROWSER).
- `tools/test_region_journey_host.cjs` still passes. It evaluates only the class body, so the routing logic is written inline in the class.

## Size
- No assets were added. The bundle is unchanged, because `region_lakeside` is already shipped.
- The script diff is about 34 KB of unified diff (about +150/-34 lines, mostly comments and long lines), so the minified game.js grows by an estimated 3–5 KB.
- At runtime the journey loads `region_lakeside` while the island scene stays alive, the same as with meadow.

## Risks
- **Memory / draw calls:** the island scene and 431 lakeside instances are live together during the journey. Not measured on a device.
- **Lighting:** the journey scene uses the world's lights, not LAKESIDE_LIGHTS, so its look may differ from the board background until the dirlight work lands.
- **Visible cut:** the hard cut at landing end stays until 运镜bot's hook is in.
- **Possible merge conflicts:** GGbot's repo-wide Array.from pass may conflict in LakesideBoardBackground.ts, on the single line I already changed.

## Set/Map spread audit of my earlier commits (dbcc5aa..0932b6b)
- There is one spread of a Set: `region/LakesideBoardBackground.ts`, `const missing=[...new Set(...)]`. It is fixed in this commit because I touched that file.
- Every other spread in that range (for example `LakesideSceneData.ts` `[...c.position]`, `[...c.rotation]`) is a spread of a plain array tuple.
- All `for…of` loops in that range iterate arrays only.
