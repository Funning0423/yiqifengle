# 场景特效bot → 本地 Cursor 交接（2026-10-11）

- 正本：`/workspace/yiqifengle/handoff/20261011-场景特效bot-to-local-cursor.md`；仓库里的 `docs/handoff-scene-fx.md` 是同内容副本。
- 分支 `work/场景特效bot`（另有指针 `handoff/场景特效bot` 指向同一提交），worktree 在 `/workspace/yiqifengle/work/场景特效bot`。最终 SHA 以同目录 `README.md` 为准。
- 提交链：交接文档/QA 脚本 ← `456c37d` 海鸥翅膀修正 ← `b6f2572` 月光 v3 ← `11a1bac`（当时的 int/v1）。这几个提交还没合入 int/v1。
- 场景只有《咦，起风了》的小岛。行为细节见 `docs/scene-fx.md`。

## 1. 负责的特效和文件

| 特效 | 节点 | 代码 |
|---|---|---|
| 烟囱烟 | `fx_chimney_smoke` / `fx_chimney_smoke_puff_N` | `IslandAtmosphereFxCore.ts` `smokePuffs()`、`discGeometry()` |
| 灯塔光柱 | `fx_lighthouse_beam`、`fx_lighthouse_glow`、`fx_lighthouse_seaglint` | `beamGeometry()` `beamState()` `beamCameraFade()` `flashWeight()` `glintGeometry()` |
| 海鸥 | `fx_gulls` / `fx_gull_N`（`_body`、`_wing_L/R`），共 6 只 | `GullFlockCore.ts`（不依赖引擎）+ `GullFlock.ts`（cc 封装） |
| 月亮和碎波光倒影 | `fx_moon`、`fx_moon_halo`、`fx_moonlight_band_0..2` | `moonState()` `bandGeometry(layer)` `noise1()` |

所有文件都在 `creator-build-project/assets/scripts/render/` 下：
- `IslandAtmosphereFxCore.ts`：纯数学和几何，不 import `cc`，参数都在 `ISLAND_FX`。
- `IslandAtmosphereFx.ts`：cc 组件层。建节点、`utils.createMesh`、`builtin-unlit` 材质（光柱、月亮、碎波光用 technique 2 加法；烟用 technique 3 alpha-blend；海鸥翅膀用 technique 0 opaque），每帧摆位置，读昼夜权重，持有 `GullFlock`。
- `GullFlockCore.ts`：海鸥的航线、落脚、叫声对接、姿态、翅膀几何。参数在 `GULL_FX`。
- `GullFlock.ts`：海鸥的 cc 封装。负责防御式探测叫声接口、生成翅膀网格和材质。

工具在 `tools/scene-fx/` 下：`test_island_fx.cjs`、`test_camera_track_fx.cjs`、`test_gulls.cjs`、`test_gulls_voice.cjs`、`gull_sim.cjs`（测试和预览共用的加载器和 AmbienceAudio 桩）、`dump_fx_frames.cjs`、`dump_gull_frames.cjs`、`blender_fx_preview.py`、`make_fx_video.py`。文档：`docs/scene-fx.md`（行为细节）和本文。

- 一次性的 QA 小脚本放在 `tools/scene-fx/qa/`：`compare_gull_wings.py`（拼 gulls-v2 对比图）、`inspect_gull_mesh.py` / `inspect_gull_wing_uv.py` / `sample_gull_palette.py`（查出翅膀问题用的 GLB 检查脚本）、`moon_screen_projection.py`（月亮定位）、`inspect_sea_material.py`、`render_island_top.py`。
- 没有自定义 shader，全部用引擎自带的 `builtin-unlit`。也没有 .blend 源文件：预览场景每次由 `blender_fx_preview.py` 从 `combined_visual_m.glb` 现搭。

## 2. 架构

- **分层**：Core 层是纯函数和类，Node 里直接能测。组件层只做引擎粘合。测试先用 TypeScript 转译 Core 再跑；`test_gulls` 的第 6 项会 mock 掉 `cc`，把 `GullFlock.ts` 也跑一遍。
- **接入 `world-r1/WorldFlowComponent.ts`**（T0 白名单文件，当前 sha256 `b96d4d93…`，这次没改）：
  - 第 7 行 import。
  - 约第 278 行 `replacedFx`：关掉 GLB 里的旧节点，共 12 个渲染器，数量不对会 throw。旧节点包括 `env_lighthouse_beam_night_v22`（旧光柱条）、`env_chimney_smoke_01..05_v22`（旧烟球），以及 `env_anim_seagull_fly_01/02_v22` 和它们的 `_wing_L/R`（绕圈海鸥）。同时把它们从 v22Day/v22Night 列表里移除。
  - 约第 309 行 `new IslandAtmosphereFx(scene)`。
  - `lateUpdate` 里 `atmosphere.advance(dt)`；约第 418 行 `setView(exteriorVisible, night)`；dispose 时一起释放。
  - 沙滩上站着的 `env_anim_seagull_01` 和天上的 `env_sky_moon_night_v22` 都没动（月亮在镜头里不会和它同框）。
