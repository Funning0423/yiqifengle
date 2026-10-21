# 方案A fix1：anim_meta morph.meshes 补登记
- 输出 previews/角色建模bot/planA-final/anim_meta_planA_fix1.json（sha256 3b85b0cd…），由 GLB 实际 targetNames 生成。
- 新增：LOD0_G2_APRON.sit_drape_blend_comp=29、LOD0_G2_DRESS.sit_drape_blend_comp=32、LOD0_G2_BOW {bow_sit_drape:0, bow_stool_fix:1}。没有旧的 BOW sit_drape 条目，所以无需删除。
- 用 fix1 重跑 qa3：结果与 planA 报告的一致。sit_down 中 BOW×凳 88/643，裙×身体 398/7164；stand_up 中 BOW×凳 44/294，裙×身体 378/3998；sit_hold 全 0。走路四段的手×布为 0。BOW×凳交给方案B 处理。
