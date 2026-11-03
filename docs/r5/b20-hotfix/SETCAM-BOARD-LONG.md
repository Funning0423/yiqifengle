# Mac e1974767 转场长帧根因与修法（主线程叠帧）

## Evidence（integrate tip `e1974767` / warm tip `067c69f6`）

- `world.setCamera` max **140ms / 0 shaders**（曾 177）；残余 140 / 111 / 139，均在 `BalloonTransit:flight`，伴随 JUMP 连锁。
- `skycity.board-background` max **106ms / 0**（曾 105，基本持平）；首帧 uploads=2，dc 跳变。
- animateCamera PASS；RT PASS；ready pending=0 criticalPending=0 cached=344。
- warm **after** ready：pending=137 criticalPending=100（enter-level absorb 回灌，非 flight hold 失败）。

## 根因

1. **setCamera 140/139ms**：`apply` 同帧 `setCamera + paint`。paint 在 city 未激活时仍 `showNamed×8` 走整棵 skycity；cityOn/SEAM 阈值帧再叠 `noShadow`/foliage/meadow 树走。shaders=0 → 纯主线程。
2. **board-bg 106ms**：`primeScene` 只开 rig、不开 board-cam → 首写才 uploads；reveal 同帧 `setVisible + presentForPlay`。
3. **B5→board 空窗**：`hold(false)` 后到 reveal 之间 warm 可 compile，叠到 board 窗口。

## 修法（本 tip）

1. TransitionShaderWarm：held 不 compile；安静 held 帧 absorb；`armTransitionHold(n)` 桥接 B5→board。
2. BalloonTransit：city 未激活跳过树走；noShadow/foliage/meadow/hideGlow once；阈值帧 paintDebt 冻镜头；B1 去掉 setCamera 同帧 paint(0)；flight/B5 结束 armHold(180)。
3. SkycityBoardBackground：primeScene 强制 2 帧 board-cam warm draw；setVisible armHold(24)。
4. NativeWorldLevelAdapter：reveal 分帧（setVisible → 下一 after_draw presentForPlay）；hold/note(24)。
5. 不改 RT / fidelity / mask / walk-speed / cine-fx；不 hold 镜头；不上传微信。

## 验收（加严）

过渡窗口内任意 `world.setCamera` / `board-bg` 相关 LONG **均 &lt;100ms**（目标 ≤80），无慢放感；RT 门禁不回退。

## Mac 25faaecf board-bg keep-alive

prime 2 帧后关相机 → reveal 冷开仍 102ms。本 tip：priority=-20 保活暖画 + reveal 三帧拆分。详见 NOTES-SETCAM-BOARD-LONG.md。

## Mac 4df76ffe 回退与晚暖

keep-alive 把 setCamera 从 0 打回 162。本 tip：撤回飞行保活；reveal 前 `warmBeforeReveal` 短暖。详见 NOTES-SETCAM-BOARD-LONG.md。

## Mac d84fe519（tip 07db498b）
warmBeforeReveal(-20) 把 setCamera 打到 223。本 tip：撤回双摄晚暖；texture-only + 恢复 25faaecf prime。详见 NOTES-SETCAM-BOARD-LONG.md。

## Mac 4992e3b1（texture-only 仍 FAIL）

setCamera 163、board-bg 118。撤回 dfd2fe51→29815864 全部晚暖/拆帧差异，恢复 bb8c1fa3/25faaecf 路径；prime 暖画 2→4。详见 NOTES-SETCAM-BOARD-LONG.md。

