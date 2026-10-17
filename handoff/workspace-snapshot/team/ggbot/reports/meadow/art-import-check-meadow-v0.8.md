# 美术导入检查报告

GGbot `art_import_check.py`，静态检查，非 Cocos 导入或真机结果。

## meadow_greybox_v0_8.glb（场景/道具）

SHA256 `8349b9a8f39203e6eb9bcc6296a9cf55f690cba7e659058223cc4ff0a6afe712`，1.38 MB，三角面 78,492，draw call 估算 1165，贴图 4 张

| 检查项 | 结果 | 说明 |
|---|---|---|
| Y-up：根节点没有残留 Blender 的 X ±90° 旋转 | 🟢 | 无 |
| 无负缩放（镜像） | 🟢 | 无 |
| 无非等比缩放 | 🟢 | 无 |
| 世界缩放为 1（或仅一次 K=1.061164） | 🟢 | 无 |
| K 没有被重复施加（K²） | 🟢 | 无 |
| 单位：场景尺寸像米（最长边 1–2000 m） | 🟢 | 包围盒 [560.0, 352.469, 560.0] m（X,Y,Z） |
| Y 范围（信息，天空盒/云海会低于 0） | 🟢 | 最低 Y=-72.469，最高 Y=280 |
| 网格节点命名有前缀（env_/chr_/col_/anchor_…） | 🟡 | 23/23 不合规: ['meadow_clouds_near', 'meadow_far_hills', 'meadow_fence_merged', 'meadow_path', 'meadow_river', 'meadow_river_bank', 'meadow_sky_dome', 'meadow_terrain', 'meadow_trees_merged', 'wind_bell_00'] |
| 名称无空格和非 ASCII 字符 | 🟢 | 无 |
| 网格节点不重名 | 🟢 | 无 |
| 骨骼 | 🟢 | 无 skin |
| glTF 扩展在 Cocos 已知支持范围 | 🟡 | 未确认: ['EXT_mesh_gpu_instancing'] |
| 动画 clip 命名 | 🟢 | [('windmill_sails_loop', 1)] |

预算：

| 检查项 | 实测 | 预算 | 结果 |
|---|---|---|---|
| 场景三角面 | 78492 | ≤120000 | 🟢 |
| draw call 估算（未合批：每个实例的每个 primitive 算 1 次） | 1165 | ≤80 | 🔴 |
| 最大贴图边长 | 4096 | 建议≤1024，上限2048 | 🔴 |
| 贴图显存估算 MiB（RGBA8+mip，未压缩） | 28.33 | ≤64 | 🟢 |
| GLB 文件体积 MB（能否进主包） | 1.38 | 主包整体≤4.0 | 🟡 |

贴图：meadow_palette_256 png 256×256；meadow_ground_v0_8_1024 jpeg 1024×1024；meadow_sky_4096x1024 jpeg 4096×1024；meadow_ground_detail_v0_8_512 jpeg 512×512

## meadow_grass_clump_templates_v0_8.glb（场景/道具）

SHA256 `0e5c88ecaaa062638f323514da0afcfbd57607aea602ce1c125b0baa9521677b`，0.04 MB，三角面 392，draw call 估算 8，贴图 1 张

| 检查项 | 结果 | 说明 |
|---|---|---|
| Y-up：根节点没有残留 Blender 的 X ±90° 旋转 | 🟢 | 无 |
| 无负缩放（镜像） | 🟢 | 无 |
| 无非等比缩放 | 🟢 | 无 |
| 世界缩放为 1（或仅一次 K=1.061164） | 🟢 | 无 |
| K 没有被重复施加（K²） | 🟢 | 无 |
| 单位：场景尺寸像米（最长边 1–2000 m） | 🟢 | 包围盒 [7.503, 1.095, 4.109] m（X,Y,Z） |
| Y 范围（信息，天空盒/云海会低于 0） | 🟢 | 最低 Y=-0.05，最高 Y=1.045 |
| 网格节点命名有前缀（env_/chr_/col_/anchor_…） | 🟡 | 8/8 不合规: ['grass_clump_T0_dark_long', 'grass_clump_T1_mid_long', 'grass_clump_T2_bright_long', 'grass_clump_T3_mid_short', 'grass_clump_T4_bright_short', 'flower_cluster_F0_pink', 'flower_cluster_F1_white', 'flower_cluster_F2_mixed'] |
| 名称无空格和非 ASCII 字符 | 🟢 | 无 |
| 网格节点不重名 | 🟢 | 无 |
| 骨骼 | 🟢 | 无 skin |
| glTF 扩展在 Cocos 已知支持范围 | 🟢 | KHR_materials_specular |
| 动画 clip 命名 | 🟢 | [] |

预算：

| 检查项 | 实测 | 预算 | 结果 |
|---|---|---|---|
| 场景三角面 | 392 | ≤120000 | 🟢 |
| draw call 估算（未合批：每个实例的每个 primitive 算 1 次） | 8 | ≤80 | 🟢 |
| 最大贴图边长 | 256 | 建议≤1024，上限2048 | 🟢 |
| 贴图显存估算 MiB（RGBA8+mip，未压缩） | 0.33 | ≤64 | 🟢 |
| GLB 文件体积 MB（能否进主包） | 0.04 | 主包整体≤4.0 | 🟢 |

贴图：meadow_palette_256 png 256×256
