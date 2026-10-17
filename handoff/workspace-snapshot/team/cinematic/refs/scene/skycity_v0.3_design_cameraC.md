# 《咦 起风了》天空之城 v0.3 —— 只用机位 C 的优化版

作者：grokbot-2（第二个 Grok Bot）· 美术负责 · 2026-10-09（America/Chicago）
基线：v0.2（`../v0.2/`，未改动）。工具：Blender 5.2.2（主文件）+ Blender 4.5.14（`skycity_v0_3_b45.blend`），Cycles 预览。

> 机位决定：用户最终确认**全程只用机位 C**（3/4 高位俯视，竖直 fov 45°，没有 A/B 机位，也没有开场前的 B 机位或 B→C 过渡）。
> 曾短暂要求过“开场前用 B”，后来已撤销，所以本版不出 B 镜头，也不做 B→C 过渡。

## 1. 机位 C（Cocos 原生参数，和 v0.2 相同）

| 项 | 值 |
|---|---|
| 位置（Blender） | (-21.4, -110.6, 36.0) |
| 位置（Cocos，x, z, -y） | (-21.4, 36.0, 110.6) |
| lookAt（Cocos，360×780） | (3.08, -16.83, 29.3) |
| lookAt（Cocos，360×640 自适应，位置不变，只改 pitch） | (2.64, -22.52, 33.15) |
| fov | 竖直 45°，没有 lens shift，没有 roll；pitch -31.89°，yaw -16.76° |
| 画面检查（1080×2340） | 女孩高 48.9 px，脚在画面 33.5% 处；机器人高 196.6 px；树冠完全在画面外（crown_low_y = -17%） |

## 2. 改动总览

### 2.1 三角面重新分配（预算花在 C 能看到的地方）
- **树冠完全在 C 视锥外**，所以树冠团块统一降到 sub2（4,480 面，v0.2 约 8.6k）；北侧叶片卡片减半；树后（y > 20）不再放灌木。主视觉 `hero_landscape` 中树冠依然完整、好看。
- 花出去的预算用在星庭周边：
  - 2 座风车（塔身 + 转子动画）
  - 6 根灯柱（暖光灯罩，其中 3 根挂风铃）
  - 4 个花箱（花卡片会摆动）
  - 2 串三角彩旗
  - 6 只蝴蝶、8 只鸟
- **同屏三角面最坏情况**（GGbot 检查器口径：各状态组分别取最大值混搭）：**107,302**（目标 ≤110k）。
  - 全部 after：106,358；全部 before：105,772。
  - 机器人 13,908 面（≤15k）。

### 2.2 从 C 看出“浮空”
- 岛形改为**南端收窄的观景岬**：半宽 = 椭圆 × (1 − 0.45·smoothstep)，星庭附近半宽约 ±15 m。
  - C 画面左右两侧都能看到岛缘、土层断面和下方岩体落差。
  - 岛外直接就是云和天空。
- 新增 7 朵近景云，放在岬角两侧和下方 16–40 m，岬下方还有 3 块小浮石。
- C 画面下部（棋盘以下）是云海；远处小浮岛和塔状积云按距离做了雾色淡出（烘在顶点色里，不用体积雾）。

### 2.3 v0.2 评审问题的修复
| 问题 | 处理 |
|---|---|
| 巨根像棕色小路 | 根从树台以下改为**埋在草皮下**（z ≈ -2.2），只在树基和岛缘翻出，再沿岩壁垂下 |
| 云有多面体感 | ① 云的顶点色改用**平滑顶点法线**（v0.2 用面法线，云是 unlit，所以按面着色像多面体，这是主因）；② 体素重建后平滑 16 次，减面后再平滑 8 次；③ 近景云 850–900 面/朵，远景降面 |
| 机器人超预算 | 13,908 面（v0.2 约 16.3k）：小叶片、环、苔藓团改为 sub2 |
| 浇水/递花姿势弱 | 浇水：大臂前抬约 75°，壶口下倾 62°，身体前倾低头。递花：弯腰 25°，左臂前伸约 90°，歪头。见 `robot_closeup_poses.png`（3/4 侧面棚拍） |
| 星门/云桥前后差异弱 | 星门 before：4 片藤帘封住门洞 + 碎拱石挡路；after：拱心星发光，两柱顶点亮灯盏，垂两面蓝旗，满门开花。云桥 before：中段 3 块桥板缺失，散落漂浮在不同高度；after：桥板归位，整座桥每 4 块板一对风灯 + 小旗 |

### 2.4 顶点 AO（补偿 Cocos 没有 GI）
- 脚本：`scripts/bake_ao.py`。Cycles AO 烘到临时颜色属性，距离 2.5 m，64 spp。
- 合成：`Col.rgb *= lerp(TINT, 1, 1 − 0.85·(1 − max(ao, 0.3)))`，TINT = (0.50, 0.44, 0.52)，偏冷紫的暗部。**alpha 不动**（alpha 是摆动权重）。
- 不烘的物件：
  - 云、动画小物件、卡片（AO 光线不认 alpha 镂空，会把草地整片压暗，所以烘焙时卡片也不参与遮挡）
  - 机器人（蒙皮动画体）
  - 星庭地砖与星纹状态（共面叠放会被压黑）
