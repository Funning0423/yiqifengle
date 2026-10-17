# 改动说明：海岛世界移入 region_island bundle 并改为运行时加载（GGbot，2026-10-09）

- 工作副本：`/workspace/wechat-game/work/ggbot-island-bundle/`（由 5b449fa 的 `creator-build-project` 复制，自带 git：基线提交 + 一个改动提交）。原工程未改。
- 补丁：`patches/0001-region_island-bundle-runtime-load-of-island-world-GG.patch`（git 格式，含二进制改名；在 creator-build-project 根目录用 `git am` 或 `git apply` 合入）。

## 改了什么
1. 新建 `assets/bundles/`、`assets/bundles/region_island/`（目录 meta 中 isBundle=true，bundleName=`region_island`，priority 1，配置 default）。
2. 把 `combined_visual_m.glb`、`combined_anchors_m.json`、`combined_collision_proxies.json` 连同各自 `.meta` 从 `resources/firstslice/` 移到 `region_island/`。meta 原样带走，UUID 不变（模型预制体仍是 `498b3fa5-…@87291`）。
3. `WorldR5Integration.scene`：删掉 `WorldIntegrationBoot.model` 对预制体的直接引用（场景里已不再出现 `498b3fa5`）。`smokeFixture` 引用不变，仍在 resources。
4. `WorldIntegrationBoot.ts`：
   - `model` 改为私有字段，不再在编辑器里绑定。
   - `start()` 先建参考角色和导航 UI，把按钮全部隐藏，状态牌显示“世界加载中…”，然后调 `loadWorld()`。
   - `loadWorld()`：`assetManager.loadBundle('region_island')` → `assetManager.loadAny({uuid: 498b3fa5-…@87291})` → `mountWorld()`（就是原来 start 里创建 `WorldNativeComposition` 和挂 `__worldIntegration` 的那两行，逻辑不变）。
   - 失败时状态牌显示“世界加载失败，点这里重试”，点一下重新加载；有防重入（loading 标记）；每个异步回调都先判 `isValid(this.node)`，场景切走后不再继续挂载。
   - 按钮在世界挂载前保持隐藏，挂载后由原来的 `paintNavigation` 接管显示。

## 合入后需要 Oi 在编辑器里确认（not_run）
- 打开工程让编辑器重新导入，确认 `region_island` 在属性面板显示为 Bundle，GLB 子资源 UUID 没变。
- `FirstsliceImport.scene` 仍直接引用该预制体：它是导入验证场景，**不要勾进微信构建**。
- 构建配置：阶段 A 把 `region_island` 设为“小游戏分包”；阶段 B（COS 就绪）改成“远程包”并配置 `remoteServerAddress`。
- 浏览器预览 + 微信开发者工具：正常进入世界、断网时出现重试提示且点击能恢复、主线 190 + R5 100 回归（E7）。
- `tools/audit_camera_proxy_surfaces.py` 里写死了 `assets/resources/firstslice/combined_collision_proxies.json`，合入后要改成 `assets/bundles/region_island/`（工具在工程外，不在本补丁里）。
- 测试工具里如有直接读 `__worldIntegration` 的脚本，现在它要等世界加载完才存在，可能需要加等待。

## 已验证 / 未验证
- 已验证：TypeScript 语法检查通过（缺少 `cc` 类型声明导致的报错不算；另有一条 `Result.reason` 类型报错是原代码已有的）；场景 JSON 中已无 `498b3fa5`；文件移动前后 SHA256 不变。
- 未验证：Cocos 导入、运行、构建、主包实测体积、真机。等 Cocos 账号登录后在这台电脑上实测。