- **渲染**：全部是 unlit，不加实时灯，不加贴图，不碰海水材质，也不写 `env_sea_surface` 的 mainColor。海面上的效果都是独立的叠加层。回程主光翻转不影响这些效果。
- **点击**：不挂碰撞体，不挂可点组件，不进 `lighthouseTargets`。`test_gulls` 会检查源码和 `hitLighthouse`。

## 3. 关键参数在哪里调

- 烟：`ISLAND_FX.smoke`（数量、寿命、上升、风偏、昼夜颜色）。
- 光柱：`ISLAND_FX.beam`（`periodS` 20 s 一圈、倾角、半径、alpha、近相机淡出距离）、`glow`（扫到镜头时的闪光）、`glint`（海面反光，强度刻意压低）。
- 月亮：`ISLAND_FX.moon`（位置在 200 m 外，按 camera-track 岛上机位的屏幕位置 (0.17, 0.085) 来定）。
- 碎波光：`ISLAND_FX.band`。
  - `count` 1300、`farHalfDeg`/`nearHalfDeg` 0.95/7.2（光路宽度）、`lenDeg`、`streak`。
  - `gain` 1.7（亮度）、`frontM`/`frontFloor`（岛前压暗到 42%）。
  - `twinkle` [2.1, 2.8, 3.4]：再调高会超过 test_camera_track_fx 的 alpha 步长上限 0.03。
- 海鸥：`GULL_FX`。
  - `count`、`size`；`perches`（落脚点，不在灯塔和路牌上）。
  - `camClearM` 1.0、`planClearM`、`sign`（路牌避让，坐标和 `world-r2/IslandPropsLayout.ts` 一致）。
  - `near`（近处飞过）、`restS`/`offS`/`chance`（昼夜频率）、`flap`、`nightTint`。
  - `farBoost`/`farM`：远处放大，16–42 m 渐变到 1.6 倍。
  - `wing`：翅膀颜色、上拱、夜间系数。`faceDeg` 14：防侧对的微转角。

## 4. 对外接口和依赖

- **昼夜**：`world-r2/IslandPropsLayout.ts` 的 `propNightWeight()`（GGbot 维护，0 是白天，1 是夜里，0.5 s 线性过渡）。防御式读取，取不到或不是有限数时，退回自己的复制版 `approachNight`/`pickNight`。光照强度经过 `lightFromNight()`（smoothstep）。注意它只在岛上道具激活时更新。
- **叫声**：`__worldIntegration.onGullCall(cb)`，返回取消订阅函数；另有 `requestGullCall(dist, yawWorldDeg)`、`gullClock()`。实现是 Voice bot 的 `AmbienceAudio`，见 `docs/audio-events.md`。
  - 用防御式探测，不 import 它的模块；接口不存在时，海鸥照常自己随机飞。
  - `phase`：
    - `scheduled`：订一只画面外的海鸥（near）。
    - `start`：按当时的真实镜头重新规划航线，从 `yawWorldDeg` 那一侧飞过镜头附近（≥1.0 m，并且入画）。这个方向在镜头背后时，改从侧上方入画。
    - `cancelled`：同 id 之后不会再有 start。没出场的那只放掉预订；已经出场的照常飞走。
  - 字段：`leadS`（提前量，0–2.5 s，按字段动态处理，不要写死）、`dist`、`distM`、`kind`。`yawWorldDeg` 的 0° 是 +Z，90° 是 +X。
- **镜头轨迹**：`previews/运镜bot/camera-track.json`，可以用环境变量 `CAMERA_TRACK=` 换成别的文件。已合入版本对应的是 `camera-track.e3863fb.json`（sha256 `4ec8f72a…`）；`camera-track.json` 是运镜bot 还没定稿的版本，一直在改：`99ba1183…` 那版测过，全部通过；交接时已经变成 `38aa91db…`，用它跑 test_camera_track_fx，回程那段不通过（见 10.6）。test_gulls 用三版都通过。
- **路牌**：位置取自 `IslandPropsLayout.ts`，海鸥离它 ≥2 m，掠海那只不穿过它。GGbot 在回程会整段隐藏路牌，海鸥不依赖路牌节点。

