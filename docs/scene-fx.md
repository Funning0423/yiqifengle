# 场景特效：烟囱的烟 + 灯塔的光（场景特效bot）

运行时替换两处 v22 原有效果，导入的 GLB 和灯塔模型不动：

| 原来 | 现在 |
|---|---|
| `env_chimney_smoke_01..05_v22`：5 个不透明白球，跟着 12 s idle 动画走 | `fx_chimney_smoke` 下 7 个 `fx_chimney_smoke_puff_N`：面向镜头的软边烟团，往上飘，边飘边变大、变淡，按 `getWindStrength()` 往 +X 偏 |
| `env_lighthouse_beam_night_v22`：两头的硬光条，每秒 30°，看着像螺旋桨 | `fx_lighthouse_beam`：单束软边光锥，加法混合，每 20 s 转一圈（18°/s）；`fx_lighthouse_glow`：灯室光晕，光束扫到当前镜头方向时闪亮；`fx_lighthouse_seaglint`：光束扫向镜头这一侧时，海面上短暂出现的一道淡反光 |

- 代码：`render/IslandAtmosphereFxCore.ts`（不依赖引擎的数学和网格，可测），`render/IslandAtmosphereFx.ts`（cc 封装）。接入点在 `WorldFlowComponent`：`createWorld` 里新建，`applyDayNight` 里调 `setView(exterior, night)`，`lateUpdate` 里调 `advance(dt, worldCamera.node, getWindStrength())`，三处 dispose。原来的 6 个渲染器仍然导入并参与分类，只是 `enabled=false`，也从 v22 昼夜列表里移除了。
- 渲染：`builtin-unlit` 加顶点色，透明度曲线做在网格顶点上。光的部分用 technique 2（add），烟用 technique 3（alpha-blend）。不用贴图，不加新 effect，不加实时灯。新增节点都挂在场景根下的 `IslandAtmosphereFx` 里，不在模型里面。
- 昼夜（海鸥这次起）：直接读 GGbot 的 `world-r2/IslandPropsLayout.ts` `propNightWeight()`，和路牌/海面/标签同一个值；防御式：取不到、不是有限数、或和我们自己按同一规则算的副本相差超过 0.55（道具没激活、值停在屋里那一刻）时，回退到自己的副本（`IslandAtmosphereFxCore.pickNight`）。原先的说明：和 T9n 道具用同一套机制，即 `IslandPropsLayout.approachNight` 的同款函数：0.5 s 线性过渡，dt 上限 0.1 s，首帧直接对齐当前模式。光的显隐再套一层 smoothstep。白天光束、光晕、海面反光都是 0。
- 近镜头淡出：按物体在 CPU 上算。镜头在光锥（含外层雾）里面，或离锥面不到 0.6 m 时，光束 alpha 为 0；离锥面 6 m 以外恢复满值。烟团是镜头到烟团表面不到 0.25 m 时为 0，1.4 m 以外为满值。光晕是离镜头不到 1 m 时为 0。
- 闪光：每帧用主相机的实时位置算，取光束和“灯室→相机”方向的水平夹角，算 cos^16；垂直方向只要在光锥的软边范围内就算数。镜头离灯不到 5 m 时不闪光，12 m 以外闪光强度为满值（升降和下降镜头会从灯旁边掠过）。
- 点击：这些节点都没有碰撞体，也不在 `lighthouseTargets`（ext/door/interior_shell）里，所以 `hitLighthouse` 不会命中它们。
- 测试：`node tools/scene-fx/test_island_fx.cjs`（需要 QF_TYPESCRIPT_MODULE、DRACO3D；可选 CAMERA_TREE=<运镜bot worktree>、CAMERA_TRACK=<camera-track.json>）。
- 镜头轨迹检查：`node tools/scene-fx/test_camera_track_fx.cjs`。读运镜bot 导出的 `previews/运镜bot/camera-track.json`，按出门、待机、回家分别统计镜头穿入光锥和烟的帧数、屏幕平均亮度的最大跳变，以及每帧淡出系数的最大步长。
- 离线预览：`tools/scene-fx/dump_fx_frames.cjs` 用真实的 Core 逐帧导出状态，再由 `tools/scene-fx/blender_fx_preview.py` 用 Blender Cycles 复刻渲染（不是 Cocos 渲染）。

