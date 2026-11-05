# tip · SceneAudioPoll 默认 OFF（A/B 剥 SceneMusic/Landmark 固定间隔轮询）· 2026-11-05

## Tip / feature
- **feature** `761d1bf70126ffd9c5b077e42e69ba7418b7e383`
- **tip** `b4e4c52681cf8847d82cb6ffc641aaf691fa784f`

## 一句话
Funning 摸 `1.0.202611050717` @ tip `f2b89b7c`（PeriodHeavyRefresh 默认 OFF）：**周期卡顿一样、起身仍顺** → period-heavy 刷新 **非**主因（与 warm / Morph idle 一并排除）。本 tip 把 `SCENE_AUDIO_POLL_ENABLED` **默认 false**：关掉 SceneMusic **0.25 s** probe/resolve/publish（首曲仍一次 setMusic）与 LandmarkAudio **0.5 s** 锚点树扫 + 每帧 step；**起身路径零改动**。最短可测「场景音频固定间隔 vs 别的（含 COUNT16→FAT）」。

## 成对约束（未拆）
| 资产 | 标识 |
|---|---|
| COUNT GLB | content sha **e3fbce98…** |
| formal anim_meta | tip **`6fd22962`** |

## 改动
| 文件 | 改动 |
|---|---|
| `audio/SceneAudioPoll.ts` | `SCENE_AUDIO_POLL_ENABLED` 默认 false；`setSceneAudioPollEnabled` |
| `audio/SceneMusic.ts` | OFF 且已 `firstLoadAt` → 跳过 0.25 s poll/step（首曲仍可请求） |
| `audio/LandmarkAudio.ts` | OFF → `update` 直接 return（跳过 0.5 s `named()` 重发现 + 每帧 distance/core.step） |
| tests / evidence | 默认 OFF + 手动 ON + 闸点源码断言；TSW 零侵入 |

## 明确不做
- **零侵入** TransitionShaderWarm / Board / BalloonTransit / K.s1 / sea-landing / black-fence
- **不**拆 e3fbce98 + 6fd22962（剥 FAT 须标明拆对，另 tip）
- **不**改 StandupProgramWarm / Morph idle / PeriodHeavy / Morph GPU 闸（均保持默认 OFF / 真闸）
- **本 tip 未动** CamTrace（release 应惰性）/ finaleArm 100ms / BedLayer 每帧 step
- **upload=等 PM**

## 闸住的嫌疑（本 tip）
| 嫌疑 | 间隔 | OFF 行为 |
|---|---|---|
| `SceneMusic.update` poll | 0.25 s | 首曲后不再 probe / resolve / publishSceneBed / musicDiagnostics |
| `LandmarkAudio` anchor rediscovery | 0.5 s | 整段 update 跳过（含 `named()` 树扫） |
| `LandmarkAudio` per-frame step | 每帧 | 一并跳过（地标音量冻结在上次） |

## 如何验证默认 OFF
1. 源码：`export let SCENE_AUDIO_POLL_ENABLED=false`
2. 离线：`node tools/walk-driver/test_standup_program_warm.cjs` → `sceneAudioPollDefaultOff=true` / `sceneAudioPollGates=true`
3. 真机：周期 stutter 对照；控制台 `setSceneAudioPollEnabled(true)` 验证回滚；起身仍顺；BGM 首曲仍应起播，切场景曲目可能不再跟（预期 A/B 副作用）

## 验收读法（Funning）
1. **若周期 stutter 消失 / 明显减轻**：命中 SceneMusic/Landmark 轮询 → 下一刀可只开其一定位，或做正式惰性/事件驱动
2. **若周期 stutter 仍在**：场景音频轮询 **非主因** → 下一刀 **剥 COUNT16→FAT Morph 对照**（须标明拆对 e3fbce98+6fd22962），或查 PersistentMainlinePort sync / 其它非墙钟 hitch
3. **若起身变卡**：本 tip 未碰 Standup/Morph seat；若仍变卡请回报（可能叠包问题）
4. 不以 Mac setCamera/board=0 否决（CONTROL_FAIL_NOISE）

## 叠合
叠在含 PeriodHeavy OFF `403462f1` / Morph idle-OFF `5acfa98d` / warm-OFF `5b990f8e` / 真 GPU 闸 `ad76cf64` 的 integrate 之上。
