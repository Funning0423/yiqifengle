# COAST02–09 机制对照（只读审计）

**日期：** 2026-11-09  
**对照基线：** 设计包 `/workspace/product/2026-11-06/coast-levels/COAST01-09-DESIGN-PACKAGE.md` + `COAST01-09-rows.json`；代码 `scene/coast01-creator-import` @ `17e478ea`（worktree `/workspace/wt-coast01-import`）；交接 `docs/handoff/coast01-creator-import.md`。  
**范围：** 判断每关用到的机制在当前引擎/关卡运行时是否已支持；**不改代码、不提交**。  
**步数说明：** 表中步数一律标为设计包 `moves_untested_draft`（未测草稿）。COAST01 现网注册为 `config.moves:20` + `legacyMoves:26`，与设计包草稿 26 不同；02–09 **尚未**在分支注册，故不以自造数字替换草稿。

## 引擎侧：已支持 vs proposed

依据 `creator-build-project/assets/scripts/r4-cloud-compat/runtime/engine.js`（regional-r05 经 `regional-session.js` 原样引入）与 `regional-r05/runtime/index.js`（海岸以 tide 别名 `rules:{shells:[]}` 跑引擎目标，无新珍珠机制）：

| 机制 | 判定 | 依据（代码事实） |
|------|------|------------------|
| `moss[]` + `goals.moss` | **已支持** | Engine 初始化 `Set(moss)`；清格 `decrement('moss')` |
| `roots[{index,layers}]` + `goals.roots` | **已支持** | Engine `Map` 分层减层；层到 0 才 `decrement('roots')` |
| `beacons[]` / beaconRoute + `goals.beacons` | **已支持** | `beaconRoute` 保留顺序；每波只点当前灯（`beaconHit` 注释与实现）；`tools/coast/test_coast01_candidate.cjs` 用路由 `[8,24,12,24,40]` 断言重复 index 不 unique、第二次 24 仅在 cursor 到达后点亮 |
| `starters` special：`row` / `column` / `bomb` / `color` | **已支持** | `ForestEngine.SPECIALS = ['row','column','bomb','color']`；开局最多 4 个 starter |
| `goals.type0`…`type5` | **已支持** | 消子 `decrement('type'+tile.type)`；海岸 kit 对 **type5 目标图** 覆写为 `board/piece_shell`（`BoardKit.COAST_TYPE5_SHELL`）；type0–4 走 coast `pieceKeys`（conch/star/coral/float/scallop） |
| `goals.lines` | **已支持** | 消掉 `row`/`column` special 时 `decrement('lines')` |
| `goals.specials` | **已支持** | 任意 special 消除时 `decrement('specials')` |
| HUD 障碍/目标图标 moss、roots、beacons、lines、specials | **已支持** | `ManagedMobileBoardUI.GOAL_ART` 已有对应 `board_art` 键；非新分包资源 |
| 退潮铃（CONCEPT 区域道具） | **proposed / 未实现** | 设计包各关均写「not in this level row」；测试断言 `ManagedTools.ts` / `rule-guide.js` **不含**「退潮铃」；现网区域道具名为 `tideAnchor`（潮汐锚）等 |
| PLAN `shells{index,layers}` 潮汐移植替 type 收集 | **proposed / 未用于本包行** | 海岸现用 `shells:[]` + `goals.typeN`；设计包行不用 shells 层数目标 |
| 灯标海葵/海玻璃亮框视觉（CONCEPT 美术） | **proposed（纯表现）** | 逻辑灯标已支持；CONCEPT 亮框/预告灯是美术与 UI，非关卡数据字段 |

**接线缺口（不是新机制，但 02–09 要可玩必须动）：**

- `coastPlayable` **仅**注册 `r06-coast-01`；`getStage('r06-coast-09')===null`（测试已锁）。
- `LevelRegion.ts` / `CoastBoardPieces.ts` 硬编码仅 `r06-coast-01`（`not-coast01` 拒入）。
- `progress-journal.js` 解锁找上一关用 `API.catalog.find(...)`，而海岸关在 `coastPlayable` **不在** `catalog` → 仅注册进 coastPlayable 而不改解锁查找时，ordinal≥2 可能永远锁死。
- `coastGuide()` 仅分支「有 beacons」或默认「贝壳 type5」文案；含 moss/roots 的关需补文案（表现/引导，非引擎）。
- `claimedRegions` 校验白名单为 tide/meadow/sky/lake，**不含** coast（区域印记领取另议）。

