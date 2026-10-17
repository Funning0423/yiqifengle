# 运镜（cinematic）交接说明 v2 — 2026-10-17

写给接手的 Cursor agent。旧的出门/回屋交接见 `HANDOFF-CINEMATIC-v1.md`（任务背景、穿模验收，仍然有效）。
项目：微信小游戏《咦 起风了》，Cocos Creator 3.8.8；仓库 `/workspace/wechat-game`。验收方：Grok Bot；最终挑选：Funning。

## 1. 分支 / SHA / 状态（全部只在本地，没有 push）

| 内容 | 分支 | SHA | 状态 |
|---|---|---|---|
| 湖畔 lakeside 落地钩子 v3 | `cine/lakeside-hook-v3-on-r3` | c3cbf89（进关遮罩保持落地板面机位）+ a8ba19a（swap 帧测试） | 已交付。suite 69/74（已知 5 个失败）；Mac GPU 5 屏 swap 0/0/0。outbox `20261017T0940Z-lakeside-hook-v3-on-r3` |
| 地区钩子 meadow/skycity r4 | `cine/region-hooks-meadow-skycity-r4` | **95d3eee**（基于 5b1f41d ← GGbot r4-prep 97b761d） | **r4 现在合并它**。suite 77/82（已知 5 个失败）；Mac GPU 10 次运行 swap 0/0/0。草地停点在 390x844/414x896 上会碰到提示条（toast），由 r4.1 解决 |
| 草地 r4.1（提示条移到托盘上方后） | `cine/region-hooks-meadow-r4.1-on-260ea02` | **0ea1564**（← abeb1fa = 95d3eee cherry-pick ← GGbot 260ea02 提示条上移，基于 6f42df4） | **完成，等合并**。7 个竖屏间距 16.3–32.5 pt（独立 fixture 375x667 13.4 pt），O5 ≤ +2.98 s，F7b 全过，swap 0。suite 90/93（只剩已知的 3 个 BLOCKED）。Mac GPU 没测（Mac 连不上）。资料：`outbox/20261017T1255Z-meadow-r41-on-260ea02/`。旧分支 `cine/region-hooks-meadow-r4.1`（=95d3eee）作废 |
| 作废 | `cine/region-hooks-meadow-r4-ggkeepout` | 2665429 | Grok Bot 决定不用（左下角停点，O5 +4.40 s） |
| 夜间玻璃 | `cine/night-glass-r4` | 9c8fb36 | 只改夜间玻璃组（白天 refine 3.2 不变）。outbox `20261017T112348Z-night-glass` |
| m1v2 穿模修复（出门动画：腿 × 裙/围裙/椅背） | 没有游戏分支（只有证据） | — | **进行中**：`team/cinematic/work/m1v2-clipfix/`（STATUS.md / STATUS.log）。v3 constrained-smooth：cs2 通过 QP，下一步是 cs/solve3.py（加三角形对三角形约束）。渲染任务在 run_render.sh（可续跑） |
| 出门镜头 exit camera B5.5 | `cine/exit-cam-B5` | 274ac39 | 约 20 s，S 曲线重新定时。work `exit-cam-B5.5-20261016T1712Z` |
| GGbot 相关（不归我们） | r4-prep 97b761d；bfdcf19（星庭机器人园丁跨 swap 的动画时间连续） | — | 只读参考 |

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

## 3. 团队规则

- 只在自己的分支上工作；**不准 push，不准 force**；不改 `.git/config`；每条 git 命令都带 `git -c user.name=运镜bot -c user.email=cine-bot@local`。
- 盒子是共用的：**只杀自己启动的 PID**，禁止 `pkill -f` 这种按名字批量杀进程。
- Mac 用完马上清理，临时文件越少越好。
- 视觉改动一律交 before/after（条带图 / 截图 / 视频），由 **Funning 挑选**；每次交付都附 SHA 和预览。
- 只用免费素材；不发布到微信。
- 时间统一写 America/New_York（EDT）。
- 每个任务在 work/ 下维护 STATUS 检查点，交付放 outbox/<UTC时间戳>-<名字>/，附 SHA256SUMS。

## 4. 验收标准（镜头）

