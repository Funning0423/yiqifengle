# 湖畔：天空之城之后

产品选定方案 B。风铃湖畔是天空之城的下一站，热气球降落到湖南岸步行终点（湖边）。实现 `9dc5b74`。基线 `gbt/r5-integrated`。时间为美国东部时间（EDT）。

## 改了什么

- 合法路线：海岛→草原、草原→天空之城、天空之城→湖畔。`travelRegion` 原点包含天空之城。
- 地区节点在烘焙图旁加了 L0（到达）和 L1（湖边）。主线 12（S4）通过后 L0 为已通过，L1 可走，与 `LAKE_GATE_RECORD=11`（界面里程碑 12）同一时刻。`exploreHintSeen` 仍是 3 项；旧存档缺 `lastNode.lakeside` 时按当前进度补上。
- `skycity-lakeside` 为 balloon。表内 `island-lakeside: bridge` 已删。湖畔准备不再调用 `rainbowBridge`。热气球预制体走 `awaitVehicle`（`TransportWait.ts`，接口同 `cloud/r5-no-bridge-fallback` 的 `63f3963`）。帆船和草原→天空之城超时也不再改走桥。
- `?lakeside=1`、`LakesideReach.ts` 和草原支线预览已删除，生产路径进不到该开关。
- 场景仍由 `lakesideJourney(start)` 摆放。飞行镜头默认值在 `LakesideBalloon.ts` 的 `LAKESIDE_BALLOON_LANDING`：`climbM` 14、`descentM` 12、`durationS` 22（路径更长时加长，巡航不超过 4.2 m/s）、`easeInS`/`easeOutS` 4、`camBackM` 8.5、`camUpM` 3.2、`camSideM` 1.4、`lookUpM` 1.1、`fovDeg` 48、`yawDeg` 180。落地后控制器改写为 `LAKESIDE_CAMERA_LAYOUT.landing`（`arrivalBackM` 6.8、`arrivalSideM` 1.1、`arrivalUpM` 3.0、`arrivalFovDeg` 约 57.4）。这两处留给运镜 bot。

## 测试

2026-10-18 15:33–15:38 EDT，Node v22.23.3，`run-suite.cjs` 在 `9dc5b74`：123 项里 122 PASS，状态 BLOCKED，退出码 1。唯一非 PASS 是 `navigation-guard: BLOCKED_BROWSER`。`lakeside-reach` PASS：天空之城→湖畔、回访不再二次起飞、后台 hide/show/resume 与进出关卡后仍停在湖畔同一落点。`no-bridge-fallback` PASS。跑完已丢掉 reports 与 output。没有截图或视频。

## 包体

没有新美术，未重打 wechat 包。相对 build06 的已构建包差值 0。`region_lakeside` 仍是 541,965 B。脚本要等下次构建才进包。未新测 DC；这条腿不再生成 7 条彩虹桥面，湖畔仍用原有实例化与静态合并。

## 还没做

- 降落镜头是默认值，没有实机画面。
- 没有湖畔走回天空之城的路线。
- 未知路线（含海岛→湖畔）的 `transportFor` 仍回报 bridge，但准备阶段在非天空之城出发时直接拒绝，不会铺桥。
