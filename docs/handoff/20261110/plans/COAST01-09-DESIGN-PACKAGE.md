# 星光灯塔海岸 · COAST01–09 可独立审阅设计包（2026-11-06）
**Status:** design package for review — **not** playtested balance, **not** implemented this pass, **not** Mac-accepted.
**No restaurant.** Lakeside pedestal/shell-seat branch (`655e21de`) is draft-only / no-merge; **not** touched further here.
**Coast default-ON coding** is out of scope (handled elsewhere); this package does not implement or wait on it.

## Sources (content reference only)
| Source | Role |
|--------|------|
| `wechat-game/.../coastal-content.js` `levels[9]` | Names, descriptions, hints, moves, moss/roots/beacons/starters/goals |
| `product/2026-10-29/coast-port/concept/CONCEPT.md` | Sandstone reef board, beacon art language, piece roster colors, 退潮铃 |
| `product/2026-10-29/expansion/PLAN.md` §3 | Historical moves 26/29/36/33/42/46/28/32/30; transplant note to regional-r05 / tide shells |
| `product/2026-10-29/expansion/REGIONS_9.md` | Unlock: after mainline 12, parallel lakeside; r06-coast-01..09 |
| prior `COAST-LEVELS-DRAFT.md` | Draft scaffolding expanded herein |
| shipped `board_art/board/*.png` | Layout diagram sprites only |

**Piece-type goal keys (`type0`…`type5`):** appear in `coastal-content.js` goals. Exact sprite↔type index for coast vs island is **mechanics-unknown** until confirmed against regional piece tables (not investigated in app code this pass). Shipped board sprites available for diagrams: `piece_shell`, `piece_strawberry`, `piece_blueberry`, `piece_flower`, `piece_leaf`, `piece_acorn` under `board_art/board/`.

## Mechanics: current-supported vs proposed (honest)
| Class | Items | Basis |
|-------|-------|-------|
| **Content-specified (legacy coastal row)** | `moves`, `goals` (incl. `typeN`, `moss`, `roots`, `beacons`, `lines`, `specials`), `moss[]`, `roots[{index,layers}]`, `beacons[]`, `starters[{index,special}]` with `column`/`row`/`bomb`/`color` | Present in `coastal-content.js` |
| **Design/CONCEPT (art & fantasy)** | 7×7 sandstone reef joints, tide-pool décor, sea-glass beacon frame, anemone preview lamps, 退潮铃 look | CONCEPT.md |
| **PLAN proposed transplant** | Map into regional-r05; `shells{index,layers}` reuse tide; recalibrate moves | PLAN.md §3 — **not verified shipped** |
| **UNKNOWN (do not invent)** | Whether legacy coastal rows are live in current playable build; beaconRoute one-lamp-per-wave enforcement; `typeN`→sprite map for coast; double-visit beacon on COAST09; COAST_KIT default wiring | Not investigated in app code this pass |

**Board constant:** 7×7. Index = `row*7+col` (0..48). Surface fantasy: sand + stone slabs (CONCEPT A); pieces on slab tops — **no** wooden tray (Funning/CONCEPT).

**Move budgets:** all labeled **`[untested draft]`** — values copied from legacy content / PLAN history only.

