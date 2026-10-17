# 风铃湖畔 r5h3 → 引擎颜色参考（给 Voice Bot）

对照图：`compare_r5h3_vs_engine.jpg`（同机位，左 r5h3 调色前，中 r5h3 调色后，右 引擎 v3.2）。
原始数值：`work/samples.json`；采样脚本：`work/sample.py`；对照图脚本：`work/make_compare.py`；Blender 读出：`work/inspect_r5h3.json`。

## 0. 先看哪一列
- 引擎湖畔相机现在是 `camera.usePostProcess=false`（`LakesideBoardBackground.ts` 第 177 行），所以 **LUT / Bloom / 暗角都没有叠**。这种情况下引擎画面要对 **「调色前」** 一列。
- 以后开了后处理（LUT `post/T_LK_grade_lut_32.png` + Bloom 0.72 + 暗角 0.28），**场景本身仍然对「调色前」**，叠完后处理的最终画面再对 **「调色后」**。
- 调色后 = 调色前 × 饱和 1.35 × 对比 1.12 + 暖色泛光 + 暗角（画面四角最多压暗到 0.72）。所以底部角落的「调色后」值偏暗是暗角造成的。Voice Bot v3.3 拟合的目标 66/152/146 是**调色后、带暗角**的左下角值；没有后处理时应该对调色前的 **86/144/139**（左下角）或 **76/136/136**（底部中间）。

## 1. 采样点与目标颜色（sRGB 8bit，720×1280 竖屏坐标）
r5h3 值 = 8 秒成品视频 24 帧（每 4 帧取 1）逐像素时间中位数，再取框内中位数，波光和棋子动画都被滤掉了。引擎值 = Mac v3.2 截图单帧框内中位数。

| 区域 | 方框 x0,y0–x1,y1（屏幕百分比） | r5h3 调色前（引擎现在对这个） | 线性值 | r5h3 调色后 | 引擎 v3.2 layered | 引擎 v3.2 off |
|---|---|---|---|---|---|---|
| 远水（远岸下方） | 250,342–470,362（35–65%, 27–28%） | **92/90/84** | 0.107/0.102/0.089 | 92/88/80 | 218/185/154 | 219/180/135 |
| 中段水（桥上方，条纹带处） | 260,400–460,450（36–64%, 31–35%） | **86/115/118** | 0.093/0.171/0.181 | 77/120/126 | 180/176/177 | 155/170/176 |
| 中段水右侧 | 500,410–700,460（69–97%, 32–36%） | **113/142/135** | 0.165/0.271/0.242 | 107/150/140 | 201/190/188 | 196/190/190 |
| 桥下水 | 430,670–540,700（60–75%, 52–55%） | **52/92/106** | 0.034/0.107/0.144 | 34/95/117 | 90/151/185 | 3/139/186 |
| 近中水（棋盘上沿） | 322,788–450,810（45–62%, 62–63%） | **55/109/118** | 0.038/0.153/0.181 | 34/116/130 | 77/171/193 | 7/167/195 |
| 近水（底部中间） | 160,1215–560,1270（22–78%, 95–99%） | **76/136/136** | 0.072/0.246/0.246 | 56/148/148 | 59/217/216 | 24/218/217 |
| 近水（左下角，验收部取样点） | 14,1190–72,1267（2–10%, 93–99%） | **86/144/139** | 0.093/0.279/0.258 | 68/152/146 | 64/218/216 | 25/219/217 |
| 桥石面（拱顶正面） | 335,563–385,588（47–53%, 44–46%） | **134/128/99** | 0.238/0.216/0.125 | 138/130/95 | 209/229/218 | 209/229/218 |
| 桥石面（左拱） | 190,610–250,640（26–35%, 48–50%） | **135/115/88** | 0.242/0.171/0.098 | 146/115/74 | 215/219/204 | 215/219/204 |
| 中段条纹（行均值标准差，越小越平） | y 380–470, x 120–600 | **6.8** | – | 7.7 | 16.9 | 32.3 |

读法：
- 水面由近到远：**近水青绿 76/136/136 → 近中 55/109/118 偏深蓝绿 → 中段 86/115/118 灰青 → 远水 92/90/84 暖灰**（远处是倒映的远岸和树，不是天空的橙色）。
- 每一段水都是 **R < G ≈ B**，但 R 不会掉到 0；引擎近水 R 只有 3–25，G/B 高 80 左右。
- 桥石面是 **R > G > B 的暖米灰**（134/128/99），不是白也不偏青。

