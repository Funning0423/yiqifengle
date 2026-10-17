# UI设计部 交接说明（2026-10-17）

没有改动任何游戏代码，也没有 ui/* 分支。这里只有设计稿和调研资料。没有密钥或个人信息，没有大于 50 MB 的文件。

## 1. 结算界面设计稿：`ui-design/result-screen/`（约 13 MB）
- 状态：设计 v2.2 已定稿并交给 GGbot。GGbot 已在本地实现 d6a0019，界面验收部的真机验收还没做，Funning 也还没最终选定。
- `SPEC.md`：v2.2 规格，包括节点层级、尺寸坐标、颜色 hex、字号、动效表、小屏参数、ResultChest3D 参数和文字精简清单。
- 效果图：`result_{day,night}_{closed,open}.png`（780×1688，即 390×844 的两倍），标注版是同名加 `_annot`。
- 原版对比：`compare_{day,night}_before_after.png`。
- 宝箱：`chest/` 下有 v3 立体版 2D 兜底图 `chest_v3_0.png`、`chest_v3_12.png`，新旧对比图 `chest_old_vs_new.png`，渲染脚本 `render.py`、`render_v3.py`。
- 奖励图标表：`rewards/reward_icons_sheet.png`。
- 合成源码：`src/compose.py`、`src/mock.html`。
- 已确认的实现偏差（我同意过的）：相机瞄准高度 0.68，不改模型，不加暖色天光，描边用偏移副本叠出来，兜底图 400 宽、256 色，数量角标等数量接通后再验证。
- 待 GGbot 修改：底部按钮离面板内沿和底边留 16pt；harness 的说明字不能进包。

## 2. UI 布局市场调研：`product/2026-10-16/ui-market-research/`（约 25 MB）
- 状态：已完成。Grok Bot 已收到，7 条原则已采纳。
- 内容：`REPORT.md`、`images/`（76 张 App Store 截图）、`ui-market-research-longimage.png`、`sources.json`、`make_longimage.py`。

## 3. 还没开始
- `UI-GUIDE.md`：统一的 UI 规范，要梳理主页、暂停、旅程等界面，并写入那 7 条原则。
- 解锁提示要移到旅程册或路牌上加红点提示，还没排期。
