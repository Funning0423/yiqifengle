# tip · Morph idle-drive 默认 OFF（A/B 剥 idle Morph 残留）· 2026-11-05

## Tip / feature
- **feature** `FEATURE_SHA_PENDING`
- **tip** `TIP_SHA_PENDING`

## 一句话
Funning 摸 `1.0.202611050621` @ tip `c672511`（StandupProgramWarm 默认 OFF）：**周期整机掉帧还在、起身仍顺** → warm **非**周期 stutter 主因。本 tip 把 `MORPH_IDLE_DRIVE_ENABLED` **默认 false**：idle/walk/UI 走 `MorphDriver.hardUnload`（含曾在 ad76cf64 后仍闸开的 BODY correctives）；**sit_hold / sit_down / stand_up 仍满驱动**（保住起身）。最短可测「COUNT16/Morph 栈 vs 别的」。

## 成对约束（未拆）
| 资产 | 标识 |
|---|---|
| COUNT GLB | content sha **e3fbce98…** |
| formal anim_meta | tip **`6fd22962`** |

## 改动
| 文件 | 改动 |
|---|---|
| `CharacterMotion.ts` | `MORPH_IDLE_DRIVE_ENABLED` 默认 false；`setMorphIdleDriveEnabled`；`morphPlanNeedsSeatDrive`；`MorphDriver.hardUnload`（先置零 tip，再 gate OFF，**不**先 re-enable） |
| `WorldIntegrationBoot.ts` | `applyMorph`：idle-drive OFF 且非 seat 窗 → hardUnload + 日志 `morph-idle-unload`；seat 窗仍 morphWeights+apply |
| tests / evidence | 默认 OFF + hardUnload 不中途开闸 + 手动 ON 回滚；TSW 零侵入 |

## 明确不做
- **零侵入** TransitionShaderWarm / Board / BalloonTransit / K.s1 / sea-landing / black-fence
- **不**拆 e3fbce98 + 6fd22962（剥 FAT 须标明拆对，另 tip）
- **不**改 StandupProgramWarm 默认（仍 OFF）
- **不**改 Morph 真 GPU 闸（ad76cf64 保留）
- **本 tip 未动**固定间隔 timer 嫌疑（见下方清单；改动小且证据不足故先 Morph 最短闸）
- **upload=等 PM**

## 未动的固定间隔嫌疑（handoff 清单）
| 嫌疑 | 间隔 | 备注 |
|---|---|---|
| `CamTraceLog.CAM_LOG_SINK.flushMs` | 1000 ms | 默认 OFF（仅 `camTrace=1`）；release 应惰性 |
| `SceneMusic.poll` | 0.25 s | 场景音频 resolve |
| `LandmarkAudio.poll` | poll 门 | 音频 |
| `RegionNodeStage.finaleArm` `setInterval` | 100 ms | 仅 sky finale armed |
| `PersistentMainlinePort` sync IPC | 每 getter/redraw | 非墙钟，可 hitch |
| `WorldIntegrationBoot.signRetryAt` | ≥1000 ms | 仅木牌重试路径 |
| sit_hold 外 StandupProgramWarm.step | — | 已默认 OFF，本 tip 非嫌疑 |

## 如何验证默认 OFF
1. 源码：`export let MORPH_IDLE_DRIVE_ENABLED=false`
2. 离线：`node tools/walk-driver/test_standup_program_warm.cjs` → `morphIdleDriveDefaultOff=true` / `morphIdleHardUnload=true`
3. 真机：idle/UI 时 morph diagnostics `gpuGateOn=false`（含 BODY）；日志可搜 `morph-idle-unload`；起身窗仍驱动；控制台 `setMorphIdleDriveEnabled(true)` 验证回滚

## 验收读法（Funning）
1. **若周期 stutter 消失 / 明显减轻**：Morph 栈（idle 残留 / BODY COUNT）有贡献 → 再收紧正式行为（可保留本闸或做更细 seat 外卸）
2. **若周期 stutter 仍在**：Morph **非主因** → 下一步盯上表 timer/GC/定期 sync，或 **剥 COUNT16→FAT**（须标明拆对）
3. **若起身变卡**：seat 窗判定漏了 / hardUnload 过猛 → 回报；手动 `setMorphIdleDriveEnabled(true)` 对照
4. 不以 Mac setCamera/board=0 否决（CONTROL_FAIL_NOISE）

## 叠合
叠在含 `5b990f8e`/`ba8ea27e`（warm OFF）+ `ad76cf64`（真 GPU 闸）的 integrate 之上。
