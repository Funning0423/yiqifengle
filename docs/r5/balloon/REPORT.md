# 热气球转场（草地 → 天空之城）

本地分支 `gbt/r5-balloon-meadow-sky`，没有 push。帆船分支 `gbt/r5-sail-island-meadow` 的 HEAD 仍是基线 `f569ff0d9eeb9f6ab26bdc56276fa234e60c5ac4`，没有可 cherry-pick 的提交。`TransitBackdrop`、`TransportLeg`、`TransportVehicle`、`test_frame_background.cjs` 都是本分支自写。

## 提交

| SHA | tree | 说明 |
| --- | --- | --- |
| `e45a64e48fb6737310524a759ea78faa8c55948b` | `1ac3272c9c6c8c5d9cbf42fbf54afb4811f878a1` | 热气球航线、运行时隐藏岩层、单天穹、程序化资产 |
| `b7f608e9bb39899296588892991579ea9d02fa3b` | `9a0eb04416fa936d5f3b5d168d9ec82b1e7778ef` | Creator 导入生成的脚本和 glb meta |
| `1c0c9c263013ea69a9824af1ce73cb97fbc98db3` | `8c1ffde3f0e3fbeae55c88d41cb4243fd324d07a` | 分包优先级改为 1，避免抢走 shared standard effect |
| `4a740ea75dc61079e8981b86cfa183223c3cd5c3` | `6a5720404caf236b0081bb9a9709f86bbef9013a` | 白天 390×844 截图、夜间 B-d/B-e、桥接对比，以及当时的报告 |

`JOURNEY_TRANSPORT['island-meadow']` 仍是 `bridge`。

## 和另外两个分支可能冲突的文件

- `creator-build-project/assets/scripts/region/JourneyTransport.ts`（`island-meadow` 键）
- `TransitBackdrop.ts`、`TransportLeg.ts`（`sailBeats` / `balloonBeats`）、`TransportVehicle.ts`、`BalloonRide.ts`
- `RegionJourneyAdapter.ts`、`RegionJourneyLayout.ts`、`world-r1/RegionJourneyCore.ts`
- `world-r2/WorldNativeComposition.ts`、`WorldIntegrationBoot.ts`（FlowReferenceStandin 段未改）
- `tools/journey-integration/run-suite.cjs`、`tools/transitions/test_frame_background.cjs`、`tools/cloud-web/test.cjs`
- `creator-build-project/assets/bundles/transport_balloon` 及目录 meta

region-nodes 分支如果也改 `WorldNativeComposition.ts`、`WorldIntegrationBoot.ts`、`RegionJourneyAdapter.ts`，合并时会碰到这几处。

## 测试

命令：`QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript npx -y node@22|20 tools/journey-integration/run-suite.cjs`。套件在仍有 BLOCKED 时退出码为 1，按通过条数验收。

- Node 22：98/99 PASS。非 PASS：`navigation-guard` = `BLOCKED_BROWSER`。
- Node 20：96/99 PASS。非 PASS：上述 `navigation-guard`，以及 `legacy-board-ui-pure`、`reward-background-return` = `BLOCKED_NODE`。

新增且 PASS：`transport-balloon`、`frame-background`、`transport-flag`、`transit-background-resume`。旧 08→09 在 `bridge` 下仍跑原来的路线，路线 SHA256 `3bf86ab6face9d7e3bcdb91f0d1f77372c0eb35b55496a687a7d6872a482d58e`。

`frame-background`：3206 帧（每 0.1 s × 7 种屏幕 × 昼夜）。没有不合格帧。`minClear=9.6 m`，`build05S=38.35 s`，加速度峰值 2.02，爬升角 25°，`sunkBalloon=0`。岩层世界 ymin 16.96，草地地形最高 7.46 + 8 = 15.46。桥接基线岩层 ymin 仍是 −9.63（A1 还在旧路线上）。

web-test 里 `__QF_BALLOON.total` 为 38.37 s，不超过 38.9 s。

