# r5-build09

分支 `gbt/r5-integrated-b09`，未 push。构建 HEAD `31a4c011d68f01ec28da4717573b1251c7728352`。

## 合入

三条 build09 在 `a4d1f1ec`，当时工作树干净，没有重复合。

- `718e7764` 场景 BGM 切换 `5b62eba2`
- `a065e181` 环境音层 `b80000be`
- `a4d1f1ec` 天空城 GLB 清理 `77d5950b`（`env_skycity.glb` sha `c2e608d0`）
- `f531e86b` 房间镜头 r10 `6e18f6ca`。FreeOrbit 房间部分以 r10 为准；草甸 pitch floor（`065a8b5f`）和其它场景保持 `vel * dt`。home 对 `6e18f6ca` 0 变化，岛/天空城/湖/棋盘对 `6eafc35f` 0 变化。
- `31a4c01` 文本清单记下合并后的 FreeOrbit.ts（54520 B，sha256 `1c74bbb402cf…`）

## 测试与包

r10 曲率、取景、运动、free-orbit、keepinside、meadow-pitchfloor 均 PASS。

套件 139 项，138 PASS，唯一非通过是 navigation-guard `BLOCKED_BROWSER`。`test_scene_bgm_switch` 47 PASS。`test_manifests` PASS。ES5 iterator-spread 与 es5-safety PASS。

补丁 `already-installed`。build-guard both 第一次通过。没有「初始场景不存在」，构建后 git 无变化。wechat-release **22,626,221 B**（上限 24,641,536，余 2,015,315；比 build08 的 22,604,401 多 21,820）。web-test 23,444,957 B（比 build08 的 23,423,150 多 21,807）。DC 未测。

构建前 Avail 3.9Gi。完成后 Avail 2.8Gi，没有再构建，没有删文件。锁已释放。stage 在 `~/cursor-tasks/r5-build09/stage/`。

## Cocos 检查（390×844 无头，白天）

截图在 `docs/r5/build09/shots/`，任务夹 `shots/` 同名。pageerror 0。两张交付图都是白天：`mode=day`，`lightScale=1`，`skyNightBlend=0`，夜间渲染关闭。Main Light 照度 125000，环境 skyIllum 20000。

1. 草原：玩家跟随镜头，节点 M6 本地 [0.2, 6.505, -25.6]，yaw 1.6，距角色 7.8 m。画面是草地、栅栏、花和海。`01_meadow.png`，亮度均值 142.6。
2. 天空城南边：玩家跟随镜头，节点 S6 本地 [0.2, 0.032, -27.8]，yaw 1.2，距角色 7.8 m，前方 80 m 无遮挡。画面是亮的草地、草丛、花、远处水面和天。`02_skycity_south.png`，亮度均值 137.6。亮的植被在这张里。
3. 从这只南边镜头再往前，以及更低的机位，看到的是南侧岩层的暗面（亮度均值 35–50）。任务夹里的 `03_*` 是这些暗面。

环境音来自运行中的 bed，日志在任务夹 `shots/audio-switch.log`，仓库副本 `docs/r5/build09/shots/audio-switch.txt`。小岛 gulls、waves、wind。草原 birds、insects，gulls 为 false。天空城 highWind，无海鸥、无鸟。

## 桌面与遗留

已备份到 `~/cursor-tasks/r5-build09/build-backup/`，并原地更新 `~/Desktop/QIFENGLE-test-build05`。README 第一行是 build09 整合版（版本 31a4c01，r5）。`web/start.command` 可执行。微信 AppID `wx3bdd911c5c06f591`。`hashes.txt` 1714 行。桌面微信目录加上本地 project 配置后为 22,627,585 B，仍低于上限。

skycity-cam-c3 没有合入。湖畔仍走不到。坐姿、热气球、帆船本轮没有重拍。本仓库 library、temp、build 已清。
