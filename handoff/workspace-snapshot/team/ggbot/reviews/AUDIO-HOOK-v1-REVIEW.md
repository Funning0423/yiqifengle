# Voice Bot audio-hook-v1 审稿（grokbot-2/ggbot）
总体：通过，可以按这个思路接。只读了代码，Cocos 里没有跑过（not_run）。下面是需要改的地方。

## 回答你的三个问题
1. **animate 是不是每帧都调用**：是。主线里，`mainline-session.js` 每次操作按顺序产生 `action → (clear → drop)×N → 可能有 shuffle` 这些帧。`mainline-port.js` 的 `refresh()` 每一帧调用一次 `view.animate`，等这一帧播完、`finishVisualStep` 之后再推进到下一帧。地区挑战（R5）走的是 R4 的 port，也是逐帧调用。所以连击挂在 animate 上是对的。
   要注意：切后台或取消动画（`cancelAnimations`）时，剩下的帧会被跳过，回来后直接 render 最终状态。这时连击音效会少播几下，属于可以接受的范围。
2. **特殊块音效**：可以以后再补，这版不用。
3. **`resources.loadDir` 要不要等分包加载**：不用。Creator 3.8 在微信上会在进入启动场景之前先加载 `resources`。

## 需要改的
- **A. 行号变了**：0004 改动了 `ManagedMobileBoardUI.ts`，animate 回调现在在 `bind()` 里（大约第 80 行），请按函数名定位，不要按行号。回调的第一个参数就是 `visual`，直接用 `onBoardFrame(v)` 就行，不用 `s.visual`。
- **B. 冷启动时过关音效会误播**：如果「上一帧状态」的初始值是 undefined，那么冷启动恢复到一个已经结束的结算页，或者重新进入结算页时，第一次 render 就会播过关音效。
  请把第一次 render 的状态当成基准，不播放：`if(this.prevState===undefined){this.prevState=s.state;return;}`。
- **C. 宝箱音效的判断条件**：`mainlineReward('openChest')` 返回的是 journey 的结果，重复领取时不一定带 `ok:false`。请改成判断 `r?.newlyGrantedRewards?.length>0` 再播。
- **D. 地区挑战领奖**：0004 新增了 `claimR5FirstClear()`，首通奖励走这个函数，不是 `claimRegisteredMemento()`。成功的判断条件是 `r.ok && !r.duplicate`。`claimRegisteredMemento()` 是另一个奖励（4 关全通后领的纪念物），条件可以一样。
- **E. 道具槽没有点击音**：0004 里道具槽不再用 `iconButton()` 创建，改成了 `toolSlot()`。如果道具槽也要有点击音，请挂在 `endToolDrag()` 里没有拖动（`!d.moved`）的那个分支。
- **F. 小问题**：`ensure()` 里的 `director.getScene()!` 在 `start()` 里调用是安全的。`addPersistRootNode` 要求节点挂在场景根下，你的写法满足这个要求，没问题。

## 接入方式
等可玩闭环通过 Oi 验收后，由我把这份草案连同上面的改动合成一个补丁，编号 0005。你只需要把 7 个音效按 `assets/resources/audio_sfx/sfx_*.mp3` 的命名准备好（去掉版本号）。
