# 0007：地区拖动镜头设计方案 v1.3（grokbot-2/ggbot）
v1.3 修复 Oi 对 v1.2 的退回（数值复现 `0007-v1.2-ROLL-REPRO-2233Z`），并附实际补丁。基线是 e87c409 + 0005。补丁只改 `world-r1/`，另外单独附一个改 e87c409 `WorldIntegrationBoot.ts` 两行的 diff（`0007-wib.diff`）。终版的小岛位姿仍以运镜bot 的 `island_camera_pose.json` 为准。

## 变更记录（v1.3 相对 v1.2）
1. **阻塞 bug：slerp 产生 roll，导致写入被拒**。v1.2 在 cameraOutside → temporary-6m 之间做四元数 slerp。两端 roll 为 0，但中间相机右轴 Y 最多到 −0.01659，超过 0.001 的门限，applyCameraPose 就拒绝写入；animateCamera 又忽略了返回值，结果 121 个采样里有 115 个被拒，相机停住，到快结束时跳了 9.18 m。我先用 v1.2 的真实代码复现了这一点（6 个接受、115 个拒绝、最大跳变 9.176 m），然后修复：
   - **保持地平线**：所有过渡每帧对位置、目标点和 FOV 做线性插值，再用 `fromLookAt(up=+Y)` 重新算旋转（`blendLookAt` / `sampleLookAtPath`）。**位姿之间不再用四元数 slerp**，`slerp` 和 `blendPose` 已删除。没有目标点的运行时位姿（0006 §C 的 C0 → cineCam），改用 yaw/pitch 插值（`blendPoseHorizon`），roll 也恒为 0。**门限没有放宽**，仍是 0.001。
2. **拒写处理（Grok Bot 定的规则）**：走路镜头（`createCameraTrack`）只要有一个采样被拒，或者 look-at 退化，就 `console.error` 记日志，**中止**这条轨道（之后不再写采样），并**立即**通过 applyCameraPose 写入**终点位姿**。如果终点位姿也被拒，再记一条 error，然后重写**最后一次被接受的位姿**。不会静默地继续。
3. **契约统一，目标点必填**：所有作者给出的位姿都必须写 `position + target + fovVerticalDeg`，三项缺一不可；`rotation` 一律由 fromLookAt 推出，**不允许手写**。加载时用 `assertAuthoredPose` 校验：值有限、roll 为 0、FOV 在范围内，否则直接报错。运镜bot 的 `yunjing-final` 也按这个格式交。
4. **`mountWorld` 里的 `camera.fov=55` 也并进唯一写入方**：`0007-wib.diff` 改成两个 hunk，分别删掉第 57 行的 `if(this.characterPrefab)camera.fov=55;`，以及第 82 行 paintNavigation 每帧写相机的那一行。FOV 55 由数据 `home.variants["oi-interim-standing"]` 提供。我核对过：`mountWorld` 里的 `camera` 就是传给 `WorldNativeComposition` 和 `WorldFlowComponent` 的那个 `worldCamera`；而且 `mountWorld` 先执行，`load()` → `restore()` 后执行，restore 会按数据写一次 FOV 55，所以 home 画面和原来一样。
5. **liveFrameCheck 只是日志检查**：它读的是 `cameraWriteLog.last`（最后一次写入的位姿，不是读回的实际相机）和固定的人物包围盒（不是导入后的蒙皮边界），也不知道引擎的 viewport。**不能拿它当真实遮挡或 HUD 的验收**。返回值里带了 `note` 字段说明这一点。
6. **frameCheck 的边界改成数据常量** `REGION_CAMERA.frameLimits`，默认值不变（|x| ≤ 0.7、−0.85 ≤ y ≤ 0.75）。后续：等 Oi 把按钮移到屏幕底部 25% 以后，`minY` 收紧到 −0.5（只改数据）。
7. 自测改成整条路径、逐个采样，都经过**真实的** applyCameraPose（用 Cocos 风格的 stub 相机），见 §8 和 README。

### 本版不做（后续）
- 导航按钮移到底部 25% 的布局（Oi 的文件，需要另外交付并实测）。
- 0006 取消以后的稳定态契约：硬切的时机、安全停姿和恢复时怎么接。
- frameCheck 的 `minY` 收紧到 −0.5（等按钮移动以后再改）。
- 遮挡射线检查（V6）。

