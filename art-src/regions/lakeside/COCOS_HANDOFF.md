# 风铃湖畔 · Cocos 接入交接说明（r5h_slim 场景 + r5h3 光源修正与交互）

> 所有数字由脚本实测。2026-10-17 起场景摆放改用通用导出脚本 `art/tools/export_region.py`，从 `blend/lakeside_r5h3.blend` 导出，再用 `art/tools/check_region_export.py` 自动检查。旧的 `scripts/export_handoff.py` 会把隐藏的 ASSETS 模板集合也导出，已停用。
> 基准场景：`blend/lakeside_r5h_slim.blend`（与 r5h 逐像素平均差 0.06/255）。坐标一律 glTF Y-up、米（Blender (x,y,z) → (x,z,-y)）。

## 1. 进分包的 GLB 清单（models/，55 个）
共享调色板贴图 `models/T_LK_palette_256.png`（256×256，所有 GLB 外部引用同一张）。`LK_board_frame.glb` 不进分包，已移到 `models/_excluded/`。
实例数为 r5h3 最终渲染中可见的实例（不含 ASSETS 模板）；`LK_boardwalk`、`LK_boardwalk_rail`、`LK_fishnet`、`LK_signpost` 以前只在原点的模板里出现，场景里实际是 0 个实例，可以考虑移出分包（共 25,724 B）；实例数 0 的是动态生成（水花）或备用资产。