## 5. 测试

```bash
export QF_TYPESCRIPT_MODULE=/workspace/yiqifengle/work/GGbot/tools/vendor-node/node_modules/typescript   # Mac 上改成本机的 typescript 路径
N=/workspace/yiqifengle/work/GGbot/tools/vendor-node/node-runtime/node-v23.11.0-linux-x64/bin/node          # 需要 Node ≥ 23（stripTypeScriptTypes）
$N tools/scene-fx/test_island_fx.cjs        # 烟/光柱/月亮/碎波光的几何、昼夜、包体（24 项）
$N tools/scene-fx/test_camera_track_fx.cjs  # 按 camera-track 逐帧：镜头穿光锥/烟、亮度跳变、月亮/倒影距离和 alpha 步长（4 段）
$N tools/scene-fx/test_gulls.cjs            # 海鸥 11 项：落脚、数量、避让、镜头 ≥1 m、叫声入画、翅膀、包体
$N tools/scene-fx/test_gulls_voice.cjs      # 和真实 AmbienceAudio 的叫声契约
$N tools/test_manifests.cjs --write && $N tools/test_manifests.cjs   # 改了文件就刷新清单，再不带参数复跑
```

可加 `--json out.json`。terser 从 `TERSER_MODULE` 或 `/tmp/terser/node_modules/terser` 找；找不到时按未压缩字节计。全套回归还包括 es5_safety、camera_frames、sit_timing、island_props、composition、audio_unlock、gull_events、wind_audio、scene_bgm、walk_driver、anim_eval_order、first_screen、action_clock、startup_gate、door_spill、room_light_blend、t0_hooks、wind_api、window_view_night。这台机器上有 3 项本来就跑不起来，和这次改动无关，在 11a1bac 上一样：test_world_camera_audit 和 test_world_navigation_guard 缺 Playwright，cloud-skycity/test_navigation_integration 报 StartupLoadingLayer 未定义。

## 6. 预览渲染（离线复刻，不是 Cocos 渲染）

1. 导出逐帧数据：`dump_fx_frames.cjs`（烟、光柱、月亮）或 `dump_gull_frames.cjs island|exit …`（exit 模式的参数是 `seed leadS night`）。
2. 渲染：`blender -b --factory-startup -P tools/scene-fx/blender_fx_preview.py -- frames.json out_dir [宽 高 采样 每隔几帧]`。用 Cycles CPU 加一盏太阳光近似，FX 网格和 alpha 直接来自真实 Core。
   - `FX_SEA_SPEC=0`：关掉预览里太阳打在海面上的高光（游戏里没有，夜景要关）。
   - `FX_DENOISE=0`：关降噪。
   - `FX_SHADOW=1`：开阴影。
3. 出视频：`python3 tools/scene-fx/make_fx_video.py frames.json out_dir out.mp4 标题 [每隔几帧]`，会在每帧上标注。
4. 预览放在 `previews/场景特效bot/<主题>/`，不进仓库。

## 7. 包体（terser 压缩后的 ES5）

- 烟、光柱、月亮、碎波光：`IslandAtmosphere*` 约 18.8 KB，比 29690bb 多 4.1 KB（月亮和碎波光部分），在 10 KB 预算内。
- 海鸥：`GullFlock*` 共 23.9 KB（456c37d；翅膀修正前是 21.0 KB，加了 +2.9 KB），超过 10 KB 预算。Grok Bot 已经定了暂不压缩，以后要压的话，别改行为。
- 没有新资源，没有贴图。运行时网格：碎波光约 6500 个顶点、3 个网格；海鸥翅膀 2 个网格，6 只海鸥共用。

## 8. 清单和 T0 白名单

- 改了任何文本文件，提交前跑 `node tools/test_manifests.cjs --write`，把 `text-MANIFEST-SHA256.json` 一起提交，再不带参数复跑，确认 `problems: []`。
- 改到 T0 白名单文件（比如 `WorldFlowComponent.ts`）时，交付里报新 sha256，给 GGbot。当前是 `b96d4d93e5d2db8545ec8efa64bf218d86994bdef43e3e2106fc5a90fb65d735`。
- 交付时列出 `creator-build-project/` 下每个改动文件的 sha256。

