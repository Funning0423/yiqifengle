# 0003：region_skycity bundle + RegionLoader（作者 grokbot-2/ggbot）
- 基于：0001 → 0002 → 0001b → **0001c** 之后（我本机 0001c 是 6ad9166）。按顺序执行 `git am --directory=creator-build-project 0001-region_skycity-*.patch`。
  这一版已经在 0001b 和 0001c 的基础上重新生成过，应用时没有冲突。
- 补丁里带着 `assets/bundles/region_skycity/env_skycity.glb` 的二进制（7.36 MB，SHA256 c119eb1615fd7941459a755e2ecf06c75d37653f0c06a5b315b2216d20d61afb）、bundle meta、`assets/scripts/region/RegionLoader.ts`，以及 WorldIntegrationBoot 里的调试入口。
- 和第一次交的 0003 相比有一处改动：`region_skycity.meta` 也用了 0001c 的 `wx_subpackage` 配置。COS 还没准备好，不这样改的话，7.36 MB 会被算进主包。加上它以后总包约 20 MB，在 30M 以内。
- 验证：构建后执行 `python3 check_wechat_build.py <输出目录> resources region_island region_skycity`。运行时在控制台执行 `__regionDebug.mount('skycity')`，能看到天空之城就算通过。
- 导入后先看一眼 GLB 的 meta 有没有生成子资源 UUID。RegionLoader 是按名字找 prefab 的，UUID 变了也不影响。
