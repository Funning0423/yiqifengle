# 结算画面备选稿（r5 U1-1）

只出设计稿，**不改游戏代码**。三个版本，每个版本 390×844 和 375×667 各一张。每张图里有三个画面：过关·宝箱未开 / 过关·点开宝箱后 / 差一点点。

| 文件 | 内容 |
|---|---|
| `result_v2.2-390x844.jpg` / `result_v2.2-375x667.jpg` | **v2.2 现状**（包内代码的 harness 复原，**harness 字用红框标出、要去掉**） |
| `result_v3A-390x844.jpg` / `result_v3A-375x667.jpg` | **v3-A 焦点收拢**（建议，改动小） |
| `result_v3B-390x844.jpg` / `result_v3B-375x667.jpg` | **v3-B 星星主角 · 底卡**（建议，改动大） |
| `compare_390x844.jpg` / `compare_375x667.jpg` | 三个版本的「过关·宝箱未开」并排 |
| `src/render_result.py` | 出图脚本：`python3 docs/r5/ui/result/src/render_result.py`（仓库根目录跑；要装 Pillow，以及 Noto Sans CJK `/usr/share/fonts/opentype/noto/`） |
| `src/dump_v22_nodes.cjs` → `src/v22_nodes.json` | 用 `tools/board-ui/harness.cjs` 跑真实的 `openResult()`，导出 v2.2 每个节点的位置、尺寸、切图和文字（Node ≥ 22.6；`QF_TYPESCRIPT_MODULE` 指向 typescript） |
| `src/dump_layouts.cjs` → `src/layouts_7screens.json` | 7 种竖屏下棋盘、结算、岛屏道具的实测布局（UI-GUIDE §5 用） |
| `src/bg_board_v31.jpg` | 底图：阶段一 v3.1 棋盘定稿图（示意，不是实机截图） |

单张都在 700 KB 以内（实测见 `src/sizes.json`）。

## 现状（先读的代码）
- 包里的结算页是 `creator-build-project/assets/scripts/ui/BoardPanels.ts`：`openResult()` + `configureResultLayout()`。
- 版本：SPEC v2.2 `d6a0019`（分支 `ggbot/result-screen-on-688aad3`），之后同一分支上还有 `e2bd707`（UI 设计部审批条件：按钮离面板内沿 16 pt、宝箱中心 y485、1024² RenderTexture、harness 说明字守卫），以及 R1 / R2 修正（`1d9d53a`、`8edc7d2`、`576b8ab`、`b7c5221`）和 `6a45937`（开箱前不显示奖励）。这些都已经在基线 `bc81575` 里。
- 这三个测试我在 Node 22.23 下跑过，都通过：`tools/board-ui/test_result_screen_style.cjs`、`test_result_safe_area.cjs`、`test_result_viewports.cjs`。
- 截图：仓库和预览机上都找不到 v2.2 的实机截图（`work/rsv2/` 不在这台机器上）。所以 v2.2 图是用 harness 导出的节点位置，配上包里的同一批切图画出来的。差别有两处：3D 宝箱换成了 2D 兜底图，棋盘底图是示意。

## 三个版本都满足的硬性要求
| 要求 | v2.2 | v3-A | v3-B |
|---|---|---|---|
| 底部按钮（含 6 pt 投影）离面板 / 卡片内沿 16 pt | 16 / 16 / 16（代码 `ACTION_INNER_PAD`） | 16 / 16 / 16 | 16 / 16 / 16 |
| 玩家包里没有 harness 字 | 包里没有（有测试守着）；**预览图上的黑条是 harness 字，图上已用红框标出：去掉** | 图上没有 | 图上没有 |
| 文案友善 | 「步数用完了，换个顺序试试？」 | 「还差一点点，换个顺序再试试吧」 | 同 v3-A |
图上洋红色的「16 pt」标尺是量出来的实际距离（`measure_bottom()`），只是标注，不是画面内容。

## 改进点
**v3-A 焦点收拢**（推荐先做）
- 结构不变：一个居中面板，点宝箱领取。只按阶段一的精简规则重排：
  - 面板宽 352（375 宽的屏用 336），高度跟着内容走；
  - 间距只用 8 / 16 / 24；
  - 字号三级：标题切图、正文 16、数字 32（「分」降成 16）。
- 星星放大到 64 / 48（v2.2 是 37 / 29），后面加一层暖光；宝箱 168（矮屏 128）。
- 开箱后，奖励徽章停在箱口上方，下面写上名字。
- 失败页：目标图标和「×3」作为一组居中（v2.2 图标贴在左边，`×3` 离得很远）。

**v3-B 星星主角 · 底卡**
- 结算内容收进一张贴底的卡片，卡片下沿离安全区底 16 pt。星星放大到 88 / 64，一半压在卡片上沿。
- 开箱后，宝箱退到左边，奖励排在右边。
- 上方露出棋盘，遮罩加深到 42%。
- 代价：`configureResultLayout` 要整体重排，R1 的宝箱交接动画要重新对位置。区域棋盘上，底卡可能盖住女孩。

## 需要 PM 决定
1. 选 v3-A 还是 v3-B，还是保持 v2.2。
2. 「底部按钮距底边 16 pt」的“底边”指哪条线：面板内沿（现在代码的做法，e2bd707），还是面板外沿 / 屏幕安全区底？三个稿子都按「面板内沿 16 pt」画，同时保证面板外沿离安全区底 ≥ 16 pt。
3. 开箱后要不要写出奖励名字（v2.2 只有图标）。
4. 失败页文案用「步数用完了，换个顺序试试？」还是「还差一点点，换个顺序再试试吧」。
5. v3-B：区域棋盘上底卡盖住女孩，能不能接受。结算是全屏模态，不受 HUD 的 13 pt 规则约束。
