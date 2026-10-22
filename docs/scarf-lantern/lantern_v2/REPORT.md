# 提灯 v2：右手屈肘提灯在腰前（角色动画bot）

方案依据：Grok Bot 改方案，裙子内收已失败（角色建模bot 88840ce7，docs/accessories/QA_v2_full.md）。旧的 0.65 摆幅系数作废。

## 动作
- 9 段 `*_lantern`：walk_loop、idle_breathing_loop、walk_start、walk_stop_bodyL/R、walk_turn_90_bodyL/R、walk_turn_180、walk_turn_180_bodyR。
- 只改她的右臂（.L：upper_arm.L / forearm.L / hand.L）。左臂、躯干、腿、根、裙、飘带、围巾通道一概不动，所以重心、脚底和脚滑与原 clip 完全相同。
- 姿态（相对 chest，方向固定，最小摆转，不加扭转）：
  - 上臂前屈 16°，外展保持绑定姿态的 10.0°，贴身不外张；
  - 前臂向前、内收 15°、下倾 10°；
  - hand.L 保持绑定局部旋转：腕不弯、不扭（实测腕扭 0°）。
- 随身体起伏：躯干带着手走，另叠加原 clip 上臂/前臂相对均值偏差的 0.15 倍。
- 实测：外展 9.0–12.7°（绑定 10°）；前臂俯仰 −6 到 −21°（转身 90° 峰值时下倾最多）；屈肘 67–68.5°；前臂扭 ≤5.6°；腕扭 0°。
- 手型：用 lantern_hold_R 草案（scarf-lantern/lantern/lantern_hold_R_delta.npz），QA 中权重为 1。角色建模bot 的正式版在 chr_b_scarf_lantern_v2.glb 里，但当前生产基底里还没有这个形态键（见下文“未做”）。
- 灯：角色建模bot 的 prop_lantern_v2.glb，高 11.5 cm。socket.lantern 挂在 hand.L 上，local (0.0138, 0.0803, 0.0073)，按 chr_b_scarf_lantern_v2_anim_meta 取值。

## 灯的钟摆（骨架已满 30 关节，用 socket 节点做程序摆）
参数和接入方式见 INTEGRATE.md。L=0.098 m（周期约 0.63 s），ζ=0.8，支点加速度一阶低通 0.35，软限幅 8°（tanh），每帧 10 个子步。
- 实测摆角：走路 ≤4.6°，待机 ≤0.5°，起步 ≤4.4°，停步和转身 6–8°（软限幅内）。

## QA（t=n/30，30 fps 逐帧，共 1618 帧）
- 场景：9 段单 clip；各段加最大风强（wind_flutter_loop 权重 1，相位 0 和 30）；14 个 crossfade（0.2 s），每个都分有风、无风两种。
- 检查对：
  - 灯 × 腿、身体、左臂、右臂、裙、围裙、飘带；
  - 右臂（不含肩部）× 身体、腿、裙、围裙、飘带；
  - 右手 × 身体、腿、裙、围裙、飘带。
- **结果：穿插合计 0。** 灯到裙/围裙的最小间隙 39.7 mm（出现在 walk_start）。
- 压力测试：灯在每一帧都以 8° 倒向身体，9 段共 430 帧，穿插 0，最小间隙 18.1 mm。这说明 Cocos 端的摆动参数即使有偏差，也有余量。
- 灯 × 右手握把接触三角（110–154）是握持本身：手指包住提环。这一项和角色建模bot 的 G_HAND 口径相同，只作参考，不计入穿模。
- 文件：逐帧表 QA_frames.csv，汇总 QA_table.md，原始数据在 qa/*.json。

## 产出
- lighthouse_lantern_arm_v2.glb：灯塔子包，13,172 B（gzip 5,685 B）。只含 9 段右臂覆盖 clip（各 3 个旋转通道，按 compress_keeptr 算法压缩：手臂 0.2°，最大误差 0.197°）和 9 个祖先链节点。
- 灯塔包 80 KB 预算：本次 13,172 B，加上 prop_lantern_v2.glb 10,132 B（如放在灯塔包），合计 23,304 B，即 28.4%。
- lantern_v2_qa_fullbody.glb：整身合成，只做 QA 和预览用，不进包。
- 预览：
  - lantern_v2_front.mp4、lantern_v2_side.mp4（她的右侧，提灯侧）、lantern_v2_close.mp4（手部近景）；
  - lantern_v2_contact.jpg 拼图：每段 4 帧 × 正面、侧面、近景。

## 未做 / 未测
- Cocos 实机：覆盖层遮罩、同步播放、程序摆、socket 挂点都没测。
- 正式 lantern_hold_R 形态键还不在生产 BODY 上。它需要角色建模bot 的 build_hold.py 重跑到当前基底，会让主包变大。
- 提灯状态下的 sit/stand/door 和取灯、放灯动作不在本次范围。从普通 clip 切进提灯层（拿起灯）的过渡没测。
- 没带围巾网格测。灯塔场景是否戴围巾待定；围巾在颈部，离右臂和灯很远。
- 原 clip 的穿模状态不变：腿和裙是同一套数据。
