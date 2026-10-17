# 0008 v3 · 微信开发者工具首开 console 审计（基于 v2，按云端复核修验证器）

GGbot（grokbot-2）· 2026-10-09 · Creator 3.8.8 / DevTools Stable 2.02.2608080 / 基础库 3.17.3 / AppID wx3bdd911c5c06f591
基于 0008 v2（**不是** v1）。finalizer diff 与 v2 **完全相同**（`0008-v2-finalize_wechat_local.patch`，见 §6），本版只改审计工具与测试。不碰游戏脚本、R6 修复；不上传、不预览、不发布；不调用全局 quit。

## 0. 更新记录 v2 → v3

| 项 | v2 | v3 |
|---|---|---|
| 判定原则 | 有若干通道缺失仍可 PASS | **证据缺失/未证明/不完整一律 BLOCKED，绝不 PASS** |
| 阳性对照 | 无（依赖“之前某次跑过”） | **同一项目、同一会话内的 canary**：测试副本 shim 在启动时和 ping 时各打一条 `console.error("[QF-AUDIT-CANARY(-LATE)] <本次token>")`；automator、shim、WeappLog 每个必需通道都必须看到**本次 token** 的 canary 才算证明 |
| WeappLog 采集 | 开始/结束两次按路径+大小快照；只读前 8 MiB；根目录就是 WeappLog 时扫不到；截断/轮转漏读 | 运行期间每 200 ms 轮询的 tailer：按 dev+inode 跟踪（跟随改名）、无单文件上限（总预算 256 MiB，超出=不完整）、跨块 UTF-8/行拼接、检测截断/原地重写（前 4 KiB 指纹）/替换/消失；根目录可直接是 WeappLog；运行中才出现的根也能读；任何可能缺口记入 `incomplete` → BLOCKED |
| 归属 | 根目录下所有日志都算自己的 | **行级归属**：只有带本项目标记（副本绝对路径、唯一 projectname、本次 token）的 WeappLog 行算本项目；无法归属的错误/提示 → BLOCKED（不能证明，也不能忽略） |
| 其它窗口 | 可污染对照；README 建议 `QF_DEVTOOLS_QUIT_FIRST=1`（会关掉所有窗口） | **全局 quit 已删除**（CLI 白名单不含 quit，设置该变量直接 BLOCKED）；只对自己打开的唯一副本执行 `cli close --project <副本>`；其它窗口不动（dry-run 第 23 例验证） |
| 自己的 CLI | `Promise.race(15 s)` 后丢弃仍在运行 CLI 的全部输出；退出码、close 结果不参与判定 | CLI 子进程启动即挂监听、实时缓冲；关闭自己的项目后最多等 `QF_CLI_DRAIN_MS`（默认 30 s），仍在运行则只终止**这个**子进程并 BLOCKED；`cli auto` 非零/超时/错误、`cli close` 非零都 → BLOCKED；输出中的错误照常 FAIL |
| 证据冻结 | verdict/manifest 写完后长驻 CLI 仍会追加 run.log | 顺序固定：关闭自己的副本 → 等/终止所有自己的 CLI 子进程 → 停 tailer → 关闭 run.log → 写 verdict.json → 写 manifest/SHA256SUMS → **重新逐个校验**（stdout `selfCheck`，失败 exit 2） |
| shim 自证 | 只看 late heartbeat | 另要求：error/warn/log 包装在读取时仍生效（`stillWrapped`）、wx.onError/onUnhandledRejection 已注册、缓冲无溢出（`dropped=0`）、启动 canary |
| 其它 | — | 证据目录必须为空/不存在（防旧证据混入）；runId 毫秒+随机；构建目录含符号链接 → BLOCKED；数值环境变量越界 → BLOCKED；`QF_FIRST_OPEN_IGNORE_ERROR_REGEX` 删除；允许名单下即使提示无法归属也只给 `PASS_WITH_ALLOWLISTED_IDE_NOTICE`，绝不普通 PASS |
| 证据 | — | README 加入 Oi 的 E/F/G；H1/H2 按 E 改写（§1–2） |

## 1. 结论（E/F/G 之后）

**这条红字是开发者工具自己的启动页检查提示，与游戏代码/Cocos 无关，也与 condition 字段无关；项目文件改不掉；对游戏功能无害。**

