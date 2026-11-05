# HANDOFF — 角色动画bot — 分支 anim/standup-perf-count-meta

- 分支：anim/standup-perf-count-meta（基于 anim/standup-perf-morph2 @ 7b552be9）
- 日期：2026-11-05（America/New_York）
- 催叠：StandupProgramWarm `5bde177a` · 最短路径可叠 tip

## 当前规划
建模 aggressive COUNT 瘦包已交付；本 tip 出正式 anim_meta 并成对可叠。

## 进度（本里程碑）
- **正式 anim_meta**：`status=standup-perf-count-v1-FORMAL`
- sit_hold 补 `seat_bake_sit_*` settle 常值；sit_down plateau；stand_up sit-bake release + stand bake
- 驱动表 COUNT 16/15/15/3 对齐 tipNames；摘已删名
- tip 写明：**必须成对叠** `chr_b_standup_count_v1.glb` + 本 meta；禁止瘦表盖 FAT
- 穿透照抄建模（sit_hold 0.26 / sit_down 3.48 / stand_up 9.29 cm）；不改手臂

## 交付 SHA
- 见本提交 `git rev-parse HEAD`
- 上一 tip：7b552be9（morph2 文档）；建模 GLB sha256 `e3fbce98…1eb86`

## 验收要点
1. Feel 同时换 GLB+meta；日志 COUNT16/15（非 53/73）。
2. 禁止 thin meta×FAT 或 FAT meta×thin。
3. seat_bake_* 解钳 / 穿透 round-2 = 后轮。
4. Warm `5bde177a` 按新 COUNT 预热。

## 已测 / 未测
- **已测**：GLB tipNames ↔ morph.meshes 索引一致；sit_hold bake≠0；曲线无幽灵名。
- **未测**：真机 Feel 叠合；解钳后视觉；全量 skirt-leg 门禁。

## 待办（暂停；勿继续做）
- 等 Feel / Grok Bot 成对叠包 + Warm。
- 视觉精修 / clamp 豁免交后轮（GGbot 或本 bot 续派）。
- 勿再为 9.29cm 改手臂。

## 预览和产物路径（不进仓库）
- `/workspace/yiqifengle/previews/角色动画bot/standup-perf-count/`（anim_meta.json + GLB 副本 + tip 旁路）
- 建模源：`/workspace/yiqifengle/previews/角色建模bot/standup-perf-count/`

## 通用说明
- 负责人：角色动画bot（女孩角色动画，Cocos 3.8.8 / Blender 4.5.3）
- 规则：工作到阶段即推 GitHub 后暂停；失败则 bundle。预览和大文件只写路径，不进仓库。
- 基点：int/v1 = 084ccf6c246bdb22650bcbb8de634f4d56b80a9c
- QA：30 fps；自然运动优先；穿模靠布料侧，禁止拧腕外撇。
