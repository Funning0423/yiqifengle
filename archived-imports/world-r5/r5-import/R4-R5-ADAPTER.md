# R4 COMPAT → R5：最薄棋盘 provider 接线契约

目标：同一套原生棋盘节点、点击/交换手势、步数/目标栏、清除与下落动画，按 provider 切换 R4 或 R5。不改 R4 源码，不复制任何规则进 Cocos Component。关卡册与人物场景仍由宿主控制。

## 1. 创建与切换

R4：现有 ChallengeController + 既有 c01 导航/进度。
R5：require('./runtime/board-session-provider')，new BoardSessionProvider({platform, stageId:'r05-tide-02', seed:2})。省略 stageId 可以恢复现有活动记录。必须使用 seedBank 内的 seed。

宿主保留统一 boardProvider 引用，绑定 snapshot、previewAction、cancelPreview、commitAction、finishVisualStep、pause、onHide、onShow、resume、requestExit、retrySave。开始切换前调用旧 provider.requestExit()；仅 ok=true 才销毁旧动画/解绑生命周期并切换引用。未保存失败时留在当前局。每条动画回调捕获 provider 实例与当时 token，不要通过全局“当前 provider”给另一局确认。

R5 不提供 selectRegion/selectStage/startStage/claimMemento，也不接收旧 journey。先由宿主关卡册选择 R5 stable ID，再建立棋盘 provider。已有 R5 活动记录与新 stageId 不一致时只读保留，不能隐式覆盖；正式的“放弃此局/新开”交互由宿主另行实现后验收。本包不提供绕过旧存档的删除捷径。

## 2. 现有棋盘字段复用

两个 provider 的 snapshot 都有 state、active、visual、error。

active.board：49 格，行优先 index 0..48；tile.id 稳定，type 为逻辑颜色 0..5，special 为 row/column/bomb/color/null。tile.id 不能直接当作数组下标。空洞仅出现在 clear 动画帧的 after，不会出现在稳定 active.board。
active.goals、moves、score、status、moss、roots：保留 R4 同名含义；roots 为 [index,layers] 数组。
active.stageId：R5 独立 stable ID，不对应主线数组编号。
active.theme：兼容现有 R4 槽位 seaBeach/orchard/autumn，分别对应 tide/meadow/sky。地区叙事/新皮肤请使用 active.region；不要据槽位名认为天空城美术已经完成。
active.bombs：始终 0，不能显示可使用的旧底部免费炸弹。

R5 新增：
- active.regionPieces：固定格叠层，每项 index/progress/done；贝壳 layers、花苞 pollen、棱镜 partner/polarity/hits/type/shifted。不是独立下落 tile，不能跟着底层 tile.id 移动。
- active.scene：phase、clock、heldTurns。phase 为 ebb/flood、horizontal/vertical 或 0/1；按该区解释。
- active.tool：kind、charges；关内固定一次、每次消耗一步。不得绑定旧 inventory。
- goals.pearls/blooms/relays：地区目标未完成数；普通 typeN/moss/roots 等保留。

## 3. 输入

继续支持 ['swap',a,b]、['activate',i]。
新增 ['tool','tideAnchor']、['tool','sunSeed',i]、['tool','prismShift']。
所有接受的动作都消耗一步；工具还消耗该局一次额度。没有 bomb、rewardTool、旧背包、珍珠支付或任意 seed 重投入口。

v1.1 增加 cancelPreview(token) 和 snapshot.storageKey；过期确认统一返回 stale-token，以匹配现有 binder。R5 预览保持 run.ready，仅提供手势确认，不提供 R4 的 run.preview/visual.plan。依赖该字段的 UI 需要明确调整；不要显示未计算的地区预览收益。

输入只允许 state==='run.ready'。previewAction 返回 token，既不扣步也不改变棋盘；commitAction(token) 才提交。重复、跨实例、取消、已过期 token 被拒绝。不要直接调用会话的 engine 或 _act 等内部成员。

## 4. 动画：相同确认形状，不同结算时机

R4 每个 action/clear/drop 阶段确认推进对应逻辑阶段。
R5 在 durable intent 成功后，一次同步确定性计算完整回合，并先保存稳定 checkpoint，然后播放不可变帧；finishVisualStep(token) 只推进播放游标，不再重复计算规则。

