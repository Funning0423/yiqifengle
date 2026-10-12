# 交接：棋盘 / 弹窗 UI 美术 · 阶段一（棋盘UI美术bot → 本地 Cursor）

> 2026-10-11 写。这份文档自包含：没有任何聊天记录，也能照着继续开发和接入。
> 配套文档：**`INTEGRATION.md`**（同目录）写了全部切图路径、尺寸、九宫格参数、坐标和接入细节。本文写的是项目背景、原则、状态、怎么重新生成、待办和坑。

## 1. 项目和目标
- 游戏：《咦，起风了》，微信小游戏，Cocos Creator **3.8.8**，竖屏 750×1624 设计画布（390×844 pt，1 pt = 1.923 px）。工程在仓库的 `creator-build-project/`。
- 这一阶段的任务：给加载页、棋盘（三消）、所有弹窗和面板出**定稿美术和切图**，统一成「低多边形、柔和干净、治愈」的一套道具感 UI，质感以 T9 做的岛上路牌和三个 3D 按钮（`work/grokbot/ui-props`）为基准。
- 阶段一只出预览和切图，**还没有接进工程**。接入交给 GGbot 或本地 Cursor，按 `INTEGRATION.md` 做。
- 基线：`int/v1` @ `d637356`。美术源文件提交在分支 **`art/board-ui-phase1`** 的 `art-src/board-ui/`（没有合并进 int/v1）。完整预览（含所有对比图）打包在 `/workspace/yiqifengle/handoff/棋盘UI美术bot-phase1.tar.gz`。

## 2. 已定的美术原则（PM / Funning 已确认，后续新增内容都要遵守）
1. **棋子和道具是焦点**；木框、格子底座、背景都要往后退：浅木、低对比、少深色描边；背景柔焦，加一层浅雾。
2. **简洁精致**：内容做减法，不放副标题、小节标签、虚线和小装饰（星点、丝带、钉子、挂钩）。精致靠倒角、明暗和对齐。
3. **两套灯光**（Blender 4.5，Cycles CPU，64 采样 + 降噪，色彩管理 Standard，透明背景）：

| 参数 | A 木件（T9 灯光） | B 焦点件（棋子、道具、宝箱、星星、印记） |
|---|---|---|
| 天光 | (0.62, 0.80, 0.95) × **0.55** | 同色 × **0.22** |
| 主太阳 | **2.35**，角度 8°，颜色 (1, 0.97, 0.92)，方向 (0.55, 0.60, −0.75) | **3.5**，light linking 只照模型 |
| 顶部柔光 | 无 | 0.8，角度 26°，方向 (0.08, 0.18, −1)，负责接触阴影 |
| 轮廓光 | 无 | 1.1，角度 12°，冷色 (0.88, 0.94, 1.0)，方向 (−0.45, −0.75, −0.5) |
| 粗糙度 / 高光 | 0.9 / 0.125（`M_env_palette`） | 0.36 / 0.7（`M_env_palette_piece`） |
| 合成后调色 | 无 | `focus_grade`：饱和度 ×1.22，对比度 ×1.10 |

4. **调色板**：所有模型只用 `env_palette_256.png` 一张贴图（Closest 采样），UV 塌缩到色块上，不另加贴图。常用色块：木 (102,8) #956737、深木 (30,8) #6e4826、奶油 (206,4) #f8f2e2、浅木 rimL (100,5) #c9b185、主按钮青 (50,9) #3a7876。草莓是唯一的例外，用专用材质 #ce342e。
5. **面板宽统一 680 px**；**间距用 8 的倍数**（常用 16 / 24 / 32 / 64 / 104；面板顶到第一块内容 104，最后一块内容到面板底 72）；**字号最多三级**（标题、正文、数字）。
6. **无钉浅木框**：弹窗外框没有角钉；标题木牌不带绳子和钉子；章节路牌不带钉子。
7. **标题字**全部是烘焙好的霞鹜文楷 PNG（SIL OFL 1.1，包里不带字体）。正文用系统字。
8. **夜间**：不另出一套图，用乘色。Sprite × K_UI (0.621, 0.591, 0.562)，背景 × K_SEA (0.498, 0.624, 0.702)，宝箱、星星、光芒 × K_HALF (0.811, 0.796, 0.781)。**文字不乘色，单独换颜色，对比度 ≥ 4.5:1**。
9. **包体预算**：图集 ≤ 600 KB；单张背景 ≤ 150 KB；加载页 ≤ 120 KB；宝箱 GLB ≤ 60 KB；单张预览图 ≤ 700 KB。现在都达标（总表见 INTEGRATION §11）。
10. **禁止**：**不能用任何电影截图或电影素材**，也不能用 `previews/角色动画bot/refs/wind-rises-apron-ref.jpg`（不能参考、不能临摹、不能放进包或仓库）。对比图里的「现状」只能用本作自己的截图。