## 1. 数据：`regionCamera`（schema v2）
现在先用 TS 数据表 `world-r1/RegionCameraData.ts`，字段和以后的 `assets/bundles/region_island/config/regionCamera.json` 一模一样，等 0007 拖动合进去时再换成 JsonAsset。
```json
{ "version": 2, "fovAxis": "vertical",
  "frameLimits": { "maxAbsX": 0.7, "minY": -0.85, "maxY": 0.75 },
  "islandPoseSource": "temporary-6m",            // "legacy-capsule" | "temporary-6m" | "yunjing-final"
  "homePoseSource": "oi-interim-standing",       // "legacy-capsule" | "oi-interim-standing"
  "island": { "variants": {
    "legacy-capsule": { "position": [-3.4, 2.3, 6.6], "target": [-1.5, 1.05, 4.5], "fovVerticalDeg": 45, "characterYawDeg": 0 },
    "temporary-6m":   { "position": [-5.796, 3.323, 9.352], "target": [-2.114, 0.9, 5.281], "fovVerticalDeg": 45, "characterYawDeg": 0 },
    "yunjing-final":  null } },
  "home": { "variants": {
    "legacy-capsule":      { "position": [-1.1, 1.8, -2.9], "target": [0.35, 0.85, -4.1], "fovVerticalDeg": 45 },
    "oi-interim-standing": { "position": [-1.1, 1.5, -2.4], "target": [0.1, 0.86, -4.35], "fovVerticalDeg": 55 } } },
  "islandCharacter": { "root": [-2.1135, 0, 5.2814], "heightM": 1.7253, "halfWidthM": 0.3 },
  "stops": [ { "id": "tide", "pose": "island" }, { "id": "meadow", "pose": null }, { "id": "sky", "pose": null } ],
  "between": [ { "from": "tide", "to": "meadow", "via": [] }, { "from": "meadow", "to": "sky", "via": [] } ] }
```
- **开关**：运镜bot 交付以后，把 `island_camera_pose.json` 的 Cocos 坐标填进 `island.variants["yunjing-final"]`，再把 `islandPoseSource` 改成 `"yunjing-final"`。只改数据，不改代码。如果选中的那一项是 `null`，就打警告并回退到 `temporary-6m`，不会黑屏。
- **v1.3 契约**：每一项位姿都**必须**写 `position + target + fovVerticalDeg`，单位是米，Cocos 世界坐标。`rotation` 不允许手写，加载时由 `fromLookAt(up=+Y)` 推出，roll 恒为 0。原因是过渡要对目标点做插值（§2.2），只给四元数就没法保持地平线。`assertAuthoredPose` 在路线创建时校验，不合格就直接报错。
- `frameLimits`：调试用的取景边界（数据常量），默认 |x| ≤ 0.7、−0.85 ≤ y ≤ 0.75；等按钮移到底部 25% 以后，`minY` 改成 −0.5。
- `characterYawDeg`：人物在 `exit_path_17` 的朝向，加载时转成 `RouteConfig.islandYawRad`。
- `stops` 和 `between` 的拖动语义沿用 v1.1：`pose: null` 表示地区还没开放，只回弹；`via` 是 Catmull-Rom 中间控制点。

## 2. 相机契约（和 0006 v1.2 §B 是同一份）
> v1.3 起，0006 v1.2 §B2 里「旋转 slerp」的那几行（0007 拖动和 §C 过渡）**以本节 §2.2 为准**；0006 合并时会同步改过去。
### 2.1 字段和单位
```ts
// 运行时（写进相机的就是这个）
type CameraPose   = { position: [x,y,z];        // 米，Cocos 世界坐标，+Y 向上，室外前方 +Z
                      rotation: [x,y,z,w];       // 世界旋转，单位四元数，roll = 0；只能由 fromLookAt 或地平线插值推出
                      fovVerticalDeg: number };  // 竖直 FOV，单位度，范围 30–75
// 作者给的数据（regionCamera、island_camera_pose.json），v1.3 起三项都必填，没有 rotation
type AuthoredPose = { position: [x,y,z]; target: [x,y,z]; fovVerticalDeg: number };
```
- 固定参数，不放进契约：透视投影、`fovAxis = VERTICAL`、near 0.05、far 1000，宽高比跟随屏幕。
- `target` → `rotation` 由 `CameraPose.fromLookAt()` 计算（稳定位姿在加载时算一次，过渡里每个采样各算一次），结果和 Cocos 的 `Node.lookAt(target, +Y)` 完全一致。**更正 0006 §B1 的笔误**：视线向量是 `normalize(position − target)`（相机看向自己的 −Z），不是 `target − position`。我对照 3.8.8 引擎源码 `node.ts:2265` 核过，以这里的写法为准。
- 运行时校验：值都是有限数、四元数长度为 1 ± 1e-4、FOV 在 30–75 之间、roll < 1e-3。不合格时**拒绝写入**并打警告，相机保持原样。

