# 0008-v4 · 微信开发者工具首开 console 审计（基于 v3，按 Oi 对 v3 的云端再复核修验证器）

GGbot（grokbot-2）· 2026-10-09/10 · Creator 3.8.8 / DevTools Stable 2.02.2608080 / 基础库 3.17.3 / AppID wx3bdd911c5c06f591
基于 0008-v3。**finalizer diff 与 v2/v3 逐字节相同**（`0008-v2-finalize_wechat_local.patch` SHA256 `a2e4d699…f9e149`；`reference/finalize_wechat_local.12ef697+0008v2.cjs` `de7cd753…6d79`，均与 v3 包一致）。**没有重新引入 CLI quit**（白名单仍不含 quit；`QF_DEVTOOLS_QUIT_FIRST` 设置即 BLOCKED，dry-run 第 20 例）。shim（`first-open-audit-shim.js`，SHA `29381cdf…`）与 `qf-wechat-env.cjs` 未改。本版只改：`tools/first_open_console_rules.cjs`、`tools/wechat_first_open_audit.cjs`、测试、README。全部为云端/本地测试：没有 Mac、没有微信、没有上传/预览/发布、没有发消息；未碰 `06_inbox` 或任何 Drive 收件箱。

## 0. 更新记录 v3 → v4

| 项 | v3 | v4 |
|---|---|---|
| 错误识别 | 审计先用 `STRONG_ERROR_PATTERNS` 预筛（只有 TypeError 等“强”模式才进入判定）；WeappLog/CLI 行不看级别；`Error:`、`[其他错误]`、`[console.error] <任意文本>` 漏判；`other-bracket-error` 只匹配行首 | **一套规则**（`rules.classifyEvent`）判定每个事件：automator console（按 type 级别）、exception、shim 记录、**每一行** WeappLog（`parseLogLine` 解析时间戳/项目标记/级别标签）、CLI 输出。console.error 级别即错误（文本不认识也算 `unrecognised-error-level`）；普通 `Error:` 与**任意位置**的 `[…错误…]` 在任何级别都是错误；补 EvalError/URIError/AggregateError/InternalError/DOMException、game.json 错误。本项目 → FAIL；无法归属 → BLOCKED |
| canary 豁免 | `CANARY_RE` 未锚定：一行里只要含本次 canary，整行豁免（`canary + TypeError` 被吞） | **只有整条归一化文本恰好等于** `[QF-AUDIT-CANARY] <token>` / `[QF-AUDIT-CANARY-LATE] <token>`（且级别为 error/未知）才豁免；多一个字就按普通事件判 |
| boot / LATE canary | `canarySeen.shim` 接受 LATE canary；`R.shim.canaryAtBoot` 记录了但不参与判定 | 分开要求：shim 精确 **boot** 记录 + `canaryAtBoot===true` + 本项目 WeappLog 精确 boot 行；automator 精确 LATE canary + LATE heartbeat；shim 精确 LATE 记录。任一缺失 → BLOCKED，原因逐条写明；`channels` 分别报告 `bootCanaryRecord / reportedCanaryAtBoot / lateCanaryRecord / ownBootCanary / ownLateCanary`；shim `installErrors` 非空 → BLOCKED |
| allowlist | `extractKnownNotice` 按行尾后缀匹配：`TypeError…; <提示>` 整行被当成提示放行 | 删除后缀提取（`extractKnownNotice` / `KNOWN_IDE_NOTICE_IN_LINE` 已移除）。只有**整条归一化 payload** 等于精确提示才是 known-notice；env/lib 尾部也收紧为 `(env: macOS|Windows,mg,x.y.z; lib: x.y.z)` 的精确形状。其它一切先按错误规则逐事件判定 |
| WeappLog tailer | 只比较前 4 KiB 指纹：同 inode、同大小、前 4096 B 不变的后缀重写检测不到；README 写得过满 | 新增：每轮比较读偏移前最后 ≤4 KiB；对已读字节维护 SHA-256 运行哈希，**停止时对 [0,偏移) 全量重哈希比对**（含启动前已存在的区域）；无效 UTF-8 = 协议违例。支持的协议与**检测不到的情况**写在 §4 与代码注释里，不做无条件承诺 |
| §1 结论 | “与游戏代码/Cocos 无关、与 condition 无关、项目文件改不掉、对游戏功能无害”等全称表述 | 按复核改为证据能支持的范围：不需要 Cocos；测过的 condition 有/无都不是充分修复；显示来自已追踪到的 IDE 代码路径；部分运行随后正常加载场景；触发仍可能依赖项目元数据/进程状态/时序；H1′/H2 明确标为假设 |
| 回放 | 复核包自带 replay 只验证 v3 观察行为 | 复核包 replay 最小改造后放入 `test/oi-replay-v4/`（改动见 `CHANGES-vs-Oi-original.diff`），期望值改为 v4 阳性标准；另加 1 个补充场景 |

