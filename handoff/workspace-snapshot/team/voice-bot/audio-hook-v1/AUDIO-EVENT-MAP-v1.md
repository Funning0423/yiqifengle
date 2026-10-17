# 游戏事件与音效对照表 + 接入草案 v0.2（Voice Bot，2026-10-09）

> v0.2：按 GGbot 审稿 `team/ggbot/reviews/AUDIO-HOOK-v1-REVIEW.md` 的 A–E 修改，基于 0004 之后的代码，挂载点一律按函数名找，不再写行号。

状态：草案，交 GGbot 审。**只读了 5b449fa 的代码，没有改任何文件**；`GameAudio.ts` 未在 Cocos 里编译或运行（not_run）。按 Grok Bot 的安排，等核心闭环通了再接。

## 1. 现状
5b449fa 工程里没有任何音频文件，脚本里也没有播放声音的代码。引擎 `audio` 模块在 0001b 裁剪时保留了（GGbot 确认），接声音不用动引擎。

## 2. 资源放哪
按 GGbot 的建议：7 个音效放 `assets/resources/audio_sfx/`（去掉 `_v0.1` 版本号），`resources` 现在是启动时加载的分包，合计约 88 KB，不进主包。BGM 和环境声以后按命名规则 v1.1 走 `audio_bgm_<区域>` / `audio_amb_<区域>` 远程包，这版先不接。

## 3. 事件 → 音效
棋盘帧来自 `ManagedMobileBoardUI.bind()` 里的 `animate` 回调（回调第一个参数就是 visual），每帧的 `s.visual.kind` 在主线（`mainline-session.js` 的 `act`）和地区挑战（`regional-session.js`）里都是同一套：`action` → 若干组 `clear` + `drop` → 可能有 `shuffle`。

| 游戏事件 | 怎么判断 | 音效 | 备注 |
|---|---|---|---|
| 玩家一次操作开始（交换 / 点特殊块 / 炸弹） | `visual.kind === 'action'` | 无 | 连击计数清零 |
| 第 1 波消除 | 本次操作里第 1 个 `clear` 帧 | `sfx_match_normal` | |
| 第 2 波（连锁） | 第 2 个 `clear` | `sfx_combo_1` | |
| 第 3 波 | 第 3 个 `clear` | `sfx_combo_2` | |
| 第 4 波及以上 | 第 4 个起的 `clear` | `sfx_combo_3` | |
| 下落 | `drop` | 无 | 太频繁，不建议加 |
| 洗牌 | `shuffle` | 暂无 | 可以以后加一个风吹过的音效 |
| 地区道具（潮汐锚、太阳种子等） | `tool`（只有地区挑战有） | 暂无 | 等道具交互定了再做 |
| 过关 | `render` 里状态从非 `result.*` 变成 `result.*`，且 `s.active.status === 'won'` | `sfx_level_clear` | 第一次 render 只记基准不播，冷启动恢复到结算页不会误播 |
| 打开主线宝箱 | `mainlineReward('openChest', …)` 的返回值 `newlyGrantedRewards` 不为空 | `sfx_chest_open` | 重复领取不播 |
| 地区挑战首通领奖 | `claimR5FirstClear()`（0004 新增）返回 `ok && !duplicate` | `sfx_chest_open` | |
| 地区四关全通纪念物 | `claimRegisteredMemento()` 返回 `ok && !duplicate` | `sfx_chest_open` | |
| 按钮点击（含 0004 新增的「再试一次」） | `ManagedMobileBoardUI.button()` / `iconButton()` 的 `TOUCH_END` | `sfx_ui_click`（音量 0.8） | 棋盘格子不播，只播按钮 |
| 道具槽只点不拖 | `endToolDrag()` 里 `!d.moved` 的分支（0004 起道具槽用 `toolSlot()` 创建） | `sfx_ui_click`（音量 0.8） | 拖到棋盘上生效时由后续 `action`/`clear` 帧出声 |

## 4. 接入点（按函数名找，交 GGbot 合进 0005）
1. 启动：`WorldIntegrationBoot.start()` 里调用一次 `GameAudio.ensure()`。
2. 棋盘：`ManagedMobileBoardUI.bind()` 里 `animate` 回调开头加 `GameAudio.instance?.onBoardFrame(v);`（v 是回调第一个参数）。
3. 过关：`render()` 开头加 `GameAudio.instance?.onRender(s.state, s.active?.status === 'won');`；`onDestroy()` 里加 `GameAudio.instance?.resetRenderBaseline();`。
4. 按钮：`button()` 和 `iconButton()` 的 `TOUCH_END` 回调里先调 `GameAudio.instance?.onButton()`；道具槽在 `endToolDrag()` 的 `!d.moved` 分支调 `GameAudio.instance?.onToolTap()`。
5. 宝箱：拿 `mainlineReward('openChest', …)` 的返回值调 `GameAudio.instance?.onChestResult(r)`。
6. 领奖：拿 `claimR5FirstClear()`、`claimRegisteredMemento()` 的返回值调 `GameAudio.instance?.onClaimResult(r)`。
所有调用都用 `?.`，音频没初始化或资源没加载到时直接跳过，不会影响玩法和测试脚本。

## 5. GameAudio.ts 做了什么
- 常驻节点，一个 AudioSource 播音效（`playOneShot`），一个预留给以后的 BGM / 环境声循环。
- 启动时从 `resources/audio_sfx` 整个目录加载，失败只打警告。
- 同一个音效 60 毫秒内只播一次，同时最多 6 个，防止同帧连续触发叠成爆音，也照顾微信对同时存在的音频实例数量的限制。
- 静音开关存在本地存储 `qfl.audio.muted`，以后设置面板可以直接用。
- 切后台暂停循环声，回前台恢复。

## 6. 审稿里已确认的
- `animate` 每个可见帧都会调用一次；切后台或取消动画时剩余帧被跳过，连击音效会少几下，可以接受。
- 特殊块音效以后再补，这版不做。
- `resources` 在进入启动场景前就加载好了，`loadDir` 不用等分包。
