# 风铃湖畔 (lakeside r5h3) 接成可玩区域：A3 之后的 Build05 线

- 分支：`voice/build05-lakeside-playable`，只在本地，没有推送，主线没动。
- 基于 `09a1b8e456fd38dadf632f627189883808307cbe`（integration/build05-20261016T2048）。
- HEAD：`d8cd409a0da556104888b1442b76f51acc6af1ba`，tree `2157aaca079b7cd2fde68de224890a23b4b975a8`。
- 提交人：Voice Bot。共 4 个提交，见 commits.txt。

## 交付物
- `voice-build05-lakeside-playable.bundle`：增量 bundle，前置提交是 09a1b8e。用法：`git fetch <bundle> voice/build05-lakeside-playable:lk`。已在全新 clone 里验证，HEAD 和 tree 都一致。
- `patches/0001-0004`：`git format-patch 09a1b8e..d8cd409`。在干净的 09a1b8e 上 `git am`，得到的 tree 是 2157aaca…，完全一致。
- `suite/`：基线和改后的全量结果，外加 lakeside-entry 和 retry-protection 的输出。
- `HANDOFF_yunjingbot.md`：给运镜bot 的交接，包括节点名、棋盘坐标和边界、相机参数、旅途和落地挂点。
- `screenshots/`：Blender 代理渲染，**不是游戏内截图**。详见下面的「截图」一节。
- `files_changed.txt`、`commits.txt`、`SHA256SUMS`。

## 做了什么
1. **区域选择能进湖畔**
   - 旅程册第 4 章「风铃湖畔」：挑战显示 x/6，没有主线星。在主线 12 通关后开放。
   - 章节页「继续挑战」走 `enterRegion('lake')` → `regionSelection` → `inspectSelection` → `enterSelectedLevel`，和潮汐、草甸、天空回声是同一条路。调试面板加了一个「风铃湖畔」按钮。
   - 湖畔和潮汐一样在小岛站开局，还没有实体旅途，这一段留给运镜bot。
2. **关卡**
   - `LEVELS_DRAFT_lakeside.json` 本来已经转成运行时格式了（lakeside-levels-data.js，6 关，规则是风铃），这次只是把它接进 `regional-r05` catalog（index.js 里 concat）。`catalog-data.js` 字节不变。
   - 解锁：第 1 关要求主线 12 通关（journey record 11），之后每关要求通过前一关。地区印记要 6 关全部通过才能领。
   - provider 的 regions 列表和 journal 校验都加了 lake。
3. **棋盘镜头和光照**
   - 新增 `region/LakesideBoardBackground.ts`（实景租约）和 `region/LakesideSceneData.ts`（纯数据，有单测）。
   - 场景：从 region_lakeside 分包加载 transforms JSON 和 models/ 下的 Prefab，按 `scene_r5h_slim_transforms.json` 摆 465 个实例。3D 棋子、接触影、涟漪环和 board_frame 不摆，因为 2D 棋盘 UI 会画棋子。
   - 相机：完全按 handoff §4 / scene_r5h3_lighting.json（细节见 HANDOFF）。
   - 光：handoff §5 的太阳用图层上的 SphereLight 模拟，比例是 1 / 0.08 / 0.31，SUN_mtn_sky 没放。主 DirectionalLight 属于世界场景，所以没加第二个。
   - 加载前先加载 `shared_effects`，在 SharedBundles 里加了 region_lakeside，否则 builtin-standard 会缺失。
4. **章节美术**（board_art，全部自制）
   - `r2/region_lake.png`：从场景设计部自己的 Blender 渲染 cmp_r5h_slim_graded.png 裁切，加了边框。
   - `r2/chapter_lake.png`：「风铃湖畔」标题，用 Noto Sans CJK Bold（OFL）渲染成图，没有打包字体。
   - `popup/reward_seal_lake.png`：在草甸印记的外框上重绘了湖、风铃和远山。
   - 三张一共 18,460 B。

## 包体
| 项目 | 字节 | 说明 |
|---|---|---|
| 基线实测 | 19,125,656 B | 界面验收部在 Mac 上测的 511953e。09a1b8e 只多了 +111 B，约 19,125,8xx B。 |
| region_lakeside 分包 | 不变 | 1,012,241 B 源文件，c6cd037 之后的实测总包里已经包含。 |
| board_art PNG | +18,460 B | 实际文件大小。 |
| 新 .meta 生成的 JSON | ≈ +1.5 KB | 估算。 |
| 脚本（主包） | ≈ +12–14 KB | 源码多了 14,008 B，编译后估算。 |
| **合计（估算）** | **≈ +32 KB → ≈ 19,158,000 B ≈ 18.27 MiB** | 上限 24 MiB 是 25,165,824 B，目标 23.5 MiB 是 24,641,536 B。 |

