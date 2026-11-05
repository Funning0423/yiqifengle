# tip · StandupProgramWarm 默认 OFF（A/B 剥 warm）· 2026-11-05

## Tip / feature
- **feature** `FEATURE_SHA_PENDING`
- **tip** `TIP_SHA_PENDING`

## 一句话
Funning 摸 `1.0.202611050605` @ integrate tip `04998c82`（Morph 真 GPU 闸 `ad76cf64`）：**仍整机掉帧**，且为**固定间隔周期性 stutter**；**起身仍顺**。本 tip 把 `STANDUP_PROGRAM_WARM_ENABLED` **默认改为 false**，boot 上 open/step/flush 全 no-op，保留 COUNT16+meta + 真 GPU 闸，作最短 A/B。

## 成对约束（未拆）
| 资产 | 标识 |
|---|---|
| COUNT GLB | content sha **e3fbce98…** |
| formal anim_meta | tip **`6fd22962`** |

## 改动
| 文件 | 改动 |
|---|---|
| `region/StandupProgramWarm.ts` | `STANDUP_PROGRAM_WARM_ENABLED` **默认 false**；`setStandupProgramWarmEnabled(true)` 仍可手动打开回滚 |
| `WorldIntegrationBoot.ts` | **未改**（已有 open/step/flush 读开关；默认 OFF 即 boot 关） |
| tests / evidence | 断言源码与 runtime 默认 OFF；手动 ON 功能路径仍 PASS |

## 明确不做
- **零侵入** TransitionShaderWarm / Board / BalloonTransit / K.s1 / sea-landing / black-fence
- **不**拆 e3fbce98 + 6fd22962
- **不**扩大改 timer/GC（本 tip 只关 warm；见下方 next）
- **upload=等 PM**

## 如何验证默认 OFF
1. 源码：`export let STANDUP_PROGRAM_WARM_ENABLED=false`
2. 离线：`node tools/walk-driver/test_standup_program_warm.cjs` → `warmDefaultOff=true` / `warmManualOnWorks=true`
3. 真机：sit_hold 期间不应再有 StandupProgramWarm 的 `getProgramVariant` 编译；`standupProgramWarmStats` → `armed=false`；控制台可 `setStandupProgramWarmEnabled(true)` 验证回滚通路仍在

## 验收读法（Funning）
1. **若起身变卡**：说明 warm 有贡献 → 需另找整机/周期 stutter 根因（或更轻量 warm）；本 A/B 已证 warm 帮起身
2. **若整机仍掉 / 周期 stutter 仍在**：warm **非主因** → 下一步考虑 **剥 COUNT16 → FAT A/B**（须标明拆对）；并盯 **timer/interval warm、GC、定期 sync、sit_hold 窗外周期性 step、日志 flush** 等固定间隔嫌疑
3. 不以 Mac setCamera/board=0 否决（CONTROL_FAIL_NOISE）

## 叠合
叠在含 `ad76cf64`/`01a9a995`（真 GPU 闸）的 integrate 之上；**替换**「kill switch 默认 true」。
