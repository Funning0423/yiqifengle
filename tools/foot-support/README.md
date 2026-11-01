# 本轮脚底接触候选（2026-10-14）

输入 39561d0e76808bf6d1f6c3ee671aa420d575edd4。保留全部14动作与既有造型、骨骼、网格、材质、蒙皮和绑定。

坐起/坐下：以原资产 `output/character-repair/original.glb` 的足端轨迹为目标，保留上一轮55mm骨盆校准，120Hz双腿IK避免稀疏采样插值破坏接触。起身淡化只混合上肢，匹配的下肢按输入姿势播放。

行走：`SoleContactSolver` 在控制器移动、采样与混合后执行世界鞋底接触约束。点来自该鞋刚性权重与逆绑定矩阵，低位6mm接触窗口；当前活动接触点残差的极值中心给出水平修正，双腿两骨IK保持原脚朝向与膝弯曲平面。不动根路径、骨盆或上肢。升空时逐步释放水平偏移。只在起步、循环步和停步应用，转身与静坐原契约保留。

原测试与全部门槛未修改，STOP_WARP_MAX仍.05。原walk-suite有2FAIL/2SKIP：旧匀速根运动也被求解器保护，故“旧路径必须明显更滑”的比较失效；3.7m stopR仍9.10mm>当前原公式预算6.33mm，未通过。主要toDoor从25.06降至6.62mm，3.2m从26.05降至6.63mm。不能称全部运动或美术通过。

可重建GLB：从输入commit取出动态GLB到/tmp/input.glb，运行

    python3 tools/foot-support/build_seat_samples.py --input /tmp/input.glb --output /tmp/candidate.glb --report /tmp/ik.json

本轮输出已与该脚本重建结果逐字节比对一致。测试：`tools/walk-driver/test_action_transitions.cjs`、`tools/walk-driver/test_walk_driver.cjs`（设置QF_TYPESCRIPT_MODULE为Creator自带TypeScript）。原test_walk_driver的FAIL应如实保留；独立指标和微信截图见task-9/evidence，未更改测试断言。

微信验收采用本轮唯一s5窗口、正式WorldR5Integration入口和独立内存存储测试包。无发布上传；生成物与原存储证据均只在本地。整体人物/靴型未统一、开门肘褶皱不自然仍失败，CPU近景不能代替手机/完整动画验收。

后续30Hz同指标加测：toDoor 18.36mm（原24.96mm），仍超过12mm。`test_contact_acceptance.cjs` 保留此失败并exit1，在输出中分别记录60Hz原门槛通过与30Hz未通过；不把exit1改成通过。跨帧率接触时序仍需修复，当前候选不能作为最终验收版本。
