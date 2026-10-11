# R5 通关账本：最小安全接口候选

状态：契约与纯函数测试已实现，生产 provider 未接入。contracts/completion-prototype.cjs 不在 import-only 中；没有真实存储写入、没有发奖励。v1.1 当前局运行时继续保存 version 1 活动记录，completionRecorded=false 不变。

## 必须先解决的身份缺口

现有 R5 活动 checkpoint 有关卡、内容版本、seed、动作与确定性最终状态，但没有稳定 attemptId。同一关/同一 seed 可以合法玩多次，不能把 stageId+seed 当尝试 ID；随机生成“恢复后的新 ID”也会把一次通关误计多次。

建议未来活动记录 version 2 在开始局、输入可用之前，持久化 host 生成的唯一 attemptId（建议 r5a- + UUID）。该 ID 在预览、提交、后台、恢复、存储重试和终局全过程不变。新开局必须先走显式放弃/结束流程，不能静默覆盖另一个 attempt。

本原型要求 version 2 且稳定 attemptId；现有 version 1 不能直接送入通关接口。没有实现自动 v1→v2 迁移。迁移策略、未来格式保护与旧局处理必须另行明确并验收，不能在接线时临时补随机 ID。

## 最小数据边界

活动键继续采用独立 forest-regional-r05-active，但将来 version 2 增加 attemptId、completionReceipt；checkpoint/pendingAction 保留既有含义。

通关键建议 forest-regional-r05-progress/version 1：
- packId: regional-r05
- revision：乐观并发检查版本
- receipts：attemptId → 可验证的关卡、内容版本、seed、分数、剩余步数和动作证明
- records：stable stageId → completed、clears、bestScore、bestMovesRemaining

不要把 R5 stable ID 或 ordinal 写成旧主线编号；不要复用 c01 的成绩键、旧背包、珍珠或海岸记录。R5 下一关解锁只读取自己的 records，并由宿主明确选择地区入口门槛。

## 四个最小接口

1. prepareIntent(activeV2)
   - 仅接受 pendingAction=null 的稳定终局。
   - 用真实 R5 restore 回放 checkpoint；只有真实 won 才生成 intent。
   - 不能信任 UI 传来的“赢了”、分数或剩余步数。

2. applyCompletion(journal, activeV2)
   - 返回新 journal 候选、receipt、writeNeeded、duplicate、firstClear。
   - 不自行持久化、不发奖励。
   - 同 attemptId + 同结果：writeNeeded=false、duplicate=true，不增加 clears。
   - 同 attemptId + 不同结果：冲突错误，保留两个输入，不覆盖。
   - 同关同 seed + 新的已持久化 attemptId：允许记录一次新的重玩，firstClear=false。

3. acknowledgement(activeV2, receipt, journal)
   - 只有已读回 journal 中存在完全匹配回执时，才能生成活动记录确认候选。
   - 宿主仍须保存并读回该活动确认；纯函数返回并不代表写成。

4. canShowSaved(activeV2, journal)
   - 要求 checkpoint 重放的胜利、journal 回执、活动确认三者匹配。
   - 只有该条件及真实写入读回成功后，UI 才能显示新 result.saved 并启用下一关。

## 写入顺序与故障矩阵

顺序：稳定终局 checkpoint → 通关 journal → 匹配的活动确认。

| 故障点 | 必须保持的表现 | 重试行为 |
|---|---|---|
| 稳定终局尚未写成 | 未保存，禁止下一关 | 当前局已有 retrySave |
| journal 写失败 | 当前局已保存，成绩未登记 | 同 attemptId 重新准备同一 receipt |
| journal 成功，活动确认失败 | 仍未完整完成，不显示新首次奖励 | 重读 journal，识别 duplicate，仅补写确认 |
| 崩溃后重启 | 从持久化 ID 与证明恢复 | 不生成新 ID，不重复增加 clears |
| 另一实例修改 journal | 只读/冲突并保留记录 | 由明确协调器处理，禁止盲目覆盖 |
| 未知版本、损坏记录 | 保留原字节并报错 | 不自动清空或降级 |

同步存储、写后读回和单写入者要求与现有 provider 相同。revision 乐观检查不等于跨进程 CAS；服务器合并不是本契约的已实现能力。

## 奖励与容量

当前原型所有结果的 newlyGranted 都是空数组；firstClear 只是新记录信息，不能直接作为发旧背包奖励的指令。若以后要加奖励，须另设计可重试、独立去重的 grantId 账本与存储事务，不从 UI events 推导。

原型回执上限 10,000，达到上限时阻止新记录并保留原数据。它没有安全压缩/清理协议；不要删除旧 attemptId 来“腾空间”，否则历史尝试可能再次入账。该上限是失败保护，尚不是长期留存方案。

本地回放验证用于一致性与损坏检测，不是防作弊或服务器信任边界。对外榜单/付费价值仍需独立服务端权威校验。

## 已运行的契约测试

9 组测试覆盖：v1 拒绝、未提交/非终局拒绝、重复提交、同 seed 真重玩、attempt ID 冲突、全部写入边界、未来/损坏格式、篡改分数、容量保护及全部 36 条胜利矩阵。报告为 reports/COMPLETION-CONTRACT-TEST.json。

这些是没有外部副作用的纯函数测试，不代表生产通关账本已接入。下一次实施必须先补活动 v2 身份与显式迁移，再接 journal 写入/读回/确认，最后验收 next/unlock；现有 provider 的 completionRecorded=false 不能提前改成 true。
