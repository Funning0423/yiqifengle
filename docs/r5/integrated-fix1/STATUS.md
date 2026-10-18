| 2026-10-18 17:15 | launch: branch gbt/r5-integrated-fix1 from a83e1c2b; Avail 7.0Gi | — | — | a83e1c2b |
| 2026-10-18 17:18 | relaunch: first agent (16891) aborted "socket hang up"; relaunched by GBT | — | — | a83e1c2b |
| 2026-10-18 17:38 | 根因已修并提交 cbecdf2a。天空之城地面在热气球 `paint(plan.total)` 里被关掉，转场云海/海面盘留着。suite 121/122 PASS，仅 navigation-guard BLOCKED_BROWSER；frame-background PASS，clearM 2.441，seamLeak=0。Avail 5.6Gi。构建锁被已退出的 r5-balloon-v25fix（pid 11551，17:02）占着，未满 120 分钟，不删，每 60s 重试 | 等锁后构建 | suite 121/122 | cbecdf2a |
| 2026-10-18 20:28 | 最终构建 edfcb02c。wechat-release 20,267,421 B（相对 build06 +886），web-test 21,066,167 B。关卡棋盘黑屏是 handoffFade(36) 仍为 1，到达后补 fadeCover(0,0)。截图已拍，洋红 0。Avail 3.9Gi | 写报告并提交 | suite 121/122 | edfcb02c |