## 1. 结论（按证据重写）

**这条红字由微信开发者工具自身的启动流程显示；在 Oi 的 E/F/G 中，它的出现不需要 Cocos，也不随我们测过的 condition 有/无而消失。** 具体说：

1. **证据（不需要 Cocos）**：E 是纯 wx canvas 小游戏（game.js 无任何 Cocos/引擎代码，单测断言），无 condition、enhance=false，首开仍在 `WAGame.js:1 OI_MINIMAL_CONTROL_E_READY` 之后出现逐字相同的提示。
2. **证据（测过的 condition 有/无都不是充分修复）**：G 恢复官方完整空模板 condition，重开仍出现；A/D 删除 condition 首开也出现。因此“删掉/恢复 condition”在这些运行里都不足以消除它。我们**没有**穷举所有 condition 内容，也不据此断言它与 condition 在任何情况下都无关。
3. **证据（显示路径）**：Oi 只读追踪已安装 DevTools 源码：文案为 `JSON_CUSTOM_COMPILE_PATH_NOT_EXISTS: 'app.json 中未定义自定义编译中指定的启动页面 %s'`，在模拟器启动步骤里 `C=d.path`、`O.realNotFound` 为真时显示，之后才进入 `RUNTIME_STEP_1_LAUNCH`。我们看到的文本 `%s` 处为空。显示来自这一 IDE 代码路径；**为何** `realNotFound` 为真、`d.path` 为何为空，未确认。
4. **证据（部分运行之后正常）**：A/D/G 在提示之后出现 `LoadScene db://assets/scenes/WorldR5Integration.scene`，G 显示首页。这只说明**这些运行**的启动在提示后继续；我们没有验证所有功能，不作“对所有功能无害”的结论。
5. **证据（并非每次出现）**：E 首开有、E/F 重开没有、G 重开有 → 触发仍可能取决于项目元数据、IDE 进程状态或时序。
6. 因此“项目输出里改不掉”**不是已证明的结论**：我们只证明了在已测的项目内容变化（去 Cocos、condition 有/无）下它仍出现。验收策略不变：**默认 FAIL**；只有在 Grok Bot/Oi 决定后设 `QF_FIRST_OPEN_ALLOW_APPJSON_NOTICE=1`，才对整条精确提示给 `PASS_WITH_ALLOWLISTED_IDE_NOTICE`（exit 3），永不普通 PASS。

| 运行 | 内容 | condition | enhance | 红字 | 出处 |
|---|---|---|---|---|---|
| **E 首开** | 纯 wx canvas，无 Cocos | 无 | false | **有** | r6efg/console-raw.txt |
| E 重开 | 同上 | 无 | false | 无 | e-reopened(-settled)-console.txt |
| F 首开 | 同 E 字节 | 官方完整空模板 | false | 无效采集 | 面板空白 |
| F 重开 | 同上 | 官方完整空模板 | false | 无 | f-reopened-console.txt |
| G 首开 | R6 Cocos 产物 | 官方完整空模板 | false | 无效采集 | 面板空白 |
| **G 重开** | 同上 | 官方完整空模板 | false | **有**，之后 LoadScene | g-reopened-console.txt |
| A / D | R6 产物 | 无 | true / false | 有，之后 LoadScene | audio-startup / noenhance-d |

## 2. 机制：H1′ / H2（**均为假设，未验证**）

