# r4.2 Mac 验收清单（ggbot/build05-r42-fixes @ 9a275731）

用途：在 Mac 上逐项验收 r4.2。每项都写了步骤、通过时应看到的日志或数值、以及怎样算不通过。r4 的失败值来自 2153a65 的 Mac 审计（handoff/20261017，`ui-audit/2026-10-17/r4-2153a65/`），作为对照。

## 0. 前置条件
- 构建的提交包含 9a275731：`git merge-base --is-ancestor 9a275731 HEAD` 退出码为 0（build07 已合入，用 build07 也行）。记录 `git rev-parse HEAD`。
- `guard both` 一次通过。记录 wechat-release 的字节数，门限是 24,641,536 B。
- 测帧时间用 web-test 包（debug:false），其余项用调试 web 包。浏览器、视口（390x844@2x）、机器与 r4 审计相同。
- harness 用 lk4.cjs 打上 `docs/r5/meadow-stutter/lk4-perf.patch`：
  - 测帧时间的跑次：`NOSHOT=1 NOVIDEO=1`，不设 `CAP`。
  - 截图类的跑次：照旧，可以截图。
  - 原因：r4 审计里 50–68 ms 的帧有一大部分是 harness 自己造成的，包括 page.screenshot、每帧 canvas 截取（CAP）和录屏。分析见 `docs/r5/meadow-stutter/RESULT.md`。
- 每个跑次都要保存 `*_journey_samples.json`、marks json 和 worldFlowLog，然后跑 `node tools/perf/journey_spike_attribution.cjs <samples.json>…`。

## 1. 太阳方向（item 7，3068ef49）
- **步骤**：`REGION=lake` 分别跑白天和夜间（`node lk4.cjs day` / `night`），走完整个湖畔旅途进入棋盘。
- **看什么**：samples 第 12 列 `sun = [name, fx, fy, fz]`。
  - 找最后一个 `state=region-travel` 的帧 A。
  - 找第一个 `state=level-loading` 的帧 B。
  - 找 `cams` 里第一次出现 `LakesideBackgroundCamera` 的帧 S（切换帧）。
- **通过**：
  - 从 A 到 S−1 的每一帧，`sun` 与 A 帧相同，每个分量差 ≤ 0.02。r4 白天 A 帧大约是 (0.418, −0.398, −0.816)。
  - 太阳只能在 S 帧或之后变成棋盘方向 (−0.418, −0.398, 0.816)。
  - 截图类跑次（CAP=1）：level-loading 开始那一对相邻截取帧 c(n)→c(n+1) 中，像素差 >24 的像素少于 2%。
- **不通过**：
  - B 帧或 B 帧之后、S 帧之前，fx、fz 变号。r4 就是这样：B 帧直接翻转，像素差 >24 的占 36.5%，平均亮度 117.6→130.3。
  - 「继续旅程/主页」按钮在太阳翻转的同一帧消失。
- 盒子上已通过 tools/lakeside/test_lakeside_sun_continuity.cjs，这只是假引擎测试，Mac 这项是真机验收。

## 2. 夜间进入棋盘（item 9，fa103008）
- **步骤**：
  - `REGION=meadow` 跑 `night`，`REGION=skycity`（以审计里的 REGION 名为准）跑 `night`。进入棋盘后关掉弹窗，等 1 s。
  - 只保留背景层（camsOff）截一张 360x640 的 `bgonly`。
  - 然后在棋盘内切换一次昼夜（`__worldDayNight.toggle()`），等 1 s 再截一张。
- **看什么**：
  - 第一项：`__worldIntegration.board().background` 诊断里背景相机的 clearColor，也可以对 MeadowBackgroundCamera / SkycityBackgroundCamera 直接读 `camera.clearColor`。
  - 第二项：bgonly 截图上地平线以上天空区域 20x20 的平均色。
- **通过**：
  - 夜间时 clearColor 为 (0, 12, 68)，每通道 ±3；天空采样每通道与 (0, 12, 68) 相差 ±12 以内，且满足 B > G > R。
  - 草甸棋盘的草地/地面要用夜间调色：bgonly 平均亮度不高于草甸夜间旅途最后一帧的平均亮度 +10。
  - 切到白天后 0.5–1 s 内 clearColor 回到白天色（读 diagnostics 或白天跑次的值），切回夜间后再次回到 (0, 12, 68)。
- **不通过**：
  - 夜间进入棋盘时 clearColor 是白天色，或者天空明显是白天（r4 就是这样：草甸和天空之城夜间棋盘显示白天天空）。
  - 切换昼夜后颜色不变。

## 3. 换场帧耗时（items 10/11，3dd09832；warning 6，9a275731）
- **步骤**：
  - 每个地区跑 2 次，用 `NOSHOT=1 NOVIDEO=1`、不设 CAP：
    - 湖畔：白天 + 夜间。
    - 草甸：白天 + 夜间。
    - 天空之城：白天。
  - 从 marks 取 `swapFrames`：`durPrev`、`durSwap`、`durNext`、`next3`。
  - 从 attribution 输出取 `levelLoading`（`max`、`p99`、帧数）和 `slowByCause`。
