# setCamera / board-bg 长帧续修笔记（Mac 25faaecf）

## 根因（对照 bb8c1fa3 / 25faaecf）
1. **setCamera PASS max=0**（上一 tip 拆 paint/setCamera 已过）。
2. **board-bg 102ms/0 @ f9200**：`primeScene` 仅 2 帧 warm 后 `camera.enabled=false`；reveal `setVisible` 再开 = 冷启用 + uploads≈2。同帧还曾叠 `root.active`。`armTransitionHold` 在 SkycityBoardBackground 未 import（try/catch 吞掉）。
3. **warm after criticalPending≈101**：ready 后 absorb 回灌，非本帧主因（shaders=0）。

## 改动（本 tip）
- SkycityBoardBackground：import `armTransitionHold`；`primeScene` 以 `priority=-20` + source `skycity.board-prime` 在世界镜头下暖画 **8 帧并保持 enabled**；`setVisible(true)` 只把 priority 拉回 44（不再冷开）；primed 后 `setVisible(false)` 保活 GLB。
- NativeWorldLevelAdapter：reveal 三帧拆分 call=`root.active` → after_draw1=`setVisible` → after_draw2=`presentForPlay`；hold/note(32)。

## 验收
过渡窗口 board-bg LONG **<100ms**（目标 ≤80–90）；setCamera/animateCamera 不回退；RT 不回退；不上传微信。
