# tip · 湖畔空盘竞态修复（trial kit 真露出 LK_*）· 2026-11-05

## Tip / feature
- **feature** `28f5b386d997fc0c9651cb07324cabbaee25b787`
- **tip** `d626718b6a9046fd16f0a671fbd91db3f3a8cf35`
- **叠合**：trial default-ON feature `457b359c` / tip `02808214`（integrate 父链含 `9ec8410` meta-allowlist）
- **upload / 合入 = 等 PM**；本 tip 只修露出接线，不传微信

## 一句话（根因）
**flag 默认 ON 已合入，但未在挂景前生效。**  
`preloadLakesideBoard` → `buildLakesideBoard` → `mountLakesideScenery` → `lakesideSceneInstances` 在着陆预载时跑；此时 `lakesideKitAssetsOn` 仍是模块默认 `false`。`lakesideBoardKitFromFlag()` 只在更晚的 `ManagedMobileBoardUI.initializeManaged` 才调用 → 盘景已按 2D tray 路径滤掉 `LK_piece_*` 并 skip RING/SHD。真机 `1.0.202611050927` @ `9ec8410` 空盘 = **接线时序缺口**，不是 tip 未进包、也不是默认值写错。

## 现象对照
| 真机 | 原因 |
|---|---|
| 无 `LK_piece_*` / 无莲座辅件感 | 预载过滤时 `keepPieces=false` |
| 角桩/木筏难读成棋盘锚 | 远景机位（运镜）+ 无棋子叙事；wb/buoy/raft 本就不在 skip 列表 |
| 绳圈+淡格+「风铃」字牌 | 2D tray/目标文案路径仍可读；kit UI 注册虽晚于挂景，tray hide 依赖投影格 |
| 岸边远看 | **相机归运镜**；本 tip **不改** pose / landing blend |

## 改动（最短）
| 文件 | 改动 |
|---|---|
| `region/LakesideBoardBackground.ts` | `buildLakesideBoard` **开头** `try{lakesideBoardKitFromFlag();}`，保证 preload/直建在 `mountLakesideScenery` 前打开 kit 资产 |
| `region/LakesideSceneData.ts` / `ui/BoardProjection.ts` | 注释标明「必须在挂景前 set」 |
| tests | `test_lakeside_kit_flag` + `test_lakeside_board_preload`：断言 fromFlag 调用在 `step='scenery'` 之前 |

## Kill-switch（对齐既有）
```
?qflakesidekit=0
# 或
globalThis.__qfLakesideBoardKit = false
```
`buildLakesideBoard` 走同一 `lakesideBoardKitFromFlag()`，opt-out 仍关资产保留与 kit 注册。

## 相机（本 tip 明确不做）
- **主责：运镜。** Funning 定稿 = 样板「带一点俯视」可点格（`work/pm/lakeside-fusion-sample-funning-20261105.png`）；禁岸边远看。
- 棋盘 lease `frame()` 仍只读 `lakesideAlignedBoardPose(layout)`；本 tip **零** camera 写入、**不**改 landing hook / seatDef / door。
- 若合入后盘面 LK_* 已在、仍是风光远景 → 转运镜，不归本 tip 回滚。

## 明确不做
- **不**重开 TSW；**不**动 BalloonTransit / 起身 / sea-landing / 门 / seatDef
- **不**加 coast slab；**继续 skip** `LK_board_frame`
- **不**改 formal OFF tip `05ca7c50` 语义；trial 默认 ON 保留
- **不**传微信；**不**旁支重构

## 离线自检
1. `node tools/lakeside/test_lakeside_kit_flag.cjs` → PASS（默认 ON + 挂景前 fromFlag 顺序）
2. `node tools/board-ui/test_lakeside_kit_wiring.cjs` → PASS（hide tray/bases/2D pieces；kit keep 963）
3. `node tools/lakeside/test_lakeside_board_preload.cjs` → PASS（含 kit 顺序）
4. `node tools/lakeside/test_lakeside_entry.cjs` → PASS

## 真机摸法（合入体验版后）
1. **无 query** 进湖畔棋盘：应见细白格 `LK_wb_line` + 四角 `LK_buoy_lantern` + `LK_chime_raft` + 格上 `LK_piece_*`（对照 Funning 样板骨架）；2D tray/字牌隐
2. `?qflakesidekit=0`（若渠道可带）→ 回 2D tray 空滤件路径
3. 视角若仍岸边远看 → 记一笔给运镜；本 tip 只验露出
4. 起身 / 过海 / TSW-OFF 周期 stutter 不因本 tip 复发

## 样板 / 前序
- Funning 样板：`work/pm/lakeside-fusion-sample-funning-20261105.png`
- 对照：`work/pm/lakeside-fusion-sample-match-20261105.md`
- trial ON：`docs/handoff/GGbot/LAKESIDE-KIT-TRIAL-DEFAULT-ON-20261105.md`
- formal OFF：`docs/handoff/GGbot/LAKESIDE-KIT-DEFAULT-OFF-20261105.md`
