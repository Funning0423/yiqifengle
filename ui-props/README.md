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
| ui_signpost 继续旅程木牌 | 808 | 2.47 × 0.37 × 1.88 | 6.3 KB |
| ui_satchel 行囊 | 696 | 0.86 × 0.52 × 0.92 | 5.0 KB |
| ui_notebook 旅程册 | 584 | 0.67 × 0.32 × 0.89 | 4.8 KB |
| ui_compass 设置 | 532 | 0.84 × 0.29 × 1.05 | 5.2 KB |
四个合计 20.9 KB。每个 GLB 只有一个节点，原点在底面中心，正面朝 -Y（glTF 里朝 +Z）。
碰撞：道具都是实心块状，直接用包围盒即可，没有单独导出 `<prop>_collider`。

木牌上的"继续旅程"在游戏里用 UI Label 渲染；文字面板正面在模型局部坐标里的四角见 `props_info.json` 的 `text_quad_local`。