### 2.2 采样和插值（v1.3：保持地平线，位姿之间不用 slerp）
| 场合 | 位置 | 朝向 | FOV | 缓动 |
|---|---|---|---|---|
| 现有走路镜头 `animateCamera`（motion 模式） | lerp | **lerp 目标点 → fromLookAt(up=+Y)** | lerp（没写 FOV 的关键帧继承起步时的当前 FOV） | linear，分段规则和原来一样（有 `progress` 就按 `progress`，否则均分） |
| 0007 拖动（以后） | lerp，或有 `via` 时用 Catmull-Rom | 目标点用同一种插值 → fromLookAt | 固定 45 | 吸附 `easeOutCubic`，回弹 `easeOutBack` |
| 0006 过场 `cine_camera` | clip sample | clip sample 出来以后，**先投影回水平**（取 yaw/pitch 重建，roll 置 0），再写入；去掉的 roll > 0.01 时记 warn | timing.json 逐帧 lerp | 由 CinematicClock 驱动 |
| 0006 §C 回家接入（C0 → cineCam(t)） | lerp | **yaw（取最短弧）和 pitch 分别 lerp → 重建**（`blendPoseHorizon`） | lerp | `easeInOutCubic` |
时间单位都是秒。代码只用 `blendLookAt`、`sampleLookAtPath` 和 `blendPoseHorizon` 三个插值函数，缓动名称只用 `linear`、`easeOutCubic`、`easeInOutCubic`、`easeOutBack` 这四个。v1.2 的 `slerp` 和 `blendPose` 已删除：两个 roll 为 0 的位姿之间做 slerp，中间会产生 roll，这正是 v1.2 被退回的原因。

### 2.3 唯一写入方
- `applyCameraPose(camera, pose, source)`（`world-r1/CameraPose.ts`）是**唯一**能写世界相机节点位置、旋转和 `camera.fov` 的函数，顺序是 `setWorldPosition` → `setWorldRotation` → `fov`。每次写入都记到 `cameraWriteLog`（次数、最后一次位姿、来源）。
- 调用方只走这一个函数。`WorldFlowComponent` 里的 `lease.setCamera` 和 `lease.animateCamera` 现在只是适配器：先把 `Pose` 转成 `CameraPose`，再调用 `applyCameraPose`。`onDestroy` 恢复原相机也走这个函数。以后的 `RegionPanController` 和 0006 的 `CinematicPlayer` 也都调用它。
- 同一帧里的优先级：过场 > 拖动 > 稳定态 `restore()`。过场播放时拖动不响应，稳定态只在进入的那一刻写一次，不会每帧写。
- **拒写处理（v1.3，Grok Bot 定）**：
  - 轨道（`createCameraTrack`，也就是 animateCamera）：遇到第一个被拒的采样（返回 false 或 look-at 退化）时，`console.error` 记下 progress 和原因，`cameraWriteLog.trackAborts++`，**中止轨道**，并**立即写终点位姿**；之后这条轨道的 tick 都不再写。如果终点位姿也被拒，再记一条 `console.error`，然后**重写最后一次被接受的位姿**；如果一次都没被接受过，相机保持原样。走路本身（人物）不受影响，流程照常结束。
  - 稳定态 `setCamera`：被拒时 `console.error`，相机保持原样。稳定位姿在路线创建时已经由 `assertAuthoredPose` 校验过，正常情况下不会出现被拒。

