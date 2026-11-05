# setCamera / board-bg 长帧续修笔记（Mac 230df8f6 → 同过两门）

> **【重点标记】ROOT HIT · 2026-11-05** 手机周期整机掉帧已确认命中 `TransitionShaderWarm`。体验版 `1.0.202611050759` @ integrate `dc248d14`（feature `8f520d00`，叠在 `324e50b1` 上），Funning ~08:32 America/New_York：「不卡了」。默认保持 `TRANSITION_SHADER_WARM_ENABLED=false`。未经 Funning 不要 `setTransitionShaderWarmEnabled(true)` 或把默认改回 ON。COUNT16↔FAT 仅当 stutter 再现才做对照。全文：`docs/fps/PERIOD-STUTTER-TSW-ROOT-HIT-20261105.md`。

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

## STANDUP-PERF runtime tip（本轮 · 角色动画bot 约束）

审计相对 tip `14463a58` / feature `2f3fe317`（DIR_LIGHT+COUNT53/73+PRECOMPUTED+armStandupShaderBurst）：

| # | 规则 | 结论 | 证据 |
|---|---|---|---|
| 1 | 勿在 sit→stand 重建 AnimRig / repairStates | **YES**（保持） | `AnimRig` ctor 内 `requireDirectTrsStates`+`repairStates`；`perform(stand)` / lakeside `stand_up` 无 rebuild |
| 2 | 起身前 warm-sample stand_up（pose+morphWeights→setWeight） | **补齐** | `FlowReferenceStandin.warmSampleStandUp`；bind `restoreMorph:true`；`perform(stand)` / lakeside `restoreMorph:false` 紧挨 `playNamed` |
| 3 | 预热 MORPH1 + COUNT53/73 + PRECOMPUTED（+DIR_LIGHT） | **YES**（2f3fe317） | `TransitionShaderWarm` `MAC_MORPH_COUNTS` / `withDirLightBag` / `armStandupShaderBurst` |
| 4 | MorphDriver 起身段无整表 setWeight 清零重写 | **YES**（保持 + 注释） | `MORPH_EPS` 增量；warm 末样本落 t=0，首帧几乎无增量 |

硬约束：保住 setCamera=0 / board-bg=0；**勿动** BalloonTransit / K.s1。



## Mac 8f757d4c 回退 → 同过两门（本轮）

叠合 tip `8f757d4c`（`2f3fe317` armStandupShaderBurst + `8287119a` warmSampleStandUp）相对过线 `fb74d437`/`ac48372e`：

| metric | fb74d437 | 8f757d4c |
|--------|----------|----------|
| setCamera max | **0** | **237 FAIL**（BalloonTransit:flight，shaders=0） |
| board-bg max | **0** | **312 FAIL**（reveal 窗，burstLeft 仍高） |
| animateCamera / RT | PASS | PASS |

根因（同窗抢主线程，不是拆掉 ac48372e middle state）：
1. hold 释放自动 `burstLeft=60` → board reveal 后仍 8/帧 compile（console burstLeft 194→31 叠 board-bg）。
2. held/flight 期 full absorb（PRECOMPUTED/fwd/pipe 全家）在 after_draw 上偏重，叠 BalloonTransit:flight `setCamera`（shaders=0 仍 LONG）。
3. SkycityBoard* / BalloonTransit / K.s1 **未改**；keepActive + prime cam-only-off + no armTransitionHold in prime 仍在。

修复（硬门禁优先，保住起身意图）：
1. `noteTransitionHeavyFrames` / `holdTransitionShaders(true)` / `armTransitionHold`：**清 burst + standupDirLight**。
2. **取消** hold 释放自动再 burst。
3. held 期 **lite absorb**（只 enqueue base live/depart）。
4. `CC_DIR_LIGHT` 袋仅在 `standupDirLight`（armStandupShaderBurst 窗口）编译。
5. 保留 `warmSampleStandUp` + PRECOMPUTED + `armStandupShaderBurst` 接线；Burst 在 held/heavy 时 no-op。

验收：setCamera 与 board-bg 同时 <100（目标≈0）；animateCamera/RT 不回退；起身 warm/burst 意图仍在。

## Strategy C：Mac 6f785228 == fb74 scripts → 阻塞 + tip 对齐过线树

| metric | fb74d437 | 587b73d3 (A) | **6f785228 (B)** |
|--------|----------|--------------|------------------|
| setCamera max | **0** | 268 FAIL | **270 FAIL** |
| board-bg max | **0** | 245 FAIL | **452 FAIL** |
| build TOTAL | 23626088 | 23627295 | **23626088**（=fb74） |
| scripts vs fb74 | — | +warmSample | **ZERO DIFF** |
| criticalPending AFTER | 111 | 98 | 99 |

