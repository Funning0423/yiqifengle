# Cursor CLI 任务 3/3：热气球转场（草地 → 天空之城）

> 自包含任务提示词。把本文件、`transitions-DESIGN.md`、`market-research.md`、`maps/`、`audit/` 一起放到 Mac 上仓库外面的 `~/r5-inbox/`，文档里提到的 `maps/`、`audit/` 都是指 `~/r5-inbox/` 下的这两个目录，然后交给 Cursor CLI。


**分支**：`gbt/r5-balloon-meadow-sky`。从 `f569ff0d9eeb9f6ab26bdc56276fa234e60c5ac4` 新建：`git switch -c gbt/r5-balloon-meadow-sky f569ff0d9eeb9f6ab26bdc56276fa234e60c5ac4`
**任务文件夹**：`docs/r5/balloon/`
**顺序**：等帆船分支完成并 push 之后再开始。
- 基线仍然是 f569ff0。
- `TransitBackdrop`、`TransportLeg`、`TransportVehicle`、`test_frame_background.cjs` 在帆船分支里已经写过。本分支**以 cherry-pick 的方式**把帆船分支里这几个文件对应的提交拿过来，不包括帆船资产和 sail 开关。用 `git cherry-pick -x <sha>`，把 SHA 记进 STATUS。
- 如果拣不干净，就在本分支里把这几个文件重写一份，并在 REPORT 里说明。

**可选的参考**：WIP `gbt/build05-r5-skycity-b-r2`，提交 `9fc54919c603d45cc043578fd47b3e5fc1d8eec7`。
- 里面的 `region/SkycityPlanB.ts` 有：天空之城落点 `arrivalBoard [6.4,-0.25,47]`、37 点 `standLineBoard`、`skyB2YawDeg`。
- `SkycityBoardPlanB.ts` 让棋盘副本只显示 `state_bridge_after`。
- 本分支可以照这些数据重新实现。也可以在这个 WIP 已经 push 到 origin 的前提下 cherry-pick 它。**不要合并它的作废部分**（它本来就没有包含作废部分）。

**开发文档**：`transitions-DESIGN.md`。本任务对应 §8（全部，重点是 A1、A2、A3 必须消失）、§10、§11、§12、§13、§14、§15，以及 §17 里的 F7、F9、F10、F11、F12、F13–F16。
**附带材料**：`audit/*`；`maps/map_sky.png` 和 `maps/map_meadow.png`；`market-research.md` 的 P9、P10、P12、P13。

## 目标
`JOURNEY_TRANSPORT['meadow-skycity']='balloon'`：她从风车门前 M6 旁边登上热气球，站在篮子里，用 `idle_breathing_loop`。热气球竖直起飞，然后斜着爬升，从云洞里穿过去（镜头不进云），接着天空之城从云海上整体露出来，从侧上方接近，**不从城底下穿过**，最后降落在前沿草坪 S0。她出篮后走到 mainline-09 的棋盘。
- 时长：目标 30 s，上限 38.9 s（Build05 口径，见 §10.2）。
- 现有转场审计里的问题必须消失：
  - A1：城底岩层沉到草地高度
  - A2：看到城底
  - A3：夜间两个天穹的接缝

## A. 规则（MASTER_HANDOFF §8，必须遵守）

1. **只在你自己新建的分支上提交**：`gbt/r5-balloon-meadow-sky`，从 `f569ff0d9eeb9f6ab26bdc56276fa234e60c5ac4` 拉出。
   - 不要碰 main，也不要碰任何 `integration/*` 分支。
   - 不要 force push。
2. **冻结的生产输入只能读，不能改**：
   - `creator-build-project/assets/scripts/WorldIntegrationBoot.ts` 里的 FlowReferenceStandin 段
   - `CharacterMotion.ts`
   - `anim_meta.json`
   - `tools/journey-integration/frozen-production-inputs.json` 里列出的全部文件。其中包括 `env_meadow.glb`、`env_skycity.glb`、`room_no_original_chair.glb` 和所有音频。
   - 场景节点只能在运行时按节点名显示或隐藏。
3. **玩家包里不能出现测试横幅或测试框架文字**。调试叠层只在 QA 参数或测试构建里出现。
4. **资产只能是 CC0 或自己制作的**。来源和许可证要写进 REPORT。
5. **只结束你自己启动的进程，按 PID 结束**。不要用 `pkill -f`，不要用 `killall`。
6. **提交时用这条命令**：`git -c user.name="Cursor Agent" -c user.email=cursoragent@cursor.com commit …`
   - 不要改 `.git/config`。
   - 不要提交 `tools/journey-integration/reports/*` 和 `output/*` 的改动。提交前先运行 `git checkout -- tools/journey-integration/reports output`。