- **这是估算，没有实测。** 这台机器上没有 Cocos Creator，没法真实构建。需要在 Mac 上用 `tools/build-guard/build-wechat-guarded.sh` 跑一次，看 TOTAL_BYTES 以及主包和各分包的大小。
- 主包只增加脚本，约 +14 KB；湖畔美术都在分包里。主包和分包的现值我这边没有分项数据，请在 Mac 构建时一起报。

## 测试
- 基线（09a1b8e，在本机重跑）：53 项，48 通过。
- 改后（d8cd409）：54 项，**49 通过**。没通过的仍是已知 5 项：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract 失败，navigation-guard 是 BLOCKED_BROWSER。这 4 个失败的报错和基线逐字相同，**没有新增失败**。
- 运行环境：`QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript`。
- 新增 `lakeside-entry` 测试，共 8 项：
  - catalog 为 12+6 关
  - 解锁门槛
  - 关卡 → 场景路由
  - 旅程册第 4 章的卡片
  - 相机和光照跟 scene_r5h3_lighting.json 逐项比对
  - 棋盘四角都在视野里
  - 保留的 GLB 都在分包里并有 .meta
  - 风铃格坐标
- 改了两个已有测试，都是因为 catalog 现在包含湖畔：
  - `retry-protection`：用 tools/lakeside/calibration-report.json 的见证，经真实 provider 把湖畔 6 关全部打通、持久化，并领取湖畔印记。这一项现在比原来测得更多。
  - `region-levels`：草甸和天空的见证循环原来写的是 `!== 'tide'`，现在明确只取 meadow 和 sky。

## 截图
- **没有游戏内截图**：这台机器没有 Creator，出不了 web 预览包。
- `screenshots/` 里是 Blender 5.2 EEVEE 的代理渲染：同样的 465 个实例、同样的相机位姿和 FOV、同样的 3 个太阳方向和颜色，脚本是 render.py 和 scene.json。分三张：
  - 720×1280
  - 加上 7×7 格子叠加（橙色是第 1 关的风铃格）
  - 9:19.5（FOV 72.353°）
- 它只能说明构图和取景，Cocos 里实际的光照强度、材质和后期会不一样。

## 未解决的风险
1. **没在 Creator 里跑过**：湖畔 GLB 的 Prefab 名字（按文件名）、`loadDir('models', Prefab)`、顶点色乘调色板，都要在 Mac 构建时实测。如果 Prefab 缺失，会抛出 `lakeside-prefab-missing`，并走已有的失败重试 UI。
2. **性能**：465 个实例逐个 instantiate，没有合批，也没开 GPU instancing。handoff 估算约 56–60 DC，不合批会更多。需要真机看帧率，可能要做静态合批。
3. **2D 棋盘和 3D 湖面格子不对齐**：现在 3D 格子在 720×1280 下投影到 y 832–1150 px，2D 棋盘的位置由 BoardLayout 决定。交给运镜bot 做棋盘取景。
4. **光照和后期是近似**：SphereLight 模拟太阳，亮度只是按比例估的；没有 LUT、Bloom、Vignette、雾，可能偏平或偏暗。需要看实机截图再调。
5. **解锁门槛是我定的**：主线 12 之后开放（常量是 progress-journal 的 LAKE_GATE_RECORD 和 IslandPanels 的 LAKE_GATE_RECORD，两处要同步）。Funning 想更早开放的话改这一个数就行。
6. **旅程册四行高 976 设计 px**，在极矮的屏上可能挤，需要看真机。
7. **夜间**：湖畔租约没有接夜色（草甸有 N2/N3），夜里进湖畔仍是黄昏光。
8. `tools/board_art_sync.py` 不认识这 3 张湖畔图。如果以后有人用它从 c-popups 全量同步，要确认它不会删掉这几张。
9. 关卡 id 前缀是 `r04-lake-*`（沿用草案）。持久化里存的就是这个 id，将来改名需要迁移。

没有动的：strip sparse-only guard、pending 选择修复（Oi 负责）、玻璃牌（已冻结）、主线、Funning 的 Mac。
