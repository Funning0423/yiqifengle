# 风车草甸 v0.8.1-bake：关草兜底的烘焙草地贴图 + 草甸区域拖动镜头位姿

制作：grokbot-2（美术）· 2026-10-09 · 基于 `art/x/GROKBOT-MEADOW-v0.8.0/meadow_v0_8/`（模型、UV、锚点都没改）· 对接 GGbot E4 v1.3（`bakedGroundTexture` 槽）和 0007 `RegionCameraData`（`stops[id=meadow].pose`）。

## 交付物
| 文件 | 用途 |
|---|---|
| `textures/tex_meadow_ground_grassoff_1024.jpg` | **进工程的文件**。拖到 `MeadowInstancer.bakedGroundTexture` |
| `textures/source/tex_meadow_ground_grassoff_1024_lossless.png` | 同一张图的无损版（如果要在引擎里自己压缩，可以用它作源图） |
| `textures/source/tex_meadow_ground_grassoff_2048_paint_master.png` | 2048 绘制母版（1024 是它用 Lanczos 缩出来的），**不进工程** |
| `camera/meadow_camera_pose.json` | 草甸区域位姿：`pose` 里只有 position / target / fovVerticalDeg，其余放在 `metadata` 里 |
| `qa/` | QA 渲染、叠加 UI 区的取景图、数值检查 |
| `scripts/` | 可复现脚本（烘焙、渲染、取景检查）；`geo.json` 是从 v0.8 blend 导出的网格脚印数据 |

## 1. 烘焙草地贴图（关草兜底）
- **尺寸：1024×1024，RGB，sRGB**。和 v0.8 地面贴图同尺寸，同 UV 布局：地形 `TEXCOORD_0` 是世界平面 UV，u = (x_b+80)/160，v = (y_b+80)/160（Blender 坐标；游戏里 x_b = x，y_b = −z）。我在 blend 里核过：25,600 个 loop 的 UV 与这个公式的最大误差 2.4e-8。贴图的朝向和 `meadow_ground_v0_8_1024.jpg` 完全一样（图片顶边 = 游戏 z = −80，即风车那一侧），**直接替换 `mainTexture` 即可，不用改 UV、不用翻转**。
- **为什么是 1024 而不是 2048**：地形 160 m，1024 是 15.6 cm/像素。区域镜头离地面 25–90 m，近景的颗粒感由地形 shader 里的细节贴图（5.2 m / 13 m 两层）负责；2048 在 QA 渲染里看不出区别，内存却要 4 倍。2048 母版留在 `source/`，以后需要再换。
- **内容**（全部按 v0.8 的数据画，不是手摆）：
  - 底色是调色板中间绿 #60AE32：草地部分平均 sRGB (101, 175, 50)，目标 (96, 174, 50)。整张图平均 (104, 174, 52)。
  - 色阶 #2E6A2C → #3F8A2E → **#60AE32** → #86C540 → #9FD048，草尖高光往 #C4E65A 偏；大块阳光斑和暗草丛用 26 m / 9 m / 3.5 m 三层噪声；顺坡加一点很轻的朝阳面提亮（太阳方向取自 blend 里的 sun）。
  - 0.6–1.6 m 的草丛笔触：暗色主体，朝太阳（西南）的一侧带亮边，沿主风向 W 拉长；另外有约 26 万条顺风的草叶短笔触。
  - **原来 1000 丛真草的位置**（`meadow_layout_v0_8.json` 的 `grass_clumps`）都画成更密、更暗、带亮尖的草簇，所以关草以后，草带还留在原来的地方。
  - 两块静态云影的位置、大小、颜色倾向都跟 v0.8 布局一致（冷色，强度 0.4）；树的投影是按太阳方向画上去的。
  - 花海：11 个 `flower_drifts` 椭圆里撒了稀疏的粉、白小点，关草后剩下的 75 簇花还落在花色上。
  - **小路**：按 `meadow_path` 网格的三角形栅格化成土色 #C9B48A，外边有约 0.5 m 的踩秃边。小路网格本身仍然盖在上面，只是有了这层就不会露出绿缝。
  - **河和河岸**：在河、河岸网格的范围内（再外扩约 0.4 m 渐变）**保留 v0.8 原图**。河岸材质还在用旧贴图，不跟着换，这样换图后岸边不会出接缝。实测这块和 v0.8 原图的平均差是 0.88/255。
- **数值检查**（`qa/texture/texture_checks.json`）：小路网格内部 100% 是土色像素；小路外 0.5–1.1 m 一圈 0% 是土色，说明小路和网格对齐，没有偏移。
- **导入设置建议**：sRGB 打开，mipmap **打开**（地面贴图要靠它防远处闪烁），filter 用三线性，wrap 用 clamp-to-edge（UV 只在 0–1 范围内）。压缩格式和 E4 的天空贴图一样：ASTC 6×6，Android 兜底用 ETC2 RGB。
- **内存估算（1024²，含 mipmap）**：ASTC 6×6 约 **0.60 MiB**（626,288 B；不含 mip 是 467,856 B）· ASTC 5×5 约 0.86 MiB · ETC2 RGB 约 0.67 MiB（699,064 B）· 不压缩 RGBA8 约 5.33 MiB。包体里 JPG 是 317,636 B。
  - 注意：`bakedGroundTexture` 是组件上的直接引用，会**跟着场景一起加载**，就算永远不关草也要占这 0.6 MiB。要省这部分，就得改成关草时再按需加载（比如 `resources.load` 或者放进分包），这需要 GGbot 或 Oi 改代码，美术这边不动。

