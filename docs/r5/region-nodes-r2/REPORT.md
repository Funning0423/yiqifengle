# 区域关卡节点 r2 报告

分支 `gbt/r5-region-level-nodes-r2`。没有 push。区域之间仍是彩虹桥：`transportFor` 全部返回 `bridge`。`RegionJourneyAdapter.ts` 与 `f569ff0d9eeb9f6ab26bdc56276fa234e60c5ac4` 逐字节相同。没有改 `CharacterMotion.ts`、`anim_meta.json`、`WorldIntegrationBoot.ts` 的 FlowReferenceStandin 段，也没有改冻结 GLB。

## 提交

| SHA | tree | 说明 |
|---|---|---|
| `c9ed530c201a2d3535c684080e148196c304dbcd` | `4aa46a490dd1e37d8ab66927855e1a0796987193` | 把走路、跟随镜头、自由探索和标记接到世界摄像机与角色 |
| `c6217b0b331f11d821328b7b537e5d715b3d50af` | `0ca24d4c61657a2733b45f62b8be9e5d0d6f448e` | 记录接线状态 |
| `d2f4fd9f8563cdfe3a56e7f34baac6f465377726` | `97a52db0093efb41ccf761b8767307621a6260f1` | 构建前的状态行 |
| `5dc9c9c46201f614a4aee965470e797a51224bf4` | `f648e339ff14b6407c0e56c737f1a21026900cb6` | QA 进入各区域棋盘；标记顶点色改为 0–1 |
| `8b3bd4c0fd6408b0deb2e4ea30edfacc73bcff84` | `92af64da3a4b70dd063d1b3b1c5ab11c6ffea536` | 终幕镜头对准星环，物件反馈镜头对准物件 |

基线 `76dc39b6ace3629d369e9447c92e65efe31b9741`，tree `3f2ddcab4252711f8449a1f439525e2a93260e58`。

## 这一轮做了什么

领奖或下一关时，`RegionNodeStage` 关掉棋盘宿主和区域背景相机，打开岛外层或对应的 `RegionJourney-*`，用 `applyCameraPose` 播 BoardToFollow 0.6 s、FollowWalk、FollowToBoard 0.8 s。人物走路仍走现有 `perform`。`performBounded` 每段 12 s 超时后 `cancel` 并 `cancelAndReset` 到该段终点，主线不会停在走路。天空之城主线 12 领区域奖励时从 S4 走到 S6（数据里本来就有这条边，坐标 (0.2, 0.03, −27.8)），然后开放自由探索。

标记是场景里的一颗 `builtin-unlit` 顶点色八面体，三种状态共用这一颗 MeshRenderer（约 +1 DC）。颜色是 DESIGN 的已完成 `#e2b657`、当前 `#fffaf2`、未解锁 `#9aa0a6`。没有测试横幅。

物件只按运行时节点名做 0.45 s 的晃动 / 旋转 / 弹跳，并发 `scene-tap`。草地 GLB 里没有羊，第四个物件是栅栏 `meadow_fence_merged`。海岛潮汐池没有单独网格，点按落在 `env_prop_palm_lean_01`。天空之城是机器人 `chr_robot_gardener_mesh`、星环 `env_sky_starring`、风铃 `env_sky_windchime_01`、大树冠 `env_sky_greattree_canopy`。这些网格都是已有场景资产，不是新下载的模型。程序化标记没有外部贴图。

`?qa=1` 才把 `qaShot` 挂到 `__worldIntegration`。玩家包没有这个 URL，也就没有这个入口，也没有测试横幅。截图构建的 `debug` 仍是 false。

## 测试

Node 22（v22.23.3）108 项里 107 PASS。唯一非 PASS：`navigation-guard: BLOCKED_BROWSER`。

Node 20（v20.20.2）108 项里 105 PASS。另外两项是允许的 `BLOCKED_NODE`：`legacy-board-ui-pure`、`reward-background-return`（需要 Node ≥ 22.6）。再加上 `navigation-guard: BLOCKED_BROWSER`。

新增条目都指向 `tools/region-nodes/test_region_scene_wiring.cjs`：`region-nodes-scene-wiring`、`node-markers`、`explore-props`、`advance-walk-timeout`。`RegionNodes.ts` 改成单行后 `region-nodes-data` 的 `--check` 仍 PASS。

## 包体

build-guard 在 `5dc9c9c46201f614a4aee965470e797a51224bf4` 上测得：

- wechat-release **19,435,130 B**
- 相对 r4 19,335,755 B：**+99,375 B（0.095 MiB）**
- 本任务写的 +0.05 MiB 上限是 +52,428 B，超出 **46,947 B**
- 绝对上限 24,641,536 B 仍满足
- web-test **20,224,922 B**

相对 r1 的 19,413,434 B 多 21,696 B，而且这 21,696 B 全部在 `main` 分包（r1 的 main 1,326,650 B，这次 1,348,346 B）。其余分包与 r1 报告逐项相同。

| 分包 | 字节 |
|---|---|
| 根目录（不含分包） | 1,870,865 |
| audio_bgm_island | 418,907 |
| board_art | 2,131,356 |
| internal | 297,535 |
| main | 1,348,346 |
| region_island | 2,998,394 |
| region_lakeside | 541,965 |
| region_meadow | 2,934,449 |
| region_skycity | 3,326,944 |
| resources | 446,303 |
| shared_effects | 563,694 |
| static_seat_preview | 2,556,372 |

做不到 +0.05 MiB 的原因，按字节：