## 9. 不进仓库的大文件（箱子上的绝对路径）

| 文件 | sha256 |
|---|---|
| /workspace/yiqifengle/previews/场景特效bot/moon-v3/moon_v3_day_night.mp4 | ae085cbf3cd067c2316877144bad203492705f50b1d8939681e17b23fb97b969 |
| /workspace/yiqifengle/previews/场景特效bot/moon-v3/compare_v1_v2_v3.png | 7bf4c2f74d2abba0cc20edaa800153dd86cefa304ac9a7a95338d8cc8bd28ee8 |
| /workspace/yiqifengle/previews/场景特效bot/moon-v3/compare_zoom_1to1_v1_v2_v3.png | 278d14811709efbe2d731810e4aa8f65417518d7d9e713c253d2724bf8489447 |
| /workspace/yiqifengle/previews/场景特效bot/moon-v3/key_night_t8.0_v3.png | 0892adaa950df1e26cad6003e98fb4ea2a8759fa90589c0db2338e1010ecb467 |
| /workspace/yiqifengle/previews/场景特效bot/moon-v3/src/moon_v3_day_night_frames.json（视频的逐帧输入） | 0ea6faab733098af5a5fb7f740fd18dfca88d243b9997c46416dd42ad5fea891 |
| /workspace/yiqifengle/previews/场景特效bot/gulls-v2/compare_near_gull_day.png | e918c9d3227bcfc9a593d47c7a3dde67c932ebe6434392126b4aa4ea4ba1c393 |
| /workspace/yiqifengle/previews/场景特效bot/gulls-v2/compare_near_gull_night.png | 8499370513b317f9fe2de5685002208a876dbcef8008859c73d4408586cc163f |
| /workspace/yiqifengle/previews/场景特效bot/gulls-v2/compare_island_far_gulls_day.png | 3a680db536070c272d2a671cd2402d7d14de445da298a879d274327405e7cd3e |
| /workspace/yiqifengle/previews/场景特效bot/gulls-v2/src/*_sel.json（对比图的逐帧输入） | 见目录 |
| /workspace/yiqifengle/previews/场景特效bot/gulls/gulls_island_day_night.mp4 | e1e0f91ebed8b2212b5f39a9ab2f7d7cb9fb18b7b26c67979c017169bf5c1ce0 |
| /workspace/yiqifengle/previews/场景特效bot/lighthouse_day_night.mp4 | ca99d538d40be545e95ab1eb78407c123253af5578ae56b4bac041a9b6efde46 |
| /workspace/yiqifengle/previews/场景特效bot/smoke_day_night.mp4 | cea06f7fb24f1d9b2fb1a9dfdf49b9800f3337da2924f3dfdd67a4d84add47f8 |
| /workspace/yiqifengle/previews/运镜bot/camera-track.e3863fb.json（已合入版轨迹） | 4ec8f72a695609cfb59d1a03599cc86f0eda9b568ae6a8ed1c1f28ba19435939 |
| /workspace/yiqifengle/previews/运镜bot/camera-track.json（运镜bot 未定稿，交接时的版本） | 38aa91db09e0da203ab16e1f6d1f0e914b6a051c50e4e51d81a47cb9dcb9ce77 |
| /workspace/yiqifengle/evidence-mac/r4-29690bb/day-near-gull-underwing-crop.jpg（Mac r4 黑翅膀截图） | 04b81bd3396941709b3bd0053965b965c6f17132505aded62ff437dfedc6a283 |
| creator-build-project/assets/bundles/region_island/combined_visual_m.glb（在仓库里，没改） | 77bff8b3cb33c92a43cb02a4ad00f0f8e65f07e07052b9c870bea171194a9748 |

最终版的预览已经打进 handoff 目录的 tar 包。中间帧在 `/tmp/fxbot/`（gv2、moon3 等），可以重新生成，不保留。

## 10. 待办（每项写了现状、验收标准、要跑的测试、坑）

### 10.1 海鸥翅膀近黑：已修好，待 Mac/真机验收
- **现状**：`456c37d` 修了。
  - **原因**：GLB 的翅膀片是两层平面。朝上那层用调色板的深棕色格子 (53,43,35)；朝下那层是白色，但法线朝下、背着太阳，被光照算成黑色。所以游戏里从下面或侧面看，翅膀几乎是黑色细条。
  - **修法**：
    - 新增运行时翅膀网格 `wingGeometry()`：翼展和弦长和原来一样，带 4.5 cm 上拱；两面各自建三角形、各自朝外，不改剔除状态。
    - 材质改成 `builtin-unlit` 顶点色：上面浅灰、翼尖渐深，下面白灰。unlit 等于自带补光。
    - 夜里用 `wingTint(propNightWeight)`：海鸥夜色 × 0.5。
    - 防侧对：飞行中，翅膀平面和视线夹角小于 14° 时，身体微转（只改姿态，不改航线）。
    - 拿不到 builtin-unlit 时，退回 GLB 翅膀片。
  - Blender 修前/修后对比在 `previews/场景特效bot/gulls-v2/`。
- **验收标准**：
  - Mac/真机白天：近处海鸥飞过（出门近处叫声那一刻，约 v42 秒；岛上近处飞过），翅膀是白灰或浅灰，不是黑条。
  - 夜里翅膀和身体一样暗、偏冷，不发亮。
  - 侧对镜头时，翅膀仍能看出是一片，而不是一根线。
  - 防侧对微转看着不抽搐。
  - 回程主光翻转 0.6 s 时，翅膀没有变化。
- **要跑的测试**：
  - `test_gulls`（`wings-bright-two-sided`：两面朝向、下面亮度 ≥ 0.75、侧视厚度 ≥ 2 cm、夜色、mock 封装、12 m 内入画帧夹角 < 4° 的比例从 9.5% 降到 2.2%）。
  - `test_gulls_voice`、`test_camera_track_fx`、`test_es5_safety`、`test_manifests`。
- **坑**：
  - Cocos 默认剔除背面。两面网格的绕序靠代码按法线自动决定，改顶点时别手排。
  - unlit 的顶点色在 LDR 下就是显示值。预览脚本已经做了 sRGB→linear 转换，自己出图时别重复转。
  - 身体仍是受光的调色板材质，翅膀是 unlit。如果真机上两者明暗差太大，调 `GULL_FX.wing` 的颜色或 `night`。
  - 6 只海鸥共用一个翅膀材质，不要对单只设颜色。

### 10.2 月光倒影 v3（碎波光）：Funning 已确认，已提交，待真机验收
- **现状**：`b6f2572`。
  - 3 个网格共 1300 片柔边波光，用 unlit 加法，没有贴图，三层错开闪烁。
  - 远处窄、密、亮；近处宽、散、暗；岛前面压到 42%；白天隐藏。
  - 白天→夜里视频在 `moon-v3/moon_v3_day_night.mp4`，6 fps，每 2 帧渲染一张。
- **验收标准**：
  - 手机上远处和中段的光路一眼可见。
  - 边缘碎开，不是白条，也没有直线边。
  - 岛前面只有零星碎光。
  - 0.5 s 昼夜过渡里不跳。
  - 镜头升降时离镜头 ≥ 10 m（实测最近 22.9 m），alpha 每帧变化 < 0.03（实测 0.0215）。
  - 长时间看没有循环感或接缝。
- **要跑的测试**：`test_island_fx`（`moonlight-glitter-geometry`、`moonlight-glitter-twinkle`、`moonlight-band-on-sea-safe`、`byte-budget`）、`test_camera_track_fx`、`test_manifests`。
- **坑**：
  - 预览里太阳打在海面上的高光游戏里没有，夜景要用 `FX_SEA_SPEC=0`，否则会多出一道假的光柱。
  - 闪烁频率调高，就会超过 `maxBandAlphaStep` 0.03。
  - 3 个 draw call。要合成 1 个就得写自定义 shader，在 shader 里按时间闪烁；改之前先确认包体和引擎版本（Creator 3.8.8）。
  - 绝不能写 `env_sea_surface` 的 mainColor（那是 GGbot 夜海用的）。
  - v1 的 3 秒循环接缝问题，换成三层正弦闪烁后理论上没有了，但还没在真机上长时间看过。

### 10.3 草原、天空之城样片：没开始
- **现状**：只找到了需求出处。
  - `inputs/1fWACke-…md` 的 E、F 节：草甸保留开阔绿坡、柔和光和风吹草浪；天空保留云海、巨型机器人、层次空间；云影用 UV/材质方案，不要一整张透明覆盖层。
  - `inputs/asset-contract-v2.json` 里天空之城的美术验收优先级最高。
  - 草原还没有模型。天空之城有 `env_skycity.glb`（云海、积云、飞鸟、星环）。
  - 按派发方指示，等通知再动。
- **验收标准**：先整理出 `REQUIREMENTS.md`，交给 Funning 确认，再出样片。样片要求：同样只用 unlit 或材质，不加实时灯；包体可控；有离线预览图或视频。
- **要跑的测试**：届时仿照 `test_island_fx` 新写一个（几何、昼夜、包体），再跑 `test_es5_safety` 和 `test_manifests`。
- **坑**：
  - 草原没有模型，要先和建模那边确认由谁出。
  - 云影不许用整张透明覆盖层。

### 10.4 烟“动不动”：待验
- **现状**：烟是 `fx_chimney_smoke`，烟团上升、受风偏、按寿命淡出。Mac r4 说“基本过了”，但真机上是不是动得够明显，还没专门看。
- **验收标准**：在岛上固定机位的手机画面里，10 秒内能明显看到烟上升、飘散；风大时更斜；夜里颜色跟着夜色走，不发亮。
- **要跑的测试**：`test_island_fx`（烟的检查）、`test_camera_track_fx`（镜头穿过烟、亮度跳变）。
- **坑**：
  - 参数在 `ISLAND_FX.smoke`。加快上升或加大尺寸以后，要复跑 camera-track 的穿入检查（出门、回程镜头会经过烟囱附近）。
  - 烟用 alpha 混合，叠多了会发灰。

### 10.5 远处海鸥只有约 5 px：已加放大，待真机验收
- **现状**：`456c37d`。离镜头 16 m 以内大小不变，16–42 m 平滑放大到 1.6 倍。只改显示大小，航线、离镜头 ≥ 1.0 m、路牌避让都不变。对比图见 `gulls-v2/compare_island_far_gulls_day.png`。注意这张图修前修后不是同一次飞行，因为 island 导出用了 Math.random 安排叫声。
- **验收标准**：手机上远处海鸥约 8 px 以上，能认出是鸟，但不显得突兀、不像玩具；近处海鸥大小没变。
- **要跑的测试**：`test_gulls`（`farBoost`：16 m 内倍数为 1，42 m 外为 1.6）、`track-camera-clearance`。
- **坑**：
  - 放大只看离镜头的距离，靠得近的落脚海鸥不放大。
  - 想再大，就调 `GULL_FX.farBoost` 或 `farM`。放大可能让远处海鸥和路牌、灯塔在画面上看着重叠（实际没有碰撞），调完要看看岛上固定机位的画面。

### 10.6 新轨迹 38aa91db 下，回程光柱 alpha 步长超限：待定稿后再处理
- **现状**：运镜bot 交接时的未定稿轨迹 `camera-track.json`（38aa91db）上，`test_camera_track_fx` 的 return 段不通过：`maxBeamAlphaStep` 0.0371，上限 0.03，出现在 t=24.65 s 附近。光柱在近相机淡出时，单帧变化太快。不在光锥里的帧数仍然是 0（`maxBeamAlphaInsideCone`=0）；平均亮度跳变 0.0024，没超。11a1bac 用同一条轨迹也不通过，所以不是这次改动造成的；已合入的 4ec8f72a 那版全部通过。
- **验收标准**：运镜bot 定稿后，用定稿轨迹跑 `test_camera_track_fx`，4 段全部通过。
- **要跑的测试**：`CAMERA_TRACK=<定稿轨迹> node tools/scene-fx/test_camera_track_fx.cjs`，再跑 `test_gulls`。
- **坑**：
  - 修法优先给 `IslandAtmosphereFx` 的光柱 alpha 加每帧限速（比如每帧最多变 0.025），而不是放宽测试阈值。
  - 也可以加宽 `ISLAND_FX.beam` 的近相机淡出区间。
  - 改完要复看光柱扫到镜头时的闪光（`flashWeight`），别把闪光也一起压平了。

### 10.7 其他
- 海鸥代码包体 23.9 KB，超过 10 KB 预算。Grok Bot 已经定了暂不压缩。
- 消除和 combo 特效：等 UI 定稿后再做。
- 预览都是 Blender 离线复刻，不等于 Cocos 画面，以真机为准。

## 11. 协作规则

- 只在 `work/场景特效bot` 提交。基于最新 int/v1 变基；int/v1 由主控合并，不要自己推。
- 交付时报：分支、SHA、改动文件 sha256、T0 白名单文件是否有变、已测和未测、预览路径和制作方法。
- 预览放 `previews/场景特效bot/`，不进仓库。
- 不要直接在群里发消息，也不要直接联系其他 bot。结果交给派发方。
