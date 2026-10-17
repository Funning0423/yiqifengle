# 运镜（cinematic）交接说明 v2 — 2026-10-17

写给接手的 Cursor agent。旧的出门/回屋交接见 `HANDOFF-CINEMATIC-v1.md`（任务背景、穿模验收，仍然有效）。
项目：微信小游戏《咦 起风了》，Cocos Creator 3.8.8；仓库 `/workspace/wechat-game`。验收方：Grok Bot；最终挑选：Funning。

## 1. 分支 / SHA / 状态（全部只在本地，没有 push；由 GGbot 统一推送）— 更新于 2026-10-17 09:50 (EDT)

| 分支 | SHA | 状态 |
|---|---|---|
| `cine/region-hooks-meadow-skycity-r4` | 95d3eeed53e6c67a85ac05e47b9105672976fde7 | 已验收：**r4 合并的就是它**（suite 77/82，Mac GPU swap 0/0/0） |
| `cine/region-hooks-meadow-skycity-r4-head` | 5b1f41dc96733891e38fd5bdabf1bca6cb0d5667 | 已验收：r4 基底（代码 = cc2a6d4，基于 GGbot 97b761d），95d3eee 的父链 |
| `cine/region-hooks-meadow-r4.1-on-260ea02` | 0ea1564cc3d8263a1a855b7bade7658619da050f | 已交付，等 GGbot 合并（还差 Mac GPU swap 复核） |
| `cine/region-hooks-meadow-r4.1` | 95d3eeed53e6c67a85ac05e47b9105672976fde7 | 被取代（由 0ea1564 取代） |
| `cine/region-hooks-meadow-r4-ggkeepout` | 2665429bcc6c6229faad2d2f08368731fb588e7d | 作废（左下停点，O5 +4.40 s） |
| `cine/night-glass-r4` | 9c8fb36656abb4aae4a6db81176df8969535f02e | 已验收（只改夜间玻璃组）；真实夜景还要在 Mac 上录 |
| `cine/m1v2-src-apron-ease` | 023a47c9a97cc2fcbb21bceba66cc21daaa7403d | 已验收的是 508b87b34d5f07ea3a302a6ba288c67abcc6c448（SRC + 围裙 ease）；023a47c 只更新 PROBLEM_BRIEF。**和主仓库没有共同历史（独立根分支）**，来自 team/cinematic/work/m1v2-clipfix |
| `cine/skycity-bridge-r2-cam` | e4a05b982aaa5b98053ef71eeacff91f37cb8f56 | 进行中（r5 彩虹桥镜头，另一个工作者在 /workspace/tmp-skyb2/wt 做，目前还没有自己的提交） |
| `cine/cinematic-handoff-20261017` | （本提交） | 交接文档 |
| `cine/lakeside-hook-v3-on-r3` | a8ba19a301b1867d68fbe8a9ea9eaab8fc9d3570 | 已交付（湖畔 v3，Mac GPU 5 屏 swap 0）；已并入 r4 链 |
| `cine/lakeside-enter-hold-r3` | c3cbf8932f1631692715397ff41c5facbe04442d | 已并入 r4 链 |
| `cine/exit-cam-B5` | 274ac39fb3d261b5fbf9d0ece3cb38695e08dc83 | 未验收（出门镜头 B5.5） |
| 其余旧分支：lakeside-cam、lakeside-hook-*（on-be1cd5a/on-r2/r2-v2/v2-on-*）、meadow-early-preload(-r2, -r2-f2adb78)、sail-start-gate-r3、glass-v4r32(-on-e2a03ec)、pr56-r4-instantiate-split、region-hooks-meadow-skycity（768b272）、cinematic/window-tap-exit-proto | 见 `git branch` | 历史 / 被取代，留作参考 |

## 2. 工具和测量方法

