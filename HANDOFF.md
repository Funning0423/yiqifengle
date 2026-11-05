> **【重点标记】ROOT HIT · 2026-11-05** 手机周期整机掉帧已确认：`TransitionShaderWarm` 在 live 上 `director_after_draw` 常驻（COUNT16 下 COUNT53/73 needle 永不齐 → 永久 after_draw 税）。体验版 `1.0.202611050759` @ `dc248d14`（AppID `wx3bdd911c5c06f591`）Funning「不卡了」。默认保持 `TRANSITION_SHADER_WARM_ENABLED=false`。未经 Funning 不要再开。全文 `docs/fps/PERIOD-STUTTER-TSW-ROOT-HIT-20261105.md`。

> **【进度备注 · 2026-11-05】** 体验版 `1.0.202611060228` @ tip `02c9bd5e`。小游戏开发/测试暂停，交接 Clonebot。篮门飞行中关上 = PASS；周期掉帧「还是没有优化」、穿模「也是一样」= FAIL / 先不修。全文 `docs/handoff/PM/PROGRESS-060228-PAUSE-20261105.md` · Clonebot `docs/handoff/GGbot/CLONEBOT-BATCH-PAUSE-20261105.md`。

# HANDOFF — 咦 起风了 (QIFENGLE) / release-b20

## Mac LONG+RT integrate tip (2026-11-02 / Funning)

