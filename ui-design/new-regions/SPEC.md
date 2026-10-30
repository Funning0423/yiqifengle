# 新地区 UI：旅程册 / 地区页入口 / 结局印章 / 见证清单（v1.1）
> v1 c21e9241 已获 Grok Bot 批准。v1.1 按以下决定修订：
> - 雪山：湖畔 6 关全通后开启，不算主线；结局入口留在 L18。
> - 海岸计入进度，分母改为 27，由有关卡数据的地区动态计算，雪山有数据后自动变为 33。
> - 见证清单是开发用的测试数据。
> - 雪山暂时只显示「未开启」或「远方」。
> - 海岸印章改为「夜航印记」，画夜里的灯塔。
> - 新增包体量化（§11）和进候选时机（§12）。
UI设计部 · 2026-10-29 · 分支 `ui/new-regions`，基于 `ggbot/fg-system-panels` 0d7b1729（只出设计稿，没有改游戏代码和资源）
基准 390×844 pt；单位 pt。生成脚本见 `src/`（art.py → screens.py → build.py / annot.py）。

## 0. 为什么简洁
- **地区数实际是 4 → 6**：现有 CHAPTERS 已经有潮汐、草甸、天空、湖畔 4 个，这次再加海岸、雪山（任务里写的「3 变 5」应该是另一种数法）。现状是每个地区一张 283×92 的大卡，4 张就占了 450pt；直接加到 6 张约 620pt，挤满屏幕，568 高的屏幕放不下（`compare_journey.png` 中图）。
- **一个焦点**：只有「当前地区」用大卡，带地区窗、关数和「继续 ›」；其余 5 个地区收成 50pt 的紧凑行，每行只放印章、名称和一个状态。面板固定 330×520，**不随地区数增长**。以后再加 1–2 个地区，只多一行，或者改成滚动。
- **一条进度条讲清全局**：总进度用一条分段条，6 段宽度按各地区关卡数分配（4/4/4/6/9/6），完成的部分染成该地区的颜色。不再每张卡各放一组星数和挑战数，挑战数挪到地区页。
- 不单调的办法：分段条的地区色、印章材质、焦点卡的奶油底加 3pt 木底，以及开启时的少量动效。没有加新元素。

## 1. 进度口径（已批准）：**分母按关卡，现在 27 关，按数据动态计算**
| 地区 | 计入进度的关 | 数 |
|---|---|---|
| 潮汐小径 / 花粉草甸 / 天空回声 | 主线 mainline-01..12（I1–4 / M1–4 / S1–4） | 4+4+4 |
| 风铃湖畔 | r04-lake-01..06（L13–L18） | 6 |
| 海岸 | r06-coast-01..09（C1–C9） | 9 |
| 雪山隘口 | r06-snow-01..06，**还没有关卡数据，不计入** | （6） |
| **合计** | | **27**（雪山有数据后 33） |
- 理由：各地区的关卡数差很多（4 到 9 不等），按地区计数时，「海岸做了 8/9」也只算 0 个地区，玩家感觉不到进展。按关卡计数，每过一关数字都会动，分段条又能同时看出地区结构。
- 口径和 `RegionNodeProgress` 一致：tide、meadow、sky 的 regional 挑战（各 4 关）**不计入**，只在地区页显示「挑战 x/4」。
- **不要写死**：`total = Σ CHAPTERS[i].stages`，只取 `hasData(i)` 为真的地区。分段条的段数和每段宽度也用同一个列表计算，宽度 = 关卡数 / total。
  - `hasData` 的判断：该地区在 `API.allStages` 里有至少 1 关。
  - 雪山关卡数据进来后，自动变成 6 段、33 关，不用改 UI 代码。
  - 没有数据的地区不进分母、不进分段条，但仍会出现在行列表里，按 §2.1 显示「已知未开启」或「远方」。
- 显示：「旅程 14 / 27」。每一行显示该地区的「已通关/总关」，完成后显示「n/n ✓」。

