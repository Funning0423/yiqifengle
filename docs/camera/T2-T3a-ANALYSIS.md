# T2 出门运镜 / T3a 回屋镜头：分析与修改方案（运镜bot，2026-10-11）

基线：near `41fabe7`（分支 `work/运镜bot` 已重置到 near）。本次只交分析，不改工程文件。回退：删除 `docs/camera/`。
证据：`evidence-mac/evidence/near/native/08-outbound-motion.mp4`（28.0s）、`11-return-motion.mp4`（32.1s），三处副本 SHA 一致（40dfce45…、9bbbad30…）。
抽帧：`T2-out-22.3-23.2s.png`（10fps）、`T3a-return-10-14s.png`（2fps）。

## T2：22.8s 灯光/几何/按钮跳变

现象（抽帧）：22.3–22.8s 岛屋是暖色室内光照、灯塔呈石色；22.9s 一帧内变成冷色室外光、灯塔变白、阴影变化，同时底部三个按钮和"继续"条整体出现。

根因（代码）：
1. `WorldFlowCore.leaveHome()` 出门全程 `setLayers(BOTH)`，`interior=true`，于是 `RoomLightingRig.setView` 一直处于室内模式：太阳被挪到窗口位置 `(.8,6.6,-7)`、开 ShadowMap/SOFT_2X、改 ambient skyIllum 和天地色。
2. `toIsland` 走完后 `restore()` → `setLayers(ISLAND)`，`interior` 由 true→false，`setView` 走 `restoreSun(false)`，一帧内把太阳位置、照度、阴影和环境光全部恢复成室外值；同时室内 renderer 被禁用（几何跳变）。
3. 同一帧 `change('island')`，`WorldIntegrationBoot` 立刻 `placeNavigationControl` 显示岛上按钮，没有入场过渡（按钮"跳"出来）。
4. 相机本身没问题：`cameraToIsland` 最后一键就是 `cameraIsland`，`restore()` 的 `setCamera` 不产生位移。

修改方案：
- A. 提前切层：相机穿过门洞后（`cameraToIsland` progress≈0.4，相机已在 `[-.3,1.55,1.05]` 屋外）就把 `interior` 关掉，而不是等到落地。室内几何此时已在画面外/被墙挡住，关掉不可见。
- B. 光照插值：给 `RoomLightingRig` 加 `setInteriorWeight(w∈[0,1])`，在 toIsland 的 0.25–0.7 段把太阳位置/朝向、illuminance、ambient skyIllum/天地色从室内值插值到室外值（smoothstep），阴影参数在 w 跨过 0.5 时于相机远离、阴影面积小的时刻切换。到落地时 w=0，`restore()` 的 `setView` 变成无变化调用。不用闪屏或淡入淡出遮挡。
- C. 按钮：落地后按钮做 0.25s 位移+缩放入场（从底部 24px 上滑、0.92→1），不改透明度遮挡场景；按钮材质在出门全程保持同一套，避免切 state 时重建。
- D. 运镜节奏：toIsland 中段 `[-6.3,6.3,3]` 这一键相机抬升过陡，改成 ease-in-out 时间重映射，最后 15% 减速落到 `cameraIsland`，保证速度在终点连续为 0。

验证：Mac 上命令行构建后录 08 同角度；逐帧检查 22–24s 无单帧亮度/色相阶跃（相邻帧平均亮度差 < 2%）、无 renderer 突现；`__worldDayNight.roomLighting()` 读回落地前后参数一致。

## T3a：回屋 11s HUD 横穿帽檐、13s 帽顶顶屏

现象（抽帧）：10–11.5s 状态条"正在进屋…/正在关门…"（屏幕顶部 `height/2-130`）正好横压在草帽帽檐上；12.5–13.5s "正在走向椅子…"阶段，相机贴近角色，帽顶贴到/超出屏幕上沿。

根因：
1. `cameraCrossIn` 的跟随键 `follow(inCrossing,…,[-.4,1.45,-1.2],72)` / `[-.65,1.5,-1.45],70`：注视点只取 `p[1]+.86`（腰部），相机离人约 1.2–1.5m、FOV 70–72，角色 1.725m（含帽）在竖屏上占满高度，头部落在 HUD 状态条所在的顶部带。
2. 关门阶段相机停在 `cameraInside`，没有为 HUD 留安全区。
3. `toSeat` 用 `[cameraInside, cameraHome]` 两点线性混合，人走近镜头、相机还没拉开，头顶出画。
4. 现有 `frameCheck` 只检查岛上落点，室内回屋路径没有构图约束，也没把 HUD 算进去。

修改方案：
- A. 定义竖屏构图安全区：顶部 HUD 状态条下沿以下再留 4% 屏高作为帽顶上限；帽顶（root+1.7253m）投影必须低于它，脚底不低于 `minY`。
- B. 回屋跟随键：注视点抬到 `p[1]+1.05`，相机后退 0.25–0.35m，FOV 收到 64–66，使全身在安全区内；路径键位保留，只改 position/target/fov。
- C. `toSeat` 增加一个中间键（progress≈0.4），先拉开再转向 `cameraHome`，避免人走近时相机还在门口。
- D. 加一个 CPU 构图测试：沿 `toThreshold/inCrossing/toSeat` 每 1/60s 采样相机与角色 root，投影帽顶/脚底/左右包围盒，断言全程在安全区内，并输出最小余量。HUD 尺寸从 `WorldIntegrationBoot.resize` 的实际布局读。
- E. 可选：过渡期状态条下移到底部，顶部完全让给角色（需 Funning 拍板，不改的话按 B–D 已足够）。

验证：CPU 构图测试全程通过；Mac 录 11 同角度，10–14s 帽顶与 HUD 不相交、不出画。

## 已测 / 失败 / 未测
- 已测：两段证据视频 SHA、时长、抽帧；near 分支相关代码阅读（FirstsliceRoutes、WorldFlowCore、WorldFlowComponent、RoomLightingRig、WorldIntegrationBoot）。
- 失败：无（未改代码）。
- 未测：任何修复的构建与真机效果；HUD 实际像素尺寸以代码推算，未在录像中量准。

## 补充（逐帧复核，2026-10-11 05:40 CDT）
对照图 `T2-22.75s-vs-23.0s.png`：
- 22.75s 门洞里能看到暖光的室内，灯塔外墙是石纹；到 23.0s 门洞里变成黑洞，灯塔外墙变成平白。这说明室内层关掉后，门里什么都没有，外墙材质也跟着光照变了。所以方案 A 要改：门还在画面里时**不能**直接关室内层。改为 ISLAND 状态下保留门洞可见的室内 renderer（或只保留门后一小块"门内背板"），光照按方案 B 插值。
- 镜头在 22.8s 是硬停，没有减速，方案 D 必须做（终点速度连续为 0）。
- 回屋 11–12s 镜头从正面全身突然转成侧面中景（`cameraCrossIn` 终点接 `toSeat` 的 `[cameraInside,cameraHome]` 线性段），属于 T3a 方案 C 的范围。
- 已排除：没有看到角色消失、门自动关上、云或海鸥突然出现、开场白闪等现象，自动描述里的这些说法和逐帧画面对不上，不列为缺陷。