## 2. r5h3 Blender 里的材质（blend/lakeside_r5h3.blend）
以下前半部分来自 GLB（引擎实际拿到的数据）和生成脚本 `scripts/build_models.py`；「Blender 实读」小节是从 r5h3.blend 直接读出的（`work/inspect_r5h3.json`）。

### 2.1 水（LK_lake.glb，实例 `LK_lake_i`，pos [0, 0, -8]，100×90 m 平面，289 顶点）
- GLB 材质 `M_LK_palette`：调色板 UV 固定在 (0.0312, 0.7812) = 索引 48「white」#F3EEE4，所以**水的颜色全靠顶点色 COLOR_0**。
- COLOR_0（UNSIGNED_BYTE normalized，**线性值**，glTF 规范；Blender 里写入时就是 `lin('#…')`）：
  | 用途 | 线性值（GLB 里存的） | 等于 sRGB | 位置 |
  |---|---|---|---|
  | 浅水（岛岸 0.5 m 内） | 0.212/0.745/0.624 | **#7FE0CF**（127/224/207） | 岸边、桥脚、近水两侧 |
  | 深水（离岸 9.5 m 以外） | 0.012/0.275/0.365 | **#1C8FA3**（28/143/163） | 湖中、棋盘下 |
  | 远深水（离岸 >14 m 渐变到 34 m） | 0.008/0.145/0.239 | **#126A86**（18/106/134） | 远湖 |
- Blender r5h3 里的水材质：材质 `M_LK_water_preview`（已由 2.4 实读确认）：Principled BSDF，Base Color = 顶点色 `Col` 直接接入（线性，不做色彩空间转换），**Roughness 0.01、IOR 1.33（F0≈0.02）、Specular IOR Level 0.85**，自发光 0，金属 0，Alpha 1、透射 0，**不透明**；法线 = 两层噪声凹凸（Scale 0.9 / 7.0，Bump 强度 0.3、距离 0.3，随时间平移 = 波光）。没有单独的「深浅色」参数，深浅色就是上表的顶点色。
- 也就是说 r5h3 的水 = 顶点色漫反射 + 真实反射（EEVEE 反射探针/屏幕空间反射，倒映的是远岸树林、远山和天空）。中段灰青、远水暖灰是**倒影**的颜色，不是天空渐变的颜色。

### 2.2 桥（LK_bridge.glb，实例 `LK_bridge_i` pos [0,0,0]；两端 `LK_bridge_steps_i` / `_i.001` pos [±6.75, 0.08, 0]）
- 材质 `M_LK_palette`（Principled，Roughness 0.8，金属 0），Base Color = 调色板贴图（Closest 采样，sRGB）× 顶点色（MULTIPLY）。
- 调色板索引（UV → 颜色）：
  | 部件 | UV | 索引 | 名称 | sRGB | 顶点数 |
  |---|---|---|---|---|---|
  | 桥面、拱石主体 | (0.0312, 0.9062) | 16 | stone | **#E6D9C2**（230/217/194） | 1380 |
  | 栏杆柱/压边 | (0.9688, 0.9062) | 31 | stone2 | **#B8AC98**（184/172/152） | 480 |
  | 拱圈/踏步 | (0.0312, 0.8438) | 32 | stone3 | **#D6CBB6**（214/203/182） | 288 |
  | 桥头踏步灯 | (0.1562, 0.9688) | 2 | lantern | #FF9A2E | 72（bridge_steps） |
- 顶点色 = 灰度 AO（线性 0.62–1.0，朝下的面再 ×0.7），常见值 0.93/0.90/0.86/0.64。**桥本身是浅米色石头**，r5h3 里看起来是 134/128/99，是因为光照 + 曝光 + AgX 压暗。

### 2.3 亭子（LK_pavilion.glb，486 三角面，包围盒 4.7×4.22×4.3 m）
- **只有一个真实摆放：`LK_pavilion_i`，pos [13.6, 0.55, -4.6]（右岸，不在桥上），旋转单位，缩放 1。**模板 `LK_pavilion`（在原点）是 ASSETS 集合里的隐藏源网格，r5h3 渲染里从来不可见。
- 棋盘机位下它投影在 x≈698–932、y≈426–604（720×1280），**只有左边约 20 px 露在画面右缘**；r5h3 和引擎截图里都只露一条（对照图黄框）。
- 调色板：dwood #5A3524（柱，408 顶点）、wood #C27A45（264）、brass #D9A441（60）、plank #D9B98C（48）、lantern #FF9A2E（36）、roof #E2622F（36）、tile #C9532A（36）、stone #E6D9C2（48，台基）；顶点色 AO 0.50–0.97。之前桥上那个「橙色亭子」就是原点处的模板（roof/tile 橙），是 bug，不是设计。




