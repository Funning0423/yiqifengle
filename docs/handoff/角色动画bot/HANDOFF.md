# HANDOFF — 角色动画bot — 分支 anim/b17-landing-standup

- 分支：anim/b17-landing-standup（基于 anim/b15-basket-standup @ 7fff7b6a / 动画交付 968be1d1）
- 日期：2026-10-23（America/New_York）
- 续派：Grok Bot DECISIONS-2026-10-22 · b17 着陆 0.40 m 姿势跳变

## 当前规划
消除 b17 着陆姿势跳变：动画侧沿用 basket standup（座位朝门 + stand_up root_motion 到 P0）；运镜/适配器侧必须接线，禁止着陆直 cancelAndReset。

## 进度（本里程碑）
- **底板重验通过**：用 FX 底板篮 `transport_balloon_333f0b15.glb` 对 sit_hold→stand_up→idle（接 getout t0）30 fps 全段重跑。
- 与 v1b QA **逐字段 0 差异**：篮×body/dress/apron/bow = 0；起身滑步 ≤1.24 mm/帧；膝无突直；臂外展起身 ≤57.7°。
- 动画侧**无需修改**（座位/根位移/时序仍用 968be1d1）。
- **不需要**角色建模bot。

## 交付 SHA
- 本交接提交之后见 `git rev-parse HEAD`（本文件为其提交内容）。
- 动画内容基线：968be1d1（standup v1b）。
- 上一 handoff：7fff7b6a（anim/b15-basket-standup）。

## 验收要点（给 Grok Bot / 运镜bot）
1. **禁止**着陆 `cancelAndReset` 直切 P0（flog 再现脚跳 ~0.396 m、同帧转 ~128°）。
2. **必须**采用已合入 `gbt/r5-integrated-b15`（b8c6fd30 / 4b7f6f32 / bebe76f3：RegionJourneyAdapter + LAKESIDE_STANDUP）的 standup 接线：
   - board：座位 basket-local `(0.032, -0.1, -0.099)` + `seatYawDeg`（朝门）。
   - 着陆：sit_hold → stand_up（1.2667 s，root_motion forward 0.494 m）→ cancelAndReset standing@P0（idle crossfade 0.2）再进 getout。
3. `cine/r5-b17-home-fade` 若仍直 cancelAndReset，需合入上述接线（**代码侧归 Grok Bot / 运镜bot，本 bot 不改 RegionJourneyAdapter**）。
4. 门镜头总时长 +约 1.27 s。

## 已测 / 未测
- **已测**：Blender 30 fps 逐帧（含 crossfade）篮×身/布、脚滑、膝、臂外展；底板 333f0b15；根到位误差 0 mm。
- **未测**：Cocos 实机；lakesideDoorLens 真实门镜头；未重渲 mp4（数值与 v1b 一致）。

## 待办（暂停；勿继续做）
- 等 Grok Bot / 运镜bot 把 standup 接线合入 b17 分支（或确认 gbt 集成路径已覆盖着陆）。
- Cocos 实机门镜头验收不在本 bot 范围。
- 其它既有暂停项（灯笼腿形变 shape keys、handloop/v3e 顶点索引、lakeside driver 两改、雪山雪地 walk）仍挂各自 HANDOFF / 他分支，本项不延续。

## 预览和产物路径（不进仓库）
- 原 v1b：`/workspace/yiqifengle/previews/角色动画bot/b15-balloon/standup/`（REPORT.md、qa_v1b.json、mp4、blend）
- 本重验：`/workspace/yiqifengle/previews/角色动画bot/b15-balloon/standup/qa_b17_recheck/`（REPORT.md、qa_b17.json、b17.blend、standup.py、transport_balloon_333f0b15.glb）

## 通用说明
- 负责人：角色动画bot（女孩角色动画，Cocos 3.8.8 / Blender 4.5.3：`/workspace/tools/blender-4.5.3-linux-x64/blender`）
- 规则：工作到阶段即推 GitHub 后暂停（2026-10-22）；失败则 bundle。预览和大文件只写路径，不进仓库。
- 基点：int/v1 = 084ccf6c246bdb22650bcbb8de634f4d56b80a9c
- 骨架：30 关节，.L = 她的右侧；无锁骨/围裙骨。骨架已满，不能再加骨。
- QA 标准：30 fps 逐帧（含过渡）；0 穿模、无滑步(≤15mm)、无膝盖突直、手臂不外张、手腕不扭。自然运动优先，穿模靠布料侧。