- Integrate tip: `cbcad31a` = merge of ggbot tip `9cd4820a` / feature `04d62636` (Object.assign wrap + full spike bag) onto `gbt/r5-b20-integrate-landing-visual-bg2`.
- Prior FAIL: `8e93c02b` animateCamera LONG 772ms / 70 shaders (pending=0 alone not enough).
- Root cause fix: Pass.tryCompile/getShaderVariant keys via programLib.getProgramVariant after Object.assign(pipeline.macros); wrap so live programProxies get FOG4/cascaded/HDR/SHADOWMAP_*/PCF2/SHADOW_TYPE2; count cached only when shader name contains those tokens.
- Mac retest: STRIP_PROBES=0 wechat-release, gates LONG+landing from2+board-bg; upload=no; live stays 1.0.202611020627.

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
1. **env_meadow shader compile stall**: warm-up C is on `ggbot/b20-meadow-c-skycity-rt`. See `docs/r5/b20-hotfix/INTEGRATE.md`. The offline cost model is ≤0.75 ms/frame and the sail frame compiles nothing. Mac still measures real frame time.
2. **Lake freeze (fc3123fa)**: not confirmed on the Mac. fin r7/r8 are pending. Likely a DevTools host stall, but this is unproven.
3. **DevTools simfail race**: a getBuilder race inside DevTools hits when `cli open` targets an ALREADY RUNNING IDE (R1 retry: 3/3 failed on b3394140). **R2-COLD** (`cli open` with NO IDE running) gave 2/2 valid cold starts on b3394140 (compileType weapp→game ×1, simulatorType ×1, 0 launch failed, [QF_AUTOPLAY] in ~19 s; evidence `/workspace/qifengle/test-reports/20261101T1102_r2cold-b3394140/`). **Cold start is the acceptance environment.** R2-S0 is rejected (the Desktop project is off-limits).
4. **Perf (iPhone 16 Pro ~30 fps + heat; Mac sim 55-60)** — data `/workspace/qifengle/test-reports/20261101T1155_perf-b3394140/`, branch `ggbot/perf-r1`:
   - FIXED (box-gated, Mac pending): skycity arrival RT churn (~399 tex create+destroy/s, DepthStencil<n> +2/frame, 527 MB uploads in 16 s). Root: `ui/WarmButtonSkin.ts` re-keyed a new RenderTexture + off-screen window + readback EVERY frame while the invisible wooden-sign hit area (opacity 0) tracked the flying board camera. Now a resize stretches the current surface and re-bakes once after 12 stable frames. Gate `skycity-rt-churn-gate` (fixed 1 RT in 16 s vs b3394140 960 → negative FAILs).
   - ADDED: dev-only perf overlay, launch query `perf=1` (DevTools 启动参数 / preview or trial QR 启动参数 / `__qfQuery`); built only when devPreviewBuild() (never in release envVersion), no login/authorize/storage. Gate `perf-overlay`.
   - FIXED (box-gated, Mac pending) part of shader compiles: the b3394140 [QF_GPU] SHADER log shows boot/island compiles are first use (one global set), but from meadow frame 5327 every lit builtin-standard recompiled WITHOUT `CC_SHADOW_TYPE2` (36 in the 155 ms frame) and again at skycity arrival (frame 7628, 27) — 54 global-macro flips. Root: BalloonTransit wrote the scene-global `pipelineSceneData.shadows.enabled` every frame of the ride. Now only `mainLight.shadowEnabled` toggles (on change) — same shadow-pass/DC saving, no global macro change. Gate `shader-global-flip` (also a CLI verdict for Mac logs: `node tools/perf-r1/test_shader_global_flip_gate.cjs <console.log>`). OPEN: budgeted warm-up (≤4 ms/frame) of first-use variants (boot 317, island 80) — needs the Mac trace after this fix to list the final define sets.
   - CHECKED: `render/RoomLightingRig.ts` does NOT toggle shadow/define sets per frame — it writes scene `shadows.enabled/type/shadowMapSize` (1024) + sun PCF only on the interior edge (`changed`) and restores in `restoreSun()`. That is one define-set change per room enter/exit (expected first-use compiles at those edges); covered by the warm-up next step, no per-frame churn.
   - NEXT STEP (not done in perf-r1, too big for the remaining quota): budgeted warm-up (≤4 ms/frame, in existing idle/loading time, no mask) of the final define sets once the Mac trace on perf-r1 lists them. Region release: see memory item below.
   - Suite on perf-r1 @ 56c06a5a: 369/370, 0 FAIL, only navigation-guard BLOCKED_BROWSER (box, 2026-11-01 ~14:03 EST). Package sizes need the Mac build (MAC_STEPS_perf.md).
   - OPEN: memory only grows (tex 92→111 MB, buf 15→51 MB; `regions=` in [QF_GPU] shows island 87 / meadow 44 / sail 81 / balloon 34 assets all still live at skycity level). WIRED later (see memory item above); was PARTIAL (dd7f7b86): `region/RegionLoader.ts` releaseRegionsExcept (bundle releaseAll + removeBundle for meadow/skycity/lakeside; never target, warmed next target, mounted, or shared bundles; return visits reload via loadBundle) + gate `region-memory-release` (round-trip back to baseline, negative case). NOT wired: the call site is in frozen WorldNativeComposition — `team/ggbot/outbox/20261101-perf/memory-release.diff.PROPOSED` awaits Grok Bot (open: the `mounted` predicate). Device memory unmeasured.
   - FIXED (box-gated, device pending): render budget in `ui/DevPreviewMark.ts` (installed at import; release builds too — only the overlay is dev-only): `game.frameRate=60`; every main-window camera that renders the DEFAULT layer gets builtin-pipeline `pipelineSettings` with `enableShadingScale` and `shadingScale=min(1,2/dpr)` (0.667 on iPhone 16 Pro) → 3D shades into a ScaledRadiance RT at effective DPR 2 and is blitted to the full back buffer (this is the per-camera path, unlike the global `screen.resolutionScale`, so touch/layout are untouched). UI-only and render-to-texture cameras stay full res; cameras that already own pipelineSettings are left alone. A/B: launch query `fullres=1`. Gate `render-budget` (4 negatives). Needs device screenshots + fps.
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
- Meadow warm-up C passed on Mac `ced9972f`. Integrate tips through `8e93c02b` kept landing from2 0/0/0 and board-bg zero 1.0. `8e93c02b` still failed `world.animateCamera` frame 1803 at 772 ms / 70 shaders after warm logged compiled=764 pending=0 criticalPending=0. That counter was a queue empty, not a live-cache hit: `getProgramVariant` Object.assign's pipeline.macros and keys the draw cache. This tip wraps Object.assign during compile so those defines get the full spike bag (FOG4 / cascaded / HDR / SHADOWMAP_FORMAT / LINEAR_DEPTH / PCF2 / SHADOW_TYPE2). criticalPending stays up until those createShader names are cached. The camera track is not awaited or held. See `docs/r5/b20-hotfix/LIVE-CACHE.md`. Do not upload.

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

---

# Integrate tip — TransitionShaderWarm + cine + fx (stutter retest)

