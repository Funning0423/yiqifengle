# 0004：可玩闭环修复（作者 grokbot-2/ggbot）
修复了风险清单 v1 的第 1–3 条，并按 Funning 的决定加上「地区挑战（R5）首通奖励」。只改脚本，不动场景、meta 和构建配置。

## 怎么应用
基于 0001e，或者 Oi 的 78a3dba（两者的脚本完全相同）：
`git am --directory=creator-build-project 0001-0004-*.patch`
需要重新构建，主包增加不到 5 KB。

## 改动文件
| 文件 | 改了什么 |
|---|---|
| `assets/scripts/world-r2/MainlineHost.ts` | 修复 1：同一关的上一局如果已经输了（或者赢了且已经记录），再进入时开一局新的；如果是赢了但还没保存的局，仍然保留，方便重试保存。 |
| `assets/scripts/ManagedMobileBoardUI.ts` | 修复 1：主线输了以后，结算面板上多一个「再试一次」按钮（y=-170），直接 `startStage` 开新局。修复 2：道具槽可以拖动，松手位置所在的格子就是目标；原来的「先点格子再点道具」也还能用。拖动时目标格会高亮，拖到棋盘外松手会给出提示，不消耗道具；提示文字也改成了中文。 |
| `assets/scripts/WorldIntegrationBoot.ts` | 修复 3：结算后的主线按钮（下一关、宝箱、地区奖励）只给显示出来的那几个排位置，第一个永远在结算说明文字下方（不高于棋盘中心 -158），矮屏上也压在屏幕内。修复 4：新增「领取首通奖励」按钮，调试入口 `__worldIntegration.r5FirstClear()`。 |
| `assets/scripts/world-r2/WorldNativeComposition.ts` | 修复 4：新增 `r5FirstClearStatus()`、`claimR5FirstClear()`、`r5FirstClearStorage()`。 |
| `assets/scripts/world-r2/R5FirstClearRewards.ts`（新文件）和 `.meta` | 修复 4：首通奖励账本。 |

## 地区挑战首通奖励（修复 4）
- 规则：R5 的每一关第一次通关（`result.saved` 并且 `completionRecorded`）后，可以领一次。领过的会写进账本 `<R5 命名空间>forest-regional-r05-firstclear-v1`，所以冷启动以后也不能重复领。重复点击会返回 `duplicate:true`，不会再发一次。
- 写入以后会马上读回来核对，读回的内容不一致就算失败（`persistence-error`），按钮保持「领取」状态。
- 奖励内容沿用主线宝箱的配置：地区 tide=0、meadow=1、sky=2，加上关卡序号，对应主线第 `地区×4 + 序号-1` 关的宝箱奖励（运行时从 `journey.chests[关].rewards` 读取）。
- **怎么改奖励**：只需要改 `R5FirstClearRewards.ts` 里的 `rewardsFor()`，可以换成一张独立的表，其他代码都不依赖这个对应关系。
- **已知限制**：现在只是把奖励「记进账本」，还没有合并到主线的道具库存里。主线库存的存档格式由 vendor 里的 progression 模块签名，改它风险太大，这次没碰。如果验收要求奖励能在主线里用，需要另开一张单子。

## 自测范围
- 5 个 TS 文件用 TypeScript 5 解析，语法检查 passed；
- 完整类型检查 not_run（这里没有 cc 的类型声明）；
- Creator 构建 not_run；DevTools 和真机 not_run。

## 请 Oi 验收
1. 主线故意输一局 → 点「再试一次」，应该开新局；或者先「返回」，再点「主线 · 开始 / 继续」，也应该是新局，而不是那局输掉的结算。
2. 主线里把炸弹从道具栏拖到某个格子上松手 → 以那个格子为中心 3×3 爆炸，炸弹数减 1；拖到棋盘外松手 → 出现提示，炸弹数不变。
3. 主线赢一局 → 下一关、宝箱、地区奖励按钮都在结算文字下方，不挡「返回」，iPhone SE 这类矮屏上也不超出屏幕。
4. 地区挑战任一关首通 → 「领取首通奖励」→ 按钮变成「首通奖励已领取」→ 杀掉进程冷启动，再进同一关的结算 → 仍然是「已领取」，`__worldIntegration.r5FirstClear()` 里的账本只有一条记录。
