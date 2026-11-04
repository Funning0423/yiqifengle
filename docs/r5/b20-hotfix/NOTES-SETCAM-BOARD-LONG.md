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

## 本 tip（中间态）
- Live：**恢复**构造期 `keepActive()` 常驻（e987 board 路径）。
- prime：保留 **4** 帧暖画；`armHold(16)`（508 形态）；**不**调用 `armTransitionHold`；暖完 **只关 cam**，**不** `rig.active=false`。
- setVisible：保留 `armHold(24)+armTransitionHold(24)`（reveal 窗，在 flight setCamera 之后）。
- 不 hold 镜头；不改 fidelity/mask/content/walk-speed；不抢 cine/fx；不上传。

## 验收
setCamera LONG **&lt;100ms**（最好≈0）**且** board-bg LONG **&lt;100ms**（最好回到 e987 的 0）；animateCamera / RT 不回退。


## Funning 起身 tip（本轮）

手机最卡在 **坐→起身 stand_up**，高于 meadow→skycity 门禁窗。

根因（Mac `fb74d437` / tip `ac48372e` console）：
- leaveHome / 开场 `world.animateCamera` fr123–184 大量 `CC_USE_SKINNING1|CC_USE_MORPH1`（53/16/3/73）**现场编译**；
- live createShader 名带 `CC_DIR_LIGHT_SHADOW_TYPE1`，旧 warm 袋子没有 → cache miss；
- morph 73 ± `CC_MORPH_PRECOMPUTED1` 在 standard 路径上未强制预热；
- critical 稳态仅 3/帧，起身窗 criticalPending 仍高。

改动（runtime / TransitionShaderWarm only；**勿动 BalloonTransit / K.s1**；硬保住 setCamera=0 / board-bg=0）：
1. `withDirLightBag`：hot/critical 再编一套 DIR_LIGHT 叠加的 DEPARTURE/SETCAM 袋；
2. 标准 hot 也强制 `CC_MORPH_PRECOMPUTED`（live + depart + fwd/pipe/reflect）；
3. `USE_ALPHA_TEST` 进 critical（node-lens 叶面）；
4. `armStandupShaderBurst`：起身前 200 帧按 8/帧冲刺 drain；接线 `armTransitionShaderWarm` / `leaveHome` / `perform(stand)` / lakeside `stand_up`；
5. hold 释放后自动再 burst 60 帧，消化 ready 后 city mats。

验收：坐→起身手机不顿；node-lens / enterLevel LONG &lt;100；ready 后 criticalPending≈0；setCamera / board-bg 仍 0；RT / animateCamera 不回退。


## STANDUP-PERF runtime tip（本轮 · 角色动画bot 约束）

审计相对 tip `14463a58` / feature `2f3fe317`（DIR_LIGHT+COUNT53/73+PRECOMPUTED+armStandupShaderBurst）：

| # | 规则 | 结论 | 证据 |
|---|---|---|---|
| 1 | 勿在 sit→stand 重建 AnimRig / repairStates | **YES**（保持） | `AnimRig` ctor 内 `requireDirectTrsStates`+`repairStates`；`perform(stand)` / lakeside `stand_up` 无 rebuild |
| 2 | 起身前 warm-sample stand_up（pose+morphWeights→setWeight） | **补齐** | `FlowReferenceStandin.warmSampleStandUp`；bind `restoreMorph:true`；`perform(stand)` / lakeside `restoreMorph:false` 紧挨 `playNamed` |
| 3 | 预热 MORPH1 + COUNT53/73 + PRECOMPUTED（+DIR_LIGHT） | **YES**（2f3fe317） | `TransitionShaderWarm` `MAC_MORPH_COUNTS` / `withDirLightBag` / `armStandupShaderBurst` |
| 4 | MorphDriver 起身段无整表 setWeight 清零重写 | **YES**（保持 + 注释） | `MORPH_EPS` 增量；warm 末样本落 t=0，首帧几乎无增量 |

硬约束：保住 setCamera=0 / board-bg=0；**勿动** BalloonTransit / K.s1。

