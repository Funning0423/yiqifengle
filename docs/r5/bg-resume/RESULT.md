# F4 切后台回来不用再点「继续」

时间：2026-10-18 15:11 EDT。套件于 15:04 EDT 在 `d8e1b0a` 上跑完。
分支：`cursor/r5-bg-resume-1bb8`，基线 `gbt/r5-integrated`（`a83e1c2`）。

## 「继续」遮罩从哪来

底部「继续」是 `WorldIntegrationBoot` 的 resume 按钮（`this.button('resume','继续',…)`）。`paintNavigation` 在 `needsResume`、棋盘弹窗未开、且不是过场自动续播时把它打开。位置在画面底部。不是岛上「继续旅程」路牌，也不是棋盘面板里的「继续」。

会弹：`hide()` 把状态改成 `paused` 的情况——坐着的家、闲置海岛、进行中的棋盘、天空城参观（`journey.region` 仍是 island）。

不弹：出门/回家途中（r4.1 已冻结）、`region-loading` / `region-travel`（帆船和热气球都在这段里）、已到达的草原 / 湖畔 / 旅途天空城，以及海岛自由走动且 `walkProgress` 在 (0, 1)。这些状态被冻住，`show()` 自己清掉 `needsResume`。

## 做了什么

`WorldFlow.hide` 对上述活动只打冻结：操作 token、job、姿态、状态都留着。`show()` 清 `needsResume`，不调用 `resume()`。`resume()` 会 `cancelAndReset` 回到稳定姿态，帆船/热气球会闪回起点，旅途 token 也接不回去。`advance` 在 `needsResume` 时不走，回来第一帧 dt 封顶 0.1 秒，所以藏 3 秒、10 秒、60 秒、10 分钟都不会跳进度。

网页 `visibilitychange` 补发 `Game.EVENT_HIDE` / `EVENT_SHOW`，和微信 `wx.onHide` / `onShow` 走同一套处理。`hide` / `show` 幂等。帆船 `onFrame` 和热气球 `step` 看 `transitAppHidden`（`document.hidden`，或宿主快照 `hidden` / `needsResume`）。靠岸不再用 `Date.now()`，按 `world.wait` 累加，后台不加。

音频：冻结不把世界状态改成 `paused`，`onWorldState` 不会重开 BGM。`GameAudio.onHide` 是 pause，`onShow` 从同一 `currentTime` 续播。

## 棋盘仍要确认

进行中的棋盘不自动开表。`hide` 仍进 `paused`，未结算时 `show` 保持 `needsResume`。`tools/test_level_background.cjs` 和主线边界 J05/J10 锁定「回来仍暂停，直到明确 resume」。自动开表会在玩家看见棋盘之前走秒，等于改掉已验收的暂停。已结算的关卡本来就会自己回到 `level`（`isSettledResult`），这条没动。

## 测试

Node v22.23.3，`QF_TYPESCRIPT_MODULE=/usr/local/lib/nodejs/lib/node_modules/typescript`，`tools/journey-integration/run-suite.cjs`：122 项，121 PASS。唯一非 PASS 是 `navigation-guard: BLOCKED_BROWSER`。套件状态 BLOCKED，退出码 1，和 build06 一样。`world-background-freeze` PASS。新增 `bg-resume` PASS：帆船、热气球、草原/天空城自由走动，隐藏 3/10/60/600 秒期间进度和落点不变；`show` 后 `needsResume=false`；下一帧步进不超过 0.1 秒（旅途 +0.0167 秒，走动 +0.0083 秒）；`state` 不是 `error`，`snapshot.error` 为 null。BGM 偏移停在 1.5 秒，`restarts=0`。坐着的家、闲置海岛、进行中的棋盘仍要「继续」。

## 包体

未改资源，未重打 wechat 包。资源差值 0。transport 子包、场景 DC、帧率没有变化。

## 截图 / 视频

无。验收是 Node 套件，没有浏览器画面。

## 遗留

坐着的家、闲置海岛、天空城参观、进行中的棋盘仍要点「继续」。海岛自由走动只在 `walkProgress` 处于 (0, 1) 时自动续；走完回到闲置后仍要确认。