7. **规格模糊，或者不开 Creator 就做不到时**：选最保守的做法，写进 STATUS.md，然后继续往下做，不要停下来问。
8. **不要对外发送任何东西**，不发消息，不发帖。push 只用普通的 `git push origin gbt/r5-balloon-meadow-sky`。
9. **Mac 磁盘只剩约 10 GB**：
   - 三个任务严格按顺序做：region-nodes → sail → balloon。同一时间只构建一次。
   - 构建一律通过 `tools/build-guard/build-wechat-guarded.sh`。它在构建前后都会删掉 `library/` 和 `temp/`。
   - 任务结束前必须清理，见 §E。
10. **设计依据**：`transitions-DESIGN.md`（开发文档）和 `market-research.md`。任务包里同时附带 `maps/` 和 `audit/`。
    - 文档里的数字就是验收门限。
    - 如果改了门限，要在 REPORT 里写清楚原因。

## B. 进度记录

- 在任务文件夹里维护 `STATUS.md`，路径是 `docs/r5/balloon/STATUS.md`。
  - 每完成一个步骤追加一行：本地时间、步骤、结果、提交 SHA 的前 10 位。
- 任务完成时写 `docs/r5/balloon/REPORT.md`，用中文，包含：
  - 每个提交的完整 40 位 SHA，以及 tree SHA
  - 测试统计：Node 22 和 Node 20 各自的 passed/total，以及非 PASS 的项
  - 包体：wechat-release 的总字节数，与 r4 19,335,755 B 的差值，各分包的字节数
  - DC、帧率、棋盘首帧时间
  - 截图清单
  - 未完成的事项和风险
- 截图放在 `docs/r5/balloon/shots/`，PNG 格式，每张 ≤ 400 KB（用 `sips -Z 900` 缩小）。
  - **只提交截图，不提交录屏**。

## C. 测试命令（每次提交前都要跑）

```bash
QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript npx -y node@22 tools/journey-integration/run-suite.cjs
QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript npx -y node@20 tools/journey-integration/run-suite.cjs
git checkout -- tools/journey-integration/reports output
```

- 如果 Mac 上没有 `/tmp/ts5`，先装：`npm i --prefix /tmp/ts5 typescript@5`。
- 合格标准：
  - **Node 22**：全部 PASS，唯一允许的例外是 `navigation-guard: BLOCKED_BROWSER`。基线 f569ff0 是 94/95。
  - **Node 20**：另外允许 `legacy-board-ui-pure` 和 `reward-background-return` 两项是 `BLOCKED_NODE`（需要 Node ≥ 22.6）。基线是 92/95。
  - 新增的测试必须登记到 `run-suite.cjs`。

## D. Creator 构建（Mac）

```bash
CREATOR=/Users/shineanl/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator
P="$PWD/creator-build-project"
# 1) 指定的两份配置（冒烟测试，产物在 build/wechat-firstslice-smoke 和 build/web-import-smoke）
"$CREATOR" --project "$P" --build "configPath=$PWD/tools/wechat-build-options.json"
"$CREATOR" --project "$P" --build "configPath=$PWD/tools/web-build-options.json"
git status --porcelain   # 必须为空。若导入器改写了 .meta：git checkout -- '*.meta'，然后删 library/temp 重试一次
rm -rf "$P/library" "$P/temp" "$P/build/wechat-firstslice-smoke" "$P/build/web-import-smoke"
# 2) 真正的游戏包（WorldR5Integration.scene），用来量包体和截图，带重试和缓存清理
CREATOR="$CREATOR" bash tools/build-guard/build-wechat-guarded.sh both
```

- 两份指定配置的起始场景是 `FirstsliceImport.scene`，只能当冒烟测试。
- 包体和截图以 build-guard 产出的 `wechat-release` 和 `web-test` 为准。
- 截图：
  - 对 `creator-build-project/build/web-test` 起本地静态服务，`python3 -m http.server 8765 --bind 127.0.0.1`，然后 `kill` 掉你自己启动的那个 PID。
  - 用 Playwright（`tools/qf-env.cjs` 提供的 chromium），视口和 hasTouch 按下面设：
    - 必须截 390x844。
    - 时间够的话，再截 414x896、360x780、375x667、390x520、320x568、768x1024。
