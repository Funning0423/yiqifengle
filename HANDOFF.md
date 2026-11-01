# HANDOFF — 咦 起风了 (QIFENGLE) / release-b20

Release branch: `ggbot/release-b20` (= `ggbot/b20-meadow-ab` @ 93607a48 + this file). Suite on 93607a48: 365/366 PASS, the only miss is navigation-guard BLOCKED_BROWSER. journal-r6 (bc09aac1) was NOT merged: 13 conflicting files (JourneyPanels.ts, PreTransition*, run-suite.cjs, build-guard scripts, manifests...). It needs a separate merge.

## Build 构建
- Cocos Creator 3.8.8 (Mac): `~/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app`
- Production upload: only via `FORMAL_RELEASE=1 tools/build-guard/build-production-upload.sh`. Do not use any other path.
- Preview flavor (device QR): see `PREVIEW_BUILD.md` (on the journal-r6 branch).
- Bans: wx.login / wx.authorize, isRemoteBundle / CDN. Free assets only.

## Upload to WeChat 上传
- Production uploads go ONLY through `FORMAL_RELEASE=1 bash tools/build-guard/build-production-upload.sh`. What the script does:
  1. It refuses without FORMAL_RELEASE=1.
  2. It requires STRIP_PROBES=1 and the target `wechat`.
  3. It runs `build-wechat-guarded.sh wechat` with FORMAL_RELEASE=1 STRIP_PROBES=1.
  4. It checks that the output `creator-build-project/build/wechat-release` exists.
  5. It runs `release-gates.cjs --probe-free` and `--formal-free` on that output (no probe code, no qfPre/__qfPreTransition).
  6. It prints `PRODUCTION UPLOAD READY`.
- **The script does NOT upload.** After it prints READY, the tester runs the upload by hand:
  `cli upload --project <repo>/creator-build-project/build/wechat-release -v 1.0.<YYYYMMDDHHmm> -d "ggbot/release-b20@<sha>"`
- Version format: `1.0.<YYYYMMDDHHmm>` (e.g. 1.0.202611011200).
- The tester runs this on the Mac after the slim acceptance passes, under the Mac idle and lock rules below.
- Trial uploads (体验版) use `build-wechat-guarded.sh` with the default FORMAL_RELEASE=0.
- Once the tester reports them, the uploaded version number and SHA will be recorded in the GitHub issue 'Handoff: current status'.

## Tests 测试
```
QF_TYPESCRIPT_MODULE=/workspace/wt/ts5/node_modules/typescript DRACO3D=/workspace/wt/draco3d/node_modules/draco3d npx -y node@22 tools/journey-integration/run-suite.cjs
```
It must have 0 FAIL. The only allowed miss is BLOCKED_BROWSER (navigation-guard). Never loosen thresholds. Don't commit suite report files.

## Size budgets 包体
- total ≤ 24,641,536 B
- main package ≤ 4,000,000 B
- coast subpackage ≤ 943,718 B

