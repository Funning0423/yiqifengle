# 天空之城断桥只显示 after

分支 `cursor/r5-skycity-bridge-after-acb5`。基线 `gbt/r5-integrated`（`a83e1c2b`）。2026-10-18 15:03 EDT。未合入 `int/v1` 或 `main`。

## 节点

`env_skycity.glb` 里两块断桥是兄弟节点，都还在，没有删、没有改 glb（sha256 `d3bf7e1d92c74d667796096fc03f68314fa5ed5328736c9611334c4526193564`）：

- `skycity_float_root/state_bridge_before`（1 个子网格）
- `skycity_float_root/state_bridge_after`（2 个子网格）

## 改动

`SkycityBridgeState.ts` 的 `applySkycityBrokenBridge` 只把 before 设为不显示、after 设为显示。白天和夜间走同一条，不按昼夜分支。

- 首次进入、回访和暂停后恢复：`SkycityVisitAdapter` 在挂载和 `show` 时调用。
- 非热气球的天空之城旅途副本：`RegionJourneyAdapter` 在环境准备之后调用。
- 热气球落地（fix1 / handoff，`t >= HANDOFF_COVER_T`，画面在全屏遮罩里）：`BalloonTransit.paint` 先按 `ALWAYS_HIDDEN` 藏 after，再 `applySkycityBridgeForBalloon(model, handoff)`。飞行途中 handoff 为假，天空到达镜头仍只见 before。
- 棋盘副本：`WorldNativeComposition.hideOtherBoardStates` 本来就只留 `state_bridge_after`。`SkycityBoardBackground.ts` 未改（Build05 哈希钉住）。棋盘上桥的可见子网格仍是 after 的 2 个，没有多出来的 DC。

区域内把两块都画改成只画 after，桥的子网格从 3 降到 2。落地时用 after 的 2 个换下飞行中 before 的 1 个，法庭/门/星环的 after 状态仍保持隐藏。

## 测试

Node v22.23.3，TypeScript 5.4.5。`QF_TYPESCRIPT_MODULE` 指向这套 TypeScript，跑 `tools/journey-integration/run-suite.cjs`：122 项，121 PASS，只有 `navigation-guard` 为 BLOCKED_BROWSER。`skycity-bridge-state`、`frame-background`、`transport-balloon`、`journey-occlusion` 均为 PASS。另跑 `tools/cloud-skycity/test_adapter.cjs`，9/9 PASS。跑完已清 `tools/journey-integration/reports` 和 `output`。

## 包体与画面

未重编 wechat。资源字节差 0。新增脚本源码 1261 B。对照 build06 报告的 wechat-release 20,266,535 B，上限 24,641,536 B。没有截图或视频：这是节点开关，没有改画面资源。

## 遗留

飞行途中（handoff 之前）仍显示 before。没有 Creator 或微信包的实机构建。