| 文件 | 归属 | 三角面/个 | 字节 | 实例数 | 合计三角面 |
|---|---|---|---|---|---|
| `LK_barrel.glb` | 背景 | 60 | 5,864 | 3 | 180 |
| `LK_boardwalk.glb` | 背景 | 40 | 4,520 | 0 | 0 |
| `LK_boardwalk_rail.glb` | 背景 | 40 | 4,532 | 0 | 0 |
| `LK_bridge.glb` | 背景 | 1040 | 85,072 | 1 | 1,040 |
| `LK_bridge_steps.glb` | 背景 | 212 | 18,172 | 2 | 424 |
| `LK_buoy_lantern.glb` | 棋盘 | 112 | 9,528 | 4 | 448 |
| `LK_bush.glb` | 背景 | 180 | 7,104 | 14 | 2,520 |
| `LK_chime_post.glb` | 背景 | 84 | 7,584 | 1 | 84 |
| `LK_chime_raft.glb` | 棋盘 | 140 | 12,284 | 2 | 280 |
| `LK_cliff_rock.glb` | 背景 | 56 | 7,524 | 0 | 0 |
| `LK_clothesline.glb` | 背景 | 86 | 8,048 | 1 | 86 |
| `LK_cloud.glb` | 背景 | 560 | 38,588 | 6 | 3,360 |
| `LK_contact_shadow.glb` | 棋盘 | 8 | 1,348 | 49 | 392 |
| `LK_dragonfly.glb` | 背景 | 80 | 8,104 | 1 | 80 |
| `LK_driftwood.glb` | 背景 | 52 | 6,136 | 0 | 0 |
| `LK_duck.glb` | 背景 | 288 | 26,552 | 1 | 288 |
| `LK_duckling.glb` | 背景 | 84 | 8,912 | 7 | 588 |
| `LK_far_hills.glb` | 背景 | 822 | 95,180 | 1 | 822 |
| `LK_far_shore.glb` | 背景 | 492 | 39,852 | 1 | 492 |
| `LK_fishnet.glb` | 背景 | 144 | 10,512 | 0 | 0 |
| `LK_float_rope_soft.glb` | 棋盘 | 576 | 16,384 | 1 | 576 |
| `LK_flower_clump.glb` | 背景 | 104 | 12,484 | 15 | 1,560 |
| `LK_flowerpot.glb` | 背景 | 76 | 7,984 | 5 | 380 |
| `LK_grass_tuft.glb` | 背景 | 9 | 2,500 | 82 | 738 |
| `LK_house_A.glb` | 背景 | 928 | 75,948 | 1 | 928 |
| `LK_house_B.glb` | 背景 | 928 | 75,960 | 1 | 928 |
| `LK_house_C.glb` | 背景 | 984 | 80,616 | 2 | 1,968 |
| `LK_lake.glb` | 背景 | 512 | 14,868 | 1 | 512 |
| `LK_lantern.glb` | 背景 | 60 | 5,744 | 5 | 300 |
| `LK_lantern_boat.glb` | 背景 | 68 | 6,648 | 1 | 68 |
| `LK_lilypad.glb` | 棋盘 | 30 | 3,544 | 57 | 1,710 |
| `LK_lotus.glb` | 背景 | 52 | 5,244 | 11 | 572 |
| `LK_paper_boat.glb` | 背景 | 16 | 2,864 | 1 | 16 |
| `LK_pavilion.glb` | 背景 | 486 | 38,096 | 1 | 486 |
| `LK_piece_bell_pad.glb` | 棋盘 | 96 | 8,640 | 11 | 1,056 |
| `LK_piece_bobber.glb` | 棋盘 | 132 | 11,808 | 7 | 924 |
| `LK_piece_lake_light.glb` | 棋盘 | 68 | 7,088 | 4 | 272 |
| `LK_piece_lotus_lamp.glb` | 棋盘 | 144 | 12,736 | 6 | 864 |
| `LK_piece_paper_boat.glb` | 棋盘 | 37 | 4,292 | 13 | 481 |
| `LK_piece_shell.glb` | 棋盘 | 104 | 9,468 | 11 | 1,144 |
| `LK_porch_steps.glb` | 背景 | 60 | 6,160 | 3 | 180 |
| `LK_reed_card.glb` | 背景 | 2 | 1,688 | 67 | 134 |
| `LK_ripple_ring.glb` | 棋盘 | 28 | 2,636 | 49 | 1,372 |
| `LK_rock.glb` | 背景 | 40 | 6,048 | 22 | 880 |
| `LK_rope_float.glb` | 棋盘 | 24 | 2,660 | 18 | 432 |
| `LK_shore_foam.glb` | 背景 | 288 | 13,600 | 1 | 288 |
| `LK_signpost.glb` | 背景 | 60 | 6,160 | 0 | 0 |
| `LK_splash_crown.glb` | 棋盘 | 60 | 6,624 | 0 | 0 |
| `LK_splash_drop.glb` | 棋盘 | 20 | 3,784 | 0 | 0 |
| `LK_terrain.glb` | 背景 | 1380 | 113,816 | 1 | 1,380 |
| `LK_tree_conifer.glb` | 背景 | 58 | 5,900 | 24 | 1,392 |
| `LK_tree_far.glb` | 背景 | 24 | 3,428 | 0 | 0 |
| `LK_tree_round.glb` | 背景 | 172 | 8,272 | 41 | 7,052 |
| `LK_wb_line.glb` | 棋盘 | 2 | 1,596 | 16 | 32 |
| `LK_windchime.glb` | 背景 | 126 | 10,684 | 9 | 1,134 |

**GLB 合计：1,001,388 B（0.955 MiB）**；加上调色板 1,803 B 和 LUT `T_LK_grade_lut_32.png` 9,050 B，**分包合计 1,012,241 B（0.965 MiB，≤1.0 MiB）**。55 个 GLB zip -9 后为 228,989 B。（2026-10-16 用 `scripts/check_handoff_manifest.py` 复核：字节、三角面、实例数全部一致。之前的 0.955 MiB 没把两张贴图算进去。）压缩方案见 `PACKAGE_PLAN_INPUT.md`。

