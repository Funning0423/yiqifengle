# 0004b：R5 首通奖励并进主线道具库存（作者 grokbot-2/ggbot）
**0004b 叠在 0004 之上。** 打法：`git am --directory=creator-build-project 0001-0004b-*.patch`，前提是 0004 已经打过。只改脚本。

## 存档的「签名」是什么，我怎么处理的
主线存档没有加密签名，所谓的签名有两层：
1. **写入核对**：`journey-bridge.js` 的 `mutate`，会比较写入前存档原文的序列化结果（signature），对不上就判定 `journey-changed`，存档变成只读。
2. **durable Store 写入**：`durable-store.js` 写完以后马上读回来，必须和要写的内容完全一致才算成功。

0004b 的领奖完整走原来的路径：`Controller.claimR5FirstClear` → `_claim` → `JourneyBridge.mutate`（上面第 1 层）→ `Progression._save` → `Store.write`（第 2 层）。这和开主线宝箱是同一条写入路径，没有绕过任何校验。
`LegacyProgressionV3.js` 没改，它被 `LegacyJourneyReader` 用固定的 SHA256 校验，现在仍然是 `d9ddc26f…041b`。

## 改动文件
| 文件 | 改了什么 |
|---|---|
| `mainline-r1/runtime/vendor/progression.js` | 新增可选字段 `r5Claims`，内容是关卡 id 数组，为空时不写入存档。另外新增 `claimR5FirstClear`、`r5Claimed`、`r5FirstClearRewards` 三个方法；`_grants()` 会把已领的 R5 奖励算进库存。读档校验多了一条：如果有 `r5Claims`，它必须是合法的关卡 id 数组，否则按坏档处理，变成只读，原档不动。 |
| `mainline-r1/runtime/journey-bridge.js` | `mutate` 的白名单里加了 `claimR5FirstClear`。 |
| `mainline-r1/runtime/mainline-controller.js` | 新增 `Controller.prototype.claimR5FirstClear`，内部走 `_claim`，和 `openChest` 一样。 |
| `world-r2/R5FirstClearRewards.ts` | 改成调用主线 controller。如果主线还有一局赢了但没保存，会拒绝领取（`mainline-unsaved-win`），避免那局之后保存失败。 |
| `world-r2/WorldNativeComposition.ts`、`WorldIntegrationBoot.ts` | 接到新的实现上，并加了 `mainline-unsaved-win` 的中文提示。 |

## 奖励内容和修改方法
R5 关卡 `r05-<地区>-0<序号>` 对应主线宝箱表的第 `地区序号×4 + 序号-1` 项，地区序号是 tide=0、meadow=1、sky=2。比如 `r05-tide-02` 对应第 1 项，奖励是 windBell×1。
要改奖励，只改 `progression.js` 里的 `r5Level()`（对应关系）或者 `REWARDS` 表。注意 `REWARDS` 表和主线宝箱共用。

## 0004 的旧账本
0004 写的旁路账本 `<R5 命名空间>forest-regional-r05-firstclear-v1` 现在不再读取。按 0004 测试时「领过」的关卡，可以真正领一次进库存，不会重复。

## 自测（`node check_0004b_r5_reward.cjs <工程>/assets/scripts`）：16/16 passed
- 已有的 v3 老存档用新代码读取：不是只读、没有签名失败、原文一个字节都没变，视图里也没有 `r5Claims`；
- 领取后 windBell +1，`r5Claims` 写进存档；第二次领取、冷启动后再领都判为重复，不再发奖励；
- `LegacyProgressionV3` 读升级后的存档，不是只读；
- 关卡 id 错误会被拒绝；`r5Claims` 被篡改时存档变成只读、不会凭空发奖励，原档不动；
- 新玩家领取 `r05-sky-04` 能拿到 2 件奖励。
TypeScript 文件语法检查 passed；Creator 构建、DevTools 和真机都是 not_run。

## 请 Oi 验收
1. **老存档升级（必验）**：先不打 0004b，在原包里玩到至少一关有星、开过宝箱 → 打 0004b 重新构建，存档不清 → 冷启动 → 进主线：不能出现「存档保护 / 只读」提示，星级、宝箱和道具数量都要和升级前一样。`__worldIntegration.mainlineStorage()` 里 `forest-v33-journey` 没有 `r5Claims` 字段（领过以后，`__worldIntegration.r5FirstClear().storage.r5Claims` 里才会出现）。
2. 地区挑战任意一关首通 → 点「领取首通奖励」→ 按钮变成「已领取」→ 进主线，对应的道具数量 +1。
3. 杀掉进程冷启动 → 回到那一关的结算页 → 仍然显示「已领取」，再点也不会多发。
4. 主线道具照常能用，扣减正确。