1. r1 已经是 +77,679 B。其中主包新增脚本约 30,385 B，其余约 47,294 B 在 r1 报告里没有拆开，这次重编后除 `main` 以外的分包字节与 r1 完全一致，所以那 47,294 B 不是这一轮新脚本，也不是把脚本挪到分包就能消掉的（guard 把分包算进总字节）。
2. 这一轮必须进玩家包的是场景接线：`RegionNodeStage` 以及 `RegionNodePlay` / `ExploreInput` / `WorldNativeComposition` 的增量。`main` 比 r1 多 21,696 B。
3. `RegionNodes.ts` 从 baker 的缩进 JSON 改成单行，源文件 13,400 B → 6,554 B，少 6,846 B。省下来的抵不过新的运行时。
4. 测试、截图脚本、baker 都在 `tools/`，不进玩家包。`qaShot` 只有带 `qa=1` 才挂上，函数本身仍在主包里，只有几百字节。
5. `8b3bd4c0` 只改了终幕/物件镜头瞄准，没有再编 wechat-release（见未完成）。相对 `5dc9c9c4` 的包体，预期只是主包里几百字节的镜头代码，改变不了超出的 46,947 B。

## DC、帧率、棋盘首帧

这一轮没有单独再采样 DC 计数器、帧率或棋盘首帧。标记路径是一个 MeshRenderer，按 DESIGN 约 +1 DC。r1 在无头浏览器里棋盘 DC 45、海岛世界 83–89、大约 10 FPS，棋盘首帧没有按 16.7 ms 量到。那些数字这一轮没有重测。

## 截图

目录 `docs/r5/region-nodes-r2/shots/`。390×844，`hasTouch`，来自 build-guard 的 `web-test`（`5dc9c9c4` 那一次构建），经 `sips -Z 900`，每张都小于 400 KB。入口是 `?qa=1` 的 `qaShot`，没有测试横幅。

`8b3bd4c0` 的星环瞄准和物件特写没有进这批画面。截图进行时 r5-balloon 占着构建锁，锁的 owner pid 已经退出，但 balloon 的 agent 还在，锁也不满 120 分钟，所以没有抢锁，没有为 `8b3bd4c0` 再编一次。

| 文件 | 画面 |
|---|---|
| island-blend.png | 海岛，棋盘镜头往人物切到中途，人在沙滩上 |
| island-walk.png | 海岛，人在节点之间，旁边有标记 |
| island-board.png | 海岛关卡 04「小径守卫」的棋盘界面 |
| island-markers.png | 海岛跟随镜头，脚边的节点标记 |
| island-map.png | 海岛自由探索，拉远后的地图视角 |
| island-tap.png | 海岛地图视角下点按后的走路 |
| meadow-blend.png | 草地，镜头切向人物，路径上有浅色和黄色标记 |
| meadow-walk.png | 草地，人在路径上走路 |
| meadow-board.png | 草地关卡 08「长风的约定」的棋盘界面 |
| meadow-markers.png | 草地三种状态用的路径标记 |
| meadow-map.png | 草地自由探索的远景 |
| meadow-tap.png | 草地地图视角下的点按走路 |
| meadow-night.png | 草地夜间 |
| sky-blend.png | 天空之城，镜头切向场景 |
| sky-walk.png | 天空之城，人在场景里走，夜间天空 |
| sky-board.png | 天空之城关卡棋盘界面 |
| sky-markers.png | 天空之城场景与标记 |
| sky-map.png | 天空之城地图视角，人在台阶上，脚边有标记 |
| sky-tap.png | 天空之城地图视角下的点按走路 |
| sky-finale.png | 天空之城高处平台。这张是 `5dc9c9c4` 的仰角终幕，还没有 `8b3bd4c0` 把目标点对准 `env_sky_starring` |
| sky-prop.png | 天空之城物件点按那一帧。同样是对准风铃之前的构图，反馈不一定落在画面中心 |

## 可能和帆船 / 热气球冲突的文件

- `creator-build-project/assets/scripts/WorldIntegrationBoot.ts`（区域奖励按钮改为 `claimRegionAndWalk`，以及 `qa=1` 时挂 `qaShot`）
- `creator-build-project/assets/scripts/world-r1/WorldFlowComponent.ts`（`presentNodeWalkWorld`）
- `creator-build-project/assets/scripts/world-r2/WorldNativeComposition.ts`
- `creator-build-project/assets/scripts/world-r2/RegionFlowTest.ts`（`allowQa`）
- `creator-build-project/assets/scripts/world-r2/ExploreInput.ts`
- `creator-build-project/assets/scripts/region/RegionNodePlay.ts`
- `creator-build-project/assets/scripts/region/ExploreCameraCore.ts`
- `creator-build-project/assets/scripts/region/ExploreGate.ts`
- `creator-build-project/assets/scripts/region/RegionNodes.ts`（只改排版）
- 新文件 `creator-build-project/assets/scripts/world-r2/RegionNodeStage.ts`

没有改 `RegionJourneyAdapter.ts`、`JourneyTransport.ts`、彩虹桥、`TransportLeg` / `TransportVehicle` / `TransitBackdrop`。

## 未完成和风险

- 包体比 +0.05 MiB 多 46,947 B。原因见上面的逐项说明。绝对上限仍满足。
- `8b3bd4c0` 没有再跑 Creator。终幕对准星环、物件镜头对准风铃，只在代码和 Node 测试里。截图仍是上一版构建。
- 跟随走路时的点按没有提前跳到最后 1.2 m，靠 12 s 超时把角色松开。自由探索里的点按走路是直线，不是烘焙折线。
- 无头环境没有重测 60 FPS、DC 和棋盘首帧。
- 截图时 r5-balloon 占着 `~/cursor-tasks/.build.lock`。结束前会删掉本任务自己的 `library/`、`temp/`、`build/` 和自己的构建日志。

磁盘：构建前后大约还剩 5–6 GB。