## 2. 面数 / DC / 贴图
- 背景三角面（GLB 口径 × 实例）：**30,860**（≤45k）。更正：之前的 40,167 把 ASSETS 集合里 34 个隐藏模板（9,307 面）也算进去了。`LK_board_frame` 不进分包，也不在 transforms 里。
- 棋盘（棋子、格线、荷叶、浮标、绳、涟漪、接触影）：**9,983**。
- DC 估算：全部资产共用 1 个材质 + 1 张调色板贴图；46 种有实例的网格。开 GPU Instancing 后约 46 DC（每种网格 1 次）+ 水面/云/透明特效约 6–8 次 ≈ **56–60 DC**；把静态背景合并成 2–3 个静态批次后可降到约 **20–25 DC**。
- 调色板：256×256 RGBA PNG，Nearest 过滤、关 mipmap；顶点色（COLOR_0，UNSIGNED_BYTE 归一化）乘调色板色。

## 3. 场景摆放
`scene_r5h3_transforms.json`（与本文件同目录）有 **581 个实例**：bg 333 个，board 248 个。游戏仓库里同样内容的文件仍叫 `bundles/region_lakeside/scene_r5h_slim_transforms.json`，因为运行时常量 `LAKESIDE_TRANSFORMS` 用的是这个名字。字段为 name / glb / group(bg|board) / pos / rot_quat_xyzw / scale / animated，已经是 Y-up；顶层另有 `instance_count` 和 `boardCamera`。
- 运行时实际摆放 **431 个场景实例**：581 个里去掉由棋盘逻辑动态生成的 150 个（49 个接触影、49 个涟漪环、52 个 3D 棋子）。
- 导出规则（`art/tools/export_region.py`）：只导出最终渲染里看得见的网格实例。排除以下几类：
  - ASSETS 模板集合，共 37 个模板：34 个对应进包的 GLB，另外 3 个是 `LK_tree_far`、`LK_board_frame`、`LK_board_cell`；
  - hide_render 或 hide_viewport 的对象，以及被排除或隐藏的集合里的对象；
  - 名字和 GLB 文件名完全相同的模板对象；
  - `LK_board_frame`，以及 models/_deprecated、models/_excluded 里的 GLB。

  模板网格仍然各自是独立的 GLB，实例通过 `glb` 字段引用它们，但模板本身不再作为实例摆在原点。
- 检查（`art/tools/check_region_export.py`）：模板实例 0 个；重复摆放 0 个（同一 GLB、同一变换会导致闪烁）；引用的 GLB 都在 models/ 里；没有用到废弃的 GLB；`LK_lake`、`LK_bridge`、`LK_terrain`、`LK_pavilion`、`LK_far_hills` 各 1 个。原点处只剩 6 个正常实例：far_hills、terrain、shore_foam、bridge、float_rope_soft、far_shore，它们本身就是按世界坐标建的网格。
- 和旧 transforms（615 个）对比：去掉 34 个模板后，剩下的 581 个逐字段完全一致，所以真实摆放没有任何变化。GLB 文件也没改。
- `LK_chime_raft` 的 2 个实例（chime_cell_0_6 / 6_0）摆在 7×7 网格外侧（x=-5.35 / 4.9），只是装饰；关卡里的风铃格按 `LEVELS_DRAFT_lakeside.json` 摆放。
- 重新导出的命令（在 `art/regions/lakeside/` 下）：`blender -b blend/lakeside_r5h3.blend --python ../../tools/export_region.py -- --models ../models --out ../scene_r5h3_transforms.json --meta ../scene_r5h3_export_meta.json`；检查命令（在 `/workspace/wechat-game` 下）：`python3 art/tools/check_region_export.py art/regions/lakeside/scene_r5h3_transforms.json art/regions/lakeside/models --expect 581 --expect-runtime 431 --unique LK_lake.glb,LK_bridge.glb,LK_terrain.glb,LK_pavilion.glb,LK_far_hills.glb`。

