# T8 第 1 步：删未用背景图 + 两个场景 glb 去切线

审计见 `docs/T8-package-audit.md`；逐文件前后哈希见 `docs/T8-step1-MANIFEST.json`。

## 改了什么

| 项 | 文件 | 改动 | 预计省（按 near 构建逐文件大小） |
|---|---|---|---|
| C01 | `assets/bundles/background_ground/`（painted-grass.png 及 .meta）、`background_ground.meta` | 删除整个 bundle | 3,555,555 B（整个分包消失） |
| C04 | `assets/bundles/background_foliage/botanical-props.png(.meta)` | 删除 | 约 807,554 B（background_foliage 2,226,485 → 约 1,418,900） |
| C02 | `region_island/combined_visual_m.glb.meta` | `userData.tangents: 1` | 1,781,216 B（49 个 mesh 每顶点 −16 B） |
| C03 | `region_skycity/env_skycity.glb.meta` | `userData.tangents: 1` | 1,680,912 B（45 个 mesh 每顶点 −16 B） |
| 合计 | | | **约 7.83 MB**（near 总 30,762,977 → 约 22.94 MB） |

- glb 文件本身逐字节不变（sha256 见 MANIFEST 的 unchangedPinned；T1 的 glb 依赖哈希 77bff8b3…/231e2987… 不受影响）。
- 键名和取值：Cocos 3.8 的 FBX/glTF 导入器在模型 .meta 顶层 `userData` 里存 `normals` / `tangents`，取值 0=Optional、1=Exclude、2=Require（默认）、3=Recalculate。两个 meta 原来都没写这个键（等于默认 2），这次只加了 `"tangents": 1`，没有动 normals 或其他导入设置。**这个取值是根据官方文档的选项顺序和默认 meta 推出来的，需要在 Mac 的 Inspector 里确认显示为 Exclude**（见下面第 2 步）。
- 旧静态背景代码（`OriginalLevelEnvironment.ts` 里的 `LevelEnvironment`/`surface()`/`paint()`）**没删**。原因：
  - 运行时确实没人调用它，`OriginalLevelBackground` 只用到同一个文件里的 `MAIN` 和 `paintOcean*`。
  - 但它和 `paintOcean*` 共用辅助函数（`ellipse` 等）；而且 `test_dynamic_original_background`、`cloud-ocean/test_legacy_parity`、`provider-harness`、`test_cloud_integration_review` 都钉着这个文件的源码哈希或拿它和旧渲染器做逐像素对照。
  - 删掉会牵动多份测试和哈希，不算干净。
  - 没删也安全：这段代码不加载任何资源，只在 `world.botanical?.width` / `world.grassArt?.width` 有值时才画图，而现在没有任何地方给它们赋值。

## 测试和哈希清单

- 改了 4 个测试或工具，让它们不再读已删除的 png：
  - `test_original_background.cjs`、`test_dynamic_original_background.cjs`、`cloud-ocean/provider-harness.cjs`：只加载 painted-cloud；旧路径对缺少的图本来就能容忍。
  - `test_cloud_integration_review.cjs`：两张图从 png 哈希核对里排除，改成断言它们保持删除状态。
- **没有改**的历史审批记录：`tools/integrated_3d_scope.json`、`verified_restoration_scope.json`、`audio_gesture_scope.json`、`text-MANIFEST-SHA256.json`。
  - 它们记录的是更早几次评审时整棵生产树的哈希，在 near 上**本来就已经过期**。比如 combined_visual_m.glb.meta 在里面记的是 85dcbb22…，near 实际是 d86b2288…；text-MANIFEST 在 near 上已有 25 处不一致。
  - 读它们的 `test_cloud_integration_review` 在 near 上本来就跑不过（缺 `../baseline-current`，而且整树比对必然失败）。
  - 把 T8 写进这些历史快照等于改历史，所以这次的变化另外记在 `docs/T8-step1-MANIFEST.json`。
- 盒子上跑全部 `tools/test_*.cjs` 和 `tests/*`（node 23.11），改前改后**通过/失败完全一致**：6 个通过，其余的失败原因都是原来就有的，比如缺 Playwright/Chromium、缺 evidence 目录或 Mac 路径，或者测试本身已过期。改动涉及的几个测试，失败点都在读这些资源之前，没有新增失败。

## 灯塔点击 / 几何夹具不受影响

- 运行时灯塔判定（`WorldFlowComponent.hitLighthouse`）用的是 `geometry.intersect.rayModel(ray, model)`，只读位置和索引。天空城机器人点击（`SkycityRobotInteract`）同理。去掉切线只是顶点里少一个属性，位置不变。
- T1 的几何夹具（`tools/t1/decode_pick_geometry.cjs`、`pick-geometry-*.identity.json`）直接从 glb 文件解 Draco，按 glb 的 sha256 认身份。glb 没变，所以不受影响。

## Mac 重建步骤

1. 在隔离副本里检出 `work/GGbot-t8`（或合并后的分支）。打开工程前，先删掉这两个 glb 在 `library/` 里的导入缓存，或在 Creator 里对它们右键“重新导入资源”，确保按新设置重新导入。
2. 打开 Creator 3.8.8，选中 `combined_visual_m.glb` 和 `env_skycity.glb`，Inspector 里 **Tangents 应显示 Exclude**、Normals 仍是 Require。如果 Creator 回写了 meta（例如补上 `"normals": 2`），这是正常的，提交回来即可；如果 Tangents 显示的不是 Exclude，就停下并告诉我（说明取值推错了）。
3. 用和 phase0 相同的 build-options 命令行构建 wechatgame（`--build configPath=...`）。
4. 要测的数（和 near 的 BUILD-RECEIPT 对比）：
   - `subpackages/background_ground`：**应不存在**；game.json 的 subpackages 里也不应有它。
   - `region_island`：11,651,121 → 约 9,869,900（−1,781,216）
   - `region_skycity`：8,705,717 → 约 7,024,800（−1,680,912）
   - `background_foliage`：2,226,485 → 约 1,418,900
   - 总大小：30,762,977 → 约 22.94 MB
   - 抽查 mesh 文件：`region_island/native/49/498b3fa5…@00f3d.bin` 应为 1,765,128 → 1,230,248（33,430 顶点 × 16 B）；`region_skycity/native/06/0694320f…@9de8f.bin` 应为 1,325,448 → 1,004,040。
5. 画面检查：材质都没有法线贴图，所以光照应该**完全一样**。截图前后对比：
   - 家（室内灯光）、出门、岛上全景、灯塔近景、回家
   - 天空城全景、机器人三段动画
   - 白天和夜晚各一张
   - 控制台不应出现缺 `a_tangent` 之类的顶点属性警告
6. 交互检查：在岛上点灯塔能回家（T1）、天空城点机器人有反应、关卡背景云正常显示。

## 回退

`git revert <本提交>`，或者把这几个文件从 bd94c61 恢复：两张 png 和它们的 .meta、`background_ground.meta`、两个 glb.meta、4 个 tools 文件。恢复后在 Creator 里重新导入两个 glb。
