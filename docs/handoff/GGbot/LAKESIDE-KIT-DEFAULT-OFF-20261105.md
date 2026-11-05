# tip · 湖畔 LAKESIDE_KIT 改写（Funning 融合样板 · 默认 OFF · HOLD）· 2026-11-05

## Tip / feature
- **feature** `ee791ad57bd204fbc80495139c91ea9d70bc2533`
- **tip** `05ca7c50c1472829b45e2e4e91f0a56a2e578a86`
- **相对旧 tip**：改写自 feature `51b6e4ed` / tip `783952c0`（HOLD 不合入；本 tip 替换其验收口径）

## 一句话
验收图 = Funning 融合样板（`work/pm/lakeside-fusion-sample-funning-20261105.png`）：水面细白格 + 四角木桩红灯笼 + 角木筏 + 格上 3D 棋子。**不是**海岸 kit / board_art 投影答案。`?qflakesidekit=1` / `__qfLakesideBoardKit` **默认 OFF**；开 flag 后 hide 2D tray/tiles/**pieces**，露出场景已有 `LK_wb_line` + `LK_buoy_lantern` + `LK_chime_raft` + 荷叶绳；**取消** `LK_piece_*` 整前缀过滤（棋子管线 A）；RING/SHD 仍 unskip 作辅；**继续 skip** `LK_board_frame`；**禁** coast slab；相机只读 `lakesideAlignedBoardPose`。**TSW 保持 OFF**。

## 打开方式
```
?qflakesidekit=1
# 或
globalThis.__qfLakesideBoardKit = true
lakesideBoardKitFromFlag()
```
默认无 query / 无 flag → 2D tray 路径（与现网一致）；`LAKESIDE_SKIPPED_GLB` 仍跳 shadow/ripple/frame + 过滤 `LK_piece_*`。

## 相对 `51b6e4ed` / `783952c0` 改了什么
| 项 | 旧 tip | 本 tip（改写） |
|---|---|---|
| 验收口径 | 「原版=海岸 kit 平移」+ board_art 投影精灵 | Funning 样板 / 湖畔内景棋盘（`e37dfad8` board 组） |
| `LK_piece_*` | 仍整前缀过滤；2D board_art 当棋子 | **kit ON 取消过滤**（keep 52）；`hide2D.pieces=true` 关掉 2D ProjectPieceArt |
| `pieceKeys` / bundle | `board_art` + 主线草莓叶等 | `region_lakeside` + `LK_piece_shell/bell_pad/paper_boat/bobber/lotus_lamp/lake_light` |
| 优先露出 | RING/SHD + 投影格 | **`LK_wb_line`×16 + `LK_buoy_lantern`×4 + `LK_chime_raft`×2**（+绳/荷叶本就不 skip） |
| RING/SHD | unskip 主载体 | unskip **作辅**（样板主读白线+莲座；实心 49 莲座另开美术刀） |
| 禁项 / 默认 | 同：禁 coast slab；skip frame；默认 OFF；TSW 不动 | **同** |

## 改动
| 文件 | 改动 |
|---|---|
| `region/LakesideSceneData.ts` | kit ON 保留 `LK_piece_*`；`LAKESIDE_PIECE_GLBS` / `lakesidePieceGlbForType`；注释改融合样板 |
| `ui/BoardKit.ts` | `LAKESIDE_KIT` pieceKeys→LK_piece_*；`pieceBundle=region_lakeside`；`hide2D.pieces=true`；注释去「海岸原版」 |
| `ui/BoardProjection.ts` | 注释对齐融合样板 + setLakesideKitAssets |
| `ManagedMobileBoardUI.ts` | kit 路径不加载 board_art；`hide2D.pieces` 时 ProjectPieceArt 关闭（露出场景棋盘） |
| tests | flag：pieces/bundle/pieceKeys；wiring：2D art hidden；kit keep **963**=813+98+52；wb/buoy/raft 计数 |

## 明确不做
- **不**把 TSW / warm / Morph idle / period-heavy / SceneAudioPoll 默认改回 ON
- **不**推 COUNT16↔FAT；**不**动起身 / BalloonTransit / K.s1 / sea-landing
- **不**加 coast_board；**不等** LK_board_frame；**不**用海岸 board_art 当湖畔答案
- **不**声称本 tip 已补齐 49 格实心莲座（RING 仅辅；莲座缺口归美术）
- **不**传微信；**upload / 合入 = 等 PM**（本 tip 语义继续 HOLD）

## 离线自检
1. `node tools/lakeside/test_lakeside_kit_flag.cjs` → PASS（默认 OFF；query/flag；锚/cellM；pieceKeys=LK_*；hide2D.pieces）
2. `node tools/board-ui/test_lakeside_kit_wiring.cjs` → PASS（4 屏投影格 + tray/bases/**2D pieces** 隐藏 + taps；default keep 813 / kit keep **963**；wb16/buoy4/raft2）
3. `node tools/lakeside/test_lakeside_entry.cjs` → PASS（默认 skip 仍 813，过滤 piece）
4. 源码：`TRANSITION_SHADER_WARM_ENABLED=false` 保持

## 真机自检（合入后 · 等 PM）
1. 无 query：湖畔仍 2D tray（对照基线）
2. `?qflakesidekit=1`：tray/tiles/2D 棋子隐；水面可读细白格线 + 四角灯笼桩 + 木筏；场景挂 `LK_piece_*` + 辅 RING/SHD；无 board_frame / 无 coast 石板
3. 起身 / 气球过海仍在；周期 stutter 不因本 tip 复发（未动 TSW）

## 样板对照
- Funning：`work/pm/lakeside-fusion-sample-funning-20261105.png`
- 空盘：`previews/场景特效bot/r5/s2/lakeside_ring/cmp_lakeside_board_portrait.png`
- 审计：`work/pm/lakeside-fusion-sample-match-20261105.md`