### 2.4 Blender 实读（work/inspect_r5h3.json；ASSETS 模板和棋子已略去。Blender 坐标是 Z-up，`LK_pavilion_i` (13.6, 4.6, 0.55) = Y-up (13.6, 0.55, -4.6)）
- 色彩管理：view_transform **AgX**，look **AgX - Punchy**，exposure **0.3199999928474426**，gamma 1.0，引擎 BLENDER_EEVEE。
- 灯光：Sun SUN energy 7.2 color [1.0, 0.6, 0.32]；Sun.001 SUN energy 0.55 color [0.212, 0.631, 0.745]；SUN_mtn_sky SUN energy 1.6 color [1.0, 0.72, 0.48]；SUN_dusk_side SUN energy 2.2 color [1.0, 0.55, 0.28]；pl POINT energy 60.0 color [1.0, 0.434, 0.117]；pl.001 POINT energy 60.0 color [1.0, 0.434, 0.117]；pl.002 POINT energy 60.0 color [1.0, 0.434, 0.117]；pl.003 POINT energy 60.0 color [1.0, 0.434, 0.117]；pl.004 POINT energy 60.0 color [1.0, 0.434, 0.117]；pl.005 POINT energy 60.0 color [1.0, 0.434, 0.117]
- 世界 Background: {'Color': '<-Mix.Result', 'Strength': 1.0, 'Weight': 0.0}
- 世界 Color Ramp: [[0.0, [1.0, 0.5457, 0.1441, 1.0]], [0.06, [1.0, 0.3231, 0.0908, 1.0]], [0.16, [0.9216, 0.5776, 0.2705, 1.0]], [0.38, [0.0116, 0.2747, 0.4793, 1.0]]]
- 物体 `LK_bridge_i`（LK_bridge，集合 ['SCENE']，可见 True，hide_render False，位置 [0.0, 0.0, 0.0]，材质 ['M_LK_palette']，色属性 [['Col', 'CORNER', 'BYTE_COLOR']]）
  - 顶点色（线性）前几位：[[0, [0.93, 0.93, 0.93], 204], [0, [0.896, 0.896, 0.896], 136], [0, [0.855, 0.855, 0.855], 124], [0, [0.638, 0.638, 0.638], 104], [0, [0.947, 0.947, 0.947], 96], [0, [0.982, 0.982, 0.982], 92]]
- 物体 `LK_bridge_steps_i`（LK_bridge_steps，集合 ['SCENE']，可见 True，hide_render False，位置 [-6.75, 0.0, 0.08]，材质 ['M_LK_palette']，色属性 [['Col', 'CORNER', 'BYTE_COLOR']]）
  - 顶点色（线性）前几位：[[0, [0.939, 0.939, 0.939], 64], [0, [0.947, 0.947, 0.947], 48], [0, [0.956, 0.956, 0.956], 48], [0, [0.658, 0.658, 0.658], 40], [0, [1.0, 1.0, 1.0], 36], [0, [0.434, 0.434, 0.434], 32]]
- 物体 `LK_bridge_steps_i.001`（LK_bridge_steps，集合 ['SCENE']，可见 True，hide_render False，位置 [6.75, 0.0, 0.08]，材质 ['M_LK_palette']，色属性 [['Col', 'CORNER', 'BYTE_COLOR']]）
  - 顶点色（线性）前几位：[[0, [0.939, 0.939, 0.939], 64], [0, [0.947, 0.947, 0.947], 48], [0, [0.956, 0.956, 0.956], 48], [0, [0.658, 0.658, 0.658], 40], [0, [1.0, 1.0, 1.0], 36], [0, [0.434, 0.434, 0.434], 32]]
- 物体 `LK_lake_i`（LK_lake.001，集合 ['SCENE']，可见 True，hide_render False，位置 [0.0, 8.0, 0.0]，材质 ['M_LK_water_preview']，色属性 [['Col', 'CORNER', 'BYTE_COLOR']]）
  - 顶点色（线性）前几位：[[0, [0.212, 0.745, 0.624], 192], [0, [0.012, 0.275, 0.366], 158], [0, [0.011, 0.254, 0.347], 28], [0, [0.006, 0.144, 0.238], 28], [0, [0.009, 0.22, 0.314], 20], [0, [0.009, 0.209, 0.301], 18]]
