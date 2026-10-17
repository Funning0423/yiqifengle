# 地区切换镜头和拖动：现状说明 v1（grokbot-2/ggbot，只读，没有改任何文件）
代码基准：0001e，相当于 Oi 的 78a3dba。Oi 正在改的 `ManagedMobileBoardUI` / `WorldIntegrationBoot` / `MainlineHost` 只读过，没有动。

## 结论
1. **工程里还没有「左右拖动看地区」的镜头逻辑**，也没有草原、天空之城的场景位姿。现在的「地区选择」只是导航层上的一列按钮（`WorldIntegrationBoot.ts:72`，顺序是 `mainline, r4, tide, meadow, sky, home`）。按钮直接进入对应地区挑战的第一关，镜头不动。
2. 地区的逻辑顺序在 `regional-r05` 里是 `tide`（潮汐小径，小岛）→ `meadow`（花粉草甸）→ `sky`（天空回声），和 Funning 说的「小岛 → 往左草原 → 再往左天空之城」一致。
3. 「当前拖到哪个位置」这个值现在还不存在，要等拖动镜头做出来才有（见第 4 节的约定）。

## 小岛这一格的镜头位姿（唯一现有的数值）
- 文件：`assets/scripts/world-r1/FirstsliceRoutes.ts:20`
  `cameraIsland = { position: [-3.4, 2.3, 6.6], target: [-1.5, 1.05, 4.5] }`
- 应用方式：`world-r1/WorldFlowComponent.ts:82`，`camera.setWorldPosition(position)` 之后调用 `camera.lookAt(target)`（上方向 +Y，没有 roll）。
  `WorldFlowCore.ts:96` 在 `island` 稳定状态下用这个位姿；`:155` 出门最后一段从 `cameraOutside` 插值到这里；`:176` 回家从这里出发。
- 相机参数（`WorldR5Integration.scene`）：透视，FOV 45°，按竖直方向计算（`_fovAxis=0`），near 0.05，far 1000。
- 换算成角度（供参考）：朝向向量是 (1.9, -1.25, -2.1)，俯角约 23.8°，水平方向从 -Z 往 +X 偏约 42.1°。
- 换到 Blender（Z 向上，glTF 导出时 Y→Z 互换），Cocos 的 (x, y, z) 对应 Blender 的 (x, -z, y)：
  位置 (-3.4, -6.6, 2.3)，目标 (-1.5, -4.5, 1.05)。前提是房间和小岛的根节点在原点、缩放为 1（`identity()` 会在导入时校验这一点）。
- 注意：Funning 说的「参考图那个俯看小岛的视角」**不一定就是这组数值**。如果参考图的视角不一样，以参考图为准，由运镜bot 定一个新位姿，我改 `cameraIsland`（等 Oi 测完以后再改）。改了以后，出门的最后一帧、回家的第一帧和拖动停在小岛时，三处都用这同一个数。

## 拖动镜头的建议约定（只是方案，等闭环测完再做）
- 数据：新增 `regionCamera.json`，内容是 3 个停靠位姿 `{tide, meadow, sky}`，每个是 `{position, target}`，可选一条中间曲线。小岛的值就是上面的 `cameraIsland`。
- 运行时状态：用一个连续值 `regionPan`，0 = 小岛，1 = 草原，2 = 天空之城（往左拖值变大）。松手后吸附到最近的整数，带缓动。
  `WorldFlowCore.snapshot()` 会新增 `regionPan` 和 `regionFocus`（`'tide'|'meadow'|'sky'`）两个字段，并发出 `onChange` 事件；调试入口是 `__worldIntegration.snapshot().regionPan`。
- 给 Voice Bot：交叉淡化直接读 `regionPan`，每帧或每次 onChange 读一次。建议用等功率曲线：小岛音量 = cos(clamp(p,0,1)·π/2)，草原音量 = sin(clamp(p,0,1)·π/2)（p≤1 时）；p 在 1 到 2 之间时，草原和天空之城按同样方法过渡。拖动时只调音量，三条循环不要停止也不要重新开始播放。
- 给运镜bot：出门过场的最后一帧 = `regionPan=0` 的位姿，也就是 `cameraIsland`（或者按参考图重新定的值）；回家过场的第一帧也是这个位姿。如果玩家在草原或天空之城点了「回家」，先吸附回 0 再开始播回家过场，所以回家过场只需要做一个起点。
