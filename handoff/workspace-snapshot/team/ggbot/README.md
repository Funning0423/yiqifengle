# GGbot 交付 · 第一批（2026-10-09）

## 内容
- `ASSET-LAYOUT-AND-NAMING-v1.md`：主包/分包/远程包目录与命名规则。
- `tools/glb_budget_check.py`：GLB 预算检查脚本（只用 Python 标准库）。
- `reports/combined_visual_m-budget-v1.md` / `.json`：对 `combined_visual_m.glb` 的检查结果。
- `PLAN-move-combined-glb-out-of-main-v1.md`：把它移出主包的方案（只写方案，工程未改）。

## 怎么验证
`python3 tools/glb_budget_check.py <glb> --out reports/<名字>`；可用 `--budget x.json` 覆盖预算。退出码 1 表示有红灯。

## 结果摘要
三角面 74,799、draw call 估算 24、最大贴图 1024、显存估算 3.3 MiB 都在预算内；唯一红灯是文件 5.94 MB 超主包 4 MB。

## 第二批（同日）
- `CHANGES-island-bundle-v1.md` + `patches/0001-…patch`：region_island bundle 与运行时加载的实现，工作副本在 `work/ggbot-island-bundle/`。

## 已知问题 / 没测的
- 全部是静态分析，没有 Cocos 导入、构建或真机数据（not_run）。
- draw call 是未合批估算；Cocos 导入后包体以构建产物为准。
- 主包剩余体积（引擎+脚本）还没有构建数据。

## 第三批（同日）
- `patches/0002-…patch` + `CHANGES-island-ambient-animation-v1.md`：海岛 12 套骨骼动画循环播放，新增通用组件 `RegionAmbientAnimation`，支持多个 clip 同时播放。
- `tools/art_import_check.py`：美术导入检查脚本，检查 Y-up 和朝向、单位、缩放和 K、命名、骨骼数（默认 ≤22，可用 `--max-bones` 改）、每顶点权重 ≤4、扩展和 clip，并附带面数和贴图预算。角色和场景会自动识别，也可以用 `--kind chr|env` 指定。
  用法：`python3 tools/art_import_check.py <a.glb> [...] --out reports/<名字>`；有红灯时退出码为 1。
- `reports/art-import-check-smoke-v1.md`：拿游戏内海岛 GLB 和 skycity v0.2 试跑的结果。

## 第四批（同日）
- `patches/0003-…patch` + `CHANGES-skycity-bundle-v1.md`：新增 `region_skycity` 远程包和统一加载入口 `RegionLoader`（海岛也改成走这个入口），天空之城循环播放 `robot_idle`。只做了语法检查，Cocos 里 not_run；天空之城预制体的 UUID 要等编辑器导入后填。
- `ASSET-LAYOUT-AND-NAMING-v1.1.md`：新增 `amb_`、`state_` 前缀，`audio_bgm_<区域>` 和 `audio_amb_<区域>` 走远程包。
- `patches/e8/…patch` + `CHANGES-E8-portable-tools-v1.md`：E8，测试脚本路径改为通过环境变量配置（`tools/qf-env.cjs`）。Linux 上 Playwright 和 Chromium 已跑通；浏览器回归测试 not_run，要等有 web 构建；`check_persistence_local` 有一条断言看起来是测试过期了，待 Oi 确认。

## 第五批（2026-10-10）
- `patches/e8/0002-…patch`：修好了过期的 `check_persistence_local`。补上了 `./MainlineHost` 的导入；对 world-report-fix 基线的字节比对改成可选，通过 `QF_WORLD_REPORT_FIX_BASELINE` 指定，不设就记为 not_run；evidence 目录会自动创建。在 Linux 上跑的结果是 PASS_LOCAL_LOGIC_ONLY，证据在 `reports/e8/local-wiring-check-linux.json`。
- `reports/meadow/MEADOW-TECH-PRESTUDY-v1.md`：风车草甸技术预研，包括扩展和风 shader 的支持情况、合批方案和 draw call 估算、天空贴图降级方案，每一项都标了 passed/failed/not_run。
- `tools/extract_gpu_instances.py`、`reports/meadow/meadow_instances_v0_8.json`、`prototypes/MeadowInstancer.ts`：Cocos 侧实例化的原型，not_run。
- `reports/meadow/sky/`：天空贴图 2048×1024、2048×512、1024×512 三个版本和对比图。
