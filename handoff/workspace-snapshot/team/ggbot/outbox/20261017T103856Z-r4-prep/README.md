# ggbot/build05-r4-prep（GGbot，r4 准备）

- 分支：`ggbot/build05-r4-prep`。仅本地，未 push，没有动主线。
- 基于：`f3d3614361dd2dc23098353ff314a520c3e1c00e`（r3 的 HEAD）
- 提交：9 个 → `patches/0001..0009`
- bundle：`ggbot-build05-r4-prep.bundle`
  - 前置提交为 f3d3614，已通过 verify
  - 用法：`git fetch <bundle> ggbot/build05-r4-prep`
- 没有改水面、雾、光照颜色的**数值**（D 只是让旅程与棋盘读同一个参数来源），没有动镜头 / hook 代码。
- 叠加检查：在 运镜bot 的 `cine/lakeside-hook-v3-on-r3`（a8ba19a）之上可以干净叠加（见文末）。

| # | 提交 | 内容 |
|---|---|---|
|1|25b55af|落地进入湖畔棋盘时不再弹「暂停一下」|
|2|8ed086c|旅程过渡时，小岛天空穹顶和云层跟随湖畔天空色|
|3|c43e310|首次进入湖畔：棋盘复用旅程已合并好的几何体|
|4|074d6c7|C：到达段先让湖畔远景淡入，再让小岛专属的穹顶 / 云层 / 海鸥在落地前淡出|
|5|6b3edad|D：旅程的湖水与棋盘读同一个水面参数来源|
|6|2363c37|B：落地后女孩留在画面里（湖畔棋盘背景中有她）|
|7|2d71e76|A：在到达 / 落地段预加载湖畔棋盘，切换帧只开相机|
|8|7f85eec|B+：草甸、天空之城棋盘同样保留女孩（同一做法）|
|9|c30eeec|D 的测试跟进（lakeside-daynight 改为检查共享函数）|

## 1. 「暂停一下 / 还剩 25 步」调查结论与修复
### 来源（以 f3d3614 为准）
1. 选关：`WorldNativeComposition.regionSelection`（约第 137 行）会读取 `forest-regional-r05-active`，如果有该地区未完成的局就选中它。
   - 实际 localStorage 键名为 `dot-r5-v12-isolated-20261009:forest-regional-r05-active`
   - 同一命名空间下还有 `-progress` 和 `-active-v1-backup`
   - 参见 `world-r2/PersistentR5Port.ts:3-10`
2. 恢复：R5 provider 的 `regional-r05/runtime/board-session-provider.js:7` 构造时 `this.paused=true`；`_restore` 不会清除它，只有新开一局（`_adopt` 且 recovering=false）才会让 `paused=false`。因此 `_state()`（第 52 行）返回 `run.paused`。
3. 弹窗：`ManagedMobileBoardUI.presentForPlay`（第 293-296 行）的设计是「恢复的局保持暂停，并主动提供继续」，于是设置 `returnPause`；`update()`（第 839 行）随后调用 `openPausePanel`（第 849 行起），显示「还剩 N 步」。
4. 教程：工具介绍（introQueue，第 846 行）要求状态为 `run.ready` 且没有其他弹窗，所以只能在点「继续」之后出现。

### 是否回归
**不是回归。**
- 09a1b8e、228df2f、f3d3614 的 presentForPlay 逻辑完全相同（第 293/296 行）。
- 湖畔、旅程、hook 和 enterSelectedLevel 的改动都没有重复进入棋盘：
  - hook 在 enterLevel **之前**执行，失败时直接 fallback，不会创建对局。
  - 棋盘背景先加载，之后才创建 session，所以背景加载失败也不会留下对局。

### 首次玩家
- 存储为空时，R5 会新开 lake-01：`paused=false` → `run.ready`，**不会**弹出暂停面板，教程正常出现。
- 只有之前已经进过该关、但没打完就离开（回到小岛、杀进程等）的玩家，才会遇到暂停面板；而且如果这时教程还没看过，暂停面板会抢在教程前面。
- 「还剩 25 步」正好等于 lake-01 的初始步数（lakeside-levels-data），说明这是一局进入后一步都没走的存档。
- 结论：Mac 测试环境**很可能保留了上一轮的 localStorage**（上述命名空间是固定的）。请让界面验收部清空存储后复测确认。

