# 顶部状态条：已彻底移除（GGbot，T2+ 集成）

基于：work/运镜bot-int `4bead5a`（int/v1 `5d66c30` + work/运镜bot `17844e5`）。

## 决定（Funning 最终版，2026-10-11）
顶部状态条**完全去掉**，世界就绪后在任何状态下都不出现：家里、出门/回家过场、岛上、出错、天空城（含 skycity-loading）。
这取代了之前“有内容才滑入”的 HUD 策略（旧版在 5ef0e53，分支 `backup/GGbot-post-t2-trial-5ef0e53`）。

## 做法：直接拆掉 HUD 接线（不保留空壳 API）
- 删除 `assets/scripts/ui/StatusHud.ts`（含 `.meta`）、`StatusHudDriver`、`bindHudHooks()`、`hideHud()/slideInHud()`、`applyStatusHud()`。
  查过：Boot 之外没有任何代码或分支（T0 / T1 / T9 / Voice bot）调用这些 API，所以不留空壳。
- `WorldIntegrationBoot.paintNavigation()` 第一句就把状态条父节点 `LabelPlate` 设为 `active=false`（在任何提前 return 之前），
  并清空文字；原来每帧“有错误/过场文字/天空城就 `active=true`”的规则已删除，过场文字表也删了。
- Boot 不再订阅 `onCameraSettled` / `onCraneStart`（运镜bot 的钩子本身不动，T0 自动测试仍在用，见 `tools/hud/test_t0_hooks.cjs`）。
- 运镜bot 的 `trackTransitionHud()` 保留，只负责启动岛上按钮的入场动画；里面的 `hudTransition` 空函数删掉了。

## 错误和天空城提示去哪了
只写控制台，不上屏：`[OI_HUD] suppressed {"kind":"error"|"skycity","text":...}`，同一条只记一次（变化时再记）。
角色绑定失败（paintNavigation 里提前 return 的那条路径）也会记。

## 例外（请 lead 确认）
**加载阶段**（`loadPhase!=='ready'`）的那块牌子没动：它在屏幕**底部**，显示“正在准备海岛…”，启动失败时显示“世界加载失败，点这里重试”，
点它是唯一的重试入口。世界就绪的那一帧（`loadWorld` 里同步调用 `paintNavigation()`）它就被关掉，之后不会再出现。
如果这块也要去掉，需要另外给启动失败一个重试入口。

## 测试
- `tools/cloud-skycity/test_navigation_integration.cjs`：真实 Boot（type-stripped），5 个视口
  （320×568、390×844、402×874、568×320、844×390），逐帧断言状态条 `active=false`：
  home、去程过场 5 个状态、island（含 settle/crane 回调照常触发）、出错（错误出现、持续、消失）、回程过场 5 个状态、
  skycity-loading、skycity、paused/needsResume、角色绑定失败的提前 return；并断言错误和天空城提示进了 `[OI_HUD] suppressed` 日志、
  同一条不重复记；Boot 上不再有 `statusHud` / `hideHud` / `slideInHud` / `bindHudHooks`。
- `tools/hud/test_t0_hooks.cjs`：T0 的 cameraSettle() 对接 T2+ WorldFlowComponent 钩子（与状态条无关，保留）。

## 未测 / 需要 Mac 验证
- 真机：岛上、家里、过场、天空城、出错时顶部都没有条；右上角微信胶囊附近没有残影。
- 加载画面底部的提示和“点这里重试”照旧。
