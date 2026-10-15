# 草甸 v5 候选（Voice Bot，2026-10-15）— 云、草色、预览灯光
**只是候选，未换进游戏，需 Funning 选定。** 输入为 v4（风车叶片和小路已获批，本版不动）。
## 改动
1. **右上"塑料球"云**：确认是 meadow_clouds_near 网格（10 个球体，两簇；材质 M_meadow_cloud 本来就是 unlit、metallic 0、roughness 0.9，"塑料感"来自平滑球体 + 顶点色渐变）。两簇都重建为扁平、不规则边缘的低模云片（顶部 4–5 个起伏、底部略不平、前后两面 + 侧壁，厚度约原深度 35%），顶点色取原云的颜色范围（顶 0.96 白，底取原色 20% 分位的淡蓝灰）。另一簇在竖屏画面外，为风格一致一起重建。1140→158 顶点。材质未改。节点名不变。
   注：上方和左侧"好看"的云是天空贴图里的，不是这个网格。
2. **草色**：游戏里草根颜色 = 地面贴图 meadow_ground_v0_8_1024（见 M_meadow_grass_wind extras），地形也用它，所以只改这张：仅对绿色像素（色相 50–140°，饱和度 >0.25 的渐变遮罩，约 68% 像素）色相向暖移 8°、饱和 +10%、亮度 +12%；路/沙/花不变。仍是 1024×1024 RGB JPEG（质量 80），117,609 B → 138578 B。平均 RGB (118.6,197.6,54.5) → (140.9,214.1,47.1)。其余 3 张贴图字节不变。
3. **预览灯光**：改用 Eevee（8 采样），按仓库实际设置近似：
   - 主场景 WorldR5Integration.scene：DirectionalLight 白色，欧拉 (-30,-30,0) → Blender 光方向 (0.433,0.75,-0.5)；场景 HDR 值 125000 lux，未启用 HDR/后期（相机 usePostProcess=false），所以用 Cocos LDR 默认强度 1.69 → Blender sun 1.69。
   - Ambient skyColor (51,128,204)，LDR 天光约 0.78 → World 颜色 = 0.78×skyColor（线性）。Skybox、Fog 关闭；无 tone mapping → Blender 色彩变换 Standard。
   - MeadowBoardBackground.ts 的 MeadowKeyLight：SphereLight #fff3da，位置 Cocos(-25,80,25)=Blender(-25,-25,80)，range 260，luminance×12；Blender 用同方向暖色 sun 0.6 近似（无法精确对应物理单位）。
   - 云和天空为 unlit，不受灯光影响。
   before 也用同一灯光重渲染（原版 5c54f7a）。
## 不变（脚本校验）
67 个节点（名/变换/extras/父子）、动画 windmill_sails_loop 不变；网格只换 meadow_clouds_near（v4 的 meadow_path、windmill_sails 原样带入）。
## 大小
原版 6409332 B → v4 6584296 B → v5 6568588 B（相对 v4 -15708 B，相对原版 +159256 B）。
## 渲染
08 竖屏 750×1624 游戏相机、01 横屏游戏相机、09 云近景、10 草地近景、02 风车全景（cmp_* 左前右后）；orbit_check.jpg + after_orbit_v5.mp4。
## 已知弱点
- 新云偏"块状"，起伏不如天空贴图里的云圆润；侧面能看到厚度；
- 新云 COLOR_0 由 float VEC3 变为 unsigned short 归一化 VEC4（glTF 合法，Cocos 支持，需导入确认）；
- Eevee 下路面和路边石偏冷灰（调色板材质 specular 0.4 + 蓝色天光）——v4 已获批未改，若游戏里也偏冷再单独调；
- Blender 里草叶用调色板贴图着色，游戏里草根取地面贴图，所以草叶预览色与游戏不完全一致；
- 灯光映射为近似，最终以 Cocos/真机为准；预览相机是 CAM_spawn_pov，游戏实际用 meadowScenePose。