### 2.4 原来的第二写入方：Oi 的 `WorldIntegrationBoot`（e87c409），由 `0007-wib.diff` 处理
- 第 57 行，`mountWorld`：`if(this.characterPrefab)camera.fov=55;` → **删掉**，这一行其余部分不变。
- 第 82 行，`paintNavigation`：home 状态下每帧 `setWorldPosition(-1.1,1.5,-2.4)` 加 `lookAt(.1,.86,-4.35)` → **换成注释**。
- 这两处的值都变成数据 `home.variants["oi-interim-standing"]`（同样的位置和目标点，FOV 55），在进入 `home` 时由 `restore()` → `applyCameraPose` 写一次。
- 核对过：`mountWorld` 里的 `camera`（`scene.getComponentsInChildren(Camera)[0]`）会传给 `composition.worldCamera`，`WorldNativeComposition` 再传给 `WorldFlowComponent.worldCamera`，是同一个相机。`mountWorld` 先执行，然后 `load()` → `restore()` 写入 FOV 55，所以 home 画面不变。
- 打完补丁以后，就现有可见代码而言，世界相机的位置、旋转和 FOV 都只经 `applyCameraPose` 写入。`WorldNativeComposition` 改的是 `visibility`，不算位姿或 FOV。`FirstsliceBoot.ts` 是另一个独立的旧场景，不在这条流程里。
- `homePoseSource` 默认是 `oi-interim-standing`，没挂 `characterPrefab` 的标记模式也会用这组取景。想回到旧取景，把开关改成 `legacy-capsule`。

## 3. 状态和数值（和 v1.1 一样）
- `regionPan`：连续值，范围 [0, maxStop]，0 = 小岛，1 = 草原，2 = 天空之城。手指往右拖，pan 变大。
- `regionFocus = round(regionPan)` 对应的地区 id，吸附完成后才更新。
- `regionPan`、`regionFocus`、`regionPanMoving` 放进 `snapshot()`，拖动时每帧最多发一次事件。**本补丁还没实现拖动**，所以 regionPan 一直是 0。

## 4. 手势（新组件 `world-r1/RegionPanController.ts`，0007 拖动阶段再做；参数和 v1.1 一样）
- 只在 `island` 稳定状态、没有 `needsResume`、没有过场时生效。按钮优先；拖动阈值是水平 10 px，而且水平位移要大于竖直位移的 1.2 倍。
- 灵敏度 `dPan = −dx / screenWidth`。惯性：取最近 100 ms 的速度，阻尼 k = 6/s，|v| < 0.15 时停止；|v| > 1.2 时直接翻页。
- 吸附用 `easeOutCubic`，0.35 s × 距离，最短 0.15 s。越界按 0.35 倍跟手，最多越界 0.25；回弹用 `easeOutBack`，0.3 s。
- 切后台：立即结束拖动和惯性，`regionPan` 直接吸附到最近的整数，不做动画。

## 5. 镜头输出（v1.2 修订，和 0006 §C 一致）
- 拖动时，每帧由 `regionPan` 插值出位置和目标点，再用 fromLookAt 算出 `CameraPose`，调用 `applyCameraPose`。不新增相机，也不再用 `Node.lookAt`。
- 稳定态 `island` 的位姿：`regionPan = 0` 时用 `island.variants[islandPoseSource]`，其他值用对应 stop 的位姿（以后才有）。
- **回家：从当前相机连续接回，不先回小岛**。点「回家」的时候，停掉惯性，把当前位姿记为 `C0`，在回家过场的前 `Tb = clamp(0.6 + 0.4·|regionPan|, 0.6, 1.4)` 秒内，用 `blendPoseHorizon(C0, cineCam(t), t/Tb, 'easeInOutCubic')` 接入（yaw/pitch 插值，不用 slerp）。v1.1 §6.4 写的「先回小岛」已经删掉。
- 0006 合并之前，现在的 `returnHome()` 走路镜头从 `cameraIsland` 起步。因为现在 regionPan 一直是 0，`C0` 就等于 `cameraIsland`，两种写法结果一样。

## 6. 六个入口的规则（v1.2 新增，本节为准）
「现在」= 打上本补丁、0006 还没合并时的行为；「0006 后」= 过场合并以后的行为。所有入口都只由 `applyCameraPose` 写相机。