- **看什么，以及通过线**（Mac 60 Hz；harness 把 >17.5 ms 记为超过 16.7 ms，单帧 vsync 抖动在 16.7±1 ms）：

  | 帧 | r4 失败值 | r4.2 通过 | 备注 |
  |---|---|---|---|
  | 湖畔 swap（durSwap） | 29.1 白 / 32.0 夜（有截取时 36.7–36.9） | ≤ 17.5 ms | r4.2 让切换帧只切可见性 |
  | 草甸、天空之城 swap | 39.3 / 36.1 / 37.2（有截取） | 记录；目标 ≤ 17.5 ms | 9a275731 里这两张棋盘第一次绘制时仍要编译着色器，r5 G1（RegionBoardStaging）专门处理，见 RESULT.md |
  | level-loading 起始帧（B 及其后 2 帧的最大值） | 32.6–41.9 | 记录；目标 ≤ 17.5 ms | r4.2 把 UI 和棋盘场景的激活挪到这里，激活分批进行，每帧 64 个节点 |
  | level-loading 全段 max | 31.6–33.2 | ≤ 33.4 ms（最多丢 1 帧） | |
  | 湖首次出现（点「继续」后 approach 段的前 2 帧） | 135.8–153.4（合批开） | 两帧都 < 100 ms，且两帧之和 < 153 ms | warning 6 把首次出现拆成两帧，属于尽力而为 |

- **不通过**：
  - 湖畔 durSwap > 17.5 ms。
  - level-loading 全段出现 > 33.4 ms 的帧。
  - 湖首次出现单帧 ≥ 135 ms。
- **还要记录**：每一帧的 `bufferSize` / `textureSize` 增量（attribution 的 dBufMB/dTexMB）。r4 草甸 swap 帧 +9.55 MB buffer、+1.02 MB texture；r4.2 之后这部分应挪到 level-loading 帧上。

## 4. [QF_LAKE] 日志（item 3，dc6114bf）
- **步骤**：
  - (a) 调试包里 `__worldFlowLog=true`（Mac harness 默认会设），正常跑湖畔白天、夜间各一次，走到棋盘。
  - (b) 在湖畔 arrival 段切后台 3 s 和 10 s（`BG=3` / `BG=10`），然后回到前台，继续走到棋盘。
  - 每次都把 console 全部收下来（worldFlowLog + page console）。
- **通过**：
  - (a) 中含 `[QF_LAKE]` 的 console 行数为 0，info 和 error 都算。特别要确认没有 `journey-water-prewarm`。
  - (b) 中 `[QF_LAKE]` error 行数为 0，回到前台后能正常进入棋盘。
- **不通过**：
  - 出现 `info [QF_LAKE] {"event":"journey-water-prewarm",...}`（r4 正常跑次就有这一行）。
  - 出现 `error [QF_LAKE] lakeside journey not reached: cancelled`（r4 切后台时就有这一行）。
  - 出现任何其他 `[QF_LAKE]` 行。如果出现，把全文贴出来。

## 5. 故障注入：恰好 +1（item 4，619c8a8b）
- **步骤**：`FAILPAT='region_lakeside/import/0e/0e32e8040\.json' node lk4.cjs failwater`（湖畔，白天）。这个 pack 里只有 lakeside-water 的 Material（29ec51ab…）和 EffectAsset（391765d0…）。
  - 先确认 marks 里有 `abortReq`，并且路径就是这个 pack。如果 r4.2 以后 pack 号变了，用构建产物里含 29ec51ab 的那个 pack。
- **通过**（与不注入的同一跑次相比）：
  - console.error 行恰好多 1 行，raw 计数和去重计数都是 +1。
  - 多出来的那一行是 `[QF_LAKE] {"event":"journey-water-fallback","bundle":"region_lakeside",...,"reason":...,"look":"imported water (pre-r4 look)"}`。
  - `download failed` 行数为 0。
  - 旅途和棋盘能正常进入，湖面是旧外观（v2 tint），没有黑块，也没有卡住。
- **不通过**：
  - raw +6 或去重 +2（r4 是这样：除了 fallback，还有 5 行 pack manager 的 `download failed`）。
  - 出现任何 `download failed`。
  - 多出来的 error 不止 1 行，或者 fallback 一行都没有。

## 6. navigation-guard（item 20，80fdd125）
- **步骤**：在有浏览器的 Mac 上跑 `node tools/test_world_navigation_guard.cjs`，用与 r4 审计相同的 web-test 包。
- **通过**：PASS；等待 home 的 leave 按钮最长 60 s（NAV_TARGET_TIMEOUT_MS），实际等待时间约 35–36 s。
- **不通过**：30 s 超时（r4 就是这样），或者 60 s 仍然超时。

## 7. 回归抽查（可选，每项 1 次）
- 湖畔真实 DC：白天合批开，最大值 ≤ 60（r4 是 53）。
- 草甸、天空之城棋盘：开一局，暂停再恢复，结束后返回世界；console 没有 error；返回后 `__worldIntegration.board()` 为空或已清理。

## 记录模板
每项写：日期时间（EDT）、HEAD、包类型、视口、跑次 tag、关键数值、PASS/FAIL、证据文件名（samples/marks/截图）。
