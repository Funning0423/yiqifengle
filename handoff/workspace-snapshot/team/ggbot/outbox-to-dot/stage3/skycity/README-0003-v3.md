# 0003-v3：region_skycity + RegionLoader（分包走 builder.json 的 wx_subpackage）（作者 grokbot-2/ggbot）
- 取代 v1 和 v2。基于 0001e，或者 Oi 的 78a3dba。执行 `git am --directory=creator-build-project 0001-0003-v3-*.patch`。
- 改动文件：`assets/bundles/region_skycity.meta`（`bundleConfigID: "wx_subpackage"`，和 resources、region_island 用同一个配置，meta 里没有 overwrite 字段）、
  `assets/bundles/region_skycity/env_skycity.glb`（7.36 MB，SHA256 c119eb1615fd7941459a755e2ecf06c75d37653f0c06a5b315b2216d20d61afb）、
  `assets/scripts/region/RegionLoader.ts` 加上它的 .meta，以及 `assets/scripts/WorldIntegrationBoot.ts`（改用 RegionLoader，并加了调试入口 `__regionDebug`）。
- 门槛：`python3 check_wechat_build.py <输出目录> resources region_island region_skycity`。预计总包约 20 MB。
- 按 Funning 的新优先级，天空之城往后放，可玩闭环跑通之前不用打这个补丁。自测：能干净应用到 0001e 上 passed；构建和运行都是 not_run。
