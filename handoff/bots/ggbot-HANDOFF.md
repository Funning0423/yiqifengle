# GGbot 交接文档（HANDOFF）— 咦 起风了 / build05 r4

更新时间：2026-10-17 08:3x ET（12:3x UTC）。写给可能接手的 Cursor CLI。

## 1. 角色与规则
- 角色：GGbot，微信小游戏「咦 起风了」工程（Cocos Creator 3.8.8）。
- 仓库：`/workspace/wechat-game/yiqifengle`；交付目录：`/workspace/wechat-game/team/ggbot/outbox/<UTC ts>-<名称>/`。
- 相关方：Grok Bot（负责人，现在用量将尽，**只做验收**）；Voice Bot（色彩/光照/水/音频）；运镜bot（相机、hook、落点）；界面验收部（Mac 实机验收，消息设 priority:true）。
- **不要在群「微信小游戏的开发小组」讨论**（Funning 7:33 ET 要求，省用量）：需要配合直接私聊对应的人，交付结果直接发给 Grok Bot。
- 原话规则：「所有人只在自己的新分支上提交，不许 force push、不许直接改主线，交付附 SHA + 预览视频/截图，我验收。只用免费素材，不付费。」
- 只在本地，不 push。不改共享仓库 `.git/config`。提交一律：
  `git -c user.name="Cursor Agent" -c user.email=cursoragent@cursor.com commit ...`
- 盒子是共享机器：**禁止 pkill -f / killall 按名字杀进程**，只杀自己启动的 PID。
- Funning 的 Mac 磁盘快满：Mac 上的构建/缓存/录屏用完立即清理。
- 每个改动都报告包体增量；门限 **24,641,536 B**。
- Funning 桌面包停在 `09a1b8e` 直到湖畔验收通过。
- 对 Funning 用中文回复；UI 保持极简。
- 盒子没有 Cocos Creator、没有 web 构建，不能截真实引擎画面；计算出来的色块必须注明是计算值，真实截图在 Mac 上做。

## 2. 分支与完整 SHA
| 用途 | 分支 / 提交 | 完整 SHA |
|---|---|---|
| **r4 最终** | `integration/build05-r4-20261017T122042Z` | `2153a65cd4c97208a202746d251e3a458d4bb98f` |
| r4 dryrun3（dryrun2 + Voice 物件补光） | `ggbot/build05-r4-dryrun3` | `6f42df4b9202df285186b25a632d8d49a6ff693d` |
| r4 dryrun2 | `ggbot/build05-r4-dryrun2` | `02e7fd4147913032c84531a5f779338321d14f2f` |
| r4-prep（B2 女孩冻结副本 morph） | `ggbot/build05-r4-prep` | `97b761d11f14f8d24e3b690e370cb0da04ff9127` |
| 旅途修复（[QF_LAKE] error 行等） | `ggbot/build05-r4-journey-fixes` | `5bb9e0da057efde43879b7cd1e98adf8f09c7788` |
| UI 修复（宝箱/无暂停按钮/切后台湖声） | `ggbot/build05-r4-ui-fixes` | `50a3074da5d74344b5a4465c3ea9f5b815b9d287`（含 ebd9658、2c12565） |
| ebd9658 结算宝箱 | — | `ebd96582f1e59959ca64f3549f8e1076d5932cba` |
| 2c12565 旅途无暂停按钮+水印 | — | `2c12565b49fee47f00f0978a5a220a6688569ab8` |
| 天空之城园丁动画接续 | `ggbot/build05-r4-skycity-figure` | `bfdcf1968cd9821106fb2ca1fa9fe487d10afa14` |
| 测试线 | `ggbot/build05-r4-tests-reward` | `dc25cec64cf9200b3c02a93eb447d053836789d7` |
| 测试线基底（Voice e79bfca） | `ggbot/build05-r4-tests` | `e79bfcad4a3e2077a3bae62872a7a524206d756a` |
| reward 测试修复 | `ggbot/build05-r4-rewardfix` | `ec0de1f934797000df3585a4dc0f11363490770a` |
| Voice 地形补光（r4 栈底座） | `467b36d`（`voice/build05-lakeside-r4-landfill-5bb9e0d`） | `467b36d495ccd456201bcb16f82b82ac8eae5aa6` |
| Voice 物件补光（树/墙/石/云） | `voice/build05-lakeside-r4-fill-props` | `32be13f677d5cca7b34aad2bccb0f0b6e029d358` |
| 运镜 girl-frame | `5b1f41d` | `5b1f41dc96733891e38fd5bdabf1bca6cb0d5667` |
| **运镜 草甸落点（r4 采用，Mac 零跳变）** | `cine/region-hooks-meadow-r4.1` | `95d3eeed53e6c67a85ac05e47b9105672976fde7` |
| 运镜 草甸落点 GG keep-out 版（**r4 不用**，r4.1 待定） | `cine/region-hooks-meadow-r4-ggkeepout` | `2665429bcc6c6229faad2d2f08368731fb588e7d` |
| 运镜 夜间玻璃牌 | `cine/night-glass-r4` | `9c8fb36656abb4aae4a6db81176df8969535f02e` |
| r3 | `integration/build05-next-20261017T0818Z-r3` | `f3d3614361dd2dc23098353ff314a520c3e1c00e` |
| Funning 桌面包基线 | — | `09a1b8e456fd38dadf632f627189883808307cbe` |
| **作废** 旧 dryrun | `ggbot/build05-r4-dryrun` | `6235d3c400923af7861bb274047c02d8cea795f2` |
| 不要叠 | `91ef28b` | `91ef28b572f40bc95bd877af3b4231acdc77a6ec`（被测试线里的 ec0de1f/332abcc 取代） |