## 3. 状态
| 项 | 状态 | 文件（相对美术根目录） |
|---|---|---|
| (a) 加载页 + 首帧 | **已定稿** | `a-loading/`、`a-loading/first-screen/` |
| (b) 棋盘 v3.1（青叶方案 A） | **已定稿** | `b-board/` |
| (c) 弹窗：暂停 / 重来确认 / 设置 / 领奖 / 过关 / 差一点点 + 宝箱 GLB | **已定稿**（精简版，PM 已验收） | `c-popups/*.png`、`c-popups/glb/` |
| r2：道具介绍 / 行囊（岛上、关卡内） / 旅程册 / 海岛小憩昼夜 / 还没存上 / 旅途回顾 / 灯塔目标格 | **已定稿**（精简版，PM 已验收） | `c-popups/r2/` |
| 夜间预览 | **已定稿** | `c-popups/night/` |
| 关于页 | **已出图，等 PM 看** | `c-popups/r3/about.png` |
| 小屋提示（呼吸光 + 月亮气泡） | **已出图，等 PM 看** | `c-popups/r3/cabin_hint*.png` |
| 三件地区道具（潮汐网 / 日光籽 / 星剪）v2 | **等 Funning 确认**，没并进 (b) | `c-popups/r2/region_tools_compare.png` |
| 天空回声的地区小图 | **已重渲**（`env_skycity.glb` 实渲，2026-10-12，见 `cloud-tasks/RESULT-region-scenery.md`） | `c-popups/src/round2/raw/regions/region_sky.png`、`c-popups/r2/slices/region_sky*.png` |
| 天空城的棋盘背景 | **已出图**，没接进代码（`BOARD_BACKGROUND` 仍固定读岛背景） | `b-board/slices/bg_skycity_board.jpg` → 工程 `bundles/region_skycity/board/`；预览 `b-board/preview_skycity.jpg` |
| 花粉草甸的地区小图和棋盘背景 | **占位 / 没做**：仓库里还没有草甸场景模型 | `c-popups/src/round2/raw/regions/region_meadow.png`（占位） |
| 横屏布局；区域关格子标签和连线的视觉；章节详情页；许可全文页；行囊分页；CheerText 中文化；其余地区道具（潮汐锚、棱镜移位） | **没做** | — |
| 接入工程 | **没做**（按 INTEGRATION.md） | — |

