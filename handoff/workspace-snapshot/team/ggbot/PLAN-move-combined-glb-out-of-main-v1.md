# 方案：把 combined_visual_m.glb 移出主包（GGbot，2026-10-09，只写方案，未改工程）

## 现状（本机静态检查，5b449fa）
- `assets/resources/firstslice/combined_visual_m.glb`：6,225,724 B（5.94 MB），SHA256 `158f0b42…cf6c`。单个文件就超过主包 4 MB 上限。
- 体积构成：几何 4.51 MB（114,165 顶点，POSITION 1.31 MB、NORMAL 1.31 MB、UV0 0.86 MB、索引 0.44 MB、顶点色 0.32 MB、蒙皮 0.26 MB）、动画 0.92 MB、贴图 0.36 MB、JSON 0.15 MB。
- 它在 `resources` bundle 里（`resources.meta` 里 isBundle=true），同目录还有 `combined_collision_proxies.json` 280 KB、`combined_anchors_m.json` 42 KB；`resources/ui/pieces.png` 776 KB 也在这个 bundle。
- **启动场景 `WorldR5Integration.scene` 直接引用了它的预制体**（`498b3fa5-…@87291`，挂在 `WorldIntegrationBoot.model` 上），`FirstsliceImport.scene` 也引用了。只要场景直接引用，这个模型就是启动场景的依赖，挪到哪个包都会在进场景前被加载。所以光改 bundle 配置不够，必须同时改成运行时加载。

## 方案（分四步，每步都可单独回滚）

### 第 1 步：新建区域 bundle（Oi 在编辑器里做）
- 新建 `assets/bundles/region_island/`，在属性面板勾选“配置为 Bundle”，名称 `region_island`。
- 在**编辑器里**把 `combined_visual_m.glb`、`combined_anchors_m.json`、`combined_collision_proxies.json` 拖进去（编辑器内移动会保留 .meta 和 UUID；不要在文件系统里直接 mv）。
- `r4-smoke-fixture.json`（240 B）和 `ui/pieces.png` 暂留 `resources`。
- 注意：`tools/audit_camera_proxy_surfaces.py` 写死了 `assets/resources/firstslice/` 路径，需要同步改（这个我来改）。

### 第 2 步：去掉场景对模型的直接引用，改为运行时加载（代码，我可以写好交 Oi 合入）
- `WorldIntegrationBoot`：删除 `@property(Prefab) model`，在 `start()` 里先显示现有的“世界加载中”，然后：
  `assetManager.loadBundle('region_island')` → `bundle.load(<路径>, Prefab)`（或用 UUID `498b3fa5-2dd3-4e86-93b8-637ae51438fe@87291` 通过 `assetManager.loadAny` 加载）→ 拿到 Prefab 后再走原来的 `WorldNativeComposition` 初始化。具体哪种写法要在编辑器里验证 GLB 子资源路径后定。
- 加载失败要有重试按钮和提示，不能白屏；场景切走后回调要判 `isValid`，不写存档（跟 E5 的要求一致）。
- `FirstsliceImport.scene` 只是导入验证场景，**不勾进微信构建**的场景列表。
- 在场景里把 `model` 字段清空后保存，确认 `WorldR5Integration.scene` 里不再出现 `498b3fa5`（我可以用脚本查）。

### 第 3 步：构建配置（Oi，在 `wechat-world-r5-build-options.json` 里）
- 阶段 A（先验证，不依赖 COS）：`region_island` 设为“小游戏分包”。验证主包 <4 MB、分包加载正常。总包仍在 20 MB 内。
- 阶段 B（COS 就绪后）：`region_island` 改为“远程包”，构建选项填 `remoteServerAddress` = COS 地址，把构建产物 `remote/` 目录上传到 COS；微信公众平台把 COS 域名加进 downloadFile 合法域名（需要 Funning 操作）。
- 两个阶段都要开“功能裁剪”，只保留用到的引擎模块；是否启用微信引擎插件由 Oi 实测后定。

### 第 4 步（可选，美术侧，减少下载量）：瘦身 GLB
- 几何占 4.51 MB：评估 Cocos 3.8 导入设置里的网格优化/压缩选项，或在导出端做量化；手绘调色板材质如果不吃光照，可以考虑去掉法线（省约 1.3 MB）。这些都要先在编辑器和真机上对比效果，**由 Grok Bot 验收观感**后再定。
- 动画 0.92 MB：检查是否有可以降采样的关键帧。

## 验收
- 构建后主包实测 <4 MB（以微信开发者工具显示为准），并列出首屏资源清单。
- `WorldR5Integration.scene` 不再直接引用 `498b3fa5…`。
- 弱网/断网下进入世界有加载提示和重试，不白屏、不写坏存档。
- 首可交互 ≤8 s（E6 标准），分包/远程两种情况各测一次。
- 主线 190 + R5 100 回归（E7）通过。

## 主包里剩下什么（需要构建后实测，目前没有数据）
引擎、脚本、启动场景、`resources`（pieces.png 776 KB + 小 json）、首屏音效（≤1 MB）。pieces.png 偏大，建议后续进 `common_ui` 或压缩。

## 待确认
1. 是否开通虚拟支付（决定总包 20 MB 还是 30 MB）。
2. COS 的 bucket/域名与上传权限（Funning）。
3. 代码改动由我出补丁、Oi 合入，还是 Oi 自己改。