## Key level rows (summary table)
| ID | Name | Moves*[draft]* | Goals | Mask highlights | Layout |
|----|------|----------------|-------|-----------------|--------|
| COAST01 | 寄给海风 | 26 | `{'type5': 18}` | moss=0 roots=0 beacons=[] | `layouts/COAST01_layout.png` |
| COAST02 | 沙滩小径 | 29 | `{'moss': 10, 'type0': 12}` | moss=10 roots=0 beacons=[] | `layouts/COAST02_layout.png` |
| COAST03 | 椰影风铃 | 36 | `{'beacons': 3, 'lines': 2, 'type1': 16}` | moss=0 roots=0 beacons=[23, 24, 25] | `layouts/COAST03_layout.png` |
| COAST04 | 小蟹回家 | 33 | `{'roots': 8, 'type5': 14}` | moss=0 roots=8 beacons=[] | `layouts/COAST04_layout.png` |
| COAST05 | 潮池星灯 | 42 | `{'beacons': 4, 'moss': 12, 'specials': 2, 'type3': 12}` | moss=12 roots=0 beacons=[8, 12, 36, 38] | `layouts/COAST05_layout.png` |
| COAST06 | 一起看晚霞 | 46 | `{'beacons': 5, 'roots': 5, 'moss': 9, 'type5': 18}` | moss=9 roots=5 beacons=[10, 22, 24, 26, 38] | `layouts/COAST06_layout.png` |
| COAST07 | 雾中的回声 | 28 | `{'beacons': 3, 'moss': 7, 'type5': 12}` | moss=7 roots=0 beacons=[21, 24, 27] | `layouts/COAST07_layout.png` |
| COAST08 | 双铃过潮 | 32 | `{'beacons': 4, 'roots': 4, 'type4': 16}` | moss=0 roots=4 beacons=[8, 12, 36, 40] | `layouts/COAST08_layout.png` |
| COAST09 | 灯塔等你 | 30 | `{'beacons': 5, 'roots': 3, 'moss': 9}` | moss=9 roots=3 beacons=[8, 24, 12, 24, 40] | `layouts/COAST09_layout.png` |

## Per-level design

### COAST01 · r06-coast-01「寄给海风」
- **Surface / story interaction:** 干沙石板礁盘；近岸沙缘装饰. Story beat: 教学拾贝，听见海风. Note: _今天不用走很远，听见海风就很好。_
- **Board size + explicit mask:** 7×7. Full open 7×7 (all cells playable); no moss/roots/beacon mask. Near-shore sand row = scene décor only [draft]. Diagram: `layouts/COAST01_layout.png` (shipped tiles + moss/roots/beacon sprites).
- **Piece roster / goals:** Goals: type5×18 | Starters: idx10:column. Hint (content): 先找贝壳多的地方，消除它们下方也能带来新贝壳。
- **Exact objective (content description):** 收集贝壳，给今天留一声问候。
- **Move budget:** **26** `[untested draft]` (legacy coastal-content / PLAN history). White-box band suggestion only if retuning later — not a tested claim.
- **Obstacles / unlock pacing:** Chapter `海岸漫游` (ch 1). Starters teach/pressure as listed. Unlock fantasy vs prior levels: see rhythm sketch below.
- **Strategic challenge:** Teaching valley: gather shell-type goal with column starter; low pressure.
- **Fail risks:** Starve type5 spawns; over-clear without shell progress.
- **Solvability / test criteria (yet to run):** UNTESTED. Criteria to run later: (1) clear all goals in ≤26 moves on intended mask; (2) beacon order respects one-lamp-per-wave rule if beaconRoute supported; (3) root layers decrement only via legal adjacency/clear rules; (4) no soft-lock on starter placement; (5) 390×844 readability on sand/stone board.
- **Current-supported (content-specified):** Documented in coastal-content.js level row: starters specials: column, goals.type5
- **Proposed / CONCEPT / UNKNOWN:** shells{index,layers} tide-schema alias for shell collect — PLAN transplant note; content currently uses goals.type5 not shells[]; 退潮铃 regional tool — CONCEPT; not in this level row

### COAST02 · r06-coast-02「沙滩小径」
- **Surface / story interaction:** 沙径浅槽 + 石板；苔藓只在径上. Story beat: 沿沙径清苔、拾莓. Note: _小小的一步，也会留下一枚足迹。_
- **Board size + explicit mask:** 7×7. Playable 7×7; moss mask indices [7, 8, 9, 10, 11, 37, 38, 39, 40, 41] (two horizontal bands ≈ rows 1 & 5). Non-moss cells clear. Diagram: `layouts/COAST02_layout.png` (shipped tiles + moss/roots/beacon sprites).
- **Piece roster / goals:** Goals: moss×10, type0×12 | Starters: idx24:bomb. Hint (content): 在带苔藓的格子上消除；一颗星光能照亮周围九格。
- **Exact objective (content description):** 沿两条沙径清除苔藓，拾起莓果。
- **Move budget:** **29** `[untested draft]` (legacy coastal-content / PLAN history). White-box band suggestion only if retuning later — not a tested claim.
- **Obstacles / unlock pacing:** Chapter `海岸漫游` (ch 1). Starters teach/pressure as listed. Unlock fantasy vs prior levels: see rhythm sketch below.
- **Strategic challenge:** Introduce moss clearing on path bands; bomb starter teaches splash.
- **Fail risks:** Ignore moss band; burn moves on off-path cells.
- **Solvability / test criteria (yet to run):** UNTESTED. Criteria to run later: (1) clear all goals in ≤29 moves on intended mask; (2) beacon order respects one-lamp-per-wave rule if beaconRoute supported; (3) root layers decrement only via legal adjacency/clear rules; (4) no soft-lock on starter placement; (5) 390×844 readability on sand/stone board.
- **Current-supported (content-specified):** Documented in coastal-content.js level row: moss[], starters specials: bomb, goals.type0
- **Proposed / CONCEPT / UNKNOWN:** 退潮铃 regional tool — CONCEPT; not in this level row