---

## 每关一行（COAST02–09）

| ID | 目标（设计描述） | 步数*[草稿]* | 用到的机制 | 已支持 / proposed | 若含 proposed：只用已支持机制的替代 |
|----|------------------|--------------|------------|-------------------|--------------------------------------|
| COAST02 沙滩小径 | 沿两条沙径清苔藓，拾莓果 | 29 | `moss`×10 掩码两横带；`goals.moss:10`+`type0:12`；starter `bomb@24` | **全部已支持** | 无需机制替代；落地为关卡数据注册 + 入口接线（见下节） |
| COAST03 椰影风铃 | 顺三盏灯接通风铃 | 36 | `beacons:[23,24,25]`；`goals.beacons:3`+`lines:2`+`type1:16`；starter `column@9` | **全部已支持**（含每波一灯） | 无需机制替代；海葵/海玻璃亮框属 CONCEPT 美术，可后做，逻辑不依赖 |
| COAST04 小蟹回家 | 解根须留通道 | 33 | `roots` 8 格 layers=2；`goals.roots:8`+`type5:14`；starter `row@22` | **全部已支持** | 无需机制替代 |
| COAST05 潮池星灯 | 折返灯路点四角 | 42 | beacons×4 + moss×12 + `specials:2` + `type3:12`；starter `bomb@24` | **全部已支持** | 无需机制替代；CONCEPT 亮框视觉可后做 |
| COAST06 一起看晚霞 | 根结+五灯 | 46 | beacons×5 + roots×5（含 layers 2/3）+ moss×9 + `type5:18`；starters `row@14`,`column@34` | **全部已支持** | 无需机制替代 |
| COAST07 雾中的回声 | 直线奇果接三灯 | 28 | beacons×3 + moss×7 + `type5:12`；starters `row@21`,`column@9` | **全部已支持** | 雾为场景/UI（设计包写明不挡输入），非新机制 |
| COAST08 双铃过潮 | 奇果组合解根结 | 32 | beacons×4 + roots×4 + `type4:16`；starters `row@23`,`bomb@24`（相邻可打出十字类组合） | **全部已支持** | 无需机制替代 |
| COAST09 灯塔等你 | 绕岸角再回中灯第二次 | 30 | beacons 路由含重复 index 24；roots layers=3×3；moss×9；starters `bomb@37`,`color@38`；`goals.beacons:5`+`roots:3`+`moss:9` | **引擎层已支持**（重复路由 + color starter 均有代码/单测证明）；**关卡未注册** | 若产品拒绝重复灯格：可改唯一五灯路由（测试里的对照例 `[8,24,12,25,40]`），但仍属关卡数据选择，不是新引擎；**退潮铃不用** |

字段细节以 `COAST01-09-rows.json` 为准（moss/roots/beacons/starters/goals）。

---

## proposed 机制汇总（设计包提及、本包行未强制）

| proposed | 需要改什么 | 风险 | 分包影响估计 |
|----------|------------|------|--------------|
| 退潮铃（CONCEPT 区域道具） | 新 tool kind + UI/文案 + 可能场景道具；`ManagedTools` / rule-guide / 关卡 `tool` 字段 | 与现网 `tideAnchor` 命名/语义冲突；海岸现 `tool:null` 且 legalActions 可关 tools；设计包 02–09 **行内未引用** | **未知**（未做资源清单）；逻辑包体积增量未知 |
| PLAN `shells{index,layers}` 替 type 收集 | 改海岸 `rules.shells` 非空并接入潮汐 ebb/flood；改目标与引导 | 与当前「空 shells + type5」COAST01 已通关路径冲突；需重测种子/步数 | **未知** |
| beaconRoute 海葵预告 / 海玻璃亮框（CONCEPT 美术） | 板面/场景表现层，非 `config.beacons` 字段 | 不影响通关逻辑；可能增加贴图或特效 DrawCall | **未知**（若只复用现有 beacon HUD/`r2/beacon_lighthouse` 则接近零新增；新贴图则未知） |
| 设计包「UNKNOWN」清单中的 type↔sprite 精确故事映射 | 海岸 kit 已定 type0–5→conch/star/coral/float/scallop/badge，且 type5 目标强制 shell；若叙事要「莓果=某 type」需产品确认，不是缺引擎 | 误标目标图导致玩家误解 | 通常 **无分包增量**（换 key 指向已有 sprite） |

