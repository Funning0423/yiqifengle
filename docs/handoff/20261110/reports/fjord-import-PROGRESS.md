# Fjord first import (region/fjord-wireup @552b51e5, PR #85)
- 22:00 EST: start. Read docs/handoff/fjord-wireup.md. merge-base(552b51e5, integ 4543a2fc) = 95dc672d. Integration branch still @4543a2fc.
  - env_fjord.glb.meta is `imported:false`, subMetas {} (needs Creator). Same for env_cloudsea / env_hotspring / env_rail .glb.meta on this branch (stacked regions) -> Creator will rewrite those too.
  - Guard requires a clean tree after build => those rewrites must be committed (at least locally) or the guard rejects.
  - "debug 预设": unlock-* qfPre keys exist only on region/hotspring-wireup (4afe1faa: unlock-snow/rail/cloudsea/hotspring), NOT on fjord branch, and there is no unlock-fjord key.
- 22:00 EST: Mac (e79aaea8) unreachable ("temporarily unreachable"); retrying. Box disk 415 MB free.
- 22:03 EST: LOCAL QA-only branch qf-fjord-qa (never pushed): cherry-pick 4afe1faa (unlock-* presets from region/hotspring-wireup, clean) + 6b8f2e03 adds `unlock-fjord` (lake/snow/rail/cloud/spring cleared by the real provider) and `unlock-fjord-08` (also fjord 01–07, keeps the won 07 board so the journey opens 08). Node check (/workspace/fjordmac/test_unlock_fjord.cjs): selection r10-fjord-01 seed 1 / r10-fjord-08 seed 1, inspectSelection ok.
- 22:08 EST: Mac reachable. Lock /tmp/qf-lock-yunjingbot held by 运镜bot (since 10:54 CST = 21:54 EST), no DevTools; Mac free 7.8 GiB. Work dir ~/qf-autoplay/scene-20261109T2215-fjord/. waitlock.sh (pid 55562) waits for the lock, then runs p1.sh (Creator first import on 552b51e5 in a throwaway clone).
- 22:18 EST: steering: before each DevTools open run cli quit, confirm no own leftover procs, cold start; go.sh now does that + one cold restart if no result.json. If it still fails while the Mac is locked: finish import+build, defer shots, report, release lock. Still waiting for 运镜bot lock (DevTools running).
- 22:31 EST: Mac lock taken (/tmp/qf-lock-scene-fjord) after 运镜bot released. P1 Creator 3.8.8 import on 552b51e5: rc=36, 0 error lines, no 「当前初始场景不存在」, 5 metas rewritten, 0 metas added:
  env_fjord.glb.meta (imported true; 16 gltf-mesh, 1 gltf-animation aurora_sway @dbbe6, 2 gltf-material M_FJ_vertex @0e8e8 / M_FJ_unlit @d3c16, gltf-scene env_fjord.prefab @75d07),
  env_cloudsea / env_hotspring / env_rail .glb.meta (same first-import story, other regions on this stacked branch), transport_balloon.glb.meta (balloon c9dd7 rewrite, discarded).
  Unguarded build: region_fjord 207,780 B, total 24,091,996 B. No meshCompress set (not needed under 943,718).
