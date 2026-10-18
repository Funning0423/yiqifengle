# 热气球美术 v2.1 接入报告

## 提交

| SHA | tree | 说明 |
| --- | --- | --- |
| `5702182b21237965422d60f446115cd6b2826b9c` | `de7d5190c6f1f139a993ca60aae68b3902a41000` | 用 GGbot v2.1 替换程序化气球，接缝不搬城 |
| `634d305bf04a24563a4c3380691aac2ec1a733fb` | `b6ce6be101c9f4c24a2b975d57a508d3e699df17` | 截图脚本与 STATUS |
| `be8c566a71b412659faaec1abcd5d0cf99a70dc6` | `255ae135308a2286d30daf1e06a9e92d3c6ad414` | Creator 导入后的 glTF meta（meshopt + quantize + encode） |
| `a9fb03fba6fe10fefe9216e1e3fc73e49f46f612` | `3f4ec15a65572f885ed4a91428378542e1a0a3ed` | 绘制前重写镜头，并放入 7 张截图 |

基线仍是 balloon-fix `1de44e68bb0ba5ba446bb454692c2f9e21c141a3`。没有 push。

## 测试

Node 22.23.3，`QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript`：

`npx -y node@22 tools/journey-integration/run-suite.cjs`

98/99 PASS。唯一非 PASS 是 `navigation-guard: BLOCKED_BROWSER`。跑完后 `git checkout -- tools/journey-integration/reports output`。

`tools/transitions/test_frame_background.cjs`：5054 帧（0.1 s × 7 屏 × 昼夜，B-b 到 B-g），PASS。

- 最紧相机净空 `minClearCam` 10.88 m，航迹净空 `minClear` 12.37 m
- `seamLeak = 0`：11.0–12.0 s 没有任何射线打到草地或天空之城
- 时长 `build05S = 36`（≤ 38.9），加速度 1.51（局部路径，避开接缝跳变），斜线爬升 24°
- 桥基线石基最低点 −9.63，仍在草地高度，证明没有把城抬起来

## 接缝

不使用 `balloonSkyOffset` 搬城。草地坐标系用到 11.2 s（卸载/隐藏草地），11.6 s 启用游戏里现有的 `env_skycity`（彩虹桥布局：yaw 241.1650813°，原点 `(59.0637, 18.8184, 117.2121)`）。

美术城：`world = Ry(165.4181°) · local + (−14.5938, 68.11, 167.8952)`。把美术草地局部点 P 变到游戏城：

`local = Ry(−165.4181°) · (P − artOrigin)`
`P_game = Ry(241.1650813°) · local + gameOrigin`

云根在 11.6 s 之后的刚体：yaw = 75.7469813°，原点 `(−100.0703, −49.2916, 61.7310)`。JSON 的 S0 落到游戏世界 `(18.0900, 18.7084, 100.8184)`，就是现有 S0。

`art/glb/` 里没有更新的路径文件，也没有 `far_meadow_card.glb`。代码里留了空节点 `far_meadow_card`，预制体出现才会挂上。

## 包体

build-guard（HEAD `be8c566`）wechat-release **19,876,558 B**。相对 r4 的 19,335,755 B 多 **540,803 B**。低于 24,641,536 B。

`region_transit_balloon` **470,111 B**（0.45 MiB，上限 1.0 MiB）。网格 meta：`meshCompress.enable/compress/quantize/encode = true`（meshopt 量化）。夜空穹顶源 glb 里的 PNG 已是 8-bit RGB（color type 2，2048×1024，108,835 B），Creator 原样带出，没有改成 JPEG。

分包逐文件（wechat-release `subpackages/region_transit_balloon`）见构建日志 `tools/build-guard/logs/wechat-release.be8c566.try1.log`。最大块是夜空贴图 108,835 B 和云网格若干 `.bin`（合计约 212 KB）。`game.js` 644 B，`config.json` 2,838 B。

web-test 20,665,142 B。构建后已删除 `library` / `temp` / `build`。

之后为了让镜头在绘制前再写一次，改过 `BalloonTransit.ts`。这次改动**没有**重新跑 build-guard，上面的字节数是 `be8c566` 的包。

## 性能

截图页里读 `device.numDrawCalls`，并用 1 秒 `requestAnimationFrame` 计数。headless Chromium，390×844。

