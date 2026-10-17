0008 最小可复跑审查证据

结论：当前 audit 的 PASS 不足以验收真实首次打开。6 条云端隔离复现显示目标错误漏检、阳性对照污染、CLI 错误忽略以及最终证据清单失效。完整结论见 results/REVIEW-0008.txt。

目录
- source/：候选工具及测试输入原样副本。没有修改候选源代码；包含作者 README 和伪 diff，便于核对，但请勿执行其中真实 Mac 操作建议。
- replay/：本审查编写的可移植复现。SOURCE 由 __dirname 相对定位，无本机绝对路径依赖。
- results/：2026-10-09 实际运行结果。5 组短复现 + 1 组长生命周期 CLI 复现；原单测和语法检查结果；每组保留必要 manifest/源配置/变体/通道输出，可核查自己的 SHA 清单。

安全范围
只在云端隔离环境运行下面的复现命令。fake CLI 拒绝 quit 等未允许命令；不打开真实 DevTools，不用真实 Mac，不杀进程，不开启任何网络 socket、不连接外网、不需要 npm install、不上传或发消息。所有 QF_* 关键选项由复现固定到本包 fake CLI/VM，QF_DEVTOOLS_QUIT_FIRST=0。请不要换成真实 CLI 或真实 automator。

运行环境
Node.js（支持 fs.cpSync 的版本；本次记录见 results/environment.txt）。仅使用 Node 内建模块，零新增依赖。Linux 云端已测；本包不声称 Windows 或真实 Mac 流程已测。

复跑命令
先 cd 到本文件所在的 0008 目录。可直接执行：

node replay/reproduce-audit-gaps.cjs
node replay/reproduce-lingering-cli.cjs

每次自动创建独立临时目录，最后打印 Evidence directory。也可传入一个不存在或完全空的输出目录；为防旧证据混入，非空输出目录会被拒绝。例如：

node replay/reproduce-audit-gaps.cjs /tmp/0008-short-review-new
node replay/reproduce-lingering-cli.cjs /tmp/0008-cli-review-new

第一条约 10 秒，运行 5 场景并补充日志边界/condition 测试；第二条约 22 秒，故意让假 CLI 保持 21 秒以证明 Promise.race 输出遗失与 manifest 写完后 run.log 被追加。无真实进程需要关闭。

预期：两条复现命令自身应 exit 0，表示缺陷成功复现。被测工具在这些场景给 PASS/exit 0 恰恰是被验证的错误行为，绝不是微信首开通过。

原作者单元测试可独立重跑：

node source/test/test_first_open_condition.cjs
node source/test/test_shim.cjs

预期分别 22/22、5/5；它们只操作自建临时文件、VM 和假 finalizer。
不要运行 source/test/run_selftest.sh 或原 dry-run 来声称本次已测真实客户端；那套需要另行安装的 miniprogram-automator，本次没有重跑。其原自测历史输出未打入本最小包。

主要证据
- results/reproduction-summary.json：无对照无日志仍 PASS；首开创建日志目录漏错仍 PASS；日志截断漏错仍 PASS；其他项目日志伪造 A 阳性对照；CLI exit 7 仍 PASS。
- results/lingering-cli-result.json：21 秒假 CLI 的错误输出未进入判定；结果 PASS；run.log 在 VERDICT 后更新，内部 SHA 清单失效。
- results/repro-cli-lingers/SHA256SUMS.txt：故意保留原工具生成的已失效清单。核验它预期只对 run.log 报不匹配。这是缺陷证据，不是交付损坏。
- results/delta-and-condition-results.json：超过 8 MiB 漏错、历史日志污染、WeappLog 根路径扫不到、缺 list 的未知 condition 被当空覆盖。
- results/unit-condition-result.json / unit-shim.txt / syntax-check.txt：原基线测试的本次实际通过情况。

结果中绝对路径是当时的原始证据路径；重新执行不依赖那些路径。重新执行生成的所有日志会使用当前机器路径。
source 内附带 fake server/原 dry-run 输入是完整测试来源，仅本包 replay 两脚本不使用它们；不会附加原始 selftest/dryrun 历史大包。