- 22:33 EST: commit ab820b58 (fjord-meta, on 552b51e5) = env_fjord.glb.meta only. LOCAL test head qf-fjord-test 177e591c = ab820b58 + 1f753356 (other regions' 3 glb metas, local only) + QA presets. Box pre-run of 4543a2fc meta-allowlist gate, default base: merge-base -> 95dc672d, PASS metasChanged=27 fails=0.
- 22:34 EST: go.sh started (guarded build + DevTools). Mac screen is LOCKED (CGSSessionScreenIsLocked=True).
- 22:35–22:43 EST: guarded build PASSED (details in report). DevTools run1 (390 & 430) launched fine while the screen was locked, cold start each, 0 console errors, but the script tapped the journal focus card only -> region page opened, board never entered (needs 'Continue-fjord'); 2nd preTransition failed journal-overlay-not-ready. Script fixed (tap Continue-fjord). Lock released 22:43; qftester-pr81 took it; waitlock queued go-play.sh (play-only rerun on the same build).

## 22:35 EST — guarded build (done)
- Test head 177e591c (LOCAL, not pushed) = ab820b58 + 1f753356 + QA presets. Guard = 4543a2fc tools/build-guard copied into the clone's tools/build-guard (14 files, assume-unchanged/exclude, not committed), run from repo root, META_ALLOWLIST_BASE unset.
- `BUILD GUARD PASSED: wechat-release 24100578 (strip=0)`, Creator exit=36, try 1/3, dirty=0.
- meta-allowlist: base chosen merge-base HEAD origin/gbt/r5-b20-integrate-landing-visual-bg2 -> 95dc672d, PASS metasChanged=27 allowedChanges=27 fails=0 (no META_ADDED / NOT_ALLOWED).
- WARN balloon: Creator rewrote only transport_balloon.glb.meta; guard restored it, hash 3722fde5… = pre-build baseline. Not committed.
- PLACEHOLDER GATE PASS: 0 hits in 2 dirs (creator-build-project/assets, build-templates), 1067 files.
- Measured bytes (TEST build, probes kept): region_fjord 207,780 B (limit 943,718); region_hotspring 97,169; region_cloudsea 60,576; region_rail 97,509; total 24,100,578 B (release cap 24,641,536).

## DevTools (deferred — Grok Bot 23:07: Mac locked, shots tomorrow)
- run1 22:35–22:43 EST (screen locked, cold start): simulator OK both sizes, 0 console errors, unlock-fjord reached the journal focus card but the script did not press Continue-fjord -> no board. No usable board shots/perf.
- run2 22:53 and run3 23:02 EST (cold start after cli quit, devtools=0): `simulator launch failed` (WeappLog). Evidence: in both failing logs DevTools issued 4 simultaneous builder requests `shouldCreate=true reason=simulatorType changed old=undefined new=wechat` -> stale builders (generation 2..5) -> launch failed; in the 2 good runs only 1 such request. Started after another bot's DevTools session (qftester-pr81) ran in between. Root cause not fixed; no user data deleted.
- 23:08 EST: own go.sh stopped (PID 69602), cli quit, DevTools procs 0, lock /tmp/qf-lock-scene-fjord RELEASED.

## Remaining (tomorrow, Mac unlocked)
1. Take lock (waitlock.sh), `cli quit`, confirm 0 DevTools procs, cold start.
2. Play only: `bash waitlock.sh go-play.sh` in ~/qf-autoplay/scene-20261109T2215-fjord/ (reuses build/ = guarded test build of 177e591c; script h/script-fjord.json already taps Continue-fjord). 390×844 (device 7) and 430×932 (device 9): fj01 + fj08 board full shots, idle/play perf (fps, drawCalls), result, exit -> island (entry point) dumps.
   If the build/ dir is gone: `bash waitlock.sh go.sh` (rebuild from fjord.bundle, same guard).
3. Close-ups = 2× crops of the game-camera shots (pier edge); art notes: far ridge size at the channel end, dark-blue sky band above horizon.
4. Then: secret scan, normal push of ab820b58 to region/fjord-wireup (NOT 1f753356 / QA commits), PR #85 comment with measured results.
5. Clean Mac: build/, h/, bundle, scripts, DevTools localstorage_3f9c540e23e0456940e972ae08da83aa.json (created by my run1).
- 23:12 EST: Mac cleaned to the reshoot kit only: ~/qf-autoplay/scene-20261109T2215-fjord/ (26 MB: build/ = guarded test build, h/ harness + script-fjord.json, fjord.bundle, guard88.tar, common/waitlock/go/go-play/p1 scripts, out/ logs). proj/ and run shots removed. Lock free, DevTools 0, Mac free 7.9 GiB.
  Box evidence: mac-logs/ (go.log, guard.log, p1.log, p1-status.txt, devtools-logs/*.excerpt), env_fjord.glb.meta.creator. The per-try guard-logs dir and the full Creator P1 log were deleted on the Mac before they were copied; the key lines are in go.log / guard.log.
- ab820b58 is LOCAL only on the box (branch fjord-meta in /workspace/wt-fjord); not pushed (push after shots tomorrow).