- 工作树：`/workspace/tmp-lkcam/wt-r4`（git worktree；node_modules 是指向 wt-r3hold 的软链）。先 `source /workspace/tmp-lkcam/env.sh`（提供 tsc/node 路径）。
- **全量 suite**：`node tools/journey-integration/run-suite.cjs > log 2>&1`（约 10 分钟，后台跑并记下自己的 PID）。基线：82 项里 77 项通过，已知 5 个失败：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract、navigation-guard（BLOCKED_BROWSER）。suite 会改写 `reports/`、`output/`，不要提交这些（`git checkout -- output tools/journey-integration/reports`）。
- **swap delta（相机交接零跳变）**：
  - 离线：`tools/journey-integration/test-region-landing-hook.cjs`（swapTable：角度 / FOV / 位置差，要求 ≤0.1°、≤1 cm），湖畔用 lakeside-landing-hook。
  - 机上：Mac 跑 rec.cjs 逐帧导出相机姿态，再用 swapdelta.py 算 swap 前最后一帧和 swap 后第一帧的差。
- **镜头规则测试**：
  - test-journey-framing（F1 转速 ≤20°/s，F3 城底 ≤10%，F7/F7b 镜头在她右侧）；
  - test-journey-occlusion（O4 到达点不变，O5 08→09 比 Build05 最多多 3 s，遮挡）；
  - test-bridge-render-contract、test-journey-types。
- **女孩可见性测试**：
  - `tools/journey-integration/girl-frame.cjs`：独立投影，输出每个屏幕上她的框、是否被 UI 覆盖、和 UI 的间距、宽度占比、是否在 frameLimits 里。
  - test-region-landing-hook 里的 “her board copy at the board camera” 和 “meadow stand” 两项：检查脚是否贴地、身体有没有穿模、是否被场景遮挡。
  - UI 来自 `BoardLayout.boardLayout/toolSlots(lay,3)`。GGbot 给的工具栏矩形（含角标和选中圈）和 GGbot r4.1 的提示条/托盘 footprint（team/ggbot/outbox/20261017T124421Z-r41-hint-above-tray/footprint.json）一起，作为独立 fixture 写在 girl-frame.cjs 里（0ea1564）。
- **条带图（strips）**：
  - 机上：post.sh → landana.py（落地分析）、swapstrip.py（swap 前后帧条）。
  - 离线：`/workspace/tmp-lkcam/rh2/rast.py`（numpy 光栅化 GLB），view.py / panel_m2.py 画板面视角并标出 UI 框。
- **Mac GPU 逐帧录制**：
  - 机器 id e79aaea8-7696-4efc-a69c-8cc811e10bf7，目录 `~/lkcam-tmp`：repo checkout、b2.sh（带守护的 web 构建 → web-rh）、v4/（run2.sh：10 次运行，端口 8768；rec.cjs + rh_*.json 配置；Playwright chrome-for-testing，dpr 2）、post.sh。
  - 用 git bundle 把提交送到 Mac（不要 push）。磁盘紧张（大约 5–10 GB 空闲）：做完马上删 web-rh、runs/rh_*、rh-evidence.tgz、rhparts。要保留 npm-backup、draco3d tgz、repo、录制工具（v4/ 脚本）。
  - Mac 有时连不上，CopyToBox 大文件会超时，可以先拆成小文件再拷。
- **音频采集流程**：页面内 AudioWorklet tap（tap.js，rec.cjs 输出 audio_wl*.pcm）+ 闪光/蜂鸣标记 + mux3.py（分段时钟映射）合成。实测标记误差 3.9–14.8 ms。说明见 outbox `20261017T0950Z-audio-capture-test/README.md`。ScriptProcessor 版本会丢块，不要用。

## 3. 规则

**团队规则（原话）**：所有人只在自己的新分支上提交，不许 force push、不许直接改主线，交付附 SHA + 预览视频/截图，我验收。只用免费素材，不付费。
- 视觉/音频改动一律先出 before/after，由 Funning 挑；不上传、不发布到微信；和 Funning 用中文沟通。
- 不在群里讨论，需要合作直接 1:1 找对应的人（Funning 10-17）。
- 我们不 push，GGbot 负责集成和推送。不改共享仓库 .git/config，身份按命令设：`git -c user.name=运镜bot -c user.email=yunjing-bot@local`。
- 盒子是共用的：不准用 pkill -f 按名字批量杀进程，只杀自己启动的 PID。

**镜头规则**：绝不穿模，间距 ≥1.1 m；不挡她的脸、头、胸；镜头在她右侧（她在画面中线偏左）；不突然加速、不跳切、不突然变焦；她占画面宽度 ≤80%；swap 差 ≤0.1°、≤1 cm。

