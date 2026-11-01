# r5 G1：草甸行走卡顿与换场帧（ggbot/r5-meadow-stutter）

- 基底：github `gbt/r5-integrated-b07-wip` @ bc81575fead2d4d05b11b962c936d3b76708ad4b
- 代码提交：8bb4dc927943b5950ada11431abc8119cd8435fa。本文件所在的提交即分支头，完整 SHA 见交付报告。
- 截至提交时，github 上还没有 `gbt/r5-integrated-b07`，所以没有合并。等它出现后用 `git merge --no-ff` 合入，不 rebase。
  - 与 r4.2（9a275731）试合并（merge-tree）：冲突只有基底本来就有的那 3 个文件（MeadowBoardBackground.ts、WorldNativeComposition.ts、run-suite.cjs 的 r4.2 区段），本分支没有新增冲突。
  - 本分支没有改 r4.2 改过的任何行。
- 没有改动冻结文件（frozen-production-inputs.json 共 311 个）、彩虹桥、build07。

## 1. 证据与局限
盒子上没有 Cocos Creator，也没有 web 构建，跑不了真实引擎。证据分两类。

**A. Mac r4 实测数据的逐帧归因**
- 数据：r4 审计（2153a65）lk4 跑次的 journey samples。每个 AFTER_DRAW 一行，帧时间取相邻样本 performance.now 之差。
- 工具：`tools/perf/journey_spike_attribution.cjs`。
- 输出：`data/attribution-r4-mac.json`，逐帧 CSV 在 `data/*_frames.csv`（带 cause 和 capture 列）。
- 它测的是 rAF 节奏，里面包含 vsync 等待。60 Hz 屏上空闲时也有 16.7±1 ms 的抖动，所以「p99 ≤ 16.7 ms」用这种方式测不出来。harness 本身把 >17.5 ms 记作超过 16.7 ms。下文的「达标」按 ≤17.5 ms 判，这一点不作隐瞒。
- 局限：
  - 这是 r4（桥式旅途）的数据。b07 的 岛→草甸 已经改为帆船，草甸→天空之城 改为热气球。
  - 换场帧在 r4 是旧流程，没有 r4.2。
- **B. 盒子上的假引擎仿真**
  - 测试：`tools/meadow/test_region_board_staging.cjs`，已进套件，名为 region-board-staging。
  - 它跑的是真实的 RegionBoardStaging.ts 和 LakesideBoardGuest.ts（TS 转译后）。
  - 假引擎带帧时钟，规则仿 Cocos 3.8.8：
    - MeshRenderer 在 enabled 且所在节点 activeInHierarchy 时于 onEnable 创建 model；
    - 相机第一次画到某个 model 时，编译它的变体（WebGL2Shader.gpuShader 是懒编译的）。
  - renderer 数和材质数取自真实的 env_meadow.glb（23 个）、env_skycity.glb（49 个），外加她的 4 个 skinned renderer。
  - 它统计每帧创建的 model 数和新编译的变体键数，**不测毫秒**。毫秒数要等 Mac。

## 2. 每个尖峰的原因
数值来自 Mac r4，单位 ms。walking 指 state=region-travel 的帧。

| 尖峰 | 实测 | 原因 | 证据 |
|---|---|---|---|
| 草甸行走 d≈30.2 / d≈36.2 的 50.5 / 67.6（白天）、49.8（夜间）；天空之城路线 51.8 / 51.5 | 50–68 | **harness**：lk4 在旅途距离越过 8/10/16/24/30/36 m 时调用 `page.screenshot`（j08…j36、journey_ui），截图会让页面停顿 17–50 ms。另外 d>34.4 m 时 CAP 每帧做一次 drawImage + JPEG toDataURL（这几次跑次 capN=187），同时还开着录屏 | 尖峰全部落在截图触发后 300 ms 以内；r4 湖畔 swap 不截取时 29.1，截取时 36.7–36.9 |
| 白天 d16/d24 的约 34 ms | 34.3 / 34.5 | 同上（j16 / j24） | 同上 |
| 草甸行走中去掉 harness 和截取窗口后剩下的帧 | 白天 p99 18.4，max 19.2；夜间 p99 18.6，max 34.2（7 帧约 34 ms，即单帧丢 vsync） | 白天全部在 17.5–20 之间，属于 vsync 抖动（平均 16.68）。夜间那 7 次单帧丢帧，离线没能归因：没有 GC 迹象，DC 和三角数与相邻帧相同 | `walkingGameOnly` |
| approach 首帧（草甸第一次出现） | 65.0 白 / 67.2 夜 / 69.2 天空之城 | 旅途地区模型第一次显示：所有 model 在这一帧创建，第一次绘制时编译全部变体。这是 r4 的桥式流程 | first-show |
| level-loading 起始几帧 | 31.4–33.2 | 棋盘搭建，包括地区模型 instantiate、她的副本和夜间调色 | level-loading |
| 切换帧 swap | 39.3 白 / 36.1 夜 / 37.2 天空之城（都带 CAP，去掉 CAP 估计约 29–32） | 棋盘 rig 在这一帧激活：27 / 49 个 model 一起创建（bufferSize **+9.55 MB**、textureSize +1.02 MB 都落在这一帧），棋盘相机第一次绘制，全部棋盘变体在这一帧编译。棋盘把 USE_VERTEX_COLOR 关掉了，还有自己的 MeadowKeyLight（forward-add），所以这些变体与旅途副本的不一样。另外 UI host 约 190 个节点也在这一帧激活 | swap 帧的 dBuf/dTex；源码 |
| GC | 19.3（堆 −165 MB） | major GC，落在 CAP 截取开始之后（dataURL 占的堆） | gc-major |
| 天空之城路线（r4 桥式）持续丢帧 | 3162 帧里有 373 帧 >33（p95 33.9） | 一路都是单帧丢 vsync，与距离无关，DC/三角数和草甸差不多。原因离线定不了，可能是 GPU 填充，或天空之城旅途的某项每帧开销。b07 里这条路线已改为热气球，所以只记为 Mac 待测项 | `lk4_sky_day_ml` |