| 入口 | 代码路径 | 落点 regionPan | 相机位姿来源 | 过渡 | 人物 root / yaw | 谁写 |
|---|---|---|---|---|---|---|
| **出门完成** | `leaveHome()` 结束 → `restore()` | 0 | `island.variants[islandPoseSource]` | 现在：fixed 模式硬切；motion 模式最后一段走路镜头的终点就是这个位姿，所以差值为 0。0006 后：过场最后一帧必须等于这个位姿（差值 < 1 mm、< 0.1°，FOV 相等），`restore` 那一下差值为 0 | `exit_path_17`，yaw = `characterYawDeg`（`cancelAndReset`）。0006 后要求 `rootEnd` 等于这个值 | `restore` → `lease.setCamera` → `applyCameraPose` |
| **结算返回** | `exitLevel()` → `restore()` | **0**（归零，不保留进关前拖到的位置） | 同上 | **硬切**：这时棋盘盖住画面，世界层原来是 NONE，看不到跳变。v1.1 的 0.35 s ease-out 已删掉 | 同上 | 同上 |
| **取消** | `cancelTransition()`，`operate` 出错时也走这里，都进 `restore()` | 0 | 回到「出发前的稳定位置」：出门途中取消回 `home` 位姿；回家途中、或进关加载中取消回小岛位姿 | 现在：硬切（现有行为，不改）。0006 后（过场中取消）：按 0006 A5，相机先停在当前位姿，FOV 在 0.3 s 内线性回到 45；之后第一次进入稳定态时，才按位姿表硬切 | 现在：`cancelAndReset` 回到稳定位置（坐在椅子上，或站在 `exit_path_17` + yaw）。0006 后：人物停在原地，0.25 s 淡回站立 | 现在：`restore`。0006 后：CinematicPlayer 调 `applyCameraPose` |
| **暂停恢复** | `hide()` → `restore()`（层 NONE），`resume()` → `restore()` | 切后台时吸附到最近整数并**保留**（现在恒为 0） | `pose(regionPan)`，也就是小岛或 `home` 那一项 | 硬切（恢复前画面是暂停层）。注意：现有逻辑里切后台会**作废正在进行的过渡**，所以恢复后落在出发前的稳定位置。0006 后：过场中切后台不作废，恢复时从原来的时钟时间继续，相机由时钟逐帧写，`restore` 不介入 | `cancelAndReset` 回到稳定位置；在关卡里时人物隐藏 | `restore`；0006 后过场段由 CinematicPlayer 写 |
| **冷启动** | `load()` → `restore()`，进入 `home` | 0（不存档） | `home.variants[homePoseSource]`（现在是 Oi 的临时取景，FOV 55） | 硬切（第一帧） | 坐姿 `seatedControllerRoot` | `restore`。`paintNavigation` 和 `mountWorld` 都不再写相机（`0007-wib.diff`） |
| **跳过** | 现在没有这个入口：0006 合并前没有跳过按钮，**not_run** | 0 | 跳过开场：小岛位姿。跳过回家：`home` 位姿（回家过场最后一帧必须等于它，误差标准和出门一样） | 硬切。这是唯一一个画面允许跳的入口 | 开场：`rootEnd` = `exit_path_17` + yaw。回家：坐姿 root (0.4327, 0, −4.2076) | CinematicPlayer 的 `skipCinematic` 调 `applyCameraPose` |

补充：
- 冷启动后，如果 MainlineHost 直接恢复到结算页，从那里点返回就走「结算返回」这一行。
- 0006 合并后不新增 `WorldFlowCore` 状态：过场挂在现有的 `crossing-out`、`walking-home` 这些状态下面，稳定态入口仍然只有 `restore()` 一处。

