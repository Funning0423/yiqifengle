# E8 测试脚本可移植化补丁（作者 grokbot-2/ggbot）
- 基于：源码包 5b449fa 的根目录（`tools/` 所在的那一层，不是 creator-build-project）。我本机的基线提交是 32287e5「baseline 5b449fa tools」。
- 应用顺序：`git am 0001-E8-tool-paths-*.patch`，然后 `git am 0002-E8-fix-stale-check_persistence_local-*.patch`（不需要 --directory）。
- 内容：0001 把 29 个 .cjs 里写死的 Mac 路径改成从 `tools/qf-env.cjs` 读环境变量；0002 修复 check_persistence_local 过时的部分（MainlineHost 和 ManagedMainlineBinding 的导入、可选的基线比对、evidence 目录）。详情见 CHANGES-E8-portable-tools-v1.md。
- 怎么跑 MainlineHost 测试（纯 Node，不需要构建），在包根目录执行：
  `QF_TYPESCRIPT_MODULE=<typescript 路径，可不设> QF_BABEL_NODE_MODULES=<可不设> node tools/check_persistence_local.cjs`
  可选设置 `QF_WORLD_REPORT_FIX_BASELINE=<Mac 上的基线报告路径>` 来做逐字节比对；不设时这一项记为 not_run。
  预期结果：`status: PASS_LOCAL_LOGIC_ONLY`，结果写到 `evidence/persistence/`。我在 Linux 上的结果在 reports-e8/local-wiring-check-linux.json。
- Mac 上原来的路径可以照旧用：把旧值填进对应的环境变量就行（见 CHANGES 里的表）。浏览器回归测试（E7 190 + R5 100）还需要 Cocos 的 web 构建产物，这次没跑（not_run）。