## 3. r4 叠放顺序（2153a65 = f3d3614 之上 47 个提交，见 outbox `PATCH-LIST.txt`）
1. `467b36d` 底座（= f3d3614 + r4-prep 97b761d 的 10 个提交 + Voice 湖畔水/夜光 + 旅途修复到 5bb9e0d + Voice 地形补光）。
2. 运镜 `97b761d..5b1f41d`（hook/机位 6 个提交，girl-frame 为 eb8aa92）。
3. `9c8fb36` 夜间玻璃牌（为 714a6d0）。
4. **测试线** `f3d3614..dc25cec`（b3cb421 … 332abcc）——**必须放在 UI 修复之前**。
5. UI 修复 `ebd9658`、`2c12565`、`50a3074`（为 6a45937、1cd4dbb、02e7fd4）；**跳过 91ef28b**。
6. 园丁 `bfdcf19`（为 d03c367）→ = dryrun2 `02e7fd4`。
7. Voice 物件补光 `32be13f`（为 6f42df4，无冲突）→ = dryrun3。
8. 运镜 `95d3eee`（为 2153a65，cherry-pick 在最上面，无冲突；没有挪到 5b1f41d 后面，以保持已测提交不变）。
- 冲突说明：唯一出现过的真冲突是 `tools/journey-integration/run-suite.cjs` 的测试列表那一行——**两边都保留**。

## 4. 怎么跑测试
- Node 22（必须 ≥22.6，表头须显示 node=v22）：
  `QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript npx -y node@22 tools/journey-integration/run-suite.cjs`（v22.23.3）
- Node 20：`QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript node tools/journey-integration/run-suite.cjs`（v20.19.2）
- 同时跑两个版本请用两个 worktree（套件会改写 `tools/journey-integration/reports/*`、`output/*`，这些改动不要提交）。
- 需要 `stripTypeScriptTypes` 的测试在 Node <22.6 报 BLOCKED_NODE（exit 78），不算通过也不算失败。
- r4 最终结果：Node 22 **91/92**（仅 navigation-guard BLOCKED_BROWSER）；Node 20 **89/92**（legacy-board-ui-pure、reward-background-return BLOCKED_NODE + navigation-guard），无 FAIL。
- 已知非通过：不含测试线的分支上有 5 项：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract（FAIL，测试线修好）+ navigation-guard（BLOCKED_BROWSER，盒子无浏览器）。
- 包体估算脚本：`node /tmp/r4sd-min.cjs <A> <B>`（TS→ES2020，去注释去空白，仅 scripts 下改动的 .ts；是上界，真实包体以 Mac 构建为准）。r4 vs f3d3614：JS +58,785 B，effect 源码 +981 B。f3d3614 时期实测微信包 19,294,468 B。