- **H1′（假设）**：启动步骤里 `realNotFound` 判定与“是否小游戏（`isGameApp` / `attr.gameApp`）/ `getAppConfig` 何时就绪”的先后有关；若检查先于小游戏属性就绪，就按小程序页面表检查空路径。与 E 首开有/E 重开无/G 重开有的现象**相容**，但只是源码线索 + 现象吻合。
- **H2（假设，已削弱）**：同 AppID 的 IDE 状态。E/F 重开不红说明它不能单独必然触发；不排除与 H1′ 叠加。`diag-appid` 诊断保留（只改副本）。
- 给 Oi 的验证 V1（时序：同一新副本首开 / 立即重开 / 60 s 后重开）、V2（`diag-appid`）、V3（真实 WeappLog 格式与 canary/项目标记）同 v3，未改。

## 3. 复核项 → 改动 → 测试 → 结果

| 复核项 | 改动（文件） | 测试 | 结果 |
|---|---|---|---|
| A 统一归一化错误识别；console.error 级别；`Error:`；任意 `[…错误]`；未识别 error 级别至少 BLOCKED；无法归属的普通 Error BLOCKED | rules：`normalize`/`parseLogLine`/`errorId`/`classifyEvent`，`plain-error`、`bracket-error-category`（不锚定）、更多 JS 错误类、game.json 错误；audit：删除 STRONG 预筛，所有通道所有事件都过 `classifyEvent`；`events-classified.json` 证据 | `test_rules_v4` A1–A5；回放 weapp-generic-error / weapp-unclassified-error / weapp-bracket-error / cli-generic-error / weapp-unattributed-generic；test_boundaries 分类覆盖 | 5/5 单测；回放 FAIL/FAIL/FAIL/FAIL/BLOCKED（v3 全是 PASS） |
| B canary 只豁免精确归一化事件 | rules：`classifyEvent` 锚定 `^…$`；audit：删除 `CANARY_RE`、`isOwnCanary` 整行豁免 | `test_rules_v4` B1–B3；回放 canary-mixed-error、canary-mixed-console | 3/3；两场景 FAIL（v3 PASS） |
| C boot 与 LATE canary 分开验证；缺 boot → BLOCKED；canaryAtBoot 参与判定 | audit：`canary.{shimBoot,shimLate,automatorLate,weappBoot,weappLate}` 计数，逐条 `need(...)`；shim `installErrors` 也参与 | 回放 canary-boot-missing；dry-run 03（channels 全部字段为真）、11 | BLOCKED（原因：缺精确 BOOT 记录 + canaryAtBoot≠true）；dry-run 26/26 |
| D allowlist 先逐事件判其它错误；不做后缀匹配；只放行精确提示 | rules：删除 `extractKnownNotice`/`KNOWN_IDE_NOTICE_IN_LINE`；提示仅按整条 payload；env/lib 尾部形状收紧 | `test_rules_v4` D1–D3；finalizer 单测“log-line parsing (v4)”；回放 mixed-error-notice-allowlisted、unattributed-notice-allowlisted、known-notice-allowlisted、unattributed-exact-notice-allowlisted | 3/3、33/33；FAIL / BLOCKED / PASS_WITH_ALLOWLISTED / PASS_WITH_ALLOWLISTED |
| E tailer 支持的协议写清楚或加一致性检查；不做无条件承诺 | audit `LogTailer`：尾部 4 KiB 每轮比对、运行 SHA-256 + 停止时全量重哈希（含基线区域）、无效 UTF-8；协议与不可检测情况写入代码注释与 §4 | `test_log_tailer` v4 E1–E5；Oi `test_boundaries`（断言反转为“必须检测到”） | 20/20；边界用例 `rewrite_detected_incomplete` |
| §1 根因结论按证据改写 | README §1/§2 | finalizer 单测中 E/F/G 证据断言（未改） | 33/33 |
| 21 个反例 → v4 阳性标准，全部通过 | `test/oi-replay-v4/`（最小改造） | 回放 21+1 场景 | **22/22**；同一标准跑 v3 源码 12/22 |
| 先前全部套件无回归 | 测试按 v4 字段名/文案更新（见 §7） | finalizer / shim / tailer / dry-run / v2-vs-v3 复核 | 33/33、8/8、20/20、26/26、15/15 |

