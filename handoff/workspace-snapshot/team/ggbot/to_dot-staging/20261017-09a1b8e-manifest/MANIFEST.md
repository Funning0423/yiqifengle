# build05 里程碑 09a1b8e · 交接清单（给 Oi）

GGbot 生成，2026-10-17 03:10 EDT。只在本地，没有 push，没有上传（Grok Bot 下次心跳上传）。
本文件夹**不含任何大文件**：bundle、构建产物、视频、音频、截图只写路径、字节数和 SHA256。机器可读版本见 `manifest.json`，校验用 `sha256sum -c SHA256SUMS`。

## 状态一览
| # | 项目 | 状态 |
|---|---|---|
| 1 | 提交 / tree / 父链 / 指向它的分支 | ✅ 完整 |
| 2 | README v2.1 | ✅ 完整（已复制） |
| 3 | bundle 信息（字节数、SHA256、list-heads、verify、命令） | ✅ 完整（有 2 处更正，见第 3 节） |
| 4 | 微信 / web 实际产物清单和 SHA256 | ⚠️ **SHA256 缺失（MISSING）**：只有字节数 |
| 5 | 构建版本、命令、原始日志 | ✅ 完整 |
| 6 | 白天、夜间和 2 次切后台的测试日志 | ✅ 原始日志已复制；⚠️ **和产物 hash 的对应缺失（MISSING）**，只能通过提交和包体大小对应 |

## 1. 提交
- commit `09a1b8e456fd38dadf632f627189883808307cbe`
- tree `082f1c0ee20c38403d3f3bbb3ff5fb27d2ecf14a`
- parent `455ee48b314cd477b90c5c71b9635e88906404ad`
- 作者时间 2026-10-17 10:28:31 +0800（= 10-16 22:28 EDT）。提交说明以 "E1: build-wechat-guarded.sh …" 开头。
- **父链**：09a1b8e ← 455ee48 (V1r) ← 511953e (V1) ← c08dbf3 (N3) ← d9f87b2 (G2b) ← 1bf0bfa (G2) ← …
  - b0020ed..09a1b8e 的完整链（57 个提交，其中 5 个合并提交）见 `git/chain_b0020ed..09a1b8e.txt`。
  - 底座：b0020ed4ea1f…（往下 57 个）、77b76c3d15ec…（往下 28 个）都是它的祖先。
  - 根提交 d32920c4376d…。整个历史共 462 个提交，其中 88 个是合并提交。
- **指向它的 refs**：
  - `refs/heads/integration/build05-20261016T2048`（里程碑分支，也是 bundle 里的 ref）
  - `refs/heads/ggbot/audit-fixes-77b76c3`
  - 包含它的分支见 `git/refs.txt`，commit 对象原文见 `git/commit-object.txt`。
- 只存在于本地，GitHub 上没有。

## 2. README v2.1
- 文件：`readme/README_v2.1.md`。
- 原件在 `team/ggbot/outbox/20261017T041004Z-integration-build05-milestone-readme-v2.1/README.md`，4,727 B，SHA256 50ef036b…8c3b。
- 同一文件夹里的 `SHA256SUMS` 和 `suite.txt` 也已复制。

## 3. bundle
- **文件名**：`qfl-build05-09a1b8e-full.bundle`
- **大小**：138,105,148 B
- **SHA256**：`5d4ed05d6ab3eafc0a14894109384adfea9fcb797a47a08f63be6a409568c2e2`
- **box 上的路径**（两份内容相同）：
  - `/workspace/wechat-game/team/ggbot/outbox/20261017T041004Z-integration-build05-milestone-readme-v2.1/qfl-build05-09a1b8e-full.bundle`
  - `/workspace/wechat-game/team/ggbot/outbox/20261017T033129Z-integration-build05-milestone-readme-v2/qfl-build05-09a1b8e-full.bundle`
