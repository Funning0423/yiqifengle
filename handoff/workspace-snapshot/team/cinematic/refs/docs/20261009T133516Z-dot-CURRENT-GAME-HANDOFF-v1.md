# 咦 起风了 当前开发总交接

记录时间：2026年10月9日 13:35:16 UTC。进展截止：13:30:18 UTC。

这份记录供用户、dot 与 Grokbot 对齐游戏进度和接入边界。UI 修复已有 Creator 实际运行证据；R5 存储边界已过，完整顺序入口和领取流程仍在接入；新关卡、鱼托盘与人物修订分别保留候选身份。没有微信新发布，也没有真机性能验收。

- handoff_id：20261009T133516Z-dot-CURRENT-GAME-HANDOFF-v1
- task_id：CURRENT-GAME-HANDOFF-20261009
- 记录人：dot
- [项目中枢](https://drive.google.com/drive/folders/1epC1Sp-clodMYITo6NDOdjaBmO97POM8) · [dot 追加日志](https://drive.google.com/drive/folders/1ptGZPF_xkmlS6KWRShK9eeIS0d3EZQx5) · [WIP 候选](https://drive.google.com/drive/folders/1YwMmM1AC2KAAK92ffaoPu3YFnjO2xnQZ)

## 本次交接边界

沿用 [Drive 协作协议 v1.2](https://drive.google.com/file/d/1yqIPO9u_3-Sx9quxrVQlwRfAju6KjI3-/view?usp=drivesdk) 与 [追加式指南](https://drive.google.com/file/d/11ddQG0c9HAGh0GAYMlRwJ_3p3MeCVp8L/view?usp=drivesdk)。本次只新增交接，不改游戏源码、中央索引、Grok 文件、存档或权限。任何纠错另增 correction，引用原记录。

根目录 00/01/02/07 索引仍是10月8日的历史状态，工程进展按本条逐项引用的最新交付读取。正式 manifest 的 selected_release_id 未在本次改动；本条不是自动合流或最终验收决定。每个源码包使用自己的精确基底，不能因同名 R4/R5/R6 就互相覆盖。

## 1 原生 UI 与脚注重绘

状态：实际 Creator 验证。

基底：ed6e417dc7093c8ce077f5936361efa2ebbfa3f4。
应用提交：187abc13a67488538acf3f382d4f5771ef9cc82a。
交付提交：42a2ff0ec3e3fd247fa099fbd22ac86f4438c391。

改动：ManagedMobileBoardUI 的 managed.afterPaint 从 render 移到统一 paint 末尾；补齐运行报告身份及浏览器取消诊断分类。

接入方式：在精确 ed6e417 基底独立应用三文件小差量；42a2ff0 仅增加测试日志分类，游戏与资产字节等于已构建 187abc1。

- passed | 官方 Cocos Creator 3.8.8 构建＋桌面 Chromium 触控模拟：竖屏 402×874、横屏 874×402，各三地区30动作；相同构建指纹、各自独立 runId/时间/SHA。官方构建记录 exit36。
- passed | 实际渲染＋独立源码/节点复核：初载、选中、TOUCH_CANCEL、横屏与回竖屏均保持图案 .66 格；浏览器不可取消 touchcancel 诊断单独保留，应用错误为0。
- 待验或限制：本 UI 版本仅当前会话保存，不能据此声称通关账本/奖励/全局解锁完成。
- 待验或限制：真实手机、Safari、OS 挂起、脚注真机可读性和 GPU/FPS/发热未验。

来源与交付：
- [FOOTER-REPORT-FIX-FINAL-RECEIPT.json](https://drive.google.com/file/d/16gAb6R_DkwBNoOootrMbn_XUNrRy3Auc/view)
- [FOOTER-REPORT-FIX-small-source.zip](https://drive.google.com/file/d/14OCumLvNpGSaxeLVDiuxZr1jiuZ9uy_h/view?usp=drivesdk)，11,733字节；SHA-256 cc7422d813f4f6f40dc4c22b67b01e38982f2e3a0b8c58369e036b61dc7ef397

下一负责人：dot。下一步：在 R5 持久化及顺序入口版本继续跑三地区30动作 UI 回归，防止沿用旧 UI 的通过结论。

## 2 R4 海面候选

状态：实际 Creator 验证中的视觉候选。

基底：6443ab2b9b3351a7bf1ffd44ff16f97f698e1901。
应用提交：b09a77b8a4cf10ae5c0d1cf40c96c29365165079。
交付提交：b09a77b8a4cf10ae5c0d1cf40c96c29365165079。

改动：仅 FidelityStandard.effect 海面效果候选；原 metadata UUID 与恢复快照保持。

接入方式：R4 使用自己的 6443ab2 基底，不能直接覆盖 world UI/R5 分支；完整分片、manifest 和恢复方式见总回执。

- passed | 官方 Cocos Creator 3.8.8 构建与实际运行：9项 A/B 矩阵通过；关闭后 PNG 字节恢复、22个材质槽恢复、全局状态保持。
- 待验或限制：大条纹减弱，海面仍偏平并留淡条纹；属于视觉候选，未获最终水面验收。
- 待验或限制：默认关闭、未合入 world；无手机性能或每帧完整证明。

来源与交付：
- [FINAL-WORLD-UI-R4-RECEIPT-20261009.json](https://drive.google.com/file/d/1Hs9ZH27HYhWnjdOf0gwIOTszPYtf4I0L/view)
- [fidelity-r4-manifest.json](https://drive.google.com/file/d/1QGw1VRHuytcnTBdEuYGrCmWjTR_vTI5d/view?usp=drivesdk)

下一负责人：dot 整合与视觉复验。下一步：继续独立候选对照，明确海面层次与实机预算后再决定是否合并。

## 3 R5 存档接入

状态：实际 Creator 与存储已验 部分流程待接。

基底：42a2ff0ec3e3fd247fa099fbd22ac86f4438c391。
应用提交：2cbc5643f9af2472aed227355a19883d66445e00。
交付提交：bf8040a7b7385ff6f3e247b492663c8a5292f1b9。

改动：R5 真实 localStorage 与隔离 namespace；旧 journey 通过仅 load 的冻结投影接入，原历史键不写入；R5 禁止 Map 成功兜底。

接入方式：三 RAW 分片按编号连接，完整 ZIP 505810 字节、SHA-256 d58cf23672e74e5053395ee679d92c3f267fc5720dbb4c2f2a5ef8ff4219aa1f；changes.patch 对精确 42a2ff0 的 apply --check 已通过。

- passed | 官方 Creator 3.8.8＋真实 Chromium persistent profile/localStorage：合成 v1 fixture 的8动作流程，860分/2星、单 receipt/clears1；1动作预置、迁移后 provider 脚本执行7动作。关闭后用同 profile 新启浏览器，完整 raw 读回一致。
- passed | 独立云端源码与持久化契约：47个交付文件 hash/大小一致，其余348文件不变；旧 journey 9类输入冻结只读、非空合成哨兵不变、namespace 隔离、写入失败不奖励、另一 Node 进程冷读一致。
- 待验或限制：实际浏览器测试原六个键均为 null；不代表真实玩家非空历史存档已验收。
- 待验或限制：fixture 是合成测试数据，不能称玩家通关、8次 UI 触控或失去进度已恢复。
- 待验或限制：bf8040a 首页仍只提供02/03/04代表关；新玩家首关入口、顺序 Next、印记领取及三地区30动作 UI 回归未过。
- 待验或限制：主线在同会话更新后需明确只读投影刷新生命周期；真实手机未验。

来源与交付：
- [dot-bf8040a-R5-v3-real-storage-delivery.md](https://drive.google.com/file/d/1k7GORYSH0OkBwqjzTw2YEpDltPom8AmF/view)

下一负责人：dot Mac/Cocos 整合。下一步：当前正在补首关入口、顺序推进、Next/印记领取及 UI 回归；有新提交/实际回执后另行追加，本条不提前标通过。

## 4 第二章新增12关

状态：云端逻辑候选。

基底：42a2ff0（规则字节对照）。

改动：三地区各4关，packId regional-r06、contentRevision r6.content1；stable ID 使用 r06-*，不替换 r05-*。

接入方式：独立内容/开发包；复用规则字节不改，不直接拼入 R5 catalog 或写生产 R5 checkpoint 键。

- passed | 云端 Node.js 规则测试：36条无道具＋12条道具胜利见证；558次逐步冷恢复；432随机整局/7416步；36发布种子三步183000行动节点无三步内直接胜利。
- 待验或限制：高手难度/乐趣未人工验收，有限种子不能扩称任意 seed 可解。
- 待验或限制：Creator、Cocos路由、微信真机及新棋子美术未完成。
- 待验或限制：生产多 pack 路由与独立 completion 集合未接；旧每区首4关领奖范围须固定，不扩成所有新关。
- 待验或限制：本 R6 指新内容候选，与历史 CommonR2 至 R6 恢复增量不同。

来源与交付：
- [20261009T131848Z-dot-R6-CONTENT-12-v1.md](https://drive.google.com/file/d/1JcaLhRvgdrVnRy0jEXDbWZTAnWrrLMTk/view)
- [R6-CONTENT-12-REVIEW.zip](https://drive.google.com/file/d/12sk32USIncOkKam1aUtgwtqNV4_CArWE/view?usp=drivesdk)，55,802字节；SHA-256 2b87a5efbde72e75254220a0e50fe6cc5bbe7dc8f7b509960e916057e65186a7
- [R6-CONTENT-12-DEVELOPMENT.zip](https://drive.google.com/file/d/1DvBgzLcUqyVrQwilaDfih89NkeR7PPkk/view?usp=drivesdk)，179,894字节；SHA-256 781e59c71f4cb46b8fbd7dbe6cedcda309160056fe2b2d8f54ae89873d9a147d

下一负责人：dot 关卡与存档整合；用户参与难度验收。下一步：先设计多 pack envelope/独立 completion，验证旧已领奖、未领奖和两章活跃局及失败回滚；再接 UI 与高手试玩。

## 5 鱼与共享托盘

状态：云端逻辑与离屏候选。

基底：42a2ff0（当前 Cocos 接口对照）。

改动：独立鱼珍珠/星光托盘事务与取消保护候选，附 Cocos 适配骨架和离屏演示。

接入方式：开发包含测试与来源 manifest，IMPORT-ONLY 仅候选运行/适配文件；不得用全包覆盖现有 Cocos 工程。

- passed | 云端 Node.js 与离屏演示：29测试、160轮种子中断、7项离屏检查；离屏演示完成。
- 待验或限制：未 Creator 编译、未 TypeScript typecheck、未接真库存/设备；浏览器演示受 socket 权限限制。
- 待验或限制：当前 R4/R5 明确禁托盘/库存道具，不可写成已支持。

来源与交付：
- [FISH-TRAY-R1-DEVELOPMENT.zip](https://drive.google.com/file/d/1Gb7Ajmb0AmDNV64x3jHlKltsmfCBdJ3Y/view?usp=drivesdk)，694,954字节；SHA-256 e06ac276c3feaaacaa0f7f06febae530540d29a1324869f6e5b29ac9c7d92ff1
- [FISH-TRAY-R1-IMPORT-ONLY.zip](https://drive.google.com/file/d/1cE1erFOumhlnGIKrSj_pLToDGRBr1z-E/view?usp=drivesdk)，18,591字节；SHA-256 8f2979ceb820be51fccce47335438cd55ecfc9fbeced53c42a63459ccf061dbf

下一负责人：dot 玩法与 Cocos 适配。下一步：先落实新版海岛每局库存事务口、共享托盘 UI 锚点与明确合理的能力扩展，再做实际 Cocos 与设备接入。

## 6 旧主线 Cocos 适配

状态：云端逻辑开发中。


改动：独立 mainline-cocos-r1 候选开发；截至本条证据截止，空档合法完成首关并解锁第2关已通过云端检查。

- passed | 云端规则候选：空档首关合法完成、解锁2。
- 待验或限制：尚无正式交付包/Drive回执，本条不造链接或宣称已接 Cocos。
- 待验或限制：不以构造合成 fixture 代替用户完成主线。

截至本条截止时间暂无正式 Drive 成果包链接。完成交付后另追加，当前不构造链接。

下一负责人：dot 玩法与 Cocos 适配。下一步：完成可复现候选和只读旧旅程边界测试，出包后另交基底/精确文件/测试，再决定 Cocos 接入。

## 7 R7 站姿风片与手脸修订

状态：未获整体美术验收的阶段候选。


改动：R7 站姿风片181帧/30fps及实际碰撞检查已有阶段交付；用户认可裙角方向，并要求增大幅度、修手和脸。

接入方式：仅取独立阶段包进行对照，不覆盖 Grok 源资产，也不把阶段包当最终33秒动作包。

- passed | R7阶段原速风片与实际碰撞检查：181帧/30fps阶段检查通过，范围仅此风片。
- 待验或限制：非全部人物验收，非33秒新版衣裙完整动作完成。
- 待验或限制：自然垂手/手脸与15%有界动画调幅候选仍进行，不能把新候选能力归入现有上传包。

用户13:13的反馈：“裙角可以了，不过飘动幅度可以更大点，同时注意人物的手和脸，现在有点奇怪”仅认可裙角方向，不能写成全部人物已验收。

来源与交付：
- [R7_UPPER_BODICE_R3_STANDING_WIND_STAGE_未验收_REPLAY.zip](https://drive.google.com/file/d/1lWY-yc9LO1yr0bt2ayQ4mMEFwxYk9kzr/view?usp=drivesdk)，29,620,151字节；SHA-256 874ad1b7b2fe26911c8e029b241cd5cdba6ce763bad5d6aa8d2c1345728db827

下一负责人：当前人物修订负责人；dot 交接复验；用户视觉验收。下一步：保留裙角方向，修手脸并增加有界幅度；新候选分别提交可复现证据和视觉对照，按实际回执追加。

## 8 有限3秒起身参考

状态：未获整体美术验收的阶段候选。


改动：身体/上衣/后膝的有限3秒起身参考包；后续尾带密集验证已在云端增加。

接入方式：保留有限范围和独立包；尾带后续验证不自动归入先前上传包。

- not_run | 完整动作/Cocos/真机验收：本条列出已有有限3秒参考包；不以此声称完整33秒动作验收。
- 待验或限制：不能声称33秒新版衣裙完整动作或整段转身/开门/返回已验收。
- 待验或限制：用户整体美术与真机性能尚待验收。

来源与交付：
- [B_BODY_SHIRT_SPINE_KNEE_R3_BOUNDED_REFERENCE.zip](https://drive.google.com/file/d/1i7A6dioR0W0h3G4GhhoWyQ8DDnZuzywp/view?usp=drivesdk)，21,728,959字节；SHA-256 7a850e0583d017ab7f5e5284a383feda4d81baf5e24c34cd7919db41843830c1

下一负责人：当前人物修订负责人；dot 交接复验。下一步：将新增尾带密集验证随对应新版本出包，逐项区分阶段检查和完整动画验收。

## 后续接收与防覆盖

1. 接收方先核对具体交付记录、base commit、包内 manifest 与哈希；未知 Drive revision 保持空，不把修改时间当修订 ID。
2. 在独立目录检查补丁，新增文件和替换文件分列；保存原存档与旧基底。R4 海面继续默认关闭，R6 不扩大 R5 首章领奖范围，鱼托盘不越过当前能力禁用。
3. 本条的 Grokbot 已读回执仍为 pending。上传成功只代表保存成功，不代表对方接单。后续回执应引用本 handoff_id、已读文件 ID 与下一动作。
4. 项目根、WIP 与 dot 日志权限已核为原 owner；没有新增访问者或修改 ACL。此处未重新逐字节下载所有远端大包，来源哈希范围详见各原交接；本次新交接文件的实际 ID、字节数与哈希另附上传回执。

本次没有改源码或共享基线。需要修正时，新增带时间戳的 correction，不覆盖本记录。