### COAST03 · r06-coast-03「椰影风铃」
- **Surface / story interaction:** 石板；灯格海葵预告（CONCEPT）. Story beat: 椰影下三灯顺序亮. Note: _风铃不催你，它只是陪你。_
- **Board size + explicit mask:** 7×7. Playable 7×7; beacon sequence cells [23, 24, 25] (center row). Coconut shadow = scene, not logic mask. Diagram: `layouts/COAST03_layout.png` (shipped tiles + moss/roots/beacon sprites).
- **Piece roster / goals:** Goals: beacons×3, lines×2, type1×16 | Starters: idx9:column. Hint (content): 消除亮框内的果实，灯标才会前进；每波只点亮一盏。
- **Exact objective (content description):** 顺着三盏灯，在椰影间接通风铃。
- **Move budget:** **36** `[untested draft]` (legacy coastal-content / PLAN history). White-box band suggestion only if retuning later — not a tested claim.
- **Obstacles / unlock pacing:** Chapter `海岸漫游` (ch 2). Starters teach/pressure as listed. Unlock fantasy vs prior levels: see rhythm sketch below.
- **Strategic challenge:** BeaconRoute lesson: only clears inside lit frame advance one beacon.
- **Fail risks:** Clear outside beacon frame; stall lamp order.
- **Solvability / test criteria (yet to run):** UNTESTED. Criteria to run later: (1) clear all goals in ≤36 moves on intended mask; (2) beacon order respects one-lamp-per-wave rule if beaconRoute supported; (3) root layers decrement only via legal adjacency/clear rules; (4) no soft-lock on starter placement; (5) 390×844 readability on sand/stone board.
- **Current-supported (content-specified):** Documented in coastal-content.js level row: beacons[] / goals.beacons, starters specials: column, goals.lines, goals.type1
- **Proposed / CONCEPT / UNKNOWN:** beaconRoute visual (sea-glass frame / anemone preview) — CONCEPT art; wiring TBD; 退潮铃 regional tool — CONCEPT; not in this level row

### COAST04 · r06-coast-04「小蟹回家」
- **Surface / story interaction:** 潮间带湿沙色调石板. Story beat: 解根须，为小蟹留通道. Note: _回家的路，有人慢慢陪你走。_
- **Board size + explicit mask:** 7×7. Playable 7×7; root belt indices [7, 13, 14, 20, 28, 34, 35, 41] (all layers=2). Channel = clear root band. Diagram: `layouts/COAST04_layout.png` (shipped tiles + moss/roots/beacon sprites).
- **Piece roster / goals:** Goals: roots×8, type5×14 | Starters: idx22:row. Hint (content): 在根须旁边消除也有效；双层根须要分两波解开。
- **Exact objective (content description):** 解开岸边根须，为小蟹留出通道。
- **Move budget:** **33** `[untested draft]` (legacy coastal-content / PLAN history). White-box band suggestion only if retuning later — not a tested claim.
- **Obstacles / unlock pacing:** Chapter `海岸漫游` (ch 2). Starters teach/pressure as listed. Unlock fantasy vs prior levels: see rhythm sketch below.
- **Strategic challenge:** Root belt geometry — must open a corridor; double-layer roots need two waves.
- **Fail risks:** Leave root wall intact; crab path blocked (narrative fail = roots remain).
- **Solvability / test criteria (yet to run):** UNTESTED. Criteria to run later: (1) clear all goals in ≤33 moves on intended mask; (2) beacon order respects one-lamp-per-wave rule if beaconRoute supported; (3) root layers decrement only via legal adjacency/clear rules; (4) no soft-lock on starter placement; (5) 390×844 readability on sand/stone board.
- **Current-supported (content-specified):** Documented in coastal-content.js level row: roots[{index,layers}], starters specials: row, goals.type5
- **Proposed / CONCEPT / UNKNOWN:** beaconRoute visual (sea-glass frame / anemone preview) — CONCEPT art; wiring TBD; 退潮铃 regional tool — CONCEPT; not in this level row