## 4. 怎么重新生成
**环境**：Blender **4.5 LTS**（实测 4.5.14），Python 3.10+，pip 包 `pillow numpy scipy cairosvg fonttools`，命令行工具 `pngquant`（≥ 2.17）。脚本里有几个写死的绝对路径，换机器时要改：
| 常量 | 位置 | 原路径 | 现在的备份 |
|---|---|---|---|
| `TEX`（调色板） | `b-board/src/build_board.py:10`、`c-popups/src/palette_helpers.py:1` | `/workspace/yiqifengle/work/grokbot/ui-props/textures` | `_deps/ui-props/textures/`（已提交） |
| `T9`（T9 的 3D 按钮 GLB） | `c-popups/src/build_popups.py:22` | `/workspace/yiqifengle/work/grokbot/ui-props/glb-preview` | `_deps/ui-props/glb-preview/`（已提交） |
| `FK`（霞鹜文楷） | `c-popups/src/ui_kit.py:9`、`a-loading/src/gen.py` | `/workspace/la/LXGWWenKai-Medium.ttf` | 25 MB，**没提交**；在 tar 包的 `棋盘UI美术bot/_deps/fonts/` 里，也可以从 https://github.com/lxgw/LxgwWenKai/releases/tag/v1.522 下载（sha256 `d4bdeb38a39151d74d084cba5090f8cb7d20bf83eedb78c35939ae70b9f4e3f6`） |
| 正文字体 | `c-popups/src/ui_kit.py:8` | `/usr/share/fonts/opentype/noto/NotoSansCJK-*.ttc` | 系统包 `fonts-noto-cjk`（只用于预览） |
| 岛截图（弹窗底图） | `c-popups/src/compose.py` 的 `ISLAND` | `/workspace/yiqifengle/previews/pm-audit/C0_island_T9_props_reference.png` | 在 tar 包外，是本作的实机截图；也可以用环境变量 `ISLAND_IMG` 指定 |
| 岛 / 天空城 / 草甸模型 | `render_regions.py` 的 `GLB` / `SKY_GLB` / `MEADOW_GLB`，`b-board/src/render_bg.py` | 已改成按脚本位置找仓库里的 `creator-build-project/assets/bundles/…`，不用改 | 草甸 GLB 还没有 |
| 关卡代码 | `c-popups/src/round2/beacon.py` 读 `b-board/src/compose.py` | 同一个美术根目录 | — |

**命令**（都在美术根目录下执行；Blender 一律用 `blender -b --factory-startup -P <脚本> -- <参数>`）：
```sh
# (a) 加载页
cd a-loading && python3 src/gen.py && python3 src/compose.py && python3 src/first_screen.py && cd ..
# (b) 棋盘
blender -b --factory-startup -P b-board/src/build_board.py -- /tmp/out 64        # → /tmp/out/raw/*.png + board_props.blend
blender -b -P b-board/src/render_bg.py -- /tmp/bg_raw.png 64                    # 第三个参数 island（默认）/ skycity
blender -b -P b-board/src/render_bg.py -- /tmp/bg_sky_raw.png 64 skycity && python3 b-board/src/region_bg.py /tmp/bg_sky_raw.png bg_skycity_board '…说明…'   # 只出天空城背景
cp -r /tmp/out/raw/* b-board/src/raw/ && python3 b-board/src/fix_shadow.py b-board/src/raw   # fix_shadow 只能对刚渲出来的 raw 跑一次
cd b-board && python3 src/slices.py src/raw src/bg_raw.jpg . && python3 src/compose.py src/raw src/bg_raw.jpg . && python3 src/sheets.py . && python3 src/shrink.py . && cd ..
# (c) 弹窗：Blender 渲染全部模型（可以在末尾用逗号列表只渲指定的，例如 tool_tidenet,tool_sunseed）
blender -b --factory-startup -P c-popups/src/build_popups.py -- /tmp/cpop 64
cp /tmp/cpop/raw/*.png c-popups/src/raw/ && cp /tmp/cpop/glb/*.glb c-popups/glb/      # r2 用到的件复制到 c-popups/src/round2/raw/
cd c-popups/src && python3 compose.py .. && python3 slices.py .. && python3 sheets.py .. && SKIP_BOARD=1 python3 night.py .. && cd ../..
# r2（顺序不能乱：compose2 → slices2 → beacon → sheets2）
cd c-popups/src/round2
blender -b --factory-startup -P render_regions.py -- /tmp/fang_reg     # 地区小图 → 复制到 raw/regions/（没有草甸 GLB 时跳过草甸）
python3 region_slices.py ../.. sky,sky_locked                            # 只重出地区之窗切图，不必重跑整套 slices2
blender -b -P render_hero.py -- …                                        # 道具大图（见脚本头部注释）
python3 compose2.py ../.. && NIGHT=1 python3 compose2.py ../.. && python3 slices2.py ../.. && mkdir -p /tmp/fang_bb && python3 beacon.py ../.. && python3 sheets2.py ../.. && python3 tools_compare.py ../..
cd ../round3 && python3 cabin_hint.py ../.. && python3 about.py ../.. && NIGHT=1 python3 about.py ../..
cd .. && python3 compare_old_vs_lite.py .. && cd .. && python3 src/overview.py && cd ..
# 接入文档（切图表从各 sizes.json 自动生成）
python3 _docs_src/gen_integration.py
```
注意：`compare_old_vs_lite.py` 要读 `c-popups/src/_old_snap/`（精简前的快照，只在 tar 包里）。

