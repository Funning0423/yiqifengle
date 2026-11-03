# setCamera / board-bg 长帧续修笔记（Mac d84fe519 回退）

## 根因（对照 25faaecf PASS setCamera=0 vs d84fe519 FAIL 223 / board 101）
1. **dfd2fe51 keep-alive** 与 **07db498b warmBeforeReveal(-20)**：在飞行或 B1 窗口启用第二摄（board-cam priority=-20），与 `world.setCamera` 同窗叠画 → setCamera **162→223**（shaders=0）。25faaecf / bb8c1fa3 无此双摄，setCamera max=0。
2. **board-bg 仍 ≥100**：晚暖双摄未能把首写压破 100；且加重了 setCamera。应改用**不开第二摄**的手段。

## 改动（本 tip）
- **撤回 -20 / leaveOn / board-prime 晚暖双摄**：`warmBeforeReveal` 改为 **texture/pass getGFXTexture 预上传 only**（`touchBoardGpu`），不 `bgCamWarmOn`。
- **恢复 25faaecf prime 路径**：`primeScene` 短暖 2 帧 priority=44 后 **DISABLE**（飞行期无双摄）。
- **reveal 分帧**：root + texture warm → setVisible（cam 再 defer 一帧）→ wait → presentForPlay；hold/note(24)。
- 不 hold 镜头；不改 fidelity/mask/content/walk-speed；不抢 cine/fx；不上传。
- node-lens 171/56 记为残余，本 tip 不强求清。

## 验收
过渡窗口 setCamera / board-bg 相关 LONG **均 <100ms**（board-bg 目标 ≤80–90）；animateCamera / RT 不回退。