**Mac 规则**：磁盘快满了，用完立刻清理。永远不要删 `~/Library/Caches/ms-playwright`、`~/cursor-tasks/`、`~/Desktop/QIFENGLE-test-build05`。`~/.local/share/cursor-agent/versions/` 的旧版本要等 Grok Bot 测试结束并且 Funning 同意后才清。~/Downloads、~/.cache/codex-runtimes 由 Funning 决定。

## 4. 验收标准（镜头）

- swap 零跳变：≤0.1°、≤1 cm、FOV 不变；离线和 Mac GPU 两边都要验。
- 镜头离几何体 ≥1.1 m；没有突然加速（F1 转速 ≤20°/s，没有转速突跳）；镜头路线不穿模。
- 女孩不被裁切；宽度 ≤ 画面 80%；脸、头、胸不被挡；不被托盘、目标牌、3 个工具（含角标/选中圈）、提示条、安全区、胶囊按钮挡住。和 UI 的间距 ≥13 pt（Grok Bot 2026-10-17）。屏幕：390x844、414x896、360x780、375x667、390x520、320x568、768x1024（横屏 1024x768 不在范围内：小游戏只有竖屏）。
- 08→09：O5 比 Build05 多出的时间 ≤3 s（1.2 m/s 速度不变）；F7b 镜头在她右侧（最后 10 m 除外）；O4 到达点不变。
- 自己走进来，不准瞬移；行走路径不穿模（身体间隙 ≥0.3 m，脚离地 ≤5 cm）。
- suite 至少 77/82，并且只有那已知的 5 个失败。

## 5. 未完成事项

1. **r4.1 Mac GPU swap 复核**（0ea1564，7 屏草地落地，Mac 连上后做）。
2. **夜间玻璃真实夜景录制**：r4 合并后在 Mac 上录。
3. **天空之城彩虹桥 r2 镜头（r5）**：场景设计部数据在 `product/2026-10-17/rainbow-bridge/skycity-B/r2/`（centerline_world.json、slope_profile.json/png、obstacles_bbox.json；推荐方案 A，备选 B 在 _eval_12_15_28_45.json）。重调 skyLens，boardEndBlend 可从 30° 段开始；F7b 和间距复测必须用完整的 `work/b05an/dec/skycity.glb`——r4 的 occlusion fixture 裁掉了星庭右半边。分支 `cine/skycity-bridge-r2-cam`。
4. **r4 后续录制**：白天 / 夜晚 / 390x520 带音频（棋盘停留约 30 s）；浪→湖交接；每个地区的落地→棋盘片段；复查草地卡顿。
5. **出门回弹 bug（GGbot 负责）**：出门中途切后台，她会弹回椅子重放整段出门，BGM 重启。已报 Grok Bot，等决定是否转 GGbot。
6. **出门脚步录音**（cfe6429）：`team/voice-bot/outbox/20261017T121502Z-r4-exit-footsteps/recording-yunjing/`（A_exit/B_return/C_gating），等 Grok Bot 审。脚步比环境音低 4–20 dB（已告知 Voice Bot）。
7. **m1v2 布料重做（带自碰撞）推迟到 r5**，按 `work/m1v2-clipfix/PROBLEM_BRIEF.md` 走；m1v2 线暂停。
8. 录制完后清理盒子 `/workspace/tmp-lkcam`（约 1.3 GB）。

## 6. 关键文件

- `creator-build-project/assets/scripts/region/`：RegionBoardLanding.ts（regionGirlStand / girlStandUi / 板面相机）、RegionJourneyLayout.ts（MEADOW_STAND_LOCAL、meadowExitFrom）、RegionJourneyAdapter.ts、SkycityVisitPose.ts、MeadowSceneData.ts。
- 测试：`tools/journey-integration/`（journey-scene.cjs 是共用的场景 fixture）。
- 最近的交付：outbox `20261017T1030Z-region-hooks-meadow-skycity`、`20261017T1207Z-girl-endpoints-r4`。
- STATUS：`team/cinematic/work/lakeside-cam-20261017T0411Z/STATUS`。
