# r5-skyground r3-d — 共用材质运行时修复

- 日期：2026-10-20；分支 `fx/r5-skyground-r3`，基线 HEAD `2fb15680`。
- 本次范围：只修材质查找、补回归测试、执行 Node 测试与 manifest 校验。

## 根因与构建证据

- PM 在真实 web-test 构建进入天空城时遇到 `skycity-shared-palette-missing`。
- `env_skycity.glb` 的基础材质实际名为 `M_sky_palette`；新云海 GLB 才使用 `M_env_palette`。
- 天空城还有 `M_sky_cloud`、`M_sky_palette_emissive`、`M_sky_foliage_cards`、`M_sky_rock_strata`。
- 构建 `2fb15680` 的 `assets/region_skycity/import/04/04fa3a1d3.json` 序列化材质名同样是 `M_sky_palette`，启用 `USE_VERTEX_COLOR` 和 `USE_ALBEDO_MAP`。
- 同一构建的 `import/01/01ce12f16.json` 中，新云海材质名是 `M_env_palette`。
- 原逻辑在天空城实例里严格搜索 `M_env_palette`，因此必然找不到；不是异步加载顺序问题。

## 改动与原因

- `SkycityCloudsea.ts` 改为精确查找 `M_sky_palette`，把天空城原有 shared Material 实例赋给云海。
- 不克隆、不重命名材质，不改 GLB；精确匹配避免误选发光、植被或岩层材质。
- 已检查 `RegionLoader`：先准备云海 prefab，再挂载天空城和云海；保留现有加载、失败清理及生命周期逻辑，无需改动。
- `test_sky_cloudsea.cjs` 从真实天空城 GLB 读取材质名，在子节点 renderer 中放入全部五种材质，断言云海共享的是基础 palette 对象。
- 增加经 `loadRegionPrefab` / `mountRegion` 成功挂载的回归路径，同时保留缺材质失败清理及引用释放检查。
- `text-MANIFEST-SHA256.json` 更新脚本哈希，并补齐基线已跟踪但漏列的两个 `.meta` 条目。

## 验证

- 回归测试修改后、生产修复前：复现 `skycity-shared-palette-missing`；修复后单测 PASS。
- 单测数据：98,840 triangles / 100,000 上限，49 primitive 上界；这些不代表实测 DC。
- 完整 run-suite：140 项，139 PASS；仅 navigation-guard 为允许的 BLOCKED_BROWSER，0 FAIL。
- journey-types：PASS（TypeScript 5.8.2），0 diagnostics；sky-cloudsea：PASS。
- 本次证据：`docs/r5/skyground-r3/evidence/r3-d-suite.json`、`r3-d-sky-cloudsea.txt`、`r3-d-journey-types.json`。
- `node tools/test_manifests.cjs`：PASS，assets 283/283、text 893/893。
- 测试使用 Creator 随附 TypeScript 模块，仅加载编译器；未启动 Creator、打包、起端口或截图。
- 未提交、未打 bundle、未推送；现有 web-test 产物未修改，仍是修复前构建。
- 运行时重建与真实构建 qaShot 复核由 PM 执行；本次 Node 测试不能替代 WebGL/视觉验收。
