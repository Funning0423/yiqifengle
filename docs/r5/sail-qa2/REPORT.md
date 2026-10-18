# 帆船转场第二轮（岛 → 草原）

2026-10-18 21:18 CST。分支 `gbt/r5-sail-qa2`，从 qa1 终点 `1c54826a` 拉出。没有 push。

qa1 的成果都还在：人坐稳船才开，航行中挂在 `seated_root_anchor`，舱内海水 0，亮度闪烁 0，上船和到岸步速约 1.2 m/s，夜间到岸不闪回白天，音频顺序没变，到岸步行仍按 1.2 m/s（约 16.5 s，没有为了 12 s 加快）。

## 修了什么

1. **坐下后又站起来。** `sit_hold` 接上之后关节会被采样回站立。`depart()` 在她刚坐下时拍下全身局部姿势，之后每帧在 `Director.EVENT_BEFORE_DRAW` 写回去，直到靠岸 `releaseRider()`。白天和夜间 CSV 里，出发后到起身前 `riderPose` 全是 `sit`（各 395 帧）。

2. **帆挡住人。** 船尾机位从船的中线后方改到左舷侧前方，船头切到这个机位时绕左舷走，不穿帆。航行中有截图的帧，女孩像素都大于 0（白天最低 504，夜间最低 199）。

3. **切镜头错一帧，以及到岸硬切。** 机位混合改成绕船体的弧，不再从船身上插过去。靠岸跟拍的朝向每帧最多转 2.5°。离线采样整段航行，相邻帧相机位移最大 0.972 m；到岸步行最大 0.237 m。白天和夜间 CSV 的 `cameraCut` 都是 0，错位单帧 0。

4. **靠岸绿面穿镜头。** 靠岸机位改到左舷并抬高。离相机 1.3 m 以内的芦苇、花、灌木会临时关掉，地形不关。CSV 里 `shoreNear` 全是 0。

5. **矩形木板。** 原因有两处。`Quat.fromEuler` 是 YZX，原来把 ±4° 横摇填在 X 上，船尾会抬高约 0.15 m，舱底就沉进海里，qa1 才加了一块直边盒子。现在改成 `fromEuler(0, yaw, roll)`，绕船的长轴滚。盒子（两侧墙、尾墙、伸过 z=1.26 的部分）删掉，换成 y=0.12 的船内轮廓条带，24 个顶点都在内壁 1 mm 以内。同一帧 sole 开/关对比：侧面、船尾、四分之三各 2 帧，白天和夜间伸出船体的像素都是 0。舱内海水白天、夜间都是 0（阈值 0.005）。

## 数字

| 项 | 白天 | 夜间 |
|---|---|---|
| 航行中坐姿 | 395/395 sit | 395/395 sit |
| 女孩像素为 0 的航行截图 | 0 | 0 |
| cameraCut | 0 | 0 |
| 舱内海水最大 | 0 | 0 |
| 亮度闪烁格 | 0 | 0 |
| 底板伸出像素 | 0, 0, 0, 0, 0, 0 | 0, 0, 0, 0, 0, 0 |
| shoreNear | 0 | 0 |

`test_sail_continuity`：`soleVerts` 24，航行相机步长 0.972 m，到岸 0.237 m。`test_sail_k2k7` 通过（K2 仍框住整艘船，K7 星星大小没变）。

音频顺序（白天采集）：`node-walk-start`、`sail-board`、`sail-unfurl`、`sail-cruise-loop-start`、`sail-dock` 与 `sail-cruise-loop-stop`、`node-arrive`。

## 自查

白天、夜间各 672 张（约 0.067 s 一张，覆盖每 0.25 s）。逐帧看了坐姿、女孩像素、海水、跳切和岸边距离。12.3 s 前后船头机位里人只露出一部分，像素仍大于 0，没有再被帆整个人挡住。21 s 靠岸绿坡在画面右侧，没有贴进镜头。没有新的背景缺口或亮度来回闪。

条带文字用华文黑体（`/System/Library/Fonts/STHeiti Medium.ttc`）。这台机器上的 PingFang.ttc PIL 打不开。

## 文件

- `sail_day.mp4` 1.1 MB，`sail_night.mp4` 945 KB，各 44.8 s，15 fps。
- `compare_day.png` / `compare_night.png`：10.5、11.2、12.6、21.0、38.3 s，before qa1 / after qa2。
- `plank_before_after_day.png` / `plank_before_after_night.png`：2、15、21 s，左＝修前 / 右＝修后。
- `metrics_after.csv`、`metrics_after-night.csv`。

微信包字节在构建守卫通过后补在 STATUS。
