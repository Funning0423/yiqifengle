# Cocos Creator 3.8.8：R5 棋盘 provider 实际接入检查单

交付版本：v1.1 候选。内容版本仍为 r5.1，12 关与 36 个发布 seed 不变。这里将“离线证明”与“必须在 Creator/真机拿到的证据”分开；勾选项当前均待实际项目验收。

## 已在云端确认

- Babel core/preset-env 7.28.5，transform-spread 7.27.1，与 R4 使用的已安装工具链相同。
- runtime 五个模块没有 SpreadElement、RestElement、ForOfStatement。Set/Map 转快照使用 Array.from；不依赖把 iterable 当 array 的转换。
- source、source-loose、strict、strict-then-loose、full-loose 五种输出均跑完整验收与逐项对照：每种 39 条胜利、317 个提交记录、2,302 个动画帧与源输出一致。
- 负向控制能重现旧 loose 转换把 Set/Map 包成单个对象和递归快照栈溢出。负向代码只在作者工具中执行，未写入 runtime 或导入包。
- 使用逐字节未修改的 R4 COMPAT cocos-port.js binder，验证了预览/取消/提交、晚到回调、后台恢复、dispose 解绑定以及动画抛错路径。

离线 loose 配置是针对已观察故障的模型，不是直接调用 Creator 编译器。以上不代表真正 Cocos 导入通过。

## A. 文件与编译产物

- [ ] 仅导入 R5-IMPORT-ONLY-v1.1.zip 中的 runtime/，不要导入开发包、contracts、tools、baseline、compatibility 或 reports。
- [ ] 使用单独 R5 目录/资源 UUID，保留现有 R4 COMPAT 文件；禁止覆盖旧 c01 控制器。
- [ ] 真实 Creator 控制台无模块路径、CommonJS/TS 默认导入、循环加载或 JsonAsset 错误。本包 catalog-data.js 是 JS 模块，不需要 JSON 资产加载分支。
- [ ] 从实际 emitted code 核对：Set/Map 快照仍是 Array.from；不得出现 [].concat(set/map) 或按 .length 遍历 Set/Map。保存实际编译输出路径与片段作为证据。
- [ ] 空局立即 snapshot、首次 preview/cancel、首次 commit、第一轮 clear/drop 后 checkpoint 都不栈溢出；moss 是数字数组，roots 是二元数组，不能是 [{}]。

## B. 同一棋盘切换 provider

- [ ] 保持旧 R4 provider 能正常运行同一回归关；切换前 requestExit 成功，再取消动画、解绑旧生命周期。
- [ ] 所有动画 done 回调捕获旧 provider 实例与自己的 token；不能使用后来切换的全局 provider 引用。
- [ ] R5 接收 previewAction、cancelPreview、commitAction、pause、resume、requestExit、retrySave。v1.1 已补 cancelPreview(token)，过期确认统一返回 stale-token，匹配现有 binder。
- [ ] R5 预览只提供手势确认，仍是 run.ready，不提供 R4 的 run.preview/visual.plan。若现有 UI 依赖该状态或预览波次，明确调整该分支，不要读取不存在的 plan，也不要展示未计算的地区收益。
- [ ] 关卡册命令 selectRegion/selectStage/startStage/discardActive/finish/claimMemento 不传给 R5 provider；由宿主导航控制。直接向 R4 binder 转发这些命令到 R5 会调用不存在的方法。
- [ ] storageKey 显示为 forest-regional-r05-active；旧主线、海岸、c01、inventory 的键和值保持不变。

## C. 棋盘与固定格地区棋子

- [ ] active.board 始终使用稳定 tile.id，type 0..5 只作逻辑色；固定格 regionPieces 按 index 绑定，不随着 tile 下落漂移。
- [ ] 海岛贝壳裂层、开壳待涨潮、收珠三种状态可区分；涨潮打未开壳不计数的原因能看懂。
- [ ] 草原花苞显示下一花粉颜色及顺序进度，横/竖风可读；一波最多递进该花一段，成熟后出现对应行/列风清除。
- [ ] 天空城显示当前顺序目标、相位、指定颜色、剩余锁层与 partner 回声落点；不能同时高亮所有棱镜作为可收集目标。
- [ ] theme 槽位 seaBeach/orchard/autumn 只是复用 R4 资源槽位；天空城叙事地区由 region=sky 决定，不将占位皮肤当作新美术验收。

## D. 帧与动画

- [ ] 提交后 active.board 已是整回合最终逻辑状态；播放时依次采用 visual.before/after、wave、changes/board。
- [ ] clear 使用 piecesAfter/goalsAfter 更新地区状态，避免提前展示最终局面。
- [ ] action/clear/drop/tool/scene/shuffle 六种 kind 均有明确处理；临时无专属动画时逐帧刷新并确认，不误判成 clear。
- [ ] activate 的 action 帧可能没有 tiles；按 action=['activate',i] 定位，不无条件遍历交换 tiles。
- [ ] stage tool 数量为关内一次，并且扣一步；禁止连接旧背包或免费炸弹按钮。
- [ ] 将声音、屏幕抖动和特效绑定当前帧通知；回放恢复/重复回调不能再次当作奖励。

建议最小真实棋盘样本（完整动作在 verified-replays.json）：

| 用途 | 关卡 | seed | 首动作 |
|---|---|---:|---|
| 潮相与水柱 | r05-tide-02 | 2 | swap 1,8 |
| 三色花粉与风 | r05-meadow-03 | 7 | activate 37 |
| 颜色/相位/双锁 | r05-sky-04 | 1 | swap 4,11 |
| 潮锚 | r05-tide-01 | 1 | tool tideAnchor |
| 太阳种子 | r05-meadow-01 | 1 | tool sunSeed 3 |
| 棱镜迁移 | r05-sky-01 | 1 | tool prismShift |

后三条完整路径在 DECISION-EVIDENCE.json 的 toolWitnesses。不要只按第一步后凭肉眼猜测最终结果。

## E. 后台/保存失败/退出

- [ ] 在 preview、action、clear、drop、tool、scene 各阶段触发 hide；预览取消，已提交局面保留，旧 token 失效。
- [ ] show 不自动恢复输入；hidden 时 resume 被拒，show 后显式 resume。
- [ ] 注入“意图写失败”：不扣步；再次提交原预览仍是同一动作。
- [ ] 注入“意图已写、稳定记录失败”：run.unsaved，禁止新动作与退出；恢复后仅回放一次并 retrySave。
- [ ] 模拟进程终止后重新创建 provider；比较完整 checkpoint.expectedState，而不是只看分数。
- [ ] 未知版本、损坏 JSON、写后不可读回、并发修改进入只读，不清空记录。
- [ ] 动画抛错及组件 dispose 后，旧 done 回调不能开启新动画或改变当前局。

## F. 结果和真实设备门槛

- [ ] 当前运行时仍返回 result.session-saved、completionRecorded=false；没有接通下述新账本之前，不显示“已登记成绩”、不解锁下一关、不发奖励。
- [ ] 若后续实施通关协议，按 COMPLETION-PROTOCOL.md 的 active v2 / journal / acknowledgement 三段验证后，才引入 result.saved。
- [ ] iPhone 与中档 Android 上记录触摸命中、帧时、峰值内存、后台恢复和重复操作。Node 性能不代替设备性能。
- [ ] 高手真人体验另过：本检查单不认证关卡好玩、难度适合或不存在更短解法。
