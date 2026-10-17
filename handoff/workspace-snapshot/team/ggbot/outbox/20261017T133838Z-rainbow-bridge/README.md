# r5 彩虹桥（rainbow bridge）实现 — GGbot

- 分支：`ggbot/build05-r5-rainbow-bridge`（只在本地，没有 push），worktree 在 `/tmp/wt-rb`
- 基线：`fd1a39d`（`integration/build05-r41-20261017T125738Z`），`/tmp/wt-r41` 和那条分支都没动
- 提交（git identity 用的是 Cursor Agent）：
  - `91dbd4e`：主体
  - `fb37a67`：ground 和 motes 合用同一个 program，包体少 8.6 KB
  - HEAD 的完整 SHA 见文末
- 补丁：`patches/0001-*.patch`、`0002-*.patch`，用 `git am` 打在 fd1a39d 上
- 方案出处：`product/2026-10-17/rainbow-bridge/IMPLEMENTATION.md`，两个 effect 草稿取自 `engine-draft/`

## 1. 改了什么

### 1.1 桥面（1 个 DC）
- **换掉了什么**：`RegionJourneyAdapter.rainbowBridge()` 原来的 7 条平面彩条已删除。现在由 `mountRainbowBridge()` 在运行时生成一整块网格：一个 `MeshRenderer`，挂在节点 `RainbowBridgeDeck` 上。
- **截面**：每圈 20 个顶点，闭合截面，cull back。
  - 桥面宽 2.1 m，路面有 3 cm 拱起。
  - 两侧各有 7.5 cm 的白金色路缘（护栏），侧面带倒角，底面偏紫。
  - 桥中间厚 0.24 m，到两端收薄到 1.2 cm；两端各外扩 0.22 m，像喇叭口。
- **高度**：路面中线比她的脚低 1 cm，旧彩条是低 1.5 cm。
- **拱形**：`bridgePath()` 默认改成 **sin²** 拱（新增 `bridgeArchSin2`）。两端切线是平的，落地的地方没有折角。原来的 sin 拱保留为 `bridgeArchSin`。
- **两端溶解**：端部 2.8 m 内是"花瓣溶解"，花瓣大小的 Voronoi 格子各自按随机值消失。
- **视觉参数**：都在 `RainbowBridgeMesh.RAINBOW_LOOK`。

  | | 概念图 | 白天 | 夜晚 |
  |---|---|---|---|
  | alpha | 0.88 | 0.50 | 0.46 |
  | 饱和度 | 1.0 | 0.58 | 0.58 |
  | 发光 | 1.25 | 1.0 | 0.78 |

  - 夜晚比白天暗，不会过曝。
  - 颜色再往白色混 18%，所以整体明亮但偏粉彩，不会像"彩虹滑梯"。
  - 测试 R6 算出：白天桥下的水有约 40% 透过来，最亮的像素 0.935；夜晚最亮的像素 0.535。
- **白色光缝**：概念图里每隔 1.2 m 一条的白色横向光缝已**完全去掉**，shader 里也没有 seam 项（lint 会检查）。
- **剩下的动态效果**：一条很淡的流光（UV 滚动，强度 0.1），以及路面上稀疏的闪粒（强度 0.3）。

### 1.2 两端（1 个 DC + 粒子 1 个 DC）
- **地面光晕**：每端一块 9×7 顶点的网格，贴在真实地面上方 2.5 cm。
- **花瓣和小花**：每端 34 片花瓣贴地，8 朵小彩虹花。
  - 小花只放在草地上，不放在路、桥面（+0.3 m）上，也不放在她走的路线 0.6 m 以内。
  - 落点必须局部平整，并且避开烘焙时标成 `r`（粗糙）的格子，也就是潮池边、石头、台阶这类比网格还小的起伏。
- **粒子 88 个**，全部是 GPU 动画的四边形：每端 20 个光点 + 每端 12 片落花瓣 + 24 个路缘闪光，共 1 个 DC。
  - 本项目没有开启引擎的 `particle` 模块，所以没用 ParticleSystem。
- **DC 合计 3 个**（桥面 1 + 两端地面 1 + 粒子 1），原来是 7。
- **包体**：两端完全程序化生成，**不用 GLB、不用贴图**（0 B）。场景设计部做的端帽 GLB 没有用上，原因是它们放在替身地形上，接不上真实落点。