## 5. 文件地图（美术根目录）
```
a-loading/        加载页：src/（gen.py 标题和标志、compose.py、first_screen.py、base2.py、compare.py、OFL.txt）、slices/、first-screen/（coords.json）
b-board/          棋盘：src/build_board.py（Blender 建模 + 渲染）、board_props.blend、render_bg.py、compose.py、slices.py、boardpost.py、fix_shadow.py、sheets*.py、shrink.py、raw/（当前渲染）、slices/（sizes.json）
c-popups/         弹窗：src/build_popups.py（Blender）、popup_props.blend、palette_helpers.py、ui_kit.py（九宫格、按钮、夜间系数、文楷烘焙）、compose.py（6 个 (c) 面板）、slices.py、sheets.py、night.py、
                  compare_old_vs_lite.py、overview.py、inputs/（(b) v3.1 快照和现状截图）、raw/
                  src/round2/：compose2.py（r2 面板）、render_regions.py（地区小图）、render_hero.py（道具大图）、beacon.py（灯塔格）、slices2.py、sheets2.py、tools_compare.py、compose_lite.py（精简样张）、raw/
                  src/round3/：cabin_hint.py（小屋提示）、about.py（关于页）
                  glb/result_chest.glb、slices/、r2/slices/、r3/slices/、README.md（(c) 和 r2 的全部记录）
_deps/            ui-props 的调色板和 T9 按钮 GLB（字体只在 tar 包里）
_docs_src/        INTEGRATION.md 的生成器和模板
INTEGRATION.md    接入文档      HANDOFF.md    本文件
```
完整预览（全屏图、对比图、夜间图、总览 `c-popups/overview_all_panels.jpg`）只在 tar 包里。

## 6. 接入步骤
按 **`INTEGRATION.md`** 的顺序做：§1 加载页 → §2 棋盘 → §3 弹窗 → §4 夜间 → §5 宝箱 → §6 灯塔格 → §7 存档标记 → §8 小屋提示 → §9 BuildInfo。每做完一项，对照 §13 的验收要点检查。

## 7. 待办明细（每一项都写了现状、验收、接入要求、测试和坑）
**测试怎么跑**：仓库根目录 `node tools/test_<名字>.cjs`（每个文件单独跑）；另外还有 `node --test tests/preflight.test.mjs` 和 `python3 tests/asset_preflight_test.py`。很多测试用到 `node:module` 的 `stripTypeScriptTypes`，**要 Node ≥ 22.13**（预览机上是 v20.19，跑不了这类测试，要在本地 Mac 上跑）。浏览器冒烟测试：先 `python3 tools/serve_smoke.py`，再 `node tools/run_browser_smoke.cjs`（要装 Playwright）。

