# Mac e32f04bf 转场长帧根因与修法（主线程）

## Evidence（integrate tip `e32f04bf` / warm tip `3be0a1c0`）

- `world.setCamera` max **177ms / 0 shaders**（曾 446/12）；残余 164…109，均在 `BalloonTransit:flight`，伴随 JUMP~2m 连锁。
- `skycity.board-background` max **105ms / 0**（曾 490）；首帧 dc 36→280、uploads=4。
- animateCamera PASS；RT PASS；ready 时 pending=0 criticalPending=0 cached=341。
- warm 在 flight 中途再次 absorb：pending 飙到 346 / criticalPending 242；board 前再次 152/115。

## 根因（已非 first-compile）

1. **setCamera 177ms**：flight 全程仍跑 after_draw warm（B1 只 skip 4 帧）。中途 absorb 新材质 → critical 编译与 `apply()`/`setCamera` 叠在同一墙钟帧；一帧变长 → 大 JUMP → 更重帧。
2. **board-bg 105ms**：reveal 同帧 `root.active` + `rig.active`（整棵 skycity GLB 首次启用）+ `presentForPlay`，再叠 warm criticalPending≈115。board-bg 相机首写吃到这坨同步工作。

## 修法（本 tip）

1. `holdTransitionShaders` 改为引用计数；flight / B5 全程 hold，结束再放。
2. flight `beforeDraw` / B5 每帧 `noteTransitionHeavyFrames(2)`；B1 note 提到 8。
3. `SkycityBoardBackground.primeScene`：reveal 前先把 GLB `active=true`、相机仍关，摊掉激活成本。
4. reveal / `setVisible` / board `frame` / `presentForPlay` 扩大 heavy + hold 窗口。
5. 不改 RT / fidelity / mask / walk-speed / cine-fx；不 hold 镜头；不上传微信。

## 验收（加严）

过渡窗口内任意 `world.setCamera` / `board-bg` 相关 LONG **均 &lt;100ms**，无慢放感；RT 门禁不回退。