## Open issues 未结问题
1. **env_meadow shader compile stall**: about a 1.6 s frame at sail set-off. A+B probes are in place; warm-up C is not done. See `outbox/20261030-p0-fin-lake-freeze/MAC_STEPS_r8.md`.
2. **Lake freeze (fc3123fa)**: not confirmed on the Mac. fin r7/r8 are pending. Likely a DevTools host stall, but this is unproven.
3. **DevTools simfail race**: a getBuilder race inside DevTools hits when `cli open` targets an ALREADY RUNNING IDE (R1 retry: 3/3 failed on b3394140). **R2-COLD** (`cli open` with NO IDE running) gave 2/2 valid cold starts on b3394140 (compileType weapp→game ×1, simulatorType ×1, 0 launch failed, [QF_AUTOPLAY] in ~19 s; evidence `/workspace/qifengle/test-reports/20261101T1102_r2cold-b3394140/`). **Cold start is the acceptance environment.** R2-S0 is rejected (the Desktop project is off-limits).
4. **Perf (iPhone 16 Pro ~30 fps + heat; Mac sim 55-60)** — data `/workspace/qifengle/test-reports/20261101T1155_perf-b3394140/`, branch `ggbot/perf-r1`:
   - FIXED (box-gated, Mac pending): skycity arrival RT churn (~399 tex create+destroy/s, DepthStencil<n> +2/frame, 527 MB uploads in 16 s). Root: `ui/WarmButtonSkin.ts` re-keyed a new RenderTexture + off-screen window + readback EVERY frame while the invisible wooden-sign hit area (opacity 0) tracked the flying board camera. Now a resize stretches the current surface and re-bakes once after 12 stable frames. Gate `skycity-rt-churn-gate` (fixed 1 RT in 16 s vs b3394140 960 → negative FAILs).
   - ADDED: dev-only perf overlay, launch query `perf=1` (DevTools 启动参数 / preview or trial QR 启动参数 / `__qfQuery`); built only when devPreviewBuild() (never in release envVersion), no login/authorize/storage. Gate `perf-overlay`.
   - FIXED (box-gated, Mac pending) part of shader compiles: the b3394140 [QF_GPU] SHADER log shows boot/island compiles are first use (one global set), but from meadow frame 5327 every lit builtin-standard recompiled WITHOUT `CC_SHADOW_TYPE2` (36 in the 155 ms frame) and again at skycity arrival (frame 7628, 27) — 54 global-macro flips. Root: BalloonTransit wrote the scene-global `pipelineSceneData.shadows.enabled` every frame of the ride. Now only `mainLight.shadowEnabled` toggles (on change) — same shadow-pass/DC saving, no global macro change. Gate `shader-global-flip` (also a CLI verdict for Mac logs: `node tools/perf-r1/test_shader_global_flip_gate.cjs <console.log>`). OPEN: budgeted warm-up (≤4 ms/frame) of first-use variants (boot 317, island 80) — needs the Mac trace after this fix to list the final define sets.
   - OPEN: memory only grows (tex 92→111 MB, buf 15→51 MB; `regions=` in [QF_GPU] shows island 87 / meadow 44 / sail 81 / balloon 34 assets all still live at skycity level). Region change should decRef/release the previous region bundle + RTs; NOT done.
   - FIXED (box-gated, device pending): render budget in `SharedBundles.ts` (installed at import): `game.frameRate=60`; every main-window camera that renders the DEFAULT layer gets builtin-pipeline `pipelineSettings` with `enableShadingScale` and `shadingScale=min(1,2/dpr)` (0.667 on iPhone 16 Pro) → 3D shades into a ScaledRadiance RT at effective DPR 2 and is blitted to the full back buffer (this is the per-camera path, unlike the global `screen.resolutionScale`, so touch/layout are untouched). UI-only and render-to-texture cameras stay full res; cameras that already own pipelineSettings are left alone. A/B: launch query `fullres=1`. Gate `render-budget` (4 negatives). Needs device screenshots + fps.
   - OPEN: drawcalls 266-280 in skycity levels (inst=0). Not batched yet.
   - Shadows (512 PCF scene / 1024 indoor) left as is: no screenshot proof that a reduction is invisible.
   - (a) autoplay skycity L1 lost 8× with steps exhausted: the harness solver (`tools/wx-autoplay/qf-autoplay.js` best()) is a 1-ply greedy that scores only immediate matches (+ goal/moss/chain bonuses), no cascades, no step-budget planning. Losing is consistent with solver weakness; not evidence of a game bug. Game rules/gates untouched.
   - (b) qfHooks main route has no harbor/coast: on b20 the route is island →(sail)→ meadow →(balloon)→ skycity → lakeside (`REGIONS`, `JOURNEY_TRANSPORT`). The sail voyage IS in the run (`region-travel|ready|island`, 55 s). Coast/harbor lives only on the unmerged coast-kit-int branches → expected for b20.
   - (c) `?camTrace=1` "hang" ~220 s at skycity level: up to the last line the game is healthy (fps ~55, no long frames, cre≈0); console, state.jsonl and QF_CAM_LOG flushes all stop in the same second → the host/observation pipeline stops, not the render loop. Cause not found on the box; needs a Mac capture of the DevTools process at the stop (camTrace off is the workaround for perf runs).

