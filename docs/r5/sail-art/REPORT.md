# 帆船转场接入 GBT 美术

游戏里的岛→草地帆船段使用 `transport_sail` 里的 GBT 网格（`sailboat.glb` 及五份场景 glb），程序化橙帆梯形船已从分包和运行时拿掉。女孩在航行拍坐在 `seated_root_anchor` 上，登船拍站在栈桥上。没有 push。

## 提交

父提交 `5d3b3f1141b521e81dd31e90954f1bbb42c967e3`。以下为完整 SHA 与 tree。截图和本报告在这些提交之后另一次提交，父提交是最后一行。

| SHA | tree | 说明 |
|---|---|---|
| `ae3de81126d78bb22d5c8ea5a8054723930520f0` | `64b91e4ee6d67951260e33dc1af4fd047ac28c85` | 换入 GBT 船体、海面和航线。作者是本机用户名，因为这次漏了 `-c user.name`。按规则没有 amend。 |
| `f8ad3b7cb0b792627338b2722651ffb08547eed6` | `c515ea79de29199dc681aba5e2b522502c44ab89` | 网格量化，调色板保持索引色。 |
| `3aade52b842e2a29e39760712ab21fe5f6d26bfe` | `33632d42b10b4dc71572371453b2f84c29d9ad50` | 预制体按 `名字/名字` 加载。 |
| `86f564a6ac07e33520f1976a1186c32aae8481f4` | `db208c820dc2bcb8768a16709521ab0ec23b180f` | 帆船草地整体下沉 1.35 m，藏掉挡在真灯塔后面的远景卡片。 |
| `5221eb5cc8235570aa81951e8aa69573c2360323` | `3f16ee3477c9ef63d078f6ae6f6d1190e395e6a4` | 草地调色板关掉缺失顶点色；远景卡片同样处理。 |
| `48b0305b582228d26b16eb1584f18aa82ded3a5d` | `4e5a9b9abbad35d57a00e28d2e7bccd7adb45fe5` | 入河镜头改到爬坡之前，船尾灯不再照白座舱。 |
| `97d8b20e8050e286f83f854c4dcd28880bdc2627` | `298730e00567dfd38fabcc034f7cfcd47276e228` | 入河镜头再提前到距 M0 约 18 m 的水面，夜空压成深蓝。 |

`meadowOffset`、`JOURNEY_TRANSPORT['island-meadow']='sail'` 和桥路径没有改。帆船草地只用 `sailMeadowRoot` 多下沉 `SAIL_MEADOW_SINK=1.35`，让海面盖住南侧低地。

## 测试

Node 22（`QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript`）`tools/journey-integration/run-suite.cjs`：102 项里 101 项 PASS。唯一非 PASS 是 `navigation-guard: BLOCKED_BROWSER`，和 sail-fix 基线一致。套件在 `97d8b20e` 的工作区上跑过（含该提交的镜头改动）。

`tools/transitions/test_frame_background.cjs` 0.1 s 采样：PASS。4256 帧。最紧 clearM = 2.45（第 192 帧，t = 19.2 s，390×844，对着 `meadow_terrain`）。门限没有放宽。

帆船段 `build05S` = 30.363 s（上限 30.5）。航线 50.13 m，巡航 4.4 m/s，弦长 52 m。

`test_transport_sail.cjs` 里原有断言没有删。程序化三角面和文件名的替换写在 `tools/transitions/asset-budget.cjs`：六个 glb、四张 png、锚点名，并确认旧的 `transport_sailboat.glb` / `transit_sea_cards.glb` 不在分包目录。`tools/transitions/build-sail-assets.cjs` 改成直接退出的弃用脚本，不再往 bundle 里写程序化船。新测试 `tools/transitions/test_sail_art.cjs` 已登记进 `run-suite.cjs`（id `sail-art`）。

## 包体

wechat-release 合计 **19,613,723 B**（HEAD `97d8b20e`，build-guard exit 36 视为成功）。

- 相对 r4（19,335,755 B）：+277,968 B
- 相对 sail-fix（19,430,968 B）：+182,755 B
- 硬上限 24,641,536 B，低于上限

`transport_sail` 分包 **195,957 B**（约 0.187 MiB），低于 0.35 MiB 目标和 1.0 MiB 硬上限。压缩方式：Cocos 3.8.8 网格 `meshCompress`（quantize + encode，与湖畔同一套选项）。贴图保持索引色 PNG，没有转成别的格式。源 glb+png 仍是 439,962 B / 6,678 三角，高于 0.35 MiB 的源文件目标；分包按量化后的 bin 计。

main 分包 1,330,839 B。web-test 20,402,783 B。

源三角面 6,678（船 1,510，海 544，道具 1,046，远景 764，云 2,280，河口 534）。几何审计里的 14 DC / 246 三角是遮挡用的盒子代理，不是实机船。

`transport_sail` 逐文件（清理构建目录之前清点）：

