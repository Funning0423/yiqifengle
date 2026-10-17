# Meadow early preload (PR #56, 运镜bot)

Commit 3ee63f6 on local branch `cine/meadow-early-preload`, parent f2adb78 (= 50cba71 + 39ea7a8 + f2adb78).
Resulting tree on 50cba71 + the two gate patches: 523e1a402d08face6b01bf5e79ed7d86a9022d68.
Also applies cleanly (code and manifest, no conflict) on GGbot's current origin head 9b195a2 + the two gate patches
(cherry-picked locally as 5701fac, 229905e). Resulting tree there: 655286f504f0fc9c08ec3a789329412c973851ff
(`rebased-on-9b195a2-plus-gates.patch`). Note: the two gate patches conflict with 9b195a2 only in text-MANIFEST-SHA256.json
(fixed by `node tools/test_manifests.cjs --write`). Their code merges cleanly.

## What triggers it
- `ManagedMobileBoardUI.paintResult`: when a **win** result panel opens, `scheduleSailboatMeadowPreload('result')`.
- Reward popup when a **chest** flips to opened, before `openReward(...)`: `scheduleSailboatMeadowPreload('chest')`.
- Existing triggers are unchanged: exit-camera crane/island settle (WorldFlowComponent) and the driver at sail time. All of them share
  one promise in SailboatMeadowPrefetch.ts, so the meadow is never loaded twice.
- Board `onDestroy` cancels a deferral that hasn't fired yet. A load that has already started is kept, because the prefab stays cached for the sail.

## Expected durations (estimate, not measured)
- With r3 after the gate, all of the extra time was the in-cloud hold: about 1.0 s by day and 0.5 s at night (6.2 s / 5.7 s total).
- If the meadow is warmed before frame 81 (2.70 s after the gate opens, or about 2.63 s allowing for the warm frames), the hold is 0 and
  **day and night both come to 5.20 s** (the model test shows 5.200 s).
- Assumption: the player spends at least the r3 load time (about 3.6 s by day, measured from the island settle) between the win result and the sail tap. This includes the result screen, the
  exit and the exit camera move. That is normally the case, because the exit walk and camera move alone take several seconds.
- Fallback: on a slow network the boat waits in full cloud as before (test: ready 1 s late gives 6.2 s with ≥25 hold frames).
- timing.json is **unchanged** (sha b443e5d1… still asserted).

## Stutter mitigation
- The load starts 400 ms after the panel opens, after the panel's open tween. It is not started on the open frame.
- Only an async `assetManager.loadBundle` and a prefab load happen during the preload. Nothing is instantiated, mounted or warmed while the
  result or chest screen is up. Instantiating and warming happen later in the driver, inside the cloud, as before.
- Repeated triggers (result repaint, chest) are no-ops: there is one timer and one promise.
- If it fails, it is logged and retried once 3 s later. After that the sail-time path retries, and the cloud hold covers it.

## Risks
- `loadRegionPrefab` for the meadow uses `bundle.loadDir('', Prefab)`. Parsing a big glTF prefab on the main thread can still cost a frame or two
  on a low-end phone. On the Mac recording, watch the result and chest screens about 0.4–1.5 s after they open. If there are hitches, give the meadow a prefabUuid
  (loadAny of one asset) as a follow-up.
- The win result appears for every level, not only before a meadow sail. Loading is cheap once it's cached, but it does keep the meadow bundle in memory
  during later levels. It isn't released, because the sail-time path relies on that cache.
- The deferral is lost if the board is destroyed within 400 ms of the result opening. The island-settle trigger still runs.
- GGbot's 9b195a2 touches SailboatMeadowWarmup and MeadowBoardBackground (meadow mount). This patch doesn't touch those files, so they don't conflict.

## Mac rerun: log lines and pass criteria
- `[meadow-preload] start result t <ms>` (or `start chest`): appears about 400 ms after the win panel shows.
- `[meadow-preload] ready result t <ms> took <ms>`: must come **before** the sailboat gate-open log (f2adb78). Ideally it comes before the sail tap.
- A `start late` line means no early trigger fired before the camera or sail path did. That is a fail for the early path, though not a functional bug.
- `[meadow-preload] fail ... <error>`: there should be none on a normal network.
- Pass: day and night totals 5.2 s ±0.2 s (gate open to done), no cloud-hold enter/leave log, and no visible hitch on the result or chest screens.
