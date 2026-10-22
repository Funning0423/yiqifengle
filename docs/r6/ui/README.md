# r6 湖畔棋盘 UI 交付

先看 RESULT.md（交付清单、包体、自查结论），再看 LAKESIDE-LEVELS.md 和 DIFFICULTY-13-32.md。

- tools/ 下是生成脚本，依赖：
  - Blender 4.5.3；
  - b-board 源码：art-src/board-ui/b-board/src；
  - T9 调色板：ui-props/textures/env_palette_256.png；
  - pngquant。
- preview-levels/ 只是预览拼图用的配置，不是游戏关卡数据。

## 湖畔棋盘预览：素材来源与验收备注（v2.5）

- 原始切图目录 `R6_RAW`：`compose_region.py` / `compose.py` 默认读 `/workspace/r6/board/rawall`，该目录不在仓库里。
  现用素材在 `ui-design/lakeside/work/raw`（约 4.7 MB，UI设计部工作区，未入库），运行前设置
  `R6_RAW=/workspace/wechat-game/ui-design/lakeside/work/raw`。
- 托盘框：`preview-levels/L13.json`、`L16.json` 的 `"tray": [52, 445, 697, 1092]`（750×1624 坐标，由 `compose_region.tray_box()` 量得，
  `TRAY_BOX_ONLY=1 python3 tools/compose_region.py preview-levels/L13.json /dev/null` 可复核）。`measure_visible.py` 读这个值；读不到时退回默认框并打印 WARN。
- **饱和度已到下限**：白天背景饱和度（22.7%，线 22–25%）和草地饱和度（27.8%，线 27–33%）都贴着下限。以后不要再降 `DAY_SAT` / 远景饱和度；
  要微调背景显著性或层次，先调远景对比（`DAY_CONTRAST`、`TREE_CONTRAST`）。
