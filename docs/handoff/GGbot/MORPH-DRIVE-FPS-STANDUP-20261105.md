# tip · MorphDriver 稀疏权 + GPU 闸 · 整机不掉帧 + 起身仍顺 · 2026-11-05

## Tip / feature
- **feature** `4c668c9196077e9b43f1d1e460c46647354b6282`
- **tip** `b6b2265c62cfc1e172fff7eb461647fb428b2ec9`

## 一句话根因
体验包 `1.0.202611050458` @ integrate `6bd40657`（COUNT16/15 GLB + meta `6fd22962`）起身顺，但整界面掉帧：**非** anim_meta 把 seat 绑到 idle（角色动画bot 自查 PASS）；而是 runtime 每帧按 `morph.meshes` 全表（~49 tip）做 `curveAt`，且 GPU 仍对 COUNT16/15/15/3 求值（**w=0 也在网格上**）。次因：StandupProgramWarm 曾在 `armed&&pending` 时无 clip 闸门地 `getProgramVariant`。

## 成对约束
| 资产 | 标识 |
|---|---|
| COUNT GLB | `chr_b_standup_count_v1.glb` content sha **e3fbce98…**（仓外 previews；art `2ba3bab2`） |
| formal anim_meta | tip **`6fd22962`**（APRON16 / DRESS15 / BODY15 / BOW3 = 49 slots） |

## 改动
| 文件 | 改动 |
|---|---|
| `CharacterMotion.ts` | `morphActiveTargets` + **稀疏** `morphWeights`（只算 base/out/layer 曲线键；离开 active 的旧 seat 键置 0）；`MorphDriver.syncGpuGate`：全 tip ~0 → `enableMorph=false`，非零前再打开（idle/walk 卸 DRESS/BOW 的 COUNT15/3；起身窗仍满驱动） |
| `StandupProgramWarm.ts` | `openStandupWarmWindow` / `closeStandupWarmWindow`；`step` 仅 `windowOpen`（或 flush force） |
| `WorldIntegrationBoot.ts` | bind/re-seat → open；非 sit_hold → close；warmSample 后 close；dispose close |
| tests | window 闸 + sparse + gpuGate；TSW 仍零侵入 |

## 明确不做
- **零侵入** `TransitionShaderWarm` / Board / BalloonTransit / K.s1 / sea-landing / black-fence
- 不改 GLB / anim_meta（保持 e3fbce98 + 6fd22962 成对）
- **upload=等 PM**（本 tip 可并入未单独上传的 `5bc53220` 文档线，但仍等 PM）

## 验收
1. 离线：`test_standup_program_warm.cjs` + `test_standup_warm_sample.cjs` PASS；TSW 文件 hash 不变
2. Funning：整机不掉帧 + 起身仍顺
3. 不以 Mac setCamera/board=0 否决（CONTROL_FAIL_NOISE）

## 叠合
叠在 integrate `6bd40657` + COUNT16 warm follow-up `5bc53220`/`1e80b25b` 之上。