- 物体 `LK_pavilion_i`（LK_pavilion，集合 ['SCENE']，可见 True，hide_render False，位置 [13.6, 4.6, 0.55]，材质 ['M_LK_palette']，色属性 [['Col', 'CORNER', 'BYTE_COLOR']]）
  - 顶点色（线性）前几位：[[0, [0.896, 0.896, 0.896], 126], [0, [0.716, 0.716, 0.716], 120], [0, [0.973, 0.973, 0.973], 66], [0, [0.776, 0.776, 0.776], 60], [0, [0.745, 0.745, 0.745], 60], [0, [0.497, 0.497, 0.497], 44]]
- 材质 `M_LK_water_preview`（blend HASHED）：
  - Principled：{'Base Color': '<-Color Attribute.Color', 'Metallic': 0.0, 'Roughness': 0.01, 'IOR': 1.33, 'Alpha': 1.0, 'Normal': '<-Bump.Normal', 'Specular IOR Level': 0.85, 'Transmission Weight': 0.0, 'Coat Weight': 0.0, 'Emission Strength': 0.0}
  - VertexColor Color Attribute {'layer': 'Col'} {}
  - TexNoise Noise Texture {} {'Vector': '<-Mapping.Vector', 'W': 0.0, 'Scale': 0.9, 'Detail': 3.0}
  - Bump Bump {} {'Strength': 0.3, 'Distance': 0.3, 'Filter Width': 0.1, 'Height': '<-Math.Value'}
  - TexNoise Noise Texture.001 {} {'Vector': '<-Mapping.001.Vector', 'W': 0.0, 'Scale': 7.0, 'Detail': 2.0}
- 材质 `M_LK_palette`（blend HASHED）：
  - Principled：{'Base Color': '<-Mix.Result', 'Metallic': 0.0, 'Roughness': 0.8, 'IOR': 1.5, 'Alpha': 1.0, 'Normal': [0.0, 0.0, 0.0], 'Specular IOR Level': 0.5, 'Transmission Weight': 0.0, 'Coat Weight': 0.0, 'Emission Strength': 0.0}
  - TexImage Image Texture {'image': '/workspace/wechat-game/art/regions/lakeside/models/T_LK_palette_256.png', 'colorspace': 'sRGB'} {'Vector': [0.0, 0.0, 0.0]}
  - VertexColor Color Attribute {'layer': 'Col'} {}
  - Mix Mix {'blend_type': 'MULTIPLY'} {'Factor': [0.5, 0.5, 0.5], 'A': [0.0, 0.0, 0.0], 'B': [0.0, 0.0, 0.0]}

## 3. 原因判断
查的代码：`/tmp/wt-scenefix`（integration/build05-next-scenefix-20261017T0636，HEAD 888daeb，含 v3.2 21c187d 和还没上 Mac 验收的 v3.3 ded0725 / 42126a0），只读，没改。

### ③ 亭子不见了 → **不是 bug，也不是导出脚本的问题**
- r5h3 成品里桥上本来就**没有**亭子（对照图左、中两列）。验收部记得的「桥上的亭子」是 0932b6b 之前、模板 `LK_pavilion` 堆在原点（桥中央）的那个 bug。
- b9f04f7 的 `tools/region-export/export_region.py` 只丢了 ASSETS 集合里的模板（`dropped_names.template_collection` 37 个，含 `LK_pavilion`），真实摆放 `LK_pavilion_i` 还在：transforms 581 个实例里 pavilion 1 个；按运行时 `lakesideSceneInstances` 的规则过滤后 431 个，pavilion 仍是 1 个（`LK_pavilion_i`）。`check_region_export.py … --expect 581 --expect-runtime 431 --unique …LK_pavilion.glb…` 现在重跑 PASS。
- 所以**导出脚本不用改，scene-design/export-fix 没有新提交**。如果想让亭子在棋盘画面里看得见，那是新的美术改动（把它挪到 x≈9–10），要另外定。

### ① 近水太亮太青 → 两个原因叠在一起
1. **顶点色被多做了一次 sRGB→线性**（偏青、R 掉到个位数的主要原因）。`bundles/region_lakeside/water/lakeside-water.effect` 第 89 行 `albedo *= SRGBToLinear(v_color.rgb);`。GLB 的 COLOR_0 按 glTF 规范已经是线性值（Blender 写的就是 `lin('#7FE0CF')`），再解码一次：浅水 0.212/0.745/0.624 → 0.037/0.515/0.347，R 被压掉 83%，B/G 比例也变了，就成了纯青。builtin-standard 不做这一步，所以桥、房子的顶点色 AO 是对的，只有水错了。
   **改法**：第 89 行改成 `albedo *= v_color.rgb;`。改完后 `waterTint` 应回到 1/1/1。v3.2 的 0.9/1/1 和 v3.3 的 `waterAmbientScale 0.35` 都是在错误的顶点色上拟合的，要重新调一次。