| 运行 | 内容 | condition | enhance | 红字 | 说明 / 出处 |
|---|---|---|---|---|---|
| **E 首开** | **纯 wx canvas，无 Cocos**（game.js 只画一块底色并打印 marker） | 无 | false | **有** | `WAGame.js:1 OI_MINIMAL_CONTROL_E_READY` 之后紧跟红字（r6efg/console-raw.txt） |
| E 重开（仅该窗口 close+open） | 同上 | 无 | false | 无 | e-reopened(-settled)-console.txt |
| F 首开 | 同 E 字节 | 官方完整空模板 | false | 无效采集 | 面板空白、剪贴板陈旧，不能判 |
| F 重开 | 同上 | 官方完整空模板 | false | 无 | f-reopened-console.txt |
| G 首开 | 当前 R6 Cocos/音频产物 | 官方完整空模板（game 含 currentL） | false | 无效采集 | 面板空白，不能判 |
| **G 重开** | 同上 | **官方完整空模板** | false | **有** | 之后 LoadScene、首页正常（g-reopened-console.txt） |
| A / audio | R6 产物 | 无 | true | 有 | audio-startup-console-raw.txt |
| D | R6 产物 | 无 | false | 有 | noenhance-d-settled-console.txt |
| B 重开 | R6 产物 | 手填 game/miniprogram | true | 无，但 game.js 先崩 | 不可作对照 |

证据（单测逐条断言，标注“证据”）：
1. **证据**：E 没有任何 Cocos/引擎代码，照样出现逐字相同的红字 → 不是游戏/引擎抛的。
2. **证据**：G 恢复官方完整空 condition 仍出现；A/D 删除 condition 也出现 → 与 condition 有无/内容无关，**改 condition 修不好**。
3. **证据**：Oi 只读追踪安装包源码：文案是 `JSON_CUSTOM_COMPILE_PATH_NOT_EXISTS: 'app.json 中未定义自定义编译中指定的启动页面 %s'`，在模拟器启动步骤里 `const C=d.path; … O=ee(0,p,d); O.realNotFound && display(DISPLAY_ERROR, …format(C))` 之后才进入 `RUNTIME_STEP_1_LAUNCH`。我们看到的文本 `%s` 处为空 → IDE 用**空启动路径**做了小程序式启动页检查。
4. **证据**：红字之后游戏照常（A/D/G 均有 LoadScene，G 显示首页）→ 功能无害。
5. **证据**：E 首开红、E/F 重开不红、G 重开红 → 它不是“每次 CLI 打开必出”，触发与否取决于打开时的 IDE 状态/时序。

## 2. 何时会出现：H1 / H2（仍是假设）

- **H1′（更新，主要）**：IDE 启动步骤里 `ee(0,p,d)` 的 realNotFound 判定与“是否小游戏 / app 配置何时读到”的先后有关（Oi 线索：`isGameApp` 读 `attr.gameApp`，启动流程里 `getAppConfig` 与运行属性更新的顺序）。若检查跑在“已知是小游戏/配置已就绪”之前，小游戏就被按小程序页面表（空）检查 → 报空路径。可解释：新目录首开（E/A/D）出现、轻量 E/F 重开不出现、较重的 G 重开出现。**未验证**，仅源码线索 + 现象吻合。v2 的“CLI 自动编译才会出”被 E 重开（也是 CLI open）不出现**削弱**，不再单独成立。
- **H2（削弱）**：同 AppID 的 IDE 状态。E/F/G 与 R6 同 AppID 同进程，E/F 重开不红 → AppID 状态本身不能必然触发；尚不能排除它与 H1′ 叠加。`diag-appid` 诊断保留（只改副本）。
- 两者若成立都在 IDE 内部，项目文件无可改之处（G 已证明 condition 不行；C/gameRoot 已拒绝）。所以验收层面只能：**默认 FAIL**；Grok Bot/Oi 决定后可用 `QF_FIRST_OPEN_ALLOW_APPJSON_NOTICE=1` 精确放行这一句（→ `PASS_WITH_ALLOWLISTED_IDE_NOTICE`，exit 3，永不普通 PASS）。

给 Oi 的验证（都用新副本，不关其它窗口，不改全局偏好）：
- **V1（H1′ 时序）**：同一个 G 产物复制 3 份新目录：① CLI open 首开；② 同一目录 close 后**立即** open；③ close 后等 60 s 再 open。各自保存 Console 文本+截图，记录是否红字。再对 E 做同样三次。
- **V2（H2）**：`QF_FIRST_OPEN_CASES=default,diag-appid QF_FIRST_OPEN_DIAG_APPID=<可本地打开的测试 AppID>` 跑审计。
- **V3（通道核实，跑 v3 审计前必做）**：见 §4，确认真实 WeappLog 里能看到带本次 token 的 `[QF-AUDIT-CANARY]` 行，以及红字那行带不带项目路径/名称。

## 3. 窗口关闭与归属（v3 怎么做）

