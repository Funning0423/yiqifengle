# Mac 81c841d4 转场长帧根因与修法

## Evidence（integrate tip `81c841d4` / warm tip `0f5c84b6`）

- `world.setCamera` fr=5976 **446ms / 12 shaders**：12 条全是 `builtin-unlit` + skin + morph（53/16/3/73±PRECOMPUTED），**不是** standard/PCF2 风暴。
- `skycity.board-background` **490ms / 0**、206ms/0：shaders=0，uploads=2；同秒 `criticalPending` 飙到 684，并刷屏 `Invalid program … reflect-map-fs`。
- warm 在 ready 时 `criticalPending≈300–430`，cached≈248–350；残余 SHADOW_TYPE2=0/12（这批 unlit 本就不该带 TYPE2 → OK）。

## 根因

1. **setCamera 446ms**：departure shadow bag 暖的是 standard+PCF；真正首编的是 **unlit/planar + morph** 的 live 宏（FOG4+HDR，planar 无 FOG）。morph 73 还带 `CC_MORPH_PRECOMPUTED1`。
2. **board-bg 490ms + 慢放**：非 RT thrash。`criticalPending` 把 `reflect-map-fs` / fwd / pipe 算进门闩；设备上这些 family 永远 Invalid，`tries` 又不耗尽 → 每帧继续啃 Invalid，reveal 首帧与 board 激活叠在一起。

## 修法（本 tip）

1. `LIVE_UNLIT_MACROS`（FOG4+HDR）暖 unlit；planar 走 live；hot unlit 另暖 PRECOMPUTED morph。
2. `CRITICAL_CACHE_NEEDLES` 去掉 reflect/fwd/pipe；`tries>12` 或 reflect 一 miss → `exhausted`，不再计入 `criticalPending`。
3. `noteTransitionHeavyFrames(n)`：B1 / board reveal / `presentForPlay` 跳过若干 after_draw warm。
4. 不改 RT / fidelity / mask / walk-speed / cine-fx；不上传微信。

## 验收（加严）

过渡窗口内任意 `world.setCamera` / `board-bg` 相关 LONG **均 &lt;100ms**，无慢放感；RT 门禁不回退。
