# 岛屿界面 3D UI 道具（继续旅程木牌 / 行囊 / 旅程册 / 设置罗盘）

Blender 4.5 headless 生成，可重跑：
```
blender -b --factory-startup -P src/build_props.py -- $PWD    # 建模 + 导出 GLB + ui_props.blend
blender -b -P src/render_props.py -- $PWD 1024 128             # Cycles CPU 透明 PNG（3/4 视角，左上前方太阳）
python3 src/mockup.py                                          # 合成 mockup-portrait.png / mockup-landscape.png
```

## 材质：复用游戏 `M_env_palette`
- 不新增贴图、只有一个材质。每个面的 UV 全部塌缩到 `env_palette_256.png`（从
  `creator-build-project/assets/bundles/region_island/combined_visual_m.glb` 中原样提取，见 `textures/`）某个色块的像素中心。
- `glb/*.glb`：Draco 压缩，材质名 `M_env_palette`，**不内嵌图片**，在 Cocos 里直接重绑到现有 `M_env_palette`。
- `glb-preview/*.glb`：未压缩、内嵌调色板贴图，仅供查看器预览，不进包。
- 发光：灯笼玻璃用调色板第 13 行（这一行在 `env_palette_emissive_256.png` 里是唯一的发光行），所以接上原材质就会自然发光。

| 用途 | 参考图取色（338b… 1280x720, 5x5 中值） | 对应色块 (x,row) | 色块色 | UV |
|---|---|---|---|---|
| 灯塔奶油灰泥 plaster | #f1f9e0 @(595,255) | (206,4) | #f8f2e2 | (0.8066, 0.7168) |
| 奶油（罗盘表面） | — | (130,4) | #eee4cd | (0.5098, 0.7168) |
| 灯塔屋顶赤陶 roof | #bd693f @(640,127) | (86,6) | #c65f2d | (0.3379, 0.5918) |
| 小屋屋顶石板蓝 slate | #6595c0 @(665,300) | (170,7) | #6d93ba | (0.6660, 0.5293) |
| 门/栅栏木色 wood | #8f6d3b @(685,405) | (102,8) | #956737 | (0.4004, 0.4668) |
| 深木（长椅） darkwood | #605331 @(640,508) | (30,8) | #6e4826 | (0.1191, 0.4668) |
| 窗户暖黄 window（发光） | #fae595 @(652,259) | (182,13) | #ffde99 | (0.7129, 0.1543) |
| 暖黄（不发光，书上星星） | — | (250,10) | #eac777 | (0.9785, 0.3418) |
| 草绿 grass（未用到） | #589d4f @(615,470) | (154,0) | #599c46 | — |
| 沙米色 sand（未用到） | #e6e3ab @(480,600) | (230,1) | #ebdcad | — |

## 网格
| 道具 | 三角面 | 包围盒 (m, x·y·z, Blender Z 向上) | GLB (Draco) |
|---|---|---|---|
| ui_signpost 继续旅程木牌（含子节点 lamp_glass 12 面） | 808 | 2.47 × 0.37 × 1.88 | 7.3 KB |
| ui_satchel 行囊 | 696 | 0.86 × 0.52 × 0.92 | 5.0 KB |
| ui_notebook 旅程册 | 584 | 0.67 × 0.32 × 0.89 | 4.8 KB |
| ui_compass 设置 | 532 | 0.84 × 0.29 × 1.05 | 5.2 KB |
四个合计 20.9 KB。每个 GLB 只有一个节点，原点在底面中心，正面朝 -Y（glTF 里朝 +Z）。
碰撞：道具都是实心块状，直接用包围盒即可，没有单独导出 `<prop>_collider`。

木牌上的"继续旅程"在游戏里用 UI Label 渲染；文字面板正面在模型局部坐标里的四角见 `props_info.json` 的 `text_quad_local`。

## 木牌灯笼：白天灭、夜里亮（给 GGbot 接线）
- `ui_signpost.glb` 现在是两个节点：根节点 `ui_signpost`（M_env_palette）+ 子节点 **`lamp_glass`**（灯笼玻璃，独立材质 **`M_signpost_lamp`**）。
- 导出默认 = 白天关灯：`M_signpost_lamp` baseColor #c9d2cd（不发光的烟灰玻璃），roughness 0.35，emissive 0。
- 夜里开灯两种做法，任选一种：
  1. 改材质：`lamp_glass` 的 MeshRenderer 材质 emissive 设为 #ffde99（强度约 1–2，可配合夜里的 bloom）；白天再设回黑色。
  2. 换材质：夜里把 `lamp_glass` 的材质换成共享的 `M_env_palette`。它的 UV 就落在调色板发光行（第 13 行 x182 #ffde99），会自动发光，不用新资源；白天换回 `M_signpost_lamp`。
- 建议挂在 `RoomLightingRig` / 昼夜状态变化的回调里切换；需要光晕可再挂一个暖色点光（#ffd17f）只在夜里启用。
- 夜景预览：`renders/ui_signpost_night.png`（只预览灯光效果，没放文字）。

## 海滩道具 beach-props/（棕榈树 + 小动物）
`blender -b --factory-startup -P src/build_beach.py -- $PWD`；渲染 `BLEND=beach-props/beach_props.blend RDIR=beach-props/renders ELEV=28 blender -b -P src/render_props.py -- $PWD 1024 128`。
同样只用 M_env_palette 一个材质、Draco、不内嵌贴图；原点在底面（棕榈树原点 = 树干底部中心）。

| 模型 | 三角面 | 尺寸 m (x·y·z) | GLB (Draco) | 用到的色块 |
|---|---|---|---|---|
| beach_palm_tall 高棕榈 | 672 | 4.20 × 4.09 × 4.87 | 5.7 KB | 叶 row0 x160/x110，树干 row5 x110/x70，椰子 row8 x60 |
| beach_palm_short 矮棕榈 | 643 | 2.74 × 2.71 × 3.21 | 5.6 KB | 同上（叶用浅绿 row0 x200） |
| beach_crab 小螃蟹 | 580 | 0.52 × 0.44 × 0.33 | 5.3 KB | row6 x150/x200，眼 row14 x20 |
| beach_gull 海鸥 | 568 | 0.19 × 0.59 × 0.39 | 4.6 KB | 白 row4 x250，灰 row15 x250，翼尖 row14 x120，嘴脚 row6 x232 |
| beach_turtle 小海龟 | 658 | 0.57 × 0.71 × 0.20 | 4.9 KB | 壳 row11 x70/x140，皮 row11 x200 |
五个合计约 26 KB。
