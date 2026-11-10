# L6 湖畔棋盘镜头 v5

只改了 kit 开启时的 `portraitFusion.main`。`short` 和 b18 的 `portrait` 没动，气球镜头没动。

## 相机排查

真正画出湖畔棋盘的是租约自己的相机，不是世界里的 Main Camera。

`LakesideBoardBackground.ts` 在搭建棋盘时新建一台相机：透视、垂直 FOV、可见层是湖畔层、`priority` 44、清屏是纯色。棋盘每帧由 `frame()` 调用 `applyCameraPose(camera, lakesideAlignedBoardPose(layout), 'lakeside.board-background')` 写入位姿和 FOV。`applyCameraPose` 会把 `pose.fovVerticalDeg` 写进 `camera.fov`。

`lakesideAlignedBoardPose` → `lakesideAlignedLookAt` → `lakesidePortraitLens`。竖屏且 `lakesideKitAssetsEnabled()` 为真（`?qflakesidekit=1`）时，用的是 `portraitFusion.main`，否则用 b18 的 `portrait`。所以调 `portraitFusion.main` 就是在调这台在画的相机。Mac 实拍里树冠以上约 5.6%，和 v4 离线的 5.4% 对得上，构建产物里也有这组 `[0,15.7,28.35]→[0,1.616,1.862]`、FOV 55。

关卡状态日志里的 fov 46、俯角 −9.9° 不是这台相机。`tools/wx-autoplay/qf-autoplay.js` 的 `snapshot()` 把场景里已启用、且不是 UI 层的相机按 `priority` 从低到高排序，只记下第一台。Main Camera 在 `WorldR5Integration.scene` 里是 `priority` 0、场景默认 FOV 45。棋盘相机是 44，所以探针读到的是世界相机。

46° 写在世界跟随镜头上：`SkyLakePreWalk.ts` 的 `SKY_PRE_FOLLOW.fovDeg` 和 `BasketCloseShot.ts` 的 `BASKET_CLOSE.fovDeg` 都是 46。世界相机的 `setCamera` 只有在 `__QF_BALLOON_LENS` 打开时才采用姿态里的 FOV，否则沿用相机当前 FOV。−9.9° 靠近两条世界视线：kit 关闭时的观光 `portrait`（`[2,6,33]→[0.5,0.7,2]`）大约 −9.7°，天空城走到湖畔的跟随镜头大约 −9.5°。都不是棋盘上的 −28°。

## v5 构图

`portraitFusion.main`：`[0, 12.75, 22.75] → [0, 1.427, 1.589]`，俯角 **−28.15°**，垂直 FOV **72.3°**。

俯角仍在 K9 的 −28°…−48° 里，取能多看见远山的那一端。近边格要 ≥ 48 px 之后，55° 只能把树冠留在屏顶大约 5%。要把 430×932 的树冠压到屏高 15%，垂直 FOV 至少要到 72° 附近。72.3° 是还能留下安全区余量的窄值。棋盘近边因此占屏宽 94.3%，比 v4 的 86.9% 更宽，没有按 5–8% 缩小。再缩小，360×780 的近边格会掉回 48 px 以下。

天空占比是屏顶到远岸树冠 `[0, 11.1, −57]`。离线场景没有认可图那块晚霞天空球。多出来的是 `LK_far_hills` 的山层，顶上一条是白天清屏色。底边射线落在 z 16.6 的开阔水面，不到 z ≳ 19 的深色泡沫。

| 尺寸 | 天空 | 棋盘宽度 | K9 近边格 | 盘底到安全区 |
| --- | ---: | ---: | ---: | ---: |
| 360×780 | 15.22% | 94.3% | 48.48 px | 4.5 px |
| 390×844 | 15.18% | 94.3% | 52.52 px | 7.3 px |
| 402×874 | 15.34% | 94.3% | 54.13 px | 10.5 px |
| 430×932 | 15.23% | 94.3% | 57.90 px | 12.2 px |

49 格四角都在顶 47 / 底 34 的安全区内。盘顶在屏高 0.657，信息牌底在它上方大约 357–456 px。K9 下限从 44 调到 48。`short` 屏 375×667 / 390×520 仍是原来的镜头，近边格 62.6 / 48.8 px。

## 棋盘外观

格子是场景里的 `LK_wb_line.glb`，16 条，写在 `scene_r5h_slim_transforms.json`。这条分支上的缩放是 `[1, 1, 0.4]`，线很细，看起来是淡的圆角线框。

kit 打开后，`BoardKit.ts` 的 `LAKESIDE_KIT` 把 2D 托盘、格和棋子都藏掉，`BoardProjection.ts` 只用这台棋盘相机做投影。UI 侧最近的改动是 `8d317527`、`43443b09`、`457b359c`、`a77f1a6c`，管的是 kit 开关和实例显隐，没有改线宽或材质。

清晰的浅蓝发光格在 `scene/lakeside-board-fusion` 的 `ff0d9c55`。那一笔把线从 0.0144 m 加到 0.0576 m（实例缩放从 0.4 收到约 1.6），并给 `LK_wb_line` 加了 `line` 自发光填色。它不在本分支的历史上。这次没有改材质，也没有改网格。

## 图

并排三列：v4、v5、认可图。镜头和模型是游戏里的 `portraitFusion` 与 `region_lakeside` 实例。

- `compare-390x844.png`
- `compare-430x932.png`

## 测试

`test-lakeside-camera.cjs` 13 项通过，K9 近边格下限是 ≥ 48 px，最小是 360×780 的 48.5 px。`test_meta_gates.cjs` 26 项通过。`test_build_guard.sh` 19 项通过。
