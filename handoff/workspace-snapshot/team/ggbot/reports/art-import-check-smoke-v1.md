# 美术导入检查报告

GGbot `art_import_check.py`，静态检查，非 Cocos 导入或真机结果。

## combined_visual_m.glb（场景/道具）

SHA256 `158f0b42c534234ae46d68fc574cf84810900bb451d22c8b29656bcd6b28cf6c`，5.94 MB，三角面 74,799，draw call 估算 24，贴图 3 张

| 检查项 | 结果 | 说明 |
|---|---|---|
| Y-up：根节点没有残留 Blender 的 X ±90° 旋转 | 🟢 | 无 |
| 无负缩放（镜像） | 🟢 | 无 |
| 无非等比缩放 | 🟢 | 无 |
| 世界缩放为 1（或仅一次 K=1.061164） | 🟢 | 无 |
| K 没有被重复施加（K²） | 🟢 | 无 |
| 单位：场景尺寸像米（最长边 1–2000 m） | 🟢 | 包围盒 [565.258, 341.391, 565.258] m（X,Y,Z） |
| Y 范围（信息，天空盒/云海会低于 0） | 🟢 | 最低 Y=-58.762，最高 Y=282.629 |
| 网格节点命名有前缀（env_/chr_/col_/anchor_…） | 🟢 | 0/24 不合规: [] |
| 名称无空格和非 ASCII 字符 | 🟢 | 无 |
| 网格节点不重名 | 🟢 | 无 |
| 每个 skin 骨骼数 ≤22 | 🟢 | 12 个 skin，最多 8 根；超标: [] |
| 每顶点权重 ≤4 | 🟢 | 蒙皮顶点 13643，超 4 权重 0，有 JOINTS_1/WEIGHTS_1: False |
| 权重归一化（和为 1） | 🟢 | 未归一 0 |
| glTF 扩展在 Cocos 已知支持范围 | 🟢 | KHR_materials_specular, KHR_materials_unlit |
| 动画 clip 命名 | 🟢 | [('idle_loop', 225)] |

预算：

| 检查项 | 实测 | 预算 | 结果 |
|---|---|---|---|
| 场景三角面 | 74799 | ≤120000 | 🟢 |
| draw call 估算（未合批：每个实例的每个 primitive 算 1 次） | 24 | ≤80 | 🟢 |
| 最大贴图边长 | 1024 | 建议≤1024，上限2048 | 🟢 |
| 贴图显存估算 MiB（RGBA8+mip，未压缩） | 3.33 | ≤64 | 🟢 |
| GLB 文件体积 MB（能否进主包） | 5.94 | 主包整体≤4.0 | 🔴 |

贴图：env_palette_emissive_256 png 256×256；env_palette_256 png 256×256；env_window_views_1024 png 1024×512

## skycity_v0_2.glb（场景/道具）

SHA256 `c119eb1615fd7941459a755e2ecf06c75d37653f0c06a5b315b2216d20d61afb`，7.36 MB，三角面 120,639，draw call 估算 47，贴图 2 张

| 检查项 | 结果 | 说明 |
|---|---|---|
| Y-up：根节点没有残留 Blender 的 X ±90° 旋转 | 🟢 | 无；其他有旋转的根（锚点朝向等，属正常）: anchor_robot_root, anchor_spawn_girl, env_sky_starring_root, state_ring_before, state_ring_before_stars |
| 无负缩放（镜像） | 🟢 | 无 |
| 无非等比缩放 | 🟢 | 无 |
| 世界缩放为 1（或仅一次 K=1.061164） | 🟢 | 无 |
| K 没有被重复施加（K²） | 🟢 | 无 |
| 单位：场景尺寸像米（最长边 1–2000 m） | 🟢 | 包围盒 [1266.51, 218.803, 1440.848] m（X,Y,Z） |
| Y 范围（信息，天空盒/云海会低于 0） | 🟢 | 最低 Y=-165.345，最高 Y=53.458 |
| 网格节点命名有前缀（env_/chr_/col_/anchor_…） | 🟡 | 11/43 不合规: ['state_ring_after_stars', 'state_bridge_after', 'state_bridge_before', 'state_court_after', 'state_court_after_flowers', 'state_court_before', 'state_gate_after', 'state_gate_after_flowers', 'state_gate_before', 'state_ring_before'] |
| 名称无空格和非 ASCII 字符 | 🟢 | 无 |
| 网格节点不重名 | 🟢 | 无 |
| 每个 skin 骨骼数 ≤22 | 🟢 | 1 个 skin，最多 18 根；超标: [] |
| 每顶点权重 ≤4 | 🟢 | 蒙皮顶点 11222，超 4 权重 0，有 JOINTS_1/WEIGHTS_1: False |
| 权重归一化（和为 1） | 🟢 | 未归一 0 |
| glTF 扩展在 Cocos 已知支持范围 | 🟢 | KHR_materials_emissive_strength, KHR_materials_specular |
| 动画 clip 命名 | 🟢 | [('robot_give_flower', 54), ('robot_idle', 54), ('robot_watering', 54)] |

预算：

| 检查项 | 实测 | 预算 | 结果 |
|---|---|---|---|
| 场景三角面 | 120639 | ≤120000 | 🔴 |
| draw call 估算（未合批：每个实例的每个 primitive 算 1 次） | 47 | ≤80 | 🟢 |
| 最大贴图边长 | 512 | 建议≤1024，上限2048 | 🟢 |
| 贴图显存估算 MiB（RGBA8+mip，未压缩） | 1.67 | ≤64 | 🟢 |
| GLB 文件体积 MB（能否进主包） | 7.36 | 主包整体≤4.0 | 🔴 |

贴图：tex_sky_palette_256 png 256×256；tex_sky_foliage_512 png 512×512
