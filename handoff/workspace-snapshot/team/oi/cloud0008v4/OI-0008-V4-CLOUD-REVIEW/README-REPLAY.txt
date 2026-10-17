0008-v4 最小独立复现包（云端假 CLI / VM / 临时文件）

先读 REVIEW.txt。供应方源码未改；当前源码仍有 7 个新增反例误放行，故 new-replay 的安全回归应退出 1。不要将复现失败误看成“运行工具失败”，也不要把 mock 健康 PASS 看成真实 DevTools 通过。
无 node_modules、无安装、无联网；需已有 Node 与 Python3，finalizer 单测另需已有 Git。本次 Node 版本见结果 verdict.json。

内容
source/：执行所需的原样工具、finalizer reference/patch，以及本次运行的供应方单测和游戏相关文本 fixture。
replay/：我方原 21 场景；原假输入不变，只改 v4 固定 SHA/安全期望，并加强 exit/非空关闭动作断言。
new-replay/：12 个独立新增/对照场景；每场景记录 expected/expectedExit/ok，任何安全期望不符即 exit1。
probe-quit.cjs：QUIT_FIRST=1 必须在启动 CLI 前 BLOCKED/2 的探针；目标只能是假 CLI。
results/：本次实际输出；每个场景的冻结 manifest 保持原样。
inputs/：实际原始日志字节（含 0xE4 / 0xFF）与 fake CLI 动作；没有副本 build、历史大包或凭证。
SOURCE-SHA256SUMS.txt：原样供应方 source 全量 SHA。
SHA256SUMS.txt：本证据包文件 SHA，排除自身。

复跑（在解包后的根目录；输出目录必须不存在或为空）
1. python3 verify.py
   或 sha256sum -c SHA256SUMS.txt
   sha256sum -c SOURCE-SHA256SUMS.txt
   如环境没有 sha256sum，可用 Python hashlib 校验，不要跳过源码版本核对。
2. chmod +x replay/fake-cli.cjs new-replay/fake-cli.cjs
   （ZIP 提取器若保留执行权限则无需这步；只改云端假 fixture。）
3. node replay/replay.cjs /tmp/0008-v4-old21-UNIQUE
   预期：21 行全部符合，进程 exit0；summary.json 写 source SHA、status、exit、manifest。
4. node new-replay/replay.cjs /tmp/0008-v4-new-UNIQUE
   对本次原样 v4 预期：7 行 DEFECT、5 行 OK；进程 exit1。
   6 行错误 PASS/0，加 1 行错误特殊放行/3。修后应全部 OK/exit0；审查新版本必须先独立核 SHA，不能绕过此包固定 pin。
5. node probe-quit.cjs /tmp/0008-v4-quit-result-UNIQUE.json
   预期探针 exit0；其中被测 audit 为 BLOCKED/2，cliWasInvoked=false。
6. 可选复跑本次四套供应方测试：
   node source/test/test_finalizer_0008v2.cjs /tmp/v4-finalizer-UNIQUE.json
   node source/test/test_shim.cjs
   node source/test/test_log_tailer.cjs /tmp/v4-tailer-UNIQUE.json
   node source/test/test_rules_v4.cjs /tmp/v4-rules-UNIQUE.json
   node source/test/oi-replay-v4/test_boundaries.cjs /tmp/v4-tail-boundary-UNIQUE.json
   预期 33/33、8/8、20/20、12/12，tail-boundary 检测到不完整。

验证已有场景证据：
node -e 'const a=require("./source/tools/wechat_first_open_audit.cjs"); const r=a.verifyManifest(process.argv[1]);console.log(r);process.exit(r.ok?0:1)' results/new-boundaries/prefix-error-before-log

每次运行会新建唯一 copy/token，时间和绝对路径不同属正常，不能期待与保存结果逐字节相同；比较输入语义、源码 SHA、status/exit、明确 missing/errors、own-only close 与 manifest。
实际结果里的旧云端绝对路径只是生成时的证据元数据，不需要这些目录存在。上述命令的 source/ 和 fake 模块路径都从本包相对位置解析，不依赖原云端目录。
不要直接以默认路径运行 source/tools/wechat_first_open_audit.cjs；复现须用本包 runner，它们明确绑定假 CLI 和假 automator。不要指向用户 Mac、真实 CLI 或生产构建。