旅途 JS 开销：RegionJourneyCore.journeyCamera 在盒子 Node 上测，跟随时每帧 32.6 µs，棋盘混合时每帧 68.5 µs，可以忽略，没改。

## 3. 修复
**RegionBoardStaging**：`creator-build-project/assets/scripts/region/RegionBoardStaging.ts`，在 `withRegionBoardGuest`（LakesideBoardGuest.ts）里接入。只作用于草甸和天空之城的 live 棋盘，并且要求旅途副本存在。
- 做 lease 时（她的副本已经挂上），把 rig 下所有启用的 MeshRenderer 先停用。停用状态下 onLoad 照常跑，morph 实例也照常创建，只是 model 要等 onEnable 才建。
- host 激活后，从第二个绘制完的帧开始（director_after_draw），每帧重新启用 ≤4 个 renderer，其中最多 1 个会带来还没画过的材质或 renderer 类型（skinned / morph / plain 各自是不同的变体）。所以每帧最多创建 4 个 model，并且只编译约一个 renderer 的变体。
- 在此期间，rig 自己的棋盘相机（原本停用）在 2 个设备像素大的角落里用 DEPTH_ONLY 清屏绘制，所以每批 renderer 在启用后的下一帧就被画到、就编译。用的是棋盘真实的灯光、层和管线宏。
- 最后一批画完后，相机的 rect、clearFlags 和 enabled 恢复原样，staging 结束。GLB 里导入的相机不碰。
- reveal（setVisible(true)）时把剩下的同步全部启用，并恢复相机，所以显示不会比以前晚。
- dispose 和取消时退订并恢复相机。host 隐藏时步进暂停。
- 没有帧时钟（director.on 不存在，比如单元测试的假 cc）时不启用，走旧路径。
- 符合宽松 ES5：没有 Map/Set，没有 for-of 和 spread over Map/Set，测试里有检查。

各流程下的效果：
- **r4.2 / build07 流程**（host 在 enter 后一帧激活，reveal 在约 48 帧后）：工作分摊到 level-loading 帧上，swap 帧不创建 model，也不编译变体。
- **b07-wip 流程**（没有 r4.2，enter 末尾就 setVisible(true)，host 此时还没激活）：staging 在 reveal 时直接完成，逐帧工作与以前完全相同。测试里有断言。所以这项修复要在 build07（含 r4.2）上才见效。

**Harness 补丁**：`docs/r5/meadow-stutter/lk4-perf.patch`。
- `NOSHOT=1`：采样期间不截图。
- `NOVIDEO=1`：不录屏。
- 采样器的相机和灯光列表每 30 帧（或 state 变化时）刷新一次，不再每帧遍历整个场景。
- 测帧时间时不要开 CAP。
- 不改这个补丁的话，Mac 上的「草甸行走 50–68 ms」会一直出现，但它不是游戏造成的。

## 4. 前后对比
**盒子仿真**：r4.2 流程，renderer 数来自真实 GLB。

| 地区 | 修复前，每帧 model 创建 | 修复前，每帧新变体 | 修复后，每帧 model 创建 | 修复后，每帧新变体 | swap 帧，修复前 → 修复后 |
|---|---|---|---|---|---|
| 草甸（27 个 renderer） | host 激活那一帧：27 | swap 帧：15 | ≤4（第 2–11 帧） | ≤1 个 renderer 的量；她身体那一帧是 6 键，其余每帧 1 | model 0 → 0；变体 15 → **0** |
| 天空之城（49 个 renderer） | host 激活那一帧：49 | swap 帧：17 | ≤4（第 2–16 帧） | 同上，最多一帧 6 键 | 变体 17 → **0** |

