# 帆船转场 fix STATUS

- 2026-10-18 03:28 CST · 开工 · 分支 `gbt/r5-sail-island-meadow-fix`，基线 `ca5a363e6f9e`。验收缺陷：静帧在 `FlowReferenceStandin` 之前返回，只有橙色梯形。
- 2026-10-18 03:28 CST · 船体 · `boatPartMeshes` 拆成浅色船体、深色龙骨、桅杆和朝向跟随镜头的橙帆。GLB 重新生成。frame-background 4214 帧 PASS，最差仍是第 2000 帧 `meadow_terrain` clearM 2.956。船 72 三角面，源文件合计 13,264 B。
- 2026-10-18 03:40 CST · 测试 · Node 22：100/101，唯一非 PASS 是 `navigation-guard: BLOCKED_BROWSER`。Node 20：98/101，另有 `legacy-board-ui-pure`、`reward-background-return` 为 `BLOCKED_NODE`。
- 2026-10-18 03:52 CST · 构建锁 · r5-balloon 的 owner pid 已退出但 agent 还在，锁不满 120 分钟，没有抢。03:52 锁释放后取得。
- 2026-10-18 03:56 CST · 构建 · `d76fbc5278` wechat-release 19,430,814 B，web-test 20,219,097 B。`transport_sail` 21,542 B。
- 2026-10-18 04:08 CST · 配色 · 静帧曾把海、天、船体涂成同一种米色。`49b133e9d0` 分开上色后再编：wechat-release 19,430,968 B（相对 r4 +95,213 B），web-test 20,219,251 B。
- 2026-10-18 04:10 CST · 截图 · `?sailshot=1` 在 `sit_hold` 绑定之后构图。S-b / S-d / S-e / S-g / 夜间 S-d，390×844。`__sailShot.character=true`，clip `sit_hold`，DC 15，fps 60，boardMs 0。没有从 mainline-04 实机播到中段：这个入口在棋盘就绪前返回，公开的 `__worldIntegration` 没有 04→05 中段拖动。
- 2026-10-18 04:12 CST · 报告 · `c25fdcab245d`，tree `92a43f41df`。清理构建缓存并释放锁。不 push。
