# R5 v1.2 本地持久化接线与真实 Web 冷恢复

基线 42a2ff0ec3e3fd247fa099fbd22ac86f4438c391；隔离目录 cocos-r5-persistence-20261009；分支 cocos/r5-persistence-20261009。Cocos Creator 官方 3.8.8 Mac arm64，Node 24.14.0，TypeScript 5.8.2。旧工程未修改，不发布微信。

## 已补足的 Issue

真实读取器/schema 来源已补足，不再要求用户寻找材料。正规授权交接：Drive 1XVhx0hnsVN1jL7oPapVpnUtdBkipitP1，5044 字节，ZIP SHA256 223ccba3bbfc0e327251509cee6bd689c4169adebe9a9ae2ac2e6998f0ef2459。原 progression.js SHA256 a58d6cee97cb2e4e062170e82ff0771464bdb8fe36779dd52e0f417d12a9465a，支持 v1/v2/v3，来源 character/detector_recovery/sourcecheckpoint/fixed/shared/progression.js；包不含实际用户存档。

本机原已登记的 fixed02 和 motion-v21 两份 minigame/shared/progression.js SHA256 均为 3ac328dced21f4ecab1b342e82a231eb2b7b6564b6618f8ebdaadfa77cd64473，只支持 v1/v2，与正规 v3 交接存在版本差异。旧文件只读核对，未修改。

LegacyJourneyReader 对 cc.sys.localStorage 的 forest-v33-journey、forest-v3-progress、forest-v3-completed 各读取一次，再把快照交给冻结的 noWritePort。该端口只有 load，没有 save；源构造器 _save(false) 无能力写回。仅冻结 records/只读状态/来源信息逃逸，绝不返回 Progression 实例或奖励接口。缺档保留真实零默认值，损坏/未知档由原验证器保护；不伪造解锁。

## 工程与实测

v1.2 两包字节/SHA核验保留，纯接线 patch 在42基线检查成功；R5禁止Map回退，实际目标为 dot-r5-v12-isolated-20261009: 前缀的三个键。导航使用 CampaignHost.inspectSelection；事务仍由原 provider 完整读回确认。ManagedMobileBoardUI、NativeBoardUI、RegionalOverlay 和42字节相同，afterPaint修复保留。

此前两次提升权限构建调用均在 CreateProcess 返回自动审批超时；不是实际安全拒绝。沙箱尝试 exit1、空日志，无法从空日志判断历史启动状态。最新委托后只读进程检查没有发现 Cocos/build 进程；核查后的官方构建成功 exit36。精确命令与状态见 build-execution-status.json。

正规 v3 原文直接进入 Creator 后，真实浏览器发现 Set 展开被 loose 编译为 [].concat(Set)，导致 _grants() 启动异常。原交接原文保存在工程外；独立 LegacyProgressionV3.js 兼容副本只把 _opened/_mementos/_attempts 的集合展开改为 Array.from。再次官方构建 exit36，emitted Array.from 已核，浏览器已成功启动。构建应用源码对应2cbc564，后续提交仅测试/文档/证据。

真实 cc.sys.localStorage 的独立持久 Chromium profile 测试通过：402×874 DPR3；缺主线通关新关卡锁定且零写；三个测试目标键实际为空后写入显式合成 v1 fixture，备份逐字相等；tide-02 seed2共八动作；真实 Storage.prototype.setItem 意图写失败时动作不被接受、无完成奖励；稳定 attemptId、完整 active/progress/backup 读回；不足地区不授印记；完全关闭浏览器进程，再启动独立新进程，三键逐字一致、同attemptId、clears和成绩receipt均只有1。原R5三键和主线三键未修改。记录actual viewport、UUID runId、UTC时间与构建指纹，见 web-storage-runtime.json。

只读schema 11项对照、managed binder八动作/登记文案/销毁晚回调、UI字节一致测试通过。正规开发包 Node复核36胜利301动作301恢复、55故障，R4共存的原active/journal字节相同；这些是模拟接口逻辑检查，单独标记。

## 限定和下一段

浏览器 v1 fixture 为验证引擎明示生成的测试资料，不是恢复丢失Map，也不是实际用户存档。这个新profile没有真实主线通关，新关卡因此保持锁定。真实源码/schema依赖已解决；未声称已有用户通关，未要求复制全三星。

尚未完成：实际Web三种v1及全部写边界、合法前序关的新campaign顺序推进、完整地区显式印记/重复领取、Next/领取宿主按钮、原生UI三地区原30动作及后台/晚回调回归。当前真实8动作测试运行provider probe和帧令牌，不代替原生触摸动画验收。原生UI晚回调测试目前只有模拟binder。历史evidence/world-r5为继承基线，不算本轮结果。

没有手机真机、微信发布、奖励经济入账或60fps/发热结论。原存档与历史键没有写回。


## 当前轮补验收

原文“尚未完成”项现已补齐本轮R5 Web范围：真实01/Next/claim/retry12关100动作、原3地区30动作、3种v1、5写边界、冷重复印记、脚注横竖恢复与Native晚动画。详见R5-HOST-ACCEPTANCE-20261009.md和final-acceptance-summary.json。后续新主线与手机验收仍未执行。
