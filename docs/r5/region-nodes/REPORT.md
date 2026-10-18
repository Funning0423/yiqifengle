# 区域关卡节点 REPORT

分支 `gbt/r5-region-level-nodes`。没有 push。

## 提交

| 说明 | commit SHA | tree SHA |
| --- | --- | --- |
| 节点数据、走路、探索纯函数、接线、测试 | `6f47e4748e2dc79bf045659683fe6f8f1f194de7` | `a4b071e285ad5324049addede996df5417302893` |
| 本报告和截图 | `09a6176858402658eb90231195a74b87bc37d033` | `36eae1f71a4efe12193e646f48af24c8c10d38d9` |

基线是 `f569ff0d9eeb9f6ab26bdc56276fa234e60c5ac4`。

## 测试

命令：`QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript npx -y node@22 tools/journey-integration/run-suite.cjs`，Node 20 同样。

| 运行时 | passed/total | 非 PASS |
| --- | --- | --- |
| Node 22.22 | 103/104 | `navigation-guard: BLOCKED_BROWSER`（允许） |
| Node 20.20.2 | 101/104 | 上面那项，加上 `legacy-board-ui-pure`、`reward-background-return` 的 `BLOCKED_NODE`（允许） |

新增项全部 PASS：`region-nodes-data`、`region-nodes-progress`、`region-nodes-walk`、`explore-camera`、`explore-input`、`node-board-pose`、`frame-background`、`transport-flag`、`transit-background-resume`。

`transportFor` 对 island-meadow、meadow-skycity、island-lakeside 都返回 `bridge`。`RegionJourneyAdapter.ts` 与 f569ff0 逐字节相同。`CharacterMotion.ts`、`anim_meta.json`、`WorldIntegrationBoot.ts` 的 FlowReferenceStandin 段没有改。

## 包体

build-guard `both`，HEAD `6f47e474`，Creator 退出码 36（原有的 Firstslice 预制体缺失警告；冒烟两次之后 `git status` 为空）。

wechat-release **19,413,434 B**。上限 24,641,536 B 满足。相对 r4 19,335,755 B 多 **77,679 B（0.074 MiB）**，超过本任务写的 0.05 MiB。主包里新增脚本模块合计 30,385 B；其余差额没有在同一台机器上重编 r4 对照，所以没有拆开。

分包字节：

| 分包 | 字节 |
| --- | --- |
| 根（不含分包） | 1,870,865 |
| audio_bgm_island | 418,907 |
| board_art | 2,131,356 |
| internal | 297,535 |
| main | 1,326,650 |
| region_island | 2,998,394 |
| region_lakeside | 541,965 |
| region_meadow | 2,934,449 |
| region_skycity | 3,326,944 |
| resources | 446,303 |
| shared_effects | 563,694 |
| static_seat_preview | 2,556,372 |

web-test 20,201,068 B。冒烟产物已删。

## 画面和性能（web-test，headless Chromium，390×844，hasTouch）

- 棋盘打开时 DC 45，低于 53。海岛世界 DC 83–89，家里 85。路线脚印的 +1 DC 没有挂进场景，所以没有单独量到。
- headless 采样 40 帧，间隔中位数 99.8 ms，大约 10 FPS。这不是真机，不能当成 60 FPS。
- `enterMainlineStage('mainline-01')` 到棋盘诊断出现是 912 ms。这是加载时间，不是单帧 16.7 ms。单帧预算没有在真机上量。

## 截图

都在 `docs/r5/region-nodes/shots/`，`sips -Z 900` 之后每张小于 400 KB。

- `island-world-390x844.png`：海岛夜景世界（跟着人的路线镜头没有接到场景上，这是现在的海岛镜头）
- `island-day-390x844.png`、`island-night-390x844.png`：同一海岛，`__worldDayNight.set('day'|'night')`
- `island-board-390x844.png`：主线 01 棋盘（教程层还在）
- `island-world-414x896.png`、`360x780`、`375x667`、`390x520`、`320x568`、`768x1024`
- `home-390x844.png`：家里

没有拍到的：三个区域各自的 FollowWalk、缩到最小的 MapExplore、节点标记三种状态、草地 M2 棋盘、天空之城 S4 抬头。原因写在未完成事项里。

## 门限和口径

- 可走栅格以 `maps/topmap.cjs` 为准：法线 `|ny|/len > 0.72`，高差 `0.36 * hypot * (cell/0.4)`。设计文里的 0.8 / 0.35 m 没有用。
- 没有 Blender。Draco 用工具链里的 draco3d 1.5.7 解码，不进玩家包。可走格写在 `tools/region-nodes/fixtures/*.json.gz`。
- 不剪辑的走路可以到 8.0 s（M0→M1 约 7.8 s，9.6 m / 1.2 m/s）。剪辑段每段 3.5 s，可见时间合计 ≤ 7.6 s。F3 正文写的“每段 ≤ 7.6 s”和 §3.2 的表不一致，实现跟表。
- 地图 52° 时身体投影会矮于 0.12 屏高，`zoomForBody` 把请求的 1.6 / 1.8 收到大约 1.34 倍。
- 20 个节点的棋盘位姿都是 `default`。草地 `setAnchor` 已加上，默认不调用。天空之城棋盘文件被 `journey-occlusion` 的 Build05 SHA 钉住，没有加 `setAnchor`。
- 领奖后的走路只在 `attachCalibratedCharacter` 之后发生。现有旅程测试不绑角色，顺序仍是 prepare → exit → travel → enter。

## §8.1 A1–A6

用任务包里的 `audit-day.txt` / `audit-night.txt` 记进 `tools/transitions/baseline-current.json`，`recordOnly`，不判失败。本分支旧路线仍是彩虹桥，没有重跑全几何光线。

- A1：08→09 天空岩石仍在草地底下，大约 7–11% 的天空命中。还在。
- A2：08→09 末段底面大约 10–14%。还在。
- A3：08→09 夜间两个天空穹顶。还在。
- A4：08→09 结束时净空 1.9 m（树叶卡片）。记录。
- A5：04→05 净空 1.38 m（棕榈）。记录。
- A6：两段都没有近裁剪面命中、背面或空洞。记录。

A1–A3 要等后面的 sail / balloon 才会从路线上拿掉。这次没有改那两条桥。

## 资产

玩家包没有新的贴图、模型或音频。标记颜色是代码里的原色。draco3d 1.5.7（Apache-2.0）只在烘焙工具里用。

## 未完成和风险

- FollowWalk / MapExplore 的镜头曲线在 `ExploreCameraCore` 里测过，没有接到场景摄像机上。`NodeMarkers` 也没有挂到场景，所以 +1 DC 和三种标记状态没有出现在画面里。
- 公开的 `__worldIntegration` 没有 `startRegionFlowTest`。主线 06 在没通关时进不去，所以没有草地 M2 和天空之城 S4 的实机画面。
- 包体比 r4 多 0.074 MiB，超过 0.05 MiB。绝对上限仍满足。
- headless 没有 60 FPS。棋盘首帧 16.7 ms 没有按单帧预算量到。
- 角色已绑定且 `perform` 不返回时，`advanceMainline` 会停在走路。测试路径不绑角色。
- 清理后剩余空间约 7.0 GiB（`/dev/disk3s5`）。library、temp、build 已删。