## 4. 棋盘相机
- 位置 [0.0, 13.2, 26.5]，前向 [0.0, -0.4312, -0.9022]，**Y-up 旋转四元数 (x,y,z,w) [-0.22109, 0, 0, 0.97525]**（绕 X 轴 -25.5°，俯视）。更正：之前写的 [0.53327, 0, 0, 0.84594] 是 Blender Z-up 下的值，直接用在 Cocos 里镜头会朝上。
- 竖向 FOV **61.928°**（Blender 30mm/36mm 传感器，竖屏 AUTO 适配 → 传感器作用于长边），近/远裁剪 0.1 / 1000，720×1280。

## 5. 光照（Blender 导出值；方向=光线前进方向，Y-up）
| 角色 | 名称 | 方向 | 颜色 (线性) | 强度 (Blender W/m²) | 角直径 | 照射对象 |
|---|---|---|---|---|---|---|
| 主光（暖橙夕照） | `Sun` | [-0.4182, -0.3983, 0.8164] | [1.0, 0.6, 0.32] | 7.2 | 1.2° | 全部 |
| 天光补光（冷青） | `Sun.001` | [0.5014, -0.6217, -0.6017] | [0.212, 0.631, 0.745] | 0.55 | 0.53° | 全部 |
| 只照远山的暖光 | `SUN_mtn_sky` | [-0.7318, -0.575, -0.3659] | [1.0, 0.72, 0.48] | 1.6 | 1.15° | MTN_RECV |
| 黄昏侧光 | `SUN_dusk_side` | [-0.9629, -0.223, 0.152] | [1.0, 0.55, 0.28] | 2.2 | 1.72° | 全部 |

另有 6 盏点光（灯笼，色 [1.0, 0.434, 0.117]，60 W，半径小，可在 Cocos 里改为自发光贴图 + 小范围点光或直接省掉）。
曝光 +0.32，色调映射 AgX Punchy；Cocos 里用 ACES/Filmic 后再用下面的 LUT 校色。
注：Blender 与 Cocos 光强单位不同，建议主光 illuminance 先按 1.0 归一化，其余按上表比值缩放（补光 ≈ 0.08、远山暖光 ≈ 0.22、侧光 ≈ 0.31）。远山暖光在 Cocos 用 Visibility/layer 只照 MTN 层。
※ 方向核对（r5h3）：主光 Sun 的光线前进方向 Y-up = (−0.418, −0.398, +0.816)，即向下 23.5°（y<0）、自右（+x）向左、自远处向镜头（+z 指向相机一侧）——是右上方偏逆光的夕照，与画面一致，导出没有反。上一版说明误把第三分量当成了 y，已更正。Cocos DirectionalLight 的 forward 直接用这个向量。

## 6. 后处理（三项）
- **调色 LUT**：饱和度 ×1.35、对比度 ×1.12 → `T_LK_grade_lut_32.png`（32³，1024×32 横条：tile 序号=B，tile 内 x=R，y=G）。PIL 的对比度以整帧平均灰度为中心，LUT 用 0.5 近似，差异很小。
- **暖色 Bloom**：阈值 ≈0.72（=185/255），强度 ×3，半径约 18px@720 宽，色调 (1.00, 0.75, 0.45) ≈ **#FFBF73**。
- **Vignette**：强度 ≈0.28（边缘亮度 ×0.72），椭圆，羽化约 12% 屏宽。
- r5h3：后期在 16bit/float 中计算并加 ±1 LSB TPDF 抖动，去掉夕照区域的色带（Cocos 对应：HDR 渲染目标 + 后处理末尾加 dither）。
- r5h3 体积光（仅 Blender 参考渲染用）：EEVEE volumetric tile 4、采样 96、体积阴影采样 32；主光角径保持 1.2°；雾体只在上沿（物体 z>0.3）和远端（物体 y>0.15）平滑渐隐，棋盘处不受影响。Cocos 端不用体积光，以天空渐变 + 方向雾散射 + Bloom 还原。