| # | 待办 | 现状 | 验收标准 | 接入要求 | 要跑的测试 / 会受影响的断言 |
|---|---|---|---|---|---|
| 1 | 加载页和首帧 | 现在是 Cocos 宋体启动画面 + 电影截图 | INTEGRATION §13 第 1–2 条 | §1：切图放主包 `assets/startup/`，坐标照 coords.json，铺满规则、进度只跟三个真实阶段、风车和提示字淡入 0.2–0.3 s、ready 后淡出 0.6–0.8 s；删掉电影截图 | `test_startup_ready_gate.cjs`；`tools/verify_native_loading.py`、`prepare_native_loading.py` |
| 2 | 棋盘换皮（28 项清单） | 全部是代码画的奶油方块 + `pieces.png` | §13 第 3–6 条 | §2 清单：暂停移到左上，信息牌合并标题 / 目标 / 步数，道具栏最多 3 个（星光 > 风语铃 > 潮汐瓶 > 地区道具），删珍珠，去掉常驻道具名，status 改成 2 s 的临时提示条，自动提示 5 s / 8 s（不影响星级），换背景 | `test_tool_switch_ui.cjs`（ToolLabel、status.string、hintBtn、retryBtn、珍珠槽）、`test_tool_switch_bindings.cjs` / `test_tool_switch_runtime.cjs`（pearl）、`test_result_layout.cjs`（bagBtn、retryBtn、hintBtn、uiStatus）、`test_mobile_native_ui.cjs`、`test_native_ui.cjs`、`test_world_r5.cjs`、`test_mainline_r5_ui_regression.cjs`、`test_r5_persistent_native_ui.cjs`、`test_restoration_interactions.cjs`（pearl） |
| 3 | 背景替换 | `OriginalLevelBackground` 厚涂云 + 程序海 | 棋盘底图是 `bg_island_board.jpg`，没有 `painted-cloud.png` 的引用 | 背景按地区放 `region_*` 分包 | `test_level_background.cjs`、`test_original_background.cjs`、`test_dynamic_original_background.cjs`、`test_cloud_integration_review.cjs`（都断言了 painted-cloud / OriginalLevelEnvironment） |
| 4 | 暂停面板 | 没有面板，只有一行字 | §13 第 7 条 | §3：继续 / 重来（确认）/ 行囊 / 设置 / 回到小岛（**不确认**，直接 `requestExit`）/ 音乐和音效开关；没有手动提示 | `test_result_layout.cjs`、`test_mobile_native_ui.cjs`、`test_world_navigation_guard.cjs` |
| 5 | 统一弹窗框和按钮 | 平面奶油卡片 | 宽 680、无钉框、文楷标题、下层点不到 | §3 九宫格参数；`BlockInputEvents`；动效 200–250 ms | `test_warm_button.cjs`、`test_warm_button_childfirst_lifecycle.cjs`、`test_ui_contrast.cjs`、`test_astra_ui_guards.cjs` |
| 6 | 设置（音乐音量、单独的音效静音、不做震动） | 只有全局静音的 API，没有界面 | §13 第 9 条 | `GameAudio.setMusicVolume`；新增 `setSfxMuted / isSfxMuted`，key `qfl.audio.sfxMuted`，在 `assets/scripts/audio/GameAudio.ts` 约 285 / 631 行的判断里加 `\|\| this.sfxMuted`；减少动态写 `forest-v33-reduced-motion` | `test_audio_lifecycle.cjs`（setMuted、musicVolume）、`test_audio_ui_gestures.cjs`（musicVolume）、`test_audio_context_contract.cjs` |
| 7 | BuildInfo.ts 版本号 | 没有给玩家看的版本号 | 关于页显示「v0.1 · 构建 <7 位 SHA>」 | §9：构建前生成，仓库里只提交 `'dev'` 占位 | `tools/check_wechat_build.py`；新加一个小测试，断言 Label 文案格式 |
| 8 | 关于页 | 没有 | `r3/about.png` | 游戏名图 + 版本 + 三条许可 + 许可全文 | 新增 |
| 9 | 领奖「获得」弹窗 + 宝箱 GLB 和开盖动画 + 删除 `ResultChestGeometry.ts` | 宝箱几何数据写在 430 KB 的脚本里 | §13 第 11 条：0.5 s 停在 −118°，看得到箱子里面 | §5：把 RenderTexture 的 mesh 换成 GLB，相机俯角 40°；替换 `WorldIntegrationBoot.ts:327-328` | `test_result_chest_3d.cjs`（**直接读 `ResultChestGeometry.ts`**，必须重写）、`test_combined_3d_ui.cjs`、`test_chest_childfirst_lifecycle.cjs`（引用 ResultChestGeometry）、`test_result_chest.cjs`（OriginalResultChestPainter）、`test_result_chest_scope.cjs`、`test_mainline_reward_entry_fix.cjs` |
| 10 | 结算：差一点点 / 还没存上（宝箱灰显）/ 旅途回顾 | 失败页标题「再走一次」，只读时也落到这个标题 | §13 第 13 条 | 标题图 `title_5`（差一点点）、`r2/slices/title_旅途回顾.png`；还没存上的文字是「存好后就能打开」 | `test_result_layout.cjs`、`test_mainline_readonly_compat.cjs`、`test_r5_final_presentation.cjs`（uiStatus 文案） |
| 11 | 首次获得道具介绍 + `seenTools` | 没有 | 每件道具只介绍一次 | §7：`qfl.ui.seenTools`（建议存 localStorage，不进 journey） | 新增；`test_mainline_storage_boundaries.cjs`、`test_r5_real_storage_boundaries.cjs`（确认新 key 不会被当成 journey 改动） |
| 12 | 行囊（岛上 / 关卡内） | 纯文字列表 | `r2/bag_*.png`，没有珍珠 | §3 行囊 | `test_tool_switch_ui.cjs`、`test_world_r5.cjs` |
| 13 | 旅程册（只算主线星 + 挑战标记 + 潮汐小径新文案） | 纯文字 | `r2/journey_book.png` | 主线 x/12，地区挑战 x/4；把 CHAPTERS 里潮汐小径的描述改成「听潮声，捡起海浪送来的贝壳。」 | `test_world_r5.cjs`、`test_legacy_journey_reader.cjs` |
| 14 | 海岛小憩改成点小屋打开；岛上的设置按钮打开完整设置 | 设置按钮打开的是海岛小憩；点灯塔（包括小屋）都是 `returnHome` | §13 第 15 条 | §3：新增 `hitCabin`，命中就打开海岛小憩；`IslandHomeInteraction` 原来的灯塔行为不变 | `test_world_navigation_guard.cjs`、`test_robot_interaction_guards.cjs`、`tools/stage_interaction_guards.py` |
| 15 | 小屋提示 + `cabinHintSeen` | 没有 | 第一次回岛时播放，点过以后永不再出现 | §8：曲线 0.4 s + 3 ×（0.7 + 0.9 s），停在 0.25；`qfl.ui.cabinHintSeen` | 新增；`test_window_view_night.cjs`（夜间不乘色） |
| 16 | 灯塔目标格（**后面几格的坐标从关卡数据读**） | UI 只画当前格的 2 px 框 | §13 第 12 条 | 关卡字段 **`config.beacons: number[]`**（有序，`index = row·7 + col`）、可选 **`config.beaconTypes: number[]`**、**`config.goals.beacons` = beacons.length**。样例：`"goals":{"beacons":3,…},"beacons":[22,24,26]`（`r4-cloud-compat/runtime/challenge-catalog.js` 关卡 `tide-c01-001`）。引擎有 `engine.beaconRoute` / `engine.beaconCursor`，`beaconTarget()` 返回 `{index,type,cursor,total,typed}`。**快照里要新增 `beaconRoute: Array.from(e.beaconRoute)`**（`challenge-controller.js:474` 和 `.d.ts`），UI 取 `beaconRoute.slice(cursor+1)` 画淡点 | `test_world_r5.cjs`、`test_cloud_integration_review.cjs`；对 `active` 做深比较的快照测试要补上 `beaconRoute` |
| 17 | 夜间乘色和文字换色 | 只有岛上的道具有夜间权重 | §13 第 10 条 | §4 | `test_window_view_night.cjs`、`test_ui_contrast.cjs` |
| 18 | 三件地区道具 | v2 等 Funning 确认 | 确认后切图换进 (b) 的道具栏 | `r2/slices/tool_*.png`，跟 (b) 道具同机位、同尺寸 | `test_tool_switch_*.cjs` |
| 19 | 草甸 / 天空城的风景和背景 | **天空城已重渲**（小图 + 棋盘背景）；**草甸仍是占位**，等场景bot 出 `region_meadow` 的场景 GLB | 场景建好后用自有模型重渲 | `render_regions.py` 已改成仓库相对路径 + 天空城相机；草甸 GLB 放到 `bundles/region_meadow/env_meadow.glb`（或 `MEADOW_GLB`）后补相机；背景要接进代码时，`BOARD_BACKGROUND` 按地区选 `region_skycity/board/bg_skycity_board` | `node tools/test_manifests.cjs`；`python3 tools/board_art_sync.py --check` |

