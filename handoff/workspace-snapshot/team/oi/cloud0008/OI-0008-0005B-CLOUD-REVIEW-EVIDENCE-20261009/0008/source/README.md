# 0008 · 微信开发者工具「首次打开」console 审计收口 — v1

作者：GGbot（grokbot-2）· 2026-10-09 · 引擎 Cocos Creator 3.8.8 / DevTools Stable 2.02.2608080 / 基础库 3.17.3 / AppID wx3bdd911c5c06f591
范围：只改**构建产物的 project.config.json（可选）**和新增测试工具。不碰 0007、ManagedMobileBoardUI / WorldIntegrationBoot / MainlineHost，不上传、不预览、不发布（脚本只调用 CLI 的 islogin / quit / auto / open / close）。

## 1. A / B 是什么

| 名称 | project.config.json | Oi R6 实测（已验证） |
|---|---|---|
| **A**（现行，默认） | finalize_wechat_local.cjs 删掉空编译条件后**没有 `condition` 键** | 首次打开报红：`[app.json 或自定义编译条件错误] app.json 中未定义自定义编译中指定的启动页面`，之后仍能进开始页 |
| **B** | `condition.game` 和 `condition.miniprogram` 都是 `{current:-1, list:[]}` | 不手动 Compile 能进 B 主页；但调试器面板空白，**无法断言 0 报错** |

已核对：Oi 的 A、B 两份配置**只差 `projectname` 和 `condition`**，`setting` / `compileType: "game"` / `libVersion: "widelyUsed"` / `appid` 完全相同（单测第 1 条）。

## 2. 为什么 B 会让调试器空白 —— 结论与假设（都**未在真机工具上验证**）

**能从证据确定的：**
1. A/B 的 `setting`、`compileType`、`libVersion` 完全一样，所以这些字段**不可能是 A、B 调试器表现不同的原因**。
2. B 的游戏本身正常跑到主页（first-open-b-world/final.png），说明游戏上下文存在；空白的是调试器面板（UI/inspector 没挂上），不是游戏挂了。
3. `first-open-b-windows.json`：B 是**用 CLI 打开到一个已有 6 个项目窗口的同一 DevTools 进程（PID 47759）里的**，其中包括同 AppID 的 A 窗口和 3 个 R5 窗口；A 打开时进程里已有 5 个窗口。first-open-b.png 显示 B 窗口一开调试器区域就是空的（模拟器还没启动）。
4. R6 没复制 project.private.config.json（`privateConfigCopied:false`），也没留存 DevTools 打开后可能自动生成的私有配置。

**假设排序（需要 Oi 用本包脚本验证）：**
- **H1（最可能）IDE 状态而非配置**：同一 DevTools 进程里多窗口 / 同 AppID 第二个窗口时，新窗口的调试器没挂上。依据：A/B 唯一配置差是编译条件，编译条件管的是“启动页/启动参数”，不管调试器；官方更新日志多次修过“调试器弹出空白 / 白屏”，社区通用解法是重启工具或删调试目录里的 inspector 缓存。**验证法**：`QF_DEVTOOLS_QUIT_FIRST=1` 让 B 在干净的工具里**单独、第一个**打开。
- **H2 game 项目里多写了 `miniprogram` 分支**：可能性低。→ 变体 **B2**（只写 `game`）。
- **H3 私有配置覆盖**：官方文档写明 project.private.config.json 同名字段优先级更高，DevTools 开项目时可能写入自己的 condition。→ 变体 **B1**（两个文件都写 B 的条件）。
- 关于 A 为什么报错（同样是假设）：A 里**根本没有 condition**，报错信息里启动页名字是空的，像是工具把“没写 `current`”当成“有一条自定义编译条件但没有 pathName”。早期 Cocos 微信模板里 `game` 分支写的是 `"currentL": -1`（拼错，`current` 等于没写），和 OI-CFG-001 的“空条件导致报错”吻合；3.8.8 原始产物是否仍是 `currentL` 请 Oi 看一眼 finalize **之前**的 project.config.json 确认。B 显式写 `current:-1` = “普通编译”，所以不报错。
- 用户提议的“直接删掉 condition 键”**就是 A**（A 已经没有 condition），不是新候选，所以没有单独做成变体。

## 3. 可选开关（默认关 = 现行为）