| 时刻 | t | DC | 该次飞行 dcWorst | rAF |
| --- | --- | --- | --- | --- |
| 上篮 | 0.93 | 39 | 39 | 24 |
| 离地 | 5.22 | 42 | 45 | 20 |
| 穿云 | 11.40 | 25 | 42 | 35 |
| 巡航 | 18.54 | 27 | 45 | 42 |
| 看见城 | 24.07 | 67 | 70（t≈22.83） | 16 |
| 降落 | 33.61 | 48 | 61 | 19 |
| 夜景 | 24.00 | 58 | 58 | 17 |

城进入画面后 DC 超过 53。最坏是看见天空之城前后，约 70。headless 的 rAF 没有稳定在 60。

## 改过的旧断言

`tools/journey-integration/test-transport-balloon.cjs`：

- `totalTris <= 8500` 改为 v2.1：`format`、球囊 1085 三角面、合计 `<= 45000`（实测 18345）
- `holeM >= 8` 改为 `instancing === false`（merged 云，不进 `EXT_mesh_gpu_instancing`）
- 增加：旧目录 `transport_balloon` 不存在
- `build05S`、加速度、爬升、`JOURNEY_TRANSPORT`、`strataClearsGround(plan.origin[1], -28.449, 7.459)` 原文未改。默认城架仍是美术高位，这条几何门继续通过

`tools/transitions/test_frame_background.cjs`：场景改成真实 glb 和游戏城架。数值门限没放宽（净空 ≥ 0.6、背面 ≤ 0.01、voids = 0、底面 < 0.10、穹顶 ≤ 1、地平线缺口 = 0、下沉 = 0）。草地卡片、绳索、藤蔓按双面片计，不把卡片背面当成穿模。地平线由正在使用的那一个天空穹顶补上，不再用旧的 R=150 程序化卡片圆柱。

`tools/skycity/test_shared_effects.cjs` 的依赖列表补上已经在源码里的 `region_lakeside` 和新的 `region_transit_balloon`。这个测试不在 journey 套件里。

`make_balloon_assets.cjs` 启动即退出，不再往 bundle 写程序化 glb。

## 截图

390×844，hasTouch，web-test 真实世界，`?balloonPreview=1&balloonNight=&balloonAt=`。已 `sips -Z`，单张 < 400 KB。副本在任务包 `shots/`。

| 文件 | 说明 |
| --- | --- |
| `r5_balloon_01_board.png` | t=0.9，风车旁，球囊+篮子+女孩可见。对比 `r5_balloon_01_board_vs_render.png` |
| `r5_balloon_02_liftoff.png` | t=5.2，离地，气球和女孩可见。对比 `r5_balloon_02_liftoff_vs_render.png` |
| `r5_balloon_03_clouds.png` | t=11.4，草地和城都已关掉，画面几乎是天空渐变加一角云，**看不到气球**。对比 `r5_balloon_03_clouds_vs_render.png`。这一张不合格 |
| `r5_balloon_04_cruise.png` | t=18.5，气球和女孩在云/海面上。对比 `r5_balloon_04_cruise_vs_render.png` |
| `r5_balloon_05_city.png` | t=24，看见天空之城，气球在画面下方，女孩在篮里。对比 `r5_balloon_05_city_vs_render.png` |
| `r5_balloon_06_land.png` | t=33.6，城上，气球和女孩可见。对比 `r5_balloon_06_land_vs_render.png` |
| `r5_balloon_07_night.png` | t=24 夜间，城和气球可见。对比 `r5_balloon_07_night_vs_render.png` |

## 可能冲突的文件

`SharedBundles.ts`、`RegionLoader.ts`、`WorldFlowComponent.ts`、`WorldNativeComposition.ts`、`assets/bundles/region_transit_balloon*`。帆船分支如果也改 `SharedBundles` / `WorldFlowComponent` 会撞上。

## 未完成

- 11.4 s 穿云镜头在真实包里看不到完整气球。几何测试里接缝没有露出草地或城，但截图没有满屏云，也没有气球。
- 看见城时 DC 约 67–70，高于 53。
- headless 帧率不是 60。
- `far_meadow_card.glb` 还没到。
- 绘制前补镜头的改动还没进一次新的 build-guard。

结束时家目录剩余约 6.3 GiB。