### 修复（25b55af）
- `NativeWorldLevelAdapter` 设置 `ui.resumeRestoredOnPresent = requiresLakesideScene(selection)`。
- 对湖畔棋盘，presentForPlay 时直接对恢复的局执行 resume，进入可操作状态，步数照常显示，未看过的教程照常出现。如果 resume 被拒绝，则退回到原来的暂停面板。
- 其他棋盘保持原来的「显式继续」行为（test_restored_entry_resume 仍然 PASS）。
- 测试：`lakeside-landing-no-pause`

## 2. 旅程天空穹顶（8ed086c）
- 问题：小岛的 `env_sky_dome` 是不透明的 builtin-unlit，遮住了过渡中的天空 / clear 颜色。
- 做法：穹顶和云层这两个现有材质实例只改 mainColor：
  `lerp(小岛基色（白天 1 / 夜晚 tint）, 湖畔终点 clear ÷ 网格平均顶点色, w)`，在线性空间中计算（`world-r1/SkyFollowCore.ts`）。
  - w=0 时与小岛外观完全一致，起点不跳变。
  - w=1 时，穹顶平均色 = 湖畔终点 clear（白天 28/143/184，夜晚 28/39/64）。
  - 过渡中切换昼夜，会随新模式重新计算。
  - 离开湖畔时只发送一次 null 来恢复，并且在 reapply 之前完成。
- 不新增节点、renderer、pass 或材质，**DC +0**。
- 实测平均顶点色（Draco 离线解码）：
  - 穹顶 0.025/0.142/0.278 → 白天增益 0.47/1.93/1.72
  - 云层 0.514/0.583/0.617
- 假设：builtin-unlit 的输出为 `mainColor × SRGBToLinear(v_color)`。请用 Mac 截图核对 w=1 时穹顶颜色。
- 测试：`lakeside-sky-follow`

## 3. 首次进入的最差帧（c43e310 + 2d71e76）
### 主要耗时（代码路径分析；box 上没有真机，无法 profile）
- 旧流程：hook 结束后 enterLevel 才开始建棋盘背景：实例化 431 个对象、instancing / 水面材质副本、静态合并约 5.8 万顶点（仅 JS 约 30–45 ms）。
- 这些节点挂在未激活的棋盘 host 下，**到 reveal 那一帧才第一次激活**（431 个组件的 onLoad / onEnable），并且水面 shader 首次编译。
- 运镜bot 测得切换帧 38–57 ms，与此吻合。

### 已实现
1. c43e310：棋盘按签名复用旅程那份合并几何体（引用计数，最后一个持有者销毁）。测试 `lakeside-merge-share`。
2. 2d71e76（A）：
   - 混合权重 w≥0.9（离停下约 1 m）时开始预加载，hook 的 preload 也会触发（不阻塞 hook），只建一份。
   - 预加载挂在隐藏的 holder 下：每帧实例化 24 个；先设为棋盘层、相机关闭，再每帧激活 24 个节点。所以 onLoad / onEnable 分摊在到达段和 1 s 的落地镜头里。
   - enterLevel 时接管这份 lease（之后由进入的 token 负责），这时也复制女孩。
   - rig 保持激活。相机只在「visible 且棋盘 host 已显示」（即 reveal）时打开；灯光写入时机不变。
   - 没被接管的预加载随旅程释放；没有预加载或预加载失败时，走原来的流程。
   - 测试 `lakeside-board-preload`。
3. 6b3edad（D）的副作用：水面 shader 在旅程里就已编译，不再拖到棋盘首帧。

### 切换帧估计（无法在 box 上实测）
- 3D 背景部分：只剩打开相机，以及已编译程序的 instanced batch 首次绘制，估计约 2–5 ms。
- 棋盘 UI 根节点（NativeBoardUI）在 reveal 时首次激活，这部分没有改动，耗时未知。
- 如果 Mac 上切换帧仍然超过 16.7 ms，下一步是在 0.78 s 的 loading cover 期间以透明度 0 预先激活 UI。需要先看 Mac profile。