### COAST05 · r06-coast-05「潮池星灯」
- **Surface / story interaction:** 石板嵌浅潮池（水面装饰，棋子仍在石板）. Story beat: 折返灯路点亮潮池四角. Note: _你留下的微光，比想象中亮。_
- **Board size + explicit mask:** 7×7. Playable 7×7; beacons [8, 12, 36, 38]; moss [8, 9, 10, 11, 12, 15, 19, 29, 33, 36, 37, 38]. Tide-pool recess = scene only. Diagram: `layouts/COAST05_layout.png` (shipped tiles + moss/roots/beacon sprites).
- **Piece roster / goals:** Goals: beacons×4, moss×12, specials×2, type3×12 | Starters: idx24:bomb. Hint (content): 淡色小灯预告路线；只有亮框内消除才点灯，连消能接力。
- **Exact objective (content description):** 循着折返灯路，点亮潮池四角。
- **Move budget:** **42** `[untested draft]` (legacy coastal-content / PLAN history). White-box band suggestion only if retuning later — not a tested claim.
- **Obstacles / unlock pacing:** Chapter `海岸漫游` (ch 3). Starters teach/pressure as listed. Unlock fantasy vs prior levels: see rhythm sketch below.
- **Strategic challenge:** Return-path beacons + moss; mid-chapter spike.
- **Fail risks:** Wrong beacon order / miss corner lamps; moss unfinished.
- **Solvability / test criteria (yet to run):** UNTESTED. Criteria to run later: (1) clear all goals in ≤42 moves on intended mask; (2) beacon order respects one-lamp-per-wave rule if beaconRoute supported; (3) root layers decrement only via legal adjacency/clear rules; (4) no soft-lock on starter placement; (5) 390×844 readability on sand/stone board.
- **Current-supported (content-specified):** Documented in coastal-content.js level row: moss[], beacons[] / goals.beacons, starters specials: bomb, goals.specials, goals.type3
- **Proposed / CONCEPT / UNKNOWN:** beaconRoute visual (sea-glass frame / anemone preview) — CONCEPT art; wiring TBD; 退潮铃 regional tool — CONCEPT; not in this level row

### COAST06 · r06-coast-06「一起看晚霞」
- **Surface / story interaction:** 沙石板；晚霞靠场景光照非关卡脚本. Story beat: 根结+五灯共看晚霞. Note: _晚霞来了。这一刻，我们都在。_
- **Board size + explicit mask:** 7×7. Playable 7×7; beacons [10, 22, 24, 26, 38]; moss [16, 17, 18, 23, 24, 25, 30, 31, 32]; roots with layers [(10, 2), (22, 2), (24, 3), (26, 2), (38, 2)]. Diagram: `layouts/COAST06_layout.png` (shipped tiles + moss/roots/beacon sprites).
- **Piece roster / goals:** Goals: beacons×5, roots×5, moss×9, type5×18 | Starters: idx14:row, idx34:column. Hint (content): 瞄准当前灯格拖道具，兼顾根结；大范围一波也只点亮当前一盏。
- **Exact objective (content description):** 解开根结，让五盏灯陪我们看晚霞。
- **Move budget:** **46** `[untested draft]` (legacy coastal-content / PLAN history). White-box band suggestion only if retuning later — not a tested claim.
- **Obstacles / unlock pacing:** Chapter `海岸漫游` (ch 3). Starters teach/pressure as listed. Unlock fantasy vs prior levels: see rhythm sketch below.
- **Strategic challenge:** Composite peak: 5 beacons + multi-layer roots + moss; high cognitive load.
- **Fail risks:** Split attention — finish beacons with roots left or vice versa; move bankruptcy.
- **Solvability / test criteria (yet to run):** UNTESTED. Criteria to run later: (1) clear all goals in ≤46 moves on intended mask; (2) beacon order respects one-lamp-per-wave rule if beaconRoute supported; (3) root layers decrement only via legal adjacency/clear rules; (4) no soft-lock on starter placement; (5) 390×844 readability on sand/stone board.
- **Current-supported (content-specified):** Documented in coastal-content.js level row: moss[], roots[{index,layers}], beacons[] / goals.beacons, starters specials: column,row, goals.type5
- **Proposed / CONCEPT / UNKNOWN:** beaconRoute visual (sea-glass frame / anemone preview) — CONCEPT art; wiring TBD; 退潮铃 regional tool — CONCEPT; not in this level row

