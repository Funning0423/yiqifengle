# r4 界面修复：旅途过场 + 结算页宝箱（ggbot/build05-r4-ui-fixes）

只在本地，没有推送。基于 voice/build05-lakeside-r4 的 9581c23（bundle 的前置提交就是 9581c23，已校验）。

| 提交 | 内容 |
|---|---|
| 91ef28b | cherry-pick -x ec0de1f（reward-background-return 改成无 RewardPanel 的流程），作为 0002 的测试前置 |
| ebd9658 | 修复 2：结算页宝箱没开时不显示任何奖励；开箱时徽章从箱口升起，只播一次 |
| 2c12565 | 修复 1：旅途过场去掉「暂停旅程」按钮和字幕横条；测试版右下角小字；切后台暂停、回来自动继续（HEAD） |

## 修复 1：旅途过场
- 去掉 region-loading/region-travel 时的「暂停旅程」按钮（cancelVisit）。cancelVisit 只留给天空城加载的「取消前往」，那不是旅途过场。
- 下面那条横条就是 Boot 里的 notice 底板（#123233，底部 +55）：「正在准备…/沿着彩虹…/快到了…/旅程已暂停…/旅程暂时受阻…」。09a1b8e 里没有单独的调试备注层，横条只有这一个来源，已经整块删掉。
- 新增 ui/DevPreviewMark.ts：只有一个 Label「开发预览画面，不代表最终效果」。字号 10，白色 α150，右对齐，放在右下角、离安全区底边和右边 12 pt，离右上角的胶囊按钮很远，只在过场时显示。没有 Button，没有 BlockInputEvents，也没有触摸监听，点击会直接穿过去。
- 开关：DEBUG（cc/env 的构建开关）为真时显示；微信里 envVersion 为 develop/trial（开发者工具、开发版、体验版）时显示，release（正式版）或读不到时不显示；网页预览（没有 wx）时显示。单看 DEBUG 不够，因为桌面测试包用的是 tools/build-guard/wechat-release.json，debug 是 false。
- 暂停：没有常驻按钮，点画面也不会暂停。只有切后台会暂停（原有的 WorldFlow.hide 会挂起旅途）。回到前台后自动继续，走的是和「继续」按钮相同的 resumeJourney，只调一次，等当前操作结束再继续，「继续」按钮不会闪一下。小岛和出错时的返回逻辑没变。
- 新测试 journey-cutscene-ui，已加入 run-suite。

## 修复 2：结算页宝箱
- 原因：floating() 会让本来就是「已领取」的奖励漂在没开的宝箱上，比如重玩某一关，地区道具早就领过了。现在页面上有宝箱时，宝箱没开就不放任何奖励节点（徽章、图标、数量、名字都不放）。
- 开箱时徽章从箱口升起，沿用原有的 0.42 s backOut、0.09 s 错开和轻微浮动。动画只在开箱那一刻出现的面板上播放。之后再显示已经打开的宝箱（恢复、重新进入）时，徽章直接在最终位置。升起动画也按真实时间算，所以升到一半切后台，回来时徽章已经到位。
- reward-background-return 已更新：开箱前（3 次切后台/回来）没有可见的奖励节点；开箱瞬间徽章在箱口下方、半透明，然后停到宝箱上方；开箱后 3 次切后台，位置和不透明度都不变（只有 3 pt 的浮动），没有重复领取；重玩关卡（宝箱没开、道具早已领取）时什么都不显示；之后打开的宝箱直接到位、不重播。390x844 和 320x568 都测了。用旧的 floating() 规则跑会失败。
- 叠到测试线上：在 dc25cec 上临时 cherry-pick ebd9658，没有冲突，Node 22 PASS（Node 20 照常是 BLOCKED_NODE）。test_result_home_claims 不需要改，照常 PASS。
- 将来 r4 同时合进测试线（含 ec0de1f）和本分支时，91ef28b 会变成空提交，跳过即可。

## 套件（logs/）
- Node 20.19.2：79/84。没过的是已知 5 条：production-integrity、legacy-board-ui-pure、reward-background-return（Node 20 缺 stripTypeScriptTypes）、cloud-web-contract、navigation-guard（BLOCKED_BROWSER）。
- Node 22.23.3（suite.json 里 testRuntime=v22.23.3）：80/84。reward-background-return 通过了，剩下 production-integrity、legacy-board-ui-pure（这两条在测试线上已修）、cloud-web-contract、navigation-guard。
- 基线 9581c23 是 78/83，同样是已知 5 条。新增了 journey-cutscene-ui，所以总数变成 84。
- 把 f3d3614..HEAD（18 个提交）cherry-pick 到 a8ba19a：没有冲突，两条新测试都通过。临时 worktree 已删除。

## 包体
- 估计增加约 2–4 KB：DevPreviewMark 编译后约 2.9 KB，Boot +0.1 KB，BoardPanels +0.2 KB，均为未压缩的 JS。没有新资源。离 24,641,536 B 的门槛还很远。

## 截图：盒子上做不了
盒子上没有 Cocos Creator 3.8.8，TS 编译和资源打包都要靠它，而且没有现成的 9581c23 或 HEAD 网页构建。测试 harness 里只有节点替身，渲染不出真实画面，所以没有提供截图，也没有拿示意图代替。

### Mac 截图步骤（界面验收部，390x844）
1. 分别用 9581c23（改动前）和 2c12565（改动后）出包：`tools/build-guard/build-wechat-guarded.sh wechat`。在微信开发者工具里打开，机型选 390x844 的 iPhone 12/13/14。开发者工具里 envVersion=develop，所以改动后的包会显示小字。
2. 旅途过场：从小岛点「继续旅程」去风铃湖畔，分别在准备、走向彩虹桥、过桥、快到了几个阶段截全屏，底部要截进去。
   - 改动前应看到「暂停旅程」按钮和下面的字幕条。
   - 改动后底部什么都没有，只有右下角半透明小字。小字离底边和右边至少 12 pt，碰不到 home 条和胶囊按钮。
3. 点击测试：过场中点画面中间和右下角小字，过场继续，不暂停。
4. 切后台测试：过场中切后台 5 秒再回来，画面自己接着走，没有「继续」按钮。
5. 结算页：通关一个有宝箱的主线关。先截宝箱没开的状态：宝箱上方不能有任何徽章、图标或数字。点宝箱后录 1 秒视频或截 3 帧，徽章应从箱口升起，停在上方。然后切后台再回来截一张：徽章在原位，不重播动画，不重复领取。
   - 重玩已领过地区道具的关卡，宝箱没开时同样什么都不能显示。
6. 正式版确认：把包设成 envVersion=release（体验版改正式版），或者在真机正式版里确认没有那行小字。
7. 截图放到 ui-audit/2026-10-17/r4-ui-fixes-2c12565/，并删掉 Mac 上的构建、缓存和录屏文件。