- 每个 case 复制到唯一目录 `QFFirstOpen-<UTC毫秒>-<4hex>-<6hex>-<case>`，并把副本 `projectname` 改成同名（DevTools 窗口标题即此名），shim 带 16 位随机 token。
- 只启动自己的 `cli auto --project <副本>`；结束时只执行 `cli close --project <副本>`（成功才算关闭；失败 → BLOCKED）；异常退出路径也会关闭自己登记过的副本。**从不调用 `cli quit`**（白名单里没有，设 `QF_DEVTOOLS_QUIT_FIRST` 直接 BLOCKED）。
- 自己的 CLI 子进程全部登记；收尾时等其退出，超时只终止这些子进程（不碰 DevTools 本体或其它进程）。
- 归属：automator（连在自己的端口）、shim（本次 token）、自己 CLI 子进程的输出 → 本项目；WeappLog 行**必须含**副本路径 / projectname / token 之一才算本项目；其它行即使是错误也只记为“无法归属”→ 不能证明 PASS、也不能被忽略 → BLOCKED。其它审计副本的 canary（token 不同）同样只记为无法归属。
- 已知局限：真实 WeappLog 行格式未核实。若 IDE 不把小游戏 console 写进 WeappLog，或写入时不带任何本项目标记，v3 会对**每次**真实运行给 BLOCKED（这是刻意的：缺证据不 PASS），需要 V3 核实后再定是否增加“会话块”归属规则。

## 4. 运行（给 Oi）

前置：仓库根 `npm i -D miniprogram-automator@0.12.1`；打 `0008-v2-finalize_wechat_local.patch`（v3 未改）；把本包 `tools/` 4 个文件放进仓库 `tools/`；Creator 新出一份 wechatgame 产物（不先跑 finalizer）。**不要**设 `QF_DEVTOOLS_QUIT_FIRST`。
```bash
export QF_WECHAT_BUILD_DIR=<新 wechatgame 输出>
QF_FIRST_OPEN_SCREENCAPTURE=1 QF_FIRST_OPEN_OUT=$PWD/evidence/first-open-0008v3/run1 node tools/wechat_first_open_audit.cjs; echo exit=$?
```
看 `verdict.json` 的 `variants[0].channels`：`weappLog.ownCanary`、`weappLog.ownLines`、`weappLog.incomplete`、`automatorConsole.lateCanary`、`shim.*`、`cli.*`；以及 `variants[0].unattributed`。stdout 最后一行的 `selfCheck.ok` 必须为 true。
**V3 通道核实**：在 `verdict-default/weapplog-tail.txt` 里搜本次 token（`verdict.json` → `variants[0].token`）与 `[app.json`，把这两类行原样发回。

## 5. 首开 Console 的确切预期（不变 + 测试副本专有行）

按顺序：`Wechat Lib:3.17.3, …` → `… GMT+0800 (中国标准时间) 接口提示` → HarmonyOS 3.7.0 提示（黄，允许）→ `WAGame.js:1 {batteryLevel…}` 或 `Object` → **已知 IDE 提示**（逐字：`[app.json 或自定义编译条件错误] app.json 中未定义自定义编译中指定的启动页面 (env: macOS,mg,2.02.2608080; lib: 3.17.3)`；默认禁止，仅 allowlist 下允许，带页面名的同类句子仍禁止）→ `cc.js? [sm]:1 LoadScene db://assets/scenes/WorldR5Integration.scene: <n> ms`（**必须**）。
仅审计测试副本额外出现：`[QF-AUDIT-HEARTBEAT(-LATE)] <token>`（log）与 **`[QF-AUDIT-CANARY(-LATE)] <token>`（红，本次 token，阳性对照，按 token 精确排除）**。Oi 手工打开的正式产物没有这些行。
禁止：@babel helper、prerequisite-imports、MiniProgramError、TypeError/ReferenceError/SyntaxError/RangeError/Uncaught/`Error: `、simulator launch failed、其它 `[…错误]`、编译失败/错误、wx.onError/未处理 rejection/automator exception、自己 CLI 输出中的上述内容。
计数：现在“红 1 黄 1”（审计副本再 +2 条红 canary）。

## 6. finalizer diff（与 v2 相同，未改）

`0008-v2-finalize_wechat_local.patch` 基于 Oi 12ef697（SHA 613273…6b09）。保留 compileType/AppID 断言、非空条件拒绝、`enhance=false`；只加：输出 `removedCondition`/`changed`、null 分支同信息拒绝、内容不变不写。v3 用 Oi 的真实 E/F/G 配置再测：输出与原版逐字节一致；本包模板 fixture 与 Oi G/F 真实官方模板 condition（含键序、currentL）完全一致。v3 没有理由改它。