## 2. 旅程册（`journey_390.png`，标注 `annot_journey_390.png`）
| 元素 | 规格 |
|---|---|
| 面板 | 宽 min(330, W−40)，高 520。矮屏（H<700）时焦点卡 92、行高 44，总高 466。r26，材质同设置面板（框 #D9BF8C，底 #B8966A，面 #F8EDD3） |
| 关闭 | Ø34，触控 44×44，圆心离框角 24pt |
| 标题 | 「旅程册」Bold 22pt，字距 6，#5A3A1E，y=+36 |
| 总进度 | 「旅程 14 / 27」Bold 15pt #6B4A2E，y=+78；分段条宽 = 面板宽 − 48，高 10，r5，y=+96；底 #E6D7B8，下沿 #CDB990；段缝 2pt（颜色同面板面） |
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
### 2.2 开启规则（海岸经场景设计部确认，scene/b19-coast-port @ 50f5252c）
- **海岸开启**：主线第 12 关至少拿到 1 星后开启，代码里是 journey record 11（`progress-journal.js` `COAST_GATE_RECORD=11`）。门槛和湖畔的 `LAKE_GATE_RECORD=11` 相同，**所以海岸和湖畔并行开启**。
- **海岸关内解锁**：C1–C9 依次解锁，前一关通关才开下一关；已通关或已开放的关不会再锁。每关状态 passed、playable 或 locked，由 `coastStagePhases(s4Passed, r5View)` 给出。
- **章节**：C1–C6 是「海岸漫游」，C7–C9 是「灯塔夜航」。
- **奖励**：通关 C7、C8、C9 就能领「夜航印记」，不需要 9 关全通（`COAST_NIGHT_REQUIRES`）。领取用 `Journal.claim('coast')`，发放 challenge-memento，id 为 `coast-<pack>-complete`。
- **进度归属**：`challengeRegionOf(id)` 返回 'coast'。日志里的小标签显示「挑战 x/9」，旅程册里显示为「x/9」。
- **对比图示例的说明**：示例是主线 12/12、湖畔 2/6，海岸显示「可前往」，**符合规则**：两者都在主线 12 后开启，海岸不依赖湖畔进度。图下的说明文字已经补上这一点。
- **雪山**：**湖畔 6 关全通后开启**，不算主线，结局入口留在 L18。在有关卡数据之前，雪山只会显示「已知未开启」（主线 12 后，条件「湖畔通关后开启」）或「远方」（主线 12 之前）。**即使湖畔已经全通，也不会显示成可前往**。
- 旅程册里海岸行的状态：`s4Passed` 为假 → 已知未开启（主线 8 之后）或「远方」；passed=0 且 C1 playable → 新开启；passed 在 1–8 → 进行中；9 关全通 → 完成。印记是否已领，在地区页上显示。

## 3. 地区页与入口按钮（`chapter_coast_390.png`、`states_chapter.png`、`annot_chapter_390.png`）
- 面板 330×430：标题为地区名，下面是地区窗（面板宽 − 64，按 208:136 等比）、左上印章 40pt、一句描述 15pt、关数或状态 14pt、**唯一按钮**。
- 按钮统一用 WarmButton primary 240×52，距底 26pt，全游戏同宽：
  - 可前往：「前往海岸」
  - 进行中：「继续」
  - 完成：「再访海岸」
  - 未开启：不用 3D 按钮，改用扁平禁用钮（#E6D7B8，文字 #7A5A3A「尚未开启」），开启条件写在上方一行。
- 点击当帧下沉 3pt（按下态见 states_chapter 最后一张），抬手 120 ms easeOutBack(1.4) 回弹后执行。
- 海岸地区页在关数下面加一行章节提示：C1–C6 期间显示「海岸漫游」，C7 以后显示「灯塔夜航」。夜航印记可领时，按钮上方显示「夜航印记可领取」。
- 海岸描述「沿着海滩捡贝壳，一步步走向灯塔。」（取自 REPORT 引的 DESIGN 原意）；雪山描述「踩着新雪，去山口听风铃。」。文案可以再改。
- 小岛上的「继续旅程」木牌**不变**：仍然只有一个入口，点了直接去「焦点地区」的下一关。新地区不在小岛上加新按钮。

