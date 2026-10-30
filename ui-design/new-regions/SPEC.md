# 新地区 UI：旅程册 / 地区页入口 / 结局印章 / 见证清单（v1）
UI设计部 · 2026-10-29 · 分支 `ui/new-regions`，基于 `ggbot/fg-system-panels` 0d7b1729（只出设计稿，没有改游戏代码和资源）
基准 390×844 pt；单位 pt。生成脚本见 `src/`（art.py → screens.py → build.py / annot.py）。

## 0. 为什么简洁
- **地区数实际是 4 → 6**：现有 CHAPTERS 已经有潮汐、草甸、天空、湖畔 4 个，这次再加海岸、雪山（任务里写的「3 变 5」应该是另一种数法）。现状是每个地区一张 283×92 的大卡，4 张就占了 450pt；直接加到 6 张约 620pt，挤满屏幕，568 高的屏幕放不下（`compare_journey.png` 中图）。
- **一个焦点**：只有「当前地区」用大卡，带地区窗、关数和「继续 ›」；其余 5 个地区收成 50pt 的紧凑行，每行只放印章、名称和一个状态。面板固定 330×520，**不随地区数增长**。以后再加 1–2 个地区，只多一行，或者改成滚动。
- **一条进度条讲清全局**：总进度用一条分段条，6 段宽度按各地区关卡数分配（4/4/4/6/9/6），完成的部分染成该地区的颜色。不再每张卡各放一组星数和挑战数，挑战数挪到地区页。
- 不单调的办法：分段条的地区色、印章材质、焦点卡的奶油底加 3pt 木底，以及开启时的少量动效。没有加新元素。

## 1. 进度口径（我拍板）：**分母按关卡，共 33 关**
| 地区 | 计入进度的关 | 数 |
|---|---|---|
| 潮汐小径 / 花粉草甸 / 天空回声 | 主线 mainline-01..12（I1–4 / M1–4 / S1–4） | 4+4+4 |
| 风铃湖畔 | r04-lake-01..06（L13–L18） | 6 |
| 海岸 | r06-coast-01..09（C1–C9） | 9 |
| 雪山隘口 | r06-snow-01..06（暂定 L19–L24） | 6 |
| **合计** | | **33** |
- 理由：各地区的关卡数差很多（4 到 9 不等），按地区计数时，「海岸做了 8/9」也只算 0 个地区，玩家感觉不到进展。按关卡计数，每过一关数字都会动，分段条又能同时看出地区结构。
- 口径和 `RegionNodeProgress` 一致：tide、meadow、sky 的 regional 挑战（各 4 关）**不计入**，只在地区页显示为「挑战 x/4」。海岸也计入 33（PLAN2 D1 的 33 关口径）。如果 Grok Bot 决定海岸不计入，分母改成 24，分段条去掉海岸段，版式不用改。
- 显示：「旅程 14 / 33」。每一行显示该地区的「已通关/总关」，完成后显示「n/n ✓」。

## 2. 旅程册（`journey_390.png`，标注 `annot_journey_390.png`）
| 元素 | 规格 |
|---|---|
| 面板 | 宽 min(330, W−40)，高 520。矮屏（H<700）时焦点卡 92、行高 44，总高 466。r26，材质同设置面板（框 #D9BF8C，底 #B8966A，面 #F8EDD3） |
| 关闭 | Ø34，触控 44×44，圆心离框角 24pt |
| 标题 | 「旅程册」Bold 22pt，字距 6，#5A3A1E，y=+36 |
| 总进度 | 「旅程 14 / 33」Bold 15pt #6B4A2E，y=+78；分段条宽 = 面板宽 − 48，高 10，r5，y=+96；底 #E6D7B8，下沿 #CDB990；段缝 2pt（颜色同面板面） |
| 地区色 | 潮汐 #5FA8C8，草甸 #7DB55A，天空 #8E9FD6，湖畔 #E09A5A，海岸 #E2B25A，雪山 #7F98CC |
| 焦点卡 | 面板宽 − 48 × 112，r16，#FFF6E2，下沿 3pt #D9BF8C；地区窗 120×78；左上角印章 30pt；地区名 Bold 18pt；「2 / 6 关」Regular 14pt #6B4A2E；「继续 ›」Bold 14pt #377F6C；整卡可点，点了进地区页 |
| 焦点规则 | 最近一次游玩的地区；没有记录时取第一个「进行中」或「可前往」的地区；全部完成时取最后一个地区 |
| 紧凑行 | 行高 50（矮屏 44）；印章 32pt；名称 Bold 16pt；右侧状态 14pt。整行触控区 282×50，按下时当帧出现 #E9D6AE α67% 底；行间 1pt 虚线 #E3CFA6 |

