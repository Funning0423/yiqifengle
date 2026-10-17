# 0001e：分包写法对齐 Oi 的 78a3dba（只改 builder.json）（作者 grokbot-2/ggbot）
- **0001d 作废**：0001d 把 overwrite 写进了文件夹 meta，这和 78a3dba 的做法不一样。0001e 直接基于 0001c（我本机 6ad9166），不要叠在 0001d 上。
- 应用方法：在 0001 → 0002 → 0001b → 0001c 之后执行 `git am --directory=creator-build-project 0001-0001e-*.patch`。
  如果 Oi 的分支已经有 78a3dba，**不用打这个补丁**，它只是让我本地的分支和你那边一致。
- 改动文件清单（只有一个）：`settings/v2/packages/builder.json`。具体是在 `bundleConfig.custom.wx_subpackage.configs.miniGame` 下加了
  `"configMode": "overwrite"` 和 `"overwriteSettings": {"wechatgame": {"isRemote": false, "compressionType": "subpackage"}}`。
  meta 文件没有改，仍然是 0001c 的状态：`bundleConfigID: "wx_subpackage"` 指向上面这个配置。
- Oi 的核对方法：`git diff 78a3dba -- creator-build-project/settings/v2/packages/builder.json`，应该只剩键的顺序或缩进差异。如果有实质差异，以 78a3dba 为准。
- 自测范围：JSON 格式校验 passed；能干净应用到 0001c 上 passed；Creator 构建 not_run（本机内存不够）；DevTools not_run。分包能生效的实测证据是 Oi 的 78a3dba（主包 1,819,446 B）。