- staging 分别在第 12 帧（草甸）和第 17 帧（天空之城）结束，r4 的 level-loading 有约 45 帧（783 ms），时间足够。
- 如果 level-loading 很短（测试里 reveal 放在第 4 帧），剩下的部分在 reveal 时一次补完，不会出错。

**Mac 毫秒数**：
- 修复前（r4）：
  - 草甸行走（去掉 harness 后）p99 18.4，max 19.2（白天）。
  - 草甸 swap 39.3（带 CAP，估计不带约 29–32）。
  - level-loading 最大 31.6–33.2。
  - 草甸首次出现 65–67。
- 修复后：**盒子上测不了，需要 Mac**。按 `r42-mac-checklist.md` §3 的方法在 build07 + 本分支上测。
  - 预期 swap 帧回落到只切换可见性的开销。
  - level-loading 每帧增加的量不超过 4 个 model 加一个 renderer 的变体。她身体那一帧的 6 个变体是最大的一份；如果 Mac 上这一帧仍然超过 33 ms，下一步就把 newVariantsPerFrame 或 renderersPerFrame 调成 1–2。

去掉 harness 之后，草甸行走已经是 60 fps（白天 max 19.2）。所以「草甸行走 50–68 ms」在游戏侧的唯一来源是首次出现那一帧，其余都是 harness 造成的。

## 5. 包体变化
- 盒子上打不了包，以下是估算：
  - RegionBoardStaging：TS 转 ES5 后用 terser -c -m 压缩，为 4,043 B。
  - LakesideBoardGuest.ts：压缩后 7,071 → 7,264 B，+193 B。
  - 加上模块包装，**main 包约 +4.3–4.6 KB**。
- 资源没有变化。新增的 `.meta` 不进包。
- 距门限还有约 5.3 MB 余量（r4 的值）。

## 6. 测过 / 没测过
**测过（盒子上）**：
- 全套件（124 项，在提交 8bb4dc92 的临时 worktree 上跑，Node 22.23.3，TS 5.9.3，DRACO3D 已设）：122 PASS，navigation-guard 为 BLOCKED_BROWSER，lens-clearance 为 FAIL。
  - lens-clearance 失败的原因是测试里写死了 `/tmp/draco3d/node_modules/draco3d` 这个路径，盒子上没有。补一个 symlink 后单独重跑，结果 PASS。
  - 所以实际结果是 123/124，只有 navigation-guard 是 BLOCKED_BROWSER。
  - 基线（bc81575f，没补环境）是 118/123。
- region-board-staging 新测试共 8 项：
  - 纯函数；
  - 草甸和天空之城在 r4.2 流程下的逐帧分布；
  - b07-wip 流程与旧路径完全相同；
  - level-loading 很短时；
  - 中途 dispose；
  - 中途 host 隐藏；
  - ES5 检查。
- 现有的 lakeside-board-guest 和 region-board-ambient 两个测试不变，仍然通过。
- attribution 工具已在 3 份 Mac r4 samples 上跑过，结果已提交。
- 已跑 `tools/test_manifests.cjs --write` 和检查，problems 为空。注意：基底的 manifest 本来就过时了，这次 --write 一并把它们补齐（新增约 365 条，hash 变化 86 条，移除 5 条）。这些都不是本分支的代码改动；合并 b07 时 manifest 如果冲突，重新跑 --write 即可。

**没测过**（盒子做不到，需要 Mac）：
- 真实 Cocos 下的毫秒数：level-loading 的每一帧、swap、首次出现。
- 2 px 角落的 DEPTH_ONLY 相机：
  - 在真实管线里确实触发了编译（包括阴影和 forward-add）；
  - 画面上看不出来（level-loading 期间左下角约 2 个设备像素）；
  - 不影响 UI 相机的排序。
- 棋盘相机在 aspect=1 时的视锥（1:1，比竖屏宽）是正常视锥的超集。这依赖 fovAxis 为纵向，即 Cocos 默认值。
- b07 帆船首次显示草甸那一帧：SailPreload 只预热了 instantiate，model 创建和首次编译还在 `show(true)` 那一帧。这里没有修，因为帆船一出发就要显示，没有空闲窗口。记为剩余风险。建议在 Mac 上用 NOSHOT 跑一次 island→meadow 帆船，量 approach 首帧。
- 天空之城旅途持续丢帧（r4 桥式；b07 已改为热气球）的原因。
- 草甸夜间行走那 7 次单帧丢帧。