- 不要在 Mac 上留下长期运行的服务。

## E. 结束前的清理（必须做）

```bash
rm -rf creator-build-project/library creator-build-project/temp creator-build-project/build/*
rm -rf tools/build-guard/logs/*.try*.log   # 先把关键结果抄进 REPORT
rm -rf output/playwright/*.webm output/playwright/*.mp4 2>/dev/null
git checkout -- tools/journey-integration/reports output
git status --porcelain   # 必须为空，或者只剩你打算提交的文件
df -h .                  # 把剩余空间写进 REPORT
```

最后一步：`git push origin gbt/r5-balloon-meadow-sky`（普通 push，不加 --force）。如果被拒，就停下来写进 REPORT，不要强推。


## F. 步骤

1. **T0**：
   - 跑 §C 的基线。
   - 复现 §8.1 审计中 08→09 的 A1–A4，结果写进 STATUS。
   - rider-parenting 的结论沿用帆船分支（站立版本要再测一次）。
2. **摆放**：
   - 新增 `REGION_JOURNEY_LAYOUT.balloonSkyOffset`：天空之城相对 M6 抬高 +30 m，水平距离 45 m。
   - 城的朝向沿用 `skyB2YawDeg` 的口径，让 S0 草坪迎着航向。
   - 工具要验证三件事：岩层 AABB 的 ymin > 草地最高点 + 8 m；航迹离城 ≥ 4 m；航迹不从城底下穿过。
   - 不满足时，按 §10 增大抬高量，最多到 +40 m。
3. **资产**：自制 `transport_balloon.glb`、`transit_cloud_band.glb`（带一个 ≥ 8 m 的云洞）、`transit_sky_cards.glb`。
   - 规格见 §10.3。
   - 新建 `bundles/transport_balloon`，目标大小 ≤ 0.3 MiB。
4. **代码**：
   - `TransportLeg.balloonBeats`。
   - 在 `JourneyTransport` 里设 `'meadow-skycity':'balloon'`。
   - `prepareTransportLeg` 加 balloon 分支。
   - B-d 期间关掉草地的 `meadow_grass_instances.*`。
   - `TransitBackdrop` 的夜间规则：同一时刻只能有一个天穹。
   - 如果按 DESIGN §8 B5 需要隐藏 `env_sky_static_rock_strata`，只能在运行时按节点名隐藏，并测 B5c（城的剪影仍然完整）。
5. **分段加载**：在 mainline-08 的棋盘打开时，后台 `prepare` 天空之城，然后让它 inactive 挂着。超时就回退到 `bridge`。
6. **测试**：
   - `transport-balloon`。
   - `frame-background`：热气球轨迹 × 7 种屏幕 × 昼夜。A1 的 `sunk = 0`，A2 的 `underside < 0.10`，A3 的 `domes ≤ 1`。
   - `transport-flag`、`transit-background-resume`。
   - 旧的 08→09 测试在 `bridge` 模式下照常跑。
7. **构建、截图、REPORT、清理、push**：按 §D 和 §E 做。

## G. 成功标准
- §C 两个 Node 版本都达标。
- F7、F9、F10、F11、F12 全部 PASS：
  - 热气球轨迹满足：`nearHit=false`、`clearM ≥ 0.6`、`back ≤ 1%`、`void = 0`、`underside < .10`、`sunk = 0`、`domes ≤ 1`、`horizonGap = 0`。
  - 总时长 ≤ 38.9 s（Build05 口径），实测数字写进 REPORT。
  - 航迹离城 ≥ 4 m。
- 资产三角面 ≤ 45k（目标 ≤ 8.5k），分包 ≤ 1.0 MiB，wechat-release ≤ 24,641,536 B。DC ≤ 53，60 FPS。
- 截图（390x844，最好覆盖 7 种屏幕）：B-b 进篮、B-c 起飞仰拍、B-d 穿云、B-e 城整体出现、B-f 降落、进入 mainline-09 的棋盘，外加夜间 B-d 和 B-e。同时附上旧 08→09 中 A1 和A2 最差那一帧的对比截图（`bridge` 模式）。
- REPORT 里写清楚：完整的 40 位 SHA、cherry-pick 了哪些提交、和另外两个分支冲突的文件。