`tools/wechat_first_open_condition.cjs`，环境变量 `QF_FIRST_OPEN_CONDITION`（或 `--variant=`）：

| 值 | 做什么 | 状态 |
|---|---|---|
| 不设 / `A` / `off` | 什么都不改 | 现行为 |
| `B` | project.config.json 写入 `{game:{current:-1,list:[]}, miniprogram:{current:-1,list:[]}}` | **Oi 已验证进主页、无条件报错；调试器空白未解** —— 产出与 Oi 的 first-open-b-project.config.json **逐字节相同**（单测） |
| `B1` | B ＋ project.private.config.json 写同样的条件（没有就新建，有就只加/换 condition） | 假设 |
| `B2` | 只写 `{game:{current:-1,list:[]}}` | 假设 |

规则：幂等（重复执行文件不变、只留一份最早的备份、不追加日志）；其他所有字段原样、顺序不变，连 Oi 文件里 `\uXXXX` 转义的写法都保留；已有条件只在**为空**时替换，**非空（真有自定义编译条件）直接拒绝**，和 finalizer 现有策略一致；备份和变更日志（改前/改后 SHA256 + unified diff）写在**输出目录旁边**的 `<输出目录>.first-open-condition/`，不会被打进小游戏包。

**接入方式（二选一，因为 GGbot 没有 finalize_wechat_local.cjs 源码，给不出可直接 apply 的 git diff）：**
- 不改 Oi 文件：把 `tools/finalize_wechat_local_firstopen.cjs` 和 `tools/wechat_first_open_condition.cjs` 放进仓库 `tools/`，用包装器代替原命令，参数完全一样：
  ```bash
  QF_FIRST_OPEN_CONDITION=B node tools/finalize_wechat_local_firstopen.cjs <原来给 finalize_wechat_local.cjs 的全部参数>
  ```
  包装器先原样跑原 finalizer（退出码透传，失败就什么都不做），再按开关应用变体；输出目录取 `QF_WECHAT_OUTPUT_DIR`，否则取 `--first-open-out=DIR`，否则取第一个含 project.config.json 的位置参数。不设开关时与直接跑原 finalizer 完全一样。
- 或把 `finalize_wechat_local.first-open.snippet.diff` 里的 4 行加到原 finalizer 末尾（必须在“删除空条件”之后）。

## 4. 回归脚本 `tools/wechat_first_open_audit.cjs`

流程：新构建产物 →（不动原目录）复制到 `<QF_FIRST_OPEN_WORK_ROOT>/QFFirstOpen-<UTC>-<随机>-<变体>/`，`projectname` 改成同名（避免工具缓存）→ 先去掉已有的空条件（=finalizer 默认），再套变体 → 只在**副本**的 game.js 开头注入审计 shim → `cli auto --project <副本> --auto-port <端口>`（官方 CLI 自己打开并编译，**不手动 Compile、不点任何东西**）→ miniprogram-automator 连 `ws://127.0.0.1:<端口>` → 收集 → `cli close`。

**4 条采集通道：**
1. automator `console` 事件（`type==='error'` 计错误）和 `exception` 事件；
2. shim 缓冲区：包住 `console.error/warn`、`wx.onError`、`wx.onUnhandledRejection`，覆盖 automator 连上**之前**的启动期报错，用 `evaluate` 读回；
3. DevTools 日志：扫描 `QF_DEVTOOLS_LOG_DIR` 下所有 `WeappLog/**/*.log` 在本次运行期间**新增**的行，匹配强特征（自定义编译条件错误 / simulator launch failed / 编译失败等）；
4. CLI 输出：同样的强特征。

**通道自证：** shim 里有 token，连上后让它再打一条 `[QF-AUDIT-HEARTBEAT-LATE] <token>`，automator 收到才算 console 通道可用。**阳性对照：** 默认在目标变体之后再跑一遍 A（R6 已知会报那条红）；只有对照 A 被检出，目标的 “0 报错” 才算数，否则判 BLOCKED（检测器没证明自己看得见）。

**判定：** 任一通道有错误 → `FAIL`（退出码 1）；CLI 不在 / 连不上 / console 通道没自证 / shim 读不回 / open 模式 / 对照没检出 → `BLOCKED`（退出码 2，附原因）；否则 `PASS`（0）。告警（warn）只记录不判错；`QF_FIRST_OPEN_IGNORE_ERROR_REGEX` 可把已知无害的报错列为 ignored（会写在 verdict 里）。

