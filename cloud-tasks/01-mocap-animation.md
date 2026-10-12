# 任务 1：用真人动捕重做角色动作（Opus 5.5）
**背景**：之前的动作都是从零手工 key 出来的，看着僵硬：手臂摆动不自然，重心和步态别扭。产品决定：改用真人动捕数据，重定向到我们的骨骼上。
**来源**（只用能商用的）：Mixamo（Adobe，免费，可用于游戏）、CMU Graphics Lab Motion Capture（可自由使用）、Quaternius Universal Animation Library（CC0）等。每段动作都要在 `art-src/animation/mocap/SOURCES.md` 里记下来源、片段名和许可。
**要做的片段**（跟现有 anim_meta 的名字对齐，替换现有片段）：idle_breathing_loop、walk_loop（女性、轻松、中慢速，约 0.7 m/s）、walk_start、walk_stop_bodyL/R、walk_turn_90_bodyL/R、walk_turn_180 + bodyR、sit_down、sit_hold、stand_up、door_reach。
**做法**：在 Blender 里用重定向（例如 Rokoko 插件或自写骨骼映射）套到现有骨骼上；脚落地锁定，不滑步；保留动捕的重心转移、髋部和脊柱运动、手臂摆动，只做小幅修正。然后检查裙子、围裙和手的穿模：现有工具链在 `previews/角色动画bot/` 的说明里（run_loco.sh、loco_qa.py、compress/），工作区里没有就按 `art-src/character/HANDOFF.md` 重建。
**验收**：脚滑每步 ≤ 5 mm；膝盖不翻折、不突变；裙子和腿不穿插，余量 ≥ 6 mm；片段首尾能和 idle、walk_loop 无缝衔接；根节点的位移曲线写进 anim_meta 的 root_motion；动画总大小 ≤ 150 KB（压缩后）。交付一段侧面和正面的走路、坐下、起身对比视频（mp4）和拼图。