## 月亮和月光倒影带（fx_moon / fx_moon_halo / fx_moonlight_band，只在夜里）

- 节点：`fx_moon`（月盘）、`fx_moon_halo`（月晕），都是面向镜头的软边圆盘；`fx_moonlight_band` 是海面上的倒影带。三个都挂在 `IslandAtmosphereFx` 根下，用 `builtin-unlit` 加顶点色、technique 2（加法），不用贴图，不加实时灯，所以回程主光翻转对它们没有影响。没有碰撞体，不在 `lighthouseTargets` 里。
- 位置：按 `previews/运镜bot/camera-track.json` 的 `islandIdlePose`（位置 [-12,15.5,48]，fov 42，586×1266）来定。月亮放在屏幕 (0.17, 0.085)（从左上角算）那条视线方向上、离镜头 200 m 的地方，世界坐标 [19.58,17.49,-149.48]，在天空球（半径 282 m）里面。它落在地平线上方那条天空带（屏幕顶部约 19%）的中间，在灯塔/她那一列（x 0.39）的左边，避开云（`test_island_fx` 把云层顶点投影到屏幕检查过，月晕范围内一个都没有），也远离路牌（右下，x 0.62–0.82）。月盘半径 2.3 m，在 1266 高的屏幕上约 19 px；月晕半径 7.6 m。
- 倒影带：海面上的一条加法长条，高度用 `seaY`（和 seaglint 一样，GGbot 的海水材质和夜间参数都不动）。每帧从主相机脚下出发，朝“相机→月亮”的水平方向铺开（倒影跟着看的人走），16–285 m 之间的行按对数间隔排，亮暗交替成波纹；整条带每 3 s 均匀放大两行的距离，所以波纹看起来在慢慢往外漂。远端会被收在海面方块（±255 m）以内，固定机位下一直铺到地平线、正好在月亮下面。镜头离海面低于 4 m 时逐渐变淡，低于 1 m 时完全消失。屏幕上它在左边（x 约 0.18–0.24），从路牌左边过去；岛和她挡在它前面（深度测试）。
- 昼夜：`lightFromNight(propNightWeight())`，和光束是同一个值；白天权重为 0，节点设为 inactive，完全不显示。
- 原来模型里的 `env_sky_moon_night_v22`/halo（天空背景的一部分，屋里从窗户也能看到）不动。它不在岛上固定机位的画面里；按 camera-track 逐帧算，它和 fx_moon 从来不会同时出现在画面里（0/1430 帧）。
- 测试：`test_island_fx` 的 `moon-fixed-view-composition`、`moon-day-hidden-night-fade`、`moonlight-band-on-sea-safe`、`byte-budget`（terser 压缩后相对 29690bb 增加的字节数）；`test_camera_track_fx` 把月盘、月晕、倒影带算进屏幕亮度，还检查月亮离镜头 ≥100 m、倒影带近端离镜头 ≥10 m、alpha 每帧步长 <0.03。

## 海鸥（fx_gull_N）