## 4. C：远景在切换前后是同一组（074d6c7）
- 几何（GLB accessor）：
  - 湖畔远山 local z -108..-54，高 41 m；落地点离小岛约 40 m；
  - 小岛穹顶半径 283；云层是半径 ≤190、高 2–38 m 的环。
  - 所以远山在穹顶和云环**里面**：旅程中挡住远山的是云层，到了棋盘就变成远山 + clear 色。
- 做法：
  1. 湖畔远山 / 远岸从出发起就挂在旅程里，随 w 增大层雾变薄而「淡入」（先）。
  2. 然后在 w 0.6→0.95（smoothstep，`SkyFollowCore.islandSkyFade`）让小岛专属的东西淡出（后），w=1 在停下前 1 m 达到，所以淡出在落地前完成：
     - 穹顶和云层：只在淡出窗口内把这两个现有实例切成 alpha 混合（不写深度，保留 cull），窗口结束后恢复成共享材质原来的混合 / 深度状态；
     - 海鸥：缩小并隐藏，同时不再发叫声。
  3. 离开湖畔（旅程 restore）时恢复一次。
- 不新增节点、材质或 DC。
- 夜晚月亮在 -z，落地时位于镜头背后，所以没有处理。
- 测试：`lakeside-far-view`；`lakeside-sky-follow` 已同步更新。

## 5. D：同一套天空 / 水面参数（074d6c7 + 6b3edad）
- 天空：穹顶淡出后，旅程终点的天空就是相机 clear 色，与棋盘一样取自 `lakesideModeLighting(mode).clearColor`。
  - 已确认 3.8.8 的 SKYBOX(14) 也会清颜色（cc.js `D4`）。
- 水面差异（修复前）：
  - 旅程湖水用的是 instanced 调色板材质；
  - 棋盘用的是 `lakeside-water.mtl` 的副本，写入 `LAKESIDE_DIR_LIGHT_PARAMS` 的 tint / sky / fresnel / spec / wave / light，以及每个模式的 `waterMainLightScale` / `waterAmbientScale` / `waterSkyStrength`。
- 修复：棋盘的设置提成两个共享函数：
  - `lakesideWaterMaterial`（静态部分）
  - `applyLakesideWaterMode`（昼夜部分）
  - 旅程湖水用同样的函数取自己的一份副本，并跟随昼夜切换。Voice Bot 在那两个来源里定的值会同时用在两边。数值没动。
- 测试：`lakeside-shared-water`；`lakeside-water-fog` 和 `lakeside-daynight` 已同步更新。

## 6. B：女孩（2363c37、7f85eec）
- 原因：进入关卡后 WorldFlow 会隐藏她，并把世界层设为 NONE；棋盘相机只看 `LAKESIDE_LAYER`（1<<20）。
  - 草甸、天空之城的棋盘相机同样只看自己的层，所以那里也没有她；
  - 小岛 / 潮汐棋盘是 2D 画（`IslandBoardBackground`），没有 3D 空间，所以不改。
- 做法：lease 生成时（hook 结束、她已停下）复制一份她，放到棋盘场景里：
  - 位置 = 旅程场景⁻¹ × 她的世界变换，也就是她落地的那个位置（同一套 r5h3 场景）；
  - 关节保持原样，所以姿势相同；
  - 动画和脚本组件全部关闭；
  - 设为棋盘层。
- DC：只有她自己的 renderer（原来那个她在关卡中是隐藏的）。随 lease 销毁一次。
- 草甸 / 天空之城：用同一函数，区域模型 = 旅程里 `RegionJourney-<region>` 下的同名模型。
  - 为了不碰 运镜bot 正在改的 lease 文件（09 广场文件还被 journey-occlusion 用 SHA 锁住），由 `WorldNativeComposition` 用 `withRegionBoardGuest` 包一层。
  - 镜头不变：她会出现在原有视角中她落地的位置。如果那个位置在画面外，就看不到；运镜bot 的连续过渡完成后自然对上。
- 已知限制：裙摆 morph 权重不会随复制保留，可能与原来有极小差异。
- 测试：`lakeside-board-guest`（包含草甸 / 天空之城映射和 wrapper）。

