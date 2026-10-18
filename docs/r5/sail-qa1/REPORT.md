# 帆船转场质检（岛 → 草原）r5-sail-qa1

时间：2026-10-18，北京时间。基线 `d98ad470`（桌面包 build05）。修复头见文末。证据来自真实旅程 `?sailqa=1`（`RegionJourneyController` + 场景根上的 `FlowReferenceStandin`），不是 `?sailshot` 摆拍。视口 390×844、DPR 2，时钟锁 30 fps。修前 1078 帧 CSV：`metrics_before.csv`。修后白天/夜间各 1303 帧、672 张截图（每 2 帧一张）：`metrics_after.csv`、`metrics_after-night.csv`。原始帧已删。

## 缺陷

### D2 / D3 人没上船，航行中看不见

**根因（证实 GBT_AUDIT）。** `RegionJourneyAdapter` 原来在 `options.parent`（`WorldFlowOwner`）里 `find('FLOW_REFERENCE_PLACEHOLDER_NOT_B')`。女孩控制根是 `scene.addChild` 的兄弟节点（`WorldIntegrationBoot.ts` 的 `mountWorld`），所以 rider 恒为 null，`attachRider` 从未执行。她停在码头的世界坐标上，船自己开走；靠岸的 stand 再把她瞬移到船位。

**修法。** 从 `options.parent.scene || director.getScene()` 查找；找不到就 `console.error` 并在 `depart()` 抛 `sail-rider-missing`。`playSailBeats` 再用 `(actor as any).node` 绑定同一次查找。坐下结束后才 `attachRider` 到 `seated_root_anchor`，局部坐标 `(0,0,0)`。`sailPresentationT` 在 `departAt == null` 时把船体时间卡在 S-c 之前。

**修前。** 全部节拍的父节点都是 `WorldR5Integration/FLOW_REFERENCE_PLACEHOLDER_NOT_B`。S-a 到 S-d 船从 `(-0.1, 12.1)` 走到约 `(-4.4, 45.0)`，位移 33 m，人留在码头。条带 `strips/before_d1_d3.png`。

**修后。** 船在 `departed=0` 的 302 帧内位移 0。第一帧开走是 frame 302、`real=10.1`、节拍 S-c、clip 采样为 `sit_hold`、4 个可见 renderer，父节点为 `.../sailboat/transport_sailboat/seated_root_anchor/FLOW_REFERENCE_PLACEHOLDER_NOT_B`。S-c / S-d / S-e / S-f 全程挂在这个座位下。条带 `strips/after_day.png`（踏上船沿、坐定后开航、巡航可见、船停靠岸、走上草原）。

### D1 走路忽快忽慢

**根因（证实）。** 码头被拆成 7.6 s 和 1 s 两段 walk，各自起停；第二段约 2.2–2.4 m/s。到岸镜头用 `Date.now()`，人物用帧时钟。`sailArrivalWalkM()` 只量到栈桥，真正又走了 M0、M1。

**修法。** 上船是一条路径、一次 `walk`，`duration = 路径长 / 1.2`，`stopAtEnd`。坐完才 `depart`。下船和到岸同样按路径长 / 1.2。到岸镜头用 `arrivalElapsed`（帧 `dt`）。不改 `FlowReferenceStandin`。

**修前。** S-a 水平速度均值约 0.64 m/s（最低接近 0），S-b 冲到 2.45 m/s。

**修后。** 上船步行中段（相邻速度都 > 1 m/s）三维速度均值 1.24 m/s，范围 1.03–1.26。码头一个拐角单帧相对变化约 17%，测试放宽到 20%（旧的 0.66→2.4 远在这之外）。到岸步行中段均值 1.22 m/s。站起那一帧（frame 766）位移 0.40 m，是坐姿切到站姿，随后下船稳定在约 1.43 m/s。没有“停下再冲”。

**到岸时长。** 实测到岸 `t` 从 0.03 到 16.53，共 16.5 s，位移约 18.9 m。栈桥到已发布的 M1 直线就接近 19 m，1.2 m/s 最少约 16 s。12 s 到不了 M1，除非加快走路（验收禁止）或改掉 M1。帆船段（离站到踏上栈桥）`real` 0.03→26.90，共 26.87 s，低于 30.5 s。巡航被压进 `motionBudget`，没有加快步速。

### D4 航行闪烁

**根因（证实共面与岛特效仍在跑）。** `sea_plane` 每帧跟着相机、与 `landing_sea_tile`、河口同在 y=−0.91。`ShoreBreak`、`IslandAtmosphereFx`（灯塔光束、海面反光、夜间月光带）航行中继续按 alpha 开关。世界相机 near/far 停留在 0.05/1000。

**修法。** 海面只放在航线中点一次，UV 只随时间滚动。`landing_sea_tile` 降到 y=−0.99 并关掉；河口 y=−0.97 且 renderer 关闭；岛上 `env_sea_*` 每帧关掉 renderer。`__QF_SAIL_HOLD_ISLAND_FX` 让岸浪和岛气氛在航行中隐藏，结束后恢复。`WorldCamera` 航行期间 near 0.3、far 1400，`dispose` 时还原。海面 roughness 设为 1。

**修后。** 白天 `pixels_after.json`：`flicker=0`，`clearMax=0.0001`。夜间 `flicker=0`，`clearMax=0.0034`。S-d 采样：`sea_plane` y=−0.91 可见；`landing_sea_tile` y=−0.99 未激活；河口 renderer 关闭；岛上海面 renderer 关闭；near/far = 0.3/1400。

