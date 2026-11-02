# setCamera / board-bg 长帧续修笔记（Mac e1974767）

## 根因（对照 e32）
1. **setCamera 140/111/139ms、shaders=0**：非 first-compile。early-flight 与 CITY_ON/SEAM 阈值帧上 `apply` 同帧 `setCamera + paint`（paint 每帧 `noShadow`/整树 `showNamed`/`eachNamed(meadow)`/foliage），叠 JUMP 连锁。
2. **board-bg 106ms、uploads=2**：`primeScene` 只 `rig.active=true`、相机仍关 → 首帧 `skycity.board-background` 才上传；reveal 同帧 `setVisible + presentForPlay`。
3. **warm after criticalPending=100**：ready 后 enter-level absorb 回灌（非 flight hold 失败）。B5 `hold(false)` 到 board 之间有编译空窗。

## 改动
- TransitionShaderWarm：held 时跳过 compile；安静 held 帧仍 absorb；`armTransitionHold(n)` 桥接 B5→board。
- BalloonTransit：showNamed/noShadow/foliage/meadow 走 once/change；阈值帧 paintDebt 冻结镜头一帧；B1 去掉 setCamera 同帧 `paint(0)`；flight/B5 结束 `armTransitionHold(180)`。
- SkycityBoardBackground：`primeScene` 强制 2 帧 board-cam warm draw；setVisible armHold(24)。
- NativeWorldLevelAdapter：reveal 分帧（setVisible → 下一 after_draw presentForPlay）；hold/note(24)。

## 验收
过渡窗口任意 world.setCamera / board-bg LONG **<100ms**，无慢放；RT 不回退；不上传微信。
