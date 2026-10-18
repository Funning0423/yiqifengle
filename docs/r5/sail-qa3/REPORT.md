# r5-sail-qa3 帆船转场（岛 → 草原）

时间：2026-10-19 00:20 CST。分支 `gbt/r5-sail-qa3`，起点 `94c3f8e3`。白天 / 夜间都用真实旅程 `?sailqa=1` 逐帧采集（15 fps，上船前到地图机位稳住后再留约 2 秒）。

## 1. 岛远景里她还站着

qa2 在 11.27 s 把人画成直立站在舱中间，但 CSV 的 `riderPose` 仍是 sit：关节节点是坐姿，烘焙蒙皮在 `stop()` 之后退回绑定姿势（站立）。本轮不再 `stop()`，每帧在绘制前把 `sit_hold` 采样到当前关节，并关掉烘焙蒙皮。远景仍可能画绑定姿势，所以开船后把当时的蒙皮结果烘焙成静态网格来画，上岸前再交回骨骼。

新断言看的是画出来的人：把头、脚投影和裙摆色块对齐，岛远景（已离岸、fov≥51、S-c/S-d）必须是 sit。帆挡住她的 12.2 s 之后那一帧不判站立失败。白天这条镜头 68 帧 sit、1 帧落在帆遮挡窗；夜间关节全程 sit。对照条带 `compare_11s_girl_day.jpg` / `compare_11s_girl_night.jpg` 是 11.3 s 船身放大，左 qa2、右 qa3。

## 2. 靠岸穿模和方形草皮

方形浅绿块是 `transit_river_mouth` 的水线盖（`rm_bank_*` 在局部 y≈0.02 的一整块平顶，芦苇插在上面）。只改顶点时画面不变，于是整段河口预制沉到海面下，岸线用草原自己的岸。靠岸机位收到航道里（K4/K5/K6 侧向约 1.05 / 0.92 / 0.85），镜头不再扎进左岸。

白天 20 s 帧里，不与画面顶部草地相连的大块绿色已经没有；21.5 s 左缘从画面 55% 高度到底部的绿色像素为 0。夜间同一左缘也是 0。`terrainL` / `terrainR` 在 S-d/S-e 全程为 0（镜头左右 0.28 m、前方 0.45 m 的地形包围盒）。对照：`compare_20s_square_day.jpg`、`compare_21s_left_day.jpg`、`compare_21s_left_night.jpg`。

## 3. 走上草原后的硬切

到达段后一半用平滑把跟拍镜头收到地图机位；`u=1` 时与地图机位重合，并在旅程里再停 2 秒。白天 CSV：到达相机高度从约 4.5 m 连续升到 17.65 m（约 9.4 s→16 s），全程 `cameraCut=0`，最后 2 秒高度保持 17.65。qa2 在片内 43.33 s 还是身后近景、43.40 s 才跳到风车全景；qa3 这两帧都已经是地图全景。对照：`compare_43s_meadow_day.jpg`、`compare_43s_meadow_next_day.jpg`、`compare_43s_meadow_night.jpg`。

## 保留的 qa1 / qa2

坐稳才开船；航行中挂在 `seated_root_anchor`；舱内海水 0；flicker 0；步速约 1.2 m/s；夜间分级；音频顺序未改；10.6–11.2 s 转镜头仍是原来的弧线；矩形木板断言仍在。白天像素：waterMax 0，clearMax 0.0003，plank 全 0。夜间 waterMax 0，clearMax 0.0025，flicker 0。

## 套件和包体

正式套件 122 项里 121 项 PASS，只有 `navigation-guard` 是 `BLOCKED_BROWSER`。带守卫的 wechat 包 20,283,791 字节（上限 24,641,536）。`transport_sail` 子包 206,639 字节。构建后已删掉 `library`、`temp`、`build`，锁已释放。

## 断言

`tools/transitions/test_sail_continuity.cjs` 保留 qa1、qa2，并要求白天和夜间的 `docs/r5/sail-qa3/metrics_after.csv`、`metrics_after-night.csv` 都通过上面三条。离线镜头步长：航道 0.972 m，到达 0.176 m，地图混合 0.283 m。