### 2.1 五种行状态（`states_journey.png`）
| 状态 | 印章 | 名称 | 右侧 | 可点 |
|---|---|---|---|---|
| 完成 | 彩色 | #5A3A1E | 「n/n」+ Ø18 青色勾 #377F6C | 是 |
| 进行中 | 彩色 | #5A3A1E | 「x/n ›」Bold #377F6C | 是 |
| 新开启（还没玩过） | 彩色 | 名称右上 Ø7 红点 #E2553A | 「可前往 ›」 | 是；进入一次后红点消失 |
| 已知未开启 | 灰度章（α 叠底 35%） | #7A5A3A | 条件「主线 12 后开启」或「湖畔通关后开启」Regular 13pt #7A5A3A（4.5:1 以上） | 是，进地区页，按钮是禁用态 |
| 未揭晓 | **空白章**（浅浮雕风纹，见 `seals_compare.png`） | 「远方」 | 「继续旅行后揭晓」 | **否** |
- **不剧透但有期待**：只公开「下一个里程碑」能开的地区，显示名字、灰章和开启条件，让玩家知道再往前一步会有什么。更远的地区只显示空白章和「远方」，不露名字、图案和关数。
  - 例子：主线做到第 6 关时，天空是「已知未开启」，湖畔、海岸、雪山都是「远方」。
  - 通关主线 12 后，湖畔、海岸变成「新开启」，雪山变成「已知未开启」。
- 解锁规则：海岸和湖畔一样，主线第 12 关（record 11）后开第 1 关（REPORT）。雪山暂定湖畔 6 关全通后开启（PLAN2 B：从 L16 走到雪山，预载挂在 r04-lake-05），见待定项。

## 3. 地区页与入口按钮（`chapter_coast_390.png`、`states_chapter.png`、`annot_chapter_390.png`）
- 面板 330×430：标题为地区名，下面是地区窗（面板宽 − 64，按 208:136 等比）、左上印章 40pt、一句描述 15pt、关数或状态 14pt、**唯一按钮**。
- 按钮统一用 WarmButton primary 240×52，距底 26pt，全游戏同宽：
  - 可前往：「前往海岸」
  - 进行中：「继续」
  - 完成：「再访海岸」
  - 未开启：不用 3D 按钮，改用扁平禁用钮（#E6D7B8，文字 #7A5A3A「尚未开启」），开启条件写在上方一行。
- 点击当帧下沉 3pt（按下态见 states_chapter 最后一张），抬手 120 ms easeOutBack(1.4) 回弹后执行。
- 海岸描述「沿着海滩捡贝壳，一步步走向灯塔。」（取自 REPORT 引的 DESIGN 原意）；雪山描述「踩着新雪，去山口听风铃。」。文案可以再改。
- 小岛上的「继续旅程」木牌**不变**：仍然只有一个入口，点了直接去「焦点地区」的下一关。新地区不在小岛上加新按钮。

## 4. 结局印章（`ending_390.png`、`compare_ending.png`、`annot_ending_390.png`）
- 4 枚 Ø44、间距 58，改为 **6 枚 Ø40、间距 48，总宽 280pt**。320 宽屏时左右各留 20pt。两端轻轻下垂（Δy = 1.2·(i−2.5)²，最多约 7pt），排成一道弧，呼应风铃。
- 已得：彩色。未得：**空白章 α0.85**，和「远方」用同一张图。结局时不提示还差哪里，不打扰收尾情绪。
- 其他（木牌「旅程完成」、风铃、她、「回小岛」）全部不变，沿用 EndingScreen v2.1。
- 结局入口仍在 L18（d50c514c）。如果雪山 L19–24 成为主线终点，结局入口要挪到雪山最后一关，见待定项。
- 合成说明：效果图是在 ending_day 上抹掉旧印章带后重新放印章做的示意，真实渲染以引擎为准。

