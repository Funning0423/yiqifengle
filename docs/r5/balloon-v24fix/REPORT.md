# r5-balloon-v24fix 接入报告

在 v23fix（`c898be1c`）上小改。未 push，未碰 `main`，冻结文件未改。

## 基线与提交

| 项 | 值 |
| --- | --- |
| BASE | `c898be1c3076d3ab4bc2a485f57931091474373e` |
| 代码 HEAD（build-guard） | `56aa4f3c5b15983ab0c0926abcc9e84591f7d162` |
| wechat-release | **19,947,978** B（相对 r4 19,335,755 = +612,223；相对 v23fix 19,936,166 = +11,812） |
| web-test | **20,737,032** B |
| region_transit_balloon | **531,126** B（v23fix 519,891，+11,235；≤ 1 MiB） |

增量主要来自远景卡 JPEG 海裙重编码（约 +12 KB 源文件）。

## 测试

Node 22：`run-suite` **98/99**（仅 `navigation-guard: BLOCKED_BROWSER`）。`test_frame_background.cjs`：5054 帧 PASS；`seamLeak=0`；`seamCamErr≈7.1e-5`；交接 `HANDOFF_COVER_T=35.9`、`handoffFade=1`。时长 36 s。

05 见城截图当帧 `dcWorst=52`（≤ 53）。其余关键帧最坏约 41–49。

洋红（R>200,G<80,B>200）对全部 15 张游戏截图：`mag=0`。

## 缺陷修复

### 1. 04 云海太稀、海面过饱和
- 根因：`clouds_floor` 全部三角形法线朝下。v23fix 的 `forceUnlit` 换成默认背面剔除的材质后，整张云地板被裁掉，画面只剩几朵朝向相机的 puff 和饱和深蓝备选海面。
- 修法：云地板 / puff / `clouds_city_sea` 改为双面 `builtin-unlit`，不用 emissive。顶点色按原明暗重映射到 0.66–1.0 的冷白，再乘白天白色 `mainColor`，所以是连续云层、白到浅灰、有明暗。备选海面改为浅蓝 `RGB(172,216,236)`。
- 证据：`04_cruise.png`。下半中带约 RGB 193,213,221，同带最暗到最亮约 143,153,175 → 239,240,243。对比 `04_cruise_vs_render.png`。

### 2. 04 小岛周围青色方板
- 根因：`far_meadow_card` 是一块矩形网格，贴图大面积是雾化青绿海裙，和周围海面不是一个颜色，看起来像一块浅青板。
- 修法：从贴图边缘漫过非陆地像素，填成与海面相同的浅蓝；白天乘色改为白，岛上的草地、小路保留。方板边缘因此融进海面。
- 证据：`04_cruise.png` 下半不再出现独立青色矩形；岛体绿色仍在（约 y 0.81–0.89）。

### 3. 07 夜景云太亮、气球仍是白天色
- 修法：同一套顶点明暗，夜间 `mainColor` 为 `RGB(68,80,94)`（无 emissive）。热气球夜间改为保留贴图的 unlit，乘 `RGB(118,110,116)`；火焰不压暗。
- 实测云团（画面底部中段、偏蓝像素）：平均 **59,78,99**，范围约 31,38,47 → 67,88,111。气球红色高光落在约 140 而不是白天的 230+。灯塔窗仍是暖色（约 233,228,202）。
- 证据：`07_night.png`、`07_night_vs_render.png`。

### 4. 05 / 06
与 04 同一套云/海材质。证据：`05_city.png`、`06_land.png`。

### 5. 对比图文字
`tools/transitions/compare_balloon_v24fix.cjs` 用 PIL 左右拼接（不翻转）。每张 `*_vs_render.png` 左上角「左＝游戏」、右半「右＝效果图」。游戏半幅最短边 844 px。

## 未退化

无洋红；海鸥不穿模（沿用 v23fix 挂点）；钟架贴图与 01/02 草原段未改光照切换；03 穿云仍在；浮岛草地+岩体+机器人仍在，岛底根须保留（`env_sky_island_vines` 仍隐藏）；05 DC ≤ 53；`seamLeak=0`；时长 36 s；方案 B 海面与 35.9 s 满屏 fade 交接未改。

## 截图

`docs/r5/balloon-v24fix/shots/`：00–07、`handoff_*`、`light_*`、`*_vs_render.png`、`contact_vs_render_v2_3.png`。副本在任务包 `shots/`。

## 磁盘

开工约 5.6Gi 可用。第一次 build 后约 5.5Gi，夜间色重编后约 5.3Gi，截图前清过缓存后约 7.6Gi。最终 build-guard 会再清 library/temp。