## 7. 「回海岛」落点（OI-FRAME-002）
### 7.1 原因（v1.1 结论不变，补充真实 FOV）
- 结算返回 → `restore()` → `cameraIsland`。人物站在 `exit_path_17` = (−2.1135, 0, 5.2814)，yaw 0。旧机位离人物只有约 2.6 m。
- **更正**：e87c409 在挂了 `characterPrefab` 时，`mountWorld` 会把相机 FOV 设成 55，小岛画面也一样，不是 v1.1 写的 45。按包围盒投影（窄屏 0.46）：FOV 45 时 x ∈ [−0.96, 1.36]、y ∈ [−1.66, 0.41]；FOV 55 时 x ∈ [−0.77, 1.09]、y ∈ [−1.32, 0.32]。两种 FOV 下人物都会出画，结论不变。
### 7.2 临时候选 `temporary-6m`（放在开关后面，**不是终版**）
- 朝向不变，相机退到离胸口点 6 m：position (−5.796, 3.323, 9.352)，target (−2.114, 0.9, 5.281)，FOV 45（按 §2 的契约，静止时用 45）。转成四元数是 (−0.192566, −0.351672, −0.074166, 0.913096)。
- 包围盒投影（离线算，FOV 45）：窄屏 0.46 时 x ∈ [−0.39, 0.39]、y ∈ [−0.40, 0.37]；宽屏 0.75 时 x ∈ [−0.24, 0.24]、y ∈ [−0.40, 0.37]。都满足 |x| ≤ 0.7、−0.85 ≤ y ≤ 0.75。**这只能说明包围盒在画面里**，不能说明没被遮挡、HUD 没盖住人物，也不能说明回程的人物变换是对的，这些见 §8。
- **已知风险（HUD 遮挡，理论推算）**：e87c409 在竖屏时，小岛的 6 个导航按钮是 240 px 宽的一列，按钮中心 y 在 +140 到 −130 px，覆盖屏幕中央 [−153, +163] px。在 402×874 的屏幕上，人物投影在中央 x ±79 px、y [−176, +161] px，**几乎被按钮列完全盖住**。所以终版构图要么把人物放到按钮列下方（大约 NDC y < −0.37），要么调整按钮布局（这是 Oi 的文件，由 Oi 或 Grok Bot 决定）。这一条已经列给运镜bot 作为构图约束（§9）。
### 7.3 构图规则（给终版用）
- 窄屏 0.46 到宽屏 0.75 之间，人物包围盒（含帽 1.7253 m，宽 0.6 m）要满足 |x| ≤ 0.7、−0.85 ≤ y ≤ 0.75，并且**不和 HUD、安全区重叠**；从相机看向人物头、胸、脚的采样点，视线不能被岛上的物体挡住（§8 V6）。

## 8. 验证要求（每次换小岛位姿数据时都要重做）
| # | 项目 | 方法 | 本次状态 |
|---|---|---|---|
| V1 | 用真实的 interim B 模型（不是胶囊） | 在 DevTools 和 Web 预览里加载 `chr_b_r5g2_..._INTERIM` | **not_run**（这台机器上没有 Creator 构建和 DevTools） |
| V2 | 真实 FOV | 回到小岛后读 `camera.fov`，应等于数据里的值（45）；`__worldCamera.writes().last.fovVerticalDeg` 也要一致 | 数据和单测 passed；引擎里 **not_run** |
| V3 | 视口、HUD、安全区 | 按实际的按钮和安全区矩形，算它们和人物投影矩形有没有交集 | 理论推算 **FAIL**（见 §7.2，竖屏按钮列挡住人物）；实测 **not_run** |
| V4 | 截图 | 在窄屏 390×844 / 402×874（约 0.46）和宽屏 600×800（0.75）上，分别截出门完成、结算返回、暂停恢复三张 | **not_run** |
| V5 | 投影日志 | 每帧调 `__worldCamera.liveFrameCheck()`，记录人物包围盒投影的 x、y 范围和 pass；`__worldCamera.frameCheck()` 给出数据位姿在 0.46 和 0.75 下的结果。**这只是日志检查**：读的是最后一次写入的位姿，不是读回的实际相机；用的是固定包围盒，不是蒙皮边界；也不知道引擎 viewport。**不能当遮挡或 HUD 的验收** | 工具已在补丁里；离线计算 passed（§7.2 的数字）；引擎里 **not_run** |
| V6 | 遮挡 | 从相机向人物头（1.6 m）、胸（0.9 m）、脚（0.05 m）三个采样点各打一条射线，用 `geometry.intersect.rayModel` 和岛上的 MeshRenderer 求交，比采样点近的命中都算遮挡 | **not_run**（还没实现，等终版位姿到件时，和运镜bot 在 Blender 里同一套采样点一起核对） |
| V7 | 同版本核对 | `RegionCameraData.islandCharacter.root` 等于 `FIRSTSLICE.anchors.exit_path_17`（同一份 GLB sidecar）；运镜bot timing.json 里出门最后一段的 `rootEnd` 也要等于它（≤ 1 cm、≤ 1°），而且 `characterYawDeg` 和 `rootEnd.yawDeg` 一致；GLB 的 SHA 要相同 | 前半 passed（误差 < 1 mm）；`rootEnd` 部分 **not_run**（M1 v2 还没到件） |
| V9 | 整段过渡（v1.3 新增） | 7 段 motion 镜头路径（含 outside↔island 双向），用 121 个归一化采样，以及按真实时长、30 和 60 fps 采样，起步 FOV 分别为 45 和 55；每个采样都经过真实的 applyCameraPose。断言：全部被接受、四元数单位长度、roll < 0.001、位置步长不超过解析上界、终点和终点位姿一致。另外强制制造中途拒写，断言最后正好停在终点位姿 | **passed**（离线，stub 相机）；引擎里 fixed/motion 往返 **not_run** |
| V8 | 唯一写入方 | 小岛和 `home` 稳定态停 5 s，`cameraWriteLog.writes` 不应增长；全局搜不到 `camera.node.setWorld*` 或 `lookAt` 写世界相机 | 代码搜索 passed（`world-r1`、`paintNavigation` 和 `mountWorld` 的 FOV 都处理了；`FirstsliceBoot.ts` 是旧的独立启动场景，不在这条流程里）；运行时 **not_run** |

