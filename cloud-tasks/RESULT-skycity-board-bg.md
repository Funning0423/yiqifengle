# RESULT：天空回声的棋盘背景接进游戏

分支 `cursor/skycity-board-bg-e26c` → 草稿 Pull Request 到 `int/v1`。没有合并，没有推到 `int/v1`。

草稿 PR #3 已经用 `env_skycity.glb` 渲好天空城棋盘背景，但没接到棋盘。这次只做接入。没有重渲，没有另做夜景。

## 读背景的位置

以前只有一处，而且写死：

- 常量：`creator-build-project/assets/scripts/ui/BoardArt.ts` 的 `BOARD_BACKGROUND` = `{ bundle: 'region_island', path: 'board/bg_island_board' }`
- 读取：`creator-build-project/assets/scripts/world-r2/IslandBoardBackground.ts` 的 `createIslandBoardBackground`，无条件 `loadBundle(BOARD_BACKGROUND.bundle)` 再 `bundle.load(BOARD_BACKGROUND.path)`

现在仍是这一处读取。`createIslandBoardBackground` 先调用 `boardBackgroundFor(selection)`（同文件 `BoardArt.ts`），再按返回的 bundle / path 加载。

| 棋盘 | 判定 | 读哪张图 |
|---|---|---|
| 天空回声 | `stageId` 以 `r05-sky-` 开头（`r05-sky-01` … `r05-sky-04`，旅程册「继续挑战」进的就是这些关） | `region_skycity` / `board/bg_skycity_board`（750×1624，37,084 B，PR #3 已渲） |
| 花粉草甸 | `r05-meadow-*` | 仍是岛背景。见下面「没做」 |
| 潮汐小径、R4、主线（含 `mainline-09`…`12` 月影古树） | 不是 `r05-sky-*` | 仍是岛背景 |

夜间没有第二张图。`IslandBoardBackgroundTint.update` 仍对这一张图乘 `tintRgb('sea', …)`（K_SEA）。

## 图从哪来

沿用 PR #3 的切图，没有重跑 Blender：

- 工程：`creator-build-project/assets/bundles/region_skycity/board/bg_skycity_board.jpg`（+ `.meta`、`board.meta`）
- 美术源：`art-src/board-ui/b-board/slices/bg_skycity_board.jpg`（`tools/board_art_sync.py` 会同步到上面的工程路径）

## 没做（不要用占位充数）

- **花粉草甸**：仓库里没有 `env_meadow.glb`。`bundles/region_meadow/` 只有 `audio/bgm_meadow.mp3`。没有凭空做草甸场景，也没有草甸棋盘背景。草甸关卡继续用岛背景，这一项不算完成。
- **`region_meadow.png` / `region_sky.png` 上的「占位」章**：没改。那部分另有提交（草稿 PR #3）。
- 主线后四关标题是「月影古树」，从「继续旅程」进入，不是天空回声的地区关，所以没有换成天空城背景。