### 1.3 岛这一端重新落地
- 地面高度表 `RainbowBridgeGround.ts` 由 `tools/rainbow-bridge/bake-ground.cjs` 从真实 GLB 烘焙出来，三块表对应岛、草地、湖边三端。
  - 摆放方式和旅程一致，岛的三角面取自 `room_no_original_chair.glb`。
  - 规格：21×21 格，格距 0.3 m。
- 岛端落在真实的 `islandApproach(exit_path_17)` = **[-1.3135, 0, 8.4814]**，不是替身地形。
  - 这个点在崖边，所以岛端多铺了 0.8 m 的"舌头"回到岛面上。
  - 舌头的尖端贴地（< 5 cm）。
  - 最低的桥面顶点比真实地面高 2.7 mm；可见部分比地面高 ≥ 10.8 cm。
- 如果岛端被移动超过 0.3 m，`rainbowEnd()` 会打一条 warn，提示重新烘焙。R1 测试也会把烘焙结果和 GLB 对比。

### 1.4 天空城那一段（不动 §8）
- **天空城坐标和 §8 数据一点没改**（42° 那组数据作废；方案 B 是 r5，还没定稿）。
- 08→09 那段桥也用 sin²，但两端没有端帽（`[null,null]`），也没有粒子。
- 等 §8.4 的端点定下来，只需要传入 `rainbowEnd(...)` 就行，代码是参数化的。

### 1.5 回退
- 如果 effect 加载失败：用 builtin-standard 纯色 #d9d2ee 显示桥面，并打一条 `[QF_RAINBOW]` console.error，不会卡住旅程。

### 1.6 测试
- **新增两个测试**，已注册进 `run-suite.cjs`：
  - `rainbow-bridge-mesh`：R1–R6，包括地面表和 GLB 一致、截面、真实地面间隙、端部落地、88 粒子、视觉数值。
  - `rainbow-bridge-effects`：effect 结构 lint、3.8.8 编译、WebGL 编译。
- **改写的测试**：
  - bridge-render-contract 重写。
  - start-continuity 重新取了 sin² 的基准值，并保留旧 PIN 在 sin 拱上的验证，证明相机逻辑没变。
  - meadow-night-grade、lakeside-camera 更新。
  - 另外两个测试里的填充节点名改为 `RainbowBridgeDeck`。

## 2. 三个 effect 问题的答案（对照 3.8.8 源码静态核对 + 实际编译）

**环境**：
- 编译器：Creator 3.8.8 自带的 effect 编译器（shdc，从 3.8.8 编辑器原样取出），配 cocos-engine 3.8.8 tag 的 chunks（commit 411f98df）。
- 存放位置：`team/ggbot/tools/cc-shdc-3.8.8/`。
- WebGL 实测：headless Chrome SwiftShader，WebGL1 无导数扩展 / WebGL1 有扩展 / WebGL2 三种模式，全部编译 + 链接通过。

**(a) 导数扩展**
- 草稿写了 `#pragma extension([GL_OES_standard_derivatives, __VERSION__ < 300])`。这个写法正确：shdc 会生成带 `#ifdef` 保护的 `#extension`，和 builtin-graphics 一样。
- **但草稿里 `dFdx` 没有保护**。在**没有 OES_standard_derivatives 的 WebGL1 上编译会失败**，我在 SwiftShader 上实测过。
- 已修：`dFdx/dFdy` 只放在 `#if __VERSION__ < 300` → `#ifdef GL_OES_standard_derivatives` 里，以及 GLSL3 分支里；没有扩展时退回顶点法线（`a_normal`）。
- lint 会检查：所有导数调用都在保护里，并且存在法线回退。

**(b) priority 写法**
- `priority: max - 10` 是 3.8.8 正确的 pass 写法，编译结果是 245。
- 透明队列的排序（custom pipeline 和 legacy 都一样）：model priority → pass priority → 深度从后往前。
- 现在的顺序：地面光晕 `max - 11`（244）→ 桥面 `max - 10`（245）→ 粒子 `max - 9`（246）。shdc 输出已核对。

**(c) depthBias 在 WebGL1 上是否有效**
- **没效果**，WebGL2 上也一样。
- 原因：3.8.8 的 WebGL/WebGL2 后端虽然调用 `gl.polygonOffset`，但从来不 `enable(POLYGON_OFFSET_FILL)`，webgl-swapchain 初始化时还把它关掉了。
- 处理：effect 里**不用 depthBias**（lint 禁止）。改为在顶点里沿视线方向往相机挪一小段：
  - 桥面端部：`min(4 cm, 0.0012·距离)·(1−fade)`；
  - 光晕、花瓣：`min(6 cm, 0.003·距离)`；
  - 再加上光晕本身抬高 2.5 cm、花瓣抬高 1.2 cm。
  - 像素位置不变，只是深度更靠前，所以 WebGL1 和 WebGL2 表现一致。

