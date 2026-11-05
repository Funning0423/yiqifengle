# tip · 湖畔 LAKESIDE_KIT **trial 默认 ON**（真机对照 Funning 样板）· 2026-11-05

## Tip / feature
- **feature** `e74c0f766d1b23e8bf28964195bd076a6063c1e5`
- **tip** `02808214efc15965ad58d74aff27037feb2447b8`
- **基于改写 tip**：feature `ee791ad57bd204fbc80495139c91ea9d70bc2533` / tip `05ca7c50c1472829b45e2e4e91f0a56a2e578a86`（正式语义仍默认 OFF · HOLD）
- **叠合 integrate 父提交（TSW-OFF 线）**：`dc248d14869750e64a3e086e5877c395c353a492`（短 `dc248d14`，cherry-pick 自 feature `8f520d00`）
  - 当前 integrate 头 `gbt/r5-b20-integrate-landing-visual-bg2` = `b2b1146195d290ad19ad687173bf4146d1ad6190`（短 `b2b11461`，TSW 根因备注叠在 `dc248d14` 上）
  - 本 trial tip 供 PM cherry-pick 到该 integrate 头；**upload=等 PM**

## 一句话
**trial / 默认 ON**：微信体验版不好带 `?qflakesidekit=1`，故 boot 默认打开湖畔融合 kit，真机直接对照 Funning 样板（水面细白格 + 四角木桩红灯笼 + 角木筏 + 格上 `LK_piece_*`）。正式线仍是 OFF tip `05ca7c50`。**TSW 保持 OFF**；warm / Morph idle / period-heavy / SceneAudioPoll 默认 OFF 不动。

## 相对 `ee791ad5` / `05ca7c50` 改了什么
| 项 | 正式 tip（HOLD） | 本 trial tip |
|---|---|---|
| 默认 | OFF（需 `?qflakesidekit=1`） | **ON**（无 query 也开） |
| 关回 | （本来就是关） | `?qflakesidekit=0` 或 `__qfLakesideBoardKit=false` |
| 强制开 | query=1 / global true | 同（仍可用） |
| 接线 / 样板 / 禁项 | Funning 内景；skip frame；禁 coast；hide 2D；`LK_piece_*` | **同**（只翻默认） |

## 改动
| 文件 | 改动 |
|---|---|
| `ui/BoardProjection.ts` | `lakesideBoardKitFromFlag` 默认 `true`；支持 `qflakesidekit=0` / global false 关回 |
| `ui/BoardKit.ts` / `ManagedMobileBoardUI.ts` / `LakesideSceneData.ts` | 注释：trial 默认 ON；正式 tip 仍 OFF |
| tests | flag：默认 ON + opt-out；wiring：`mk(false)` 用 query=0 / global false |

## 临时关（真机 / 控制台）
```
?qflakesidekit=0
# 或
globalThis.__qfLakesideBoardKit = false
lakesideBoardKitFromFlag()
```

## 明确不做
- **不**把正式 tip `05ca7c50` 默认改成 ON（文档/语义仍 OFF · HOLD）
- **不**重新打开 `TRANSITION_SHADER_WARM`；**不**动 warm/idle/period/sceneAudio 默认
- **不**推 COUNT16↔FAT；**不**动起身 / BalloonTransit / sea-landing
- **不**加 coast slab；**不**恢复 `LK_board_frame`；**不**用海岸 board_art
- **不**传微信；**upload / 合入 = 等 PM**

## 离线自检
1. `node tools/lakeside/test_lakeside_kit_flag.cjs` → PASS（默认 ON；global false / query=0 关；query=1 / global true 开）
2. `node tools/board-ui/test_lakeside_kit_wiring.cjs` → PASS（opt-out 仍 2D tray；ON 投影格 + hide tray/bases/2D pieces；kit keep 963）
3. `node tools/lakeside/test_lakeside_entry.cjs` → PASS
4. 源码：`TRANSITION_SHADER_WARM_ENABLED=false` 保持

## 真机自检（合入体验版后 · 等 PM）
1. **无 query**：湖畔应直接露出白线/角桩/木筏 + 场景棋子（对照 Funning 样板）
2. 需要回 2D tray：带 `?qflakesidekit=0`（若渠道可带）或等正式 OFF tip
3. 起身 / 气球过海仍在；周期 stutter 不因本 tip 复发（未动 TSW）

## 样板对照
- Funning：`work/pm/lakeside-fusion-sample-funning-20261105.png`
- 空盘：`previews/场景特效bot/r5/s2/lakeside_ring/cmp_lakeside_board_portrait.png`
- 正式 OFF tip handoff：`docs/handoff/GGbot/LAKESIDE-KIT-DEFAULT-OFF-20261105.md`
