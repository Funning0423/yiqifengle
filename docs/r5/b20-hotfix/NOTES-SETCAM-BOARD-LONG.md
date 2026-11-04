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

### Strategy A（本 tip）
1. **整文件** `TransitionShaderWarm.ts` 回退到 `ac48372e`（与 Mac `fb74d437` 过线一致）：无 `armStandupShaderBurst` / `burstLeft` / `standupDirLight` / `withDirLightBag` / lite absorb / USE_ALPHA_TEST critical 拓宽。
2. 拆掉所有 `armStandupShaderBurst` 接线：`WorldFlowCore.leaveHome` / `WorldFlowComponent.armTransitionShaderWarm` / `WorldIntegrationBoot.perform(stand)` / lakeside `stand_up`。
3. **保留**不碰 transition 的起身侧：`FlowReferenceStandin.warmSampleStandUp`（bind + perform/lakeside）、`MorphDriver` MORPH_EPS 增量（无整表清零）。
4. SkycityBoard* middle state **不动**（keepActive + prime 4 cam-only-off + no armTH in prime）。
5. **勿动** BalloonTransit / K.s1。

验收：相对 fb74，setCamera≈0 且 board-bg≈0；AFTER ready criticalPending 不因 standup tip 飙到 251；animateCamera / RT 不回退。体感次之。过线前不上传；live 仍 `1.0.202611031613` @ fb74d437。

证据：`/workspace/yiqifengle/mac-selftest-bf749b46-landing/`、`mac-selftest-8f757d4c-landing/`、`mac-selftest-fb74d437-landing/`。