## 5. B 类错误定义
Mac 上 Playwright 采集（`lk.cjs` + `errs.py`，参考 `/workspace/wechat-game/ui-audit/2026-10-17/a3b-a995c41/errs.py`）中 console 级别为 `error` 的消息数；warning 不计。正常运行目标 = 0，且不得出现 `[QF_LAKE]`；只拦 `water/lakeside-water` 的故障注入必须恰好 +1 且旅途能走完。

## 6. 未结事项
1. **r4 Mac 验收**：outbox `20261017T122042Z-r4/MAC_CHECKLIST.md` 交界面验收部（priority:true），结果给 Grok Bot。
2. **r4.1 草甸落点**：运镜bot 的 `2665429`（左下角避开 3 工具栏）会让 08→09 超时 +4.40 s，待 Grok Bot 决定；定了再叠到 r4 上。
3. **r5**：天空之城落点（08→09 走位终点放在棋盘画面内、星庭旁，不挡棋子/UI）+ 彩虹桥方案 + 园丁站位挪到托盘上方可见区。
4. Voice Bot 帆船音效：主线时按 `timing.json` 配轨。
5. **湖畔验收通过后**：切里程碑，更新 Funning 桌面包（当前 09a1b8e），报告 HEAD 和包体。
6. 每个改动都要报告包体增量。
7. `ggbot/build05-r4-dryrun`（6235d3c）作废，不要用。
8. 清理：盒子上的旧 worktree（`/tmp/r3diag`、`/tmp/wt-r4t2*`、`/tmp/wt-r4`、`/tmp/wt-r4jf`、`/tmp/wt-r4ui` 等）可以 `git worktree remove`，分支保留。

## 7. 验收标准
- 微信包 ≤ 24,641,536 B，并报告与上一版的差值。
- 湖畔真实 DC ≤ 60（引擎实测；Voice 估算 53）。
- 60 FPS；棋盘 UI 首帧 ≤ 16.7 ms，否则后台预建。
- B 类错误：正常运行 0，无 `[QF_LAKE]`；故障注入恰好 +1 且旅途完成。
- 套件：Node 22 仅 navigation-guard 可 BLOCKED，其余 PASS。
- 交付必须附完整 SHA + 截图/预览视频；**Grok Bot 验收**才算通过。

## 8. r4.1（2026-10-17 09:46 EDT 更新）
- **分支**：`integration/build05-r41-20261017T125738Z`（worktree `/tmp/wt-r41`，仅本地）
- **HEAD**：`e4a05b982aaa5b98053ef71eeacff91f37cb8f56`，基于 r4 `2153a65`
- **栈**：`74c696e` 提示条到托盘上方（原 260ea02）→ `fd1a39d` 运镜bot 草甸落点 → `b1e41b2` Voice 出门实时脚步（原 cfe6429）→ `77883aa` 世界流程：出门/回家途中切后台冻结、回来继续（不闪回椅子、不重放，出门音轨按偏移续播）→ `e4a05b9` Voice 户外脚步响度（cherry-pick -x `f125cd2`，叠在 cfe6429 上，故 b1e41b2+e4a05b9 同栈是对的）
- **测试**：Node 22 94/95（仅 navigation-guard BLOCKED_BROWSER）；Node 20 92/95（+2 BLOCKED_NODE），无 FAIL；exit-footsteps 19/19。新测试 `test-world-background-freeze.cjs`。
- **包体**：vs 2153a65 脚本 +15,183 B（terser 压缩）+ 资源 +32,605 B ≈ +47.8 KB（估算）。
- **outbox**：`team/ggbot/outbox/20261017T134609Z-r41/`（bundle 已 verify、patches、套件输出、MAC_CHECKLIST）。
- **未结**：
  1. r4.1 Mac 验收（提示条 7 屏+横屏、草甸落点 7 屏、出门/回家有声录屏 + recording_levels.py 测户外脚步低于环境声 10–12 dB、对齐 ≤40 ms、切后台 3 s/10 s 不闪回）。
  2. 08→09 比 Build05 慢 1.19 s（最小屏 2.98 s），待 Grok Bot 接受。
  3. `WorldIntegrationBoot.runHomeTransition` 的 wait 用墙钟，后台停留超过过场超时可能超时（3 s/10 s 不受影响）。
  4. 室内 wood_1 比其它木地板变体低 3.4 dB（Voice Bot FYI，室内未改）。
  5. 彩虹桥在 `/tmp/wt-rb`（另一个 worker），天空之城落点归 r5。
