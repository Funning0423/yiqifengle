# setCamera / board-bg 长帧续修笔记（Mac e32f04bf）

## 根因
1. setCamera 177ms/0：非首编；flight 中 warm 仍 after_draw 编译 + absorb 风暴，叠 JUMP 连锁。
2. board-bg 105ms/0：skycity GLB 首次 `rig.active=true` 与 board 相机首写、warm critical 同窗。

## 改动（本 tip）
- BalloonTransit：修好误插 import；flight/B5 `holdTransitionShaders` + rolling note；B1 note(8)。
- TransitionShaderWarm：hold 引用计数。
- SkycityBoardBackground：`primeScene` + setVisible/frame hold/note。
- NativeWorldLevelAdapter：prime + reveal hold/note(12)；ManagedMobileBoardUI present note(10)。
- 测试 + SETCAM-BOARD-LONG / INTEGRATE tip 记录。

## 给 Grok
合本 tip（功能 SHA + tip SHA 见 commit）。窗口内任意 setCamera / board-bg LONG &lt;100ms，无慢放，RT 不回退。不上传微信。