### COAST07 · r06-coast-07「雾中的回声」
- **Surface / story interaction:** 石板；雾为场景/UI 不挡输入. Story beat: 直线奇果引路三灯. Note: _雾会散开，同行的灯不会催你。_
- **Board size + explicit mask:** 7×7. Playable 7×7; beacons [21, 24, 27]; moss band [21, 22, 23, 24, 25, 26, 27]. Diagram: `layouts/COAST07_layout.png` (shipped tiles + moss/roots/beacon sprites).
- **Piece roster / goals:** Goals: beacons×3, moss×7, type5×12 | Starters: idx21:row, idx9:column. Hint (content): 先轻点带横纹的奇果；同一波扫过多盏灯，也只点亮当前一盏。
- **Exact objective (content description):** 让开局的直线奇果，带你接亮雾里的三盏灯。
- **Move budget:** **28** `[untested draft]` (legacy coastal-content / PLAN history). White-box band suggestion only if retuning later — not a tested claim.
- **Obstacles / unlock pacing:** Chapter `灯塔夜航` (ch 3). Starters teach/pressure as listed. Unlock fantasy vs prior levels: see rhythm sketch below.
- **Strategic challenge:** Falling action: row/column starters guide three beacons through fog framing.
- **Fail risks:** Detonate starters off-line; mistime beacon wave.
- **Solvability / test criteria (yet to run):** UNTESTED. Criteria to run later: (1) clear all goals in ≤28 moves on intended mask; (2) beacon order respects one-lamp-per-wave rule if beaconRoute supported; (3) root layers decrement only via legal adjacency/clear rules; (4) no soft-lock on starter placement; (5) 390×844 readability on sand/stone board.
- **Current-supported (content-specified):** Documented in coastal-content.js level row: moss[], beacons[] / goals.beacons, starters specials: column,row, goals.type5
- **Proposed / CONCEPT / UNKNOWN:** beaconRoute visual (sea-glass frame / anemone preview) — CONCEPT art; wiring TBD; 退潮铃 regional tool — CONCEPT; not in this level row

### COAST08 · r06-coast-08「双铃过潮」
- **Surface / story interaction:** 潮间分区石板. Story beat: 奇果组合解四处根结. Note: _走过潮水的人，也会学会等一等风。_
- **Board size + explicit mask:** 7×7. Playable 7×7; beacons [8, 12, 36, 40]; four root clusters [(16, 2), (18, 2), (30, 2), (32, 2)]. Diagram: `layouts/COAST08_layout.png` (shipped tiles + moss/roots/beacon sprites).
- **Piece roster / goals:** Goals: beacons×4, roots×4, type4×16 | Starters: idx23:row, idx24:bomb. Hint (content): 横纹奇果与圆形奇果相邻交换，会扫过三行三列；再补亮还没走到的灯。
- **Exact objective (content description):** 交换相邻奇果，让十字风解开潮间的根结。
- **Move budget:** **32** `[untested draft]` (legacy coastal-content / PLAN history). White-box band suggestion only if retuning later — not a tested claim.
- **Obstacles / unlock pacing:** Chapter `灯塔夜航` (ch 3). Starters teach/pressure as listed. Unlock fantasy vs prior levels: see rhythm sketch below.
- **Strategic challenge:** Special combo (row+bomb starters) vs four root clusters + corner beacons.
- **Fail risks:** Fail to form special combo; roots remain at tide partitions.
- **Solvability / test criteria (yet to run):** UNTESTED. Criteria to run later: (1) clear all goals in ≤32 moves on intended mask; (2) beacon order respects one-lamp-per-wave rule if beaconRoute supported; (3) root layers decrement only via legal adjacency/clear rules; (4) no soft-lock on starter placement; (5) 390×844 readability on sand/stone board.
- **Current-supported (content-specified):** Documented in coastal-content.js level row: roots[{index,layers}], beacons[] / goals.beacons, starters specials: bomb,row, goals.type4
- **Proposed / CONCEPT / UNKNOWN:** beaconRoute visual (sea-glass frame / anemone preview) — CONCEPT art; wiring TBD; 退潮铃 regional tool — CONCEPT; not in this level row

