# 场景特效：烟囱的烟 + 灯塔的光（场景特效bot）

运行时替换两处 v22 原有效果，导入的 GLB 和灯塔模型不动：

| 原来 | 现在 |
|---|---|
| `env_chimney_smoke_01..05_v22`：5 个不透明白球，跟着 12 s idle 动画走 | `fx_chimney_smoke` 下 7 个 `fx_chimney_smoke_puff_N`：面向镜头的软边烟团，往上飘，边飘边变大、变淡，按 `getWindStrength()` 往 +X 偏 |
| `env_lighthouse_beam_night_v22`：两头的硬光条，每秒 30°，看着像螺旋桨 | `fx_lighthouse_beam`：单束软边光锥，加法混合，每 20 s 转一圈（18°/s）；`fx_lighthouse_glow`：灯室光晕，光束扫到当前镜头方向时闪亮；`fx_lighthouse_seaglint`：光束扫向镜头这一侧时，海面上短暂出现的一道淡反光 |

- 代码：`render/IslandAtmosphereFxCore.ts`（不依赖引擎的数学和网格，可测），`render/IslandAtmosphereFx.ts`（cc 封装）。接入点在 `WorldFlowComponent`：`createWorld` 里新建，`applyDayNight` 里调 `setView(exterior, night)`，`lateUpdate` 里调 `advance(dt, worldCamera.node, getWindStrength())`，三处 dispose。原来的 6 个渲染器仍然导入并参与分类，只是 `enabled=false`，也从 v22 昼夜列表里移除了。
- 渲染：`builtin-unlit` 加顶点色，透明度曲线做在网格顶点上。光的部分用 technique 2（add），烟用 technique 3（alpha-blend）。不用贴图，不加新 effect，不加实时灯。新增节点都挂在场景根下的 `IslandAtmosphereFx` 里，不在模型里面。
- 昼夜：和 T9n 道具用同一套机制，即 `IslandPropsLayout.approachNight` 的同款函数：0.5 s 线性过渡，dt 上限 0.1 s，首帧直接对齐当前模式。光的显隐再套一层 smoothstep。白天光束、光晕、海面反光都是 0。
- 近镜头淡出：按物体在 CPU 上算。镜头在光锥（含外层雾）里面，或离锥面不到 0.6 m 时，光束 alpha 为 0；离锥面 3.5 m 以外恢复满值。烟团是镜头到烟团表面不到 0.25 m 时为 0，1.4 m 以外为满值。光晕是离镜头不到 1 m 时为 0。
- 闪光：每帧用主相机的实时位置算，取光束和“灯室→相机”方向的水平夹角，算 cos^26；垂直方向只要在光锥的软边范围内就算数。
- 点击：这些节点都没有碰撞体，也不在 `lighthouseTargets`（ext/door/interior_shell）里，所以 `hitLighthouse` 不会命中它们。
- 测试：`node tools/scene-fx/test_island_fx.cjs`（需要 QF_TYPESCRIPT_MODULE、DRACO3D；可选 CAMERA_TREE=<运镜bot worktree>、CAMERA_TRACK=<camera-track.json>）。
- 离线预览：`tools/scene-fx/dump_fx_frames.cjs` 用真实的 Core 逐帧导出状态，再由 `tools/scene-fx/blender_fx_preview.py` 用 Blender Cycles 复刻渲染（不是 Cocos 渲染）。
