# D_refine · 山丘重逢·坡顶野餐布（精细版）
- D_refine.png / D_refine.jpg：720×1280 概念图（v3 相机：30mm、俯仰 55°、竖向 FOV 61.93°）
- D_refine_fx_clear.jpg：消除效果 4 格关键帧（0.00 按下光环 / 0.12 鼓起 1.18× / 0.32 收缩 0.55×，蒲公英种子+萤火虫爆出 / 0.70 上飘淡出、新子落入；全程≈0.9s）
- D_refine_vs_v3.jpg：和 v3 D 对比
- D_refine_closeup_QA.jpg：近景验收（右下篮子压角 / 左上布边+树下）
- 实测：TRIS_EVAL 41,992（≤45k）；格子每行每列 91×91 px，列宽差 0
- 灯光：暖色太阳从右后方照来（影子落向左前，不压棋盘）+ 树上灯笼点光；无雾、无光柱
- 故事细节：秋千绳上一黄一蓝两条围巾（阿芳/阿宁）、树下两双鞋、靠着树干的红封信
- 脚本：scripts/d_refine.py（main|fx）、scripts/compose.py（调色+拼图）、scripts/runD.sh
