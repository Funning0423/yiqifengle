# 小岛之后各场景界面问题清单（第一批）

基线：`integration/build17-cand` 76a04336。截图全部来自已有真机/浏览器测试，不是本次补拍：
- r7 报告（同一提交 76a0433）：/workspace/qifengle/test-reports/20261023T0300_r7-76a0433/
- build05 全流程：/workspace/qifengle/test-reports/20261023T0324/

本清单用到的截图已拷到 `shots/`。box 上没有可用的 web 包，所以没有补拍；Funning 的 Mac 上没有运行或创建任何东西。

## 关于 qfSkip
- `?qfSkip=island-finale|meadow-finale|skycity-finale|lakeside` 在 `world-r2/QaSkip.ts`。它只在 web/QA 包和微信 develop/trial 包里生效，会换成隔离的测试存档。
  - 这个文件在 `scene/b18-audit-base` 上，**不在 build17-cand 76a04336 里**。
- 按新规则，**走查不能用 qfSkip 或 __qfTeleport 跨过转场**。
  - 转场现状只从代码和已有截图推断。
  - 每条转场问题都标了「待 __qfPreTransition 真机走查」。
- 已有截图都是正常游玩（触摸）拍的，转场是完整播放的，可以作为现状证据，但时长要以真机为准。

## 一、转场类（重点）

| ID | 转场 | 问题 | 优先级 | 截图 | 状态 |
|---|---|---|---|---|---|
| T-01 | TR1 小岛→帆船、TR3 草原→热气球、TR8 任意→小岛 | 用纯黑 #000 全屏盖屏。出发时盖 0.25 s、揭开 0.35 s（`RegionJourneyCore.SETOFF_FADE`）；回家时盖 0.4 s、揭开 0.5 s（`HomeTransition.HOME_FADE`）。<br>明亮画面里突然闪黑，看着像卡顿或闪屏。三处时长不统一，黑屏时也没有任何提示。 | 高 | shots/T01_tr1_black.png、T01_tr3_black.png、T01_tr8_black.png | 待 __qfPreTransition 真机走查 |
| T-02 | TR5 L12 结算→天空之城终镜 | 终镜画面大半是空天空，城只露一角，没有焦点。<br>底部只有「继续旅程 →」「主页」两颗平面按钮，不点就一直停着（build05 记录超过 80 s）。<br>夜间灰天空 #333 已由 baa28c06 修复。 | 高 | shots/T02_sky_end_day.png、T02_sky_end_grey_b05.png | 待 __qfPreTransition 真机走查 |
| T-03 | TR6 天空之城→热气球→风铃湖畔 | 约 48 s 的长镜头里没有任何到达提示，也不能跳过。<br>落地后又要约 45 s 才自动进棋盘，玩家会以为卡住了。 | 中 | shots/T03_lake_landing.png、T03_lake_night_14s.png | 待 __qfPreTransition 真机走查 |
| T-04 | TR4 热气球→天空之城 | 约 15 s 时镜头从云层硬切到海面；16.0–16.3 s 篮子被海面吞掉。<br>11.41 s 太阳一帧跳了 86°，整屏明暗突变，看着像闪了一下。 | 中 | shots/T04_balloon_15s.png、T04_balloon_16s.png | 待 __qfPreTransition 真机走查（数据见 r7 报告第 5、9 节） |
| T-05 | TR6 夜间降落 | 18–22.5 s 左侧有一大块深蓝多面体，左下有黑色树剪影挡住前景。 | 中 | shots/T05_lake_night_occluder.png | 待 __qfPreTransition 真机走查 |
| T-06 | TR2/TR4/TR6 到达→棋盘 | 到新章节时棋盘界面直接弹出，没有地区名。湖畔关卡名牌只显示数字。<br>玩家感觉不到「到了新地方」，紧接着就是 8 行规则弹窗。 | 中 | shots/T06_lake_board_noname.png、T06_L5_start.png、T06_L9_start.png、T06_U04_L13_popup.png | 代码推断 + 已有截图 |
| T-07 | TR7 关卡间「下一关」 | 结算面板直接换成下一关的规则弹窗，背景不变，棋盘没有过渡。<br>不算问题，但和章节转场的节奏不统一。 | 低 | shots/U03_L12_result.png | 代码推断 |
| T-08 | TR9 L18→结局 | **没有结局**：L18 通关后仍是普通结算，「回小岛」/「下一关」。<br>雪山 region（region_snowpass 分包）没接进主流程（r7 报告第 11 节）。 | 高 | shots/T08_L16_start.png | 需真机补截（当时正常游玩卡在 L16，从来没截到 L18 通关画面） |

## 二、界面类

| ID | 场景 | 问题 | 优先级 | 截图 | 状态 |
|---|---|---|---|---|---|
| U-01 | 湖畔自由行走、天空之城终镜 | 底部常驻「继续旅程 →」「主页」两颗按钮，是平面细条加小字，不是主页那种立体按钮。<br>湖畔漫游时一直挡着画面下方。 | 中 | shots/U01_lake_explore_flatbtn.png、T02_sky_end_day.png | 已有截图 |
| U-02 | 湖畔/天空城棋盘 HUD | 顶部目标条只有图标加数字（如 2 / 26），没有关名或地区。<br>夜间 HUD 对比待查。 | 中 | shots/T06_U04_L13_popup.png | 已有截图；夜间需真机补截 |
| U-03 | 章节结算 L4/L8/L12 | 章节最后一关的结算和普通关一模一样，没有章节完成感（地区印章 reward_seal_* 没露出）。<br>L12 只有「回小岛」一颗按钮，没有「继续旅程」，和 L4/L8 的两颗按钮不一致。 | 中 | shots/U03_L12_result.png | 已有截图 |
| U-04 | 湖畔 L13 规则弹窗 | 正文最多 8 行，文字太多。 | 低 | shots/T06_U04_L13_popup.png | 已有截图 |
| U-05 | 湖畔失败面板 | 「差一点点」面板有提示句加道具行，字多。 | 低 | shots/U05_L16_fail.png | 已有截图 |
| U-06 | 湖畔离盘自由行走 | 镜头会穿进树干或石柱，整屏深色。镜头问题，这里只登记，归场景设计部或运镜。 | 中 | shots/U06_lake_cam_clip.png | 已有截图 |
| U-07 | 帆船/热气球路线途中 | 途中没有任何界面（没有进度，不能跳过），这符合「不放多余按钮」。<br>建议：只在重复观看时给一个 44pt 的「»」跳过角标，3 s 后才出现。 | 低 | shots/U07_sail_ride.png | 代码推断；待确认 |
| U-08 | 雪山口 / 终章区域 | 没接入主流程，界面无从评估。 | — | — | 需真机补截（接入后） |

## 需真机补截
- 所有转场的精确时长和首末帧（T-01～T-07）：等 GGbot 的 __qfPreTransition 做好后，用正常触摸触发，完整播放录屏。
- L18 通关画面、结局入口（T-08）。
- 湖畔、天空城夜间 HUD 和结算（U-02）。
- 雪山口（U-08）。
