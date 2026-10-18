# r5-balloon-v23fix 接入报告（修 balloon-v22 验收缺陷）

## 基线与提交

| 项 | 值 |
| --- | --- |
| BASE（v22 最终） | `f1ec442f`（Point REPORT…） |
| 最终 HEAD | `571c65f4779da2d76482e63c4ae27b908214560f` |
| build-guard HEAD | `571c65f477` / `571c65f4779da2d76482e63c4ae27b908214560f` |
| wechat-release | **19936166** B |
| web-test | **20725220** B |
| region_transit_balloon | **519891** B（≤ 1 MiB） |

未 push；未碰 `main`；冻结文件未改。

## 测试

Node 22：`run-suite` **98/99**（仅 `navigation-guard: BLOCKED_BROWSER`）。`test_frame_background.cjs`：5054 帧 PASS；`seamLeak=0`；`seamCamErr≈7.1e-5`；交接 `HANDOFF_COVER_T=35.9`、`handoffFade=1`。

## 缺陷修复（对照 GBT 审 v22 `f1ec442f` / build `80cf40a8`）

### 1. 04 巡航云海平涂中灰 + 海面青绿
- **根因**：`clouds_floor` 顶点色约 0.2，读成中灰平涂；远景卡贴图海裙为青绿色 `(130,176,173)`。
- **修法**：`paintCloudSea` 对 floor/puff/city_sea 强制 `builtin-unlit` 浅白灰（夜间冷灰，无 emissive 实例）；`tintFarCard` 日间用冷蓝乘子 `(150,185,255)` 保留贴图，把海裙推到蓝色；备选海面 `(36,92,168)`。
- **证据**：`04_cruise.png`（下半主色约 `(84,152,207)` 蓝）；`04_cruise_vs_render.png`。

### 2. 01 上篮风车灰块 / 无云（对比草原玩法）
- **根因**：转场开头关掉 `meadow_clouds_near`，且 liftoff 窗口过早藏远云；风车塔身在**草原正常玩法**里同样是灰白块（贴图 UV 奶油色区），不是转场单独弄坏。
- **修法**：只藏 `meadow_sky_dome`；每帧重开 `meadow_clouds_near` / `meadow_far_hills`；`t<4.8` 保留 transit 远云；草原段保持阴影。
- **证据**：`00_meadow_gameplay_ref.png`（不进转场）vs `01_board.png` / `02_liftoff.png`：风车塔身同为灰白块、钟架同有木纹、天空均有低多边形云、草地同绿。结论：**01/02 与草原玩法一致**；风车灰不是回归。

### 3. 05/06 空中细棕色长杆
- **根因**：关岛体后藤蔓悬空；部分根须也在 rock_strata 几何里。
- **修法**：恢复岛体（见下）；`env_sky_island_vines` 整段隐藏，避免脱离岛体的细杆穿帮。strata 自带的短根须挂在岛底（与效果图一致）。
- **证据**：`05_city.png`、`06_land.png`。

### 4. 07 夜景无云海 / 城像白天
- **根因**：为消洋红整组关掉云地板；城未压暗。
- **修法**：夜间恢复云地板，用**确定无 emissive** 的冷灰 unlit；`dimCityNight` 对非窗灯网格压暗；主光夜间 illuminance×0.22；灯塔窗保留 emissive 暖光。
- **证据**：`07_night.png`（岛下有云层、城暗、窗暖光）；洋红检查全 shots `mag=0`。

### 5. 05/07 天空之城无浮岛岛体
- **根因**：`CITY_RIDE_HIDE` 整段关掉 `env_sky_static_rock_strata` / `palette`。
- **修法**：`strataHideUntil=CITY_ON_T`，`strataOffAt=31`（只在 06 贴脸前关岩体）；草地+岩体在 05/07 可见；巨型机器人保留。
- **证据**：`05_city.png`、`07_night.png`。

## 未退化项

夜景无洋红（mag%=0）；海鸥未穿球囊；钟架木纹；04 远景卡绿色可见；03 穿云仍可见球囊+女孩；05 DC≤53（实测约 39–47）；06 关岛底后不擦脸；07 无霓虹绿条；seamLeak=0；时长 36s；包体见上。

## 截图清单

`docs/r5/balloon-v23fix/shots/`（副本任务包 `shots/`、`docs/r5/balloon-v23fix/shots/`）：
`00_meadow_gameplay_ref.png`、`01`–`07`、`*_vs_render.png`（左游戏 / 右 GGbot v2.3）、`contact_vs_render_v2_3.png`、`handoff_*`、`light_*`。

## 洋红检查

`tools/transitions/check_magenta_shots.cjs`：15 张单帧全部 `mag=0`（阈值 R>200,G<80,B>200 占比 <0.1%）。

## 磁盘

交付时约 **5.5Gi** 可用。
