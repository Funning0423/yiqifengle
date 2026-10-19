# r5 袖子贴图修复 + Icosphere 核查：INTEGRATE 说明（角色建模bot）

日期：2026-10-18（America/New_York）。GLB 不进仓库，只放在 previews 下；本说明只在 `work/角色建模bot` 本地提交，没有 push。

## 1. 替换哪个文件
- 仓库路径：`creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb`（`.meta` 不动，uuid 保持不变）
- 旧（当前生产版）：git blob `f94800dc7d2829b81ad368992ffd8b8a6958761c`，3,584,600 B，
  sha256 `bb37efb59f558e4a80dbed1082dd048914084adf3518353292980e35474fab3f`。
  r5 各条线（`bc81575f` = r5-integrated-b07、`825018e4`、`anim/r5-wrist-footik`、`cine/r5-lakeside-*` 等）里都是这一份。
  注意：本地 `int/v1`（`084ccf6c`，10-12）里还是更早的 blob `21874c72`（2,115,652 B，没有 morph，6 个材质），已经过期，不是基准。
- 新：`/workspace/yiqifengle/previews/角色建模bot/r5-sleeve-tex/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2_sleevetex.glb`
  3,572,024 B（比旧版少 12,576 B），sha256 `dbaf655e903fa397a71bc8730fe0aed562e242023330b15c6cd96a5eb0226936`。
- 集成方式：把新文件按原文件名覆盖到上面的仓库路径，然后核对 sha256。

## 2. 改了什么
- 只改了一张贴图：`T_G2_FACE_1024`（材质 `M_G2_FACE`，网格 `LOD0_G2_BODY` 的第 0 个 primitive），bufferView 105，39,870 B 变成 27,305 B。尺寸还是 1024×1024，格式还是 JPEG（4:2:0，量化表和原图一样）。
- **袖子实际用的是这张贴图，不是 `T_G2_BODY_1024`**：
  - 袖子顶点（upper_arm / forearm 权重为主，共 1970 个三角形）的 UV 全部落在 v = 0.495 这一条线上（u 从 0.585 到 0.88）。那里画的是一条约 32 px 高的渐变条，从橄榄黄 (203,178,23) 过渡到浅黄 (254,241,83)，上下都是肤色底 (254,226,205)。
  - 渐变里浅的那一段，加上远景 mip 时肤色底渗进来，在湖边 3.5 s 镜头里就成了"黄色和肤色交替、像透出手臂"的条纹。
- 修法：把矩形 x 544–991、y 448–543（px，对齐 16 px MCU）整块涂成纯黄 (251,233,39)，也就是上身和裙子贴图的主黄色（裙子贴图黄色的中位数是 (252,234,38)）。渐变条连同上下的 padding 一起覆盖，远景 mip 也不会再混进肤色。
  - 写入方式是 jpegtran `-drop` 无损块替换：矩形以外的 DCT 块逐字节保留。解码后矩形外只有边上 1 px 因为色度上采样有变化（1092 px），这些像素都没有被任何三角形采样。
  - 栅格化校验：被改动的像素里，被非袖子三角形（脸、头、脖子、领口、胸前、手）采样的有 **0 个**。手的 UV 是单点 (0.8, 0.28)，肤色没动。
  - 袖口没有加描边（原来袖口那条浅线来自渐变的浅端，现在是纯黄）。
- JSON 只有 bufferView 的 byteOffset / byteLength 和 buffer.byteLength 变了，其余和旧版完全一样。BIN 里其他 709 个 bufferView 逐字节一样，901 个 accessor 的数据逐个比对也一样。

## 3. 没改什么
- 节点 34、骨骼 28（R5G2_RIG_22P4，名字、顺序、inverseBindMatrices 不变）、蒙皮权重、动画 14 段 / 504 个 channel、morph（APRON 29、BODY 每个 primitive 16、DRESS 32，targetNames 不变）、网格名、材质名（8 个）、贴图名（5 个），都没动。
- `T_G2_BODY_1024`（实际是 256×256 JPEG）没动。它只被 `M_G2_BODY` 用：`LOD0_G2_BODY` 的 primitive 4（以 thigh 权重为主的腿 / 袜子，y 在 0.53–1.09）和 `LOD0_G2_BOW`（UV 是单点）。袖子不采样这张图，改它对袖子没有效果。
- **Icosphere 不在 GLB 里**：34 个节点 = 28 骨骼 + 4 网格 + RIG + ROOT，meshes 只有 4 个，没有孤立的 accessor 或 bufferView。运镜bot 看到的 2 m Icosphere 是 Blender 4.5 glTF 导入器自己生成的骨骼显示形状（`pose.bones[*].custom_shape`，放在 `glTF_not_exported` 集合里），Cocos 不会加载到它，所以 GLB 里没有可删的东西。在 Blender 里预览时把 `Icosphere*` 设成 hide_render 即可，`render_base.py` / `bl_light.py` 已经这样做了。
- 没有在 Blender 里导入再导出，anim_meta.json 和 CharacterMotion.ts 都没碰。

## 4. 校验
- 重新解析新 GLB：节点 34、joints 28、animations 14、morph 数量如上、没有 Icosphere；JSON 除 offset 外相同；accessor 数据全部相同。
- Khronos glTF-Validator（npm gltf-validator）：新旧两版都是 24 E / 4 W / 2 I / 20 H，一模一样。这 24 个 error 是旧版就有的 ANIMATION_SAMPLER_INPUT_ACCESSOR_WITHOUT_BOUNDS（sit_hold / stand_up 等 clip 的 input 缺 min/max），不是这次引入的。
- 渲染（Blender 4.5 EEVEE，用运镜bot `tools/lakeside-landing-cam/render_shots.py`，加了 GIRL_GLB 覆盖；场景是 /tmp/lkr22 = 825018e4 导出，v2.2 shots.json 的 t = 3.50 机位）：
  - `previews/角色建模bot/r5-sleeve-tex/cmp_lakeside_t3.50.png`（390×844 原机位，左旧右新）
  - `cmp_lakeside_t3.50_girl_crop.png`（同机位 2× 渲染，裁到人物）
  - `cmp_sleeve_closeup.png`（同方向 1.25 m 袖子特写）
  - `uv_layout_face_tex_before_after.png`（贴图前后对比和改动矩形），`uv_layout_body_tex_users.png`（T_G2_BODY_1024 的实际使用者）
- 没测：Cocos Creator 3.8.8 导入和真机 / 微信小游戏上的显示（只在 Blender 里验证过）；包体预算。
