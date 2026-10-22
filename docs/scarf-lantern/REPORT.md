# 围巾烘风 + lantern_hold（角色动画bot，2026-10-22）
## 产物
- planB_cand3b_ribbonwind4b_stepdown_scarf.glb：生产版 stepdown（31ebfa53）+ 角色建模bot build_scarf.py 重跑（scarf.tail idx29 父 neck，LOD0_G2_SCARF）+ 15 个 clip 各补一条 scarf.tail rotation 通道
- planB_cand3b_ribbonwind4b_stepdown_scarf_anim_meta.json：wind.mask += scarf*，wind.scarf（系数 0.5、上限、轴），planB.scarf_anim，accessories.scarf_v1
- 其余通道逐通道逐元素与生产版一致（verify_channels.json：bad=[]，nodes 相同，无显式插值）
## 烘焙（src/scarf_bake.py）
- 各 clip：neck 局部"等效重力"（重力−neck 加速度）下垂方向 ×0.6 → 阻尼弹簧 ζ0.45/1.5 Hz；身体后仰时胸口托住尾巴（不计静态向后分量）；静止/坐姿=自然下垂
- 上限：后 ≤10°（walk_turn_180_bodyR 后 =0°），前 ≤35°、左右 ≤20°，行走/待机类给风留余量，风强最大叠加后也不超（.scarf.json with_wind_max）
- 接缝：接 walk_loop 的一端对齐 walk_loop f0，接静止的一端=静态下垂，9 帧 smoothstep
- wind_flutter_loop：前扬 0..17.5°（只向前上扬，不向后）+ 左右 ±10°（=0.5×35/20，烘进 clip；运行时无逐骨系数），f0=0，4 s 内整周期闭合；顺风/顶风同一套
- 压缩：compress_keeptr.py 同法（贪心插关键帧，slerp+nlerp 4 倍细分误差 ≤0.5°），LINEAR 默认不写插值，新数据一个 bufferView；动画 +10.6 KB，围巾网格 +18.4 KB
## QA（src/qa_scarf.py，30 fps 逐帧，分类器同 角色建模bot qa_acc.py）：见 QA_scarf_table.md
- W0 全部 14 clip、Wmax（walk*/idle，风层权重 1，相位 0/15/30/45 帧）、22 个 crossfade（0.2 s，含 Wmax 版）
- 101 行：99 行 0 穿模；sit_down / idle→sit_down 的 脸/下巴/头发 命中与无通道基线完全相同（已知 sit_down 低头过深单），围裙/裙子命中比基线少
## lantern_hold（lantern/）
- 骨架已满 30、无手指骨 → 手指层只能是 BODY 形变 lantern_hold_R；lantern_hold_R_delta.npz = BODY 三个 primitive 的 bind 空间 POSITION 位移（primN，按 glTF 顶点序）
- 曲指 MCP/PIP/DIP = 40/85/55°，绕手宽轴卷向掌心，只动 hand.L 权重 >0.5 的手指顶点（150/96/96 个），腕和手臂不动
- 握把间隙（卷起的手指到 φ12 握把面）+1.0 mm；手指×手掌 3 对接触（指尖贴掌，blocking 级）；注意：按规格的 socket (0.010,0.080,0.006) 静止时握把轴离指根皮肤只有 2.2 mm（握把面入肉 3.8 mm），建议 socket 沿掌心法线再外移约 4 mm
- 提灯走路右臂摆幅系数建议 0.65（upper_arm.L/forearm.L 绕周期平均姿态 slerp，hand.L 不动不扭腕）：腕前后摆 20.3→15.2 cm；lantern_walk_swing_1.0_vs_0.65.mp4（灯是 v1 16 cm 未缩，裙子穿模属建模侧）
