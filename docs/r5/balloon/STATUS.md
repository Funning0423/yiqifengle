# 热气球转场 STATUS

- 2026-10-18 02:00 开始。分支 `gbt/r5-balloon-meadow-sky`，基线 `f569ff0d`。帆船分支没有超出基线的提交，`TransitBackdrop` / `TransportLeg` / `TransportVehicle` / `test_frame_background.cjs` 在本分支自写。没有 cherry-pick。
- 2026-10-18 02:10 审计：任务包 `audit/audit-day.txt` 已记录 08→09 桥接 A1–A4（44.3 m / 36.9 s，岩层下沉、城底最高约 14%）。未重跑重型审计。桥接路线 SHA256 `3bf86ab6face9d7e3bcdb91f0d1f77372c0eb35b55496a687a7d6872a482d58e` 由 `transport-flag` 钉住。
- 2026-10-18 02:20 摆放：`balloonSkyOffset.liftM=40`（§10 上限）。+30 m 时岩层 ymin 低于草地地形最高点 +8 m。+40 m 时 ymin 约 16.96 > 地形 7.46+8。风车叶片更高，超过上限，门限按地形而不是叶尖。航迹从东侧斜升再从南侧接近，离城 ≥4 m，不从城底穿过。岩层在落到草坪（B-h）之前按节点名隐藏。
- 2026-10-18 02:40 骑乘：`FlowReferenceStandin.advanceStep` 只在有 job 时写 `setWorldPosition`。idle 无 job，可以挂到篮子。退路（每帧 cancelAndReset）未启用。`setWind` 是私有的，转场里不改风强，只发 cue。
- 2026-10-18 03:05 Node 22：98/99，唯一非 PASS 是 `navigation-guard: BLOCKED_BROWSER`。Node 20：96/99，另外 `legacy-board-ui-pure`、`reward-background-return` 为 `BLOCKED_NODE`。`frame-background`：3206 帧，`minClear=9.6 m`，`build05S=38.35`，`accel=2.02`，`climb=25`，`sunkBalloon=0`，桥接岩层 ymin `-9.63`（A1 基线仍在）。
- 下一步：持构建锁做冒烟和 build-guard，截 390×844 热气球画面，写 REPORT，清理。