- **更正一**：之前说 v2.1 里那份是硬链接，**其实不是**。两份 inode 不同，各自的链接数都是 1，只是内容相同。上传时只传一份就行（`bundle/bundle-files.txt`）。
- **list-heads**：`09a1b8e456fd38dadf632f627189883808307cbe refs/heads/integration/build05-20261016T2048`（`bundle/list-heads.txt`）。
- **前置提交**：无。verify 结果是 "is okay"、"The bundle records a complete history"，哈希算法 sha1。在空仓库里也验证过（`bundle/verify.txt`）。
- **命令**：
```bash
shasum -a 256 qfl-build05-09a1b8e-full.bundle   # 应输出 5d4ed05d…c2e2
git bundle list-heads qfl-build05-09a1b8e-full.bundle
git init -q /tmp/v && git -C /tmp/v bundle verify "$PWD/qfl-build05-09a1b8e-full.bundle"
git clone -b integration/build05-20261016T2048 qfl-build05-09a1b8e-full.bundle qfl-milestone
git -C qfl-milestone rev-parse HEAD HEAD^{tree}   # 09a1b8e4… / 082f1c0e…
```
- **更正二**：界面验收部做里程碑验收（milestone-09a1b8e/summary.md §0）时，核对的是**旧的增量 bundle** `integration-build05.bundle`。
  - 它的 SHA256 是 1f1f33df…eca08，需要本地已有 b0020ed，放在 outbox 20261017T025522Z，已被取代。
  - 完整 bundle 5d4ed05d… 是后来在 Mac 上核对的，见 readme-v2-a3 和 a3b-a17395c 两次复验。那两次核对都对上了，重新 clone 后 HEAD 和 tree 一致，用守护脚本构建的包体也和第一次一样（19,125,680 / 19,867,113）。

## 4. 构建产物（MISSING：SHA256）
| 产物 | 字节数（实测） | SHA256 |
|---|---|---|
| wechat-release（`creator-build-project/build/wechat-release`） | **19,125,680** | **MISSING** |
| web-test（`creator-build-project/build/web-test`） | 19,867,113 | **MISSING** |

微信各分包的字节数（ROOT 和 SUB，三次构建都一样）：

| 包 | 字节数 |
|---|---|
| ROOT | 1,862,250 |
| main | 1,176,053 |
| resources | 445,828 |
| internal | 297,535 |
| audio_bgm_island | 418,907 |
| board_art | 2,112,160 |
| region_island | 2,967,101 |
| region_lakeside | 464,387 |
| region_meadow | 2,934,449 |
| region_skycity | 3,326,944 |
| shared_effects | 563,694 |
| static_seat_preview | 2,556,372 |

安全线是 24,641,536 B。

**为什么缺**：
- 从来没有记录过产物或单个文件的 SHA256。构建配置里 `md5Cache:false`，守护脚本也只打印总字节数。
- 产物是在 Mac 上构建的，验收后就删掉了，box 上没有副本。
- Mac 桌面包 `~/Desktop/QIFENGLE-test-build05` 里现在的 wechat-release 和 web 都是 09a1b8e，但没有人算过它们的 hash。

**我找过的地方**：
- `/workspace/wechat-game/ui-audit/` 下所有日期（`rg -l 09a1b8e`、`19125680`、`sha256`）；
- 整台 box 上搜 `wechat-release`、`web-test` 目录和 `*QIFENGLE*`、`*09a1b8e*`；
- `team/ggbot/outbox`、`team/*`、`work/*`。

**补救**（要界面验收部在 Mac 上执行，GGbot 没有动 Mac）：
```bash
cd ~/Desktop/QIFENGLE-test-build05
find wechat-release web -type f -print0 | sort -z | xargs -0 shasum -a 256 > files-09a1b8e.sha256
shasum -a 256 files-09a1b8e.sha256   # 用这一行作为整体的 hash
```

## 5. 构建
- **版本**：Cocos Creator 3.8.8（日志里有 "Build with Cocos Creator 3.8.8"）。
  - 配置：wechatgame，debug=false，md5Cache=false，appid wx3bdd911c5c06f591。
  - 起始场景 `WorldR5Integration.scene`。
  - 构建时间：Mac 上 10-17 10:58 CST（= 10-16 22:58 EDT）。
