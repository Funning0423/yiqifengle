# r5-build07 整合报告

BLOCKED: 最终 HEAD 的 build-guard 没有打出合格包，桌面测试包没有替换。

## 输入

| 名称 | SHA |
| --- | --- |
| fix1 基线 | `98950571` |
| 帆船 qa4 | `ef7b0b2670d7b647afbe27e004129e43a469cf7e` |
| 热气球 v25fix | `20087aaa0faf53a4a1c877f816e6a3de1f7d55b9` |
| ggbot r4.2 | `9a2757314f96e9949dd75402367cf717c9a49adc` |

当前分支 `gbt/r5-integrated-b07`，未 push。

## 提交（40 位）

| SHA | 说明 |
| --- | --- |
| `bc81575fead2d4d05b11b962c936d3b76708ad4b` | Merge sail-qa4 into r5-integrated-b07（开工前已在，本轮未重做） |
| `fbc4d04b3edd203fa5b7d6ff7db1b928724e63fa` | Merge balloon-v25fix into r5-integrated-b07 |
| `cbb7e35c309590b3d014da2273f0ee04a1748eaa` | Merge ggbot r4.2 fixes into r5-integrated-b07 |
| `b35f1a8b10775668300385d224f4ae4aad937fe8` | 让草甸场景测试走到 r4.2 的可见性断言 |
| `81974b9262dccfd7e0f432f76bc9c8055c9f2f32` | 夜间关掉草甸棋盘的白天穹顶 |
| `42033982ad57b871f6dec0bc4dddd8948c4ddd14` | 同一检查改成 Creator 脚本解析器能过的写法 |

## 冲突处理

v25fix（`fbc4d04b3edd203fa5b7d6ff7db1b928724e63fa`）：

- `BalloonFlight.ts` 自动合并。`STRATA_OFF_T=36` 与 fix1 的 `SKY_LAWN` / `skyNodeAfterArrival` 都在。
- `BalloonTransit.ts` 手工合成。未到达时用 v25fix 的云海、穹顶抖动和树冠裁切；到达时保留 fix1：`arrived=true` 写在最后一次 `paint(plan.total)` 之前，随后 `fadeCover(0,0)`，到达后草坪节点打开、转场层关掉。
- `TransportVehicle.ts` 只冲突在 import。保留帆船用的 `Quat`，并保留 v25fix 的 `gfx` 与白天球囊提亮。

r4.2（`cbb7e35c309590b3d014da2273f0ee04a1748eaa`）。这些文件在 `f569ff0d` 之后，作为冻结清单的例外进入本分支：

- `MeadowBoardBackground.ts`：保留 r5 的 `setAnchor`，可见性不改 `rig.active`；保留 r4.2 的夜间草地/云和棋盘清屏色。
- `WorldNativeComposition.ts`：天空之城棋盘仍从 `SkycityBoardLive` 引入（测试要求的那一行）。`[QF_LAKE]` 不把「湖畔旅程没走到」当成错误。帆船和热气球预览保留。
- `run-suite.cjs`：两边套件取并集，130 项，没有重复 id。

r4.2 没有因为重叠被整段丢掉。夜间棋盘、换场只切可见性、`[QF_LAKE]` 不误报都留在源码里。

## fix1 地面

`BalloonFlight.ts` 的到达路径仍打开 `env_sky_static_palette`、`env_sky_static_rock_strata`、`env_sky_static_foliage_cards`、`env_sky_island_vines`，并关掉云海等转场层。`sky-arrival` 在 `b35f1a8b` 上为 PASS，`{"lawn":4,"transitOff":7}`。用该次 guard 的 web-test 拍天空之城节点时，广场、花和柱子在地面上，没有缺地露底。

## 测试（`b35f1a8b`，穹顶修改之前）

