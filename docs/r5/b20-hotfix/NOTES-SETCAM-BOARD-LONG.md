# setCamera / board-bg 长帧续修笔记（Mac 4df76ffe 回退）

## 根因（对照 25faaecf PASS setCamera=0 vs 4df76ffe FAIL 162）
1. **dfd2fe51 / e0799907 keep-alive**：`primeScene` 在 enterLevel 就把 board-cam 以 `priority=-20` **一直开着**到 reveal。飞行全程双摄（world + board），主线程/GPU 叠在 `BalloonTransit:flight` 的 `world.setCamera` 上 → **162/148ms**（shaders=0）。after-ready `criticalPending` 143→185。
2. **board-bg 仍 105**：保活并未压破首写；LONG 仍在 `regionLandingToBoard → skycity.board-background` 首帧（uploads≈1）。根因是暖机窗口离 reveal 太远，飞行中途关/开或状态冷却。

## 改动（本 tip）
- **撤回飞行期 keep-alive**：`primeScene` 只短暖 4 帧后 **DISABLE**（飞行不再双摄）。
- **reveal 前晚暖**：新增 `warmBeforeReveal`：在 reveal 调用时以 `priority=-20` / `skycity.board-prime` 再暖 4 帧并短暂保持，随后 `setVisible` 只把 priority 拉到 44。
- NativeWorldLevelAdapter：reveal = root + late warm → 等 warmLeft → setVisible → presentForPlay；hold/note(36)。
- 不 hold 镜头；不改 fidelity/mask/content/walk-speed；不抢 cine/fx；不上传。

## 验收
过渡窗口 setCamera / board-bg 相关 LONG **均 <100ms**（board-bg 目标 ≤80–90）；animateCamera / RT 不回退。
