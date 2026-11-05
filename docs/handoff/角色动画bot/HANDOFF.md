# HANDOFF — 角色动画bot — 分支 anim/standup-perf-morph2

- 分支：anim/standup-perf-morph2（基于 anim/standup-perf-morph @ 299afe73）
- 日期：2026-11-05（America/New_York）
- 续派：Grok Bot · 产品经理 BRIEF · 真机 A/B · 起身仍卡 · 要更深砍 morph（feel-control 1.0.202611050247 @ 0421cfff）

## 当前规划
查清 COUNT53/73 根因；动画侧无法安全真砍 skirt 修形槽时正式转建模。

## 进度（本里程碑）
- **结论：需建模（C）** — live GLB = APRON53 / DRESS73；shader COUNT 跟网格 shape key 走；tip1 曲线 cull 不降 COUNT。
- `seat_fix_*` / `skirt_back_thin_*` 为建模坐姿裙修形（满权），禁止动画侧当无引用删除。
- tip1 安全噪声仅 11 槽（53→48 / 73→68），不够体感；不交伪降 COUNT 的 GLB tip。
- 路径 B（起身低 morph 变体）缺 GGbot runtime 热切换。
- tip：`docs/handoff/角色动画bot/STANDUP-PERF-COUNT-20261105.md`

## 交付 SHA
- 见本提交 `git rev-parse HEAD`（文档 tip；无资源伪降）。
- 上一 tip：299afe73（anim/standup-perf-morph，曲线层）。

## 验收要点（给 Grok Bot / 角色建模bot / GGbot）
1. 建模把 seat_fix/skirt_back 烘成少量 basis，目标 COUNT APRON/DRESS ≤16（过渡 ≤32/35）。
2. 动画 bot 随后重接 anim_meta；勿再瘦表盖 FAT GLB。
3. GGbot：按新 COUNT 预热；无 AnimRig sit→stand 重建。
4. QA：坐/起裙穿透不回归；禁止拧腕外撇。

## 已测 / 未测
- **已测**：live morph 名表、tip1 vs repo 驱动对照、宏↔mesh、无 morph 变体 API。
- **未测**：建模降 COUNT 后真机起身；烘培视觉。

## 待办（暂停；勿继续做）
- 等角色建模bot 出降 COUNT GLB。
- 等 PM 决定 tip1 叠合下 seat_fix 不驱动是否可接受至建模完成。
- 勿再只改曲线交差。

## 预览和产物路径（不进仓库）
- `/workspace/yiqifengle/previews/角色动画bot/standup-perf-count/cut_list.json`
- 上一刀：`/workspace/yiqifengle/previews/角色动画bot/standup-perf/`

## 通用说明
- 负责人：角色动画bot（女孩角色动画，Cocos 3.8.8 / Blender 4.5.3）
- 规则：工作到阶段即推 GitHub 后暂停；失败则 bundle。预览和大文件只写路径，不进仓库。
- 基点：int/v1 = 084ccf6c246bdb22650bcbb8de634f4d56b80a9c
- QA：30 fps；0 穿模、无滑步(≤15mm)、无膝突直、手臂不外张、手腕不扭。自然运动优先，穿模靠布料侧。