## 4. WeappLog tailer：支持的协议与检测范围（E）

**支持的协议**（在此之外 → 记入 `incomplete` → BLOCKED，或照常按错误规则扫描，绝不跳过）：
- 文件：名为 `WeappLog` 的目录（或根本身就叫 WeappLog）下深度 ≤8 的 `*.log` 普通文件；按 dev+inode 跟踪，跟随改名。
- 内容：UTF-8 文本，LF/CRLF 分行，**只追加**（已写字节不再改变，文件不缩短）。无效 UTF-8 = 协议违例 → incomplete。
- 行格式（`rules.parseLogLine`）：`[ISO 时间戳]*`（可带或不带方括号）→ 可选本项目标记（副本绝对路径 / 唯一 projectname，token 在行内任意位置也算本项目）→ 可选级别标签 `[error] [warn] [warning] [log] [info] [debug]` 或 `[console.<级别>]`（取行内第一个）→ payload。没有级别标签 = `unknown` 级别，payload 为剥掉时间戳/本项目标记后的剩余文本。**未知格式不跳过**：整段仍过完整错误规则（fail-closed）。注意：无法归属行前面的未知前缀（如别的项目名）不会被剥掉，因此 `OTHER-PROJECT <精确提示>` 不是“精确提示”，而是无法归属的 `[…错误]` → BLOCKED。
- 真实 DevTools WeappLog 是否符合此协议**未核实**（见 not_run）。

**一致性检查**（任一失败 → incomplete → 不能 PASS）：截断（大小 < 读偏移）；同路径出现新 inode（替换）；文件消失；前 ≤4 KiB 改变（每轮）；读偏移前最后 ≤4 KiB 改变（每轮）；**停止时对 [0, 读偏移) 全量重哈希，与读取时累积的 SHA-256 比对**（含启动前已存在区域：同 inode、同大小、前 4096 B 不变而中段/后缀被改写，在停止时仍存在的，会被发现）；readdir/读取错误；总字节预算（默认 256 MiB）用尽。

**检测不到（明确声明）**：在下一轮轮询和停止之前又被**恢复成原字节**的改写；写到协议之外的位置（其它目录/扩展名）的内容；IDE 根本不写入的内容（由 canary 要求兜底：本项目精确 boot canary 不在 WeappLog → BLOCKED）。轮询间隔内追加后又被截断的内容会以“截断”记为 incomplete，但内容本身读不到。

## 5. 窗口关闭与归属（v3 起，v4 未改）

- 每个 case 复制到唯一目录 `QFFirstOpen-<UTC毫秒>-<4hex>-<6hex>-<case>`，并把副本 `projectname` 改成同名（DevTools 窗口标题即此名），shim 带 16 位随机 token。
- 只启动自己的 `cli auto --project <副本>`；结束时只执行 `cli close --project <副本>`（成功才算关闭；失败 → BLOCKED）；异常退出路径也会关闭自己登记过的副本。**从不调用 `cli quit`**（白名单里没有，设 `QF_DEVTOOLS_QUIT_FIRST` 直接 BLOCKED）。
- 自己的 CLI 子进程全部登记；收尾时等其退出，超时只终止这些子进程（不碰 DevTools 本体或其它进程）。
- 归属：automator（连在自己的端口）、shim（本次 token）、自己 CLI 子进程的输出 → 本项目；WeappLog 行**必须含**副本路径 / projectname / token 之一才算本项目；其它行即使是错误也只记为“无法归属”→ 不能证明 PASS、也不能被忽略 → BLOCKED。其它审计副本的 canary（token 不同）同样只记为无法归属。
- 已知局限：真实 WeappLog 行格式未核实。若 IDE 不把小游戏 console 写进 WeappLog，或写入时不带任何本项目标记，v4 会对**每次**真实运行给 BLOCKED（这是刻意的：缺证据不 PASS），需要 V3 核实后再定是否增加“会话块”归属规则。


## 6. 首开 Console 的确切预期