### 精确 diff（integrate 树）
1. `git diff fb74d437..6f785228 -- creator-build-project/assets/scripts` → **空**。blob 级 `BalloonTransit` / `TransitionStaging` / `SkycityBoard*` / `TransitionShaderWarm` / `WorldIntegrationBoot` 全相同。
2. `git diff ac48372e..6f785228`（= `ac48372e..fb74d437`）仍有 5 个非 warmSample 文件：BalloonTransit middle（LAND_T showIsland、B5 island force-on、walk `K.s1→s0New`）、TransitionStaging（spawn_girl / toPath15 / cap60）、BalloonFlight（floor_seal）、SailPreload+RegionJourneyAdapter（black-fence always-configure）。**这 5 个 diff 在过线 tip fb74 上同样存在**，不能解释 PASS→FAIL。
3. 6f78 的 setCamera/board LONG **shaders=0**（非 compile）；尖峰在 `BalloonTransit:flight→B5` 与随后 `skycity.board-background`。

### 结论
- warmSampleStandUp / TransitionShaderWarm standup 侵入：**已证伪**（Strategy A/B）。
- BalloonTransit middle / black-fence：**不是相对 fb74 的抬门禁差**（同在 PASS 树）。**勿回退**这些（会离开已知过线代码）；**勿动 K.s1**。
- 相对过线 Mac tip **已无脚本可剥**。下一动作不是再出脚本 tip，而是：
  1. Mac **同日 CONTROL**：`KEEP_CACHE=0` 干净重建复测 `fb74d437`；
  2. 同条件复测 `6f785228`；
  3. 若 CONTROL 仍 PASS 而 6f78 FAIL → 查非 git（DevTools 态 / 注入 / 机温）；若 CONTROL 也 FAIL → 门禁当日噪声，再议 harden（超出 fb74 中间态）而不是回退 sea-landing。

证据 JSON：`evidence/integrate-vs-fb74-rootcause.json`。upload=NO；live 仍 `1.0.202611031613` @ fb74d437。

### 本 tip 动作（GGbot 分支）
- 将 Strategy B 误剥回 `ac48372e` 的 5 文件（BalloonTransit / TransitionStaging / BalloonFlight / SailPreload / RegionJourneyAdapter）**恢复为 `fb74d437` blob**，使 tip 树 scripts == 过线 Mac tip。
- 锁测：`tools/meadow/test_integrate_vs_fb74_scripts_identity.cjs`（gate 文件 == fb74 + 无 warmSampleStandUp）。
- **不**回退 K.s1 / BalloonTransit middle / black-fence；**不**重引入 standup burst/warmSample。
- integrate 合入后相对 `6f785228` 预期 scripts 仍 == fb74（noop 或文档对齐）；Mac 必须 `KEEP_CACHE=0` CONTROL 复测 `fb74d437` 同日对照。



## Strategy C′：CONTROL_FAIL_NOISE → standup-only 隔离（停门禁追逐）

同日 `KEEP_CACHE=0`：
| tip | setCamera | board-bg | scripts vs fb74 |
|-----|-----------|----------|-----------------|
| CONTROL `fb74d437` | **156 FAIL** | **127 FAIL** | —（历史 PASS 0/0） |
| integrate `905bd9f1` ← cec2a99e | **181 FAIL** | **115 FAIL** | **ZERO_DIFF** |

判定：**门禁噪声 / 非 git**。证据：`mac-selftest-fb74d437-control-landing/STRATEGY_C_VERDICT.md`。

### 本 tip 动作
1. **停** transition 门禁追逐；接受当日噪声带；**勿再回退** sea-landing / BalloonTransit / K.s1 / black-fence。
2. **standup-only 隔离**：`warmSampleStandUp` 短窗 N=4，仅 `perform(stand)` + lakeside `playNamed('stand_up')`；**禁止 bindVisual**；**禁止** `armStandupShaderBurst` / DIR_LIGHT / 改 TransitionShaderWarm。
3. MorphDriver EPS 注释恢复（STANDUP-PERF #4）。
4. 可叠 `299afe73` anim morph 减负（本 tip 不 cherry-pick anim_meta）。
5. **验收**：起身体感指标 + Funning 手机；**不再**以 setCamera/board=0 一票否决。
6. upload=NO；live 仍 `1.0.202611031613` @ fb74d437。

锁测：`test_standup_warm_sample.cjs`（隔离断言 + 短窗 runtime）、`test_transition_shader_warm.cjs`（无 burst；warmSample 仅角色路径）、`test_integrate_vs_fb74_scripts_identity.cjs`（transition/board/balloon == fb74）。

## 2026-11-05 standup COUNT53 program warm (zero TSW)
Funning A/B: 0421 walk smooth / standup stutter; 067a warmSample+curve cull insufficient. Tip adds StandupProgramWarm (independent getProgramVariant COUNT53), morph soft budget. Acceptance=phone standup feel. setCamera/board still CONTROL_FAIL_NOISE — not a veto.

