# tip · PeriodHeavyRefresh 默认 OFF（A/B 剥固定间隔重刷新）· 2026-11-05

## Tip / feature
- **feature** `403462f1f05c5828ace711254c7dd6a4b1ba8179`
- **tip** `6be031eda7f7ca76afb1911f63518cd34e898388`

## 一句话
Funning 摸 `1.0.202611050645` @ tip `6954a20b`（Morph idle-drive 默认 OFF，叠 warm-OFF）：**周期整机掉帧一样没改善、起身仍顺** → Morph 栈 **非**周期 stutter 主因。本 tip 把 `PERIOD_HEAVY_REFRESH_ENABLED` **默认 false**，统一关掉最可疑的固定间隔重刷新（orbit AABB / sector 72 网格 / markers createMesh / 5s diagnostic tick）；**起身路径零改动**。最短可测「timer 周期源 vs 别的（含 COUNT16→FAT）」。

## 成对约束（未拆）
| 资产 | 标识 |
|---|---|
| COUNT GLB | content sha **e3fbce98…** |
| formal anim_meta | tip **`6fd22962`** |

## 改动
| 文件 | 改动 |
|---|---|
| `region/PeriodHeavyRefresh.ts` | `PERIOD_HEAVY_REFRESH_ENABLED` 默认 false；`setPeriodHeavyRefreshEnabled` |
| `world-r2/RegionNodeStage.ts` | OFF → 跳过 `refreshOrbitBoxes`；sector **时间**到期不重建（移动仍刷）；跳过 0.25s markers 定时 rebuild（事件 rebuild 保留） |
| `world-r1/WorldFlowComponent.ts` | OFF → `fillBoxes` 不扫 MeshRenderer；跳过 `reportRuntime('tick')` |
| tests / evidence | 默认 OFF + 手动 ON + 闸点源码断言；TSW 零侵入 |

## 明确不做
- **零侵入** TransitionShaderWarm / Board / BalloonTransit / K.s1 / sea-landing / black-fence
- **不**拆 e3fbce98 + 6fd22962（剥 FAT 须标明拆对，另 tip）
- **不**改 StandupProgramWarm / Morph idle / Morph GPU 闸（均保持默认 OFF / 真闸）
- **本 tip 未动** SceneMusic 0.25s / LandmarkAudio / CamTrace（release 应惰性）/ finaleArm 100ms
- **upload=等 PM**

## 闸住的嫌疑（本 tip）
| 嫌疑 | 间隔 | OFF 行为 |
|---|---|---|
| `RegionNodeStage.refreshOrbitBoxes` | ~400 ms | 直接 return（保留已有 boxes） |
| `WorldFlowComponent.fillBoxes` | ~400 ms | 直接 return 旧 boxes |
| `RegionNodeStage.sectorTarget` timed | ~0.25 s | 不因时间重建 72 网格（移动/姿态变仍刷） |
| `RegionNodeStage` markers timer | 0.25 s | 跳过定时 `createMesh`；事件 `rebuildMarkers` 仍跑 |
| `WorldFlowComponent.reportRuntime('tick')` | ~5 s | 跳过 tick 快照 |

## 如何验证默认 OFF
1. 源码：`export let PERIOD_HEAVY_REFRESH_ENABLED=false`
2. 离线：`node tools/walk-driver/test_standup_program_warm.cjs` → `periodHeavyRefreshDefaultOff=true` / `periodHeavyRefreshGates=true`
3. 真机：周期 stutter 对照；控制台 `setPeriodHeavyRefreshEnabled(true)` 验证回滚；起身仍顺

## 验收读法（Funning）
1. **若周期 stutter 消失 / 明显减轻**：命中 period-heavy 刷新 → 下一刀可逐项打开定位（AABB vs sector vs markers vs tick）
2. **若周期 stutter 仍在**：这些刷新 **非主因** → 下一刀列 SceneMusic/Landmark 轻轮询，或 **剥 COUNT16→FAT**（须标明拆对 e3fbce98+6fd22962）
3. **若起身变卡**：本 tip 未碰 Standup/Morph seat；若仍变卡请回报（可能叠包问题）
4. 不以 Mac setCamera/board=0 否决（CONTROL_FAIL_NOISE）

## 叠合
叠在含 Morph idle-OFF `5acfa98d` / warm-OFF `5b990f8e` / 真 GPU 闸 `ad76cf64` 的 integrate 之上。