## 4. 结局印章（`ending_390.png`、`compare_ending.png`、`annot_ending_390.png`）
- 4 枚 Ø44、间距 58，改为 **6 枚 Ø40、间距 48，总宽 280pt**。320 宽屏时左右各留 20pt。两端轻轻下垂（Δy = 1.2·(i−2.5)²，最多约 7pt），排成一道弧，呼应风铃。
- 雪山没有数据时也保留它的空白章位（6 枚不变），算是对后续内容的一点预告；如果 Grok Bot 不想这样，就按 hasData 只画 5 枚，间距不变。
- 已得：彩色。未得：**空白章 α0.85**，和「远方」用同一张图。结局时不提示还差哪里，不打扰收尾情绪。
- 其他（木牌「旅程完成」、风铃、她、「回小岛」）全部不变，沿用 EndingScreen v2.1。
- 结局入口仍在 L18（d50c514c）。如果雪山 L19–24 成为主线终点，结局入口要挪到雪山最后一关，见待定项。
- 合成说明：效果图是在 ending_day 上抹掉旧印章带后重新放印章做的示意，真实渲染以引擎为准。

## 5. 新印章和地区窗（`art/`，已量化，正式文件名）
- **`reward_seal_coast.png`＝夜航印记（正式）**：结构和现有 4 枚相同（12 面木环、挂环、金沙色内环 #E2B25A，115×128）。画面是夜空渐变 #243060→#42588C、星点、低多边形月牙；夜里的灯塔有暖灯 #FFD678，两侧光束 α47%/27%，周围一圈暖光；礁岸 #3A4A6A，水面有金色倒影。
  - **这一张依赖海岸 50f5252c（夜航奖励规则）通过审批**。审批不通过就回退到 `reward_seal_coast_day.png`（白天灯塔版，同规格、已量化），只换文件，代码不用改。
- `reward_seal_snow.png`：灰蓝内环 #8FA8D8，雪峰加一颗金星。**等雪山有关卡数据后才放进游戏**。
- **空白章不用图**：用代码画，是 3 个同心圆加 3 道浅浮雕弧线：
  - 外圈 R54 #D8C4A0，下移 3pt 一圈 #C9B48E 作厚度；中圈 R44 #E6D7B8；面 R38 #EFE3C8。
  - 3 道弧 R14/22/30，扁率 0.6，200°–340°，3pt #DCCBA8；挂环 R8，线宽 4，#BFA987。
  - 参考图在 `src/reward_seal_blank_ref.png`，不进游戏。
