# r4.1：棋盘提示牌挪到托盘上方

- 分支：`ggbot/build05-r41-hint-above-tray`（基于 6f42df4，一个提交，仅本地，未推送）
- SHA：`260ea024dd15b9ff17e02f225210ce806f5e8fc6`
- 补丁：`0001-r41-hint-above-tray.patch`

## 改了什么
- `ui/BoardLayout.ts`：新增 `TOAST = {height 32, gap 6, maxWidth 330, edge 12}`；`toast` 改为 `{x, y, maxWidth, height}`。
  - 竖屏：提示牌放在信息牌和托盘之间的那条带子正中（390x844 为 y 168–200，上下各留 12 pt），所有地区一样，没有任何按地区的分支。
  - 宽度：最长 330，同时离屏幕左右各至少 12 pt（320 宽的屏上是 296）。
  - 矮屏（375x667、320x568）：原先信息牌和托盘之间只有 24 pt，放不下 32 pt 高的提示牌，所以托盘下移 20 pt、整体缩小一点，留出 44 pt 的带子。390x844、414x896、360x780、768x1024 的托盘和 r4 完全一样，镜头和落点不受影响。
  - 390x520 这种托盘已经缩到最小的窗口，带子只剩 21.7 pt：提示牌仍不压托盘、不进胶囊区，但会盖住信息牌底部（只显示 2 秒）。
  - 横屏（Mac 桌面预览）：托盘上方够放就放在托盘正上方居中（1024x768、1280x720/800、1440x900 都是这种）；不够时（例如 844x390）放在左栏工具下面，不压托盘。
- `ManagedMobileBoardUI.ts`：位置只从 `BoardLayout.toast` 读。新增 `sizeToast()`，宽度仍是 `measure(text,15)+40`，上限是 layout 给的 maxWidth。样式（颜色、描边、圆角、2 秒淡出）不变。
  - 唯一可见差异：超出宽度的长句（例如「这件道具已用完，可从已获得的宝箱或地区礼物领取」）文字整体等比缩小，留在药丸圆头里面（390 上约 0.92 倍）。原来这句会顶到边缘。
- 新测试 `tools/board-ui/test_board_hint_above_tray.cjs`（套件 id `board-hint-above-tray`，已登记进 run-suite.cjs），锁定以下 9 项：
  - 提示牌底 ≤ 托盘顶 − 6；
  - 提示牌顶 ≥ 胶囊/安全区底 + 6（同时测了真实微信胶囊的几种位置）；
  - 宽 ≤ 330，离边 ≥ 12；
  - 不压信息牌、工具、女孩（草甸落点、湖畔冻结的女孩）；
  - 高屏托盘不变；
  - 横屏的两种放法；
  - 所有地区走同一条代码路径；
  - 运行时 Toast 节点确实落在 layout 给的位置；
  - 最长提示放得下。
- 旧位置没有被别的测试锁定，所以不需要改旧测试。

## 结果
- 测试套件，Node 22（v22.23.3）：92/93。只有 navigation-guard 没跑，原因是要浏览器；基线 6f42df4 是 91/92，新增的这项通过。
- 测试套件，Node 20（v20.19.2）：90/93。没有失败项；legacy-board-ui-pure、reward-background-return 是 BLOCKED_NODE，navigation-guard 是 BLOCKED_BROWSER，和基线一致。
- 包体：两个改动脚本编译后用 terser 压缩，估算 +1,136 B（BoardLayout +782，ManagedMobileBoardUI +354）。这是估算，以真实构建为准。
- 在 6f42df4 + 95d3eee 上 cherry-pick：无冲突。在叠好的树上跑了这 10 项，全部通过：board-hint-above-tray、region-landing-hook、journey-framing、journey-occlusion、legacy-board-ui-pure、board-runtime、lakeside-camera、lakeside-landing-hook、journey-cutscene-ui、lakeside-pavilion。
- 叠上 95d3eee 后，390x844 草甸女孩在 y 620–671。这个位置原本和旧提示牌（y 652–684）重叠，现在托盘下方除了工具行不再有 UI。

## 文件
- `footprint-table.txt`：给运镜bot 的提示牌范围、托盘位置和女孩位置表。
- `footprint.json`：同一张表的机器可读版。
- `suite-node22.txt`、`suite-node20.txt`、`suite.260ea02.node22.json`、`suite.260ea02.node20.json`：两次全套测试的输出。
- `size.txt`：包体估算。
- `cp.txt`：cherry-pick 检查记录。
- 截图：盒子上没有引擎，没有真机截图，需要 Mac 上验收。
