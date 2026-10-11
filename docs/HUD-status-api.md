# HUD 状态条 hide()/slideIn()（GGbot，T2+ 集成）

基于：int/v1 5d66c30 + work/运镜bot 7f2b623 的试合并 932570a（work/运镜bot-int 出来后 rebase 上去）。

## 实际节点
`WorldIntegrationBoot.status` 的父节点 `LabelPlate`（顶部深青色圆角条，显示“正在走向海岛…”等过场文字、错误、天空城提示）。
布局基准位置不变：`y = H/2 - 130`（resize 里设置）；如果微信胶囊底部 + 4 px 或安全区顶部比它更低，就把基准往下压到胶囊下面（`topInset()`，常见机型不会触发）。

## 显示策略（lead 2026-10-11 决定）
岛上和家里**不放常驻文字**（Funning 倾向用视觉引导）。状态条只在有内容时出现在屏幕上：错误、天空城提示等。没有内容时一直藏在屏幕外，不会出现空条。
- 过场中：gate 关闭。即使有“正在走向海岛…”这类过场文字，状态条也不显示。
- gate 何时打开：仍按 settle/crane 的时机和兜底规则（见下文）。打开后，有内容才滑入（`slideIn reason=content`）；没内容就继续隐藏（`stay-hidden reason=empty`）。
- gate 打开后：内容后来出现就滑入（`path=content-change`）；内容变空就滑出（`slideOut reason=empty`）。滑动用 0.25 s smoothstep，只改位置，不做淡出；滑到一半反向也连续，不会跳。滑出过程中保留最后一条文字，完全移出后才 `active=false` 并清空文字。
- settle 回调是在同一步里同步触发的，触发时上一帧的过场文字（例如“正在坐下…”）还没更新。所以 gate 打开后，要等**下一次** `setContent`/`tick` 拿到新内容再决定显示还是隐藏，避免闪一下（有专门测试）。

## API（`assets/scripts/ui/StatusHud.ts`，无 cc 依赖）
- `hide(reason)`：关闭 gate，立即移到屏幕外（不淡出）。重复调用无效果。
- `slideIn(reason, path)`：打开 gate（日志 `gate-open`），下一帧按内容决定滑入或继续隐藏。重复调用无效果。
- `setContent(has)`：Boot 每帧在 tick 之前上报是否有文字；同一个值重复上报不产生任何动作。
- `state`：`hidden`（gate 关闭）/ `out` / `sliding-in` / `shown` / `sliding-out`；`visible()` 表示状态条需要 active。
- Boot 入口：`boot.hideHud()` / `boot.slideInHud()` / `boot.statusHud`。状态条的 active 只由 `applyStatusHud` 决定，原来每帧按文字设置 active 的那条规则已删除。

## 挂钩点（StatusHudDriver，由 Boot 驱动）
| 时机 | 动作 |
|---|---|
| state `standing`（leaveHome） | hide |
| state `island`（从过场状态进入）**且** `onCameraSettled('island')`，先后顺序不限 | slideIn（path=settled） |
| state `walking-home`（returnHome） | hide |
| state `home`（从 `sitting` 进入）+ `onCameraSettled('home')` | slideIn（path=settled） |

- 订阅：Boot 就绪后调用 `bindHudHooks()`，从 `composition.world`（WorldFlowComponent）订阅 `onCameraSettled` / `onCraneStart`；`onDestroy` 时退订。
- 状态来源：Boot 每帧轮询 `paintNavigation → trackTransitionHud → hudDriver.onState`；位置在 `applyStatusHud(dt)` 里每帧写入。
- T2+ 的事件是同步发出的（restore() 之后同一步就发 settled），所以 settle 往往比 Boot 看到 `island` 早一帧。driver 会先记下 settle，等看到状态后再滑入。

## 兜底超时（以相机为准，并写日志 `[OI_HUD]`）
`island` 状态（restore()）可能比相机停稳更早出现。如果在 `island` 之后固定等 2 s，HUD 可能在升降镜头（crane）中途滑进来，所以超时按相机计算：
| 条件 | 超时（从目标状态开始计） | path |
|---|---|---|
| 没有 T2+ 钩子（没有 onCameraSettled API） | 2 s | `timeout-nohooks` |
| 有钩子，且已经收到 onCraneStart（去程） | min(10 s, crane 剩余时间 + 2 s)；crane 时长按 7.68 s 算 | `timeout-crane` |
| 有钩子但没收到 crane（fixed 模式 / 回程 home） | 2 s | `timeout-nocrane` |
| 隐藏期间进入非过场、也不是目标的状态（paused/error/取消后回到 home 或 island/level/skycity） | 立即 | `interrupt` |
| 任何情况下隐藏超过 60 s | 立即 | `timeout-max` |
日志格式：`[OI_HUD] hooks {...}`、`hide {reason}`、`await-settle {target,hooks,crane,timeout,path}`、`gate-open {path,trigger}`、`slideIn {path,reason:content}`、`stay-hidden {path,reason:empty}`、`slideOut {path,reason:empty}`、`fallback {path,target,afterTarget}`。

## 测试
- `tools/hud/test_status_hud.cjs`：14 项。包括幂等、只动位置、各兜底路径（含“island 提前出现 → 不会在 crane 中途滑入”）、中断、状态来回切换、过期 settle、60 s 上限、胶囊 inset、Boot 接线，以及用**真实 WorldFlow**（flow_sim，T2+ 路由，60 fps）重放 real / settle 晚 2 s / settle 丢失三种情况。
- `tools/cloud-skycity/test_navigation_integration.cjs`：在真实 Boot 和真实 StatusHud 上跑一遍去程和回程，覆盖 5 个视口。
- `tools/hud/test_t0_hooks.cjs`：T0 的 cameraSettle() 对接 T2+ 的 WorldFlowComponent 钩子，GB_MARK 来源为 `source=hook`。

## 未测 / 需要 Mac 验证
- 真机：滑入观感、胶囊遮挡、`[OI_HUD]` 日志里的 path 是否为 `settled`。
- 真机上确认：到岛和到家时不出现空条；出错时滑入，错误消失后滑出。
