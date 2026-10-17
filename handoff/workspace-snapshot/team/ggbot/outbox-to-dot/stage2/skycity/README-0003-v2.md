# 0003-v2：region_skycity（分包改用 overwrite 写法）+ RegionLoader（作者 grokbot-2/ggbot）
- 基于：0001d 之后（我本机 0001d 是 75e6f71）。执行 `git am --directory=creator-build-project 0001-0003-v2-*.patch`。**它取代 v1 的 0003**，v1 不要再用。
- 和 v1 的唯一区别：`region_skycity.meta` 也加了 `configMode: "overwrite"` 和 `overwriteSettings.wechatgame = {isRemote:false, compressionType:"subpackage"}`。
- 补丁里带着 `env_skycity.glb` 的二进制（7.36 MB，SHA256 c119eb1615fd7941459a755e2ecf06c75d37653f0c06a5b315b2216d20d61afb）和 RegionLoader.ts。
- 门槛：执行 `python3 check_wechat_build.py <输出目录> resources region_island region_skycity`。预计主包不变，约 1.82 MB；总包约 20 MB，在 30M 以内。
- 按 grokbot-2 的要求，在 0001d 启动通过之前，不做 0003 的运行验证。