## 3. 包体估算（新增，未压缩）

| 内容 | 字节 |
|---|---|
| RainbowBridge.ts（压缩后 JS） | 5,002 |
| RainbowBridgeMesh.ts | 12,141 |
| RainbowBridgeGround.ts（地面表） | 4,335 |
| RegionJourneyAdapter 差量 | −643 |
| RegionJourneyLayout 差量 | +228 |
| rainbow-bridge.effect（编译后 JSON：glsl1 + glsl3 + descriptors） | 15,279 |
| rainbow-bridge-additive.effect（同上，1 个 shader） | 12,974 |
| GLB / 贴图 | 0 |
| **合计** | **49,316 B ≈ 48.2 KB**（gzip 约 11.8 KB） |

- 按"编译后的 effect + 代码"这个口径算，**比 ~35 KB 的目标多了约 13 KB**。
  - IMPLEMENTATION.md 里的 35 KB 只算了 GLB（约 22 KB）、贴图和 effect 源码（约 6 KB），没算代码和编译后的 shader。
  - 用同一口径（资源本身）对比：现在资源 0 B，effect 源码 12.5 KB。
- 还能再省的办法（这次没做）：
  - 把桥面和两端合成一个 ubershader：约 −6 KB；
  - 把地面表从 21×21 缩到 17×17：约 −1.5 KB。
- 包体门槛 24,641,536 B 不受影响（production-integrity 通过）。
- 估算脚本：`size/size.cjs`；结果：`size/size.txt`。

## 4. 测试结果
- 日志：`suite/node22.log`、`suite/node20.log`；完整 reports 目录在 `suite/reports-n22/`、`suite/reports-n20/`。
- 两个新测试单独跑的输出：`tests/`。
- 和基线 fd1a39d 对比（基线日志：`suite/baseline-node22.log`、`suite/baseline-node20.log`）：结果见文末。

## 5. Mac 上需要实机确认的项目（请截真图）

**我这边做不了的**：真正的 Creator 3.8.8 导入编译、真实 GPU 或手机渲染。

**截图清单**：
1. **导入**：Creator 3.8.8 导入两个 `.effect` 没有报错或警告；构建 WeChat 后 effect 正常加载，控制台没有 `[QF_RAINBOW]`。
2. **白天 / 夜晚**：岛→草地、岛→湖边两段，各截白天、夜晚两张，对比概念图。
   - 应该明亮、偏粉彩，不是"彩虹滑梯"。
   - 夜晚比白天暗，不能过曝。
3. **透明**：桥下的水面和草地能透过桥面看到（近景、远景各一张）。
4. **白色光缝**：桥面上没有横向白缝，包括 MSAA/FXAA 开和关两种情况。
5. **端部**：岛端、草地端、湖边端的花瓣溶解自然；光晕贴地，不浮空也不穿地；花和花瓣不在路上，也不在她脚下。
6. **粒子数量**：每段 88 个（数一下，或者看 profiler 里的顶点数：88×4）。
7. **DC**：桥面 1 个，整段桥合计 3 个（看 profiler 的 DC 差值，旧版是 7）。
8. **WebGL1 深度**：在 WebGL1 设备上，或强制 WebGL1、关掉 OES_standard_derivatives，看端部薄片、光晕和地面之间有没有 z-fighting 或闪烁；桥面在没有导数扩展时也能正常显示，此时是平滑法线。
9. **岛端落地**：岛端舌头贴着岛面，悬崖一侧看不到桥底悬空；她从 exit_path_17 走上桥时没有台阶感。
10. **排序**：桥和玻璃招牌（glass-sign）重叠时的绘制顺序可以接受；雾效对桥的影响，见下面的问题 2。

## 6. 还没解决的问题
1. 需要在 Mac 上用真机编译并截图（见第 5 节）。
2. 桥是 unlit，没有接入场景雾，远处可能偏亮，需要看实机。
3. 透明队列里桥的 priority 是 245，所以它会画在玻璃招牌之后；如果两者重叠出问题，需要调整 priority。
4. 天空城那段在 §8.4 定下之前没有端帽。
5. 岛面的草和石头分类是靠法线和高度启发式判断的，因为 fixture 没有按材质拆分。
6. 包体比目标多约 13 KB（见第 3 节）。
7. 场景设计部做的 GLB 端帽没有用上（改成程序化生成，并贴在真实地面上）。
