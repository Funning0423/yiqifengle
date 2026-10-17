# 帆船转场 REPORT

海岛南码头（I6）到草地 mainline-05。`JOURNEY_TRANSPORT['island-meadow']='sail'`。彩虹桥还在：`bridge` 模式仍走 f569ff0 的 `rainbowBridge`，`meadowOffset` 仍是 `[0,0,24]`。

## 提交

| SHA | tree | 说明 |
| --- | --- | --- |
| `39ec45b042f8045e92e0c5daf2d2c37bf7efdd11` | `204bb5c8b55150f54a7ee7330e985efa6bb3b209` | 帆船航线、载具、背景、预加载、测试与程序化 GLB |
| `9210b99b43c70d9673a4d5e1f83ede005fd2a33d` | `aa779ff5d024c06df5cf6839ccaba0f12b8fbc4e` | STATUS |
| `d1228cd6243a958049fa95adea4019d042d5c6af` | `9ad0478619c510ad440ea0101eea33e4bb90aa1a` | Creator 导入后的 GLB meta |
| `2b7c09ef0a7b4e62a81662647d0e90ce26804d71` | `e9bc49a0a591f45aa3b08ef108aaba94e688d314` | 截图相机用 Vec3 `lookAt` 对准船 |

截图与本报告在最后一次提交里。

和 region-nodes 合并时会冲突的文件（本次没有合并）：

- `creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts`
- `tools/journey-integration/run-suite.cjs`

## 资产

全部自制（程序化生成），脚本 `tools/transitions/build-sail-assets.cjs`，许可证记为 CC0-self。没有第三方网格，Draco 解码器只在工具目录，不进玩家包。

| 文件 | 三角面 | 说明 |
| --- | --- | --- |
| `transport_sailboat.glb` | 29 | 船体 / 帆 / 座凳，两套材质，顶点色 |
| `transit_sea_cards.glb` | 10 | 地平线海卡 |
| `transit_clouds.glb` | 32 | 中层云卡 |
| 合计 | 71 | 分包 `transport_sail` 11,853 B，低于 0.25 MiB |

`python3 tools/region-export/check_region_export.py tools/transitions/sail-transforms.json creator-build-project/assets/bundles/transport_sail` 为 CHECK PASS。没有用 256² 色板：未压缩贴图会超过 0.25 MiB 目标，所以用顶点色。

## 测试

Node 22：100/101 PASS。非 PASS：`navigation-guard: BLOCKED_BROWSER`。套件退出码 1（有 BLOCKED 即如此）。

Node 20：98/101 PASS。非 PASS：`legacy-board-ui-pure`、`reward-background-return` 为 `BLOCKED_NODE`（需要 Node ≥ 22.6），以及 `navigation-guard: BLOCKED_BROWSER`。

新增且 PASS：`rider-parenting`、`transport-sail`、`frame-background`、`asset-budget`、`transport-flag`、`transit-background-resume`。

F7 / F8 / F10 / F11 / F12：

- 帧：4214（7 种屏幕 × 昼夜 × 0.1 s）。`nearHit=false`，`clearM` 最紧 2.956 m（≥ 0.6），`back=0`（≤ 1%），`void=0`，`domes=1`，`horizonGap=0`，DC 12，三角面 202。
- 最差帧（净空最小）：第 2000 帧，768×1024，昼，t=19.4 s，处于 S-d，`clearM=2.956`，对象 `meadow_terrain`。
- Build05 总时长 30.069 s（≤ 30.5）。加速 2.26 m/s²，减速 2.06 m/s²（≤ 2.7）。转向 6.95 °/s（≤ 20）。半径 46.6 m。
- 弦长 52 m。巡航约 4.52 m/s，不是设计稿里的 3.6 m/s。3.6 m/s 盖不住 52 m，又要守住 30.5 s，所以按 2 s 加速、9 s 巡航、2.2 s 减速反解速度。上岸点改到草地局部 z=17，岸上步行 5.96 m。
- 逻辑桥只有 1 cm，用来满足 `bridgeEnd > bridgeStart`，不生成彩虹条。

座位：`sit_hold` 之后把人挂到凳子上。30 s 移动 50 m 的偏差约 0（≤ 1 cm）。没有走每帧 `cancelAndReset`。

## 包体

`build-wechat-guarded.sh wechat`，HEAD `2b7c09ef`，Creator 退出码 36。

- wechat-release：19,417,147 B
- 相对 r4 19,335,755 B：+81,392 B
- 上限 24,641,536 B

分包字节：

| 分包 | 字节 |
| --- | --- |
| 主包（不含 subpackages） | 1,871,008 |
| audio_bgm_island | 418,907 |
| board_art | 2,131,356 |
| internal | 297,535 |
| main | 1,318,367 |
| region_island | 2,998,394 |
| region_lakeside | 541,965 |
| region_meadow | 2,934,449 |
| region_skycity | 3,326,944 |
| resources | 446,303 |
| shared_effects | 563,694 |
| static_seat_preview | 2,556,372 |
| transport_sail | 11,853 |

同一脚本的 web-test：20,205,180 B。更早一次 guard 的 web-test（meta 提交 `d1228cd6`）是 20,205,062 B。

## DC、帧率、棋盘首帧

QA 静帧 `?sailshot=1`（无微信环境，正式版会忽略）：

- DC 13（≤ 53）。几何帧测试里转场 DC 为 12。
- 390×844 探测到的 fps 为 60。
- 草地薄片搭建 `boardMs` 为 0–0.1 ms（≤ 16.7 ms）。这是 QA 静帧里草地平面的耗时，不是正式棋盘 UI 的首帧 GPU 时间。正式落地仍复用现有 meadow board end。

## 截图

PNG，`sips -Z 900`，都小于 400 KB。目录 `docs/r5/sail/shots/`，并复制到任务包 `shots/`。

- `S-b-390x844.png` 上船，橙帆在海上
- `S-d-390x844.png` 远航，前方是绿色草地带
- `S-e-390x844.png` 河口，帆在水岸交界
- `S-g-390x844.png` 上岸，帆落在绿地上
- `S-d-night-390x844.png` 夜间远航
- `worst-frame-2000-S-d-768x1024.png` 最差帧所在的 S-d（t=19.4 s 在这一拍里；静帧取的是 S-d 中点 t=16.3 s）
- 另有 S-d 的 414×896、360×780、375×667、390×520、320×568

入口是启动时的 `?sailshot=1&beat=S-b|S-d|S-e|S-g&night=1`，只在没有 `wx` 或开发版/体验版时生效。画面上没有测试横幅。人是座位上的小代理网格：这个入口在 `FlowReferenceStandin` 创建之前返回，所以静帧里没有正式骨骼角色。

## 未完成与风险

- 本机没有 Blender，也没有解码后的房间 / 天空之城 GLB，§8.1 的旧转场审计没有在本地重跑。任务包里的 `audit-day.txt` / `audit-night.txt` 仍是 04→05 = 34.2 m / 28.5 s、08→09 = 44.3 m / 36.9 s。
- 巡航速度高于设计稿的 3.6 m/s，原因见上。门限（时长、加速度、转向）没有放宽。
- 截图是 QA 静帧，不是从 mainline-04 棋盘走完的实机过程。公开的 `__worldIntegration` 没有现成的 04→05 入口。
- mainline-04 时把草地预热成 inactive 节点。6 s 超时会把下一次海岛→草地退回 `bridge`。没有改 `isInTransit`。
- 磁盘清理后约 6.4 GB 可用（`/dev/disk3s5` 228 Gi，97%）。构建没有降到 4 GB 以下。
- 没有 push。