- 替换：`env_anim_seagull_fly_01/02_v22`（各一个身体 + 两片翅膀，绕灯塔转圈）在 `WorldFlowComponent` 的 `replacedFx` 里关掉（现在一共 12 个渲染器）；`IslandAtmosphereFx` 下的 `fx_gulls` 里放 6 只 `fx_gull_N`（`fx_gull_N_body`、`fx_gull_N_wing_L/R`），直接用 fly_01 的三块网格和 M_env_palette 的一份拷贝（拷贝只用来乘夜色，原调色板不动）。沙滩上站着的 `env_anim_seagull_01` 不动。没有新网格、贴图、音频。
- 代码：`render/GullFlockCore.ts`（不依赖引擎：航线、叫声对接、姿态），`render/GullFlock.ts`（cc 封装）。
- 行为：每只海鸥只有三种状态：画面外待命（off）、飞（一串三次 Hermite 段）、落脚（perch）。所有航线都从当前画面外开始、到画面外结束。路线随机：穿过画面（1–2 个画面内路点，各自深度不同，有横穿、远去、靠近、绕弯）、掠海滑翔（只在俯视的岛上机位：降到海面上 0.7 m 滑 12 m 再爬升）、落脚（屋脊两处、东边栅栏两根桩、西边栅栏一根桩；不落灯塔、不落路牌）。落脚后歇 5–12 s（夜里 30–70 s），女主走近 2.4 m 或镜头走近 2.6 m 就飞走。白天同时出来 4–5 只（画面里通常 2–4 只），夜里 1–2 只、多数落着休息，颜色在岛的夜光之外再乘 (0.74, 0.80, 0.94)，按夜间权重插值。始终留至少一只在画面外待命，给提前量很短的近处叫声用。
- 避让：每个采样点（每秒 30 个，规划时外扩 0.25 m）都要离开灯塔圆柱、房子、五棵树、地面（岛上低于 1.6 m 不行；岛上普通飞行要高于 7.5 m）、路牌立柱 ≥ 2 m（+1 m 立柱半径）、女主 ≥ 1 m；离镜头规划 ≥ 1.6 m（近处那只 ≥ 2.0 m，按镜头速度预测 1.5 s），每帧再硬性推到 ≥ 1.05 m。
- 点击：没有碰撞体、没有 UI 组件，不在 `lighthouseTargets` 里；路牌和底排三个按钮走屏幕矩形命中，3D 渲染器挡不住。
- 叫声（Voice bot `AmbienceAudio`，按 4a8c474 的 docs/audio-events.md；fbee3d5 也兼容）：每帧探测 `__worldIntegration.onGullCall`，出现、换对象时重新订阅（旧的取消）；没有接口时照常随机飞。`yawWorldDeg` 方向 = (sin y, 0, cos y)，以女主（`FLOW_REFERENCE_PLACEHOLDER_NOT_B`）为中心。
  - near `scheduled`：订一只画面外的海鸥（没有就用离镜头最远、正在飞的那只），不提前飞出来。
  - near `start`：按当时的镜头（含速度和转向预测）重新规划：声音方向在镜头前方时，从那一侧贴着镜头旁边进画，在镜头前 2.5–5 m 斜着往景深里飞，画面里停留约 1.5 s，然后爬升离开；方向在镜头背后时，从镜头侧上方越过肩膀进画。所以不依赖提前量（0 s、0.4 s、1.7 s、2.5 s 都一样）。
  - `cancelled`：放掉预订；还没出来的就继续待命。`start` 之后的 `cancelled`（近处那声抢位置、远处那声淡出）不需要处理：远处的海鸥本来就没被预订，照常飞走。
  - far：画面里没有海鸥时，派一只从声音那一侧远远飞过（只在至少还有两只待命时，留一只给紧跟着的近处叫声）。
  - 落到画面里的栅栏/屋脊时有 45% 概率 `requestGullCall('far', 方位)`；岛上机位有一只近距离飞过镜头时 50% 概率 `requestGullCall('near', 方位)`。
- 测试：`node tools/scene-fx/test_gulls.cjs`（落脚点贴合 GLB、固定机位白天/夜里数量与种类、静态避让、camera-track 逐帧镜头距离、近处叫声入画率、取消/无接口降级、cc 封装探测与节点名、字节）；`node tools/scene-fx/test_gulls_voice.cjs`（和 Voice bot 真实 AmbienceAudio 联调，默认读 git 对象 4a8c474，退回 fbee3d5；或 VOICE_REF / VOICE_AMBIENCE=<文件>；取不到时 SKIP）。
- 预览：`tools/scene-fx/dump_gull_frames.cjs` 导出真实 Core 的逐帧姿态，`blender_fx_preview.py` 复刻渲染（Blender Cycles，非 Cocos；画面里没有女主角色模型）。
