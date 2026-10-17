# 首页招牌 A / B / C / A2 整屏对照图（Voice Bot，2026-10-16 04:05Z）

文件：`home_sign_ABCA2_sheet.png`（1828×3716，约 4.4 MB）。每行是一个候选，每列依次是：远景白天、远景夜间、近景白天、近景夜间。每格都是 402×874 整屏，没有裁切。生成脚本：`make_sheet.py`。

| 候选 | 内容 | commit（基于 b14067c） | 来源 |
|---|---|---|---|
| A | 招牌放大 | 3080d07（tree 74e9dec） | 20261016T0131Z-home-sign-AB/frames |
| B | 深色底板 | 50eceea（tree 6e90c0b） | 同上 |
| C | 只移棕榈 | 53926de（tree a4b869b） | 20261016T0155Z-home-sign-C-A2/frames |
| A2 | 放大、移位、补腿 | f4e26a2（tree ba10788） | 同上 |

## 说明
- 四个候选的白天画面是同一个镜头、同一套渲染流程拍的：两个文件夹里的"现状"白天帧逐像素完全一样。
- 没有重新渲染。A、B 原来只渲染了白天，夜间这 4 格是灰色占位。要补的话需要 Blender 和当时的 worktree，但 box 上已经没有 blender，/tmp/vbsign、/tmp/wt-sign-* 和 git 仓库也都不在了。
- C、A2 用的是 01:55Z 版本，棕榈在西岸 [-3.3,0.05,6.6]，这个位置会挡出门镜头里人物的脸。任务里提到的 20261016T0202Z-home-sign-C-A2-palm2（C=2936c30、A2=3e6b7df）在 box 上找不到。
- 这些都是 Blender 离线预览，不是 Cocos 实机画面。
