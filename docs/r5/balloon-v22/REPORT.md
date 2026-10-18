# r5-balloon-v22 接入报告（GGbot 美术 v2.3）

## 基线与提交

| 项 | 值 |
| --- | --- |
| BASE_SHA | `0e04ce2ee02ffc0cda1bef8855b79cee8ce1ace2` |
| 最终 HEAD | `144d4facb677b47c3be3f544ebdb60463a298bd2` |
| 最终 tree | `47b60b050aa55dec3752956d2e3c777fdae3cbf2` |
| build-guard HEAD | 同上（wechat-release / web-test 均在此 SHA） |

主要提交：

| SHA | tree | 说明 |
| --- | --- | --- |
| `1959e102b2f0d2d30d2b66eaec176f59d2bc17ce` | `2824d952772a72493a2a70f1055c5834c6a7333b` | v2.3 资产 + JSON 2.2 接缝 + 远景卡 + 方案 B 海面 |
| `aab323a9292d4ef1220d2aa42600de7e6b217876` | `64b1de6d6a20be5c23b2652b9bbeeab7e8a8dcc0` | Creator 导入 meta（meshopt quantize） |
| `95d35e955a8018d30dce0d6eb1c3b07063faac0d` | `10b92861aec5bcd5c27c2eb05590c64cb1eb67bf` | 云/卡/海世界变换 + 穹顶 depthTest |
| `eb55954abedba1534a2b5a065395b397c6cb9648` | `0fa78bca35a31ce7cc57b3211a0c1ffc7f021cf9` | 关阴影 / 裁城装饰降 DC |
| `94038b6b6af9918ba332902862f1dcfd0fe76373` | `9a1599c9c17c29418fdc3f6198462ffa159c8fbb` | 场景阴影关闭 + 浮岛延后 |
| `144d4facb677b47c3be3f544ebdb60463a298bd2` | `47b60b050aa55dec3752956d2e3c777fdae3cbf2` | 城开启后关掉远景云卡，城帧 DC≤53 |

未 push；未碰 `main`；冻结文件未改。

## 测试

Node 22，`QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript`：

- `run-suite.cjs`：**98/99 PASS**，唯一非 PASS = `navigation-guard: BLOCKED_BROWSER`（与 balloon-art 基线一致）。
- `test_frame_background.cjs`：5054 帧 PASS。
  - `seamLeak = 0`
  - `seamCamErr ≈ 7.1e-5` m（气球局部相机相对位姿）
  - `minClearCam ≈ 11.05`，`minClear ≈ 12.37`
  - `build05S = 36`，accel 1.51，climb 24°
  - 远景卡与草地不同时出现；`farHits > 0`
  - 交接：`HANDOFF_COVER_T = 35.9`，`handoffFade = 1`（满屏 fade 遮挡海面恢复）

跑完已 `git checkout -- tools/journey-integration/reports output`。

## 接缝与坐标系

以 JSON `seam.*` 为准（删掉上一轮自算 `seamMap` 驱动路径）：

| 名 | yawDeg | translation |
| --- | --- | --- |
| Mw | 180 | (−1.3135, −1.163494, 52.4814) |
| Cw（城，未动） | 241.165081 | (59.06373, 18.818369, 117.212135) |
| P | 75.747026 | (−100.070307, −49.291631, 61.731203) |
| S | 255.747026 | (−49.527771, −48.128136, 75.925381) |

- `t < 11.4`：meadow 键 × Mw；`t ≥ 11.4`：world 键直用；不跨接缝插值。
- 气球 yaw：meadow 段 = `Mw.yaw + key.yaw`，保证接缝相对位姿连续。
- 着陆 S0 = (18.0900, 18.7084, 100.8184)。

## 海面方案

**方案 B**（理由：`ShoreBreak` 每帧 `setPosition` 改写 `env_sea_surface`，方案 A 的 S×6 瞬移无法保持；水面 UV 也不适合 ×6）。

- 11.2 s：隐藏游戏海面 + 泡沫/浪线；显示 `transit_sea_fallback`（随云同一刚体）。
- 交接 35.9 s：满屏 fade（alpha=1）下恢复游戏海面、隐藏备选海面。
- 证据：`handoff_before/restore/after.png`；frame-background 断言 restore 帧 fade=1；运行时 `__QF_BALLOON_HANDOFF.fade===1`。

## 光照渐变

