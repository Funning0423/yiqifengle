# 帆船美术验收返修（sail-art-fix）

按 GBT 对比图返修靠岸穿模、夜景、起航机位、帆色和旧 transforms 文件名。没有 push。

## 提交

父提交 `61ab1ebc94f4e4c69d62eb603fb08cce216466d5`（sail-art 末端）。以下为完整 SHA 与 tree。截图和本报告在最后一次代码提交之后另一次提交。

| SHA | tree | 说明 |
|---|---|---|
| `4a9a39b2502238488ec2cca80dd53b90fb1e3b6a` | `06beaa0a5c49596a71595cc7d8431d4a192f8ef2` | 航线终点保持水线；M0 附近挖河口；夜间压暗整片草地；帆改 unlit 米白；新 clearance 测试；更新 sail-transforms |
| `29a7c13be97821eb65f573df230516c7f1a409b3` | `3b6aaabe521a8e842849439b2da79f9dbcc23cc5` | 可见挖方缩短，水下仍沿航线清龙骨；K6 机位外拉 |
| `59f830c6bb2a6b76c06c28ca8b7f634c19e8bc64` | `bce99b38927819f58efde37e37b9211bdeb52e88` | K6 改到右舷看栈桥；夜间加近镜头星星 |
| `bc65266827536fc162fe197492da8fe275b18b07` | `550cf180b73fd196fd07356a6c6e87c89dbeccbe` | 女孩站到草地上；K7 星星挂到相机子节点 |
| `4cf82882d90da69539246c5ca17dc88eaa01e6aa` | `74d4885cdff2bf4367bd8ab76a01bb2eb802e067` | 七张静帧、俯视检查图、对比图和本报告 |

`meadowOffset`、`JOURNEY_TRANSPORT['island-meadow']='sail'` 和桥路径没有改。`SAIL_MEADOW_SINK=1.35` 保留；靠岸靠的是「终点不爬坡 + 局部挖河口」，不是再加深整片草地。

## 五个问题怎么修的

1. **K6 靠岸**：旧航线末段把船 y 插到 M0 地形高度，船体埋进草里。现改为全程 `SAIL_WATER_Y`；运行时在帆船草地副本上切开 M0 附近河口（`SailChannel`，可见口袋约 10 m，水下航线走廊清龙骨），并放靠岸栈桥。女孩下船后站在栈桥岸侧草地上。俯视检查图 `K6_land_above.png` 能看清船在水上、靠栈桥。
2. **K7 夜间**：对草地/风车/树/远景/云做与旅程夜景同一套 `mainColor`/`windParams` 压暗；船尾灯点光压到很小；`night_stars` 打开，并在相机前加几颗菱形星星，静帧里可见。
3. **K2 起航回望**：机位改到右舷前方回望，女孩坐在船里可见；尾迹透明度随船速略提高。
4. **帆色**：帆布改 `builtin-unlit` + 暖米白 `mainColor`，双面，背光不再发黑。
5. **sail-transforms.json**：旧程序化文件名换成六个 GBT glb，并注明套件不读此文件、实际摆放在 `SailArt.ts`。

## 测试

Node 22（`QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript`）`tools/journey-integration/run-suite.cjs`：103 项里 102 项 PASS。唯一非 PASS 是 `navigation-guard: BLOCKED_BROWSER`。新增 `sail-clearance` 已登记。

`tools/transitions/test_frame_background.cjs` 0.1 s 采样：PASS。4256 帧。最紧 clearM = 2.45（第 192 帧，t = 19.2 s，390×844）。门限没有放宽。

帆船段 `build05S` ≈ 30.351 s（上限 30.5）。

`test_sail_clearance.cjs`：整段航线船体包围盒不低于挖开后的草地，最紧间隙约 0.174 m。

## 包体

wechat-release 合计 **19,621,880 B**（HEAD `bc652668`，build-guard exit 36 视为成功）。

- 相对 sail-art（19,613,723 B）：+8,157 B
- 硬上限 24,641,536 B，低于上限

`transport_sail` 分包 **195,955 B**（约 0.187 MiB），低于 1.0 MiB 硬上限。压缩方式未改（仍是量化网格 + 索引色 PNG）。

main 分包 1,338,998 B。web-test 20,410,944 B。

## 截图

390×844、hasTouch，来自 build-guard 的 web-test，`WorldR5Integration.scene`，`?sailshot=1&k=N`。每张 `sips -Z 900`。对比图左渲染、右游戏。目录 `docs/r5/sail-art-fix/shots/`，并复制到任务包 `shots/`。

| 静帧 | 对比 | 看到的内容 |
|---|---|---|
| `K1_board_pier.png` | `K1_board_pier_vs_render.png` | 栈桥登船，帆收起，女孩在栈桥上 |
| `K2_depart_lighthouse.png` | `K2_depart_lighthouse_vs_render.png` | 回望灯塔，女孩坐在船里可见 |
| `K3_open_sea.png` | `K3_open_sea_vs_render.png` | 远海跟随，帆米白，女孩可见，有尾迹 |
| `K4_approach_mouth.png` | `K4_approach_mouth_vs_render.png` | 接近河口，帆米白，女孩坐着 |
| `K5_enter_river.png` | `K5_enter_river_vs_render.png` | 入河前水面，右岸草地风车 |
| `K6_land_M0.png` | `K6_land_M0_vs_render.png` | 靠岸：船在水上，旁有栈桥，女孩走上草地 |
| `K6_land_above.png` | — | 俯视检查：船浮在水上、靠栈桥，不在草里 |
| `K7_night_open_sea.png` | `K7_night_open_sea_vs_render.png` | 夜景压暗，帆米白，座舱暖光可控，可见菱形星星 |

## 可能和 balloon-art / region-nodes-r3 冲突的文件

`TransportLeg.ts`、`SailArt.ts`、`SailShot.ts`、`SailChannel.ts`（新）、`tools/journey-integration/run-suite.cjs`、`tools/transitions/sail-transforms.json`、`tools/transitions/test_sail_clearance.cjs`（新）。

## 未完成

- 靠岸挖方仍是直角河口，岸线不如渲染图自然；俯视图更清楚，主镜头仍有一部分竖切草岸。
- K7 星星是相机侧菱形补点（贴近渲染图的菱形星），glb 星场本身在竖屏 FOV 里仍偏少。
- 源 glb+png 仍高于 0.35 MiB 设计目标；量化后分包已低于目标。

## 磁盘

结束时 `df -h ~`：可用约 4.2 GiB。构建缓存和 `creator-build-project/build` 已删，构建锁已释放。
