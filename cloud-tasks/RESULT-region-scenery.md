# RESULT：草甸 / 天空城的风景与背景（HANDOFF 待办第 19 项）

- 分支：`cursor/region-scenery-b539`，基于 int/v1 @ `022fcad`。只开合并请求，没有合进 int/v1。
- 环境：云端无界面 Blender **4.5.14 LTS**（官方 Linux tarball，跟 HANDOFF 实测版本一致），Cycles CPU，4 线程；Python 3.12 + pillow / numpy；pngquant 2.18。
- 结论：**天空城的旅程册小图和棋盘背景已经用本作自己的 `env_skycity.glb` 重渲**；**草甸没做**，因为仓库所有分支里都还没有草甸的场景模型（`bundles/region_meadow/` 只有 BGM），草甸小图继续用占位图。

## 重渲了哪些图
| 图 | 路径 | 尺寸 | 字节 | 之前 |
|---|---|---|---|---|
| 天空城地区之窗（原始渲染） | `art-src/board-ui/c-popups/src/round2/raw/regions/region_sky.png` | 720×440 | 453,141 | 低多边形占位 |
| 天空城地区之窗（切图） | `art-src/board-ui/c-popups/r2/slices/region_sky.png` | 208×136 | **11,421** | 占位 4,821 |
| 天空城地区之窗·未解锁（切图） | `art-src/board-ui/c-popups/r2/slices/region_sky_locked.png` | 208×136 | **4,950** | 占位 2,922 |
| 天空城棋盘背景（原始渲染） | `art-src/board-ui/b-board/src/bg_skycity_raw.jpg` | 750×1624 | 217,886 | 没有 |
| 天空城棋盘背景（切图） | `art-src/board-ui/b-board/slices/bg_skycity_board.jpg` | 750×1624 | **37,084**（单张背景预算 150 KB） | 没有 |
| 验收预览（不进包） | `art-src/board-ui/b-board/preview_skycity.jpg` | 1580×1184 | 178,269（预览预算 700 KB） | — |

进工程（`python3 tools/board_art_sync.py`，uuid 按目标路径固定生成）：
| 工程文件 | 字节 | 分包 |
|---|---|---|
| `creator-build-project/assets/bundles/board_art/r2/region_sky.png` | 11,421（原 4,821） | `board_art`（分包） |
| `creator-build-project/assets/bundles/region_skycity/board/bg_skycity_board.jpg` + `.meta`，`board.meta` | 37,084 + 1,001 + 169 | `region_skycity`（分包） |

`region_sky_locked.png` 跟以前一样只在美术切图里，同步表没有它，所以没进工程。

## 怎么渲的
- **`c-popups/src/round2/render_regions.py`**
  - GLB 路径改成按脚本位置找仓库里的 `creator-build-project/assets/bundles/…`：`GLB`（小岛）、`SKY_GLB`（天空城）、`MEADOW_GLB`（草甸，默认 `region_meadow/env_meadow.glb`，也可以用环境变量指定）。
  - 天空城用默认态：去掉 `state_*_after`（交互完成以后才出现的件）和导出时残留的 `Icosphere`。`env_sky_starring` 跟 `state_ring_before` 是同一个网格的两份（T8 包体清单 C17），叠在一起会出现两道环，所以只保留 `state_ring_before`。
  - 相机：从东南方 3/4 俯视，位置 (150, −205, 108)，看向 (2, −6, 18)，焦距 68 mm，720×440。整座浮岛都在画面里：大树、星环、两座塔、遗迹、星之庭、机器人园丁，岛底的藤蔓和瀑布垂进云里。
  - 灯光用 A 套（T9 木件灯光）：太阳 2.35，角度 8°，方向 (0.55, 0.60, −0.75)，天光 (0.62, 0.80, 0.95) × 0.55。天空城没有天穹，所以加了一层只给镜头看的渐变天（从下往上依次是浅蓝雾、地平线暖白、天蓝），不参与照明。Cycles 24 采样 + 降噪，色彩管理 Standard。
  - 草甸：没有 GLB 时打印 `SKIP meadow` 并跳过。GLB 放好以后，脚本会提示先补相机再渲。旧的占位生成代码还留着，用 `PLACEHOLDER=1` 可以重出。
- **`b-board/src/render_bg.py`**：加了第三个参数 `island`（默认，原样不变）/ `skycity`。天空城机位在浮岛南缘外：(18, −95, 34) → (0, −5, 10)，竖直视角 46°，750×1624，64 采样。上部是大树树冠和天空，中间被托盘挡住的是塔和遗迹，下部（道具栏后面）是草坪和浅色的星之庭，只在最底下露一条岛底岩层，所以道具栏后面不会压一大块深色。
- 后期跟岛背景完全一样：`boardpost.background`（高斯模糊 7.5、饱和度 0.72、对比度 0.78、叠 32% 浅雾），JPG q70 渐进。新脚本 `b-board/src/region_bg.py` 只出一张地区背景，并写进 `slices/sizes.json`。
- 小图切图：新脚本 `c-popups/src/round2/region_slices.py` 只重出地区之窗，并同步 `r2/slices/sizes.json`。不必跑整套 `slices2.py`（那个脚本要先清空全部 r2 切图，还依赖没提交的文楷字体）。`compose2.py` 里天空城的裁切改成 (16, 0, 704, 440)，因为现在是不透明实渲，去掉了占位用的垫底渐变和「占位」角标。

