# r5-build10

分支 `gbt/r5-integrated-b10`，未 push。构建 HEAD `8fe16bfa51263186eab52d1b8049b8e3bc94cae2`。

## 合入

从 `gbt/r5-integrated-b09`（958261f9，报告 d6eadbab，代码 31a4c01）拉出。合入 `fx/r5-skycity-color` `6f4a947a`，merge `39ff93d9`。清单自动合并，没有冲突。`env_skycity.glb` 1,146,132 B，sha256 `cf09e13183802d37afa7e4cad8f4225bc162f338804a275cecf698068c1e8f61`。COLOR_0 全部是 UINT8，写在 Draco 里。

## 远云

飞行段仍藏 `env_sky_cloudsea` 和 `env_sky_cumulus_far`（云墙会挡住飞行镜头）。到达后 `skyNodeAfterArrival` 打开这两层。`env_sky_cloud_small` 和 `state_*` 仍隐藏。`test_sky_arrival` 断言到达后这两项为开。

## 测试与包

套件 139 项，138 PASS，唯一非通过是 navigation-guard `BLOCKED_BROWSER`。`test_scene_bgm_switch`、`test_manifests`、热气球与 sky-arrival、ES5 iterator-spread 与 es5-safety 均 PASS。补丁 `already-installed`。build-guard both 第一次通过。没有「初始场景不存在」，构建后 git 无变化。wechat-release **22,579,882 B**（上限 24,641,536，余 2,061,654；比 build09 的 22,626,221 少 46,339）。web-test 23,398,621 B（比 build09 的 23,444,957 少 46,336）。天空棋盘 DC 59（≤ 64，20 次采样都是 59）。三张交付图的场景 DC 是 24、27、25。

构建前 Avail 4.5Gi。锁已释放。stage 在 `~/cursor-tasks/r5-build10/stage/`。没有删文件。

## Cocos 检查（390×844 无头，白天，光照倍率 1）

截图在 `docs/r5/build10/shots/`，任务夹 `shots/` 同名。pageerror 0。三张都是白天：`mode=day`，`lightScale=1`，`skyNightBlend=0`。Main Light 125000，环境 skyIllum 20000。三张当时都在播 `idle_breathing_loop`，没有蹲或坐的动作。草原那张从斜上方看，膝盖和裙摆让她看着像蹲在地上。

1. 草原：节点 M1 本地 [2.6, 2.203, 11.6]，脚 [-4.3, 0.853, 67.5]，镜头 [0.272, 4.043, 72.949]，yaw 40，pitch 16，距 7.4 m。画面是海、路、草和云，右边没有大木桩。`01_meadow.png`。DC 24。
2. 天空城南边：节点 S6 本地 [0.2, 0.032, -27.8]，脚 [82.93, 18.66, 157.41]，镜头 [92.84, 21.31, 157.41]，yaw 90，pitch 8，距 10 m。`env_sky_cloudsea` 和 `env_sky_cumulus_far` 都开着，`cloud_small` 关着。画面是一朵有棱面的白云，轮廓在蓝天上，像云，不是一堵平的暗灰墙。下缘有一小块岩石，没有挡住云。`02_skycity_south.png`。DC 27。贴着云底看会更像一块白顶，铺满画面的白球更像墙，那两张没有采用。
3. 天空城植被：节点 S3 本地 [6.2, -0.013, 8.2]，脚 [48.50, 18.62, 145.31]，镜头 [43.11, 22.92, 143.34]，yaw 250，pitch 28，距 6.5 m。画面中部是飘着的草地和花，紫、黄、白、绿都有，不是一片平绿，也不是暗色。`03_skycity_foliage.png`。DC 25。

## 桌面

已备份到 `~/cursor-tasks/r5-build10/build-backup/`，并原地更新 `~/Desktop/QIFENGLE-test-build05`。README 第一行是 build10 整合版（版本 8fe16bf，r5）。`web/start.command` 可执行。微信 AppID `wx3bdd911c5c06f591`。`hashes.txt` 1714 行。桌面微信目录加上本地 project 配置后为 22,581,246 B，仍低于上限。

skycity-cam-c3 没有合入。湖畔仍走不到。坐姿、热气球、帆船本轮没有重拍。本仓库 library、temp、build 已清。
