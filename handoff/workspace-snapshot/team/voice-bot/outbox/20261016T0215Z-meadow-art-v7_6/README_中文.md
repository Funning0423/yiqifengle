# 草甸美术 v7.6（候选，未进主线）

基于 PR #58 头 0b1181d（v7.5）。只用自制原创素材，无外部素材。

## 真机问题的根因与修复
| 问题 | 根因 | v7.6 修复 |
|---|---|---|
| 草地整块不见、地平线黑带、露出淡蓝底色 | **不是 specular**（改前能正常显示的 edc65d5 版本同样带 KHR_materials_specular）。v1 起我的拼接脚本把 meadow_terrain 的 `_DRIFT` 属性指错了：指向树的索引 accessor，count 17214 ≠ 顶点数 6561，且未 4 字节对齐。glTF Validator 报 10 个 error，Creator 会丢弃这个 primitive，整块地面不渲染。 | 删除 `_DRIFT`（引擎从未使用）和地面的 `TEXCOORD_1`（只给没实现的细节 shader 用，Cocos standard 不读）。Validator：0 error / 0 warning。 |
| 旗子纯黑 | 旗面是单片四边形，法线朝 -Z（背向镜头和灯），材质 doubleSided。Cocos standard 在背面不翻转法线，看到的是“背光面”→ 黑。 | 旗子 3 段和所有蝴蝶/鸟翅膀改成“正反两片”：复制一份反向绕序 + 反向法线，换成新的单面材质 `M_meadow_palette_card`（与 palette 相同，只是 doubleSided=false）。 |
| Creator 报 KHR_materials_specular 不支持 | 只是警告 | 5 个材质都去掉 specular；extensionsUsed 只剩 KHR_materials_unlit（天空、近云，改前就有，Cocos 能吃）。 |
| Validator 其他 error | 动画时间 accessor 的 min 声明与实际不符 | 全部 accessor 重新计算 min/max。 |

材质全部是普通 metallic-roughness（metallic 0、roughness 0.9），没有 transmission/volume/sheen/clearcoat/ior，全部 OPAQUE，没有 alpha。所有网格都有 NORMAL；除近云（只用顶点色）外都有 TEXCOORD_0。详见 material_report_before/after.txt、gltf_validator_v7_5/v7_6.txt。

## 镜头（运镜bot 核对，我复核）
我之前的预览用的是旧 checkout（5c54f7a）里的 meadowScenePose：[9,19,42]→[0.327,5.509,-15.817]。PR #58 里（fc563b2 起）竖屏实际是 **[0,24,45]→[0,4,4]**，竖直 FOV 49.426°，near/far 0.1/1000，宽高比 <1.1 用竖屏，落地后固定不跟随。mountRegion 不缩放、不旋转，模型挂在 MeadowLiveScene 下。这台背景相机只看 MEADOW_LAYER，模型和相机在同一个 rig 下，所以只要 rig 自身不旋转不缩放，结果就和放在原点一样（rig 只 new 出来再 addChild，没有设 transform）。旧镜头下 butterfly_00 在新镜头里完全出了右边画面，录屏里看到的 4–6px 是远处的 01/02。v7.6 的预览镜头直接从 `git show 0b1181d:.../MeadowSceneData.ts` 读取（render_v76.py）。

## 用真实镜头重新摆位（375×812，UI：标题栏约 y95–160，棋盘约 y222–578，星章约 x160–215 y640–735）
- butterfly_00：新的低路线，0.2–2.7s 在棋盘下方（y≈650–740）从右飞到左，宽 7.2–8.7%（随拍翅变化），距镜头 22–23m，离地 6.1–7.6m；节点缩放 2.6（翼展约 1m）。其余时间在画面外绕回。
  - 弱点：镜头在 24m 高、俯角大，最近能看到的地面在 29m 外。要 8% 宽又贴地，就得把蝴蝶放得更大。我的取舍是放大 2.6 倍、离地约 7m，没有采用“镜头前 8m”那条路线，因为那样离地 14m 以上。约 1.5s 时会从星章后面短暂经过。
- butterfly_01/02：原来在棋盘后面（y≈480–540），整体后移 10.5m，并按地面高度修正，现在落在棋盘下方 y≈655–760，宽约 4%。
- 鸟群：原来在画面上方外面（y≈-200），沿镜头 up 方向下移（只改 meadow_birds_loop 里 meadow_birds_root 的平移关键帧），现在在 y≈40–80，标题栏上方。
- 大云 meadow_clouds_near：原来整朵在画面外。**只移动了节点 translation**（没拆节点），云的圆鼓底边落在 y≈57，在标题栏上方。

## 给 GGbot（夜间调色）
- meadow_sky_dome：M_meadow_sky，KHR_materials_unlit，只有 baseColorTexture，baseColorFactor 默认 1，可以直接乘 mainColor 调色。
- meadow_clouds_near：M_meadow_cloud，KHR_materials_unlit，**颜色来自顶点色 COLOR_0**（白顶→灰蓝底），没有贴图，baseColorFactor 默认 1。导入后 unlit 材质会开 USE_VERTEX_COLOR，mainColor 与顶点色相乘，乘夜色可以正常生效。注意 configureMeadowVertexColors 不会动它（它有 a_color）。
- 两者节点名都没变，云只改了节点平移。

## 节点、动画、大小
- 节点名、节点数（98）、动画名（windmill_sails_loop、meadow_butterflies_loop、meadow_birds_loop、windmill_flag_loop）都不变。新增材质 1 个（M_meadow_palette_card）。
- glb 7,076,792 B（v7.5 7,099,440 B，-22,648 B；v6+500KB 上限 7,118,360 B）。
- 测试：tools/meadow/test_meadow_scene.cjs PASS，test_meadow_wind_data.py PASS（在 v7.6 上）。没有在 Creator/真机上导入过，需要重录。

## 预览
renders/before_after_truecam_t1s.png：左=PR58 真机 40s 截图，中=v7.5 Blender 真实镜头，右=v7.6 Blender 真实镜头（t=1s，紫框为 UI 区域）。Blender 背面会自动翻转法线，所以 v7.5 的旗子在 Blender 里看起来是红的，地面也在。这两个问题只出现在 Cocos 里，要以真机重录为准。没有出夜景图，因为夜间调色由 GGbot 在代码里做。
