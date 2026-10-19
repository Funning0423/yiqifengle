# r5-build08

分支 `gbt/r5-integrated-b08`，未 push。基线 `0881f4f796df3face8f502787a7cc7e9b1dc2f59`。HEAD `ef40821824fc2ae39a2ec809774f9f99c67f702d`。

## 合入

r10、r10b、v26fix-r2、skycity-cam-c3：任务夹没有同时具备 REPORT.md 和 STATUS「交付完成」，已跳过。`test_balloon_continuity.cjs`、`test_finale_camera_path.cjs` 因此不在本树。

QUEUE 的 build08 条目已逐条 `--no-ff` 合入。fx 只用 r4 `805e5d6a` → r4b `e4517051` → r4c `44ba329b`。U1 `c604a5d5`，U2 `a3b04b06`，U3 覆盖三份 `first_screen_composite.jpg`（58016 B，sha256 前缀 `de0a96d5254655b1`）。未合 home-sign、windowB `37803050`、PR #59/#60/#61。`55ed0f16` 只随 U2 历史进入，按方案 A 接线。

角色 GLB 换成 A1，冻结清单只改这一项 sha256（`a96226da…ec37`）。`env_skycity.glb` 为 r4c 的 `02c4e3e6…`。草甸自由镜头距离保持 pitchfloor 的 14 m。fix1 到达顺序仍在：`arrived=true` 在最后一次 `paint(plan.total)` 之前，随后 `fadeCover(0,0)`。

## 测试

套件在 `509d85b1`：138 项，135 PASS，navigation-guard `BLOCKED_BROWSER`。当时失败：`exit-footsteps`（新 GLB 的 FootstepData；沙地脚步与 20 条出门包同目录）、`lakeside-quiet-logs`（日志已是 skycity→lakeside，取消仍不打印）。`ef408218` 之后这两项单独重跑 PASS。同一次套件里 `test_frame_background`、`test_sail_continuity`、sky-arrival（`{"lawn":4,"transitOff":7}`）、`test_lens_clearance` 为 PASS。套件报告已清出工作区，未提交。

## 构建

补丁 `already-installed`。构建前 Avail 4.4 GiB，持锁跑 `build-wechat-guarded.sh both`。wechat-release 三次都编出包（22585458 / 22585459 / 22585459 B，退出码 36），guard 因 12 个 git 变化拒绝并删掉产物、还原 .meta。还原后工作区干净，所以这 12 项是构建中改写的 meta。日志里 `shore-foam.effect` 报 `a_matWorld` 未声明。web-test 未开始。

构建结束后 `df -h ~` Avail **2.3 GiB**，低于 3.5 GiB，已停，未再构建。锁已释放。桌面 `QIFENGLE-test-build05` 未改。

可删候选（未删；`du -sk`）：

| 路径 | 大小 |
| --- | --- |
| `~/cursor-tasks/r5-skirt-v2-h1-compat` | 2169 MiB（其中 `.git/objects/pack/pack-19c684b2….pack` 逻辑 1.4 GiB） |
| `~/Library/Caches/ms-playwright` | 1101 MiB |
| `~/cursor-tasks/r5-skirt-v2-h1-preview` | 354 MiB |
| `~/cursor-tasks/r5-bgm-fix` | 288 MiB |
| `~/cursor-tasks/r5-skycity-clean` | 287 MiB |
| `~/cursor-tasks/r5-room-r9` | 287 MiB |
| `~/cursor-tasks/incoming` | 130 MiB |
| `~/cursor-tasks/r5-skirt-v2-h1-compat/repo/creator-build-project/library` | 61 MiB |
| `~/cursor-tasks/r5-skirt-v2-h1-compat/repo/creator-build-project/build` | 47 MiB |
| `~/cursor-tasks/r5-build07/stage` | 43 MiB |
| `~/cursor-tasks/r5-build06/build05-backup` | 41 MiB |

本仓库 `creator-build-project/library`、`temp`、`build` 已空。

## Cocos 检查

包已被 guard 删除，没有 web-test，下面四项都没有运行画面截图。

1. 岛上房间外壳从外面是否可见：未截图。房间轨道与外壳脚本已合入，缺浏览器画面。
2. 天空城南缘远云在雾里是否像墙：未截图。r10 / skycity-cam-c3 未合入。
3. 植被顶点色：未截图。导入日志有 `a_color` 量化格式警告。
4. cand6 加载页：文件已换上，58016 B；游戏里是否显示未截图。

## 遗留

- 结果面板仍是 v2.2 高度，红点资源在包里，日记/章节红点未摆上。对话气泡只接通 `setDialogCameraOpen`，没有九宫格、尾巴和七个界面。
- 桌面包、回归录像、DC、微信包体上限都未核。被拒的 wechat 包约 22.6 MB，低于 24,641,536 B，但没有留下。
- 磁盘回到 3.5 GiB 以上后，需要先让那 12 个 meta 与 Creator 写出的内容一致，再持锁重编。
