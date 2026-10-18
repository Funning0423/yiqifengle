# r5-balloon-v23fix 接入报告（修 balloon-v22 验收缺陷）

## 基线与提交

| 项 | 值 |
| --- | --- |
| BASE（v22 最终） | `f1ec442f` |
| 代码 / build-guard HEAD | `571c65f4779da2d76482e63c4ae27b908214560f` |
| 最终 HEAD（含截图） | `5dd2f2d4174b9462c8bcab21007e0c9fa431eb76` |
| wechat-release | **19,936,166** B（相对 r4 19,335,755 = +600,411） |
| web-test | **20,725,220** B |
| region_transit_balloon | **519,891** B（≤ 1 MiB） |

未 push；未碰 `main`；冻结文件未改。

## 测试

Node 22：`run-suite` **98/99**（仅 `navigation-guard: BLOCKED_BROWSER`）。`test_frame_background.cjs`：5054 帧 PASS；`seamLeak=0`；`seamCamErr≈7.1e-5`；交接 `HANDOFF_COVER_T=35.9`、`handoffFade=1`。

## 缺陷修复

### 1. 04 巡航云海 + 海面色
- 根因：`clouds_floor` 顶点色过暗；远景卡海裙贴图青绿。
- 修法：云地板强制浅白灰 unlit；远景卡冷蓝乘子；备选海面纯蓝。
- 证据：`04_cruise.png`（下半约 RGB 84,152,207）、`04_cruise_vs_render.png`。

### 2. 01 上篮 vs 草原玩法
- 根因：转场藏了 `meadow_clouds_near`；风车灰白块在草原玩法里同样存在（贴图奶油区）。
- 修法：恢复草原云/远山；板前保留远云；草原段开阴影。
- 证据：`00_meadow_gameplay_ref.png` 与 `01_board.png`/`02_liftoff.png` 逐项一致（风车灰块、钟架木纹、云、草地绿）。

### 3. 05/06 细棕色长杆
- 修法：恢复岛体；隐藏 `env_sky_island_vines`；strata 底短根保留。
- 证据：`05_city.png`、`06_land.png`。

### 4. 07 夜景云海 + 剪影
- 修法：夜间恢复云地板（冷灰 unlit，无 emissive）；城非窗网格压暗；窗灯暖光保留。
- 证据：`07_night.png`；洋红全 shots `mag=0`。

### 5. 05/07 浮岛岛体
- 修法：`strataHideUntil=11.6`，`strataOffAt=31`（仅 06 近景关岩体）；草地+岩体+机器人可见。
- 证据：`05_city.png`、`07_night.png`。

## 未退化

无洋红；海鸥不穿模；钟架贴图；远景卡绿；03 穿云可见球囊女孩；05 DC≤53（约 39–47）；seamLeak=0；时长 36s。

## 截图

`docs/r5/balloon-v23fix/shots/`：00–07、`*_vs_render.png`、`contact_vs_render_v2_3.png`、`handoff_*`、`light_*`。副本在任务包 `shots/`。

## 磁盘

结束约 **5.6Gi** 可用。
