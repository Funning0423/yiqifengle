# Clonebot 交接 · 小游戏开发/测试暂停 · 2026-11-05

> 【进度备注 · 2026-11-05】体验版 `1.0.202611060228` @ tip `02c9bd5e` · 小游戏开发/测试暂停 · 交接 Clonebot
>
> PM 可读版：`docs/handoff/PM/PROGRESS-060228-PAUSE-20261105.md`。短指针：`work/pm/PROGRESS-060228-PAUSE-20261105.md`。

本文是给 Clonebot 的操作交接。只记已给出的事实。不改玩法，不翻转 `TransitionShaderWarm` 或湖畔 kit 默认值。

本 integrate 分支对象库里没有 `ca1bf8f9`，也没有更早的本文件。体感以下面体验版 `1.0.202611060228` 的口头记录为准。

## 现在做什么

1. 读完本文件和 PM 进度备注，然后停手。
2. 不要为周期掉帧或穿模再开修复分支。
3. 小游戏开发与测试暂停，直到另行恢复。

## 体验版

| 项 | 值 |
|---|---|
| 游戏 | 《咦，起风了》 |
| AppID | `wx3bdd911c5c06f591` |
| version | `1.0.202611060228` |
| Integrate tip | `02c9bd5e`（`02c9bd5eb9eff9adced0a117be59eddb01146160`，已推送） |
| 分支 | `gbt/r5-b20-integrate-landing-visual-bg2` |
| 前序 | `9ec8410`（已记录体验版 `1.0.202611050927`） |

## 本轮体感（Funning）

| 结果 | 项 | 原话 / 处置 |
|---|---|---|
| **PASS** | 草原起飞后热气球篮门已合上（飞行中门关） | 修好了 |
| **FAIL / hold** | 周期掉帧 | 「还是没有优化」。先不修 |
| **FAIL / hold** | 穿模 | 「也是一样」。先不修 |

本轮口头未确认，不要记成通过或失败：甩海、着陆后一直走、底栏「继续旅程 / 主页」、湖畔空盘 / 轻俯视。

## 包内四条（相对 `9ec8410`）

| # | 内容 | 来源 | 本分支落地 | 既有说明 |
|---|---|---|---|---|
| 1 | SkycityLegHeavy 默认 OFF | tip `0773db73` / feature `2beb1cd4` | `203503e8d` + docs `098803791`（cherry of `0773db73` handoff） | `docs/handoff/GGbot/SKYCITY-LEG-HEAVY-DEFAULT-OFF-20261105.md` |
| 2 | 篮门 + 下篮（door + dismount） | fix `24fd2f22` / HEAD `1d29c5c7` · `cine/balloon-door-dismount-fix` | `66286cf40` | `docs/handoff/运镜bot/HANDOFF.md` |
| 3 | 湖畔空盘竞态：preload 之前 `fromFlag` | tip `d626718b` / feature `28f5b386` | `a77f1a6cd` + docs `dfe0c01f8` | `docs/handoff/GGbot/LAKESIDE-KIT-EMPTY-BOARD-RACE-20261105.md` |
| 4 | 湖畔棋盘机位：kit-ON `portraitFusion` 轻俯视 | fix `c6835e99` / HEAD ~`82ccdbe2` · `cine/lakeside-board-cam-fix` | `02c9bd5e` | `HANDOFF.md` 末节 |

来源短 SHA 与「本分支落地」不是同一个提交。本分支 `git rev-parse` 只能解析 `02c9bd5e` 与 `9ec8410`。`0773db73`、`28f5b386`、`c6835e99` 只以文字出现在既有提交说明或 handoff 里；`2beb1cd4`、`24fd2f22`、`1d29c5c7`、`d626718b`、`82ccdbe2` 同样不可解析。`28f5b386` 的完整写法在空盘竞态说明正文里。`82ccdbe2` 按交接记为约等于该运镜分支 HEAD。

## 不要动的默认值

- **TransitionShaderWarm 默认 OFF 仍有效**（PR #66，体验版 `1.0.202611050759` @ `dc248d14`，Funning「不卡了」）。未经 Funning 不要 `setTransitionShaderWarmEnabled(true)`，不要把 `TRANSITION_SHADER_WARM_ENABLED` 改回 `true`。全文 `docs/fps/PERIOD-STUTTER-TSW-ROOT-HIT-20261105.md`。
- 湖畔 kit trial 默认 ON：保持本包现状，不要为了本交接把默认翻回去。
- SkycityLegHeavy 默认 OFF：保持本包现状。本轮周期掉帧仍 FAIL / hold，不据此在暂停期间把重路径重新打开。

## 恢复之后的队列（暂停期间不做）

1. **周期掉帧。** 段：草原→天空城升空，以及着陆后走路。原话「还是没有优化」。不要再归因到已关闭的 TSW。
2. **穿模。** 原话「也是一样」。
3. **可选核对**（本轮没有口头结论）：甩海、着陆后一直走、底栏继续旅程/主页、湖畔空盘、湖畔 kit-ON 轻俯视。
4. **已知缺口：** 莲座等（lotus seats）。本文件不写复现步骤。

## English

Pause minigame development and testing. Hand off to Clonebot. Do not keep fixing the held fails.

Trial `1.0.202611060228` @ `02c9bd5e` (pushed), AppID `wx3bdd911c5c06f591`, versus prior `9ec8410`.

PASS: meadow-takeoff balloon basket door stays closed in flight. FAIL / hold: periodic stutter ("still not optimized") and clipping ("same as before"). Not orally confirmed: sea fling, continuous walk after landing, bottom-bar 继续旅程/主页, lakeside empty board / light top-down.

ROOT HIT remains: TransitionShaderWarm default OFF (PR #66). Do not re-enable without Funning. Do not flip kit defaults.

When work resumes: period stutter on meadow→skycity ascent and the post-landing walk, plus clipping; optionally verify the unconfirmed items; known gap includes lotus seats. `ca1bf8f9` is not in this object store.
