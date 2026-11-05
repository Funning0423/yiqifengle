# tip · 湖畔 LAKESIDE_KIT（原版 board-kit · 默认 OFF）· 2026-11-05

## Tip / feature
- **feature** `51b6e4ed8b171ed8e359ba5e4e4a76e54bde7388`
- **tip** `TIP_SHA_TBD`

## 一句话
Funning 要原版 board-kit（停浮标格）；美术方案 ACK。合回 `ec9bd651` 的 `BoardKit` / `BoardProjection` / `CoastBoardPieces`，仿 `f10bc3b0` 加 `LAKESIDE_KIT` + `?qflakesidekit=1`（**默认 OFF**）。kit 路径从 `LAKESIDE_SKIPPED_GLB` **拿掉** `LK_contact_shadow.glb` + `LK_ripple_ring.glb`（models 已有 49×）；**继续 skip** `LK_board_frame`（r5h3 已 drop，水面=载体）；**禁** coast slab。board 锚 `[0,0,12]`，cellM=1.1，topY=0.02；投影相机只读 `lakesideAlignedBoardPose`。

## 打开方式
```
?qflakesidekit=1
# 或
globalThis.__qfLakesideBoardKit = true
lakesideBoardKitFromFlag()
```
默认无 query / 无 flag → 2D tray 路径（与现网一致）；`LAKESIDE_SKIPPED_GLB` 仍跳 shadow/ripple/frame。

## 改动
| 文件 | 改动 |
|---|---|
| `ui/BoardKit.ts` (+meta) | 自 `ec9bd651` 合回 + `LAKESIDE_KIT` |
| `ui/BoardProjection.ts` (+meta) | 合回 + lakeside flag/pose；`cellM` 缩放；湖畔 EDGE_MIN 软闸 |
| `ui/CoastBoardPieces.ts` (+meta) | 自 `ec9bd651` 合回（coast 资产；湖畔不挂 coast slab） |
| `ui/BoardArt.ts` | 加性 `pieceKeysFor` |
| `ManagedMobileBoardUI.ts` | 仿 f10：湖畔 kit 分支（仅 `region==='lake'` + flag） |
| `region/LakesideSceneData.ts` | `setLakesideKitAssets`；kit ON 只 skip board_frame |
| tests | `test_lakeside_kit_flag` / `test_lakeside_kit_wiring` |

## 明确不做
- **不**把 TSW / warm / Morph idle / period-heavy / SceneAudioPoll 默认改回 ON
- **不**推 COUNT16↔FAT；**不**动起身 / BalloonTransit / K.s1 / sea-landing
- **不**加 coast_board；**不等** LK_board_frame
- **不**传微信；**upload=等 PM**

## 离线自检
1. `node tools/lakeside/test_lakeside_kit_flag.cjs` → PASS（默认 OFF；query/flag 打开；锚/cellM/topY）
2. `node tools/board-ui/test_lakeside_kit_wiring.cjs` → PASS（4 屏投影格 + tray/bases 隐藏 + taps；default keep 813 / kit keep 911）
3. `node tools/lakeside/test_lakeside_entry.cjs` → PASS（默认 skip 仍 813）
4. 源码：`TRANSITION_SHADER_WARM_ENABLED=false` 等帧率闸保持

## 验收读法（Funning / PM）
1. 无 query：湖畔仍 2D tray（对照基线）
2. `?qflakesidekit=1`：tray/tiles 隐，格投到水面；场景挂上 49× 涟漪环 + 接触影；无 board_frame / 无 coast 石板
3. 起身 / 气球过海视觉仍在；周期 stutter 不因本 tip 复发（未动 TSW）