## 7. 复核问题 → 测试 → v2 / v3 判定

详见 `selftest/review-findings-v2-vs-v3.txt` 与 `selftest/review-findings/<场景>/{v2,v3}/`（两版完整证据目录 + stdout/stderr）。v2 代码为 v2 包原件，放在 `test/v2-baseline/`（SHA 见 `V2-SOURCE-SHA256SUMS.txt`）。

| 复核 | 测试场景（test/test_review_findings_v2_vs_v3.cjs） | v2 判定 | v3 判定 |
|---|---|---|---|
| (a) 日志晚创建/截断漏检（P1-01/02） | a1 日志根目录本身就是 WeappLog + 仅写入 WeappLog 的错误 | **PASS（误判）** | FAIL |
| | a2 根目录运行中才出现 + 错误 | FAIL（v2 已修，作回归） | FAIL |
| | a3 运行中被截断后写入错误 | **PASS（误判）** | FAIL |
| | a4 运行中被截断、无错误 | **PASS（误判）** | BLOCKED（采集不完整） |
| | a5 9 MiB 之后的错误 | **PASS（误判）** | FAIL |
| (b) 其它窗口污染阳性对照（P1-03） | b1 本项目没写 WeappLog，别的窗口写了提示，allowlist 开 | **PASS_WITH_ALLOWLISTED（误判）** | BLOCKED（本项目 canary 未见） |
| | b2 同上，allowlist 关 | **FAIL（把别人的提示算成自己的）** | BLOCKED（无法归属 + 通道未证明） |
| | b3 只有别的窗口的正常行 | **PASS（误判）** | BLOCKED |
| (c) CLI 失败/长驻输出漏检（P1-04/05） | c1 `cli auto` 退出码 7 | **PASS（误判）** | BLOCKED |
| | c2 长驻 21 s 的 CLI 在第 3 s 打印错误 | **PASS（误判）且清单事后失效** | FAIL（cli.output） |
| | c3 `cli close` 退出码 5 | **PASS（误判）** | BLOCKED |
| (d) 无对照/无日志仍 PASS（P1-06） | d1 日志目录始终不存在 | **PASS（误判）** | BLOCKED |
| | d2 日志目录存在但没有本项目任何行 | **PASS（误判）** | BLOCKED |
| (e) 长驻 CLI 使日志与 SHA 清单不一致（P1-04 后半） | e1 长驻 21 s 的 CLI | **PASS，进程退出后 run.log 与 SHA256SUMS 不符** | BLOCKED（只终止自己的 CLI 子进程）；清单进程内自检 + 退出后复检均一致 |
| 对照 | z1 一切齐全 | PASS | PASS |

结果：15/15（13 个场景复现 v2 误判，a2 与 z1 为回归/对照）。v3 全部场景退出后 SHA256SUMS 复检一致。

## 8. 自测（Linux）与未测

| 项目 | 结果 |
|---|---|
| `node --check` 全部 .cjs/.js（18 个） | 通过，selftest/syntax-check.txt |
| finalizer diff + console 规则（含 Oi E/F/G 真实配置与 console；模板 fixture=Oi 真实官方模板；源码追踪文案） | **33/33**，selftest/unit-finalizer.txt |
| shim（canary、能力记录、溢出计数、console 被替换检测） | **8/8**，selftest/unit-shim.txt |
| WeappLog tailer / 自有 CLI 子进程 / manifest 校验 | **15/15**，selftest/unit-log-tailer.txt |
| 复核问题 v2-vs-v3 重放 | **15/15**，selftest/review-findings-v2-vs-v3.txt、selftest/review-findings/（每场景 v2、v3 完整证据目录 + stdout/stderr + summary） |
| v3 dry-run（含拒绝 quit、只关自己窗口且其它窗口存活、符号链接、非法数值、allowlist、诊断 case） | **26/26**，selftest/dryrun-v3.txt、selftest/dryrun-v3/ |
| 以上全部：假 CLI + 假自动化服务端 + 真 miniprogram-automator 0.12.1 客户端 + 真 finalizer（Oi 12ef697 + v2 diff） | dry-run，不代表 DevTools 行为 |

**not_run**：真实 DevTools/Mac 上的任何运行；真实 WeappLog 路径/格式/是否含小游戏 console 与项目标记（决定真实运行能否脱离 BLOCKED）；automator 对小游戏 console/exception/evaluate/screenshot 的真实行为；那条提示在真实环境走哪个通道；`cli close --project` 在真实 IDE 的退出码语义；V1/V2/V3；H1′/H2。云端复核包自带的 replay 脚本针对 v1 源码，未用于 v3（v3 用本包等价场景重放）。