- **命令**：
```bash
export CREATOR="$HOME/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator"
bash tools/build-guard/build-wechat-guarded.sh both
```
- **构建输入**：脚本和两个配置文件在 09a1b8e 里的 blob 和 SHA256 见 `build/build-inputs_at_09a1b8e.sha256.txt`，配置原文是 `build/wechat-release.json` 和 `build/web-test.json`。
- **三次构建**：

| 构建 | 守护输出 | 原始日志 | 结果 |
|---|---|---|---|
| 1. 验收用的 clone | `build/guard.out` | `build/raw-logs/wechat-release.try1.log.gz`、`web-test.try1.log.gz` | 两个包都是第 1 次就通过，0 次重试 |
| 2. 按 README 走的 clone | `build/guard2_layman.out` | `build/raw-logs/layman_*.log.gz` | web 第 1 次被拒（2,309,217 B，日志有「当前初始场景不存在」），第 2 次通过 |
| 3. 用完整 bundle 复验 | `build/guard_readme-v2-rerun.out` | 没复制，在 `ui-audit/2026-10-16/readme-v2-a3/logs/` | 第 1 次通过 |

  - 原始日志是用 gzip 压缩的原文，没有改动内容。原文件的 SHA256 和字节数见 `source-files.sha256.txt` 和 `source-files.bytes.tsv`。

## 6. 测试日志（白天 / 夜间 / 切后台两次）
- 来源：`ui-audit/2026-10-16/milestone-09a1b8e/`，是界面验收部的结论，原文在 `tests/ui-audit_milestone-09a1b8e_summary.md`。
- 全部用 390×844 真实点击录制，开着 `__worldFlowLog`。

| 录制 | 时间线 | 标记 | 游戏日志 |
|---|---|---|---|
| 白天 | `tests/raw/recday.log` | `ib_day_390.json` | `ib_day_390_worldFlowLog.txt.gz` |
| 夜间（nightProp=true） | `recnight.log` | `ib_night_390.json` | `ib_night_390_worldFlowLog.txt.gz` |
| 切后台 1（walking-out，16.54s 回前台 → 47.549s 到岛） | `recvis3.log` | `ib_day_390_vis3000.json` | `…vis3000_worldFlowLog.txt.gz` |
| 切后台 2（crossing-out，33.409s 回前台 → 64.423s 到岛） | `recvis18.log` | `ib_day_390_vis18000.json` | `…vis18000_worldFlowLog.txt.gz` |

- **和产物的对应（部分）**：
  - 构建 1 和这四次录制是同一次 Mac 会话、同一个 clone。summary §0 确认 HEAD 09a1b8e、tree 082f1c0e，§1 和 §2 写明测的就是这次构建，wechat 19,125,680、web 19,867,113。
- **MISSING**：
  - 测试日志里没有记录产物 SHA256，也没有记录服务的路径或 URL，所以**没法按产物 hash 把日志和产物对上**。只能按提交、会话和字节数对应。
  - 要补，就得在 Mac 上按第 4 节算桌面包的 hash。但桌面包是后来另外拷贝的，严格说只能证明它和当时的产物字节数一样。
- **留意**：worldFlowLog 开头有 console error（`404 File not found`、`ERR_CONNECTION_RESET`）。界面验收部写的是「pageerror 0、HTTP≥400 0」，这两种统计口径不同。这里如实保留，没有判断。
- **没复制的大文件**：录屏 `raw/*.webm`、音频 `audio/*.wav`、截图 `*.png`。其中录屏和音频的 SHA256 与字节数在 `source-files.sha256.txt`。

## 桌面包哈希（验收后复制的副本）

- 文件：build/desktop-pkg-sha256-09a1b8e.txt，由界面验收部在 Mac 上计算，时间 2026-10-17 03:07 EDT。
- 内容是 09a1b8e 验收后复制到 ~/Desktop/QIFENGLE-test-build05 的副本，不是原始构建目录。
- 共 1241 个文件；wechat 19,125,680 B，web 19,867,546 B（含 start.command，比 web-test 多 433 B）。
- 清单正文整体 sha256：2b6919e926145edf7d9e31e43517883e774820fa64abfbe7ce10033adc8492f2
