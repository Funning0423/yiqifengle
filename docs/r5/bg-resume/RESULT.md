# F4 切后台回来不用再点「继续」

时间：2026-10-18 15:29 EDT。套件于 15:22 EDT 在 `4e8f116` 上跑完。
分支：`cursor/r5-bg-resume-1bb8`，基线 `gbt/r5-integrated`（`a83e1c2`）。

## 「继续」遮罩从哪来

底部「继续」是 `WorldIntegrationBoot` 的 resume 按钮（`this.button('resume','继续',…)`）。`paintNavigation` 在 `needsResume`、棋盘弹窗未开、且不是过场自动续播时把它打开。不是岛上「继续旅程」路牌，也不是棋盘面板里的「继续」。

现在只有进行中的棋盘会弹：`hide()` 把 `level` / `level-loading` 改成 `paused`，计时停住，回来仍要确认。

不弹：出门/回家途中、旅途（帆船、热气球都在 `region-travel`）、已到达的草原 / 湖畔 / 天空城、海岛待机和自由走动、家里坐着、天空城游览（含 `skycity-loading`）。这些状态被冻住，`show()` 自己清掉 `needsResume`。

## 做了什么

`WorldFlow.hide` 对上述活动只打冻结：操作 token、job、姿态、状态都留着，不调用 `restore()`。`show()` 只清 `needsResume`。`resume()` 会 `cancelAndReset` 再 `change(stable)`：坐着的呼吸、岛上待机会被掐掉重摆，游览中的场景会被藏起来，所以这三种不能走 `resume()`，用冻结 / 解冻。`advance` 在 `needsResume` 时不走，回来第一帧 dt 封顶 0.1 秒。

网页 `visibilitychange` 和微信 `wx.onHide` / `onShow` 走同一套处理。帆船、热气球在 `document.hidden` 或宿主 `hidden` / `needsResume` 时不加时钟。靠岸按 `world.wait` 累加，不用 `Date.now()`。

音频：冻结不把世界状态改成 `paused`，BGM 不会重开。`GameAudio.onHide` 是 pause，`onShow` 从同一 `currentTime` 续播。

`skycity-loading` 若在隐藏中跑完，进入时的 `restore()` 会把游览藏起来；解冻时只补一次 `visit.show()`，不再 `cancelAndReset`。

## 棋盘仍要确认

进行中的棋盘不自动开表。`tools/test_level_background.cjs` 和主线边界 J05/J10 锁定「回来仍暂停，直到明确 resume」。自动开表会在玩家看见棋盘之前走秒。已结算的关卡本来就会自己回到 `level`。

## 测试

Node v22.23.3，`QF_TYPESCRIPT_MODULE=/usr/local/lib/nodejs/lib/node_modules/typescript`，`tools/journey-integration/run-suite.cjs`：122 项，121 PASS。唯一非 PASS 是 `navigation-guard: BLOCKED_BROWSER`。套件状态 BLOCKED，退出码 1，和 build06 一样。`world-background-freeze`、`exit-background-resume`、`journey-cutscene-ui`、`legacy-action-clock`、`bg-resume` 均 PASS。

`bg-resume` 覆盖帆船、热气球、草原/天空城走动，以及家里坐着、小岛待机、天空城游览：隐藏 3/10/60/600 秒期间进度、落点和片段时钟不动；`show` 后 `needsResume=false`，没有 `cancelAndReset`；下一帧时钟续上，旅途步进不超过 0.1 秒；`snapshot.error` 为 null。BGM 偏移停在 1.5 秒，`restarts=0`。进行中的棋盘仍要「继续」。

## 包体

未改资源，未重打 wechat 包。资源差值 0。transport 子包、场景 DC、帧率没有变化。

## 截图 / 视频

无。验收是 Node 套件，没有浏览器画面。

## 遗留

进行中的棋盘（以及进入棋盘的 `level-loading`）仍要点「继续」。其余列出的前台状态回来直接接着播。