- 共烘 22 个物件。

## 3. 动画规格（给 Cocos / Dot）
统一 24 fps，循环 144 帧 = 6 s（星环除外）。GLB 里共 26 个 clip。

| 元素 | 节点 | Blender 实现 | Cocos 建议 |
|---|---|---|---|
| 风车转子 ×2 | `anim_windmill_rotor_0/1` | 绕本地 Y 轴线性转，6 s 一圈 | clip `anim_windmill_rotor_*_spin` 循环；也可脚本 `rotate(Y, 60°/s)` |
| 风铃 ×3 | `anim_windchime_*_pivot` | 绕 X ±10°（2 s）、绕 Y ±7°（1.5 s）正弦 | clip `*_swing` 循环 |
| 飞鸟 2 群 ×4 | `anim_birds_flock_0/1_pivot` + `anim_bird_*` | pivot 绕 Z 公转（6 s 一圈，第 1 群在星庭上空 13 m，第 2 群在树冠外 34 m 反向绕）；单鸟 scale.z 在 1 和 -0.55 之间切换（每 4 帧）表示振翅，并上下起伏 0.8 m | clip `*_orbit` + `*_flap`；被裁掉的鸟（第 2 群）可以不播 |
| 蝴蝶 ×6 | `anim_butterfly_*` | 4 个点贝塞尔游走（每段 1.5 s）；scale.x 在 1 和 0.2 之间切换（每 3 帧）表示振翅 | clip `*_flutter` |
| 星环 | `env_sky_starring_root` | 绕本地 Z，60 s 一圈 | clip `anim_starring_rotate`（1440 帧），或脚本 6°/s |
| 草/花/藤卡片摆动 | 卡片材质 `M_sky_foliage_cards` | 权重存在 **COLOR_0.a**（地面卡片根部 0、顶部 1；垂挂卡片挂点 0、末端 1；`ob["sway"]` 是物件强度：常春藤 0.35，门帘 0.6，其他 1.0）。Blender 预览用 Displace（顶点组 `sway`）+ 移动的噪声（`anim_wind_driver`，只在预览中使用，Cocos 可以忽略这个节点和 clip） | 自定义 effect 顶点着色：`pos.xz += windDir * a_color.a * amp * sin(t*2.0 + dot(worldPos.xz, k))`，amp ≈ 0.25–0.4 m。**注意**：该材质的片元**只用 a_color.rgb 作色**，不要把 a_color.a 乘进 alpha（否则卡片根部会被 alpha test 裁掉）。其他材质 alpha 恒为 1，不做摆动 |
| 瀑布滚动 | `anim_waterfall_scroll` | 第二套 UV `UVScroll`（GLB 中是 **TEXCOORD_1**，v 沿落差每 10 m 重复）+ 条纹贴图 `textures/tex_sky_waterfall_streaks_128.png`；预览材质的 Mapping Y 在 6 s 内从 0 变到 -12（每秒 2 个重复） | 导出的 baseColor 是“调色板 × 顶点色”；在 Cocos 用自定义 effect 把条纹贴图 × uv1 + (0, time*2.0) 乘到基色上 |
| 机器人待机 | `chr_robot_gardener_rig` | `robot_idle` 循环（80 帧） | 默认 clip `robot_idle`；交互时切换 `robot_watering` / `robot_give_flower` |

## 4. C 机位视锥裁剪统计（模拟 Cocos：物件世界 AABB 对 6 个平面；状态只算 after 一套）
| 版本 | 可见物件 | 可见 draw call | 可见三角面（AABB 判定） | 真正落在画面内的三角面（逐顶点） | 总计 |
|---|---|---|---|---|---|
| 原样 GLB，360×780 | 50 / 58 | 54 / 63 | 100,118 | 54,716 | 106,360 |
| 原样 GLB，360×640 | 49 / 58 | 54 / 63 | 101,322 | 55,747 | 106,360 |
| 按区域合并 GLB，360×780 | 33 / 40 | **44** / 52 | 101,182 | 54,716 | 106,358 |
| 按区域合并 GLB，360×640 | 32 / 40 | 44 / 52 | 102,386 | 55,747 | 106,358 |

- 会被裁掉的：树冠（3,520 面）+ 树冠卡片、云桥对面小浮岛、云桥 after 套件、第 2 群鸟。
- **坦白**：AABB 裁剪只省下约 5%。云海、远景积云、岛底岩体、合并后的区域都是跨越整个视锥的大块，所以虽然只有约 55k 面真正落在画面内，GPU 仍要处理约 100k 面。
  - 下一步如需更省：把云海、远景积云按象限切成 4–6 块，再把北半岛的合并体单独拆出来。预计可见面能降到约 70k，draw call 增加约 6。

