# A3：从草原点「回家」时海浪从 0 渐入
- 分支 fix/a3-home-sea-fadein（基于 09a1b8e），**未合入** integration 线。
- 提交 c49801b56b057396523c2d1ca210bc52e7e23745（1 个提交）
- 改动：AmbienceAudio.update 记录"上一帧是否由自己让海浪在播"（bedOn）。如果上一帧在播、这一帧却被别的东西停了（场景切换回家），就把平滑音量清零，从 0 重新渐入，不再从旧的 0.44 直接起播、叠在 BGM 淡入上冲到满幅。滑杆拉到 0 时由自己暂停，不触发清零，所以滑杆拉回时仍立即恢复（wind-audio 测试覆盖）。
- 新测试 tools/test_home_sea_fadein.cjs（已加入 run-suite）：起播第一帧约 0.037，约 2 s 回到 0.4 以上。
- Suite 54 项，49 项通过；没通过的只有已知 5 项（production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract 失败，navigation-guard BLOCKED）。见 suite.txt。
- 包体：源码 AmbienceAudio.ts +284 B（4 行），压缩后进包预计 <+100 B；tools 不进包。需要 Mac 实测。
- 应用：`git fetch fix-a3-home-sea-fadein.bundle fix/a3-home-sea-fadein:fix/a3-home-sea-fadein`（前置提交 09a1b8e），或 `git am 0001-*.patch`。
- 只在本地：没有 push，没有 force，没有动主线。