**结论：** COAST02–09 设计行所用玩法字段均可落在 **已支持引擎机制** 上；真正挡可玩的是 **注册/入口/解锁接线** 与 **未测步数/种子**，不是新消除规则。

---

## COAST02 / COAST03：只用已支持机制时的关卡数据与布局改动清单

（Grok Bot 已同意盒子侧用现成机制并行推进；以下为**只读**列出的改动面，本审计不实施。）

### 共同（相对 COAST01 接线）

| 文件（相对 worktree） | 字段 / 改动 | 说明 |
|----------------------|-------------|------|
| `creator-build-project/assets/scripts/regional-r05/runtime/index.js` | 扩展 `coastPlayable`（或仿 lakeside 抽 `coast-levels-data.js` 再 concat） | 现仅 `COAST01` 常量；加入 `r06-coast-02`、`r06-coast-03` 的 stage 描述符 |
| 同上 `getStage` / `createSession` / `restore` | 已按 `region==='coast'` 分流 | 新关只要出现在 `coastPlayable`/`getStage` 即可走现有 `createCoast` |
| `creator-build-project/assets/scripts/regional-r05/runtime/progress-journal.js` | `isUnlocked` 里找 `prev` 的 `API.catalog.find` | 海岸不在 catalog 时须改为 `API.getStage` 或同时搜 `coastPlayable`，否则 02 在 01 通关后仍可能锁 |
| `creator-build-project/assets/scripts/world-r2/LevelRegion.ts` | `isCoastSelection` 仅 `r06-coast-01` | 放宽为 coast 区或显式含 02/03 |
| `creator-build-project/assets/scripts/ui/CoastBoardPieces.ts` | `stageId !== 'r06-coast-01'` → `not-coast01`；`boardKitRegion` 同理 | 改为 coast 前缀或白名单含 02/03，否则拒载场景 |
| `creator-build-project/assets/scripts/regional-r05/runtime/index.js` → `coastGuide` | 仅 beacons / 默认贝壳 | COAST02 需 moss+type0 文案；COAST03 已有 beacons 分支可用，可补 lines/type1 说明 |
| 测试 `tools/coast/test_coast01_candidate.cjs` 等 | 多处假定唯一 coast 关 | 并行推进时需加 02/03 用例或放宽断言（实施阶段） |

**不改引擎文件即可玩：** `r4-cloud-compat/runtime/engine.js` 对 02/03 字段已覆盖。

### COAST02 关卡数据字段（建议写入 coast stage `config`，值来自 rows.json）

| 字段 | 值（来自设计包/rows，非自造） |
|------|------------------------------|
| `id` | `r06-coast-02` |
| `region` / `ordinal` / `name` | `coast` / `2` / `沙滩小径` |
| `config.moves` | 设计草稿 **29**（`moves_untested_draft`）；是否像 COAST01 再拆 `moves`+`legacyMoves` **未定，不编** |
| `config.goals` | `{ moss: 10, type0: 12 }` |
| `config.moss` | `[7,8,9,10,11,37,38,39,40,41]` |
| `config.roots` | `[]` |
| `config.beacons` | 省略或 `null`/不设（rows 为 null） |
| `config.starters` | `[{ index: 24, special: "bomb" }]` |
| `rules` | `{}`（经 `coastAlias` 仍会变成 tide + `shells:[]`） |
| `tool` | `null` |
| `seedBank` | **未知**（设计包未给；COAST01 为 `[22,9,13]`，不可抄用冒充已校准） |
| `chapterName` / 描述 / failHint | rows：`海岸漫游`；描述「沿两条沙径清除苔藓，拾起莓果。」；设计包 hint 可作 failHint |

**布局：** 设计图 `layouts/COAST02_layout.png` 为审阅示意图，**不是** Creator 场景资源。可玩掩码即上表 `moss[]`；无需新 7×7 板尺寸（恒 7×7）。

### COAST03 关卡数据字段