## 8. 已知的坑
- **Node 版本**：测试要 Node ≥ 22.13（要用 `stripTypeScriptTypes`）。
- **内存**：预览机只有 16 GB，而且和别的 agent 共用。岛 GLB（5 MB，Draco）用 EEVEE 渲染会被 OOM 杀掉，`render_regions.py` 已经改成 **Cycles CPU、24 采样、4 线程**。渲染前要删掉天穹、云层、夜间件和室内件。
- `fix_shadow.py` 对同一批 raw **只能跑一次**（重复跑影子会越来越淡）。
- `c-popups/src/inputs/` 是 (b) v3.1 的**快照**。(b) 再改的话，要把 `b-board/board_final_tools.png`、`board_final_notools.png`、`slices/bg_island_board.jpg`、`src/raw/*` 复制过来，再重跑 (c) 和 r2。
- `beacon.py` 用 `exec` 读 `b-board/src/compose.py`，靠字符串替换插钩子。(b) 的 compose.py 结构变了的话（例如 `# pieces` 这一行、`icons=[…]` 这一行），钩子会失效，要同步改。
- 夜间文字**千万不要**跟着 Sprite 一起乘色：会掉到 3.6–3.8:1，不达标。
- `env_lighthouse_ext` 网格把小屋也包在里面，现在点小屋也会触发 `returnHome`；做 `hitCabin` 时要先判断小屋，再判断灯塔。
- 主线引擎（`mainline-r1/runtime/vendor/engine.js`）有 `beaconRoute`，但**没有 `beaconTarget()` 方法**，`mainline-session.js:86` 写死了 `beaconTarget: null`。现在的主线关卡里没有 beacons；以后要加的话，要照着 r4 的实现补这个方法。
- journey 存档有只读保护和事务签名，UI 偏好（seenTools、cabinHintSeen）**不要**写进 journey，否则只读状态下会写不进去，还可能触发 journey-changed。
- 宝箱 GLB 的材质槽名是 `M_env_palette_piece`，导入 Cocos 后要手动重新绑到调色板材质上（GLB 不带贴图）。
- 烘焙标题时，标点「，？」的字距收到 0.62（`ui_kit.baked_title`）；加新标题时要检查标点。
- 微信端 Sprite 的 additive / screen 混合（小屋暖光）要在真机上验证；不行的话退回 normal 混合 + 较低的透明度。
- 不要误用 `slices/_rejected/` 里的青叶方案 B；`result_chest_preview.glb` 也不进包。

## 9. 下一步建议
1. 先接最显眼的：§1 加载页 → §2 棋盘换皮 → §5 宝箱 GLB（删掉 430 KB 的主包脚本）。
2. 然后接弹窗：§3 统一框 → 暂停 / 设置 / 结算 → r2 面板。
3. Funning 确认三件地区道具以后，把切图换进 (b) 的道具栏。
4. 场景bot 做好草甸 / 天空城以后，重渲地区小图和棋盘背景。
5. 下一轮美术：横屏布局、区域关格子标签和连线的视觉、章节详情页、许可全文页、其余地区道具（每件约 9.5 KB）。

## 10. 禁止事项
- **不能用任何电影截图、电影素材或「起风了」的截图**（包括 `wind-rises-apron-ref.jpg`），不能参考、临摹、放进对比图、提交或打包。
- 不能往 int/v1 直接 push 美术分支；合并要走 PM 审核。
- 没经过 PM / Funning 确认，不要改已定稿的布局（尤其是暂停面板）。
