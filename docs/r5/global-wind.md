# R5 全局风（GlobalWind）

场景特效bot · 2026-10-18 · 分支 `fx/r5-s2-360`。目标：草、旗子、船帆共用一个世界风向和一个风力参数，默认值保持现有观感。

## 1. 现有风参数在哪里（改动前）

| 对象 | 位置 | 风向 | 风力 / 时间 | 备注 |
|---|---|---|---|---|
| 草原草（棋盘背景和帆船旅程） | `bundles/region_meadow/meadow-grass-wind.effect` | 写死在着色器里：网格空间 `vec3(0.944, ·, -0.330)` | 振幅来自顶点 `a_color.a`；相位在 UV1.y，周期 4 s（`windParams.x` = 秒） | 阵风相位是烘焙的：沿 (0.944, −0.330) 每米 0.2415 rad（5 片草 r = 0.68–0.91），所以阵风沿这个方向行进 |
| 草原时钟 | `MeadowBoardBackground.ts` `MeadowSceneMotion.update` | — | 写 `windParams = (秒, 1, 夜, 旅程夜)` | 棋盘背景和旅程（`RegionJourneyAdapter`）都用这个组件 |
| 帆船主帆、前帆 | `SailArt.ts` `sync` | 不随风：主帆固定在船的 +x 舷（建模时帆杆偏 26°） | `boom_pivot` 只随收帆量 `25*(1-open)` 转动 | 船头朝世界 +z，所以帆偏向世界 +x |
| 帆船旗 `pennant_flag` | sailboat.glb | 静态，几乎正对船尾（方位 172°） | 无 | 节点 `pennant` 在旗杆顶，可当转轴 |
| 天空城三角旗 | env_skycity.glb `sky_ambient_loop` | 烘焙动画 | — | 天空城没有草和帆，本次不接 |
| 海岛炊烟 | `IslandAtmosphereFxCore.ts` `smoke.leanDir` | (0.99, 0, −0.14)，世界 +X | `WorldFlow getWindStrength()` 0..1 | 与草的默认方向相差约 11° |
| 女主裙摆、围裙 | `CharacterMotion.ts` + `WorldFlowCore` 风力通道 | — | `getWindStrength()` 0..1，只在出门那段为非零 | 这是阵风事件通道，不是常驻风 |

**改动前的不一致**：帆船旅程里草原根节点 `setRotationFromEuler(0,180,0)`，所以草的阵风在世界空间朝 −X（方位 289°）。帆和炊烟却朝 +X。同一画面里，草与旗、帆方向相反。

## 2. 统一接口（最小改动）

新文件 `scripts/render/GlobalWind.ts`。纯模块，不引用 `cc`，写法兼容 loose ES5。

- 状态 `{dirX, dirZ, strength, pennantMps}`。`dir` 是世界 xz 中风吹去的方向。
- 读写接口：
  - 读取：`getGlobalWind()`、`globalWindRevision()`、`globalWindAzimuthDeg()`
  - 设置：`setGlobalWind(x, z, strength?)`、`setGlobalWindAzimuth(deg, strength?)`、`setGlobalWindStrength(s)`、`resetGlobalWind()`
- 默认值：`dir = (0.944, −0.330)`（方位 109.3°，即原来草着色器的常量），`strength = 1`（等于原来的草振幅），`pennantMps = 0.524`。
- 三个使用方：
  1. **草**：effect 新增 uniform `windDir = [x, z, strength, 0]`，默认值与 `GlobalWind` 默认相同。着色器用 `cc_matWorld` 的转置把世界风向转到网格空间（ES2 没有 `transpose()`，改用三次点积手写）。烘焙相位按 `0.2415·dot(pos, l − D0)` 重新对准新方向，`l = D0` 时这一项为 0。位移整体乘以 `strength`。`MeadowSceneMotion.update` 每帧写入 `windDir`。
  2. **旗**：`SailArt.sync` 先算视风：`apparentWindLocal(yaw, speed)`，等于真风 × strength × pennantMps 减去船速。`pennant` 绕旗杆转到视风方向，以 3/s 平滑过渡。没有视风时保持原姿态。
  3. **帆**：`sailSide(app, prev)` 判断帆在哪一舷，+1 是原建模的舷。风明显（> 8.6°）来自另一舷才换舷。换舷时对 `boom_pivot`、`sail_root`、`jib_root` 做 x 镜像（帆材质 cull none），帆杆角 `25*(1-open)*side`。
- 不接入：`getWindStrength()` 阵风通道（女主裙摆、炊烟倾斜）保持不变，天空城烘焙旗和海岛炊烟方向也不变。以后要接，只需读 `getGlobalWind()`。

## 3. 默认观感

| 场景 | 结果 |
|---|---|
| 棋盘背景草原（根节点无旋转） | 与旧着色器逐顶点相同。在 9,767 个草顶点、t = 0..4 s 上对比，最大差 0 m |
| 帆船巡航（3.35 m/s） | 旗与建模姿态相差 0.002°；沿整条航线最大 1.3°。帆在所有航向和速度下都保持原舷，`boom` 和 `scale` 与旧代码相同 |
| 帆船静止（离港前、到岸后） | 旗转向真风方向（约 −63°）。这是对齐风向带来的唯一可见变化 |
| 帆船旅程里的草（根节点 yaw 180°） | **有意改变**：阵风行进方向反过来，改为世界 +X，和帆、旗、炊烟一致。摆动轴、振幅、周期、波长都不变 |

## 4. 测试与预览

- `node tools/scene-fx/test_global_wind.cjs`，19 项全部通过。覆盖：
  - effect 默认值与 UBO，glslangValidator 编译 vs/fs；
  - 默认风下 CPU 仿真与旧着色器逐顶点相同；
  - 4 个风向 × 3 个网格 yaw 下，阵风相位斜率和摆动轴都对准世界风；
  - strength 0 时静止，strength 2 时能量 ×4；
  - 旅程草改为顺风；
  - 巡航时旗不变，沿航线偏差 < 3°；
  - 默认风下帆不换舷；
  - 静止时 6 个风向 × 3 个船 yaw 下，旗、帆、草三者对齐；
  - 换舷回差；
  - API 归一化与 revision；
  - 两处接入点；loose ES5。
- 预览：`previews/场景特效bot/r5/s3/global_wind/wind_compare.png`（三联 t = 3 s 静帧）和 `wind_compare.mp4`（3 段 × 4 s）。
  - 场景按帆船旅程的停泊位摆放：草原 yaw 180°，船位 `sailBerthWorld`。
  - 草用着色器的 CPU 拷贝做真实位移，没有放大。
  - Cycles 64 + OIDN。
  - 工具：`tools/scene-fx/blender_global_wind_preview.py` 和 `make_wind_compare.py`。