## 测试
- 完整 suite：81 项中 76 PASS（HEAD c30eeec，`suite.json`）。只有已知的 5 项未通过：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract（FAIL），navigation-guard（BLOCKED_BROWSER）。新增测试：lakeside-landing-no-pause、lakeside-sky-follow、lakeside-merge-share、lakeside-far-view、lakeside-shared-water、lakeside-board-guest、lakeside-board-preload。
- 未验证：box 上没有 Creator，也没有真机。

## 包体
- 代码：TS 编译为 ES5 并去掉空白后约 +26.0 KB（含注释）；压缩后估计约 +10–13 KB。没有资源变化。
- 预计约 19.14 MB，距离上限 24,641,536 B 还有约 5.5 MB（参考 09a1b8e = 19,125,680 B）。

## Mac 检查
1. **落地不再弹暂停**
   - 先进入湖畔 lake-01，走一两步后回到小岛，再从小岛走旅程进入：不出现「暂停一下」，直接可以操作，步数与离开时一致。
   - 其他地区恢复未完成的局时，仍然显示「暂停一下」（行为不变）。
2. **首次进入的教程**
   - 清空 localStorage（`dot-r5-v12-isolated-20261009:*`、`qfl.ui.seenTools`）后首次进入：没有暂停面板，教程正常出现。
   - 「有未完成的局但教程还没看过」：教程直接出现。
   - 顺带确认：上次看到暂停面板的那台机器，是否保留了上一轮的 localStorage。
3. **过渡期间的天空颜色**：白天、夜晚各一组截图，分别在桥中间（w=0）、w≈0.5、w≈0.8、到达时截取：
   - 开始前与小岛完全一致；中途平滑；
   - w≥0.95 时穹顶和云层完全消失，天空 = 湖畔 clear（白天 28/143/184，夜晚 28/39/64）；
   - 离开后小岛天空、云层和海鸥都恢复。
   - 再测一次过渡中切换昼夜，以及淡出窗口外 DC 与之前相同。
4. **远景一致（C）**：落地前一帧与棋盘第一帧对比截图：都是湖畔远山 / 远岸 + 天空，没有云层或海鸥，左右没有替换。
5. **水面一致（D）**：同一帧位置下，旅程湖水与棋盘湖水的颜色、反光、波纹一致（白天 / 夜晚各一组）。
6. **女孩（B）**：
   - 落地后切到棋盘时她不消失，站在原地，姿势连续；
   - 离开棋盘回到旅程或小岛后只有一个她；
   - 棋盘 diagnostics 中 `guest` 等于她的 renderer 数，DC 增量等于她自己的 DC；
   - 草甸（04→05）和天空之城（08→09）棋盘：在落地点位于视野内时能看到她。
7. **切换帧 / 首次进入的最差帧（A）**：清空缓存后首次进入，白天、夜晚各一次：
   - 记录 reveal 那一帧的耗时：目标 ≤16.7 ms，r3 为 38–57 ms；
   - 记录首次进入的最差帧：r3 为白天 133 ms / 夜晚 115 ms，目标 < 100 ms；
   - 到达段（w≥0.9）中每帧的耗时（预加载分摊的 24 个 / 帧）是否可以接受；
   - 日志 `[QF_LAKESIDE] board-preload` 出现一次，diagnostics 中 `preloaded:true`、`staticMerge.reused:true`；
   - 用 Performance 面板区分剩余的大帧是 Scripting 还是 UI 激活。

## 与 运镜bot a8ba19a 的叠加
- 在 a8ba19a301b1867d68fbe8a9ea9eaab8fc9d3570 的临时 detached worktree 上 cherry-pick f3d3614..c30eeec：9 个提交全部无冲突（结果 493c35f，临时 worktree 已删除，没有新建或移动任何分支）。
- 叠加后再跑：lakeside-landing-hook、lakeside-journey-wire、journey-occlusion、startup-ready 和本分支的 7 个新测试，以及 lakeside-daynight，全部 PASS。
- `git merge-tree` 同样干净。
- 本分支不改 WorldFlowComponent 里 运镜bot 的 holdEnterLevel 部分，也不改镜头 / hook 文件。WorldNativeComposition 只改了 import、preload 那一行和 background 那一行。草甸 / 天空之城的 lease 文件没有改动。
