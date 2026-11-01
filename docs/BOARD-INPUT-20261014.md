# 正式棋盘恢复档输入修复交接

独立本地检出（local shared clone，不改源目录）：`/Users/shineanl/Documents/Codex/2026-10-14/task-3/board-input-fix`。
分支：`fix/board-input-freeze-20261014`；基线：`6df6021f5e58d7ad60c4f352104f72621a4b6cc2`。
原用户问题及原话单独保留在 `docs/QF-BOARD-FREEZE-20261013.md`，未标成手机问题已关闭。

## 根因与修复

正式 WorldR5Integration → 主线棋盘 → 退出 → 重进，原控制器正确将恢复档置为 run.paused；新 view 没有 boardWasHidden 的隐藏/显示边沿，presentForPlay 又没有安排 PausePanel。结果棋盘外观正常、没有“继续”，canUseTools 持续拒绝输入。基线实际 CDP 触摸证明重进后道具开始事件不取得指针，动作不变；baseline.json 的 restored-paused-session-offers-resume 为 false。

仅 ManagedMobileBoardUI.ts 在正式显示恢复暂停档时安排下一帧开恢复面板（4 行含注释）。保持暂停，显式点继续才恢复输入。没有改角色、模型、存档协议或已有 stage6 释放适配。

## 实测与证据

使用本机 Chromium / Cocos 3.8.8，402×874、DPR1、全新独立 browser context；导航使用正式 host leave/enter 命令，棋盘、弹层、暂停/返回、继续使用真实 CDP touches。没有直接调用棋盤 swap/useTool 提交接口，没有使用用户浏览器或真实存档。

- 基线真实失败：`output/playwright/formal-input-baseline.json`、`formal-input-baseline-reentry.png`。初次 ToolIntroPanel 的正常遮挡另存 intro-covered.json；关闭教学后新档可操作，持续缺口在恢复档。
- 修复真实通过：`output/playwright/formal-input-fixed.json`、`formal-input-fixed-reentry.png`、`formal-input-fixed-after.png`。7 个命名检查通过：合法交换、真实取消不消耗、道具拖放、退出销毁、重进动作一致、恢复档显示继续、点继续后再次道具拖放。
- 最终动作恰为 `[['swap',23,24],['bomb',0],['bomb',1]]`。恢复时 run.paused + PausePanel，点继续并拖放后 run.ready。
- 针对回归：`tools/board-ui/test_restored_entry_resume.cjs` 基线断言失败、补丁后通过；确认显示界面不会静默恢复或改变保存字节，显式继续后原动作保留。结果 `restored-entry-unit.txt`。
- 既有释放/取消模型回归 75 项通过：`drag-regression.txt`；既有冻结恢复回归 19 项通过：`freeze-regression.txt`。这些属于真实TS/控制器模型，不能混同浏览器事件实测。
- 修复 Web 实测时间：2026-10-13 19:07:43–19:08:39 UTC。控制台唯一 error 级输出是 CDP 真取消触发 Chromium “Ignored attempt to cancel a touchcancel event with cancelable=false”提示；无本次资源连接重置或游戏异常。基线资源重置原样保留，后来使用高连接队列本地服务器消除。
- Web 应用脚本SHA256：`9ec83285ee307e99abf50d3ec7938bfdc2ea330cf5366e9ad14efc341dfa9c2b`。棋盘源SHA256：`d66b1c9f4ac429d8cfdb9ebd5b4dad34e2f8f636f8df8fcceabef4020baea377`。

## 构建交付

隔离目录下 `creator-build-project/build/wechat-home-seat-local`；配置仍为 `tools/wechat-home-seat-local-build-options.json`；正式入口 WorldR5Integration.scene。本地 Web 构建 Finished 1min43s、微信构建 Finished58s，exit36沿用本项目约定。日志 `output/playwright/fixed-web-build.log`、`fixed-wechat-build.log`。Creator 构建有既有TypeScript/子进程诊断，按 Finished、产物核验及实际Web运行判断完成，不宣称日志零警告。

主包 1,861,856 B，总包 28,709,293 B，均通过十进制 4,000,000 / 30,000,000 B 门禁，必要分包保留。包体原值总包28,709,186 B，本补丁增加107 B。
微信产物树SHA256：`72bfecee08ac8af94a4f0c60fc17920f7de012a329d5ad40e77c6e4396cf6202`；main分包game.js SHA256：`2597c211d7fbc4f9524be09655d25d21b285aae7bce38bc4f7f8104f2f3f3379`，已确认 compiled presentForPlay 中含 paused/hidden 检查与 returnPause。详情 `fixed-wechat-receipt.json`、`wechat-package-gate.txt`。BuildInfo仍dev，不能只依版本标签判定；用源码/产物哈希。

## 下一轮与限制

手机用户所报问题没有独立真机复验，不能宣称全部手机卡死已关闭。本轮实测只覆盖主线恢复档路径，不覆盖所有地区/存档故障/微信触摸桥。下一轮由根在新对话使用上列隔离微信产物，独立复测新档教学、重进提示继续、交换、道具、取消、退出重进；如果仍卡住，保留原问题并记录当时 state、popups、指针与实际屏幕。

未操作微信工具，未预览上传/发布、未变更凭证权限、未修改真实存档、未上传大包。二维码由用户触发的说明已沿用，不当成本轮阻塞。

源线程要求短进度后，跨线程消息工具被自动审批拒绝，理由为未确认向另一线程发送内部路径/状态的授权；未重试或绕过。进度已在本轮 commentary 给出，最后由平台自动交接。

复跑（从本检出目录，使用现有本机依赖）：

```sh
python3 tools/board-ui/serve_input_build.py
QF_INPUT_REPORT=output/playwright/formal-input-independent QF_PLAYWRIGHT_MODULE=/opt/homebrew/lib/node_modules/playwright QF_CHROMIUM_EXECUTABLE='/Users/shineanl/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' node tools/board-ui/test_formal_input_runtime.cjs
```

这是独立测试建议，不在本轮继续无限测试。
