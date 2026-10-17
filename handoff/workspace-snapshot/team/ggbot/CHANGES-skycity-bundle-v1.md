# 改动说明：region_skycity bundle 和统一的区域加载入口（GGbot，2026-10-09）

补丁：`patches/0003-region_skycity-bundle-shared-RegionLoader-GGbot.patch`，基于 0001 和 0002，工作副本是 `work/ggbot-island-bundle/`，原工程没动。补丁里带了 7.36 MB 的 GLB 二进制。

## 改了什么
1. 新建 `assets/bundles/region_skycity/`，是一个 Bundle（`region_skycity`）。`art/skycity/v0.2/export/skycity_v0_2.glb` 按命名规则改名为 `env_skycity.glb` 放进去，版本号不写在工程文件名里。**这个 GLB 没有 .meta**，要由编辑器导入时生成。
2. 新增 `assets/scripts/region/RegionLoader.ts`，所有区域都走这一个入口：
   - `REGIONS` 表：`island` 和 `skycity` 各自对应 bundle、预制体 UUID 或名字、要循环的 clip。
   - `loadRegionPrefab(def)`：先加载 bundle，再加载预制体。有 UUID 就用 UUID；还没有 UUID 时，在 bundle 里按名字 `env_skycity` 查找。失败时抛出异常，由调用方显示重试。
   - `mountRegion(def, prefab, parent)`：实例化后挂上 `RegionAmbientAnimation`。天空之城配置的是 `clipNames=['robot_idle']`，只有一个 clip，所以保留烘焙模式。
3. 海岛的加载改成走 `RegionLoader`，行为和 0001 一样：加载中有提示，失败可以点重试。`WorldFlowComponent` 的 clip UUID 改为从 `REGIONS.island` 读取。
4. 调试入口：`__regionDebug.mount('skycity')` 会把天空之城挂到当前场景里，方便在浏览器预览中检查，也可以用 Playwright 跑。**还没接进世界流程**，主页或地图怎么进天空之城，由 Oi 在集成时决定。

## 构建配置
- `region_skycity` 直接设为“远程包”（7.36 MB）。COS 准备好之前，可以先临时设成小游戏分包来测试，但海岛加天空之城加起来会占掉总包 20 MB 里的一大块。
- 远程包需要填 `remoteServerAddress`，并且 COS 域名要加进微信 downloadFile 的合法域名（这一步要 Funning 操作）。

## Oi 需要在 Cocos 里确认的（not_run）
- 导入 `env_skycity.glb` 后，把预制体 UUID（`…@xxxxx`）填进 `REGIONS.skycity.prefabUuid`。在填之前用的是按名字查找，这个方式还没验证过。
- 确认 glTF 预制体自带的 SkeletalAnimation 带有 `robot_idle`，用 `__regionDebug.mount('skycity')` 检查机器人在不在动。
- 导入检查：`tools/art_import_check.py` 跑 v0.2，同屏三角面全部 after 是 119,273，全部 before 是 119,853；GLB 7.36 MB 只能走远程包。
- 我这边只做了 TypeScript 语法检查（报错都来自原工程已有文件的配置项）。
