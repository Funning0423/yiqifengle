# r4.1 Mac 验收清单（界面验收部）

构建：HEAD `e4a05b982aaa5b98053ef71eeacff91f37cb8f56`（分支 `integration/build05-r41-20261017T125738Z`，bundle 在本目录，前置 2153a65）。用 `tools/build-guard/build-wechat-guarded.sh` 构建（web 录音版 + wechat 包各一），报告微信包字节数及与 r4 的差值（上限 24,641,536 B；估算 +约 48 KB）。

## A. 棋盘提示条在托盘上方（74c696e）
- [ ] 7 个竖屏尺寸 + 横屏截图：提示条位于托盘上方，各区域一致，不挡女孩、不进入顶部微信胶囊按钮区。
- [ ] 短屏 375x667、320x568：托盘下移 20 pt、略缩小，可接受且不挡工具；其它尺寸托盘与 r4 完全一致。
- [ ] 最长的工具提示缩到约 0.92×，仍清晰可读、不出提示条。

## B. 草甸落点 → 棋盘（fd1a39d，运镜bot 未能在 GPU 上验）
- [ ] 7 个竖屏尺寸：落点切入棋盘零跳变。
- [ ] 女孩距托盘、提示条、工具栏都 ≥16 pt。
- [ ] 08→09 计时：比 Build05 长约 +1.19 s（最小屏上限 2.98 s），记录实测值。

## C. 出门脚步（b1e41b2）+ 户外响度（e4a05b9 = Voice Bot f125cd2）
- [ ] 木地板/地毯/门口石板/小路/草地都能听到脚步，与脚落地同步。
- [ ] 户外脚步按地面分档响度；风大时提升 ≤ +6 dB；每种地面 4 个变体响度一致（无单步掉没）；室内（木/地毯）与 r4 一致。
- [ ] **录屏（有声）**：出门（屋内→小岛）和回家（小岛→椅子）各一段，按运镜bot 的录制步骤：
  `/workspace/wechat-game/team/voice-bot/outbox/20261017T121502Z-r4-exit-footsteps/recording-yunjing/README.md`（脚本在 `/workspace/wechat-game/team/voice-bot/outbox/20261017T121502Z-r4-exit-footsteps/recording-yunjing/kit/`：`run.sh`、`rec2.cjs`、`A_exit.json`、`B_return.json`、`C_gating.json`、`mux4.py`）。保持音乐滑块默认 0.4、音效开、未静音，录前设 `globalThis.__worldFlowLog=true`。
- [ ] **用 Voice Bot 的 recording_levels.py 测量**：脚本随 f125cd2 提交，见
  `/workspace/wechat-game/team/voice-bot/outbox/20261017T132651Z-r4.1-outdoor-step-levels/patches/0001-r4.1-exit-footsteps-outdoor-steps-10-12-dB-under-mus.patch`
  （说明见同目录 `README.md`；在 r4.1 代码里路径为 `tools/exit-footsteps/recording_levels.py`）。
  运行：`python3 tools/exit-footsteps/recording_levels.py <录制目录> A_exit out_A.json`，以及 `... B_return out_B.json`。
  - [ ] 户外脚步比环境声（音乐+环境）低 **10–12 dB**（`underDb` 中位 ≈ 11；偶发 ±4 dB 来自浪/海鸥，可记录不算失败）。
  - [ ] 脚步与落脚对齐 **≤ 40 ms**（用 `tools/exit-footsteps/footstep_align.cjs` 或 steps.csv 核对）。
  - [ ] 无突然响度跳变（门口 木↔石板 ≤ 3 dB，户外相邻步 ≤ 3.3 dB）。

## D. 出门/回家中途切后台（77883aa，本次修复）
分别在 **出门途中**（屋内走路、开门、穿门到小岛之间各取一个点）和 **回家途中** 切后台 **3 s** 和 **10 s**，共至少 4 段有声录屏：
- [ ] 回来后女孩从原位置、原动画姿态继续走，**不会闪回椅子**，出门/回家不从头重放。
- [ ] BGM 接着原进度播放，不从头开始；出门过场音轨从原位置续播。
- [ ] 风浪环境声、室内灯光与切后台前一致（不突然停/重新淡入）。
- [ ] 脚步不双响、不漏步、不从头重放。
- [ ] 最终正常到达小岛 / 坐回椅子，后续流程正常；无新增 console error（B 类 0）。

## E. 常规
- [ ] 湖畔真实 DC ≤ 60；60 FPS；B 类错误 0。

## F. 收尾清理
- [ ] 验收后清理 Mac 上本次的构建产物、缓存（含微信开发者工具生成文件）、录屏和临时目录（如 `~/lkcam-tmp/` 下本次 runs），不要动 Funning 桌面包。
