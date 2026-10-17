# Meadow early preload r2 (memory rules) — 运镜bot, 2026-10-16T02:49Z

Replaces meadow-early-preload-20261016T0239Z (ac46c3c). Grok Bot review changes: preload only for a meadow-bound win; release when the meadow goes away; loadDir unchanged.

## Stacking order (what GGbot stacks)
1. 9b195a2 (origin/feat/sailboat-transition-20261015 before the gates)
2. gate 0001 "Start the sailboat sting and clock only after the exit camera settles."
3. gate 0002 "Log the sailboat gate open, sting start and cloud hold enter/leave…"
   (= local 229905e, tree e87e222d; identical tree to the pushed PR #56 head af03d32)
4. `0001-meadow-preload-r2-on-9b195a2-gates.patch` (single commit; contains the whole preload, do NOT also apply the old ac46c3c patch)

Result: tree **5f41b387fa5d4ab0fe53bd0954fa4b994ecd82fa** (local head 0a23588 on 229905e; `git am` on af03d32 gives the same tree, head 04e7723 locally — head differs by committer, compare trees).

Alt: `alt-0001-meadow-preload-r2-on-f2adb78.patch` on f2adb78 (50cba71 + gates, without 9b195a2) → tree ab9e9011bfbc4b5d58e01b526ac56076470f0517 (head ca2aa1a). Not the one to push.

## Condition (when it preloads)
`meadowSailNextStage(s)`: board snapshot has `active.status==='won'`, `state==='result.saved'`, `result.completionRecorded`, and `nextStageId` passes `requiresMeadowScene` (r05-meadow-* or mainline-05..08) — the same test `playRegionArrival` uses to start the sailboat (advanceMainline/advanceRegistered → exitLevel → enter nextStageId → sail).
Triggers: result panel (win) and chest reward popup, via `maybeScheduleSailboatMeadowPreload(reason, s)`, deferred 400 ms. Every other win logs `skip` and loads nothing.
Note: by the code, meadow→meadow "next" also sails (every meadow entry plays the sail), so mainline-05→06 etc. also preload; there the bundle is usually already resident, so it is a cache hit.
Pre-existing (unchanged) late trigger: exit-camera crane / island settle in WorldFlowComponent still calls prefetchSailboatMeadow().

## Release
The module takes ONE `addRef` on the finished prefab; `releaseSailboatMeadow(reason)` drops it once (`decRef(true)` → Cocos auto-release frees prefab + deps if nobody else holds them). The live meadow board background holds its own refs (unchanged), so a release never frees what is on screen.
Release points:
- `meadow-unload`: last live meadow board background disposed (`noteMeadowLease(-1)`), unless an early preload is armed for the coming sail (meadow→meadow exit). The sail driver's cleanup calls `consumeSailboatMeadow()` to disarm.
- `not-meadow`: flow enters a non-meadow stage (playRegionArrival null branch).
- `home`: camera settles at home (sail abandoned / next flow not meadow).
Double release is a no-op; a load that finishes after a release takes no ref (`late-after-release`); a pending deferral is cancelled.
No `releaseUnusedAssets`/`removeBundle`: other loadDir prefabs in region_meadow (if any) keep refCount 0 and are not force-freed (bundle shell stays registered) — deliberate, to avoid freeing assets a live meadow node still uses.

## Logs (Mac rerun)
`[meadow-preload] start <reason> t <ms>` · `ready <reason> t <ms> took <ms>` · `fail …` · `skip result|chest next <id|none>` · `release <meadow-unload|not-meadow|home> t <ms> leases <n>` · `late-after-release …`

## Pass criteria
- Win on mainline-04 (→05) / r05 meadow chain: `start result` ~400 ms after the panel; `ready` before sail; sail 5.2 s ±0.2 s day and night, no `[sailboat] hold enter` on normal network.
- Win on any non-meadow-bound level: `skip …`, no `start`.
- Leaving meadow to home / non-meadow stage: exactly one `release`.
- No dropped frames / hitch on result panel and chest popup during `start`→`ready` (loadDir kept, judge by recording).

## Tests (Node 22.14, TS 5.9.3, cc.d.ts) — all pass on both bases
test_meadow_preload (new cases: non-meadow win no load, meadow-bound win loads, release on unload, armed survives old-meadow unload, no double release, live meadow keeps its ref, release during in-flight load, sail gets cached prefab), test_sailboat_transition, test_sailboat_audio, test_manifests, camera-frame-test/test_es5_safety, meadow/test_meadow_night_sky (9b195a2 base only; file absent on f2adb78).
Other tools/*.cjs touching these files: same pass/fail as base (env-dependent failures pre-exist).
