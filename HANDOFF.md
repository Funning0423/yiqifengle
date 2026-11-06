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
3. **DevTools simfail race**: a getBuilder race inside DevTools. R1 detect-and-retry is in `outbox/20261101-simfail/LAUNCH_FIX.md`. Tester results: E1 3/4, E2 2/4, and every failure carries the race signature. The 6-launch verification is pending.

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

---

# 2026-11-05 test-hook：skycity-lakeside `no-teleport-hook` / waitState skycity 停在 home

## 原因
两条测试入口都断在「钩子注册太早、查询又看不见」，生产路程没有坏。

1. **L1** `qfPre=skycity-lakeside` 返回 `no-teleport-hook (S6)`。`__qfTeleport` 只在 `RegionNodeStage.attach` 里、且当时 `qaHooksEnabled()` 已经为真时赋值。DevTools `cli open` 不套用启动参数，场景 attach 时门是关的。自动播放等到 `__qfPreTransition` 出现后才 `__qfHooksEnable=true` 并调用 `'enable'`，而 `'enable'` 以前只翻标志，不再绑定已经 attach 的舞台。摆位走到天空城后调用 S6，函数不存在。
2. **L2** `waitState skycity` 300s 超时，停在 `home`，`shots=0`，控制台错误 0。DevTools worker 的 `location.search` 已经是 `?contextName=game&id=2`。自动播放只在 search 为空时才把脚本 `launchQuery` 写进 location，而且以前只在带 `camTrace=1` 时才写 `__qfQuery`。`qaQuery` 又不读 `__qfQuery`，所以 `?qfPre=skycity-lakeside` 到不了 `preTransitionKey()`，1500ms 的自动摆位根本不会排上，世界留在 home。

自然湖畔验收走 `ensureRegion` → `resumeSkyAtS6`（走到 S6，不传送）。这条没改。

## 复现（Node）
- 缺钩子：`__qfPreTransition('skycity-lakeside')` 在没有 `__qfTeleport` 时立刻返回 `no-teleport-hook (S6)`，不占用 300s。
- 启动时序负例：binder 把钩子放到检查返回之后才赋值，仍然是 `no-teleport-hook (S6)`。
- 查询被 DevTools search 挡住：只有 `?contextName=game&id=2` 时 `preTransitionKey` 为 null，快照停在 `home`，`waitState` 的名字对不上 `skycity`。

## 修复（只动测试钩子）
- `attach` 始终装上 `__qfBindTeleportHooks`（门关着不赋值）。`'enable'` 和真正的 key 在把 `__qfHooksEnable` 设上之后调用它。attach 若发生在 enable 之后，门已开，attach 自己会绑定。
- 合法 `?qfPre=`（`registerQaPreKey`，正式包随 `QF_TRIAL` 剥掉）和 `?qfHooks=1` 一样打开传送门。微信 release 仍然关。
- `qaQuery` 合并 `__qfQuery`，盖过 DevTools 的 context search。自动播放对每条 `launchQuery` 都写 `__qfQuery`，不再只限 `camTrace=1`。
- `skycity-lakeside` 若传送返回 `explore-not-open`，经测试专用 `__qfOpenExplore('skycity')` 再试一次。没有 open 函数则失败原因是 `teleport-S6: explore-not-open`，不假装已经站上 S6。
- `TransitionShaderWarm` 默认仍是 `false`。没改气球 GLB、角色、走路速度、加载 UI、生产路线。

## 必要的 RegionNodeStage 差异（冻结控制器）
只改了 `attach`：把原来的 `if (qaHooksEnabled()) { __qfTeleport=…; __qfAimAt=… }` 收成 `__qfBindTeleportHooks`，门开时立即调用，门关时留着等 enable。同一个函数里多赋一个测试专用 `__qfOpenExplore`。`__qfTeleport=` 仍只有一处，仍由 `qaHooksEnabled()` 把守。`qaTeleport` / 镜头 / 走路 / `resumeSkyAtS6` 未改。

## 测试
- `tools/journey-integration/test-pre-transition-teleport.cjs`（套件 id `pre-transition-teleport`）
- `tools/region-nodes/test_p0drag8.cjs` P4：门关不注册、enable 之后不重新 attach 也能注册。探索镜头测试夹具补上 `PERIOD_HEAVY_REFRESH_ENABLED=false`（与生产默认一致）；否则 `sectorTarget` 在 P1 就抛 ReferenceError，P4 跑不到。这不是把周期重刷新打开。
- `tools/wx-autoplay/test-wx-autoplay.cjs`：context search 已存在时 `launchQuery` 仍写入 `__qfQuery`

## 仍待 Mac
真机 / DevTools 上再跑一遍 L1（`preTransition skycity-lakeside` 应 `ok` 且 state 为 `skycity`）和 L2（`waitState skycity` 应在现有 300s 内命中，而不是停在 home）。本环境没有微信开发者工具。不要放宽超时。自然路线的湖畔画面验收另走，不靠这次传送。