- 进度条、红点、青色勾、虚线分隔和焦点卡底板也都用代码画（Graphics），不用图。
- `region_coast.png`、`region_snow.png`：208×136 地区小窗，128 色。
- 现有 4 张地区窗是引擎渲染图，这两张是扁平的低多边形示意，**正式资源需要场景设计部用引擎渲染**（海岸可复用小岛灯塔，雪山可用 SP_snowpass 驿站）。印章可以由我按这两张精修后直接出正式图。
- 资源由 GGbot 放进游戏，路径见 §11；游戏资源目录这次没有改。地区名用 Label 显示，不另做 `chapter_coast` 和 `chapter_snow` 图片标题，省一张图。代码、资源、文件名和注释里都不要出现 system-panels SPEC §1.4 门禁所禁的那个词；地区缺图时走现有 grayscale 加锁的逻辑，不要写替代文字。

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
| 海岸数据（**还没接**：derive、IslandPanels、入口按钮、结局印章，由 GGbot 接） | `scene/b19-coast-port` **50f5252c**（比 9fbf8822 新）：`region/RegionNodeProgress.ts` 有 `COAST_STAGE_IDS`、`COAST_STAGE_LABEL`、`COAST_STAGES=9`、`coastStagePhases()`、`challengeRegionOf()`，还没接线；`progress-journal.js` 的 `COAST_GATE_RECORD`、`COAST_STAGE_COUNT`、`COAST_NIGHT_REQUIRES` | `RegionNodeProgress.derive` 加海岸：done = `coastStagePhases(s4Passed,r5View)` 里 passed 的数量，state 按 §2.2；IslandPanels 用 `COAST_STAGES` 作分母；入口按钮走 `openChapter('coast')`，进入第一个 playable 的关；领取按钮调 `Journal.claim('coast')`，可领条件是 `COAST_NIGHT_REQUIRES` 全部 passed；结局印章已得的判断是 `claimedRegions.includes('coast')` |
| 雪山数据 | **仓库里还没有关卡数据**，只有 `product/2026-10-29/expansion/PLAN.md` §2 的 6 关表（r06-snow-01..06）；场景在 `scene/b19-snowpass` 9b54c982 | 按海岸的模式加 `SNOW_STAGE_IDS` 和 `snowStagePhases()`，门槛是湖畔 6 关全通。数据出来之前雪山 hasData=false：不进分母和分段条，行固定显示 locked 或 far |
| 旅程册 | `openJourney` :26，大卡布局 | 按 §2 重写为焦点卡加紧凑行；`IslandJourneyOverlay.ts:91` 调用处不变 |
| 地区页 | `openChapter` :54 | 按 §3：唯一按钮，四态；`extra`（tide/sky 的额外按钮）保留在描述下方 |
| 结局（结局入口仍在 L18） | `ui/EndingScreen.ts:45` 写死 4 个 id，`(i-1.5)*58`，44pt | 改为遍历 CHAPTERS：`x=(i-(n-1)/2)*48`，`y=sealsCy+1.2*(i-(n-1)/2)^2`，40pt；未得的印章用 §5 的代码画空白章。`EndingFlow.endingLayoutChecks` 加一项「印章总宽 ≤ W−40」 |
| 印章名 | `ManagedMobileBoardUI.ts:1031` 地区名映射只有 4 个；:1001 领取 icon | 加 `coast:'夜航'`（显示为「夜航印记」）、`snow:'雪山'`；icon 路径规则不变 |
| 见证清单 | `world-r2/LakeWinWitnesses.ts`（由 tools/pre-transition/gen_lake_witnesses.cjs 生成），`RegionFlowWitnesses.ts`；`test_retry_protection` 要求 catalog 里每一关都有 witness | 新增生成文件 `CoastWinWitnesses.ts`（C1–C9，从 tools/coast/test_coast_levels.cjs 的 3 个出货种子里取最短胜局）和 `SnowWinWitnesses.ts`（数据出来后再加）；label 用 C1..C9；雪山的 label 等数据出来再定。海岸并进 catalog 时同时更新 test_lakeside_entry 的计数（12+6 → 12+6+9）。见证清单不面向玩家，这里只规定数据契约 |
| 存储 | — | `qfl.ui.journeySeenDone`、`qfl.ui.seenRegions` |
| 测试建议 | — | 7 尺寸下面板不超出屏幕、行触控 ≥44；5 种状态的快照；33 分母；结局 6 印章在 320 宽下不贴边；门禁词扫描结果为 0 |

## 9. 文件
`journey_390.png`、`chapter_coast_390.png`、`ending_390.png`（全屏）· `compare_journey.png`、`compare_ending.png`（前后对比）· `annot_journey_390.png`、`annot_chapter_390.png`、`annot_ending_390.png` · `sizes_7_journey.png`、`sizes_7_chapter.png` · `states_journey.png`（5 态）、`states_chapter.png`（4 态加按下）、`seals_compare.png` · `keyframes_journey.png`、`keyframes_ending.png`、`new_regions_anim.mp4`（约 5.6 s）· `art/`（量化后的正式图：reward_seal_coast〔夜航〕、reward_seal_coast_day〔回退版〕、reward_seal_snow、region_coast、region_snow；量化前的原图在 `art/raw/`）· `quant_zoom_compare.png` · `src/`。
底图是 b17r12 的小岛真机截图和 post-island 的 ending_day，只作示意。