| 字段 | 值（来自设计包/rows） |
|------|----------------------|
| `id` | `r06-coast-03` |
| `region` / `ordinal` / `name` | `coast` / `3` / `椰影风铃` |
| `config.moves` | 设计草稿 **36**（未测） |
| `config.goals` | `{ beacons: 3, lines: 2, type1: 16 }` |
| `config.moss` / `roots` | `[]` / `[]` |
| `config.beacons` | `[23, 24, 25]`（与 `goals.beacons:3` 等长） |
| `config.starters` | `[{ index: 9, special: "column" }]` |
| `tool` / `seedBank` | `null` / **未知** |
| 布局示意 | `layouts/COAST03_layout.png`；椰影为场景装饰非逻辑掩码（设计包原文） |

### 与 COAST01 不同的资源需求

| 项 | COAST01（已导入 @17e478ea） | COAST02 | COAST03 |
|----|------------------------------|---------|---------|
| `region_coast` 场景包（terrain/rocks/props/board GLB、palette、layout.json） | 已有；handoff 记 region_coast **463,119 / 943,718** | **复用同一分包**；关卡数据不新增 GLB | **同左** |
| 棋子图集 coast `pieceKeys` | type5 目标→`piece_shell`；棋盘槽 0–5 已导入 | 目标 **type0**→kit `board/piece_conch`（已有 sprite-frame meta） | 目标 **type1**→`board/piece_star`（已有） |
| 障碍/目标 HUD | 本关不用 moss/beacon 目标 | 需 **moss** 目标图标：`board/obstacle_moss`（在 **board_art**，非 region_coast） | 需 **beacons**+**lines**：`r2/beacon_lighthouse`、`board/special_line_h`（已有 GOAL_ART） |
| 开局 special 表现 | column | **bomb**（已有 special 图） | **column**（同 COAST01） |
| 新 Creator meta / 新贴图 | 21 个 meta 已为场景包生成 | **预期无新 region_coast 资产**（只读结论）；若产品要「莓果」专用图替换 conch，则另批资源——当前设计未要求 | 亮框 CONCEPT 美术 **非本并行必需**；不做则零新增 |
| 分包体积 | 已测 463,119 | 仅 JS 关卡行：增量相对 GLB **可忽略**；精确字节 **未知**（未构建） | 同左 |
| Mac/Creator 再导入 | COAST01 流程已文档化 | **若只加 JS 关卡数据：不必重跑 Creator 导入**；若将来加 02/03 专属场景 props 再走 handoff 可复用步骤 | 同左 |

---

## 建议里程碑分组（可玩推送）

设计包节奏：`01 teach → 02 moss → 03 beacon → 04 roots → 05 return lamps → 06 peak → 07 fall → 08 combo → 09 finale`。

| 里程碑 | 关卡 | 理由 |
|--------|------|------|
| **M1**（建议先做） | **COAST02–03** | 机制均已支持；分别引入 moss 与 beacon+lines；与 COAST01（type 收集）形成三段教学；Grok Bot 已同意盒侧并行；场景包可复用 |
| **M2** | **COAST04–05** | 04 专练 roots；05 为 beacon+moss+specials 组合（难度上台阶） |
| **M3** | **COAST06–07** | 06 综合峰值（五灯+多层根+苔）；07 收束（步数草稿更紧、直线 starter） |
| **M4** | **COAST08–09** | 08 special 组合；09 重复中灯 finale + color starter（引擎已证、关卡注册放最后以免与教学关抢接线） |

备选更粗分法：`02–04` / `05–07` / `08–09` 亦可，但会把「roots 首关」与「moss/beacon 教学」捆在同一里程碑，review 粒度较差；**更推荐上表 M1=02–03**。

每里程碑交付约定（沿用排期）：推送分支 SHA + 实际游戏镜头截图 1:1 报 Grok Bot；proposed 清单若要实施须先批；气球几何不动。

---

## 证据索引（本审计读过）

- 设计：`/workspace/product/2026-11-06/coast-levels/COAST01-09-DESIGN-PACKAGE.md`，`COAST01-09-rows.json`
- 代码：`regional-r05/runtime/index.js`（仅 COAST01）、`regional-session.js`、`r4-cloud-compat/runtime/engine.js`（moss/roots/beacons/lines/specials/SPECIALS）
- 单测：`tools/coast/test_coast01_candidate.cjs`（重复 beacon 路由；退潮铃不存在；coastPlayable 无 beacons 关）
- 交接：`docs/handoff/coast01-creator-import.md`（分包 463,119；可复用导入步骤）
- SHA：`17e478ead951cd77ef2550e998acee1c3c4e27ed`
