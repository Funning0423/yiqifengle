# 0007：地区拖动镜头设计方案 v1.1（grokbot-2/ggbot）
v1.1 新增 §7「回海岛」落点，对应 OI-FRAME-002。
状态：只写方案，不改代码。等可玩闭环测完以后，和 0006（过场）一起排期。不碰 Oi 正在改的三个文件，接入点放在新文件里，最后合并时再在 `WorldIntegrationBoot` 里加一行挂载。

## 1. 数据：`assets/bundles/region_island/config/regionCamera.json`
```json
{ "version": 1, "fovDeg": 45, "fovAxis": "vertical",
  "stops": [
    { "id": "tide",   "position": [-3.4, 2.3, 6.6], "target": [-1.5, 1.05, 4.5], "source": "PLACEHOLDER = FirstsliceRoutes.cameraIsland; replace with island_camera_pose.json" },
    { "id": "meadow", "position": null, "target": null, "source": "PLACEHOLDER, Grok Bot art" },
    { "id": "sky",    "position": null, "target": null, "source": "PLACEHOLDER, Grok Bot art" } ],
  "between": [ { "from": "tide", "to": "meadow", "via": [] }, { "from": "meadow", "to": "sky", "via": [] } ] }
```
- `position: null` 的地区暂时不开放：拖动边界只到最后一个有位姿的地区，所以现在只有小岛的话就拖不动，只会回弹。
- `via` 是可选的中间控制点，用来绕开灯塔或山体。镜头沿 Catmull-Rom 曲线插值；为空时，位置和目标点都按直线插值。
- 小岛的值以运镜bot 的 `island_camera_pose.json` 为准；`FirstsliceRoutes.cameraIsland` 也改成读这个文件，保证出门最后一帧、回家第一帧和拖动停在小岛时三处一致。

## 2. 状态和数值
- `regionPan`：连续值，范围 [0, maxStop]，0 = 小岛，1 = 草原，2 = 天空之城。手指往右拖，画面往左移，看向更左边的地区，pan 变大。
- `regionFocus`：`round(regionPan)` 对应的地区 id；只在吸附完成时才更新。
- 都放进 `WorldFlowCore.snapshot()`（新增 `regionPan`、`regionFocus`、`regionPanMoving`），通过 `onChange` 发出。拖动过程中每帧最多发一次事件。

## 3. 手势（新组件 `world-r1/RegionPanController.ts`，挂在导航 Canvas 下面一层的全屏透明节点上）
- 只在 `island` 稳定状态、没有 `needsResume`、没有过场时生效；其他状态下完全不响应。
- 按钮优先：导航按钮所在的 Canvas 优先级更高，点按钮不会触发拖动。拖动判定阈值是水平移动 10 px，而且水平位移要大于竖直位移的 1.2 倍。
- 灵敏度：一个屏幕宽度对应 1.0 个地区（`dPan = -dx / screenWidth`），以后可以调。
- 惯性：松手时取最近 100 ms 的速度 v（单位 pan/s），按指数衰减滑行（阻尼 k = 6/s，每帧 v *= e^(-k·dt)）。|v| < 0.15 时结束滑行，进入吸附。
  **可选的快速翻页**：|v| > 1.2 时，直接吸附到滑动方向的下一个地区，不管滑行最后停在哪。
- 吸附：吸附到最近的整数，用 ease-out-cubic 曲线，时长 0.35 s × 距离，最短 0.15 s。
- 边界回弹：超出 [0, maxStop] 时加阻力，越界量按 0.35 倍跟手，最多越界 0.25；松手后用 ease-out-back 回弹到边界，0.3 s。
- 切后台：立即结束拖动和惯性，直接吸附到最近的地区，不带动画。

## 4. 镜头输出
- 每帧算出 pan 对应的 `{position, target}`，调用现有的 `world.setCamera(pose)`（`WorldFlowComponent.ts:82` 里的 setWorldPosition + lookAt），不新增相机。
- `WorldFlowCore.restore()` 和 `island` 稳定状态原来使用 `cameraIsland` 的地方，都改成用当前 `regionPan` 对应的位姿。
- 回家：从当前相机连续接回回家过场，不先吸附回 0。详见 0006 v1.2 的 §C。
- 进地区关卡：沿用现在的按钮；以后也可以只显示当前 `regionFocus` 那个地区的入口按钮（这条等 Funning 定）。

## 5. 对外接口
- 音频：`GameAudio` 读 `snapshot().regionPan` 做等功率交叉淡化（Voice Bot 方案 v1）。白天和夜晚各一套循环（天空之城也要出夜晚版）；进关卡时环境声压到 40%，退出关卡后淡回来。
- 美术：草原和天空之城的位姿由 Grok Bot 给，填进 `regionCamera.json` 就生效，不用改代码。
- 调试：`__worldIntegration.regionPan(value)` 直接跳到某个位置；`__worldIntegration.snapshot().regionPan` 读当前值。

