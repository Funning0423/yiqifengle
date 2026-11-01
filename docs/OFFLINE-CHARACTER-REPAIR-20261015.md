# 角色离线修复候选（未游戏验收）

输入完整 HEAD：`5a5cc5f071eba2c46c5c4af310be274e0690e09b`。独立 clone：task11/repair-source；分支 `repair/offline-character-20261015`。读取 task9 两份报告、源码并亲看 current-short508.jpg、current-stand-frame.jpg、current-walk-start-confirmed.jpg。仓库没有 `.agents` 或相关 SKILL.md。未消费 Library 云路径，未改 task9、另一个测试副本、窗口、正式存储、权限或凭证，未构建/上传/发布。

## 实际修改与原因

- `stand_up` 的 hips/spine/chest 累积前倾，加上 neck/head 大幅侧转，造成中段头颈躯干关系不自然。重写 spine/chest/neck/head 的世界姿态轨迹，从原世界首末态连续插值，加平滑前倾；补偿 upper_arm 局部旋转以保留原手臂世界方向。未改根、hips、腿骨动作或时长。所有 stand_up 首帧骨骼 TRS 与输入逐值相同。采样缓存修复原字节保留，不把首帧跳变当根因。
- 行走、起步、停步、转向及 idle 的 hand 局部 rest-relative 旋转限制为 28°，减少大幅腕部扭转把 cuff-to-palm annulus 拉成长尖面的情况。起身到 0.95s 后才渐进放松手腕；sit_hold、sit_down 和 door_reach 不改。腕袖拓扑连接已有，279 对同位置同蒙皮接缝的 POSITION morph 一致，没有再加遮盖壳。
- 原坐稳袖口下表面与大腿上的布料支撑层相交。对现有 BODY corrective_stand_up_0 的 171 个顶点做接触区压缩（最大 bind-space 位移约 41.87mm），同时更新受影响 NORMAL morph；保持手掌/手指、布料形变和袖口接缝连接。
- 鞋下部至 74mm 仍刚性跟随 foot，将上部 shin 权重过渡从 94–176mm 扩展为 74–176mm，分散大脚踝夹角下 LBS 的折块。没有改鞋的 bind 外形、索引或材质。
- 在 SoleContactSolver 为悬空脚增加放松，按脚底净空（8–36mm 平滑门控）和小腿倾斜判断；短停 settle 使用真实 stepTarget 门控，避免误用原 clip 贴地状态。目标纵轴脚尖下垂 16°，旋转时补偿 ankle 高度保持同一最低鞋底净空；不作用于已支持的脚或已规划转身。不用 frame508 特判。

## 已完成的离线证据

`evidence/offline-character/validation.json`、`repair.json`、`stand-collision-samples.json`；570 帧 before/after TS 适配器回放 gzip；CPU z-buffer 的前后坐姿、起身、腕、脚近景已亲看。Blender 5.2.2 后台启动 exit139，保留 crash 日志；CPU 渲染是网格复算参考，不是 Cocos 光照、GPU 或游戏截图。

- 实际 aa164cb 坐稳 TRS+morph 复算：袖/围裙 118→0，袖/裙 52→0，手/围裙和手/裙均保持 0；围裙/裙保持 0。腿/裙 **30→30，FAIL 保留**。原 determinant/edge/barycentric 阈值不变。
- 起身五个源 clip+metadata 样点（0.166667/0.3/0.601/0.9/1.2s）无新增手/袖交叉；0.3s 袖/围裙 8→0。原腿/裙 23（0.3s）、53（0.601s），围裙/裙 14（0.166667s）仍保留。不是完整 transition/397 帧穿插验收。
- 0.601s 世界 up 倾角：spine 55.76→33.81°、chest 41.30→25.34°、neck 33.16→10.80°、head 31.80→12.90°；整段 120Hz 头世界最大角速度约 677.81→72.96°/s，颈约 352.57→53.17°/s。此数值与亲看渲染支持轨迹修复，不证明游戏自然度通过。
- 2.8m/4s、120Hz 同步 TS adapter 回放（与实际 fixture 步进方式一致），无新脚逻辑对照复现508：刚性底最低约 40.2206mm，toe/heel 坡度 −1.3774°；候选为 **−13.6532°**，纵轴 −16°，底最低高度不变。右支持脚不变。570 帧内最低脚底高度与对照相同（约 −0.00020mm）。脚踝/后跟全角度游戏验收仍 OPEN。
- 原骨架、inverse bind、材料、图像载荷、网格索引和动画 channel/time 结构保持；有限权重、归一误差 <2e-7；stand_up 原首帧 TRS 保持；`git diff --check` 通过。
- 原 primary 30/60Hz 接地门禁 PASS；TRS evaluator 顺序测试 PASS。
- 扩展距离/步长门禁 **FAIL**：3m@30Hz 最坏滑移 6.74mm >6.32mm。完整 baseline GLB+baseline meta 对照同样 6.74mm，候选也为6.74mm；没有改阈值或称整套通过。最大IK修正由约70.85增为81.91mm，应保留观察。
- action-clock 旧测试 **FAIL**：严格相等断言 `0.9999999999999984 !== 1`；原 CharacterMotion 对照同样失败。未改该测试、阈值或未修改的 WorldIntegrationBoot。

## 交付与复现

完整提交、二进制 format-patch、bundle 和 SHA256SUMS 见 task11/deliverables。合入前核对输入 HEAD；推荐在父侧独立测试副本 cherry-pick 本提交，按原串行流程重新导入/构建/合包。不能覆盖仍在运行的测试包，也不能用本离线报告关闭四项 OPEN。

复现资产：`python3 tools/offline-character/repair_asset.py`（从固定 git baseline 提取输入并核 SHA）。复算：`python3 tools/offline-character/validate.py`。TS replay 用 `tools/offline-character/replay_short.cjs`；需将 QF_TYPESCRIPT_MODULE 指向本机可读 typescript 包，工具本身不启动 Creator。

本阶段保留：腿裙/起身布料穿插，腕袖、脚踝后跟和自然动作的游戏/手机视觉验收，扩展步长门禁及 action-clock 原有失败。候选可以合入隔离副本实测，不能冻结、发布或宣称角色验收通过。
