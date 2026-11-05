# HANDOFF — b20 integrate landing visual (board-bg2)

> **【重点标记】ROOT HIT · 2026-11-05** 周期整机掉帧命中 `TransitionShaderWarm`。体验版 `1.0.202611050759` @ `dc248d14`，Funning「不卡了」。保持 `TRANSITION_SHADER_WARM_ENABLED=false`；未经 Funning 不要 `setTransitionShaderWarmEnabled(true)`。全文 `docs/fps/PERIOD-STUTTER-TSW-ROOT-HIT-20261105.md`。

> **【进度备注 · 2026-11-05】** 现行体验版 `1.0.202611060228` @ `02c9bd5e`。小游戏开发/测试暂停，交接 Clonebot。`docs/handoff/PM/PROGRESS-060228-PAUSE-20261105.md`。

- Tip: see `git rev-parse HEAD` on `gbt/r5-b20-integrate-landing-visual`
- Base RT: `ggbot/b20-meadow-c-skycity-rt` @ `b8c289aef7cc4f4e41a73be5487193d1bbd44ed2` (func `2179dd9953b6db16ef08b861a3c9308ef6a564e6`)
- + cine `05c6ff1f` / `f2075503` (sea-landing / B5 stand at spawn_girl)
- + fx `f9269a91` / `6f95dd71` (meadow black faces + skycity island visibility)
- Prior integrate tip was `ac9a0aeb` on `4804822f`; this rebuilds on board-bg label-resize tip.
- No WeChat upload.
