# 帆船转场 K2 构图 + K7 夜景（sail-k2k7）

只修 GBT 仍不合格的两项：K2 船被右缘裁切、没有尾迹；K7 帆像发光纸片、390 宽看不见星星、海面近黑。K1、K3–K6、meadow_arrival 的机位与玩法相机、节点、时长未改。没有 push。

## 提交

父提交 `cd928efb`（sail-dock-path 末端）。构建用的代码 HEAD 是 `9462813623824d43ac4a55f05d42ce3682465448`（tree `38920a0f9140d34c44bd325479305f4fa6c7c474`）。

| SHA | 说明 |
|---|---|
| `e201c6aaa2d39f6aa60b807a44ac0a5091d387f8` | K2 机位入画；K7 夜色、小星点、夜海提亮；`sail-k2k7` 断言 |
| `4ea4e8a9a352de93ed8013d4404a88ceac84270e` | 构建前 STATUS |
| `5b4624a41f9ea9587ce6d35a5f3c4372f3f66cf3` | 记录构建锁等待 |
| `9462813623824d43ac4a55f05d42ce3682465448` | 夜帆 tint 再压暗（截图用的代码） |
| 截图提交 | 见文末回填 |

## K2 怎么改的

上一轮写的 `back:-10.4 side:-5.8` 在 S-c 末帧确实生效，但竖屏水平视场只有约 25°，相机在船头右前方，船的右前角投到 ndc x 1.69–1.79（像素 x 超过 390），船头出画，尾迹被船身挡住。

现在 K2 为 `back:-11 side:-1 up:5.2 fov:52 look:-6`。S-c 在 u≥0.9 时保持这套机位，不再和 K1 混合。静帧取 S-c u=0.94（t=11.48 s），此时航速 3.15、帆已张开，尾迹 alpha 已起来。Node 断言：船包围盒 8 个角在 390×844 下 |ndc|≤0.92（实测最大 0.833，约 8% 边距），尾迹 6 个角入画。截图里船头船尾都在右下，女孩坐在船里，船后有白色泡沫尾迹，灯塔在后方。K1、K3–K6 的偏移常量没动。

## K7 怎么改的

- 帆是 unlit，夜色 tint `RGB(92,100,116)`（相对白天 `RGB(255,246,228)` 的亮度比 0.403）。贴图白 texel 会把它抬高，截图像素才是验收数：K3 帆区最亮 20% 平均亮度 220，K7 同窗口 106.4，比值 **0.484**（落在白天的 45–60%，也低于 65% 门限）。色相是灰蓝米白，蓝色螺旋还在。
- 星星 28 颗，放在天空带（屏幕 y 约 12–78），每颗约 4.9 像素，间距 ≥17 像素，不挡帆。像素检查数到 **28** 个亮点，尺寸 **3–5** 像素。旧的近场大菱形 `night_stars` 仍关闭。
- 夜海 `mainColor(150,185,220)`，清屏色 `(32,48,92)`，环境光 skyIllum 5200、太阳 20000。海面是可读的深蓝，波纹、草地、树、栈桥和小路都能分开，不是白天。K7 与 K3 共用远海机位，这张画面里没有风车；风车在 K4、K5 入河口时在画里。

## 像素检查

`node tools/transitions/check_sail_k2k7_pixels.cjs`：

`{"daySail":220,"nightSail":106.4,"ratio":0.484,"skyStars":28,"starPx":{"min":3,"max":5}}` PASS。

Node 投影：`sailLumaRatio` 0.403，K2 `maxNdc` 0.833，`wakeIn` 6，星星投影 4.9–4.97 px。

## 测试

Node 22 `run-suite.cjs`：**105** 项，**104 PASS**，唯一非 PASS 是 `navigation-guard: BLOCKED_BROWSER`（套件因此退出码 1）。`sail-k2k7`、`sail-dock-path`、`sail-art`、`sail-clearance`、`transport-sail` 均 PASS。

`test_frame_background.cjs` 0.1 s：**PASS**，**3458** 帧，最紧 **clearM = 2.441**（t=22.7，390×844，`meadow_terrain`）。

## 时长

| 段 | 秒数 | 门限 |
|---|---|---|
| 帆船段 `build05S` | **24.6 s** | ≤ 30.5 |
| 到达步行 `arrivalS` | **10.016 s**（12.02 m） | ≤ 12 |

节拍未改：S-a 7.6 / S-b 2.0 / S-c 2.0 / S-d 9.0 / S-e 2.2 / S-f 1.0 / S-g 0.8。

## 包体

build-guard both，HEAD `94628136`，exit 36，dirty=0。

| 项 | 字节 |
|---|---|
| wechat-release 总包 | **19,641,386** |
| 相对 19,640,423 | **+963** |
| `transport_sail` | **206,636** |
| web-test | 20,430,823 |

## 截图

`docs/r5/sail-k2k7/shots/`，并复制到任务包 `shots/`。每张 `sips -Z 900`，小于 400 KB。对比图左渲染、右游戏，上下未颠倒。

- `K1_board_pier.png`
- `K2_depart_lighthouse.png`
- `K2_depart_lighthouse_vs_render.png`
- `K3_open_sea.png`
- `K4_approach_mouth.png`
- `K5_enter_river.png`
- `K6_dock.png`
- `K6_dock_top.png`
- `K7_night_open_sea.png`
- `K7_night_open_sea_vs_render.png`
- `meadow_arrival.png`

重拍确认：K6 木栈桥接到小路，女孩在路上；K1、K3–K5 构图仍在；到达静帧栈桥和小路还在。

## 未完成

- K7 远海机位与 K3 相同，画面里没有渲染图左侧的风车。风车在 K4/K5。没有为了把它放进 K7 去改 K3 机位。
- K2 尾迹是船尾周围的白色泡沫，比渲染图那条长拖痕短；船、女孩和尾迹都在画框内。

## 剩余磁盘

清理 `creator-build-project` 的 library/temp/build 并释放构建锁之后，约 **5.19 GiB**（5,442,792 KiB）。
