# b15 出门下台阶 sd3（接篮底修复 fx/r5-b15-basket-floor 333f0b15）

## 问题
333f0b15 加了 3 cm 编织底板：板顶 = 篮局部 Y 0 = 系泊点 0.602（她的起点 P0），草地 0.572。板边在门口 basket 局部 Z +0.84（门扇外侧面下方），之外直接是草地，没有台阶。按 v3b 的直线插值，root Y 在 7.95 m 第一段里从 0.602 线性降到 0.572，出门后几步脚浮约 3 cm。

## 方案（不动手臂、不动上身，只动根 + 双腿 IK）
- **第一步（L，她的右脚，镜像骨架）跨过门槛直接落草地**：v3b 的 L 第一步落点脚跟在 Z 0.787，正好骑在板边（脚跟在板上，脚尖悬空 3 cm）。所以这一步加长 **+0.08 m**（L 摆动 f74→85 内 smoothstep 加到根距离上）。落地脚范围 Z 0.867–1.098，脚跟离板边 2.7 cm。
- **后脚 R** 在板上撑地（f0–89）时用 IK 锁住原位，水平和竖直都锁，所以零滑。抬脚后修正量在 R 的摆动里（f90–108）回到 0，落在草地上。
- **重心下沉**：根 Y 在 s 0.03→0.19 m（clip t 0.13→0.6 s）用 smoothstep 降 30 mm，然后在 L 承重时多沉 6 mm 再回来（膝盖缓冲），clip t 0.8 s 稳定在 -30 mm。下沉的那段由板上的 R 腿屈膝承担（R 膝 26°→33°，平滑），就像人下台阶时后腿控制下降。
- **摆动脚**：越过板边期间，鞋底离板 ≥ FK 高度的一半（f81–83 为 10/7.5/… mm），脚跟过边（f83）后才下落。
- 门、篮、手臂、上身和 v3b 逐帧相同：IK 只改 thigh/shin，foot 保持 FK 世界朝向，脚底保持平。

## 交付
- 预览视频：`stepdown_sd3_side.mp4` / `stepdown_sd3_game.mp4`（全程），`stepdown_sd3_feet.mp4`（f66–125 脚部近景，从门轴对侧低机位拍）。拼图：`sheet_sd3_feet.png`、`sheet_sd3_step_side.png`
- clip：`walk_start_stepdown_preview.glb`（sha256 85af25fc…，只含这一个动作，30 fps，53 帧，1.733 s，rate 1.0）。meta 在 `walk_start_stepdown_meta.json`（624e5dc3…），含逐帧 root_motion（forward_m、y_m）。
  - 这个 clip 替换 walk_start（rate 1.15）以及它前后两个 0.2 s crossfade，两个 crossfade 已经烘在 clip 里，所以两头都是硬切且姿态相同。
  - 还没并进生产角色 GLB，也没跑 compress_keeptr。
- 脚本：`stepdown.py`（基于 getout_v3/v3b.py，参数 SFWD=0.08 SA=0.03 SB=0.19 DIP=0.006 KEEP=0.5）、`export_clip.py`、`feet_cam.py`、`summ.py`
- 逐帧 QA：`qa_sd3.json`（41a0ff8d…）
- 篮 GLB：`src/transport_balloon_333f0b15.glb`（1ec4485d，从 333f0b15 取出，只读）

## QA（30 fps，t=n/30，f0–469 全程，含 idle→door_reach、door_reach→walk、walk_start→walk_loop 的 crossfade）
- **篮体（含底板竖边）× body/dress/apron：0**
- **门扇 × body/dress/apron：0**
  - 门扇最小间隙：身体 1.0 mm（f25，推门手，和 v3b 相同），布料 36.4 mm
- 鞋底按每个顶点下面的真实地面算（板 0 / 草 -30 mm / 最后 2 m +8 mm）：
  - 撑地鞋底范围 L -1.27…+2.84 mm、R -1.9…0 mm。最低值 -1.9 mm 在 f71（R），是 v3b 原有的，也是 v3b 已验收的值；下台阶这段没有新增下沉。
  - 摆动脚越过板边时最低 7.5 mm（f82）。
- 撑地脚滑（两帧鞋底都 < 3 mm）：步伐段最大 L 6.53 mm（f87，L 落地 roll，和 v3b 同帧同值）、R 5.16 mm（f75，与 v3b 同值）。R 在板上 IK 锁定期间 ≤1.7 mm/帧。
  - 全程 top 值都在 heel-strike/toe-off 帧，和 v3b 同一批（巡航段数值跟 v3b 一致）。
- 膝盖每帧最大伸直量：L 7.54°（v3b 7.95°）、R 14.42°（f107，摆动落地前伸展，v3b 是 14.13°）。没有新增突然伸直。
  - IK 解误差 0 mm。膝角在 L 落地后的承重段 16–23°，没有锁死。
- 手臂：没改（不在 IK 链上），和 v3b 逐帧相同。
- 路线：P0 不变 (0.03, 0, 0.395)，L 9.531 m，corner r 1.0 / 95.97°。停步 walk_stop_bodyL，warp 0.979（v3b 是 0.970），因为第一步多走了 0.08 m。

## 未测
- **Cocos 实机全部未测**（clip 并入、root Y 表、硬切、门镜头）。
- 没有并进生产角色 GLB，也没压缩（compress_keeptr）。preview GLB 只做了 Blender 回读：1 个动作，时长对。
- 起身段 standup v1b（968be1d1）没有重跑：它结束在 P0 Y 0（板顶），和 333f0b15 的 0.602 起点一致，篮内不受底板影响（板顶仍是 0）。但新的底板侧边和起身段没有一起跑过 QA。
- test_lakeside_balloon_mooring.cjs 和 LakesideBalloon.ts 不在我的分支（968be1d1 线）上，所以没改。需要代码侧按 INTEGRATE 加下台阶点，测试断言建议见 INTEGRATE。
