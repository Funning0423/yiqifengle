# 方案 A 合成 GLB（build11 坐姿裙子穿凳修复）— INTEGRATE

GLB（不进仓库）：`previews/角色建模bot/planA-final/chr_b_r5g2_planA_final.glb`
- sha256 `405de6c06c4adac0ac6cb207cd738fef916f7932c5b4101f9a49539f4e0df587`，3,125,988 B（gzip -9：1,874,826 B）
- 对比：a96226da（build11）3,493,824 B（gzip 2,153,948 B）→ 少 367,836 B
- 引擎里替换：`region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb`（名字保持一致）
- anim_meta：`anim_meta_planA.json`（本目录，sha256 ad348ab5…8b8c）= b11 anim_meta（cefb3e42）+ `meta_patch_planA_combined.json`

## 取代关系
- **取代 ce4584a2**（sleeve-tex INTERIM GLB dbaf655e）。袖子贴图已在本 GLB（T_G2_FACE_1024 = 最终纯黄版，apply_sleevetex.py 再跑一遍得到相同字节，所以是空操作）。
- 取代 a96226da 的 sit_down / sit_hold / stand_up 三段动画和坐姿布料。

## 内容（逐项核对过）
| 部分 | 来源 | 核对 |
|---|---|---|
| 28 骨骼、节点、IBM、材质、BODY 网格及 morph | a96226da | 完全一致 |
| DRESS/APRON tuck v2 底网格 | a96226da | APRON 690 顶点完全一致；DRESS 5707 顶点逐点对应 a96 中的点（误差 < 5e-7），去掉了 14 个孤岛顶点（wip3 清理孤岛时去掉的） |
| 走路 8 段 + idle/wind/door | a96226da | 字节哈希一致 |
| sit_down/sit_hold/stand_up | pelvislift_cand3_dense | 字节哈希一致（每段 84 个通道） |
| 坐姿布料 morph + BOW 键 | cand7_wip3 (d241a705) | — |
注：cand3_dense 和 wip3 本来就是在 tuck v2 网格上做的（底网格与 a96 一致），所以不需要重新解算，穿模数字和 wip3 一模一样。

## BOW 键名
- 引擎按键名驱动 morph 曲线，所以 BOW 用自己的键名：`bow_sit_drape`（坐下 0→1、坐着 1、起身 1→0，曲线在 meta 补丁里），`bow_stool_fix`。
- **`bow_stool_fix` 在任何 anim_meta 里都没有曲线，所以运行时一直是 0，不起作用。** 留着它是为了保持和 wip3 一样；方案 B 做的时候再决定删掉还是启用。

## anim_meta 补丁（按顺序合并，没有冲突）
1. 角色动画bot `meta_patch.json`：sit_down.cloth_envelope_sit_down_8 全程为 0；stand_up.hand_rest_support 在 0–0.167 s 从 1 降到 0；stand_up.cloth_waist_rise_seam 在 0–0.133 s 从 0 升到 1
2. `meta_patch_cand7_add.json`：sit_drape_blend_comp
3. `meta_patch_cand7_wip3_merged.json`：sit_drape_blend_comp（和第 2 个完全一样）+ bow_sit_drape
`glb` 字段的文件名没改。

## glTF-Validator（2.0.0-dev.3.x）
| | 错误 | 警告 |
|---|---|---|
| a96226da | 8638 | 3790 |
| 方案 A | **0** | 3790 |
- 8638 = 8531 个 ACCESSOR_VECTOR3_NON_UNIT（BODY 第 0/1/2 个 primitive 里 8531 个**没被任何三角形用到**的顶点，法线是零向量）+ 107 个动画/accessor 问题（15 个时间 accessor 没有 min/max，26 个时间不递增，66 个 min/max 不对）。之前报的 24 个是按问题种类和 accessor 数的，不是按条目数。
- 怎么修的：动画时间轴的 min/max，以及所有 POSITION 和 morph POSITION 的 min/max 全部重新算；不递增的那 26 处随着坐姿三段换成 cand3_dense 已经没了；零法线填成 (0,1,0)。这些顶点不会被画出来，所以画面不变。
- 剩下的警告：ACCESSOR_JOINTS_USED_ZERO_WEIGHT 3786 个，NODE_SKINNED_MESH_NON_ROOT 4 个（和以前一样，不影响结果）。

## Cocos 导入
- **Tangents = Exclude**；Normals 保持原样（Blender 导入时会重算法线，所以光照只能在 Cocos 里确认）。
- 脚本：`build_planA.py`（输入 wip3，输出最终 GLB），`qa_walk.py`，`shots.py`，`summ.py`。
