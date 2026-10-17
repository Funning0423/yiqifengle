# r4 旅途切后台的声音（ggbot/build05-r4-ui-fixes，50a3074）

在 2c12565 上加了一个提交，没有改写历史，只在本地。bundle 的前置提交是 2c12565，已校验。

## 先说结论：这条线上的旅途过场没有按时间轴走的音效轨，也没有 timing.json
- 全盘和全部分支都查过。小岛去风铃湖畔的旅途（准备、走向彩虹桥、过桥、快到了）没有音效轨或语音轨，也没有分镜点的 timing.json。
- 包里唯一按时间轴播的过场音轨是 audio_cine/sfx_exit_outbound，属于出门过场，有自己的重播规则，和旅途无关。
- 别处的 timing.json 都不在这条线上：
  - 开场过场的 cine-v1 时间表（只是草稿）；
  - 帆船转场（小岛去草原）的 sail_transition.timing.json 和 sfx_transition_island_to_meadow，只在旧的 cine/meadow-early-preload 分支，不在 r4。
- 所以旅途里实际能听到的是底层的声音：快到湖畔那一段的 amb_lake_loop，加上 GameAudio 里的风、海浪和 BGM 循环（切后台时由 suspend('hidden') 暂停，回来恢复）。现在还没有音效会在切后台时被停掉、回来时漏掉。按 timing.json 对齐的续播没有东西可接，所以我没有凭空写一套。
- 以后真加了旅途分镜音效或 timing.json，新测试会故意失败，提醒同时做按时间轴的续播。

## 修了什么
- LakeAmbienceCore.step 有个真问题：湖水循环的两个声源正在交叉衔接（每 19 s 有约 0.2 s 的窗口）时，如果此刻判定为“不需要湖声”，就会把第二个声源停掉并归零。
- 切后台时世界状态是 paused，会被判定为不需要湖声，所以恰好在这个窗口里切后台的话，回来时第二个声源从 0 开始，和第一个错开约 50 ms。
- 现在两个声源都只暂停不归零，回来后从原位置一起继续。原有的“第二个声源一直不响就放弃交叉”的保护还在。

## 新测试 journey-background-audio（已加入 run-suite）
- 在 2 s、9.5 s、交叉衔接中（19.05 s 和 19.126 s）、30 s 这几个点切后台，后台停留 0.5–10 s，回来先有一帧暂停画面，然后旅途自动继续。
- 检查项：
  - 后台期间湖声暂停，位置保留，没有调用 stop；
  - 回来后从原位置继续，偏差 ≤ 50 ms，实测 0 ms；
  - 除交叉衔接外，任何时候只有一个声源在响；
  - 渐入后音量回到满值；
  - 静音或不能出声时不响，位置也不走；
  - sfxMuted 的检查点仍是 3 处，没有新增；
  - 旅途分镜音效和 timing.json 的检查（见上）。
- tools/test_lake_ambience.cjs 6/6 仍然通过。

## 套件（logs/）
- Node 20.19.2：80/85。没过的是已知 5 条：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract、navigation-guard（BLOCKED_BROWSER）。
- Node 22.23.3（suite.json 里 testRuntime=v22.23.3）：81/85。没过的是 production-integrity、legacy-board-ui-pure、cloud-web-contract、navigation-guard。
- 把 f3d3614..50a3074（19 个提交）cherry-pick 到 a8ba19a：没有冲突，湖声测试、过场测试和新测试都通过。临时 worktree 已删除。

## 包体
- LakeAmbienceCore 编译后少了约 96 B，其余都是测试，算下来大约 −0.1 KB。整条分支相对 9581c23 估计仍是 +2–4 KB，离 24,641,536 B 的门槛还很远。

## Mac 检查（界面验收部）
1. 用 50a3074 出包（tools/build-guard/build-wechat-guarded.sh wechat）。在微信开发者工具里打开，机型选 390x844，同时用系统录屏，声音要录进去。
2. 从小岛点「继续旅程」去风铃湖畔，在快到了那一段（能听到湖水和风铃）切后台：开发者工具里按切后台，真机直接回桌面。分别停留约 3 s 和 10 s，然后回来。
3. 应该是：不用点按钮，画面自己继续；湖声在约 1.2 s 内淡入，不从头播，没有一段完全没声音，也没有两层声音叠在一起。风、海浪和 BGM 也会回来。
4. 测音画偏差：在录屏里找回来后画面第一次动的那一帧，再看湖声波形重新出现的位置，两者相差应 ≤ 50 ms（不算 1.2 s 的渐入，只看什么时候开始出声）。然后对比切后台前最后一声风铃和回来后第一声，确认是接着往下走，不是重新从头开始。
5. 在过桥那一段（还没有湖声）再切一次后台，回来后画面继续，不会突然冒出湖声。
6. 测完删掉 Mac 上的录屏、构建和缓存文件。
