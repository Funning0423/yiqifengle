# HUD 状态条 hide()/slideIn()（GGbot，T2+ 集成）

基于：int/v1 5d66c30 + work/运镜bot 7f2b623 的试合并 932570a（work/运镜bot-int 出来后 rebase 上去）。

## 实际节点
`WorldIntegrationBoot.status` 的父节点 `LabelPlate`（顶部深青色圆角条，显示“正在走向海岛…”等过场文字、错误、天空城提示）。
布局基准位置不变：`y = H/2 - 130`（resize 里设置）；如果微信胶囊底部 + 4 px 或安全区顶部比它更低，就把基准往下压到胶囊下面（`topInset()`，常见机型不会触发）。

## API（`assets/scripts/ui/StatusHud.ts`，无 cc 依赖）
- `StatusHud.hide(reason)`：已隐藏时不做任何事。滑入途中调用会直接移到屏幕外（不做淡出）。
- `StatusHud.slideIn(reason, path)`：已显示或正在滑入时不做任何事，所以不会重复滑。0.25 s ease-out，从屏幕顶端外面滑到基准位置。**只改位置，不改透明度。**
- Boot 公共入口：`boot.hideHud(reason)` / `boot.slideInHud(reason)` / `boot.statusHud.state`。
- 只控制位置；条子是否 active 仍按原来的内容规则（有过场文字、错误或天空城时才显示）。

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
日志格式：`[OI_HUD] hooks {...}`、`hide {...}`、`await-settle {target,hooks,crane,timeout,path}`、`slideIn {reason,path}`、`fallback {path,target,afterTarget}`。

## 测试
- `tools/hud/test_status_hud.cjs`：14 项。包括幂等、只动位置、各兜底路径（含“island 提前出现 → 不会在 crane 中途滑入”）、中断、状态来回切换、过期 settle、60 s 上限、胶囊 inset、Boot 接线，以及用**真实 WorldFlow**（flow_sim，T2+ 路由，60 fps）重放 real / settle 晚 2 s / settle 丢失三种情况。
- `tools/cloud-skycity/test_navigation_integration.cjs`：在真实 Boot 和真实 StatusHud 上跑一遍去程和回程，覆盖 5 个视口。
- `tools/hud/test_t0_hooks.cjs`：T0 的 cameraSettle() 对接 T2+ 的 WorldFlowComponent 钩子，GB_MARK 来源为 `source=hook`。

## 未测 / 需要 Mac 验证
- 真机：滑入观感、胶囊遮挡、`[OI_HUD]` 日志里的 path 是否为 `settled`。
- 内容规则：到岛和到家之后，条子本来就没有文字（只有错误或天空城时才显示），所以正常流程里“滑入”不一定看得见；可见效果主要出现在有错误提示或天空城的时候。如果 Funning 希望到岛后常驻一条提示，需要另外定文案。
