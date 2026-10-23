# 场景特效bot 交接：fx/r5-lighthouse-grey

## 本分支
- 分支：`fx/r5-lighthouse-grey`，交接前头部以 `git rev-parse HEAD` 为准，基点 `59a9704dd2fc8152a8b568c3bdc5c26dd3813a48`（`github/gbt/r5-integrated-b15`）
- 内容：星夜灯塔海岸白模（关卡 21–24）：`creator-build-project/assets/bundles/region_lighthouse/models/LH_lighthouse.glb`，约 **23,850** 面（目标 ~30k，上限 **50k**），共享 `M_LK_palette` / `T_LK_palette_256`（内嵌）。分组：灯塔塔身、可转灯室 `LH_lantern_room`、风标 `LH_vane`、光柱空节点 `LH_beam`（无实体圆锥）、岩岛沙滩、海面大圆盘占位、栈桥、放大守灯人小屋（**窗方案 B**）、放灯高台（终参 + 三条 10 mm/45° 倒角）+ 梯子、关卡 21–24 石灯与空节点、礁石草道具。新分包 `region_lighthouse`；glb.meta 只写 uuid，子资源等 Mac Creator 导入。glTF-Validator **0 错误 0 警告**。新增 `test_lighthouse_grey`，套件 **147/148**（`navigation-guard` BLOCKED_BROWSER，与基线一致）。
- 进度：灰盒完成；预览与坐标表已出。
- 已测：Blender 构建（`CHAMFER_EDGES=3`）、glTF-Validator 0/0、`test_lighthouse_grey` PASS、journey-integration 套件 147/148。
- 未测：Creator 导入（子资源 meta）、真机 draw call、运行时灯室旋转 / 光柱加法面片 / 夜间灯光、海面换成湖畔水 shader、灯芯 0.98 m 真机确认。
- 其他：预览 `previews/场景特效bot/r5/lighthouse_grey/lighthouse_grey_day.png`、`lighthouse_grey_night.png`；坐标 `COORDS.md` + `LH_lighthouse_coords.json`；构建/预览脚本 `build.py`、`prev.py`（均不进仓）。
- 预览和大文件不进仓库，只写路径。

## 终参与 360 备注
- 放灯高台台面中心：她根空间 glTF `(−0.31, 0.40, 0.33)`；尺寸 `0.22×0.22×0.40` m；握把中心台面上方 `0.1502` m；靠她侧三条 **10 mm / 45°** 倒角。
- 梯子脚中心距台中心 **0.559 m**（≥0.45），台子 −X/右侧靠塔。
- **灯芯高度规格 0.98 m**（空节点 `LH_lantern_core`；概念预览曾偏 0.93）。
- **窗方案 B**：小屋开窗（对照 `fx/r5-s2-360-windowB` @ `99bbeaa8`），节点 `LH_cottage_window_B`。
- **光柱**：`LH_beam` 为空节点（父 `LH_lantern_room`）；运行时用渐隐加法面片 / 体积光，**不要实体圆锥**（夜景会像圆盘）。
- **海**：`LH_sea` 半径 180 m 圆盘占位，边缘略下沉；运行时复用湖畔水 shader。
- 360：主要建筑与岩岸有体积；天空渐变+云可后接（预览已用 lib sky 占位）。

## 全局待办（场景特效bot，截至 2026-10-23 EDT）
1. **灯塔海岸白模**：**完成**（本分支）。还剩 Mac Creator 导入、运行时光柱/灯室旋转/水 shader、真机。
2. **雪山白模**：已在 `fx/r5-snowpass-grey`（`dc0a7323` 等）。**仍等 Mac Creator 导入**；风铃摆动与夜间灯光未接。
3. **三场景概念 v3**：**已锁定**（`fx/r5-scenes-concept-v3` @ `ee5589e6`）。小镇 / 庭院灰盒**待命**（概念锁定后按需开工）。
4. **灯芯高度偏差**：规格 0.98 m；灰盒已按 0.98 标注节点。仍待真机确认。
5. 不要合 `fx/r5-b11-balloon-sail`；不要碰用户 Mac。

## 已定（沿用 DECISIONS-2026-10-22）
1. glb.meta 只有 uuid：可以，等 Mac Creator。
2. 云海 98k：接受。
3. 小屋窗用 B。
4. b11 先别合。

## 下一步怎么接
- 同一时间只开一个 Blender：`/workspace/tools/blender-4.5.3-linux-x64/blender -b -P <脚本>`。
- 测试：`QF_TYPESCRIPT_MODULE=/workspace/tsmod/node_modules/typescript /workspace/tsmod/node_modules/node/bin/node tools/journey-integration/run-suite.cjs`。基线 147/148，navigation-guard 因浏览器 BLOCKED。
- glTF-Validator 在 `/workspace/fxtools/node_modules/gltf-validator`。
- 运镜 / 角色动画：读 `previews/场景特效bot/r5/lighthouse_grey/COORDS.md`。
