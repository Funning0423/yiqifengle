# r5-build08

分支 `gbt/r5-integrated-b08`，未 push。基线 `0881f4f7`。构建 HEAD `9ed0b65b529bb12856a39e98b7a6df8d56e587ce`。

## 十二个 meta

补丁 `already-installed`。干净导入没有 `importer:"*"`，也没有「初始场景不存在」。12 个变化已按 Creator 写出的内容提交（`251190e6`）：

- `QFLDialogBody.ttf.meta`、`QFLDialogName.ttf.meta`：`files` 补上字体文件名。
- 角色 `glb.meta`：clip 的 uuid 不变，`gltfIndex` 按 A1 重排。
- `LK_far_hills.glb.meta` 三角 822→3106；`LK_terrain.glb.meta` 1380→3284；`env_meadow.glb.meta` 远山 576→11602。
- `env_skycity.glb.meta`：cloudsea 3037→3097，植被卡片 8790→8720（与 r4c 的 8720 面一致），新增 `env_sky_floor_seal`。
- `LakesideBalloon.ts.meta`、`LakesideRegionNodes.ts.meta`：只调整了 uuid 字段顺序。
- 新文件 `dialog.meta`（directory）、`SailWakeCore.ts.meta`。

`shore-foam.effect.meta` 曾因编译失败变成 `imported:false`。声明 `a_matWorld` 之后恢复，没有留下失败导入。角色、草甸、天空城三份冻结 meta 的 sha256 改成了新文件。glb 本体没改。

## 测试与包

套件 138 项，137 PASS，navigation-guard `BLOCKED_BROWSER`。sky-arrival、`test_lens_clearance`、`test_frame_background`、`test_sail_continuity` 为 PASS。`test_balloon_continuity`、`test_finale_camera_path` 不在这棵树上。

build-guard both，第一次通过。wechat-release **22,604,401 B**（上限 24,641,536，余 2,037,135；比上次被拒的 22,585,459 多 18,942）。web-test 23,423,150 B。相对 fix1 的 20,267,421，微信包 +2,336,980 B。DC 未测。

`shore-foam.effect`：`CCGetWorldMatrix` 在属性声明之前展开，`USE_INSTANCING` 排列找不到 `a_matWorld`。属性挪到 include 之前后，构建日志里 EFX2406 为 0。房间内 `fx_shore_foam` 没有 MeshRenderer，岸线外景没拍到泡沫带。

`a_color`：清掉 library 后仍有 53 条，不是旧缓存。`env_skycity.glb` 里 41 个 COLOR_0 仍是 FLOAT VEC3，2 个是 r4c 的 UNSIGNED_BYTE normalized，7 个是 UNSIGNED_SHORT。没有改 glb。

## Cocos 检查（390×844 无头）

截图：`docs/r5/build08/shots/`，任务夹 `shots/` 同名。pageerror 0。

1. 岛上房间从外面：镜头在门外，画面是门、石拱和水，没有从外面看见单面内壳的室内面。
2. 天空城南边远云：`env_sky_cloudsea` 和 `env_sky_cumulus_far` 在棋盘上是关的。南向画面上沿是平的暗灰 (51,51,51)，像雾墙，不像云。r10 未合入。
3. 植被顶点色：卡片节点是开的，但近镜几乎是暗色平面，不能说顶点色正常。
4. 加载页：是 cand6。包内 jpg sha256 `de0a96d5254655b1…`，58016 B，画面是戴草帽的女孩和「咦，起风了」。`StartupLoadingLayout.ts` 里的 `compositeSha256` 仍是旧值 `189508bc…`，只影响诊断字符串。

## 桌面与遗留

已备份到 `~/cursor-tasks/r5-build08/build-backup/`，并原地更新 `~/Desktop/QIFENGLE-test-build05`（没有第二个文件夹）。`web/start.command` 可执行。微信 AppID `wx3bdd911c5c06f591`。`hashes.txt` 1725 行。帆船/热气球整段录像和冒烟 01–10 本轮没有重拍。

可删候选仍是上一份报告里的那些路径，本轮没有删。本仓库 `library`、`temp`、`build` 已清。