**输出（`QF_FIRST_OPEN_OUT`）：** `run.log`（每步 ISO 时间戳 + 相对秒数）、`verdict.json`、`source-project.config.json`、每个变体一个目录（`project.config.json.as-opened`、`condition-report.json`、`build-copy-SHA256SUMS.txt`、`automator-console.json`、`automator-exceptions.json`、`shim-buffer.json`、`weapplog-delta.txt`、`simulator.png`、可选 `screen.png`）、`manifest.json`（每个文件大小 + SHA256）、`SHA256SUMS.txt`。stdout 最后一行是一行 JSON `{status, reason, verdict, sha256sums}`。

**环境变量**（全部见 `tools/qf-wechat-env.cjs` 头注释，Mac 路径只是默认值）：`QF_WECHAT_CLI`（默认 `/Applications/wechatwebdevtools.app/Contents/MacOS/cli`）、`QF_WECHAT_BUILD_DIR`（必填）、`QF_FIRST_OPEN_VARIANT`（默认 B）、`QF_FIRST_OPEN_CONTROL`（默认 A，`none` 跳过）、`QF_FIRST_OPEN_MODE`（auto/open）、`QF_AUTO_PORT`（默认 9421，不能和工具“服务端口”相同）、`QF_FIRST_OPEN_SETTLE_MS`（默认 25000）、`QF_DEVTOOLS_QUIT_FIRST`（默认 0；=1 会关掉**所有** DevTools 窗口）、`QF_DEVTOOLS_LOG_DIR`（默认 `~/Library/Application Support/微信开发者工具`）、`QF_FIRST_OPEN_SCREENCAPTURE`（=1 时 macOS `screencapture -x` 整屏，用来看调试器面板）、`QF_FIRST_OPEN_INJECT_SHIM`（默认 1）、`QF_MINIPROGRAM_AUTOMATOR_MODULE`、`QF_FIRST_OPEN_KEEP_COPIES`（默认 1）。

## 5. 给 Oi 的确切命令（Mac M4）

前置：工具 设置→安全设置→服务端口 已开（R6 已在用 CLI）；已登录；仓库根目录执行一次 `npm i -D miniprogram-automator@0.12.1`；把本包 `tools/` 下 5 个文件复制进仓库 `tools/`。Creator 新出一份 wechatgame 产物，照常跑 `finalize_wechat_local.cjs`（默认 A 即可，脚本会在副本上自己套变体）。

```bash
cd <仓库根>
export QF_WECHAT_BUILD_DIR=<新 wechatgame 输出目录>
# R1 主判定：干净工具里单独首开 B，再跑对照 A
QF_DEVTOOLS_QUIT_FIRST=1 QF_FIRST_OPEN_SCREENCAPTURE=1 QF_FIRST_OPEN_VARIANT=B \
  QF_FIRST_OPEN_OUT=$PWD/evidence/first-open-0008/R1-B node tools/wechat_first_open_audit.cjs; echo exit=$?
# R2 / R3：仅当 R1 不是 PASS，或 screen.png 里 B 的调试器仍空白
QF_DEVTOOLS_QUIT_FIRST=1 QF_FIRST_OPEN_SCREENCAPTURE=1 QF_FIRST_OPEN_VARIANT=B1 QF_AUTO_PORT=9431 \
  QF_FIRST_OPEN_OUT=$PWD/evidence/first-open-0008/R2-B1 node tools/wechat_first_open_audit.cjs; echo exit=$?
QF_DEVTOOLS_QUIT_FIRST=1 QF_FIRST_OPEN_SCREENCAPTURE=1 QF_FIRST_OPEN_VARIANT=B2 QF_AUTO_PORT=9441 \
  QF_FIRST_OPEN_OUT=$PWD/evidence/first-open-0008/R3-B2 node tools/wechat_first_open_audit.cjs; echo exit=$?
# R4 调试器诊断（不走自动化、不注入 shim，和 R6 一样用 cli open；判定必为 BLOCKED，看的是 screen.png 和人工观察）
QF_FIRST_OPEN_MODE=open QF_FIRST_OPEN_INJECT_SHIM=0 QF_DEVTOOLS_QUIT_FIRST=1 QF_FIRST_OPEN_SCREENCAPTURE=1 \
  QF_FIRST_OPEN_VARIANT=B QF_FIRST_OPEN_CONTROL=none QF_FIRST_OPEN_OUT=$PWD/evidence/first-open-0008/R4-open-B node tools/wechat_first_open_audit.cjs
```
注意：`QF_DEVTOOLS_QUIT_FIRST=1` 会关掉所有 DevTools 窗口（关闭时工具会弹 3 秒可取消的提示）。不想关就先手动关掉其他项目窗口，并在回传里注明。

