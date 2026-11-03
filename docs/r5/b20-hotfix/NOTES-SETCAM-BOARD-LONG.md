# setCamera / board-bg 长帧续修笔记（Mac 4992e3b1 → 恢复 25faaecf）

## 根因（对照 25faaecf PASS setCamera=0 vs 4992e3b1 FAIL 163 / board 118）
1. **dfd2fe51→29815864** 引入的 `warmBeforeReveal` / `touchBoardGpu` / cam defer / 三阶段 reveal，破坏了 `bb8c1fa3`（Mac integrate `25faaecf`）的 setCamera=0 路径；双摄晚暖更曾把 setCamera 打到 223。
2. **board-bg**：25faaecf 已压到 **102ms**（只差 2ms）；后续晚暖/保活均未能破 100，且回退 setCamera。应先恢复基线，再只在 **enterLevel 窗**做极小 prime 加暖（不开飞行第二摄）。

## 改动（本 tip）
- **完整恢复** `SkycityBoardBackground` / `NativeWorldLevelAdapter` / `LevelBackground` 到 `bb8c1fa3` reveal 行为：无 warmBeforeReveal、无 touchBoardGpu、无 cam defer、两阶段 reveal（setVisible → presentForPlay）。
- **补** `armTransitionHold` import（bb8 有调用无 import，被 try/catch 吞掉）。
- **极小步**：`primeScene` board-cam 暖画 **2→4** 帧，armHold(20)，然后 **DISABLE**（飞行期无双摄）。
- 不 hold 镜头；不改 fidelity/mask/content/walk-speed；不抢 cine/fx；不上传。

## 验收
过渡窗口 setCamera / board-bg 相关 LONG **均 <100ms**（board-bg 目标 ≤80–90）；animateCamera / RT 不回退。若本 tip 仅恢复 setCamera≈0 而 board 仍 ~100，handoff 写明。