## 2026-11-05 standup program warm follow-up · COUNT16/15/3
体验包 `1.0.202611050458` @ `6bd40657` 已叠 APRON16/DRESS15/BODY15/BOW3 GLB+meta，但 Warm 仍按 COUNT53。本 tip 只改 StandupProgramWarm 预热袋 → `CC_MORPH_TARGET_COUNT{16|15|3}`；零侵入 TSW/Board/BalloonTransit/K.s1；不接 armStandupShaderBurst。upload=等 Funning 摸完本包。

## MorphDriver 整机 FPS（本轮 · 主攻）

- 角色动画bot 自查：`walk-morph-drive` — idle/walk∩seat=∅ PASS；根因转 runtime 全表+GPU COUNT。
- tip：稀疏 morphWeights + MorphDriver enableMorph 闸 + StandupProgramWarm sit_hold 窗。
- 成对：GLB e3fbce98… + meta 6fd22962；upload=等 PM；零 TSW。

## MorphDriver 真 GPU 闸（本轮 · 050530 FAIL 跟进）

- 根因：Cocos 3.8.8 `enableMorph` setter **不** `_watchMorphInMesh`；`4c668c91` flag-only → MorphRenderingInstance + COUNT macro 仍活。
- tip：`applyRendererMorphGate`（watch / mesh-reassign STRIP + `setMorphRendering(null)`）+ `morph-gpu-gate` 日志 + StandupProgramWarm kill switch（A/B 剥 warm 保 COUNT16）。
- 成对 e3fbce98 + 6fd22962 **未拆**；零 TSW；upload=等 PM。
- 验收：整机 FPS + 起身；gate 用日志 `morph-gpu-gate` / diagnostics.gatePath 验证。

## StandupProgramWarm 默认 OFF（本轮 · 050605 A/B）

- Funning `1.0.202611050605` @ 04998c82：整机仍掉帧（**固定间隔周期 stutter**）；起身仍顺。Morph 真 GPU 闸已上。
- tip：`STANDUP_PROGRAM_WARM_ENABLED` **默认 false**；`setStandupProgramWarmEnabled(true)` 可回滚。COUNT16+meta + GPU 闸保留；零 TSW。
- 读法：起身变卡 → warm 有贡献；整机仍掉 → warm 非主因 → 剥 COUNT16/FAT 或盯 timer/GC/定期 sync/日志 flush。
- upload=等 PM。

## Morph idle-drive 默认 OFF（本轮 · 050621 A/B）

- Funning `1.0.202611050621` @ c672511：warm OFF 后 **周期整机 stutter 仍在**、起身仍顺 → warm 非主因。
- tip：`MORPH_IDLE_DRIVE_ENABLED` **默认 false**；idle/UI `hardUnload`（含 BODY）；sit/stand 仍驱动；`setMorphIdleDriveEnabled(true)` 可回滚。COUNT16+meta + GPU 闸 + warm OFF 保留；零 TSW。
- 读法：周期 stutter 消失 → Morph 有贡献；仍在 → Morph 非主因 → timer/GC/sync 或剥 FAT（标明拆对）。
- upload=等 PM。



## 2026-11-05 · TransitionShaderWarm 默认 OFF（周期整机 stutter A/B · 本刀）

PM 深挖：五轮零侵入 TSW 均无改善；流畅基线 `0421cfff` **无** TSW；live tip 仍 `director_after_draw` 常驻；COUNT16 在线但 `CRITICAL_CACHE_NEEDLES` 仍等 COUNT53/73 → `needlesMissing` 永久>0 → `criticalPending` 永不归零 → 每帧 compile + 每10帧 absorb。对得上「整机周期卡、起身仍顺」。

本 tip：`TRANSITION_SHADER_WARM_ENABLED=false`；`setTransitionShaderWarmEnabled` 回滚；hold/note/arm 空转保 BalloonTransit/Board。**故意动 TSW（不再零侵入）**。COUNT16↔FAT 降为失败后 #2（回 FAT 更可能伤起身而非消周期）。

验收：周期 stutter 消 → TSW 命中；仍在 → 再 COUNT16↔FAT。不追 setCamera/board=0。upload=等 PM。

## 2026-11-05 · ROOT HIT 确认（Funning「不卡了」）

体验版 `1.0.202611050759` @ integrate `dc248d14869750e64a3e086e5877c395c353a492`（feature `8f520d00`，叠在 SceneAudioPoll-OFF `324e50b1` 上）：Funning ~08:32 America/New_York「不卡了」。周期 stutter 消失。TSW 默认 OFF **命中**，保持 `false`。回滚仅 `setTransitionShaderWarmEnabled(true)`，且要 Funning 点头；不要把默认改回 ON。COUNT16↔FAT 只在 stutter 再现时做对照。全文：`docs/fps/PERIOD-STUTTER-TSW-ROOT-HIT-20261105.md`。
