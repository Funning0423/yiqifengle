# 热气球转场 STATUS

- 2026-10-18 02:00 开始。分支 `gbt/r5-balloon-meadow-sky`，基线 `f569ff0d`。帆船分支没有超出基线的提交，共享文件在本分支自写。没有 cherry-pick。
- 2026-10-18 02:10 审计：任务包 `audit/audit-day.txt` 已记录 08→09 桥接 A1–A4。桥接路线 SHA256 `3bf86ab6face9d7e3bcdb91f0d1f77372c0eb35b55496a687a7d6872a482d58e`。
- 2026-10-18 02:20 摆放：`balloonSkyOffset.liftM=40`（上限）。岩层 ymin 约 16.96 > 地形 7.46+8。航迹离城 9.6 m，不从城底穿过。岩层在 B-h 之前按节点名隐藏。
- 2026-10-18 02:40 骑乘：idle 无 job 时不写 `setWorldPosition`，人挂在 `basket_floor`。`setWind` 未改。
- 2026-10-18 03:05 Node 22：98/99，唯一非 PASS 是 `navigation-guard: BLOCKED_BROWSER`。Node 20：96/99，另有两项 `BLOCKED_NODE`。`frame-background` 3206 帧全部合格，`build05S=38.35`。
- 2026-10-18 03:10 提交 `e45a64e48f`。
- 2026-10-18 03:13 冒烟导入写出 9 个新 meta，提交 `b7f608e9bb`。再冒烟后 git status 为空。
- 2026-10-18 03:18 第一次 build-guard：wechat-release 19,419,450。`transport_balloon` 578,575，因为优先级 8 抢走了 standard effect，web-test 报 “Please load bundle transport_balloon first”。
- 2026-10-18 03:21 优先级改为 1，提交 `1c0c9c2630`。重建：wechat-release 19,419,459，`transport_balloon` 16,189。web-test 能进转场。
- 2026-10-18 03:50 截图完成。世界默认夜间；`night=1` 拨到白天。B-e 抽卡 26，frameRate 60，总时长 38.37 s。
- 2026-10-18 04:05 截图与报告提交 `4a740ea75d`（tree `6a5720404c`）。tree 补记 `809b382f4d`。不 push。磁盘约 4.4 GB。
