# 方案A 验收 (chr_b_r5g2_planA_final.glb sha256 405de6c0…f587) — 2026-10-21
QA 全部按 30fps (t=n/30)；交叉淡化按 CharacterMotion 0.2 s 线性/slerp + morph 权重线性。
两种 morph 配置：fixed = anim_meta_planA 全部曲线都生效；gameAsIs = 按 anim_meta_planA 的 morph.meshes 实际能驱动的（sit_drape_blend_comp、bow_sit_drape 没有登记 → 0）。

## 1 来源核对
- sha256 一致。三段坐姿 vs pelvislift_cand3_dense：逐 accessor 完全一致（84 通道，maxdiff 0）。
- 走路 4 段（以及转身 4 段、idle、wind、door）vs A1 v4 final (a96226da)：完全一致。“重烘版”就是 v4 final 的走路。
- 28 骨骼：关节顺序、IBM 绑定矩阵、静止 TRS 都与 v4 final 和 cand3_dense 一致。
- 网格：APRON/BODY/BOW 的 base 与 v4 final 一致；DRESS 5721→5707 顶点（角色建模bot 的清理）；新增 sit_drape_blend_comp（APRON#29、DRESS#32）、BOW bow_sit_drape/bow_stool_fix。
## 2 anim_meta_planA.json — FAIL
- 与生产差异：sit_down.cloth_envelope_sit_down_8 / stand_up.hand_rest_support / stand_up.cloth_waist_rise_seam 与我的 meta_patch.json 完全一致 ✔；新增 sit_drape_blend_comp、bow_sit_drape 曲线（3 段）。
- **morph.meshes 与生产一字不差**：缺 LOD0_G2_APRON.sit_drape_blend_comp:29、LOD0_G2_DRESS.sit_drape_blend_comp:32、整个 LOD0_G2_BOW {bow_sit_drape:0, bow_stool_fix:1}。CharacterMotion 只驱动 morph.meshes 里登记的 target（名字→索引），所以照现在合入，游戏里这两条曲线不生效。以前批的 "LOD0_G2_BOW":{"targets":{"sit_drape":0}} 也已失效（键已改名 bow_sit_drape）。其余登记索引与 GLB targetNames 全对。
## 3 三段 + 交叉淡化逐帧（fixed / gameAsIs / v4 网格基线 / 原版生产 clip）
| 项 | 结果 |
|---|---|
| 裙子×凳子、围裙×凳子、身体×凳子 | 0 / 0 / 0 全程 PASS |
| **蝴蝶结×凳子** | **FAIL**：fixed sit_down f24–35 最多 88、stand_up f1–9 最多 44；gameAsIs 另外 sit_hold 全程 44 |
| 手/前臂×围裙/裙子/身体 | 0（三段全帧 + 两个交叉淡化 31 帧，两种配置）PASS |
| sit_hold 手搭间隙 | 右手(hand.L) 0.69 mm、左手(hand.R) 0.66 mm，无穿入（原版左手悬空 17.8 mm）PASS |
| 接缝 | sit_down末↔sit_hold、sit_hold↔stand_up首：骨骼最大差 0.088°(skirt.left.low)、0 mm，morph 差 0 PASS |
| 脚踝/脚尖滑步、膝盖 | 与原版完全相同（ankle ≤1.9 mm/帧, toe ≤2.5, 膝 step 同原版）PASS |
| stand_up 手腕 | 峰值速度 = 原版(1.794/1.530 m/s)；开头加速度峰 hand.R 24.4 vs 原版 33.1，更平滑 PASS |
| **sit_down 落手逐帧** | **小幅 FAIL**：f29/f34/f35/f36 比原版快 0.2–0.5 mm/帧（hand.L 9.08/3.61/4.11 vs 8.65/3.17/3.92；hand.R 10.00/4.21/4.77 vs 9.57/3.75/4.57） |
| 过渡段 裙子×身体 | sit_down 398/7164 vs 原版 393/5908；stand_up 378/3998 vs 264/3046 → accepted, deferred（方案B） |
| 过渡段 裙子×围裙、围裙×身体 | 不高于原版（sit_down 36 vs 49；stand_up 138 vs 135 峰值略高 → accepted, deferred） |
| sit_hold 裙子×身体/围裙×身体/裙子×围裙 | 0/0/0（原版 174/43/28）PASS |
| stand_up 交叉淡化脚 | 模拟里脚踝 x 来回约 18 mm（xB01–06），与之前已通过的 cand/v4 完全相同（根运动线性插值导致，游戏由 SoleContactSolver 处理）— 未变化，未在 Cocos 验证 |
| 走路 4 段 手/前臂×裙子(A1 指标)、滑步 | 与 v4 final 完全相同（0 相交，最小间隙同），clip 字节一致 → 滑步不变 PASS |
文件：perframe_clips.csv, perframe_crossfades.csv, summary_clips.json, seamA/B_{game,hands}_prod_vs_planA.png, hands_prod_vs_planA.mp4, wrist_speed_accel.png, metadiff.txt, meshes_check.txt, cmp_sit.txt, cmp_v4.txt
