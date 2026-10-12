# 坐姿垂坠（sit_drape）

任务：`cloud-tasks/03-sit-drape.md`。结果和数据：`cloud-tasks/RESULT-sit-drape.md`。重建：`bash art-src/animation/sit-drape/build_all.sh`（从 022fcad 的 glb 开始，需要 Blender 4.5 LTS 无界面版 + python3 numpy/scipy）。

| 步骤 | 脚本 | 做什么 |
|---|---|---|
| 1 | `sim_dress.py`（Blender） | 黄裙布料模拟：站立 → sit_down（根节点按 anim_meta 往后滑）→ sit_hold 第 0 帧静置；碰撞体 = 身体、房间里真实的椅子（`combined_visual_m.glb` 的 `env_int_prop_reading_chair`）、地面。只当**目标形状**用。 |
| 2 | `fit_bones.py` | 坐稳那一帧（sit_hold t=0）8 根裙骨各一个刚体修正，让 LBS 尽量贴近目标；腰带、蝴蝶结不跟着动。 |
| 3 | `compose.py` | 剩下的差（平滑后）做成黄裙形状键，≤ 20 KB（每个动了的顶点 14 B）；碰撞修正（腿、椅子、地面、手）；围裙：腿上那片按高度场铺在黄裙和大腿上面（跨过两腿之间的缝），腰带最后再推出黄裙。 |
| 3b | `resolve.py`（Blender）+ `finalize.py` | 用 Blender BVH 做三角形级的穿插检查，把剩下的几个穿插一点点推开，再换回绑定空间的差值。 |
| 4 | `fit_follow.py` | 形状键是固定的，其他时刻（sit_hold 臀部前后晃约 27°、sit_down 后段、stand_up 前段）只能靠裙骨带着走：目标 = 坐稳的形状跟着身体蒙皮移过去，按权重和原来的 LBS 混合，加腿/椅子惩罚。 |
| 5 | `build_glb.py` | 写 glb（稀疏 POSITION 形变目标：DRESS / APRON 各 `sit_drape` + 占位 `sit_drape_mid`；3 个片段里 10 根裙骨的通道），写 anim_meta 的权重曲线、`settle_time_s`、`morph.meshes`。 |
| 检查 | `verify.py`（Blender） | 运行时 glb 按驱动的方式摆（根节点位移 + 曲线权重），逐对数三角形穿插。 |
| 出图 | `render_seated.py` / `render_override.py` / `sheet.py` | 预览图、对比图、关键帧表。 |