10.7→11.4 s Main Light yaw +104.253°，接缝帧恢复。抽帧 `light_10_7/11_0/11_3/11_4.png`：云内明暗可接受，未见明显闪变；采用完整窗口渐变（未缩短）。

## 隐藏节点

自 11.2 至交接：`env_cloud_layer`、`env_sea_foam`、`env_sea_surf_foam_v22`、`env_sea_wave_line_01_v22`、`env_sea_wave_line_02_v22`、`env_lighthouse_ext`、`env_lighthouse_door`、`env_island_main`、`env_island_props_merged`、棕榈三株、`env_rear_window_palm`；方案 B 另藏 `env_sea_surface`。夜间全程藏 `env_sky_moon_night_v22`、`env_sky_moon_halo_night_v22`。城内 ALWAYS_HIDDEN / 浮岛规则按 JSON。

## 穹顶

`env_sky_dome` / `transit_night_dome`：priority −100，depthWrite=false，depthTest=LEQUAL，跟相机位置；同时仅一层；`meadow_sky_dome` 始终关；夜间云 emissive=0；`__QF_BALLOON_HOLD_SKY` 跳过 WorldFlow 夜穹混写。

## 包体

| 包 | 字节 |
| --- | --- |
| wechat-release（HEAD `144d4fa`） | **19,932,755** |
| 相对 r4 19,335,755 | **+596,999** |
| 相对 balloon-art 19,876,558 | **+56,197** |
| web-test | 20,721,438 |
| `region_transit_balloon` | **519,891**（≤ 1 MiB） |

分包压缩：glTF meta `meshCompress.enable/compress/quantize/encode=true`。夜空贴图仍为内嵌 PNG。逐文件见 `tools/build-guard/logs/wechat-release.144d4fa.try1.log`。

## 性能

| 时刻 | t | DC（最终） | 备注 |
| --- | --- | --- | --- |
| 上篮 | 0.9 | ~33 | |
| 离地 | 5.2 | ~36 | 近云已关，球囊无挡 |
| 穿云 | 11.4 | ~19 | 球囊+女孩+满屏云可见 |
| 巡航 | 18.5 | ~20 | |
| 看见城 | 24.0 | **52**（≤53） | 前轮 67–70 → 关阴影+裁城饰+远云 |
| 降落 | 33.6 | ~46 | |
| 夜景 | 24.0 | ~48 | 远景卡夜间压暗 |

三角面（自有+女孩+备选海）：40,994 ≤ 45k。时长 36 s ≤ 38.9。

## 改写的旧断言

- `FLIGHT_FORMAT` → `r5-balloon-flightpath/2.2`；`SEAM_T=11.4`
- `asset-stats.json`：加入 far card / sea fallback；云 tris 14880；`totalTris` 含女孩
- `test_frame_background`：云用 P 刚体；远景卡；接缝相对位姿；交接 fade；气球双面
- 删除运行时对自算 `placeClouds(seamMap)` 的依赖

## 截图

路径：`docs/r5/balloon-v22/shots/`（副本在任务包 `shots/`）。对比图无翻转（sips→BMP 自底向上解码）。

| 文件 | 说明 |
| --- | --- |
| `01_board.png` | 上篮，球囊+篮+女孩 |
| `02_liftoff.png` | 离地，无挡球囊的近云 |
| `03_clouds.png` | 穿云，球囊+女孩在云中（修 balloon-art 空天空） |
| `04_cruise.png` | 巡航云海 |
| `05_city.png` | 看见城，DC 52 |
| `06_land.png` | 降落 |
| `07_night.png` | 夜景，远景卡已压暗 |
| `*_vs_render.png` / `contact_vs_render_v2_3.png` | 与 v2.3 渲染左右对比 |
| `handoff_*` / `light_*` | 交接 fade 与光照抽帧 |

## 冲突面

可能与 sail-art / region-nodes 冲突：`SharedBundles.ts`、`RegionLoader.ts`、`WorldFlowComponent.ts`、`BalloonTransit.ts`、`region_transit_balloon/*`。

## 开放问题

- 城帧 DC 52，余量小；若再加装饰需继续合批。
- 04 云隙远景卡在实机对比上偏弱（美术读距 ~805 m）；卡片 21 s 后为省 DC 关闭。
- 方案 B 海面无波纹动画（远看可接受）。
- headless rAF 仍非稳定 60。

## 磁盘

结束时家目录约 **5.5+ GiB** 可用（构建后已清 library/temp；交付前再清 build）。
