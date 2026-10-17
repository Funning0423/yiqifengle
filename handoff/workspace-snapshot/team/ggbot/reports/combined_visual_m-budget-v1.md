# GLB 资源预算检查报告

生成：GGbot `glb_budget_check.py`（静态分析，非 Cocos 导入/真机结果）

预算来源：dev-plan-v1.1 §4、§3 E2。

## combined_visual_m.glb

- SHA256 `158f0b42c534234ae46d68fc574cf84810900bb451d22c8b29656bcd6b28cf6c`
- 大小 6,225,724 B（5.94 MB）
- 生成器 pygltflib@v1.16.5；扩展 KHR_materials_specular, KHR_materials_unlit
- 体积构成：json 0.15 MB，bin_total 5.79 MB，images 0.36 MB，animations 0.92 MB，geometry_and_other 4.51 MB
- 数量：meshes 39，mesh_nodes 24，skinned_nodes 12，materials 8，textures 5，images 3，animations 1，skins 12，nodes 184

| 检查项 | 实测 | 预算 | 结果 |
|---|---|---|---|
| 场景三角面 | 74799 | ≤120000 | 🟢 |
| draw call 估算（未合批：每个实例的每个 primitive 算 1 次） | 24 | ≤80 | 🟢 |
| 最大贴图边长 | 1024 | 建议≤1024，上限2048 | 🟢 |
| 贴图显存估算 MiB（RGBA8+mip，未压缩） | 3.33 | ≤64 | 🟢 |
| GLB 文件体积 MB（能否进主包） | 5.94 | 主包整体≤4.0 | 🔴 |

### 贴图

| # | 名称 | 格式 | 尺寸 | 文件 | 显存估算 | 判定 |
|---|---|---|---|---|---|---|
| 0 | env_palette_emissive_256 | png | 256×256 | 0 KB | 0.33 MiB | 🟢 |
| 1 | env_palette_256 | png | 256×256 | 2 KB | 0.33 MiB | 🟢 |
| 2 | env_window_views_1024 | png | 1024×512 | 366 KB | 2.67 MiB | 🟢 |

### 三角面最多的网格（前 15）

| 网格 | 实例 | primitive | 每实例三角面 |
|---|---|---|---|
| env_island_props_merged | 1 | 1 | 26,748 |
| env_cloud_layer | 1 | 1 | 7,914 |
| env_interior_props_merged | 1 | 1 | 7,707 |
| env_lighthouse_ext | 1 | 1 | 7,609 |
| env_sea_surface | 1 | 1 | 5,688 |
| env_interior_shell | 1 | 1 | 5,189 |
| env_island_main | 1 | 1 | 4,312 |
| env_prop_palm_young_01 | 1 | 1 | 924 |
| env_lighthouse_door | 1 | 1 | 844 |
| env_prop_palm_tall_01 | 1 | 1 | 810 |
| env_int_anim_small_props | 1 | 1 | 782 |
| env_sea_foam | 1 | 1 | 720 |
| env_prop_palm_lean_01 | 1 | 1 | 706 |
| env_sky_dome | 1 | 1 | 672 |
| env_anim_turtle_01 | 1 | 1 | 644 |

注意：静态分析，不等于 Cocos 导入结果或真机数据。 draw call 是未合批上限估算；同材质静态合批或 GPU instancing 后会更低。 Cocos 导入后包体以构建产物为准（导入会转成 .bin/.json，体积可能与 GLB 不同）。
