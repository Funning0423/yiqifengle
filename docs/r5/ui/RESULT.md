# r5 U1 · UI 准备单：产出汇总

分支 `ui/r5-design`，基于 `gbt/r5-integrated-b07-wip`（`bc81575`）。三项都只是准备：**不定稿、不改游戏代码、不合并**。这个分支只加了 `docs/r5/ui/` 下的文件。

## 1. 结算画面备选稿 → `docs/r5/ui/result/`
- `result_v2.2-{390x844,375x667}.jpg`：v2.2 现状。用 harness 跑真实的 `BoardPanels.openResult()` 导出节点，再配上包内切图画出来。预览工具的 harness 说明字用红框标出：要去掉。
- `result_v3A-*.jpg`：v3-A 焦点收拢，推荐。结构不变，按精简规则重排；星星放大，失败页目标居中，开箱后写出奖励名。
- `result_v3B-*.jpg`：v3-B 星星主角 · 底卡。改动大。
- `compare_{390x844,375x667}.jpg`：三版并排。
- 三个版本的底部按钮（含投影）离面板内沿都是 16 pt（图上有标尺）；v3 图上都没有 harness 字；失败文案改成更友善的说法。
- 详情和决策点见 `result/README.md`。

## 2. 规范 → `docs/r5/ui/UI-GUIDE.md`
- 内容：字号（实际 pt 和三级建议）、颜色（调色板、文字昼夜色、遮罩、光晕、K 系数）、间距（女孩 ≥ 13 pt，出处 `GIRL_STAND.minGapPt` / `UI_GAP_PT`）、安全区（`boardSafeInsets` 的兜底、CSS、微信 safeArea、胶囊规则）、7 种竖屏。
- 7 种竖屏取自 `docs/r5/transitions-DESIGN.md` §4.1：390×844、414×896、360×780、375×667、390×520、320×568、768×1024。每种屏幕的布局数值是 harness 跑真实 TS 算出来的（`result/src/layouts_7screens.json`），分档规则都标了代码出处。

## 3. 解锁提示改红点 → `docs/r5/ui/unlock/`
- `UNLOCK-REDDOT.md`（现状分析 + 两个方案）、`unlock_A_journal.jpg`、`unlock_B_signpost.jpg`、`reddot_spec.png`、`state_A.png`、`state_B.png`。
- 现状：`unlockHint` 还在 `ManagedMobileBoardUI.ts:912` 里计算，但 SPEC v2.2 把结算页上的那一行删了，**现在玩家完全看不到解锁提示**。
- 方案 A（推荐）：所有解锁都汇到旅程册，岛屏只有旅程册一个点，章节牌上再细分。
- 方案 B：新主线关放路牌，新挑战 / 新章节放旅程册。
- 两个方案的“已看”都存在 localStorage `qfl.ui.seenUnlocks`，不写旅程存档；老玩家第一次启动时迁移成已看。

## 需要 PM 决定
1. 结算选 v3-A / v3-B，还是保持 v2.2。
2. 「底部按钮距底边 16 pt」的“底边”指面板内沿（现在代码的做法），还是安全区底。
3. 开箱后要不要写出奖励名；失败文案用哪一句。
4. v3-B 底卡在区域棋盘上可能盖住女孩，能不能接受。
5. 红点选方案 A 还是 B；天空城 3D 入口要不要亮点；localStorage 丢失后重亮能不能接受。
6. 结算页宽度要不要和其他弹窗统一成 680 × scale（现在结算封顶 350 pt，其他弹窗在 414 / 768 上是 375 / 422）。

## 已知问题
- **存档出错的提示现在不显示**：`hostResultError` 和 `unlockHint` 共用一个字段，v2.2 删掉这一行以后，两个都看不到了。这是 v2.2 的副作用，要单独修，和红点方案无关。
- v2.2 失败页：目标图标贴在左边，「×3」离得很远（`ResultGoalCount` 左对齐）。
- 仓库和预览机上都没有 v2.2 的实机截图（`work/rsv2/` 不在这台机器上）。现状图是 harness 复原：3D 宝箱用 2D 兜底图代替，棋盘底图是示意。
- 390×520 和 768×1024 没有真机胶囊样本；测试真机行的下安全都写 34，没有覆盖下安全为 0 的机型。
- 本机自带 Node 20，跑不了这些测试，要 Node ≥ 22.6。这次是临时下载官方 Node 22.23 到 `/tmp/node22`，另外装了 typescript 到 `/tmp/qfts`（`QF_TYPESCRIPT_MODULE` 指向它），只在本机临时目录，没有进仓库。用它跑过 `test_result_screen_style`、`test_result_safe_area`、`test_result_viewports`，都通过。

## 怎么重出图
```sh
python3 docs/r5/ui/result/src/render_result.py     # 结算 8 张
python3 docs/r5/ui/unlock/src/render_unlock.py     # 红点 5 张
# 需要重新导出节点 / 布局时（Node ≥ 22.6）：
QF_TYPESCRIPT_MODULE=<typescript 路径> node docs/r5/ui/result/src/dump_v22_nodes.cjs   # 输出 /tmp/r5ui/dump.json → 复制成 v22_nodes.json
QF_TYPESCRIPT_MODULE=<typescript 路径> node docs/r5/ui/result/src/dump_layouts.cjs
```

## 定稿（2026-10-18）· v3-A + 红点方案 A

- 用户拍板：结算用 **v3-A**，红点用 **方案 A**。PM 三条：开箱后写奖励名；按钮离面板内沿 16，面板离安全区 ≥ 16，矮屏按 N/C/M/X 降档；面板宽 = round(680 × popupScale)。
- 实现说明（给 Cursor）：[`final/IMPLEMENT.md`](final/IMPLEMENT.md)
- 定稿图：`final/result_390x844.jpg`、`final/result_375x667.jpg`、`final/redline_*.jpg`、`final/reddot_A_*.jpg`、`final/result_night_390x844.jpg`、`final/result_7screens.jpg`
- 新增切图只有 `final/assets/reddot.png`；其余都复用 `bundles/board_art`，见 `final/assets/kit_preview.png`。
- 另记录了一个 bug：「存档出错提示行被删」（d6a0019f），见 IMPLEMENT §9。

## U2 · 对话框重做（对比稿，2026-10-18）

- 只出对比图，不写代码，不出定稿：[`dialog/README.md`](dialog/README.md)
- 对比图：`dialog/compare_390x844.jpg`（底图是真机截图）、`dialog/compare_375x667.jpg`（harness 合成）
  - 三栏：现有（IslandToast 吐司，仓库里没有角色对话框）· 方案 A 海风气泡 · 方案 B 折角纸牌。
- 推荐 **A**：框外的水平名字胶囊加指向说话人的尾巴，和现有的吐司、弹窗同一家族；离女孩 20 / 17.8 pt。
- 字体：名字用资源圆体 Bold，正文用思源黑体 Bold，都是 SIL OFL 1.1。只打包用到的字：名字约 4 KB，正文约 0.3–0.4 MB。
- 要用户来定：A 还是 B；正文用思源子集还是系统字体；简繁。矮屏的对话镜头由运镜来定。