### D5 船舱里有海水，以及右侧白泛光

**根因（证实几何，并补了一条实现原因）。** 原底板只在 y=+0.06、与内舷有缝、船头船尾没有板。运行时补的舱底板第一次没开 `calculateBounds`，被视锥裁掉，等于没画。海面是双面大片，侧视能从缝里看到。白泛光对应岛上光束/高光仍在跑，以及海面高光；修后白天巡航条带右侧没有那片白斑。

**修法。** `SailArt.mountCockpitSole`：不透明舱底 y=0.12（x ±0.72，z −1.96..1.85），加两侧和船尾矮墙（y 0.02..0.34），`calculateBounds: true`，无光照双面、写深度。船体仍坐在水线 y=−0.91，浮动 bob 固定为 0，避免上船时船自己挪开。

**修后。** 白天舱内海水占比最大为 0（阈值 0.5%）。夜间有两帧掩膜超阈值：frame 191（S-a，0.54%）和 frame 385（S-d，4.03%）。frame 385 裁切的平均色是灰 (89,87,84)，蓝像素贴在棕色舱壁外侧，是侧视时投影四边形扫到舷外海面/蓝漆，不是底板下的穿水。分析器现在会丢掉任一顶点距画面边缘 < 16 px 的四边形，再向重心内缩 0.72，避免把船外海水算进舱里。白天同一套掩膜为 0。

### 夜间到岸分级

`SailArt.dispose` 按当前 `__worldDayNight` 调 `grade(stillNight)`，夜间不再被刷回白天。夜间采集 `clearMax` 0.34%，没有整帧亮度尖峰（`flicker=0`）。短片 `sail_after_night.mp4`。

## 音频

白天与夜间各发一次，顺序相同：

`node-walk-start@0` → `sail-board@6.967` → `sail-unfurl@9.600` → `sail-cruise-loop-start@11.600` → `sail-dock@20.600` 与 `sail-cruise-loop-stop@20.600` → `node-arrive@23.800`。

`node-walk-start` 必须在 `arm()` 里补发，因为时间从 0 开始，跨拍检测跨不过 t0=0。`sail-board` 在走到船边、开始坐的 `markBoard()` 发出，时间线里跳过，避免发两次。

## 自查里另外修的

- 采集若跟着 Mac 晚上的时钟跑，会把“白天修复”拍成夜景。`previewSailJourney` 默认 `__worldDayNight.set('day')`，只有 URL 带 `night=1` 才是夜航。
- 海面跟着相机缩放 3.2 再加 far=280/450，会把海面切出一条空边。改为放一次、far 1400。
- 座位世界坐标按 t=0 的船首向从 `seated_root_anchor (0, 0.06, −0.55)` 算，不再用世界轴硬偏。
- 彩虹桥仍只在 bridge 模式出现；本段不改天空之城地面、天空之城镜头、热气球。

## GBT_AUDIT 对照

| 假设 | 结论 |
|---|---|
| rider 在 `WorldFlowOwner` 下找不到，`attachRider` 没跑 | 证实。修前父节点始终是场景根下的占位节点 |
| walk 7.6+1 s 加上转身和坐下，长于船在 9.6 s 起步 | 证实。现由坐下结束的 `depart()` 开门，修前船在人还在码头时已移动 33 m |
| 码头两段 walk、下船过快、到岸漏算 M0/M1、镜头用 `Date.now()` | 证实。步速已回到约 1.2 m/s；到岸 16.5 s 是 19 m 路径的几何结果 |
| 共面海面、岛 FX 逐帧开关、near/far 未设 | 证实。修后平稳段闪烁格为 0 |
| 底板高出水面只有 6 cm、有缝、摇晃后低于水线 | 证实。另发现无 bounds 的补板被裁掉。白天舱内海水占比 0 |

## 测试与包体

- `tools/transitions/test_sail_continuity.cjs`：结构上要求场景根查找（`WorldFlowOwner` 的兄弟，不是它的后代），并断言修后白天 CSV。已注册进 `run-suite.cjs`，结果 PASS。
- `QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript npx -y node@22 tools/journey-integration/run-suite.cjs`：121 项 PASS，`navigation-guard: BLOCKED_BROWSER`（套件因此整体退出码 1，`renderedAcceptance: BLOCKED_NOT_RUN`）。`frame-background`、`sail-art`、`sail-k2k7`、`asset-budget` 均 PASS。`asset-budget` 断言新增三角面 ≤ 45000。
- 冻结：`FlowReferenceStandin` 花括号切片与 `d98ad470` 逐字节相同；`frozen-production-inputs.json` 与 `git diff --name-only d98ad470` 交集为空。`?sailqa=1` 加在 `WorldIntegrationBoot` 的查询分支（约第 541 行），不在 `FlowReferenceStandin` 类体内。
- 本机构建锁在写报告时由 `r5-balloon-v25fix` 持有。微信包字节、`transport_sail` 分包、GUARD HEAD 在锁释放后的 `build-wechat-guarded.sh` 里补记。web-test（`73003ff0` 舱壁那次）21074010 字节。白天片 `sail_after.mp4` 1.4 MB，夜间 `sail_after_night.mp4` 1.0 MB，合计低于 30 MB。

## 预览

- 白天：`docs/r5/sail-qa1/sail_after.mp4`，条带 `strips/after_day.png`
- 夜间：`docs/r5/sail-qa1/sail_after_night.mp4`，条带 `strips/after_night.png`
- 修前：`strips/before_d1_d3.png`