因此 active.board 在整回合开始播放时已经是回合最终稳定棋盘。动画期间必须从 visual.before/after、visual.wave、visual.changes/board 渲染，不能每帧拿 active.board 覆盖正在播放的中间状态。

visual.kind 对接：
- action：before/after/action；swap 另有兼容 tiles(from/to/id)。普通交换/激活手势表现可沿用。
- clear：wave.removed/created/effects/obstacleHits，before/after、goalsAfter、piecesAfter、events。events 是 shell-cracked/pearl-collected/pollen-delivered/bloom-opened/relay-charged/relay-linked；都是画面通知，绝不是奖励账本。
- drop：changes.moved/spawned + board；negative from 表示上方生成行，沿用 R4 下落解释。
- tool：新增的棋子种植、锚定、棱镜迁移表现。
- scene：before/after/heldTurns；无棋盘清除，更新潮相/风向/相位提示。
- shuffle：changes/board；目前遇到无可走局面的确定性重排。

每帧必须确认自己的 token。缺少 tool/scene/shuffle 专属动画时，最薄可运行接法是立即刷新该帧给出的状态并确认；不能静默把它当 clear。该降级只是接线验收，不是视觉完成。

## 5. 后台、中断、写入失败

pause/onHide/requestExit：取消尚未提交的预览、作废全部旧动画 token、跳到已结算稳定棋盘；没有重复扣步。onShow 仅解除 hidden，必须用户显式 resume；隐藏期间 resume 失败。

R5 活动记录唯一键 forest-regional-r05-active，version 1：{packId,revision,checkpoint,pendingAction}。
提交顺序：读回核对旧记录 → 保存并读回稳定 checkpoint + pendingAction → 执行一次逻辑回合 → 保存并读回新稳定 checkpoint + pendingAction:null → 开始动画。

- 意图未写成：动作没有发生，原 preview 可重试。
- 意图写成、稳定记录未写成：动作不可撤销，state=run.unsaved，输入和退出禁用；retrySave 只保存同一次结果。
- 崩溃恢复发现 pendingAction：从旧 checkpoint 回放一次该动作，暂停为 run.unsaved；显式 retrySave 后再 resume。与 R4 的自动恢复/后续保存细节不同。
- 未知版本、损坏数据、并发变更、异步 Promise 接口、写后无法确认：只读保留，不覆盖。

platform 必须同步 load/save 并可即时读回。乐观比对不是原子 CAS；真实产品仍须保证每个 pack 单写入者。没有服务器同步、多设备合并或自动迁移。

## 6. 结果保存的刻意差异

R4 的 result.saved 意味着活动状态及独立通关成绩账本已完成事务。
R5 只提供 result.session-saved，result.sessionSaved=true，completionRecorded=false。这是“当前局终局已保存”，不等于解锁/成绩/奖励已登记。宿主不能把它映射成 R4 的 result.saved 后发奖。R5 正式进度账本是下一项明确接线任务；原 c01 与旧 21 关不受影响。

## 7. 最小接入验收

1. 用 import-only/runtime 整体导入，不能导入 test、tools、baseline、reports 或负向夹具。
2. 同一棋盘先跑 R4 既有 seed，再切 R5 三地区各一条已见证 seed，核对每个最终 checkpoint。
3. 覆盖三种工具、地区 effect、场景切换与额外动画 kind，确认棋子叠层不随下落漂移。
4. 动画中双击、后台、显示/恢复、组件销毁/重建，旧 token 不能确认新局。
5. 注入意图写失败、稳定写失败、崩溃 pendingAction、未来版本和多实例冲突，验证独立键且旧全部存档字节不变。
6. 明确展示未登记进度状态，不发任何旧奖励。正式接通独立进度账本后再验收 next/unlock。

## v1.1 补充材料

实际 Creator 检查项目见 COCOS-3.8.8-INTEGRATION-CHECKLIST.md；未接线通关协议见 COMPLETION-PROTOCOL.md。两者不能被当作真实 Cocos 或通关账本已经通过的证据。