- 套件 129/130。唯一非 PASS 是 navigation-guard `BLOCKED_BROWSER`。
- `test_frame_background.cjs` PASS。帆船 3458 帧，最差 clearM 6.082。热气球 5054 帧，seamLeak=0，handoffFade=1，handoffT=35.9。门限未放宽。
- `test_sail_continuity.cjs` PASS。白天上身最差 0.082、夜间 0.087，跳色 0.1。
- sky-arrival PASS。
- r4.2 新增/修改的测试 PASS，包括 `test_meadow_night_grade.cjs`、`test_world_navigation_guard.cjs`、`test_meadow_scene.cjs`。
- 报告和 output 已按规格 checkout / clean，未提交。

穹顶两笔提交之后只重跑了草甸夜间相关测试，PASS。没有再跑整套 suite。

## 构建

`b35f1a8b` 的 guard（`both`）曾经通过：wechat-release 20,306,172 B，相对 fix1 的 20,267,421 B 多 38,751 B，低于 24,641,536 B。web-test 21,109,326 B。这两份还在任务包 `stage/`，合计 41,415,498 B。它们不是当前 HEAD。

当前 HEAD `42033982ad57b871f6dec0bc4dddd8948c4ddd14` 的 build-guard 连续失败：

- 第 1 轮 3 次、第 2 轮 3 次、第 3 轮再失败。同一错误，已到「最多重试 2 次」的上限。
- 每次 wechat-release 都是 2,337,127 B，退出码 36，日志含「当前初始场景不存在」，结束后 497 个 meta 被改写，guard 已把 meta 还原，工作树干净。
- 构建脚本子进程收到 SIGTERM。asset-db 在资源导入完成前就报 ready。
- 锁已释放。`library` / `temp` / `build` 不在仓库里。没有动别人的锁。

## 回归（只针对 stage 里的 b35f1a8b 包，不能当作最终包）

已看过的画面，pageerror 0，洋红占比 0：

- 白天：海岛节点、草原节点、天空之城节点、天空之城走动。天空之城地面在。
- 热气球：上篮红黄球、云海巡航红约 (222,75,60)、黄约 (229,212,75)、看见天空之城。夜间 t=24 是暗蓝夜空，球仍是红黄，没有大片青色。
- 天空之城棋盘夜间清屏接近 (0,12,68)，标题是「12 天空之城的回声」。
- 草甸棋盘夜间：世界模式已是 night，相机清屏是 (0,12,68)，草地比白天暗，但 `meadow_sky_dome` 的材质是 builtin-unlit。`SkyNightTexture` 拒绝贴夜空图，白天穹顶盖住了夜空，画面顶部约 (195,200,206)。这就是 `81974b92` 要修的点，修完没有合格构建，所以没有重拍。

帆船整段重采、`sail_day.mp4` / `sail_night.mp4`、桌面替换、hashes.txt 都没做。

## 桌面

`/Users/shineanl/Desktop/QIFENGLE-test-build05` 仍是上一版，未备份、未替换、未改 README。没有第二个测试包文件夹。

## 已知问题（未写入桌面 README，因为没有交付新包）

上一版仍在、本轮没有新证据说已经修好的：坐着时裙摆和蝴蝶结穿进凳子；坐着切后台回来要点「继续」；湖畔在包里但游戏里走不到；天空之城终幕镜头（大树挡星环、人很小）仍未验收，r4–r9 终幕没有并进来；自由走动时镜头会钻到台阶下；点机器人时镜头贴背面；远海一镜没有风车、船尾白沫偏短；草甸卡顿（r4.2 没修）；树冠轮廓仍是低模锯齿（v25fix 未完成项）。

热气球云海球囊偏暗：在 b35f1a8b 的白天巡航画面上红、黄都高于 200，和 v25fix 的提亮一致。缺地露底在那次天空之城画面上没有出现。这两条都还没有最终 HEAD 的包可以复核。

## 清理

- 测试报告和 output 已还原，未提交。
- 失败构建的 library、temp、build 由 guard 删掉。
- 构建锁已释放。
- `stage/` 保留，里面是 `b35f1a8b` 的包，不是 `42033982`。
- 只结束本任务自己拉起的构建进程。没有 push。
