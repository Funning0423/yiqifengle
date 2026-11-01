# r5-build07 整合报告

初始场景配置没有丢。Creator 3.8.8 的 AssetDB 会在 `engine-extends` 导入器注册完成前就报 ready，资源被 `*` 导入器改写，构建因此认为 `WorldR5Integration` 不存在。给本机这份 Creator 装上补注册补丁后，wechat-release 和 web-test 都一次通过。

## 输入

| 名称 | SHA |
| --- | --- |
| fix1 基线 | `98950571` |
| 帆船 qa4 | `ef7b0b2670d7b647afbe27e004129e43a469cf7e` |
| 热气球 v25fix | `20087aaa0faf53a4a1c877f816e6a3de1f7d55b9` |
| ggbot r4.2 | `9a2757314f96e9949dd75402367cf717c9a49adc` |

当前分支 `gbt/r5-integrated-b07`，未 push。游戏代码停在 `42033982` 的草甸夜间穹顶修复上；本轮提交只增加导入器补丁脚本和这份记录。

## 提交（40 位）

| SHA | 说明 |
| --- | --- |
| `bc81575fead2d4d05b11b962c936d3b76708ad4b` | Merge sail-qa4 into r5-integrated-b07 |
| `fbc4d04b3edd203fa5b7d6ff7db1b928724e63fa` | Merge balloon-v25fix into r5-integrated-b07 |
| `cbb7e35c309590b3d014da2273f0ee04a1748eaa` | Merge ggbot r4.2 fixes into r5-integrated-b07 |
| `b35f1a8b10775668300385d224f4ae4aad937fe8` | 让草甸场景测试走到 r4.2 的可见性断言。这一次 guard 能出包 |
| `81974b9262dccfd7e0f432f76bc9c8055c9f2f32` | 夜间关掉草甸棋盘的白天穹顶 |
| `42033982ad57b871f6dec0bc4dddd8948c4ddd14` | 同一检查改成 Creator 脚本解析器能过的写法 |
| `40f723341550010d4f46b119b144479c5a793c7e` | 记录当时的 BLOCKED |
| `36ad1a760e1489a1b6b50ce48ee6f457f3311e63` | 记录导入器漏注册，并放入补丁脚本 |

## 场景对比

`b35f1a8b` 与 `42033982` 的 `startScene` 都是 `260c2ebc-0660-4be6-8c4b-7885436222ea`。`WorldR5Integration.scene` 的 `_id` 和 `.meta` 的 uuid 都是这个值，文件都在，`assets/scenes` 不是 Bundle。diff 没有动场景、meta 或 `tools/build-guard/*.json`。

dirty 497 是失败导入把 `.meta` 改成 `importer: "*"`。guard 会还原。library 在每次构建前删除。

## 冲突处理

v25fix（`fbc4d04b3edd203fa5b7d6ff7db1b928724e63fa`）：

- `BalloonFlight.ts` 自动合并。`STRATA_OFF_T=36` 与 fix1 的 `SKY_LAWN` / `skyNodeAfterArrival` 都在。
- `BalloonTransit.ts` 手工合成。未到达时用 v25fix 的云海、穹顶抖动和树冠裁切；到达时保留 fix1：`arrived=true` 写在最后一次 `paint(plan.total)` 之前，随后 `fadeCover(0,0)`，到达后草坪节点打开、转场层关掉。
- `TransportVehicle.ts` 只冲突在 import。保留帆船用的 `Quat`，并保留 v25fix 的 `gfx` 与白天球囊提亮。

r4.2（`cbb7e35c309590b3d014da2273f0ee04a1748eaa`）。这些文件在 `f569ff0d` 之后，作为冻结清单的例外进入本分支：

- `MeadowBoardBackground.ts`：保留 r5 的 `setAnchor`，可见性不改 `rig.active`；保留 r4.2 的夜间草地/云和棋盘清屏色。随后 `81974b92` 在夜里关掉白天穹顶。
- `WorldNativeComposition.ts`：天空之城棋盘仍从 `SkycityBoardLive` 引入。`[QF_LAKE]` 不把「湖畔旅程没走到」当成错误。
- `run-suite.cjs`：两边套件取并集，130 项。

## 修复

`tools/creator-assetdb-init-fix/` 在 AssetDB `init()` 之后补齐已启用扩展里漏掉的导入器。已安装到本机 Creator 3.8.8。原 asar `b14f2084c411da514f8857db7de8c37179a5e7c899cf7387e45a18306985fddd`，补丁后 `9fec263494f9fc5bd085a6f8a14c6e04b3ab3bc3ce5b13d132c4395a288e0c33`。回执 `app.asar.assetdb-init-fix.json` 留在 Creator 的 `Contents/Resources/`。回滚用该目录里的 `fix-cocos-assetdb-init.py --restore`。

## 测试

Node 22.22.2，`QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript`（5.9.3），HEAD `36ad1a76`。

- 套件 129/130。唯一非 PASS 是 navigation-guard `BLOCKED_BROWSER`。
- `test_frame_background.cjs` PASS。帆船 3458 帧，最差 clearM 6.082。热气球 5054 帧，seamLeak=0，handoffFade=1，handoffT=35.9。
- `test_sail_continuity.cjs` PASS。白天上身最差 0.082、夜间 0.087，跳色 0.1。
- sky-arrival PASS。`{"lawn":4,"transitOff":7}`。

套件报告写在 `tools/journey-integration/reports/`，未提交，未删除。

## 构建

`build-wechat-guarded.sh both`，`MAX_TRIES=1`，持锁一次通过。

- wechat-release 20,306,443 B。相对 fix1 的 20,267,421 B 多 39,022 B，低于 24,641,536 B。相对 `b35f1a8b` 的 20,306,172 B 多 271 B。
- web-test 21,109,591 B。相对 `b35f1a8b` 的 21,109,326 B 多 265 B。
- 两次 dirty 都是 0，日志都没有「当前初始场景不存在」。任务 Finished。日志里仍有一行 build-script SIGTERM，随后使用引擎缓存并完成。

产物在任务包 `stage/`，合计 41,416,034 B。仓库里的 `build/`、`library/`、`temp/` 已删。构建日志留在 `tools/build-guard/logs/`。桌面 `QIFENGLE-test-build05` 未改。没有 push。
