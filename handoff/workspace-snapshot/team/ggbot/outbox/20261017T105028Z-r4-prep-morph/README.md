# r4-prep 补丁：冻结副本的 morph 权重（围裙）

- 分支：ggbot/build05-r4-prep（只在本地，没推送）
- 新 HEAD：97b761d11f14f8d24e3b690e370cb0da04ff9127（父提交 c30eeec，只加了 1 个提交）
- bundle：r4-prep-morph.bundle（前置提交 c30eeec，已校验）；补丁：0001-*.patch

## 改了什么
`LakesideBoardGuest.ts` 新增 `copyGuestRendererState()`。湖畔（mountLakesideGuest）和草地/天空城（withRegionBoardGuest → mountRegionBoardGuest）共用 mountBoardGuest，所以这三处都走这条路径。具体做法：
- 按层级顺序配对原件和副本的 MeshRenderer（含 SkinnedMeshRenderer），节点名不一致就跳过并计数。
- 每个渲染器、每个子网格、每个 target 的权重都复制：getWeight → setWeights。
- 同时复制 enableMorph、共享材质、投影/接收阴影标志。
- 副本挂进场景前、挂进场景后各复制一次：挂前写入存储的权重，挂后写入实时 morph 实例。
- 诊断：lease.diagnostics().guest 还是渲染器数量；日志 board-guest 里新增 morph {renderers, morphRenderers, weights, mismatched}。

骨骼姿态本来就一致：CHARACTER_POSE_BLEND=true（非烘焙），关节是实体节点，随 instantiate 一起复制。层、缩放、显隐也沿用原有逻辑。

## 已知剩余差异
- 运行时材质实例（getMaterialInstance 改过的属性）不复制。代码里找不到对女孩材质实例的修改，RoomLightingRig 只改了阴影标志，这个已经复制。
- 原件在 lease 创建后如果还在动（落地 hook 之后理论上已经停了），副本不会跟着变。

## 测试
lakeside-board-guest 新增 morph 用例：围裙 3 个子网格（4/0/3 个 target）加裙子，每个子网格、每个 target 逐一比对，每个渲染器都覆盖；还验证副本是快照而不是共享，以及层级不一致时计数。
全套：Node 20 和 Node 22 都是 76/81，未通过的和 c30eeec 是同样 5 项（production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract、navigation-guard 被阻塞），前 4 项由测试线 dc25cec 修复。日志：suite-node20.log、suite-node22.log。
cherry-pick f3d3614..97b761d 到 a8ba19a：无冲突，lakeside-board-guest 通过。

## 包体
源码净增约 2.5 KB，压缩后预计 +1.0 到 1.3 KB。r4-prep 累计预计 +11 到 14 KB，离 24,641,536 B 的门槛还很远。

## 请界面验收部在 Mac 上验
1. 女孩像素对比：取切换前 1 帧和切换后 1 帧，裁女孩区域做逐像素 diff，白天、夜晚各一组。湖畔必测；草地/天空城如果女孩在画面内也测。重点看围裙。另附 `?lakediag=1` 日志里 board-guest 的 morph 字段（应为 mismatched 0，morphRenderers ≥ 1）。
2. 棋盘 UI 首次打开那一帧的耗时实测（ms）。超过 16.7 ms 的话，下一步把 UI 也提前到后台预建。
