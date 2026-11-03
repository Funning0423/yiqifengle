# setCamera / board-bg 长帧续修笔记（Mac e987bf7a → 恢复 setCamera≈0 且保住 board=0）

## 根因（对照 25faaecf setCamera=0 / board 102 vs e987bf7a setCamera 164 / board 0）
1. **代码差仅 SkycityBoardBackground.primeScene**：`left=2→4`、`armHold(16→20)`，并把 `armTransitionHold` **真正 import**（25fa/bb8 调用了但未 import，try/catch 空转）。
2. **SkycityBoardLive.keepActive** 在构造与每次 setVisible 后强制 `rig.active=true`，飞行全程 board GLB 常驻；prime 4 帧把更多 mesh/upload 拉活后，飞行 `BalloonTransit:flight` 的 `world.setCamera` 窗（shaders=0）叠上 board 主线程 tick → 164/158/110ms。
3. board-bg=0 来自 enterLevel 窗内 4 帧 board-cam 暖画（uploads 提前），应保留暖画，但暖完必须 **关 cam + 关 rig**，且 Live 不得在飞行期 keepAlive。

## 本 tip
- prime：保留 **4** 帧暖画；`armHold(16)`；**去掉** prime 内 `armTransitionHold`；暖完 `camera off` + `rig.active=false`。
- Live：`keepActive` 仅 `shown`（reveal）后；构造不再强行激活；`setVisible(false)` 保持 inactive。
- armHold：只在启动 tick 时 `holdTransitionShaders(true)`，避免重复加 holdDepth。
- 不 hold 镜头；不改 fidelity/mask/content/walk-speed；不抢 cine/fx；不上传。

## 验收
过渡窗口 setCamera LONG **&lt;100ms**（最好≈0）；board-bg **保持 &lt;100**（目标 ≤80–90）；animateCamera / RT 不回退。