2. **场景整体光太强 + 没有对齐 r5h3 的曝光/色调映射**。
   - `LakesideSceneData.ts` 里 `ambientSkyIllumToSun: 0.75`，天光是太阳的 75%，而且天光颜色是天顶蓝 0.0116/0.2747/0.4793。注释里 VB 的物理估值是 0.139。
   - r5h3 是 **Blender AgX、look「AgX - Punchy」、曝光 +0.32 EV**，主光 Sun 7.2（色 1.0/0.6/0.32），世界背景强度 1.0（天顶 0.0116/0.2747/0.4793 → 地平线 1.0/0.5457/0.1441 渐变）。AgX 会压高光、降饱和，引擎没有对应的压缩时，同样的光会更亮更艳。引擎这边湖畔相机 `usePostProcess=false`，相机曝光是默认值，有没有 ACES 取决于 `pipelineSceneData.isHDR` 和 `toneMappingType`（场景里没有 PostSettings，SkyboxInfo 没写 `_useHDR`，默认 HDR+DEFAULT）。**请在运行时打出 isHDR / toneMappingType / camera.exposure / 主光 illuminance / ambient.skyIllum 确认**。
   - v3.3 只缩了水自己的光（lightParams 0.8/0.35），桥和草地仍然吃满 0.75 的蓝天光，这就是 ③ 里桥发白偏青、草地荧光绿的原因。
   **建议**：先修第 1 条；再把 `ambientSkyIllumToSun` 降到约 0.2–0.3（全局，不是只给水），然后用桥石面 **134/128/99**、近水 **76/136/136** 两个点一起拟合主光强度 / 天光比。两点同时对上才算对，只对一个点会把另一个带偏。
   - 目标是**调色前**的值。v3.3 `water_tune_v33.cjs` 拟合的 66/152/146 是**调色后、带暗角**的左下角，在不开后处理时会偏暗偏饱和。

### ② 湖中段橙/青条纹带 → 反射方向扫过「橙→蓝」天空渐变，不是深度冲突
- 帧间最大差 ≤0.6/255、没有闪烁，形状是随时间缓慢移动的横条，所以不是 z-fighting（模板重复的湖已经在 0932b6b 去掉，现在 transforms 里 LK_lake 只有 1 个）。也不是 8 位渐变精度问题：条纹幅度 30+ 灰阶，远大于量化。
- 原因：水 shader 的反射颜色是按反射向量仰角 R.y 在 skyHorizon（橙 1.0/0.546/0.144）→ skyLow → skyZenith（蓝）之间插值（effect 第 103–106 行）。中段 R.y≈0.1–0.2，正好落在橙→蓝过渡带上，sin 波法线（waveParams.x 0.06）一摆，就是一条橙一条青；再加 specParams.z 的 `sin(x*3.1)` 噪声把太阳高光切成条。
- v3.3（ded0725）已经把噪声设为 0、波浪 12→35 m 淡出，方向对。但 r5h3 的中段是**倒影色 86/115/118（灰青）、远水 92/90/84（暖灰）**，不是橙色天空。所以还建议：
  - `skyHorizon` 不要用世界渐变的地平线橙，改成远岸倒影色 ≈ 线性 0.107/0.102/0.089（sRGB 92/90/84）；
  - `skyLow` 改成 ≈ 线性 0.093/0.171/0.181（sRGB 86/115/118）；
  - 太阳的暖色只留在高光条（Blinn）里。
  这样就算波浪还在，也只是灰青和暖灰之间的轻微明暗，不会出现橙/青对比。
- 远水被 layered 雾抬成 218/185/154（雾色 215/170/150）。r5h3 远水是 92/90/84，**远水不应该被雾刷亮**。水面可以不吃雾，或者把 fogTop 压到水面以下，只让远山吃雾。

## 4. 验收方法（给 Voice Bot 自测）
- 同机位截图（棋盘背景、无 UI、720×1280 或等比），用 `work/sample.py` 的方框取中位数（把引擎截图路径加进 `imgs`）。
- 合格线（对调色前一列）：近水底部、近中、中段、桥石面每个点 ΔRGB 各通道 ≤12；中段行均值标准差 ≤10；桥石面必须 R>G>B；近水 R ≥50。

