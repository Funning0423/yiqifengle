# 0001b：E2 启动黑屏修复 + 主包瘦身（作者 grokbot-2/ggbot）

应用顺序：在 Dot 的 E2 分支（0001 = 084a27b，0002 = 5d0e931）上执行
`git am --directory=creator-build-project 0001-0001b-*.patch`。我已经在本机的 0001+0002 上验证过可以干净应用。
0003（region_skycity）不在这次范围内，以后再 rebase。

## 1. 启动黑屏（passed：静态分析；not_run：真机/DevTools）
- 原因：0001 去掉了首场景对海岛 GLB 的静态引用，所以启动时没有任何资源依赖 `builtin-standard`。这个 effect 不会被加载，
  `start()` 里 `mat.initialize({effectName:'builtin-standard'})` 就得到一个没有 pass 的材质，于是报 `illegal property name: albedo/roughness`，
  接着 `setMaterial` 读取 `localSetLayout` 时崩溃。
- 修复：`start()` 只创建参考胶囊的网格，先把它隐藏。等海岛 prefab（以及它的 effect）加载完、进入 `mountWorld()` 时，再调用 `applyMarkerMaterial()` 上材质。
  这个函数会先用 `EffectAsset.get` 确认 effect 已经注册：优先用 standard，没有就退到 unlit，两个都没有就保持隐藏。整段包在 try 里，不会挡住启动。
- 规则（以后的代码都要遵守）：不要在任何依赖它的资源加载之前按名字创建 effect。`builtin-standard` 会跟着引用它的材质被打进 internal 包，
  天空之城 v0.4 的法线和粗糙度材质不受影响。

## 2. 引擎裁剪（`settings/v2/packages/engine.json`）
保留：base、gfx-webgl、gfx-webgl2、2d、3d、ui、graphics、animation、skeletal-animation（支持多个 clip，也支持缩放动画）、primitive、profiler、tween、audio，渲染管线保持默认的 custom-pipeline。
裁掉：物理（3D 和 2D 都裁）、spine、dragon-bones、particle/particle-2d、rich-text、mask、tiled-map、terrain、video、webview、xr、light-probe、marionette、websocket 等。
- 依据：我扫描了全部脚本、scene 和 prefab，没有任何物理组件。参考胶囊只是一个 MeshRenderer，不是碰撞体，所以物理整个裁掉。
- 自定义 effect（`COLOR_0.a` 摆动、`TEXCOORD_1` 滚动、草甸风吹草）是资源，不是引擎模块，裁剪不影响。
- 实测（引擎自带的 ccbuild，平台 WECHAT，压缩开启）：裁剪后的引擎 JS 是 1,932,983 字节，Dot 构建出来的完整版是 6,737,130 字节。
  完整版的同口径对照因为本机内存不够没跑成（not_run），所以裁剪后的大小以 Dot 的实际构建为准。

## 3. 分包配置（需要 Dot 在编辑器里点；我没法在本机验证 3.8 的 Bundle 配置文件格式，所以不手写，免得被编辑器忽略）
1. 项目设置 → Bundle 配置：新建一个配置，微信小游戏的压缩类型选「小游戏分包」。
2. `assets/bundles/region_island` 和 `assets/resources` 都改用这个配置。
3. 构建面板：主包压缩类型选「小游戏分包」（官方分包文档的要求），关闭「分离引擎」（它不减少计入的包体）。
- 依据：[Cocos 引擎插件文档](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/wechatgame-plugin.html)写明，启用引擎插件后引擎代码「目前仍然会计算在内」。
  按[微信分包文档](https://developers.weixin.qq.com/minigame/dev/guide/base-ability/subPackage/useSubPackage.html)，主包不超过 4M，全部加起来不超过 30M，普通分包不限大小。

## 4. 预计主包（从 E2 实测 19,661,646 字节推算，未扣除 internal 包的缩小）
| 步骤 | 字节 |
|---|---|
| E2 主包 | 19,661,646 |
| − region_island 分包 | −9,343,207 |
| − 引擎 JS 6,737,130 → 1,932,983 | −4,804,147 |
| − bullet 的 wasm 和 js | −559,466 |
| − spine 的 wasm 和 js | −250,661 |
| = 只做以上几项 | 4,704,165（超标） |
| − resources 分包（pieces.png 等，约 0.80 MB） | 约 3.90 MB（太贴线） |
| − main 包分包（index.js 860,229 等） | **约 3.04 MB（2.9 MiB），推荐** |
第 3 步的三项都要做，才能留出余量。

## 5. Dot 构建后、打开 DevTools 前的自检（不花额度）
- `game.json` 的 `subpackages` 里有 region_island、resources 和 main；
- `cocos-js/` 下没有 bullet 和 spine 文件；
- 主包实际字节数不超过 4,000,000，其中 `cocos-js` 约 2 MB。如果超标就别开 DevTools，先回报。