## 7. 水面与棋子的动态实现要点
- **棋子浮动**：顶点着色器里按世界坐标相位做 sin 浮动（振幅 0.03–0.05m、周期 2.2–2.8s、每颗错相），不走脚本，零 CPU；被拖动的棋子由脚本接管位置。
- **水花粒子**：一个全局粒子池，**同屏上限 60 粒**（每次消除约 12–20 粒 + 1 个水冠 mesh），寿命 0.5–0.7s，重力 + 少量拖尾。
- **波纹 decal 池**：8–12 个环形 decal（或水面 shader 里的环形数组 uniform）循环复用；按下、拖动尾迹、消除各用一组参数。
- **云影 cookie**：一张 256² 低频云影贴图，在水面/地面 shader 里按世界 XZ 采样并随时间平移（≈0.6 m/s，与视频一致），乘到漫反射上。
- **太阳反射与闪光**：水面 shader 中，受光区（cookie 未遮挡处）叠加一条暖金色反射光带（沿太阳方向拉长的 Blinn 高光，色 ≈ #FFC46B），再用两层滚动法线噪声 + 低粗糙度产生细碎闪光（阈值化高光，进 Bloom）。
- **夕照柔光（r5h3）**：不要光柱几何，不要体积光；Cocos 端用天空渐变 + 雾的方向散射（太阳方向加暖色）+ Bloom 实现连续柔光。

## 8. 棋盘交互参数（设计稿，Blender 演示 = blend/lakeside_r5h3.blend，24fps）
| 阶段 | 时长 | 缓动 | 数值 |
|---|---|---|---|
| 按下→选中 | 0.17s（4 帧） | quadOut | 棋子抬起 +0.12m（已有浮动抬升的棋子 +0.04m）；亮环 scale 0→1 |
| 拖动中 | 跟手 | — | 亮环常亮；棋子保持抬起；尾迹波纹沿用 r5 方案 |
| 松手→落回 | 0.17s | quadIn | 抬起归零，亮环 0.12s 内 scale→0 |
| 按下波纹 | 0.42s ×2 圈（间隔 0.12s） | sineOut | ripple decal scale 0.3→1.4，alpha 1→0 |
| 消除·放大 | 0.12s（3 帧） | sineOut | scale 1.0→1.18 |
| 消除·消失 | 0.12s | sineIn | scale 1.18→0，同帧触发溅水粒子 + 涟漪 decal |

**描边做法（亮环）**：不做屏幕空间描边（小游戏开销大）。用一个随棋子的薄环网格（torus 32×4 段 = 256 三角，major 0.46m、minor 0.022m，离水面 +0.03m），unlit 加色材质，色值暖白 #FFEDCC（线性 1.0/0.93/0.80），HDR 强度 ×4 让它进 Bloom；所有棋子共用 1 个环实例（同时只有 1 个被选中）。如果需要贴合轮廓的描边，备选方案是 back-face 外扩 pass（法线外扩 0.015m，同色），但每种棋子要多 1 个 DC。

## 9. 验收参考
- 静帧：`renders/cmp_r5h_slim_graded.png`（r5h_slim），`renders/lakeside_r5h_still_graded.png`（r5h）
- 视频：`renders/lakeside_r5h_slim_demo_8s.mp4`，关键帧对照 `renders/lakeside_r5h_slim_video_vs_still.jpg`，末帧 `renders/lakeside_r5h_slim_demo_lastframe.png`
- r5h3（现行）：视频 `renders/lakeside_r5h3_demo_8s.mp4`，并排对比 `renders/lakeside_r5h_vs_r5h3_8s.mp4`，光源放大对比 `renders/r5h3/light_zoom_r5h_vs_r5h3.jpg`，交互关键帧 `renders/r5h3/interaction_keyframes.jpg`

## 10. 关卡数据与包体
- 关卡草案：`LEVELS_DRAFT_lakeside.json`，与 regional-r05 `catalog-data.js` 同构。7×7 网格，格心 x=-3.3+1.1·col，z=8.7+1.1·row。共 6 关。
- 包体输入：`PACKAGE_PLAN_INPUT.md`，压缩试验在 `models/_trial/`。
