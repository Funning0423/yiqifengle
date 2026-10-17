# r5 区域关卡节点 r2 STATUS

- 2026-10-18 02:20 接线现状：r1 的镜头和标记没有接到世界摄像机。包体 r1 为 19,413,434 B，相对 r4 多 77,679 B。
- 2026-10-18 02:40 接线提交 `c9ed530c20`，tree `4aa46a490d`。Node 22 107/108，仅 `navigation-guard: BLOCKED_BROWSER`。Node 20 105/108，另两项 `BLOCKED_NODE`。
- 2026-10-18 02:45 冒烟配置通过。build-guard：wechat-release 19,434,855 B，随后 QA 修复提交 `5dc9c9c4` 再编为 19,435,130 B（相对 r4 +99,375 B）。web-test 20,224,922 B。
- 2026-10-18 03:07 终幕对准星环、物件镜头对准物件，提交 `8b3bd4c0`。Node 22 仍是 107/108，Node 20 仍是 105/108。
- 2026-10-18 03:30 截图来自 `5dc9c9c4` 的 web-test（390×844，hasTouch，`?qa=1`）。r5-balloon 占着构建锁，owner pid 已退出但 balloon agent 还在，锁不满 120 分钟，没有抢锁，所以 `8b3bd4c0` 没有再编。
- 2026-10-18 03:40 报告提交 `4e936b67cd`，tree `77e0b071a8`。截图在 `docs/r5/region-nodes-r2/shots/`。没有 push。