按顺序：`Wechat Lib:3.17.3, …` → `… GMT+0800 (中国标准时间) 接口提示` → HarmonyOS 3.7.0 提示（黄，允许）→ `WAGame.js:1 {batteryLevel…}` 或 `Object` → **已知 IDE 提示**（逐字：`[app.json 或自定义编译条件错误] app.json 中未定义自定义编译中指定的启动页面 (env: macOS,mg,2.02.2608080; lib: 3.17.3)`；默认禁止，仅 allowlist 下允许，带页面名的同类句子仍禁止）→ `cc.js? [sm]:1 LoadScene db://assets/scenes/WorldR5Integration.scene: <n> ms`（**必须**）。
仅审计测试副本额外出现：`[QF-AUDIT-HEARTBEAT(-LATE)] <token>`（log）与 **`[QF-AUDIT-CANARY(-LATE)] <token>`（红，本次 token，阳性对照；v4：**只有整条归一化文本恰好等于** `[QF-AUDIT-CANARY(-LATE)] <本次token>` 才豁免）**。Oi 手工打开的正式产物没有这些行。
禁止（v4 统一规则，所有通道同一套）：任何 console.error 级别事件（文本无法识别也算，id=`unrecognised-error-level`）；任何级别下的 @babel helper、prerequisite-imports、MiniProgramError、TypeError/ReferenceError/SyntaxError/RangeError/EvalError/URIError/AggregateError/InternalError/DOMException/Uncaught、普通 `Error:`、simulator launch failed、**任意位置**的 `[…错误…]` 分类、编译失败/错误、game.json 错误；wx.onError/未处理 rejection/automator exception；自己 CLI 输出中的上述内容。
计数：现在“红 1 黄 1”（审计副本再 +2 条红 canary）。

## 7. 测试改动记录（相对 v3）

- `test_finalizer_0008v2.cjs`：“log-line extraction”一条改为 v4 语义（精确提示只在整条 payload 时成立；附加文本/页面名 → error；`extractKnownNotice` 不再存在）。其余 32 条未改。
- `test_first_open_audit_dryrun.cjs`：03 断言改用 v4 通道字段（`ownBootCanary`、`bootCanaryRecord`、`reportedCanaryAtBoot`、`lateCanaryRecord`、`lateHeartbeat`）；11 断言改为 v4 的两条具体原因文案。判定期望全部未改。
- `test_review_findings_v2_vs_v3.cjs`：“v3”列现在跑当前 `tools/`（v4），作为 v3 修复项的回归（可用 `QF_REVIEW_CURRENT_AUDIT` 指定其它版本）；期望未改。
- `test_log_tailer.cjs`：新增 v4 E1–E5（原 15 条未改）。
- 新增 `test_rules_v4.cjs`（12 条）。
- `test/oi-replay-v4/`：Oi 复核包 `replay.cjs`、`test_boundaries.cjs`、`fake-cli.cjs`、`fake-automator.cjs` 的副本，原件在 `oi-original/`（连同 REVIEW.txt、README-REPLAY.txt），改动全文 `CHANGES-vs-Oi-original.diff`：① `REVIEW_SOURCE` 默认指向本包根；v3 SHA 硬断言改为可选 `REVIEW_EXPECT_SHA`；② 期望表由“v3 观察行为”改为 v4 阳性标准，逐场景记录 ok 而不是首个不符就抛错；③ `test_boundaries` 断言反转为“后缀重写必须被检测到”，分类覆盖改为断言 v4 事件为 error；④ 补充场景 `unattributed-exact-notice-allowlisted`（fake-automator 加 1 行：写入无项目标记、整行恰为精确提示的行），用来证明 allowlist 对精确提示仍然有效。`fake-cli.cjs` 未改。
- Oi 的**原始** replay（未改一字）对 v3 源码重跑，结果与复核包一致（9 个反例仍 PASS/PASS_WITH_ALLOWLISTED）：`selftest/v3-comparison/oi-original-replay-on-v3/`。原始脚本硬编码 v3 SHA，**无法直接指向 v4**，故用上述最小改造版。

## 8. 21 个场景：期望 / 实际（v4）

