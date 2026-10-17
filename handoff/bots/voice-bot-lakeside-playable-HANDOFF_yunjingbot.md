# 风铃湖畔 → 运镜bot 交接（旅途 / 落地镜头、棋盘取景）

分支 `voice/build05-lakeside-playable` @ d8cd409（基于 09a1b8e）。坐标：Cocos 世界坐标，米，Y 轴向上（与 glTF 相同）。

## 1. 进入方式和场景节点
- 关卡 id：`r04-lake-01` … `r04-lake-06`（`isLakesideStage()` 也兼容将来改成 `r05-lake-*`）。
- 入口：旅程册第 4 章「风铃湖畔」→「继续挑战」→ `WorldNativeComposition.enterRegion('lake')`。目前和潮汐一样在**小岛站**开局（`selectionRegion()` 返回 'island'），**还没有去湖畔的实体旅途**。
- 背景租约：`region/LakesideBoardBackground.ts` 里的 `createLakesideBoardBackground`，由 `LevelBackgroundBinding` 加载，根节点挂在关卡 UI 父节点下面。
  - `LakesideLiveScene`：根节点（rig），可见时 active。
    - `LakesideScenery`：465 个实例，节点名就是 transforms 里的 `name`（例如 `LK_tree_mid_1_0`）。
    - `LakesideLights`：`Lakeside_Sun`、`Lakeside_Sun.001`、`Lakeside_SUN_dusk_side`（SphereLight，详见第 3 节）。
    - `LakesideBackgroundCamera`：Camera，priority 44，visibility 和图层都是 `LAKESIDE_LAYER = 1<<20`（和草甸、天空城共用，同一时间只会有一个）。
- 名字常量：`LAKESIDE_NODES`（LakesideBoardBackground.ts）。

## 2. 棋盘世界坐标
- 7×7 格，格心 x = −3.3 + 1.1·col，z = 8.7 + 1.1·row，y = 0（水面）。index = row·7 + col。`lakesideCellCenter(i)`。
- 格子外缘：x ∈ [−3.85, 3.85]，z ∈ [8.15, 15.85]，中心 (0, 0, 12)：`LAKESIDE_BOARD_BOUNDS`。
- 720×1280 下的投影（px，原点在左上）：四角 (175,832) (545,832) (92,1150) (628,1150)，中心 (360,961)。
  - 591×1280（9:19.5）下：四角 (144,797) (447,797) (75,1059) (516,1059)，中心 (296,904)。
  - 两组都是由 `screenshots/` 的代理渲染算出来的。
- 场景里的棋盘装饰保留了：荷叶 57、绳浮 18、软绳 1、浮灯 4、wb_line 16、风铃筏 2。
- 去掉了：3D 棋子（`LK_piece_*`）、接触影、涟漪环、board_frame（GLB 不在分包里）。棋子、格子和选中都由 2D 棋盘 UI 画。

## 3. 用到的相机参数（COCOS_HANDOFF §4 / scene_r5h3_lighting.json）
- 位置 [0, 13.2, 26.5]，旋转四元数 (x,y,z,w) [−0.22109, 0, 0, 0.97525]，前向 [0, −0.4312, −0.9022]。
- 竖向 FOV 61.928°（720×1280 基准），near 0.1，far 1000，透视，fovAxis VERTICAL。
- 适配：比 9:16 更高的屏幕保持水平覆盖，竖向 FOV 会变大，上限 75°（9:19.5 时是 72.353°）。更宽的屏幕保持 61.928°。位置和旋转在任何比例下都不变，所以落地镜头可以直接停在这个位姿上：`lakesideBoardPose(aspect)`。
- 写入走 `applyCameraPose(camera, pose, 'lakeside.board-background')`，只写自己的相机，不碰世界相机。
- 光：3 个太阳，用远处的 SphereLight 模拟（位置 = 棋盘中心 − forward×220 m，range 600，亮度按 1 / 0.08 / 0.31 缩放）。只照远山的 SUN_mtn_sky 没放。6 盏灯笼点光省掉了（handoff 允许）。
- 后期没做：LUT、Bloom、Vignette、Dither 都没有，`usePostProcess=false`，和草甸、天空城一样。清屏色 #f2b98a，因为分包里没有天空盒。

## 4. 旅途 / 落地镜头的挂点（建议）
1. **旅途路线**：`WorldNativeComposition.selectionRegion()` 现在对 lake 返回 'island'。等有了湖畔旅途，在 `RegionJourneyCore` 和 `RegionCameraData` 加一个 'lakeside' 区域，`ensureRegion` 的 order 里加上它，`selectionRegion` 对 `r04-lake-*` 返回 'lakeside'，旅途就会走 `travelRegion('lakeside')`。
2. **落地镜头**：在租约的 `frame()` 第一次可见之前（`setVisible(true)`），可以用 `LakesideBackgroundCamera` 从你的落地起点插值到 `lakesideBoardPose(aspect)`。按方案 A：中途不拉升，S 曲线平稳。终点必须正好是这个位姿，因为之后每次 `frame()` 都会把它写回去。建议在租约里加一个 `landing?(from:CameraPose, seconds)`，或者在 `LevelBackgroundLease` 里加一个可选钩子，我没有改这个接口。
3. **棋盘取景**：现在 2D 棋盘的屏幕位置由 BoardLayout 决定，和第 2 节的 3D 格子投影**没有对齐**（3D 格子在屏幕下部 832–1150 px）。要么调相机让 3D 棋盘区落在 2D 棋盘下面，要么把 3D 棋盘装饰（荷叶、绳）当作纯背景。这一项归你。