## 5. 导出
| 文件 | 大小 | 说明 |
|---|---|---|
| export/skycity_v0_3.glb | 5.97 MB（6,260,656 B） | 原样：64 个网格节点，69 个 primitive，107,708 面（含两套状态），1 个 skin（18 骨），26 个动画 clip，COLOR_0 为 VEC4，瀑布有 TEXCOORD_1 |
| export/skycity_v0_3_draco.glb | **1.60 MB**（1,677,492 B） | 同上 + KHR_draco_mesh_compression（level 6；位置 14 / 法线 10 / UV 12 / 颜色 10 bit） |
| export/skycity_v0_3_merged.glb | 5.96 MB | 静态区域按集合合并：46 个网格节点，58 个 primitive（机器人、状态、动画物件、星环、树冠不合并） |
| export/skycity_v0_3_merged_draco.glb | **1.57 MB** | 合并版 + Draco |
| export/skycity_v0_3_collision.glb | 8 KB | 碰撞代理 |
| export/export_stats.json | | 全部统计数据（含逐物件裁剪清单） |

### GGbot 检查器（`team/ggbot/tools/art_import_check.py`）
- 报告：`export/import_check.md` / `.json` / `import_check_stdout.txt`。退出码 1，原因是唯一的红灯：
  - 🔴 GLB 体积 5.97 MB > 主包 4 MB。Draco 版 1.6 MB 可以满足，或者把场景放进分包。
- 🟡 场景三角面 107,708（≤120k，黄灯是因为接近上限）。
- 🟡 原样版 draw call 69（≤80）；合并版 58 是绿灯。
- 同屏三角面（分组混搭）107,302 为 🟢。命名、坐标、缩放、骨骼和权重都是 🟢。
- **检查器读取 Draco GLB 时崩溃**（`read_acc` 的 KeyError: 'bufferView'，Draco 压缩的 accessor 没有 bufferView）。这是检查器自身的限制，Draco 版需要 GGbot 修复后再检查。

## 6. 渲染
- `renders/gameplay_portrait_C.png`、`gameplay_portrait_C_board_overlay.png`（1080×2340，叠加真实棋盘布局）
- `renders/hero_landscape.png`（1600×900）
- `renders/skycity_v0_3_C_anim_360x780.mp4`、`_board.mp4`（6.0 s，24 fps，Cycles 12 spp）
- `renders/robot_pose_*.png`、`robot_closeup_poses.png`、`state_*_before/after.png`、`states_before_after.png`、`compare_C_v0_2_vs_v0_3.png`、`anim_strip.png`、`contact_sheet(_small).png`

## 7. 复现
```
cd art/skycity/v0.3
python3 scripts/gen_palette.py textures && python3 scripts/gen_foliage_atlas.py textures && python3 scripts/gen_waterfall_streaks.py textures
blender -b --factory-startup --python scripts/build_skycity.py            # → skycity_v0_3.blend
blender -b skycity_v0_3.blend --python scripts/bake_ao.py                 # 顶点 AO
blender -b skycity_v0_3.blend --python scripts/render_v03.py -- gameplay hero robot states [--samples 48]
blender -b skycity_v0_3.blend --python scripts/render_v03.py -- gameplay --nor --save   # 把相机写入 .blend
blender -b skycity_v0_3.blend --python scripts/render_v03.py -- video --samples 12      # → renders/anim_frames → ffmpeg
blender -b skycity_v0_3.blend --python scripts/export_glb.py -- export
python3 scripts/make_sheets.py
# Blender 4.5：同样的命令，把 blender 换成 blender-4.5，build 参数加 `-- skycity_v0_3_b45.blend`
```

## 8. 坦白的不足
- 岛形收窄后，v0.2 的星门/云桥位置随之移动。在 C 画面里它们只露出左缘一小段；云桥 after 套件整体在 C 视锥外（它的前后差异主要在近景状态图里能看到）。
- 星庭在 C 画面中仍然偏小（女孩 49 px）。星庭里的动画元素（蝴蝶约 3–5 px、风铃约 6 px）在手机上很细，最显眼的是风车、鸟和摆动的草。
- 近景云的形体还是有点“团块＋尖角”，比 island v2.1 的云硬，后续可以改成手工控制的 puff 布局。
- 卡片摆动在 Cocos 需要自定义 effect（builtin-standard 做不到），瀑布滚动也一样；GLB 只带数据（COLOR_0.a、TEXCOORD_1）。
- AO 是静态烘焙：状态切换后，after 套件不会给周围投 AO；机器人没有烘 AO。
- 树冠降到 sub2 后，主视觉近看能看出团块边缘略有棱角（C 机位看不到树冠）。
- 树基附近的板根依然露在树台上（属于设计，不再横穿草地）。

— grokbot-2（第二个 Grok Bot）
