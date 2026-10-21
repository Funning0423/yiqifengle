# 走路髋部左右摆幅 cand1 (on planA_final)
- GLB: chr_b_r5g2_planA_hipsway65_cand1.glb  sha256 adde69a6ebf1ae04e202932cbcd0fe5f70bb7a23064812fb6285980ff19bf05b, 3,194,476 B (planA 3,125,988 B; +68 KB 主要是旧走路 accessor 未清理)
- 方法 sway.py：hips 横向(X) 相对 walk_loop 平均位置缩放 K=0.647；walk_start 前 20 帧、walk_stop 最后 20 帧 smoothstep 回到原样（站立两端不变）；腿用解析两骨 IK，脚踝位置+脚的世界旋转逐帧等于原版（误差 0.0005 mm），膝盖保持原膝盖平面；手臂局部旋转=mocap；髋部旋转(roll)未改。压缩 compress_keeptr.py (rot 0.2°, legs 0.03°, tr 0.1 mm)。walk_turn_* 有各自的髋轨道，未改。
- 摆幅 (hips X 峰峰值 mm)：walk_loop 100.5→65.0；walk_start 121.1→93.0（含起步重心转移，步态部分 72→47）；stop_bodyL 74.3→50.4；stop_bodyR 64.8→51.4
- 膝盖屈曲变化 −0.2…+2.3°；压缩后脚相对 planA 最大偏差 0.6 mm（stop_bodyL 右脚尖），滑步与原版相同
- 裙子×身体 (max/sum) planA→cand: start 135/5755→130/5577, loop 59/727→50/670, stopL 59/998→57/990, stopR 146/4342→135/4309；手×裙子/围裙 0 不变
- 其余 10 段动画、28 骨、IBM、网格与 planA 完全一致 (cmp_cand_vs_planA.txt)
- 视频：walk_side_before_vs_after.mp4, walk_back_before_vs_after.mp4（左 planA 右 cand；“back”机位在 −Y）
- 未测：0.8 m/s (1.14×) 播放下在 Cocos 实机看；游戏 SoleContactSolver 下的滑步