### QA（Blender 5.2 EEVEE，v0.8 blend 原样加载，地形材质的细节贴图公式照常生效）
- `qa/texture/compare_region_0.46_grass_vs_grassoff.png`：区域镜头下，从左到右依次是满草、关草 + v0.8 原图、关草 + 烘焙图。
- `qa/texture/compare_gameplay_close_0.46.png`：近处的游戏视角（相机位置 Blender (−2, −34, 7.5)，看向 (1.5, −8, 2.5)），三张的顺序同上。
- 另外还有 `meadow_pose_0.75_grassoff_baked.png`，以及 `meadow_pose_0.46_fallback30.png`（30% 草 + 50% 花的兜底档，用来对照）。
- 关草的几张都按兜底状态只留了 50% 的花（75 簇）。选法用的是和 GrassFallback 相同的规则：离小路边或视点越近越优先。这是我在 Python 里**近似复现**的，不是引擎跑出来的结果。
- 我自己看过结论：关草后仍然一眼是草甸。草带位置、明暗草丛、阳光斑、花海和小路都在，整体色调和满草时接近（区域镜头下半部平均饱和度 158 对 160，亮度 144 对 155，关草稍暗一点）。坦白说，在区域镜头这个距离，v0.8 原图本身也还算“绿地”。烘焙图多出来的是草丛笔触、原来草带位置的草簇和顺风纹理，近景差别更明显一些。
- **not_run**：Creator 导入、ASTC/ETC2 压缩后的色带、真机上的效果、引擎里换图那一刻的观感（`setGrassOff` 换图是瞬间完成的）。

## 2. 草甸区域镜头位姿（0007 `stops[id=meadow].pose`）
```json
"pose": { "position": [-8.0, 24.0, 62.0], "target": [0.3151, 3.4577, -0.6059], "fovVerticalDeg": 45.0 }
```
- Cocos 世界坐标，+Y 向上，单位米。坐标系是**草甸场景本地坐标**：`meadow_greybox_v0_8.glb` 的根节点放在原点、单位变换。如果区域世界里草甸根节点放在别处，要把 position 和 target 按根节点的变换一起换算过去。
- 这里**没有 rotation**，由 `fromLookAt(up=+Y)` 推出。核验结果：right 轴 y = 0，roll 为 0，FOV 45 在 30–75 范围内，数值都是有限值。target 是光轴打到地形上的那一点（在 Blender 里对 `meadow_terrain` 做射线求交得到）。
- Blender Z-up 参考：position (−8, −62, 24)，target (0.3151, 0.6059, 3.4577)；竖直 FOV 45°，换成镜头是 sensor 高 24 mm、焦距 28.97 mm、`sensor_fit` = VERTICAL。
- 机位：朝北偏 7.6°，俯 18°，到 target 66.4 m，离脚下地形 24.8 m。
- 构图：风车和叶片转一整圈扫过的范围都在上三分之一、偏左；门口右边是风铃架（`region_interaction_point`）；右侧是树；小路从 `player_spawn` 一路弯到风车门口。下面 25% 只有草地，留给 UI 按钮。

| NDC（x 向右，y 向上） | 0.46（540×1174） | 0.75（600×800） |
|---|---|---|
| player_spawn | (0.264, −0.431) | (0.162, −0.431) |
| windmill_door_point | (−0.212, 0.285) | (−0.130, 0.285) |
| region_interaction_point | (0.223, 0.265) | (0.137, 0.265) |
| 小路网格包围盒 y 最小值 | −0.446（在 UI 线 −0.5 之上） | −0.446 |
| 叶片扫过范围 x / y | [−0.597, 0.139] / [0.319, 0.663] | [−0.366, 0.085] / [0.319, 0.663] |
（以 `camera/meadow_camera_pose.json` 的 `metadata.ndc_projection_check` 为准，上表是摘录。）竖直 FOV 固定，所以两种比例下 y 完全一样，0.75 只是左右看到得更多。
- 取景图：`qa/camera/meadow_pose_0.46_grass_overlay.png`、`meadow_pose_0.75_grass_overlay.png`。下面 25% 用深色盖住并标出了 UI 区；左右两条细线是 |x| = 0.7 的位置。另有关草版的叠加图。
- 已知问题：
  1. 画面左上角有一大团近景 3D 云（`meadow_clouds_near`），底面偏灰，v0.8 的预览图里也是这样。
  2. 0.75 画面右下角会糊进一块近处的地面，但这块落在 UI 区里。
  3. 引擎里天空是跟着相机 XZ 走的（`SkyFollowCamera`），所以背景天空的位置会和 Blender 渲染略有不同。
  4. 这里只检查了包围盒有没有出画面，没有检查遮挡和 HUD 的实际位置。
- 从小岛拖过来的中间曲线（`between` 里的 `via`）没有设计，留空。

## 校验
`sha256sum -c SHA256SUMS`（在本目录下运行）。
