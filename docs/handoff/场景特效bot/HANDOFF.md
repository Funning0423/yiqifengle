# 场景特效bot 交接：fx/r5-scenes-concept-v3

## 本分支
- 分支：`fx/r5-scenes-concept-v3`，头部本提交（以 git rev-parse fx/r5-scenes-concept-v3 为准），基点 `55368056`（`gbt/r5-integrated-b15`）
- 内容：三场景概念 v3 完成交接（灯塔终参重渲、小镇、庭院）。概念图/脚本只在 `previews/`，本分支只提交本 HANDOFF。
- 进度：概念预览已完成。未进 Creator。
- 已测：Blender 概念 day/night 全图（灯塔另含 stand_crop 全图裁切）；灯塔脚本断言 `CHAMFER_EDGES=3`。
- 未测：Creator 导入；真机；灯芯高度偏差；雪山 Mac Creator 导入。
- 预览和大文件不进仓库，只写路径。

## 已定（DECISIONS-2026-10-22）
1. **SP_snowpass.glb.meta 只有 uuid**：可以。等 Mac Creator 导入 `region_snowpass`，不必先手写子 meta。
2. **云海 98,840 面**：接受不削（天空城预算提到 100k）。
3. **小屋窗用 B**：合入 `fx/r5-s2-360-windowB`（约 `99bbeaa8`）；A 留对照。
4. **`fx/r5-b11-balloon-sail`**：需要时再 rebase 到 `gbt/r5-integrated-b15`（`55368056`），先别合；b15 气球以 `fx/r5-b15-*` 为准。

## 三场景 v3 预览路径
根目录：`/workspace/yiqifengle/previews/场景特效bot/r5/scenes_concept/`  
汇总校验：`.../scenes_concept/SHA256SUMS_v3.txt`

### 灯塔 `lighthouse/v3/`（色温约 6800K）
- 脚本：`lighthouse3.py` + `lib3.py`（与 `/workspace/fxtools/v3/` 权威版一致）
- `lighthouse_v3_day.png` / `lighthouse_v3_night.png`（RES=70 → 756×1638）
- `lighthouse_v3_day_stand_crop.png` / `lighthouse_v3_night_stand_crop.png`（全图投影 500×500 裁切）
- 终参：台面中心她根空间 glTF (−0.31, 0.40, 0.33)；0.22×0.22×0.40；靠她侧三条 10 mm/45° `bmesh.ops.bevel`（`offset=0.010`）；握把 +0.1502 m；梯子脚 ≥0.45 m（脚本 0.55 m）台右侧靠塔；小屋已放大。

### 小镇 `town/v3/`（色温约 5200K）
- 脚本：`town3.py` + `lib3.py`
- `town_v3_day.png` / `town_v3_night.png`
- 4 户型 × 4 墙色 × 3 屋顶色；近边矮墙+树篱；树冠主冠+侧瓣+亮顶+柏树；路边草/落叶/木桶木箱/水洼。

### 庭院 `courtyard/v3/`（色温约 3600K，弧线最暖）
- 脚本：`courtyard3.py` + `lib3.py`
- `courtyard_v3_day.png` / `courtyard_v3_night.png`
- 风车叶片格栅（主梁、7 横撑、外框、纵条）一半挂帆；主屋双层檐+檐角饰+风向标；岛缩小+岩石岸+浪花；近景草丛/碎石/小花。

### sha256（文件名）
```
2a5e3ab878d83fdec58e32e08725d0c1830ff25745455a8f2046a27a39058ebb  lighthouse_v3_day.png
adf764aebc4a4e35e9ae8ad1bd013bc63eb9219ccf263e29bc2d3fe88e7169d0  lighthouse_v3_day_stand_crop.png
426018a45e666452e09dde7adca3e495085d5b783b81324e5fdef52a8865889c  lighthouse_v3_night.png
adebaf4a0315fbfa60d7fe826fa8dec30a1fbc740d4895c96d57efd206d5a9ab  lighthouse_v3_night_stand_crop.png
dcfaf218f81eb172ae24869a494374ab8e37e813e932a159f159f6632a1204fd  town_v3_day.png
476a2b621cc991399ea6ab1fb6ee6606d30d674a009ab102df604a52a6f47d19  town_v3_night.png
42b2031963b16efd0fc1b270bf7eb124781f9fd83c2e47b41a2308808a6790c2  courtyard_v3_day.png
d475d37537409aa37e4af3ddb8296b74b043d8e02e76f7804e07204c48edc2be  courtyard_v3_night.png
```

## 全局待办（场景特效bot，截至 2026-10-23 EDT）
1. **雪山白模和坐标表**：已在 `fx/r5-snowpass-grey`（内容提交 `dc0a7323`，分支头含 HANDOFF `11a59249`）。COORDS.md 在 `previews/场景特效bot/r5/snowpass_grey/COORDS.md`。
   - 还剩：Mac Creator 导入、风铃运行时摆动、夜间灯光接入。
2. **三场景概念 v3**：**完成**（本分支）。概念未进 Creator。
3. **灯芯高度偏差**：预览约 0.93 m、髋前 33 cm，规格 0.98 m、29 cm。仍待真机确认。
4. 概念图和预览都在 `previews/场景特效bot/r5/` 下（不进仓库）。

## 偏差说明
- 渲染 RES=70（756×1638），非 100；SPP=40（灯塔全图参考上次成功参数）。
- 灯塔 stand_crop：独立 `VIEW=stand` 特写曾因裙摆占满/阴影过黑或补光过曝失败，最终用全图投影裁切；网格倒角仍在全图构建时断言通过（`CHAMFER_EDGES 3`）。
- 色温以太阳色 RGB + 天空渐变近似目标开尔文（脚本未写死 Kelvin 数）。

## 下一步怎么接
- 同一时间只开一个 Blender：`/workspace/tools/blender-4.5.3-linux-x64/blender -b -P <脚本>`，环境变量 TOD=day|night、RES、SPP、OUT。
- 测试：`QF_TYPESCRIPT_MODULE=/workspace/tsmod/node_modules/typescript /workspace/tsmod/node_modules/node/bin/node tools/journey-integration/run-suite.cjs`。基线 147/148，navigation-guard 因浏览器 BLOCKED。
- 不要合 `fx/r5-b11-balloon-sail`；不要碰用户 Mac。
