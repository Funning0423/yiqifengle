# 可玩闭环：可能卡住的地方 v1（grokbot-2/ggbot，只读代码，没有改动）
代码基准：0001 → 0002 → 0001b → 0001c → 0001e（相当于 Oi 的 78a3dba）。行号对应 `creator-build-project/assets/scripts/` 下的文件。
这些都是**读代码推测出来的风险**，没有实测（not_run）。等 Oi 提了工单再逐条修，这里不附任何修复。

## 高（很可能直接卡住流程）
1. **主线输了以后没法重开同一关**：`world-r2/MainlineHost.ts:12-17`。有未结束的记录、并且关卡相同时，代码不会调用 `startStage`，只是恢复原来的记录。
   输掉以后，`engine.status='lost'` 的记录还在，而 `WorldNativeComposition.ts:70` 的 `enterMainline` 又会选回同一关。结果是再点「主线 · 开始 / 继续」，看到的还是那局输掉的结算，没有「重试」入口。
   另外，`mainline-controller.js:437` 的 `discardActive` 没有接到任何 UI 按钮上。
2. **道具不能拖动，只能点**：`ManagedMobileBoardUI.ts:46`。道具槽只响应点击，调用的是 `useTool(this.selected)`；从道具栏拖到棋盘的手势完全没有实现。
   主线炸弹（`world-r2/ManagedMainlineBinding.ts:20`，`submit(['bomb', index])`）必须先点一下格子再点道具。如果先点道具，`selected=-1`，提示栏会直接显示内部原因码。
3. **领奖按钮和结算面板重叠**：「打开本关宝箱」和「领取主线地区奖励」在世界导航层（`WorldIntegrationBoot.ts:63`，相机优先级 60），棋盘结算面板在下面一层（`ManagedMobileBoardUI.ts:98`，优先级 50，「返回」在 y=-46）。
   导航按钮按 `70 - i*56` 排位置（`WorldIntegrationBoot.ts:66`），隐藏的按钮也占序号，所以宝箱按钮可能正好盖在结算面板的「返回」或「重试保存」上，点到的是上层按钮。

## 中
4. **地区挑战（R5）赢了没有奖励，这是设计上的**：`world-r2/ManagedBoardSession.ts:43-46` 写死了「未接通关账本，不解锁、不发奖励」。
   R5 唯一的奖励是 `WorldNativeComposition.ts:80` 的纪念物，要把同一地区 4 关全部通关才能领。如果验收要求「一次性领奖」走地区挑战，这里一定会被判失败。需要 Funning 定一下：领奖验收走主线宝箱，还是走 R5。
5. **冷启动后有未完成的局，但选了别的关**：`MainlineHost.ts:14-15` 的 `startStage` 会被 `mainline-controller.js:267` 以 `active-attempt-exists` 拒绝，然后直接抛错。
   导航层会把这个英文错误原样显示出来（`WorldIntegrationBoot.ts:62` 的 `invoke` 里没有这个原因码的中文翻译）。按正常入口「主线 · 开始 / 继续」会选回原来那局，所以只有通过调试接口或者以后加的选关界面才会碰到。
6. **冷启动恢复的局是暂停状态**：`MainlineHost.ts:17` 的注释写明，恢复的局保持暂停。棋盘上要点暂停键（`ManagedMobileBoardUI.ts:45`）才能继续，界面上没有任何提示，测试的人可能以为卡死了。
7. **安全区读取在微信里可能报错**：`ManagedMobileBoardUI.ts:55` 调用了 `getComputedStyle(document.documentElement)`。微信适配层里的 `document` 存在，但不一定提供 `getComputedStyle`，没有的话棋盘 layout 会抛 TypeError。
   导航层（Oi 已经能看到）没有用到这个函数，所以棋盘是否受影响要进关卡才知道。
8. **棋子图集现在在 resources 分包里**：`ManagedMobileBoardUI.ts:50` 的 `resources.load('ui/pieces')`。0001c 把 resources 设成了分包。正常情况下引擎启动时会先加载它，但如果没加载，棋子不会显示，只会在 console.error 里留一条记录，不会报错中断。

## 低
9. 主线固定用种子 1（`WorldNativeComposition.ts:71` 的 `enterMainlineStage(stageId, seed=1)`），每次开局都是同一个盘面。不影响闭环，但测试时会觉得「每次都一样」。
10. 存档都写在隔离的测试命名空间里（`PersistentMainlinePort.ts:4` 和 `PersistentR5Port.ts:3`，`dot-*-isolated-20261009:`），冷启动可以恢复。但它和以后正式存档的键名不同，上线前要迁移。

## Oi 测试时请重点看
- 主线输一局 → 返回 → 再点「主线 · 开始 / 继续」，看能不能重开（对应第 1 条）；
- 主线赢一局 → 看宝箱按钮和结算面板的「返回」是不是重叠（第 3 条）；
- 杀掉进程再冷启动 → 进主线，看是不是停在暂停状态（第 6 条）；
- 进关卡后看控制台第一条红字，是不是 `getComputedStyle` 相关（第 7 条）。