- Tip: `ed7e6f5b64693f0062d541c32346d14ed8ca0654`
- Branch: `gbt/r5-b20-integrate-landing-visual-bg2`
- Base: `0421cfff` (RT board-bg2 + cine sea-landing + fx black-landing)
- Merged: `bdcb4b86` / PR #65 TransitionShaderWarm (`a2168f38` + docs tip)
- Conflict resolution: keep always `configureMeadowVertexColors` + add warm hooks
- Mac LONG+RT selftest pending; **no WeChat upload** until PASS + PM says so
- Live trial stays `1.0.202611020627` until a later PASS upload

---

# Integrate tip — PCF2 departure shadow warm (LONG retest)

- Tip: `4b3b9a8070245acb6672a23a4b512282bdceb2a1`
- Branch: `gbt/r5-b20-integrate-landing-visual-bg2`
- Base: `46e2c3ff` (TransitionShaderWarm + cine + fx + RT)
- Merged: `15887835` / `b95d8555` (PCF2 shadow warm; character variants first)
- Mac LONG+RT selftest pending; **no WeChat upload** until PASS + PM says so
- Live trial stays `1.0.202611020627` until a later PASS upload

---

# Integrate tip — animateCamera PCF2 program-cache fix (LONG retest)

- Tip: `86705fbe4a9898722afbaac86b6ca7b873917168`
- Branch: `gbt/r5-b20-integrate-landing-visual-bg2`
- Base: `8571f6d1` (prior PCF2 tip that FAILED Mac 611ms/70)
- Merged: `66937792` / `de045cb6` (pipeline-bag PCF write + girl/room families before camera; no animateCamera hold)
- Mac LONG+RT selftest pending; **no WeChat upload** until PASS + PM says so
- Live trial stays `1.0.202611020627` until a later PASS upload

## 2026-11-05 lakeside board-cam (cine/lakeside-board-cam-fix)
- tip source `c6835e99`: kit-ON uses `portraitFusion` mild-overhead; kit OFF keeps b18 sightseeing.
- Does not change lakesideSceneInstances / preload ordering (GGbot `28f5b386`).


## perf-r1 merged onto integrate (ggbot/perf-r1-on-bg2, from da238e2a)
Integrate-line behaviour wins on any overlap with the stutter fix (TransitionShaderWarm stays default OFF; PR #66 untouched).

- P0 FIXED on box (Mac re-run pending): perf-r1 3e5be7f5 threw 160 per-frame render errors from boot (visitResource→_getOrCreateDeviceTex "reading 't'", Error 16329 in buildLightBuffer) and hung island→meadow (evidence /workspace/qifengle/test-reports/20261101T1430_perf-r1-3e5be7f5/). Cause, read from the 3.8.8 build (cocos-js/cc.js buildRenderPipeline + subpackages/internal/game.js builtin-pipeline): Scaled* per-window graph resources are declared only in windowResize, which runs only on a window resize or after rendering.forceResizeAllWindows(); 56c06a5a set camera.pipelineSettings after the window's first resize with no forced resize. Fix (DPR≤2 cap restored): one fixed settings object per scale, given once to each main-window 3D camera on scene launch/scan, plus forceResizeAllWindows() in the same pre-render step; UI cameras full res; scale floor(2/dpr) (0.666 at DPR 3); `__qfRenderBudgetApplied` true when applied; no resize hook → cameras untouched. Gates `render-budget` + `render-budget-pipeline` (frame model of dispatchResizeEvents→setup, shadow toggle, mid-run camera; negative = 56c06a5a). NOT provable on box: the real device render (look, fps, heat) and that the error class is fully gone — Mac/iPhone check.
- Memory release WIRED (memory-release.diff.APPLIED in team/ggbot/outbox/20261101-perf, approved by Grok Bot): WNC.enterSelectedLevel calls releaseRegionsExcept(region,{keep:[preload target]}) after a successful enterLevel. `mounted` = RegionLoader registry of live region roots (mountRegion models + lakeside rigs, keys normalized via regionKey). Gate `region-memory-release` covers mounted-never-released, resume per region, island→meadow→skycity→meadow. Device memory numbers unmeasured.

- perf overlay: auto-on when `wx.getAccountInfoSync().miniProgram.envVersion` is trial/develop (3e5be7f5), never release; `?perf=1` kept. It is only constructed in devPreviewBuild builds, so a FORMAL_RELEASE-stripped upload shows nothing even as 体验版 — use a preview-flavor build for the trial upload to read device numbers.