### COAST09 · r06-coast-09「灯塔等你」
- **Surface / story interaction:** 沙石板；灯塔为场景地标（真塔在岛）. Story beat: 绕岸角再回中灯第二次，收夜航印记. Note: _灯塔亮着，夜航的足迹已经留下。_
- **Board size + explicit mask:** 7×7. Playable 7×7; beacon list [8, 24, 12, 24, 40] (index 24 appears twice = second visit); moss [8, 9, 10, 12, 24, 36, 38, 39, 40]; roots [(8, 3), (12, 3), (40, 3)]. Diagram: `layouts/COAST09_layout.png` (shipped tiles + moss/roots/beacon sprites).
- **Piece roster / goals:** Goals: beacons×5, roots×3, moss×9 | Starters: idx37:bomb, idx38:color. Hint (content): 中间那盏灯要回来点亮第二次。开局彩色奇果与圆形奇果可以组合，每波仍只前进一灯。
- **Exact objective (content description):** 绕过岸角，再回到中灯，留下一枚夜航印记。
- **Move budget:** **30** `[untested draft]` (legacy coastal-content / PLAN history). White-box band suggestion only if retuning later — not a tested claim.
- **Obstacles / unlock pacing:** Chapter `灯塔夜航` (ch 3). Starters teach/pressure as listed. Unlock fantasy vs prior levels: see rhythm sketch below.
- **Strategic challenge:** Finale: revisit center beacon twice; layered roots on corners; color starter.
- **Fail risks:** Forget second visit to center (24); leave layer-3 roots.
- **Solvability / test criteria (yet to run):** UNTESTED. Criteria to run later: (1) clear all goals in ≤30 moves on intended mask; (2) beacon order respects one-lamp-per-wave rule if beaconRoute supported; (3) root layers decrement only via legal adjacency/clear rules; (4) no soft-lock on starter placement; (5) 390×844 readability on sand/stone board.
- **Current-supported (content-specified):** Documented in coastal-content.js level row: moss[], roots[{index,layers}], beacons[] / goals.beacons, starters specials: bomb,color
- **Proposed / CONCEPT / UNKNOWN:** beaconRoute visual (sea-glass frame / anemone preview) — CONCEPT art; wiring TBD; beacon cell revisited twice (duplicate index 24) — content encodes list; runtime double-visit support UNKNOWN; 退潮铃 regional tool — CONCEPT; not in this level row

## Rhythm sketch (untested)
```
01 teach shells → 02 moss path → 03 beacon lesson → 04 roots corridor → 05 return lamps (↑) → 06 composite peak → 07 echo fall → 08 combo → 09 finale double-center
```

## Layout contact sheet
`layouts/COAST01-09_layouts_contact.png`

## Still open (mechanics unknowns checklist)
1. Is `coastal-content.js` the live data source for r06-coast-* in the current playable baseline, or only legacy?
2. `type0`…`type5` ↔ which of shell/strawberry/blueberry/flower/leaf/acorn (or CONCEPT coast shapes)?
3. beaconRoute: one lamp per clear-wave — enforced where?
4. COAST09 duplicate beacon index 24 — double visit supported?
5. PLAN `shells{index,layers}` vs content `goals.type5` / moss/roots — which schema ships?
6. 退潮铃 — available in coast levels or island-only?
7. COAST_KIT sand y≈−0.6 / slab top — scene truth vs 2D tray fallback when kit OFF.

## Out of scope this deliverable
- No Mac, no flag/code/frozen-input changes, no coast default-ON implementation.
- No restaurant.
- No further edits to `scene/lakeside-lotus-props-contact`.
