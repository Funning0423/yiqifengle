# HANDOFF — 角色动画bot — 分支 anim/standup-perf-morph

- 分支：anim/standup-perf-morph（基于 anim/b17-landing-standup @ 97fc3243）
- 日期：2026-11-04（America/New_York）
- 续派：Grok Bot · 产品经理 BRIEF · 起身卡顿 · 帧率优先（体验版 1.0.202611031613 @ fb74d437）

## 当前规划
降低 sit→stand 动画侧 morph 负担；不改手臂；runtime 预热归 GGbot。

## 进度（本里程碑）
- **结论**：主因是 stand_up morph 暴涨（新开 ~27 路）+ GPU MORPH COUNT53/73；AnimRig rebuild 仅启动一次，非起身元凶。
- **已改** `region_island/character/anim_meta.json`：删 stand_up 噪声/task21 尖峰 8 条、抽稀 envelope、删 sit_down 零 door 曲线、驱动表摘未用 target。
- tip：`docs/handoff/角色动画bot/STANDUP-PERF-20261104.md`

## 交付 SHA
- 见本提交 `git rev-parse HEAD`。
- 上一 handoff：97fc3243（anim/b17-landing-standup）。

## 验收要点（给 Grok Bot / GGbot）
1. 合入本 anim_meta 后起身应少若干 setWeight 尖峰；**shader COUNT 需建模砍 key 才会降**。
2. GGbot：起身前 warm-sample stand_up；预热 MORPH 宏 COUNT53/73；勿在 sit→stand 重建 AnimRig。
3. QA：围裙/裙瞬时穿帮 → collider/短 corrective，禁止拧腕。

## 已测 / 未测
- **已测**：曲线统计、fb74 日志 rebuild 时机、AnimRig 源码、岛上 GLB morph 槽。
- **未测**：手机实机帧率；Blender 视觉回归；网格砍 key 后 COUNT。

## 待办（暂停；勿继续做）
- 等 GGbot 预热 + 产品经理合入体验包验证。
- 角色建模bot 砍未用 shape key（可选，结构性）。
- b17 着陆接线等仍挂旧 HANDOFF，本项不延续。

## 预览和产物路径（不进仓库）
- `/workspace/yiqifengle/previews/角色动画bot/standup-perf/`（curve_analysis.json、patch_stats.json）

## 通用说明
- 负责人：角色动画bot（女孩角色动画，Cocos 3.8.8 / Blender 4.5.3）
- 规则：工作到阶段即推 GitHub 后暂停；失败则 bundle。预览和大文件只写路径，不进仓库。
- 基点：int/v1 = 084ccf6c246bdb22650bcbb8de634f4d56b80a9c
- QA：30 fps；0 穿模、无滑步(≤15mm)、无膝突直、手臂不外张、手腕不扭。自然运动优先，穿模靠布料侧。
