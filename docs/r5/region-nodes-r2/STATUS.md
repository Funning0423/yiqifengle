# r5 区域关卡节点 r2 STATUS

- 2026-10-18 02:20 接线现状：r1 的 NodeWalker / FollowWalk / MapExplore / ExploreInput / 屏幕标记都是纯函数，没有驱动 `WorldR5Integration` 的世界摄像机和角色。`advanceMainline` 在角色 `perform` 不返回时会停在走路。草地和天空之城没有公开的 `__worldIntegration.startRegionFlowTest`（仅 DEBUG）。包体 r1 为 19,413,434 B，相对 r4 19,335,755 B 多 77,679 B。
- 2026-10-18 02:33 已接到真实摄像机：`RegionNodeStage` 隐藏棋盘宿主和区域背景相机，打开旅程模型与岛外层，用 `applyCameraPose` 播放 BoardToFollow 0.6s / FollowWalk / FollowToBoard 0.8s / MapExplore。走路走现有 `perform`。`performBounded` 每段 12s 超时后 `cancelAndReset`。天空之城主线 12 领区域奖励后走到 S6 并仰望星环（34°），再开放自由探索。标记是一颗 `builtin-unlit` 顶点色宝石，三种状态。物件按运行时节点名点按反馈。`?qa=1` 才挂 `qaShot`，无横幅。草地没有羊的网格，第四个物件是栅栏。潮汐池节点名落到 `env_prop_palm_lean_01`。
- 2026-10-18 02:33 Node 22 定向复测（改 `RegionNodes` 压缩前的全量）107/108，唯一非 PASS 是 `navigation-guard: BLOCKED_BROWSER`。Node 20 105/108，另有 `legacy-board-ui-pure`、`reward-background-return` 为 `BLOCKED_NODE`。
- 2026-10-18 02:33 `RegionNodes.ts` 由 baker 改为单行 JSON，13400 B → 6554 B。`region-nodes-data` 与走路测试 PASS。全量套件在这次压缩和镜头递归修复之后重跑。
- 2026-10-18 02:40 全量：Node 22 107/108（仅 `navigation-guard: BLOCKED_BROWSER`）；Node 20 105/108（另两项 `BLOCKED_NODE`）。提交 `c9ed530c20`，tree `4aa46a490d`。下一步拿构建锁做冒烟和 build-guard。