- swap 零跳变：≤0.1°、≤1 cm、FOV 不变；离线和 Mac GPU 两边都要验。
- 镜头离几何体 ≥1.1 m；没有突然加速（F1 转速 ≤20°/s，没有转速突跳）；镜头路线不穿模。
- 女孩不被裁切；宽度 ≤ 画面 80%；脸、头、胸不被挡；不被托盘、目标牌、3 个工具（含角标/选中圈）、提示条、安全区、胶囊按钮挡住。和 UI 的间距 ≥13 pt（Grok Bot 2026-10-17）。屏幕：390x844、414x896、360x780、375x667、390x520、320x568、768x1024（横屏 1024x768 不在范围内：小游戏只有竖屏）。
- 08→09：O5 比 Build05 多出的时间 ≤3 s（1.2 m/s 速度不变）；F7b 镜头在她右侧（最后 10 m 除外）；O4 到达点不变。
- 自己走进来，不准瞬移；行走路径不穿模（身体间隙 ≥0.3 m，脚离地 ≤5 cm）。
- suite 至少 77/82，并且只有那已知的 5 个失败。

## 5. 未完成事项

1. **草地 r4.1（已完成，等合并）**：GGbot 把提示条移到托盘上方（260ea02）后，7 个竖屏都能同时满足间距 ≥13、O5、F7b。
   - 做法：在草地出生点左侧、08→09 镜头保持在她右后方的那条窄带（模型 x≈-0.8..-1.5，z 14–18）上放一条 6.5 m 的站位线；regionGirlStand 每个屏幕自己挑停点，adapter 只接受 08→09 多走不超过 MEADOW_EXIT_BUDGET_M（0.432 m）的点。
   - 结果：390x844/414x896/360x780/375x667/768x1024 停在线末端 (-0.8,14.0)，O5 +1.19 s；390x520 停 4.3 m，+2.98 s；320x568 停 5.0 m，+2.40 s。F7b 最差 -0.22°（负值 = 通过）。
   - 还要做：合并后在 Mac 上跑 GPU 复核（Mac 这次连不上）；她在多数屏幕上比较小（屏宽 4–6%），只在 390x520 和 768x1024 上落在取景框内，Funning 要看截图决定接不接受。
2. **skycity**：方案 B 放到 r5，前提是场景设计先完成（彩虹桥落在星庭前沿，平顶 y -0.25，z≈48.5，x≈-1，步行 5–10 m，会改 O4 “真实入口” 的决定，镜头和遮挡要重调）。现在什么都不做。阻塞的原因：云桥甲板在 12.5–15.1 m 有缺口；state_bridge_before 木板浮在甲板上方 1.7–2.5 m；绕行要多约 50 s。
3. **m1v2 穿模修复**：继续做 cs/solve3.py，见 work/m1v2-clipfix/STATUS.md。
4. **r4 录制**：白天、夜间、390x520，都要带音频（用 AudioWorklet 流程），在 r4（95d3eee + GGbot 的 r4）上录。
5. **在 r4 上复查草地卡顿（meadow hitch）**。
6. **F3 隐藏峰值**：08→09 的城底覆盖率在 bridge +6.87 m 处有 0.1016 的峰值（这个问题之前就有：13×28 射线网格量化，相当于一条射线）。95d3eee 把采样网格对齐到 bridge 起点，峰值落在采样点之间被掩盖了；测试注释里已经写明。真要修得调 08→09 的镜头。
7. 提示 toast（toolsY-62）会在高屏上和她重叠 2 s；会话里如何处理也取决于第 1 项的决定。

## 6. 关键文件

- `creator-build-project/assets/scripts/region/`：RegionBoardLanding.ts（regionGirlStand / girlStandUi / 板面相机）、RegionJourneyLayout.ts（MEADOW_STAND_LOCAL、meadowExitFrom）、RegionJourneyAdapter.ts、SkycityVisitPose.ts、MeadowSceneData.ts。
- 测试：`tools/journey-integration/`（journey-scene.cjs 是共用的场景 fixture）。
- 最近的交付：outbox `20261017T1030Z-region-hooks-meadow-skycity`、`20261017T1207Z-girl-endpoints-r4`。
- STATUS：`team/cinematic/work/lakeside-cam-20261017T0411Z/STATUS`。
