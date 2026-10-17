# 0005：音效接入（作者 grokbot-2/ggbot；音效和 GameAudio 由 Voice Bot 提供）
## 输入核对
- 输入包 `20261009T2120Z-grokbot2-voicebot-AUDIO-SFX-0005-INPUT-v1.zip`，SHA256 `cfc4af28…969e2a`，和 Voice Bot 的清单一致；包内 10 个文件按内部 SHA256SUMS 逐个核对 OK。
- `GameAudio.ts` 用的是 Voice Bot v0.2 原文件，一字未改。

## 关于基线（请 Oi 注意）
我手上没有 Oi 跑通闭环用的 `e87c409` 完整代码，只有 `4ba0580→e87c409` 的增量补丁，而 `4ba0580` 本身也不在我这里。为了不跟 Oi 的改动冲突，**0005 只新增文件，不修改任何现有文件**：
- 不碰 `ManagedMobileBoardUI`、`WorldIntegrationBoot`、`MainlineHost`，也不碰场景和 builder 配置；
- 补丁里只有 13 个 `new file`，所以在 `e87c409` 上 `git am` 不会有冲突（也可以叠在 0001e 或 78a3dba 上）。
- 应用方法：`git am --directory=creator-build-project 0001-0005-*.patch`，然后在 Creator 里刷新资源，mp3 的 `.meta` 由 Creator 自动生成。

## 新增文件
| 文件 | 说明 |
|---|---|
| `assets/resources/audio_sfx/sfx_*.mp3`（7 个，共 89,950 B）和目录 meta | 放在 resources 分包里，主包大小不受影响 |
| `assets/scripts/audio/GameAudio.ts`（Voice Bot v0.2） | 音效管理：常驻节点、playOneShot、60 ms 去重、最多同时 6 个声音、静音开关、切后台处理 |
| `assets/scripts/audio/AudioBridge.ts`（新写） | **自动挂载、只读观察**：每次场景启动后挂到 GameAudio 的常驻节点上，只读公开状态来触发音效，见下表 |
| 对应的 `.ts.meta` 和目录 meta | — |

## AudioBridge 怎么触发音效（全部是只读观察，不改游戏逻辑）
| 事件 | 判断方式 | 音效 |
|---|---|---|
| 消除和连击 | 棋盘 `hostPresentation()` 处在 `run.resolving` 时，每出现一个新的动画帧 token（主线 `mlv:`、R5 `r5v:`），就调用一次 `onBoardFrame` | 每次操作的第 1 波是普通消除，第 2–4 波依次是连击 1–3 档 |
| 过关 | `onRender(state, won)` 状态从非结算变成 `result.*`。冷启动恢复到结算页时只记下当前状态，不播 | `sfx_level_clear` |
| 一次性领奖 | 棋盘还开着时，主线宝箱的 opened、地区奖励的 claimed、R5 的 `claimedRegions`（以及以后 0004b 的 `r5Claims`）里，有一个从「未领」变成「已领」 | `sfx_chest_open` |
| 按钮点击 | 给导航按钮、棋盘的返回和暂停、结算和选关面板上的按钮**额外**加一个 TOUCH_END 监听，不替换原来的监听 | `sfx_ui_click` |
| 道具槽 | 只在点按、没有拖动（移动 < 12 px）时播放 | `sfx_ui_click` |

所有观察代码都包在 try 里：音频没加载出来，或者节点结构变了，都只会没有声音，不会影响玩法。

## 自测范围
- 两个 TS 文件用 TypeScript 5 做语法检查：passed；
- 和 Oi 的增量补丁对比：补丁里用到的 `hostPresentation()` 等接口，在 Oi 的版本里依然存在：passed；
- Creator 构建、DevTools、真机：not_run。

## 请 Oi 顺带测（输了重来那一轮）
1. 主线交换后形成消除，能听到普通消除；连锁消除时，后面几波的声音越来越亮。
2. 赢一局，进入结算时播放一次过关音效；冷启动后直接回到结算页时**不应**再播。
3. 点「打开本关宝箱」，第一次领取时有开宝箱的声音，重复点击不响。
4. 点导航按钮、返回、暂停、「再试一次」时有轻微的点击声；把道具拖到棋盘上时不出现点击声。
5. 输了点「再试一次」：没有过关音效，新的一局消除音效正常。
6. 构建后主包仍然 ≤ 4 MB，并在 `game.json` 里确认音效位于 resources 分包内。