## 包体

build-guard `wechat-release`（HEAD `1c0c9c2`）总字节 **19,419,459**。相对 r4 的 19,335,755，增加 83,704。上限 24,641,536。

| 分包 | 字节 |
| --- | --- |
| 主包（不含 subpackages） | 1,871,020 |
| audio_bgm_island | 418,907 |
| board_art | 2,131,356 |
| internal | 297,535 |
| main | 1,316,331 |
| region_island | 2,998,394 |
| region_lakeside | 541,965 |
| region_meadow | 2,934,449 |
| region_skycity | 3,326,944 |
| resources | 446,303 |
| shared_effects | 563,694 |
| static_seat_preview | 2,556,372 |
| transport_balloon | 16,189 |

`transport_balloon` 16,189 B（约 0.015 MiB），低于 0.3 MiB 目标。第一次构建把优先级设成 8，builtin standard effect 被拉进这个分包（约 578 KB），其它分包都依赖它，web-test 启动失败。改为优先级 1 之后 effect 留在 `shared_effects`。

资产：自制程序化 glb，许可证写在生成脚本里（`original procedural`）。`transport_balloon.glb` 125 三角面 / 2 材质，`transit_cloud_band.glb` 56 三角面、云洞直径 9 m，`transit_sky_cards.glb` 8 三角面。合计 189 三角面，低于 8.5k 目标。这台 Mac 没有 Blender；`check_region_export.py` 查的是实例 JSON，网格用 `tools/transitions/make_balloon_assets.cjs` 的 Node 统计（`asset-stats.json`）。没有使用 Draco。

## 画面

web-test，Playwright，`hasTouch`。世界默认是夜间；`?balloonPreview=1&night=1` 会拨到白天，用来拍白天主序列。`?transport=bridge` 只在非微信 release 生效。

B-e 采样：`device.numDrawCalls=26`（上限 53），`game.frameRate=60`。棋盘首帧时间没有单独探针，这次没有测到。

最差帧：帧测试没有不合格帧。离城最近的合格样本是 9.6 m（门槛 4 m）。对应白天 B-e 截图 `390x844-B-e.png`（采样时刻 t=21.7 s，节拍 B-e）。

截图在 `docs/r5/balloon/shots/`，都已 `sips -Z 900`，均小于 400 KB：

- 白天 390×844：`390x844-B-b-board.png` 进篮，`390x844-B-c.png` 起飞，`390x844-B-d.png` 穿云，`390x844-B-e.png` 城从云海上出现，`390x844-B-f.png` 降落，`390x844-B-h-board.png` 出篮走到棋盘
- 夜间 390×844：`390x844-night-B-d.png`、`390x844-night-B-e.png`（天穹颜色单一，顶行像素 (0,9,60)）
- 旧桥接白天对比：`390x844-bridge-A1.png`（航程约 8 m，城还压在草地高度）、`390x844-bridge-A2.png`（约 42 m，城底占画面上部）
- 其余六种屏幕的夜间 B-d / B-e：`414x896`、`360x780`、`375x667`、`390x520`、`320x568`、`768x1024`

## 未完成和风险

- `setWind` 是私有的，转场没有把风强调到 0.6，只发了 cue。
- 棋盘打开时的后台 `prepare` 没有单独接上：`prepareRegion` 需要已经结算的结果。`advanceMainline` 在 `travelRegion` 之前仍会 prepare。气球挂载超过 6 s 就回退到原来的桥。
- 抬高用了 §10 的上限 +40 m。门限按草地地形（不是风车叶尖）。叶尖仍可能高于岩层。
- 骑乘按 `advanceStep` 只在有 job 时写位置来挂到篮子。web 截图里能看到人和球在一起，没有另做 50 m 空节点偏差探针。
- 抽卡 DC 只在白天 B-e 采了一帧。
- 清理后磁盘剩余约 5.9 GB（`/dev/disk3s5` 228 GB，已用 98%）。
