# Cursor CLI 任务 1/3：区域关卡节点（先做这个）

> 自包含任务提示词。把本文件、`transitions-DESIGN.md`、`market-research.md`、`maps/`、`audit/` 一起放到 Mac 上仓库外面的 `~/r5-inbox/`，文档里提到的 `maps/`、`audit/` 都是指 `~/r5-inbox/` 下的这两个目录，然后交给 Cursor CLI。


**分支**：`gbt/r5-region-level-nodes`。从 `f569ff0d9eeb9f6ab26bdc56276fa234e60c5ac4` 新建：`git switch -c gbt/r5-region-level-nodes f569ff0d9eeb9f6ab26bdc56276fa234e60c5ac4`
**任务文件夹**：`docs/r5/region-nodes/`
**顺序**：这个任务做完并 push 之后，才开始做 `cli-task-sail.md`，然后是 `cli-task-balloon.md`。
**开发文档**：`transitions-DESIGN.md`。本任务对应 §0、§2–§7、§8.2–§8.3（只做 FollowWalk 和 MapExplore 的部分）、§11（开关全部设成 `bridge`）、§13、§14、§15、§16、§17 里的 F1–F7、F10、F11、F13–F16。
**附带材料**：
- `maps/nodes.json` 和三张俯视图 `map_*.png`
- `maps/topmap.cjs`：可走网格栅格化
- `market-research.md` §1：P1–P8、P11

## 目标（一句话）
每个区域有 6–7 个关卡节点，分布在可走的路线上。领完奖励或点“下一关”后，镜头从棋盘切到人物视角，她走到下一个节点，到了再切回棋盘。区域的 4 关主线都打完后，开放自由探索：拖动、缩放、点哪走哪、点物件有反馈。天空之城一路向北深入，S4 台阶顶是最高的可走点。本分支的区域之间仍走原来的彩虹桥。

## A. 规则（MASTER_HANDOFF §8，必须遵守）

1. **只在你自己新建的分支上提交**：`gbt/r5-region-level-nodes`，从 `f569ff0d9eeb9f6ab26bdc56276fa234e60c5ac4` 拉出。
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
8. **不要对外发送任何东西**，不发消息，不发帖。push 只用普通的 `git push origin gbt/r5-region-level-nodes`。
9. **Mac 磁盘只剩约 10 GB**：
   - 三个任务严格按顺序做：region-nodes → sail → balloon。同一时间只构建一次。
   - 构建一律通过 `tools/build-guard/build-wechat-guarded.sh`。它在构建前后都会删掉 `library/` 和 `temp/`。
   - 任务结束前必须清理，见 §E。
10. **设计依据**：`transitions-DESIGN.md`（开发文档）和 `market-research.md`。任务包里同时附带 `maps/` 和 `audit/`。
    - 文档里的数字就是验收门限。
    - 如果改了门限，要在 REPORT 里写清楚原因。

## B. 进度记录

- 在任务文件夹里维护 `STATUS.md`，路径是 `docs/r5/region-nodes/STATUS.md`。
  - 每完成一个步骤追加一行：本地时间、步骤、结果、提交 SHA 的前 10 位。
- 任务完成时写 `docs/r5/region-nodes/REPORT.md`，用中文，包含：
  - 每个提交的完整 40 位 SHA，以及 tree SHA
  - 测试统计：Node 22 和 Node 20 各自的 passed/total，以及非 PASS 的项
  - 包体：wechat-release 的总字节数，与 r4 19,335,755 B 的差值，各分包的字节数
  - DC、帧率、棋盘首帧时间
  - 截图清单
  - 未完成的事项和风险
- 截图放在 `docs/r5/region-nodes/shots/`，PNG 格式，每张 ≤ 400 KB（用 `sips -Z 900` 缩小）。
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

最后一步：`git push origin gbt/r5-region-level-nodes`（普通 push，不加 --force）。如果被拒，就停下来写进 REPORT，不要强推。


## F. 步骤

