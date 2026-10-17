0008-v3 独立审查最小证据包

先读REVIEW.txt：当前仍存在假PASS，不是验收通过包。

环境与安全
需要已安装Node.js（本次v24.19.0）及git用于finalizer单测；不需要npm install、网络、账户、Mac、微信工具或真实miniprogram-automator。所有审查复跑使用本包fake CLI/Node VM/临时文件。
不得把fake CLI换为真实工具，也不要执行source/README里的真实Mac操作步骤。本次未设置全局退出开关运行；只静态查其入口拒绝及跑spawnCli拒绝quit单测。

从本包根目录复跑独立21场景：
chmod +x replay/fake-cli.cjs
node replay/replay.cjs

脚本会建立全新临时输出目录并打印Evidence directory，输出21个场景的结果。也可给一个不存在或空的输出目录：
node replay/replay.cjs /tmp/0008-v3-review-new

脚本固定v3 audit完整SHA，拒绝其他源码版本。它断言本次观察到的结果，包括已确认的缺陷行为；复跑exit0表示证据可重现，绝不表示21场景都满足产品验收。修订工具时需另写修后正向判据，不应把这些假PASS预期继续作为新版本验收标准。
整个复跑约35秒，仅本地模拟。源文件保持不变。每场景原工具manifest在进程结束后重新核验，且assert每次close目标是自身唯一副本；若发生不一致脚本报错。

局部日志/分类边界：
node replay/test_boundaries.cjs

默认写replay/boundary-results.json，可传第二位置参数指定结果路径。这个测试证明同inode/同大小/同4KiB前缀的后段改写漏检；不宣称真实DevTools采用该改写协议。

可重跑v3携带的原单元测试（均不调用真实工具）：
node source/test/test_finalizer_0008v2.cjs /tmp/0008-v3-finalizer-results.json
node source/test/test_shim.cjs
node source/test/test_log_tailer.cjs

预期33/33、8/8、15/15。第一个文件的v2名称代表v3仍沿用的finalizer补丁；不会执行撤回v2 auditor。本包故意不包含v2-baseline、v2-v3对比测试、原作者历史selftest大目录或真实automator依赖。

内容
- source/：v3所需原工具、沿用的finalizer补丁/reference、三个原单元测试和其必要fixtures，源内容原样保留。
- replay/：本次独立可移植模拟脚本与局部边界结果。
- results/：本次21场景实际生成的最小证据目录、stdout/stderr和summary；为保留每场景原manifest，目录内文件原样保留。fixtures生成目录未打包，脚本可重建它们。
- evidence/：下载/内清单覆盖、源未改、真实12ef697 finalizer、副作用及原单测结果。
- SOURCE_PROVENANCE.json：确认的Drive来源和所附源文件完整SHA。
- SHA256SUMS.txt：交付顶层完整清单。请复跑前先核验；复跑若写入包内结果会改变快照。

没有完整工程、凭证、用户存档、美术素材或任何真实运行通过声明；原fixtures里的E/F/G记录只作为输入证据，不代表本次现场复验。