## 6. 验收（Oi）
1. 只有小岛有位姿时：往两个方向拖都只回弹，不会露出空白画面，按钮正常可点。
2. 填入占位的草原位姿以后：慢慢拖会跟手，松手吸附到最近的地区；快速一划会翻到下一格；拖到两端会回弹。
3. 拖动过程中切后台再回来：停在最近的地区，没有残留的惯性。
4. 从草原点「回家」：先回到小岛，再开始回家，镜头不跳。
5. 出门过场结束时的镜头和 `regionPan=0` 的镜头逐项比较，差值 < 1 mm、< 0.1°。

## 7. 「回海岛」落点（OI-FRAME-002，v1.1 新增）
### 7.1 原因（根据代码和截图算出来的）
- 结算后点「返回」，会依次走 `WorldFlowCore.exitLevel()`、`restore()`，然后用 `config.cameraIsland`（`FirstsliceRoutes.ts:20`）。人物站在 `toIsland` 最后一点 `exit_path_17` = (−2.1135, 0, 5.2814)，yaw 0。
- 这个机位离人物只有 **约 2.6 m**。竖直 FOV 是 45°，iPhone 12 竖屏的宽高比约 0.46，**水平半视角只有约 10.8°**，可见宽度在人物身边只有 ≈1.0 m。
  按理论投影，人物中心在画面横向 NDC ≈ +0.15、偏右，脚在画面外（y ≈ −1.26），头顶在 y ≈ +0.27。只要人物网格的原点、朝向，或者 interim 尺寸（含帽 1.7253 m）有一点偏差，人物就会被挤到右边缘，截图正是这样。
- 结论：问题出在机位本身对竖屏太近、太窄，不是返回流程出了错。原来的机位是按胶囊占位调的。

### 7.2 规则（「回海岛」统一落到 `regionPan = 0`）
- 所有进入 `island` 稳定状态的入口，都用**同一个**位姿 `stops.tide`（= `island_camera_pose.json`），包括出门过场结束、结算后返回、取消、冷启动恢复和跳过。不能各自用不同的机位。
- 人物同时**回到 `exit_path_17`，朝向固定**（yaw 由运镜bot 在 `island_camera_pose.json` 里给出，建议让人物微侧向镜头），不保留进关卡前的位置。
- 每次结算返回时，`regionPan` **归零**（玩家之前拖到草原，回来也落在小岛），带 0.35 s 的 ease-out 过渡。如果返回时画面原来是黑的，就直接设定，不做过渡。
- **人物必须完整在画面内**。在宽高比 0.46（窄屏基准）到 0.75（宽屏）的范围内，人物包围盒（含帽 1.73 m，宽约 0.6 m）投影以后要满足：横向 |x| ≤ 0.7，纵向 −0.85 ≤ y ≤ 0.75（给安全区和 HUD 留边）。
  按 45° FOV、镜头对准人物胸口推算，相机到人物的距离**至少约 3 m**（主要由高度约束决定）。俯看全岛的终帧距离会远大于这个值，所以这条约束主要是检查人物有没有被岛上的物体挡住、有没有被画面边缘切掉。
- 检查方法：加载 `island_camera_pose.json` 时，在运行时调试入口 `__worldIntegration.frameCheck()` 里计算人物包围盒的投影，并返回 PASS/FAIL；运镜bot 在 Blender 里用同一套公式核对。
- **临时占位**（等运镜bot 出终版之前，只用来解决「挤在边上」的问题，不代表最终构图）：保持原来的朝向，把相机后退到离人物胸口 6 m：
  `position = [-5.796, 3.323, 9.352]`，`target = [-2.114, 0.9, 5.281]`。按 0.46 的宽高比投影，人物居中，完整在画面内。这组数要等闭环测试结束后，跟 0007 一起合进去；如果 Oi 现在就想先换掉，也只需要改 `FirstsliceRoutes.ts:20` 这一行。

### 7.3 给运镜bot（M3 对齐）
- `island_camera_pose.json` 里增加 `characterYawDeg`（人物在 `exit_path_17` 的朝向），以及你在 Blender 里按 7.2 的规则核对过的投影结果，宽高比 0.46 和 0.75 各一组。
- 出门过场的最后一帧，人物的 `rootEnd` 要等于 `exit_path_17` 加上这个朝向。这样「出门结束」和「结算返回」两条路径停下来的画面完全一样。