命令（在 `art-src/board-ui/` 下）：
```sh
blender -b --factory-startup -P c-popups/src/round2/render_regions.py -- /tmp/fang_reg sky
cp /tmp/fang_reg/region_sky.png c-popups/src/round2/raw/regions/
(cd c-popups/src/round2 && python3 region_slices.py ../.. sky,sky_locked)
blender -b --factory-startup -P b-board/src/render_bg.py -- /tmp/bg_sky_raw.png 64 skycity
python3 b-board/src/region_bg.py b-board/src/bg_skycity_raw.jpg bg_skycity_board '天空城 env_skycity.glb 实渲；同 bg_island_board 后期；JPG q70 渐进'
cd ../.. && python3 tools/board_art_sync.py && node tools/test_manifests.cjs --write
```

## 产品决定（都照办了）
- **夜间不另渲**：小图夜间乘 K_UI，背景夜间乘 K_SEA，跟岛背景同一套。`preview_skycity.jpg` 里有昼夜对照。
- **三件地区道具**（小抄网 / 发芽葵花籽 / X 形剪刀）没动：`tool_*` 切图、原始渲染、同步表都没改。
- **棋子、托盘、道具**都没重渲。预览里棋子仍然是焦点：浅木细边框，立体、有阴影，蓝贝壳是扇贝。背景柔焦、加了浅雾，往后退。
- 风格：低多边形、柔和干净，用的全是本作自己的模型。**没有用任何电影截图或电影素材**，也没有提交这类东西。

## 包体
- **主包 +0 B**：新文件都在分包里（`board_art`、`region_skycity`，两个都是 `wx_subpackage`）。
- **总量 +44,854 B**：小图多了 6,600，天空城背景 37,084 + meta 1,170，加起来约 44 KB。工程 `assets/` 源文件一共 12.1 MB，远低于 30 MiB。
- 这台机器上没有 Cocos Creator，没法出微信构建，所以没跑 `tools/check_wechat_build.py`（它要读构建产物）。上面的数字是按源文件算的增量。
- 美术合计（`INTEGRATION.md` §11，已按 sizes.json 重新生成）：b 棋盘 294,998 → 332,082（+37,084，新背景）；r2（只放星光大图）145,174 → 153,802（+8,628）。

## 测试
- `node tools/test_manifests.cjs --write`，再跑一遍检查：**PASS**（assets 131 条、text 507 条）。
- `python3 tools/board_art_sync.py --check`：**OK**。
- `tools/cloud-skycity/test_adapter.cjs`、`test_flow.cjs`：通过。
- `tools/test_level_background.cjs`、`tools/cloud-skycity/test_navigation_integration.cjs`、`test_region_resume.cjs`：这台机器上会失败，但在没改过的 `022fcad` 上失败得一模一样（缺全局 `typescript`，或者 `QF_TYPESCRIPT_MODULE` 没设；`test_level_background` 直接用 node 加载 TS 源码，报 `SyntaxError: import type`），跟这次改动无关。

## 没做的 / 遗留
1. **草甸的地区小图和棋盘背景**：仓库里没有草甸场景模型，小图继续用占位（`region_meadow.png`，图上标着「占位」）。场景bot 出了 `region_meadow` 的场景 GLB 以后，放到 `bundles/region_meadow/env_meadow.glb`（或者设 `MEADOW_GLB`），在 `render_regions.py` 的 meadow 段补相机，在 `render_bg.py` 加一个 `meadow` 分支，再照上面的命令重出。
2. **天空城背景还没接进代码**：`ui/BoardArt.ts` 的 `BOARD_BACKGROUND` 现在固定读 `region_island/board/bg_island_board`。要接的话，天空城的关卡改读 `region_skycity/board/bg_skycity_board`（`IslandBoardBackground.ts` 加载的时候要先加载 `region_skycity` 分包），夜间同样乘 K_SEA。这一项属于 HANDOFF 第 3 项（背景替换），这次没做。
3. 旅程册的全屏预览（`r2/journey_book.png` 等）本来就不进仓库（只在 tar 包里），这次没重出。要重出的话需要霞鹜文楷字体（见 HANDOFF §4）。
4. 星环那两份重复的网格（C17）只在渲染时去掉了一份，GLB 本身没改。