## 11. 包体（量化后的实际大小，`art/quant_table.json`，放大对比 `quant_zoom_compare.png`）
- 方法：`src/quantize.py`，PIL FASTOCTREE 量化，保留 alpha。印章 96 色不抖动；地区窗 128 色。机器上没有 pngquant，所以用 PIL。
- 画质：按 4 倍放大逐张对比。印章看不出差别。地区窗天空渐变有轻微色带，但 208×136 在面板里只显示 120×78pt，实际看不出来。正式的引擎渲染图换进来后，用同一个脚本重新量化。
- 参照：现有 `region_lake.png` 9.1 KB，`reward_seal_lake.png` 5.3 KB，新图都比它们小。

| 文件 | 尺寸 | 颜色数 | 量化前 KB（RGBA，optimize） | 量化后 KB | 放进 | 何时放 |
|---|---|---|---|---|---|---|
| `reward_seal_coast.png` | 115×128 | 96 | 15.9 | **3.4** | board_art/popup/ | 现在 |
| `reward_seal_coast_day.png` | 115×128 | 96 | 14.3 | **3.1** | 不放（仅在审批不通过时替换 reward_seal_coast.png） | — |
| `reward_seal_snow.png` | 115×128 | 96 | 13.3 | **2.9** | board_art/popup/ | 雪山有数据后 |
| `region_coast.png` | 208×136 | 128 | 5.8 | **1.8** | board_art/r2/ | 现在 |
| `region_snow.png` | 208×136 | 128 | 8.2 | **2.2** | board_art/r2/ | 雪山有数据后 |

| 合计 | KB |
|---|---|
| **进主包** | **0**（新图都不进主包；新 UI 只有脚本，GGbot 实现后估计 +3–5 KB 脚本） |
| **进分包 board_art，现在** | **5.2**（夜航印记 + 海岸地区窗） |
| 进分包 board_art，雪山有数据后 | +5.1（合计 10.3） |
| 改用代码画、省掉的图 | 空白章、进度条、红点、勾、虚线、焦点卡底板；也不另做 chapter_coast、chapter_snow 标题图 |

**分包建议**：
- 所有 bundle 在微信里都是 `compressionType=subpackage`（board_art、region_island、region_lakeside、region_snowpass 等，见各 `.meta`）。主包里只有脚本和启动资源，所以新图怎么放都不会进主包。
- **地区窗放 `board_art/r2/`**，和现有 4 张 region_* 放在一起。原因：
  - 旅程册在小岛上打开，要同时显示全部地区的窗；海岸和雪山的地区分包只在进入该地区时才加载，放进去的话旅程册里会缺图。
  - board_art 启动时已经加载（印章和面板都在里面），新增约 2 KB，不多加载一次分包。
- 雪山地区窗将来也放 board_art/r2，不放 `region_snowpass`，理由同上。
- 海岸目前没有自己的场景分包（REPORT：没有 region_coast bundle）。以后如果建 region_coast，放的是 3D 场景，地区窗仍然留在 board_art。
- **印章放 `board_art/popup/`**，和现有 4 枚放在一起，结局、旅程册和棋盘结算都会用到。

## 12. 进候选的时机
- **等草地（region_meadow）压缩空出的包体到位之后**再进候选：先确认那一轮压缩已经合进候选，构建门禁 P1 总包 ≤24,641,536 B 留有余量，然后再接 §8。
- 本稿的资源只增加约 5.2 KB。但海岸并进 catalog 还要带上关卡数据（约 10 KB，见 REPORT）和 GGbot 的 UI 脚本，所以一起排在草地压缩之后，不单独抢先合入。

## 10. 待定项
1. 夜航印记正式图依赖海岸 50f5252c 通过审批；不通过就回退到白天灯塔版（§5）。
2. 雪山关卡数据还没有。数据进来后分母会自动变成 33，雪山行开始正常显示状态；雪山印章和地区窗到那时再放进游戏。
3. 正式地区窗需要场景设计部用引擎渲染，替换后按 §11 的方法再量化一次。
4. 「远方」只露到下一个里程碑为止，这条规则要不要放宽，需要确认。