| 字节 | 文件 |
|---:|---|
| 34753 | native/48/484e4d00-e28f-47de-bd8c-bfa0af8783e2.png（海浪） |
| 13875 | native/04/049e8173-…@1dee9.bin |
| 12336 | import/0a/0a01cca96.json |
| 11369 | import/0e/0ea9ab8c8.json |
| 10890 | native/0e/0e788a92-…png（调色板） |
| 7726 | import/08/080e55c11.json |
| 6628 | native/51/51c17de0-…@7910e.bin |
| 6008 | native/b4/b40dec01-…png（泡沫） |
| 5842 | config.json |
| 5664 | native/e5/e5a5b894-…@107b9.bin |
| 5559 | import/0a/0ab0d580e.json |
| 5535 | native/d5/d5f21182-…png（帆布） |
| 5033 | native/63/633ce12f-…@65ac7.bin |
| 4599 | native/eb/eb1e6694-…@9a8b0.bin |
| 4109 | native/63/633ce12f-…@80ff7.bin |
| 3822 | native/04/049e8173-…@23b7c.bin |
| 3775 | import/07/072eafa40.json |
| 3500 | native/51/51c17de0-…@25b6c.bin |
| 2902 | native/e5/…@8d5c4.bin |
| 2899 | native/51/…@69fe4.bin |
| 2887 | native/51/…@9d23a.bin |
| 2883 | native/e5/…@cfb64.bin |
| 2866 | native/51/…@72584.bin |
| 2804 | import/02/02881ba1a.json |
| 2475 | native/e5/…@e8354.bin |
| 2456 | native/eb/…@1f7f0.bin |
| 2450 | native/eb/…@da662.bin |
| 2244 | native/51/…@35c12.bin |
| 2243 | native/63/…@b8425.bin |
| 2241 | native/51/…@e793a.bin |
| 1448 | native/63/…@6348c.bin |
| 1393 | native/63/…@210be.bin |
| 1251 | native/04/…@89490.bin |
| 1235 | native/e5/…@57906.bin |
| 1044 | native/e5/…@4159f.bin |
| 741 | native/04/…@ea533.bin |
| 666 | native/bf/…@b13ca.bin |
| 620 | game.js |
| 592 | import/0a/0a484728a.json |
| 547 | native/e5/…@5bbd0.bin |
| 520 | native/04/…@9df44.bin |
| 446 | native/e5/…@9f1c5.bin |
| 425 | native/e5/…@481ed.bin |
| 389 | native/04/…@3cf97.bin |
| 382 | native/04/…@3679b.bin |
| 348 | native/e5/…@3bdeb.bin |
| 326 | native/e5/…@9e251.bin |
| 295 | native/04/…@3478b.bin |
| 270 | native/04/…@3125b.bin |
| 185 | native/04/…@d8b43.bin |
| 173 | native/bf/…@c0b8a.bin |
| 72 | import/d5/d5f21182-09bd-454f-ac81-ab81a749d449.json |
| 72 | import/b4/b40dec01-a765-4d3e-a748-3f0636df9b4c.json |
| 72 | import/48/484e4d00-e28f-47de-bd8c-bfa0af8783e2.json |
| 72 | import/0e/0e788a92-712e-4a3b-a733-c03a6d02f9a1.json |

## 截图

390×844、hasTouch，来自 build-guard 的 web-test，`WorldR5Integration.scene`，地址 `index.html?sailshot=1&k=N`。每张 `sips -Z 900`。对比图是渲染图在左、游戏在右，索引色压到 400 KB 以下。目录 `docs/r5/sail-art/shots/`，并复制到任务包 `shots/`。

| 静帧 | 对比 | 看到的内容 |
|---|---|---|
| `K1_board_pier.png` | `K1_board_pier_vs_render.png` | 栈桥上的女孩，帆收起，白船体红舷。她靠船的那只脚靠近栈桥边缘。 |
| `K2_depart_lighthouse.png` | `K2_depart_lighthouse_vs_render.png` | 反打灯塔。女孩坐在船里，背景没有黑块。 |
| `K3_open_sea.png` | `K3_open_sea_vs_render.png` | 尾随远海，帆上有青纹，女孩坐着，前方是草地风车。 |
| `K4_approach_mouth.png` | `K4_approach_mouth_vs_render.png` | 船在蓝水上接近河口，芦苇和风车在前，女孩坐在船里。 |
| `K5_enter_river.png` | `K5_enter_river_vs_render.png` | 入河前的开阔水面，右岸是草地和风车。船不在草里。 |
| `K6_land_M0.png` | `K6_land_M0_vs_render.png` | 靠岸，帆收起。女孩在船和风车之间的草地上，没有正好踩在白路上。 |
| `K7_night_open_sea.png` | `K7_night_open_sea_vs_render.png` | 夜间：深蓝天和水，船尾灯暖光，女孩坐着。这一机位里星点不明显。 |

## 可能和 balloon / region-nodes 冲突的文件

`RegionJourneyAdapter.ts`、`TransportLeg.ts`、`SailRide.ts`、`SailShot.ts`、`WorldIntegrationBoot.ts`（只动了 `presentSailShot`）、`tools/journey-integration/run-suite.cjs`、`creator-build-project/assets/bundles/transport_sail/`。

## 未完成

- 源 glb+png 439,962 B 仍高于 0.35 MiB 设计目标。量化后的分包已经低于该目标和 1.0 MiB 硬上限。
- `tools/transitions/sail-transforms.json` 还写着旧程序化文件名。套件不读它。
- K7 的 `night_stars` 已在夜间打开，这张静帧里星点很少。
- 首个提交的作者名不是 Cursor Agent。

## 磁盘

结束时 `df -h ~`：可用约 7.1 GiB。构建缓存和 `creator-build-project/build` 已删，构建锁已释放。