| # | 场景 | 内容 | v3 实际 | v4 期望 | v4 实际 | |
|---|---|---|---|---|---|---|
| 1 | `healthy` | 对照 | PASS | **PASS** | PASS (exit 0) | ✅ |
| 2 | `missing-root-error` | 运行中才出现的日志根里的本项目 TypeError | FAIL | **FAIL** | FAIL (exit 1) | ✅ |
| 3 | `truncate-error` | 截断后写入的本项目错误 | FAIL | **FAIL** | FAIL (exit 1) | ✅ |
| 4 | `unrelated-only` | 只有别的项目的错误行，本项目未写日志 | BLOCKED | **BLOCKED** | BLOCKED (exit 2) | ✅ |
| 5 | `cli-exit7` | cli auto 退出码 7 | BLOCKED | **BLOCKED** | BLOCKED (exit 2) | ✅ |
| 6 | `close-exit5` | cli close 退出码 5 | BLOCKED | **BLOCKED** | BLOCKED (exit 2) | ✅ |
| 7 | `cli-lingers-error` | 长驻 CLI 打印 TypeError | FAIL | **FAIL** | FAIL (exit 1) | ✅ |
| 8 | `cli-lingers-clean` | 长驻 CLI 被终止 | BLOCKED | **BLOCKED** | BLOCKED (exit 2) | ✅ |
| 9 | `no-logs` | 日志根从未出现 | BLOCKED | **BLOCKED** | BLOCKED (exit 2) | ✅ |
| 10 | `weapp-generic-error` | 本项目 `[console.error] Error: …` | PASS **（误判）** | **FAIL** | FAIL (exit 1) | ✅ |
| 11 | `weapp-unclassified-error` | 本项目 `[console.error] plain fatal diagnostic`（无可识别文本） | PASS **（误判）** | **FAIL** | FAIL (exit 1) | ✅ |
| 12 | `weapp-unattributed-generic` | 别的项目 `[console.error] Error: …` | PASS **（误判）** | **BLOCKED** | BLOCKED (exit 2) | ✅ |
| 13 | `weapp-bracket-error` | 本项目 `[其他错误] 资源加载失败` | PASS **（误判）** | **FAIL** | FAIL (exit 1) | ✅ |
| 14 | `cli-generic-error` | 自己 CLI stderr `Error: ordinary launch failure`（exit 0） | PASS **（误判）** | **FAIL** | FAIL (exit 1) | ✅ |
| 15 | `canary-mixed-error` | WeappLog 同行 `[QF-AUDIT-CANARY] <token> TypeError: …` | PASS **（误判）** | **FAIL** | FAIL (exit 1) | ✅ |
| 16 | `canary-mixed-console` | ping 时 `console.error("[QF-AUDIT-CANARY-LATE] <token> TypeError: …")` | PASS **（误判）** | **FAIL** | FAIL (exit 1) | ✅ |
| 17 | `canary-boot-missing` | shim 只剩 LATE canary，canaryAtBoot=false | PASS **（误判）** | **BLOCKED** | BLOCKED (exit 2) | ✅ |
| 18 | `known-notice-denied` | 本项目精确提示，allowlist 关 | FAIL | **FAIL** | FAIL (exit 1) | ✅ |
| 19 | `known-notice-allowlisted` | 本项目精确提示，allowlist 开 | PASS_WITH_ALLOWLISTED_IDE_NOTICE | **PASS_WITH_ALLOWLISTED_IDE_NOTICE** | PASS_WITH_ALLOWLISTED_IDE_NOTICE (exit 3) | ✅ |
| 20 | `unattributed-notice-allowlisted` | `OTHER-PROJECT <精确提示>`，allowlist 开 | PASS_WITH_ALLOWLISTED_IDE_NOTICE **（误判）** | **BLOCKED** | BLOCKED (exit 2) | ✅ |
| 21 | `mixed-error-notice-allowlisted` | `TypeError: actual failure; <精确提示>`，allowlist 开 | PASS_WITH_ALLOWLISTED_IDE_NOTICE **（误判）** | **FAIL** | FAIL (exit 1) | ✅ |
| +1 | `unattributed-exact-notice-allowlisted` | （GGbot 补充）无项目标记、整行恰为精确提示，allowlist 开 | PASS_WITH_ALLOWLISTED_IDE_NOTICE | **PASS_WITH_ALLOWLISTED_IDE_NOTICE** | PASS_WITH_ALLOWLISTED_IDE_NOTICE (exit 3) | ✅ |

