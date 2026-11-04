# setCamera / board-bg 长帧续修笔记（Mac 230df8f6 → 同过两门）

## 三态对照
| tip | setCamera | board-bg | 关键差异 |
|-----|-----------|----------|---------|
| 25faaecf / bb8 (508) | **0** | 102 | keepActive 常驻；prime 2 帧；armTransitionHold **未 import**（prime/setVisible 空转） |
| e987bf7a / aaabd0e8 | 164 | **0** | keepActive 常驻；prime **4** 帧；armTransitionHold **真生效**（prime 20） |
| 230df8f6 / 59b18785 | 141 | 138 | prime 4 后 **关 cam+rig**；Live keepActive 仅 shown → board 冷启动回退 |

## 根因
1. **board=0** 需要 enterLevel 4 帧 board-cam 暖画 **且** 飞行期 rig 保持 active（纹理/GFX 常驻）；230 关 rig 把 board 打回 138。
2. **setCamera≈0** 在 25fa 上与 keepActive 共存；e987 的回退更像 **prime 内 armTransitionHold(20)** 叠进 `BalloonTransit:flight` 的 setCamera 窗，而非 keepActive 本身。
3. 二选一（只保 board / 只关 rig）均 FAIL；需要中间态。

## 本 tip（中间态 · ac48372e / Mac fb74d437 过线）
- Live：**恢复**构造期 `keepActive()` 常驻（e987 board 路径）。
- prime：保留 **4** 帧暖画；`armHold(16)`（508 形态）；**不**调用 `armTransitionHold`；暖完 **只关 cam**，**不** `rig.active=false`。
- setVisible：保留 `armHold(24)+armTransitionHold(24)`（reveal 窗，在 flight setCamera 之后）。
- 不 hold 镜头；不改 fidelity/mask/content/walk-speed；不抢 cine/fx；不上传。

## 验收
setCamera LONG **&lt;100ms**（最好≈0）**且** board-bg LONG **&lt;100ms**（最好回到 e987 的 0）；animateCamera / RT 不回退。

## Mac bf749b46 / 8f757d4c → Strategy A 回退（本轮）

| metric | fb74d437 | 8f757d4c | bf749b46 | 目标 |
|--------|----------|----------|----------|------|
| setCamera max | **0** | 237 FAIL | **411 FAIL** | ≈0 |
| board-bg max | **0** | 312 FAIL | **828 FAIL** | ≈0 |
| criticalPending AFTER ready | 111 | 107 | **251** | 不因 standup tip 飙升 |
| burstLeft AFTER ready | n/a | 73 | 0 | 无 standup burst |

根因：`2f3fe317` / `8287119a` / `0002c1f0` 对 `TransitionShaderWarm` 的侵入（standupDirLight 袋、held lite absorb、清 burst on heavy/hold、取消 hold 释放再 burst、`armStandupShaderBurst` 与 transition absorb 纠缠、USE_ALPHA_TEST critical、PRECOMPUTED 全家 enqueue）把 ready 后 criticalPending 抬到 251，并砸穿 setCamera / board-bg。「defer burst off flight/board」方向已证伪（比 8f 更差）。

### Strategy A（已证伪 · tip 52b36385 / Mac 587b73d3）
1. `TransitionShaderWarm.ts` 回退到 `ac48372e`：无 burst / DIR_LIGHT / lite-absorb。
2. 拆光 `armStandupShaderBurst`。
3. **曾保留** `warmSampleStandUp`（bind + perform/lakeside）+ MorphDriver standup 注释。
4. Mac `587b73d3`：**仍 FAIL** setCamera **268** / board-bg **245**（fb74=0/0）；criticalPending AFTER=98（接近 fb74 111）；node-lens/enterLevel≥100=0。
5. 结论：warmSample 在 bind / lakeside 仍间接打到 transition/board reveal，**非零侵入**。

### Strategy B（本 tip · 全剥 warmSample → 对齐 ac48372e）
1. **勿再改** `TransitionShaderWarm`（已与 `ac48372e` bit-identical）。
2. 相对 `ac48372e` **整文件恢复**：
   - `WorldIntegrationBoot.ts`（去 `warmSampleStandUp` / `standUpWarmPrimed` / bind+perform 接线）
   - `RegionJourneyAdapter.ts`（去 lakeside `warmSampleStandUp`）
   - `CharacterMotion.ts`（去 standup MorphDriver JSDoc 增量；MORPH_EPS 基线本就在 ac48372e）
3. 结果：`creator-build-project/assets/scripts/**` 相对 `ac48372e` **零 diff**（SkycityBoard middle / BalloonTransit / K.s1 本就未动）。
4. 起身 warm 支线 **DEFERRED**：见 `evidence/standup-warm-sample.json`；下一轮仅在真正 sit→stand 用户操作瞬间且远离 board reveal 的隔离 tip 再开。
5. 测试：`test_transition_shader_warm.cjs` / `test_standup_warm_sample.cjs` 断言 warmSample **缺席**。

验收：相对 fb74，**setCamera≈0 且 board-bg≈0**；animateCamera / RT 不回退。过线前不上传；live 仍 `1.0.202611031613` @ fb74d437。

证据：`/workspace/yiqifengle/mac-selftest-587b73d3-landing/`、`mac-selftest-bf749b46-landing/`、`mac-selftest-8f757d4c-landing/`、`mac-selftest-fb74d437-landing/`。