## Mac DevTools steps + R1 launch retry
- Only the tester runs Mac steps; Grok Bot schedules them. Run DevTools or `cli open` only when HID idle is ≥600 s AND no display-sleep assertion is held AND no video app is in front, OR the screen is locked. Re-check before every launch and stop on any input. Never touch the mouse.
- Free disk must be ≥8.5 GiB (≥9 GiB for builds). Take `.build.lock`. Only ONE DevTools window ever, and never alongside Creator. Clean up build, cache and test files promptly.
- Harness: tools/wx-autoplay/qf-autoplay.js (cdpK22b helper) drives the simulator.
- **R1 (from LAUNCH_FIX.md)**: DevTools sometimes loses the getBuilder race inside DevTools (simulatorType unserialized), so after `cli open` there is no game target. If no game target shows up within the launch window, close that project and run `cli open` again (one bounded retry). Log `startedByCLI`. This does not loosen any timeout.

## Team rules 团队规则
- Acceptance: 0 FAIL except BLOCKED_BROWSER. Never loosen thresholds or timeouts. Fix root causes; "passes alone" is not a waiver. No loading screens or masks. Don't change walking speed. Never delete content. Size budgets above.
- Frozen files (any diff needs a `.diff.PROPOSED` approved first): WorldIntegrationBoot.ts, ScreenCover.ts, the reviewed controllers, WorldFlowCore, RegionJourneyCore, CharacterMotion.ts, WNC/WFC, loadHomeSeated, StaticSeatedPreview.
- Git: work on your own new branch. No force, amend, reset or stash, and don't edit .git/config. Every delivery comes with a SHA plus video or screenshots. Funning accepts. Never hand-write .meta files; regenerate manifests with the repo tools.
- wx.login / wx.authorize are banned. Free assets only. No CDN / isRemoteBundle.

## Evidence (box paths, not on GitHub)
- simfail: /workspace/qifengle/test-reports/20261101_simfail-evidence/E-table.md, startedByCLI-grep.txt
- meadow/lake: team/ggbot/outbox/20261030-p0-fin-lake-freeze/MAC_STEPS_r8.md
- Meadow warm-up C waits for r8 results. Target: ≤4 ms/frame, no hitch, final define set.

## Next steps 下一步
0. perf-r1 Mac/device pass: `team/ggbot/outbox/20261101-perf/MAC_STEPS_perf.md` (R2-COLD, per-scene before/after on b3394140 vs ggbot/perf-r1, fullres=1 A/B screenshots, shader-global-flip verdict on the log); then memory release on region change, budgeted shader warm-up, drawcall batching.
1. R1 six-launch verification
2. J7b (rerun on fcb354a9)
3. preview / QR
4. J8
5. r8
6. b20 B23 rerun
7. meadow C
8. preview P3s (night sun ×0.80, icon shadow)
9. port the fin commits to coast/b20
10. glb-skin rebake
11. 48 legacy fails
12. pin debt

## Branches 分支
| branch | SHA |
|---|---|
| ggbot/release-b20 | (this commit) |
| ggbot/b20-meadow-ab | 93607a48 |
| ggbot/journal-r6 | bc09aac1 |
| ggbot/journal-r6-preview-guard | fcb354a9 |
| ggbot/p0-meadow-ab | 88833c0f |
| ggbot/coast-meadow-ab | 35d9c4f4 |
| ggbot/b20-sync-b23-r3 | 05c2d2ce |
| ggbot/coast-sync-b23-r3 | 87ab6d0f |
| ggbot/p0-shadow-churn-r3 | aa044e43 |