说明：`unattributed-notice-allowlisted` 的期望由 v3 观察到的 PASS_WITH_ALLOWLISTED 改为 **BLOCKED**：该行是 `OTHER-PROJECT <提示>`，剥掉协议字段后 payload 不等于精确提示，要把它认成提示只能做后缀匹配（D 明确禁止）；且无法归属 → BLOCKED。allowlist 对“整行恰为精确提示”的无法归属行仍然有效（补充场景 +1）。v3 列来自同一 v4 标准跑 v3 源码（`selftest/v3-comparison/v4-criteria-on-v3/`）：12/22 符合，10 个不符即复核发现的问题。

## 9. 运行（给 Oi，真实环境，未改）

前置：`npm i -D miniprogram-automator@0.12.1`；打 `0008-v2-finalize_wechat_local.patch`（未改）；把本包 `tools/` 4 个文件放进仓库 `tools/`；Creator 新出一份 wechatgame 产物。**不要**设 `QF_DEVTOOLS_QUIT_FIRST`。
```bash
export QF_WECHAT_BUILD_DIR=<新 wechatgame 输出>
QF_FIRST_OPEN_OUT=$PWD/evidence/first-open-0008v4/run1 node tools/wechat_first_open_audit.cjs; echo exit=$?
```
看 `verdict.json` → `variants[0].channels`、`errors`、`unattributed`、`missing`；`verdict-default/events-classified.json`（每个事件的来源/归属/级别/判定）；stdout 最后一行 `selfCheck.ok` 必须为 true。截图默认关闭（`QF_FIRST_OPEN_SCREENCAPTURE=0`）；设为 1 会截**整个屏幕**（可能含其它窗口/隐私），仅在确认屏幕内容可公开时使用。

## 10. 自测（Linux 云端，dry-run）与 not_run

| 项目 | 结果 | 证据 |
|---|---|---|
| `node --check` 全部 .cjs/.js | 29/29 | selftest/syntax-check.txt |
| finalizer diff + console 规则（E/F/G 真实配置与 console） | **33/33** | selftest/unit-finalizer.txt |
| shim | **8/8** | selftest/unit-shim.txt |
| WeappLog tailer / 自有 CLI / manifest（含 v4 E1–E5） | **20/20** | selftest/unit-log-tailer.txt |
| v4 统一分类规则（A/B/D） | **12/12** | selftest/unit-rules-v4.txt |
| Oi 边界测试（改造版，断言反转） | 通过 | selftest/oi-boundaries-v4.{txt,json} |
| Oi 回放（改造版）21+1 场景 → v4 | **22/22** | selftest/oi-replay-v4.txt、selftest/oi-replay-v4/（每场景完整证据目录、summary.json） |
| 同一标准 → v3 源码 | 12/22（对照） | selftest/v3-comparison/v4-criteria-on-v3/ |
| Oi 原始回放（未改）→ v3 源码 | 复现复核结论 | selftest/v3-comparison/oi-original-replay-on-v3/ |
| dry-run（拒绝 quit、只关自己窗口、allowlist、诊断 case 等） | **26/26** | selftest/dryrun-v4.txt、selftest/dryrun-v4/ |
| v3 复核项回归（v2 vs 当前） | **15/15** | selftest/review-findings-v2-vs-v3-on-v4.txt 及目录 |

以上全部是假 CLI + 假自动化（Oi 的 vm fake 或本包 fake server + 真 miniprogram-automator 0.12.1 客户端）+ 真 finalizer（Oi 12ef697 + v2 diff），**不代表 DevTools 行为**。

**not_run**：Mac / 真实 DevTools / 微信上的任何运行；真实 WeappLog 路径、行格式、是否含小游戏 console、是否带项目标记、是否只追加、编码（决定真实运行能否脱离 BLOCKED，以及 §4 协议是否成立）；真实 automator 对小游戏 console 级别字段/exception/evaluate/screenshot 的行为；那条提示在真实环境走哪个通道及其确切文本形状（env/lib 尾部）；`cli close --project` 真实退出码语义；V1/V2/V3；H1′/H2；“对所有功能无害”未验证（也不再声称）。
