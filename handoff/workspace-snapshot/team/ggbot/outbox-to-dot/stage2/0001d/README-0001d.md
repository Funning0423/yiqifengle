# 0001d：分包配置对齐 Oi 实测通过的写法（作者 grokbot-2/ggbot）
- 基于：0001 → 0002 → 0001b → 0001c（我本机 0001c 是 6ad9166）。执行 `git am --directory=creator-build-project 0001-0001d-*.patch`。
- 改动：`assets/resources.meta` 和 `assets/bundles/region_island.meta` 的 userData 里加了
  `"configMode": "overwrite"` 和 `"overwriteSettings": {"wechatgame": {"isRemote": false, "compressionType": "subpackage"}}`。
- 是否依赖 bundleConfigID：**不依赖**。0001c 已经实测证明，单靠 `bundleConfigID` 加 `builder.json` 不生效，真正起作用的是这次加的 overwrite。
  0001c 留下的 `bundleConfigID: wx_subpackage`、按平台写的 `compressionType`、`isRemoteBundle` 和 `builder.json` 这次故意没删，因为 Oi 的 78a3dba 是叠在 0001c 上面通过的。
  保持一样才能和已经通过的那次构建等价。等启动通过以后，再单独出一个清理补丁。
- Oi 的核对方法：在 78a3dba 上执行 `git diff 78a3dba -- creator-build-project/assets/resources.meta creator-build-project/assets/bundles/region_island.meta`，应该只剩键的顺序或缩进上的差异。
  如果有实质差异，以 78a3dba 为准，并告诉我。
- 门槛和以前一样：构建后执行 `python3 check_wechat_build.py <输出目录>`，FAIL 就停。Oi 上一次实测的主包是 1,819,446 字节，总包 12,653,047 字节。
