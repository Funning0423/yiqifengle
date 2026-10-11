# world-r2-native-bridge · 实际原生棋盘离线整合候选

目标是让 world-r1 和已收到的真实 NativeBoardUI 工作线合并，保留已交付 v1。这里未修改 Mac、原 NativeBoardUI/Boot、world-r1、R4/R5 运行包、GLB、`.meta` 或资产坐标。没有生产存档、通关账本或奖励接线。

## 最小合并差量

1. 新增四个文件至 `creator-build-project/assets/scripts/world-r2/`：
   - ManagedBoardSession.ts：选 R4/R5、隔离临时存储、受限命令、逐帧展示适配、取消代次。
   - NativeWorldLevelAdapter.ts：直接实例化真实 NativeBoardUI，形成 world-r1 所需的 LevelLease；不是待实现的理想 boardFactory。
   - RegionalOverlay.ts：按格子 index 附着地区状态标签，不随 tile.id 下落移动。
   - WorldNativeComposition.ts：新 composition 组件，组装现有 world-r1 + 实际原生棋盘 + provider 选择。
2. `patches/NativeBoardUI-managed-mode.patch` 是唯一需合并到已有 UI 文件的显式补丁。已验证基准 commit `1d2d0d1e29845a0f42df6eb405d1c2a43afc9c9a`，NativeBoardUI SHA256 `3355dffc9b25a54eaad646d38c1b80b4a36ffb0935e7ebbe4e629309a467af44`。
3. world-r1 七个组件保持原样。另把已交付 R5 v1.1 import-only 的 runtime 子树放到 `assets/scripts/regional-r05/runtime/`，保留其许可证/说明。R4 COMPAT 路径不改。
4. 新场景挂 WorldNativeComposition，绑定 combined prefab、独立 world camera、现有 R4 smokeFixture；不要同时启用旧 FirstsliceBoot。场景设计分辨率由 composition/已完成的竖屏 UI 分支统一配置，managed UI 不改全局设计分辨率。
5. 官方 Creator 为新增文件生成新的 `.meta`。本包不生成/复制已有 UUID。

Mac 正在另改竖屏 UI。补丁只针对已经收到的旧布局 commit；拿到新版后必须按 managed seam 重放/冲突检查，不得用本候选的旧整份 UI 覆盖新版布局。`tools/patch_native_ui.cjs` 每个替换点要求精确且唯一，找不到会失败，不会模糊覆盖。未执行该补丁到冻结源或 Mac。

## 真实差异与实现

实际 NativeBoardUI 原来自己新建 R4、监听 game hide/show、内部返回关卡册并改全局分辨率。新增 initializeManaged 允许注入选定 provider；由世界流统一生命周期，内部退出按钮发给世界流，先成功 requestExit 再销毁棋盘。

R5 不支持 R4 的 selectStage/startStage/claimMemento 等关卡册与奖励命令；桥接只转发 board 命令白名单，选 provider/关卡由宿主完成。R5 preview 仍是 run.ready，代码不读取不存在的 run.preview 或 visual.plan。现有 swap 的 preview+commit 继续适用，managed 模式另支持再次点按特殊棋子来 activate 和使用真实关内工具，不连接旧背包。

R5 在开始动画时 active.board 已是整回合最终局面。因此展示层维护中间帧：action/clear 读取 before/after，drop/shuffle 读取 board，clear 更新 goalsAfter/piecesAfter，tool/scene 根据当前帧的明确显示字段更新。每个完成回调捕获本 provider 和 token；取消、隐藏、销毁、换 provider 后晚到回调无效。这个适配只呈现结果，不重复运行任何规则。

原 UI 用 roots.includes(index)，不能识别真实 [index,layers] 元组，补丁改为按元组 index 检查。地区叠层按固定格 index 放置：开壳/待潮/已收珠、花粉顺序、棱镜锁层/颜色/相位/伙伴；天空只强调顺序中的第一个未完成棱镜。这里是数据可读的标签候选，不声称新美术/竖屏最终视觉验收。

R5 结果严格保留 result.session-saved / completionRecorded=false，显示“本局已保存，成绩未登记”，不映射成 result.saved、不解锁下一关、不发奖励。run.unsaved 在真实原生结果面板显示重试保存；失败时拒绝世界退出。

补丁还修复了中断手势：隐藏/取消清空 dragStart 与 selected，没有对应 TOUCH_START 的迟到 TOUCH_END 会被忽略。managed 模式不写/删除别人拥有的 __nativeBoard/__forestLiveSnapshot 全局诊断对象。

## provider 选择与存储

WorldNativeComposition.selectProvider({provider,stageId,seed})：仅在 home/island 稳定状态切换选择。R5 限已发布 stage/seedBank；R4 候选限当前已有 smoke fixture。enterSelectedLevel() 仍走 world-r1 的 island→level 流程；不绕过尚未完成的人物门禁。

两种 provider 默认各有自己的内存 Map，键分别是 R4 原键、forest-regional-r05-active。只用于离线/集成候选，无 localStorage、微信存档、旧背包或生产记录。已有 R5 不同关卡记录时拒绝打开新关并保留字节，不用删除记录换取表面“切换成功”。正式放弃当前局和下一关账本流程不在本候选范围内。

人物仍须通过 world-r1 的 attachCalibratedCharacter 接口。未校准时只显示世界，不制造代理角色或假装完整角色流程通过。端到端离线测试里的 CharacterAdapter 是明确的测试替身。

## 一条命令重跑

```sh
bash /workspace/shared/grok-takeover/parallel-development/world-r2-native-bridge/run_checks.sh
```

使用当前已安装的 Node 24、Babel 和 Python，不安装新软件。测试读取已收到的冻结 NativeBoardUI，内存中施加精确补丁，执行该实际 TS 的逻辑；Cocos cc 节点/事件/计时由 `tests/cc-double.cjs` 明确模拟。规则/provider/binder 都是未改的真实源码。原件完整性和最小合并清单每次生成到 `MERGE-MANIFEST.json`。

当前通过 15 项测试，包括：
- 实际 NativeBoardUI 创建49格、无重复生命周期/全局对象占用。
- R4 原8动作通关，score 910。
- R5 全部36个已发布 seed、301动作，最终 expectedState 逐项匹配。
- R5 action/clear/drop 中间显示不偷用最终逻辑棋盘；activate 缺少 tiles 时仍可运行。
- 三种真实工具、固定格地区状态、只写独立内存键。
- 隐藏/恢复/销毁/换 provider 的晚到动画和触摸回调无效。
- 真实 R5 意图已写、稳定写失败时显示重试，阻止退出并保留已提交行动。
- world-r1→实际 NativeBoardUI→退出→回屋在 R4/R5 两条线均运行，关门先于 sit。
- 实际流包含 action/clear/drop/scene/tool。shuffle 是显式标注的合成 schema 显示单测，不冒称已出现于见证通关轨迹。

## 还必须验收

官方 Cocos 导入、语义类型检查/编译、实际 Web 运行、触摸命中和竖屏截图、微信/真机均未执行。现有 cell tween 是原 UI 的通用缩放提示，新增帧展示正确不代表完整美术动画完成。合并新的竖屏 UI 后须重跑本套离线测试并由 Mac 做真实引擎验收。人物/布料接触、资产视觉修复、生产通关账本和性能均不被本候选结果代替。

资产视觉修复另有独立工作线；本候选不改变任何锚点、路径、尺度或环境 hash，待主线程确认新版资产后再更新契约。