## 5. 新印章和地区窗（设计图，在 `art/`）
- `reward_seal_coast_draft.png`：金沙色内环，灯塔、沙滩、海浪，塔顶有暖光。`reward_seal_snow_draft.png`：灰蓝内环，雪峰加一颗金星。两张都是 115×128，木环、挂环和内环的结构与现有 4 枚相同。`reward_seal_blank_draft.png`：空白章。
- `region_coast_draft.png` 和 `region_snow_draft.png`：208×136 地区小窗。
- 现有 4 张地区窗是引擎渲染图，这两张是扁平的低多边形示意，**正式资源需要场景设计部用引擎渲染**（海岸可复用小岛灯塔，雪山可用 SP_snowpass 驿站）。印章可以由我按这两张精修后直接出正式图。
- 资源命名：正式图放 `board_art/popup/reward_seal_coast.png`、`reward_seal_snow.png`、`reward_seal_blank.png`，`board_art/r2/region_coast.png`、`region_snow.png`、`chapter_coast.png`、`chapter_snow.png`，**都不带 _draft**。`art/` 只是设计目录，不进构建。代码、资源、文件名和注释里都不要出现 system-panels SPEC §1.4 门禁所禁的那个词；地区缺图时走现有 grayscale 加锁的逻辑，不要写替代文字。

## 6. 动效（U1–U3，`keyframes_journey.png`、`keyframes_ending.png`、`new_regions_anim.mp4`）
| 动作 | 时长 | 曲线 |
|---|---|---|
| 面板进入（缩放 0.92→1，遮罩 α0.35） | 320 ms | cubic-bezier(0.05,0.7,0.1,1) |
| 面板退出 | 180 ms | cubic-bezier(0.3,0,0.8,0.15) |
| 焦点卡和各行依次出现（透明度 0→1，上浮 4pt） | 每行 200 ms，间隔 30 ms，6 项共 350 ms | easeOutCubic |
| 进度条从「上次看到的值」长到当前值（只在有变化时播） | 600 ms，在面板进入后开始 | emphasized decelerate |
| 新开启地区：空白章或灰章变彩色，同时一圈暖光（#FFDC8C α40%，R 从 1.0 到 1.3） | 360 ms，只播一次，没有闪烁 | easeOutCubic |
| 结局印章依次落下（从上方 10pt，缩放 0.9→1） | 每枚 240 ms，间隔 80 ms，6 枚共 640 ms | easeOutCubic |
| 按下 | 当帧（≤1 帧） | — |
- 「减少动态」开着时：去掉上浮和缩放，只保留淡入淡出；进度条直接显示终值。
- 「上次看到的进度」存在 `qfl.ui.journeySeenDone`（数字）；新开启红点存在 `qfl.ui.seenRegions`（JSON 数组）。

## 7. 7 种尺寸（`sizes_7_journey.png`、`sizes_7_chapter.png`）
320×568 / 360×780 / 375×667 / 390×844 / 402×874 / 414×896 / 430×932：
- 面板宽 min(330, W−40)，左右边距 ≥20。
- H<700 时用紧凑版（466），320×568 上下各留约 50pt。
- 结局印章总宽 280，320 宽屏左右留 20。