**预期输出：** 最后一行形如 `{"status":"PASS","reason":"target B: 0 console errors on first open without manual Compile; positive control A error detected (weapplog)",...}`，退出码 0。若是 `BLOCKED ... detector not proven`：说明那条红在 4 个通道里都没被看到——请把 R1 的 `control-A/` 目录和 A 窗口截图一起回传，我据此补通道（比如修正 WeappLog 路径）。

## 6. 请 Oi 回传的证据清单

1. 每次运行的整个 `QF_FIRST_OPEN_OUT` 目录（含 verdict.json、run.log、manifest.json、SHA256SUMS.txt），打包后附外层 SHA256；
2. DevTools 版本、基础库版本、运行时还开着哪些项目窗口（或注明用了 QUIT_FIRST）；
3. 每次运行人工观察一张表：调试器面板是否空白（是/否）、Console 里有无红字、模拟器是否到开始页；
4. finalize **之前**的原始 project.config.json 一份（确认 3.8.8 是否仍是 `currentL`）；
5. 若 R1 BLOCKED/FAIL：`control-A/` 与 `target-B/` 两个目录必须都在。

## 7. 自测范围（Linux 盒子）

| 项目 | 结果 |
|---|---|
| 全部 .cjs/.js `node --check` | passed |
| 条件变换 + 包装器单测（用 Oi R6 的 A/B 两份真实配置 + 合成的 Cocos `currentL` 模板 / 非空条件 / 已有私有配置；包装器用模拟 finalizer） | 22/22 passed（含：B 产出与 Oi 的 B 逐字节一致；幂等；拒绝非空条件；默认关时与原 finalizer 输出逐字节一致） |
| shim 单测（vm） | 5/5 passed |
| 回归脚本 dry-run：**假 CLI + 假自动化服务端**，客户端用真的 miniprogram-automator 0.12.1 | 16/16 passed（PASS / FAIL×4 / BLOCKED×5 各路径、对照、唯一副本名、原构建目录不被改动、SHA 清单自校验） |
| 真 DevTools 运行（Mac） | **not_run** |
| automator 对**小游戏**项目的 console/exception/evaluate 是否可用 | **not_run**（官方小游戏文档挂的是同一套 automator API，但没在 2.02.2608080 上实测） |
| 那条“自定义编译条件错误”会出现在哪个通道（automator / shim / WeappLog） | **not_run**（假服务端按最坏情况建模：只出现在 WeappLog） |
| Mac 上 WeappLog 实际路径 | **not_run**（默认值是推测，可用 `QF_DEVTOOLS_LOG_DIR` 改） |
| `cli islogin` 输出格式、`screenshot` 对小游戏是否可用 | **not_run**（只记录，不影响判定） |
| B 让调试器空白的原因 | **未定**，见第 2 节 H1–H3 |
| 真实 finalize_wechat_local.cjs 接入 | **not_run**（没有源码；包装器只对模拟 finalizer 测过） |

dry-run 的 verdict 都带 `"dryRun": true` 和 `scope: DRY_RUN_FAKE_CLI`，**不是** DevTools 行为的证据。

## 8. 文件

- `tools/wechat_first_open_condition.cjs` — 变体变换（模块 + CLI）
- `tools/finalize_wechat_local_firstopen.cjs` — 原 finalizer 包装器
- `tools/wechat_first_open_audit.cjs` — 回归脚本
- `tools/first-open-audit-shim.js` — 只注入测试副本的 shim
- `tools/qf-wechat-env.cjs` — 环境变量（qf-env.cjs 风格）
- `finalize_wechat_local.first-open.snippet.diff` — 4 行接入片段（伪 diff）
- `test/` — 单测、dry-run、假 CLI、假自动化服务端、fixtures（Oi R6 的 A/B 配置原件）
- `selftest/` — 本次自测输出
- `SHA256SUMS.txt` — 包内文件校验
