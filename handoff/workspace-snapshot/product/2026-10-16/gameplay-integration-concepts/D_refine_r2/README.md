# D_refine_r2 · 山丘重逢·坡顶野餐布（第二轮）
- D_refine_r2_concept_720x1280.png / .jpg：概念图（镜头沿用 v3）
- D_refine_r2_mask_720x1280.jpg：遮棋版（R6）
- D_refine_r2_cells_720x1280.jpg：格子尺寸标注版（49 格 91×91 px，下沿 128 px / 上沿 518 px）
- D_refine_r2_fx_clear.jpg：消除效果 4 格（0.00 / 0.12 / 0.32 / 0.70 s，全程约 0.9 s）
- D_refine_r2_vs_D_refine.jpg：和上一轮 D_refine 对比
- D_refine_r2_closeup_QA.jpg：近景验收 4 张（篮子 / 翻折角 / 树下 / 棋子柔影）
- qa.txt：逐条对照 R1–R6 和本轮 9 条问题
- 实测：TRIS_EVAL 34,169；COVER_FG=[]
- scripts/d_r2.py（main|test|fx）、compose.py、annotate.py（来自 v4）、runD.sh