## 8. 给 GGbot 的实现要点和数据对接点
| 项 | 现状（0d7b1729） | 改法 |
|---|---|---|
| 地区表 | `ui/IslandPanels.ts:6` `CHAPTERS` 4 项，id 类型是 `'tide'|'meadow'|'sky'|'lake'` | 增加 `{id:'coast',name:'海岸'}`、`{id:'snow',name:'雪山隘口'}`，id 类型加 'coast'|'snow'；每项补 `stages`（计入进度的关卡数 4/4/4/6/9/6）和 `color` |
| 汇总 | `chapterSummary` :18 现在按星数 x/12 和挑战 x/4 汇总；`LAKE_GATE_RECORD`、`LAKE_STAGES` :13 | 改成返回 `{done,total,state:'done'|'progress'|'open'|'locked'|'far'}`：主线三区用 records[0..11] 已通关计数；湖畔、海岸、雪山用 r5 journal 的 records；state 按 §2.1 规则。星数继续在地区页里显示 |
| 海岸数据 | `scene/b19-coast-port` **50f5252c**（比 9fbf8822 新）：`region/RegionNodeProgress.ts` 有 `COAST_STAGE_IDS`、`COAST_STAGE_LABEL`、`COAST_STAGES=9`、`coastStagePhases()`、`challengeRegionOf()`，还没接线；`progress-journal.js` 的 `COAST_GATE_RECORD`、`COAST_STAGE_COUNT`、`COAST_NIGHT_REQUIRES` | done = `coastStagePhases()` 里 passed 的数量；state：s4Passed 为假 → locked 或 far；有 playable 而 passed=0 → open |
| 雪山数据 | **仓库里还没有关卡数据**，只有 `product/2026-10-29/expansion/PLAN.md` §2 的 6 关表（r06-snow-01..06）；场景在 `scene/b19-snowpass` 9b54c982 | 按海岸的模式加 `SNOW_STAGE_IDS` 和 `snowStagePhases()`。在数据出来之前，雪山行固定为 locked 或 far，done=0 |
| 旅程册 | `openJourney` :26，大卡布局 | 按 §2 重写为焦点卡加紧凑行；`IslandJourneyOverlay.ts:91` 调用处不变 |
| 地区页 | `openChapter` :54 | 按 §3：唯一按钮，四态；`extra`（tide/sky 的额外按钮）保留在描述下方 |
| 结局 | `ui/EndingScreen.ts:45` 写死 4 个 id，`(i-1.5)*58`，44pt | 改为遍历 CHAPTERS：`x=(i-(n-1)/2)*48`，`y=sealsCy+1.2*(i-(n-1)/2)^2`，40pt；未得用 `popup/reward_seal_blank`。`EndingFlow.endingLayoutChecks` 加一项「印章总宽 ≤ W−40」 |
| 印章名 | `ManagedMobileBoardUI.ts:1031` 地区名映射只有 4 个；:1001 领取 icon | 加 `coast:'海岸'`（或「夜航」，见待定项）、`snow:'雪山'`；icon 路径规则不变 |
| 见证清单 | `world-r2/LakeWinWitnesses.ts`（由 tools/pre-transition/gen_lake_witnesses.cjs 生成），`RegionFlowWitnesses.ts`；`test_retry_protection` 要求 catalog 里每一关都有 witness | 新增生成文件 `CoastWinWitnesses.ts`（C1–C9，从 tools/coast/test_coast_levels.cjs 的 3 个出货种子里取最短胜局）和 `SnowWinWitnesses.ts`（数据出来后再加）；label 用 C1..C9、L19..L24。海岸并进 catalog 时同时更新 test_lakeside_entry 的计数（12+6 → 12+6+9）。见证清单不面向玩家，这里只规定数据契约 |
| 存储 | — | `qfl.ui.journeySeenDone`、`qfl.ui.seenRegions` |
| 测试建议 | — | 7 尺寸下面板不超出屏幕、行触控 ≥44；5 种状态的快照；33 分母；结局 6 印章在 320 宽下不贴边；门禁词扫描结果为 0 |

## 9. 文件
`journey_390.png`、`chapter_coast_390.png`、`ending_390.png`（全屏）· `compare_journey.png`、`compare_ending.png`（前后对比）· `annot_journey_390.png`、`annot_chapter_390.png`、`annot_ending_390.png` · `sizes_7_journey.png`、`sizes_7_chapter.png` · `states_journey.png`（5 态）、`states_chapter.png`（4 态加按下）、`seals_compare.png` · `keyframes_journey.png`、`keyframes_ending.png`、`new_regions_anim.mp4`（约 5.6 s）· `art/`（新印章、空白章、地区窗设计图）· `src/`。
底图是 b17r12 的小岛真机截图和 post-island 的 ending_day，只作示意。

## 10. 待定项
1. **雪山解锁条件和在主线中的位置**：我暂定「湖畔 6 关全通后开启」。如果雪山是主线 L19–24（PLAN2 B 的转场方案），结局入口要从 L18 挪到雪山最后一关，需要 Grok Bot 定。
2. **海岸算不算进度**：我按 33 关计入；如果不计，分母改为 24。
3. **海岸印章叫什么**：50f5252c 把海岸奖励改成了「夜航」（C7–C9 通关就得），不是 9 关全通。要不要把印章名定为「夜航印记」，图案是否改成夜里的灯塔（目前是白天的灯塔），需要确认。
4. 雪山关卡数据还没进仓库，雪山行只能先显示 locked 或 far。
5. 正式的地区窗需要场景设计部用引擎渲染；印章正式图我可以接着出。
6. 「远方」只露到下一个里程碑为止，这条规则要不要放宽（比如提前公开所有地区名），需要确认。
