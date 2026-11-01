# 帆船转场 fix REPORT

海岛南码头到草地的帆船转场还在 `JOURNEY_TRANSPORT['island-meadow']='sail'`。`bridge` 模式和 `meadowOffset [0,0,24]` 没有改。这一轮只修验收画面：正式角色坐在船上，以及静帧里能认出橙帆小船。

## 提交

| SHA | tree | 说明 |
| --- | --- | --- |
| `d76fbc5278ac3a2d22e5ff5a61d90c5257b6b977` | `04bce4559889d84236357a6624599369abaed9f9` | 等 `FlowReferenceStandin` 进入 `sit_hold` 再构图；船体 / 桅杆 / 橙帆分开 |
| `49b133e9d06f3f64e8ee07d42b2ad689025b48c6` | `ab4ff746ae54ba50d1d8df4d3d4a5575596ee9e8` | 静帧海、天、草地、船体、帆分色，避免糊成一块米色 |
| `c25fdcab245d5478e4ff996c25341011e3e2e7e3` | `92a43f41df4e479de382f8c860716b6db5dd4d78` | 验收静帧和本报告 |

基线是上一轮 `ca5a363e6f9e97dcc49fced19ab77f4ffe3ec095`。没有 push。

## 画面

`?sailshot=1` 不再在角色创建前返回。它先加载 `region_island` 的正式预制体，建好 `FlowReferenceStandin`，`bindVisual` 播 `sit_hold`，再把根节点挂到船上的 `seat_bench`。没有测试横幅。探针：`character=true`，`clip=sit_hold`。

船的静帧网格和 `transport_sailboat.glb` 用同一套轮廓：浅色船体、深色龙骨和桅杆、朝向跟随镜头的橙帆。上一轮那块橙色梯形是侧向的帆，船体贴在水面上，又和帆涂成同一个颜色。

程序化资产仍由 `tools/transitions/build-sail-assets.cjs` 生成，CC0-self。

| 文件 | 三角面 |
| --- | --- |
| `transport_sailboat.glb` | 72 |
| `transit_sea_cards.glb` | 10 |
| `transit_clouds.glb` | 32 |
| 合计 | 114 |

源文件 13,264 B。分包 `transport_sail` 21,542 B，低于 0.25 MiB。`check_region_export.py` 为 CHECK PASS。

## 测试

Node 22：100/101 PASS。非 PASS：`navigation-guard: BLOCKED_BROWSER`。套件退出码 1。

Node 20：98/101 PASS。非 PASS：`legacy-board-ui-pure`、`reward-background-return` 为 `BLOCKED_NODE`（需要 Node ≥ 22.6），以及 `navigation-guard: BLOCKED_BROWSER`。

frame-background：4214 帧。`nearHit=false`，`clearM` 最紧 2.956 m（第 2000 帧，768×1024，昼，t=19.4 s，S-d，`meadow_terrain`），`back=0`，`void=0`，`domes=1`，`horizonGap=0`。门限没有放宽。这一轮几何帧的 DC 是 14，三角面 270（上一轮 DC 12、三角面 202），仍低于 DC 53 和三角面上限。

时长仍是上一轮的 30.069 s。加速度、转向、彩虹桥逻辑桥没有改。

## 包体

`build-wechat-guarded.sh both`，HEAD `49b133e9`，Creator 退出码 36。

- wechat-release：19,430,968 B
- 相对 r4 19,335,755 B：+95,213 B（约 0.091 MiB）
- 相对上一轮帆船包 19,417,147 B：+13,821 B
- 上限 24,641,536 B

+0.05 MiB 是 52,429 B。上一轮功能本身已经是 +81,392 B。这一轮为了能看清船，`main` 从 1,318,367 B 增到 1,322,499 B（+4,132 B），`transport_sail` 从 11,853 B 增到 21,542 B（+9,689 B）。再砍约 42,785 B 才会碰到 +0.05 MiB，剩下的是转场脚本和这套网格，没有再压的空间。

分包字节：

| 分包 | 字节 |
| --- | --- |
| 主包（不含 subpackages） | 1,871,008 |
| audio_bgm_island | 418,907 |
| board_art | 2,131,356 |
| internal | 297,535 |
| main | 1,322,499 |
| region_island | 2,998,394 |
| region_lakeside | 541,965 |
| region_meadow | 2,934,449 |
| region_skycity | 3,326,944 |
| resources | 446,303 |
| shared_effects | 563,694 |
| static_seat_preview | 2,556,372 |
| transport_sail | 21,542 |

web-test：20,219,251 B。

## DC、帧率、棋盘首帧

QA 静帧 `?sailshot=1`（无微信环境）：

- DC 15（≤ 53）。多出来的是角色和拆开的船体部件。
- 390×844 的 fps 为 60。
- `boardMs` 为 0（S-b / S-d 镜头离河口远，没有铺草地薄片；S-e / S-g 铺了，耗时仍是 0 ms）。

## 截图

PNG，`sips -Z 900`，都小于 400 KB。目录 `docs/r5/sail-fix/shots/`，并复制到任务包 `shots/`。来自 build-guard 的 web-test，视口 390×844，`hasTouch`。

- `S-b-390x844.png` 上船，浅色船体、深色桅杆、橙帆，人坐在桅旁
- `S-d-390x844.png` 远航，橙帆在蓝海上，前方是绿带
- `S-e-390x844.png` 河口，船在绿地上方，后面是海
- `S-g-390x844.png` 上岸，橙帆落在绿地上
- `S-d-night-390x844.png` 夜间远航，天是深蓝，人坐在浅色船体上

没有从 mainline-04 实机播到 04→05 中段。`sailshot` 在棋盘和 `__worldIntegration` 建好之前就返回，这样才能在静帧里放正式角色，而不是先把整座海岛画出来。公开接口没有把旅途拖到中段的入口。通关 mainline-04 再点下一关才会走实机帆船，那不是这一轮的静帧入口。

## 未完成与风险

- 静帧是 QA 参数，不是棋盘打完后的实机过程。原因见上。
- 巡航速度仍高于设计稿的 3.6 m/s，和上一轮相同，门限没有放宽。
- 本机没有 Blender，旧转场审计没有重跑。
- 角色在跟随镜头里部分会被桅杆挡住。她在 `sit_hold`，戴草帽、黄衣服，坐在船体上。
- 没有 push。