## 9. 给运镜bot（M3 对齐）
- `island_camera_pose.json` 请按 **v1.3 契约**交：Cocos 坐标下的 `position`、**`target`（必填）**、`fovVerticalDeg`，再加 `characterYawDeg`。**不要给 `rotation`**，旋转由 fromLookAt 推出（up=+Y，roll 0），给了反而会被拒。Blender 坐标可以附上作参考。另外附 0.46 和 0.75 两种画面下按 §7.3 算的投影结果。
- 过场里 `cine_camera` 的 roll 请保持 0。运行时会把它投影回水平，去掉的 roll 超过 0.01 时会记 warn。
- 构图约束补充 §7.2 的 HUD 风险：竖屏中央那一列按钮会挡住人物。请在两个方案里至少有一个把人物放在 NDC y < −0.37 的位置，或者在交付说明里写明依赖按钮改布局。
- 出门最后一帧要满足：相机位姿等于这个位姿；人物 `rootEnd` 等于 `exit_path_17` 加上 `characterYawDeg`。

## 10. 验收（Oi）
1. 打上补丁以后：出门完成、结算返回、暂停恢复三条路径停在小岛时画面完全一样；人物完整，没有挤在右边缘（V4 截图）。
2. `home` 取景和 e87c409 现在的一样（−1.1, 1.5, −2.4 看向 .1, .86, −4.35，FOV 55），而且不再每帧被写（V8）。
3. 把 `islandPoseSource` 改成 `legacy-capsule` 能重现 OI-FRAME-002；改回 `temporary-6m` 问题消失，不需要改代码。
4. 以后拖动合进来时：从草原点回家，镜头**连续**接入回家过场，中间不经过默认的小岛机位（与 0006 §C 验收第 5 条相同）。
5. 只有小岛有位姿时，拖动只回弹；拖动中切后台，恢复后停在最近的地区，没有残留惯性。
6. 出门过场最后一帧和 `regionPan = 0` 的位姿逐项比较，差值 < 1 mm、< 0.1°，FOV 相等。

## 11. 本补丁做了什么，没做什么（v1.3，v1.2 + v1.3 合成一个补丁）
- 做了：
  - `CameraPose.ts`：契约；fromLookAt；`AuthoredPose` / `assertAuthoredPose`；插值函数 `blendLookAt`、`sampleLookAtPath`、`blendPoseHorizon`；`createCameraTrack`（拒写时中止并写终点位姿）；`applyCameraPose`（唯一写入方）；投影调试。
  - `RegionCameraData.ts`：数据表、两个开关和 `frameLimits`。
  - `FirstsliceRoutes`：读数据，并用 `assertAuthoredPose` 校验。
  - `WorldFlowComponent`：setCamera、animateCamera（经 `createCameraTrack`）和 dispose 恢复都走 applyCameraPose；稳定态被拒时记 `console.error`；调试入口 `__worldCamera`，其中 `liveFrameCheck` 只做日志。
  - `WorldFlowCore`：只改了类型。
- 单独的 diff：`0007-wib.diff`，在 e87c409 上改第 57 行和第 82 行。
- 没做：拖动手势和 `regionPan`、遮挡射线（V6）、跳过按钮（0006）、按钮布局、0006 取消后的稳定态契约。