1. **T0 盘点**（只读）：
   - 读 DESIGN 的 §1 表格里列出的每个文件，确认函数和常量和文档一致。不一致的地方记进 STATUS.md，以代码为准。
   - 跑一遍 §C，记下基线。
2. **烘焙节点数据**：
   - `tools/region-nodes/bake-region-nodes.cjs` 复用 `maps/topmap.cjs` 的栅格规则。
   - 海岛要先用 Blender 解码 Draco：`blender -b --python tools/journey-integration/occlusion/decode-draco-blender.py -- creator-build-project/assets/bundles/static_seat_preview/room/room_no_original_chair.glb /tmp/room.glb`。没有 Blender 的话，读一份提交进 `tools/region-nodes/fixtures/` 的已解码几何（gz），并钉住 SHA。
   - 输出 `region/RegionNodes.ts`，格式见 DESIGN §3.3。
   - 节点用 DESIGN §3.1 的坐标；I4→I6、M4→M6、S4→S6 的直达段由工具重新计算。
3. **纯函数模块**：`RegionNodeProgress`、`NodeWalker`（含剪辑规则，见 §3.2）、`ExploreCameraCore`、`NodeBoardPose`、`JourneyTransport`（全部 `bridge`）、`TransitAudioHooks`。每个都配一个 Node 测试。
4. **接线**：
   - `WorldNativeComposition` 的 `advanceMainline` 和领奖流程插入 `walkToNextNode()`，时序见 §16 的时序图。
   - `ExploreInput` 和棋盘之间的输入归属：棋盘打开时世界零响应，现有的 `input-ownership` 测试必须保持 PASS。
   - `NodeMarkers` 加路线提示，只占 +1 DC。
   - 区域边缘节点（I6、M6）触发现有的 `RegionJourney`，仍然是 `bridge`。
5. **节点棋盘位姿**：
   - 在 Meadow/SkycityBoardBackground 上实现可选的 `setAnchor`。
   - `check-node-boards.cjs` 对每个节点、每种屏幕做检查，不通过的标成 `'default'` 并写进 REPORT。
6. **背景完整性**：`tools/transitions/test_frame_background.cjs` 覆盖 FollowWalk、BoardToFollow、FollowToBoard、MapExplore 网格。同时用它跑旧的 04→05 和 08→09，生成 `baseline-current.json`，只记录，不判失败。
7. **存档**：§6 的 12 个以上存档样本都要测。`forest-r5-region-nodes-v1` 是唯一新增的键，MAINLINE_KEYS 和 R5_KEYS 不能被写入。
8. **前后台和夜间**：F11、F12。
9. **构建、截图、REPORT、清理、push**：按 §D 和 §E 做。

## G. 成功标准（全部满足才算完成）

- §C 两个 Node 版本都达标。新增测试：`region-nodes-data`、`region-nodes-progress`、`region-nodes-walk`、`explore-camera`、`explore-input`、`node-board-pose`、`frame-background`、`transport-flag`、`transit-background-resume`。全部 PASS。
- DESIGN §17 的 F1–F7、F10、F11、F13–F16 全部达标，F6 允许有 `'default'` 节点。
- 现有 journey 测试全部保持 PASS。`transportFor` 在本分支对所有组合都返回 `bridge`，旧路线逐字节不变。
- wechat-release ≤ 24,641,536 B，比 r4 多出的部分 ≤ 0.05 MiB。DC ≤ 53。390x844 下走路和地图期间 60 FPS。棋盘首帧 ≤ 16.7 ms。
- 截图（至少 390x844）：
  - 每个区域各一张：FollowWalk、MapExplore（缩到最小）
  - 节点标记的三种状态
  - 草地 M2 的节点棋盘
  - 天空之城 S4 台阶顶的抬头镜头
  - 夜间一张
- REPORT.md 里有完整的 40 位 SHA，并附上 §8.1 审计 A1–A6 的复核结论（用旧路线的基线跑）。
