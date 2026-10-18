# r5 结算 v3-A + 红点方案 A · 实现说明（写给 Cursor）

> 定稿日期：2026-10-18。U1 已验收；用户定了结算用 **v3-A**、红点用 **方案 A**。PM 定了三条规则（§1）。
> 本目录只有美术和设计稿，**不含游戏代码改动**。代码由 Cursor 按本文实现。
> 布局数值都由 `src/spec.py` 算出（出图、7 屏表、节点表用的是同一份公式），附录 A/B 是它的原样输出（`src/tables.md`）。
> 公式和表对不上时，以 `spec.py` 为准。

## 0. 文件清单

| 路径 | 内容 |
|---|---|
| `result_390x844.jpg` / `result_375x667.jpg` | 定稿三态：成功开箱前、成功 3 星开箱后（写出奖励名）、失败 |
| `redline_390x844.jpg` / `redline_375x667.jpg` | 红线标注：安全区线、面板到安全区的距离、按钮到面板内沿 16、面板宽、3D 盖顶线；第 3 格是「下一关」按下态 |
| `reddot_A_390x844.jpg` / `reddot_A_375x667.jpg` | 红点 A 的 4 步 |
| `result_night_390x844.jpg` | 夜间：日间对照、夜间成功、夜间失败、夜间岛上红点 |
| `result_7screens.jpg` | 7 种竖屏都取最高的状态（成功开箱后）加红线 |
| `frames/*.jpg` | 单帧原尺寸（2×），方便逐像素比对 |
| `assets/reddot.png` | **唯一新增切图**：红点 48×48，Blender 渲染、pngquant 压缩，2.4 KB |
| `assets/kit_preview.png` | 切图总览：复用切图标了 9/3-slice 线，另有按钮按下态、红点日/夜 |
| `src/spec.py` · `src/tables.md` · `src/screens.json` · `src/sizes_final.json` | 布局公式、表、数据 |
| `src/render_final.py` · `src/kit_preview.py` · `src/gen_tables.py` | 出图脚本 |
| `src/build_reddot.py` · `src/render_chest_rt.py` · `raw/` | Blender 源：红点，以及出图用的 3D 宝箱 RT（`raw/` 只给出图用，**不进游戏**） |

## 1. PM 三条规则怎么落地

1. **开箱后写出奖励名**：每个奖励徽章下面一行 16 pt 粗体 brown。格式见 §5。
2. **底部按钮离面板内沿 16 pt**：面板木边 E=23，所以按钮（含 6 pt 投影）离面板外沿 39，左右和底边都是这个值（代码里已有 `ACTION_PAD = PANEL_EDGE_PT + ACTION_INNER_PAD = 39`，保持不变）。
   按钮不能压进安全区，所以面板外沿离安全区还要 ≥ 16 pt：
   - 顶边：离 `T = max(safe.top, 胶囊下沿)` ≥ 16。
   - 底边：离 `H − safe.bottom` ≥ 16。
   - 矮屏的处理见 §3.3：按 N → C → M → X 降档，再不行就用现有分页兜底，最后用「空间不足」提示。**16 / 16 这两条在任何档位都不缩。**
3. **结算页宽度跟现有弹窗一致**：`pw = min(round(PANEL_WIDTH × popupScale(W,H)), W − safe.left − safe.right − 24)`，其中 `PANEL_WIDTH = 680`，`popupScale = max(.3, min(W/750, H/1300, .62))`（PopupKit.ts:10/16）。每种竖屏的值见 §3.4。

## 2. 坐标约定和常量

- 单位：逻辑 pt，也就是 `configureResultLayout` 现在用的单位（结算页内容是按 pt 重排的，面板框 9-slice 已缩放到 23 pt 木边）。
- 文档里的 y **从面板上沿向下**量，x 从面板中心量。换成 Cocos 节点位置：`node.position = (x, h/2 − y)`，h 是面板当前高度，body 原点在中心、y 向上。
- 所有节点锚点都是 **(0.5, 0.5)**，坐标是节点中心。例外：奖励名 Label 是居中对齐的单行，宽度见表。

| 常量 | 值 | 来源 / 说明 |
|---|---|---|
| E 面板木边 | 23 | `PANEL_INSET 212 → PANEL_EDGE_PT 23`（BoardPanels.ts:173） |
| PAD | 16 | PM 规则 2 |
| C = E + PAD | 39 | 内容区到面板外沿（= `ACTION_PAD`） |
| MARGIN | 16 | 面板外沿到安全区 |
| SHADOW | 6 | `ACTION_SHADOW` |
| BTN_GAP | 16 | `ACTION_GAP` |
| NAME_LINE | 22 | 16 pt 文字行高 |
| 宝箱 | 闭合宝箱宽 cw，高 `cw·147/180`；RT 方框边 `F = cw/0.60`；箱心在框心下 `0.028F`；开盖后盖顶在箱心上 `0.47F` | `CHEST_FRAME` / `LID_REACH`（BoardPanels.ts:328） |
| `k = cw/180` | 宝箱相关偏移按它缩放（`CHEST_DX 8`、光晕半径等） | BoardPanels.ts:331–337 |

## 3. 版式和 7 屏适配

### 3.1 档位表（逐档变小，只在放不下时才降档）

| 档 | 上留白 top | 星（中/边，高） | 星行 | g1 | 分数行 | g2 | 宝箱宽 cw | 徽章 | g3 | 按钮高 | 排法 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| N 常规 | 64 | 64 / 48 | 64 | 16 | 40 | 24 | 168 | 64 | 24 | 56 | 奖励在宝箱上方横排 |
| C 紧凑 | 56 | 56 / 44 | 56 | 8 | 40 | 16 | 128 | 56 | 16 | 52 | 同上 |
| M 矮屏 | 56 | 48 / 40 | 48 | 8 | 40 | 8 | 104 | 48 | 16 | 52 | 奖励放宝箱右边竖排（2 件时徽章 40） |
| X 极矮 | 56 | 32 / 24 | 0 | — | 40 | 8 | 104 | 48 | 16 | 52 | 同 M，另把星星和分数并成一行 |

- 星宽 = 星高 × 184/170。边星离中星：`off = 中星宽/2 + 8 + 边星宽/2`（X 档的间距是 4），边星比中星低 6（X 档低 4）。
- 失败页和未保存页没有宝箱行，高度另算（§3.2）。

### 3.2 高度公式

```
星块   = starRow + g1 + score               （X 档：= score）
头     = top + 星块 + g2
尾     = g3 + btnH + SHADOW + C
宝箱行（闭合）RHc = ceil8(cw·147/180)
宝箱行（打开）RHo =
   N/C： ceil8(徽章 + 8 + 22 + 8 + 0.47F + 箱高/2)
   M/X： max(ceil8(0.47F + 箱高/2), ceil8(2·(40+4+22) + 8))     ← 右列总按 2 件留高；开箱前不知道箱里有几件
h_win 闭合 = 头 + RHc + 尾
h_win 打开 = 头 + RHo + 尾
h_lose     = top + starRow + 16 + 24(文案) + 16 + 40(目标) + 24 + btnH + SHADOW + C    （X 档不画星：去掉 starRow+16）
h_unsaved / h_readonly = top + 星块 + 16 + 24(提示行) + 24 + btnH + SHADOW + C
```

各档高度：N 477 / 637 / 349 / 349；C 401 / 537 / 329 / 321；M 361 / 417 / 321 / 313；X 305 / 361 / 257 / 257。依次是 win 闭合、win 打开、lose、unsaved/readonly。

### 3.3 选档和定位

```
T = max(safe.top, capsule.bottom)    B = safe.bottom
A = H − T − B − 2·16                 （面板能用的高度）
档位 = N、C、M、X 中第一个满足 h_win打开 ≤ A 的
       都不满足 → 'pages'：沿用现在 configureResultLayout 的分页 / 「空间不足」兜底（不改）
面板 x 中心 = safe.left + (W − safe.left − safe.right)/2
win：  cy打开 = clamp((T+16 + H−B−16)/2, T+16 + h打开/2, H−B−16 − h打开/2)
       下沿 = cy打开 + h打开/2         ← 两种状态都用这条下沿
       上沿 = 下沿 − h当前               开箱时只有上半部分往上长，按钮和宝箱不动
lose / unsaved / readonly：在 [T+16, H−B−16] 里垂直居中
```

- 宝箱在行里底对齐（箱底 = 行底），所以开箱时宝箱不动。在 M/X 档，开箱时宝箱向左滑 `(16+72)/2 = 44`，给右列让位。
- 降档时 16 / 16 / 39 这几个边距都不变，变小的只有星、宝箱、留白。

### 3.4 7 种竖屏的值

完整表在附录 A。摘要：

| 屏幕 | popupScale | 面板宽 pw | 内容宽 ci | 档位 | 开箱后面板（上沿 → 下沿） | 下沿离安全底 |
|---|---|---|---|---|---|---|
| 390×844 | .52 | **354** | 276 | N | 127.5 → 764.5 | 45.5 |
| 414×896 | .552 | **375** | 297 | N | 156.5 → 793.5 | 68.5 |
| 360×780 | .48 | **326** | 248 | N | 91.5 → 728.5 | 17.5 |
| 375×667 | .50 | **340** | 262 | C | 77 → 614 | 19 |
| 390×520 | .40 | **272** | 194 | X | 104 → 465 | 21 |
| 320×568 | .4267 | **290** | 212 | M | 86.5 → 503.5 | 30.5 |
| 768×1024 | .62 | **422** | 344 | N | 218 → 855 | 135 |

安全区数据和 U1 一样，取自 `docs/r5/ui/result/src/layouts_7screens.json`：有真机行的用真机行，没有的用无 wx 兜底。

## 4. 节点树（ResultPanel，win）

```
ResultPanel (PopupStack 弹窗, 宽 pw, 高 h)
├─ Shade                     全屏遮罩 (16,28,34) α.35（PopupKit 现有）
└─ body
   ├─ PanelFrame             popup/panel_frame_9s, inset 212 → 木边 23；宽 pw × 高 h
   ├─ TitlePlank             popup/title_plank_3s, 3-slice 左右 252；宽 max(标题宽+64, 96) × 48；中心 y=24（骑在上沿）
   │  └─ Title               popup/title_4「过关啦」/ title_5「差一点点」/ r2/title_unsaved / r2/title_review；高 24，宽按图比例；y=23
   ├─ ResultStars
   │  ├─ StarGlow            径向光 FFE28C α.42，直径 2.3×中星高（只在 win 时有）
   │  └─ Star-0 / Star-1 / Star-2   popup/star_full 或 popup/star_empty（暗星：setBase 235, α191 = .75）
   ├─ ResultScore            「630」32 bold brown +「 分」16 bold brown2（基线下移 5）
   ├─ ResultHostError        ★新增（§9）：存档出错提示行，默认不显示
   ├─ ResultChestRow (宽 ci, 高 RHc/RHo)
   │  ├─ ResultChestRays     popup/fx_rays，开箱后 α.5，20 s 转一圈；边 min(300k, ci)；中心 (ccx, ccy−48k)
   │  ├─ ResultChestHalo     闭合：r 74k, FFDE8C α.47，中心 (ccx, ccy+4k)；打开：r 78k, FFD678 α.59，中心 (ccx, ccy−26k)
   │  ├─ ResultChestFloor    接触阴影 cw × cw·60/220，中心 (ccx+.06cw, 箱底−.02cw)
   │  ├─ ResultChest3D       RT 方框 F×F，中心 (ccx+8k, ccy−.028F)；描边 1.5 pt #4A2810（现有 v2.2）
   │  ├─ ResultChestArt      2D 兜底 popup/chest_closed / chest_open（3D 失败时才显示）
   │  ├─ ResultChestTap      点击区 min(ci, cw+48) × max(44, 箱高+32)，只在闭合态
   │  ├─ ResultFloat-i       奖励徽章（开箱后）：奶油圆盘 FFF8E4/FAECCC 底边 C4A06C（夜 A0805C），后面有光 r40 α.43
   │  │   └─ Icon            道具图标 / 印记 / 装扮
   │  └─ ResultRewardName-i  ★新增：奖励名 16 bold brown，单行
   └─ ResultActions
      ├─ Button-下一关 / 再试一次 / 重试保存     primary，popup/btn_primary_3s
      └─ Button-回小岛 / 返回海岛               secondary，popup/btn_secondary_3s
```

在 N/C 档，徽章和名字横排在宝箱行的顶部：

```
colW = min(ci/n, 96)
bx_i = (i − (n−1)/2)·colW
徽章中心 y = 行顶 + 徽章/2
名字中心 y = 行顶 + 徽章 + 8 + 11
名字宽 = colW − 4
```

在 M/X 档，右边一列：

```
group = cw + 16 + 72
ccx = −group/2 + cw/2
列 x = group/2 − 36
块高 = n·(b+4+22) + (n−1)·8，在行里垂直居中
名字宽 = 72
```

两个按钮：

```
bw = (ci − 16)/2
x = ±(bw/2 + 8)
y = h − 39 − 6 − btnH/2
```

单按钮（只读页）宽 `min(240, ci)`，居中。

**附录 B 有 390×844 和 375×667 每个状态下每个节点的精确坐标表**，另有 320×568（M）和 390×520（X）的开箱后。

## 5. 字体、颜色、文案

字体是系统字体（makeLabel 现有）。颜色是 NightTint 的 TEXT_DAY / TEXT_NIGHT 角色：

| 元素 | 字号 | 粗细 | 角色 | 日 | 夜 |
|---|---|---|---|---|---|
| 分数数字 | 32 | bold | brown | 99,63,33 | 30,19,8 |
| 「分」 | 16 | bold | brown2 | 118,86,55 | 34,23,11 |
| 奖励名 | 16 | bold | brown | 同上 | 同上 |
| 失败文案 | 16 | regular | brown | 同上 | 同上 |
| 目标「×3」 | 16 | bold | brown | | |
| 按钮字 primary | 16 | bold | white | 251,248,236 | 232,226,212 |
| 按钮字 secondary | 16 | bold | brown | | |
| 存档错误行 | 16 | regular | brown，「!」图标 E8892B | | |
| 未保存提示 | 16 | regular | brown | | |
| 只读提示 | 16 | regular | brown2 | | |

夜间乘色：木件、面板、按钮 ×K_UI；星、宝箱、光芒、红点 ×K_HALF；文字不乘色，直接换夜间色。

**文案（全部）**

- 标题：成功「过关啦」；失败「差一点点」；未保存用 r2/title_unsaved；只读用 r2/title_review。都用标题字图，不用 Label。
- 失败文案：**「还差一点点，换个顺序再试试吧」**（一行；ci 不够时 Label 自动缩到 14，不换行）。
- 目标行：`图标 ×剩余数`，最多 3 组，组距 16，整组居中。
- 按钮：win「下一关」「回小岛」；lose「再试一次」「回小岛」；unsaved「重试保存」「返回海岛」；readonly 只有「返回海岛」。
  没有下一关（`m.next` 为 null）：只显示「回小岛」单按钮（宽 min(240, ci)）。
  `nextUnavailable`（如「草原待就绪」）：主按钮保留，但置灰（opacity 150、不响应），文案换成 nextUnavailable。
- 未保存提示：「成绩还没存进旅程册」；只读提示：「记录暂时不能写入，这局只看不存」。
- **奖励名格式**：
  - 道具：`TOOL_NAMES[kind]`，数量 ≥ 2 时写 `名字 ×n`（中间一个半角空格，× 是 U+00D7）。例：「星光 ×2」「潮汐网」「风语铃」。
  - 装扮：「装扮」或「装扮 ×n」。
  - 地区印记：「潮汐印记」「草甸印记」「天空城印记」「湖畔印记」。
  - 一件都算不出来时：「一份海风的礼物」，图标 popup/star_full。
  - 最多显示 3 件。名字宽度超出列宽时先缩到 14 pt；还放不下，就把第 3 件以后合并成「+k」徽章（不写名字）。
  - 旧的 CountBadge 角标不再画，数量只写在名字里。
- 结算页**不写解锁文字**。解锁信息改由红点 A 承担（§8）。

## 6. 状态和转场

| 状态 | 条件（resultModel） | 显示 |
|---|---|---|
| win · ready | kind=win，有宝箱，`chest.state='ready'` | 闭合宝箱：呼吸光 + 每 2.4 s 跳一下（静止 3 s 后开始）；点击区有效；高 h闭合 |
| win · claiming | 点了宝箱，等 host 写入 | 播 chest_open；面板上半部分往上长；奖励等数据回来再升起（§7.2） |
| win · claimed | `chest.state='claimed'` | 打开态，徽章和名字常驻，徽章 ±3 浮动；高 h打开 |
| win · locked | 宝箱 earned 但 `h.chest.visible` 为 false | 和 ready 一样，但没有呼吸光、点击区无效 |
| win · 无宝箱 | 地区关只有印记，或没有 rewards | 宝箱行换成印记按 ready/claimed 走同样流程；完全没奖励时宝箱行高 0（g2 和 g3 合成 g3） |
| win · 重进已开过 | 进页面时就是 claimed | 直接显示打开态，不播动画 |
| lose · 可重玩 | kind=lose，`m.replay` 有值 | 暗星 + 文案 + 目标；「再试一次」「回小岛」 |
| lose · 不可重玩 | `m.replay` 为 null | 只有「回小岛」单按钮 |
| unsaved | kind=unsaved | 3 星 + 分数 + 未保存提示；「重试保存」「返回海岛」 |
| readonly | kind=readonly | 同上，图标换成锁，只有「返回海岛」 |
| 有存档错误 | `m.hostError` 非空 | 在分数下面插入 ResultHostError（§9）；面板高度 + 行高 + 8 |
| pages | 7 档都放不下 | 现有分页 / 空间不足兜底 |

- 打开、关闭面板：用 PopupKit 现有的 OPEN_S 0.22（淡入 + 0.92→1 cubicOut）和 CLOSE_S 0.15。
- 闭合态 → 打开态：面板下沿固定，上沿上移 `h打开 − h闭合`。标题牌、星、分数一起上移，时长 0.30 s cubicOut（沿用 `scoreEaseAt` 的写法，把 SCORE_EASE_S 换成 0.30）。

## 7. 动画参数

### 7.1 星星（替换 `dropStars`，BoardPanels.ts:710）

| 项 | 值 |
|---|---|
| 亮星 i 的开始时间（从面板打开起） | 0.30 / 0.45 / 0.60 s |
| 缩放 | 0 → 1.2 → 1，0.30 s，backOut（overshoot 1.7）；opacity 0→255 在前 0.10 s |
| 暗星 | 不动画，α .75 静置 |
| StarGlow | 第一颗亮星开始时淡入，0.30 s quadOut |
| 分数（可选） | 0 → 分数，0.50 s quadOut，从 0.30 s 开始 |
| 减少动态（`reducedMotion()`） | 全部直接显示 |

### 7.2 开箱（点 ResultChestTap 时 t=0）

| t（s） | 事件 |
|---|---|
| 0 | `chest_open` 片段开始，0.5 s：盖子 0 → −126°（0.30 s）→ −114°（0.40 s）→ −118°（0.50 s）（ResultChest3D 现有） |
| 0 → 0.30 | 面板上半部分上移，cubicOut；M/X 档宝箱同时左滑 44 |
| 0.20 → 0.45 | 光芒淡入到 α.5，光晕切到打开态（r 74k→78k，dy +4k→−26k），quadOut |
| 0.30 + k·0.09 | 第 k 个徽章从箱口（ccx, ccy−.25F）升到槽位，0.42 s backOut(1.4)，scale .6→1 |
| 0.72 + k·0.09 | 第 k 个名字淡入，0.20 s quadOut，y 往上 4 → 0（在徽章落位那一刻开始） |
| 之后 | 徽章 ±3 浮动（3·sin，现有 floats），光芒 20 s/圈 |
| 减少动态 | 直接切到打开态，名字直接显示；chest_open 也跳到最后一帧 |

如果点了之后 host 的数据要晚到：动画照常播到 0.30 s，徽章和名字等 `openedItems` 有值后再按上表 0.30 s 以后的部分播。超过 3 s（`CHEST_HANDOFF_MS`）还没到，就显示兜底「一份海风的礼物」。

### 7.3 按钮按下（PopupKit `pressable` / `artButton`）

| 项 | 值 |
|---|---|
| 按下 | Face 缩到 0.96，0.06 s quadOut；**同时**保留现有的下沉 3 和 tint 240 |
| 松开 / 移出 | 回到 1，0.12 s backOut(2.0) |
| 减少动态 | 不缩放，只下沉和变暗 |
| 适用 | 结算页的两个按钮（给 `artButton` 加一个 `pressScale` 选项，默认 1 = 现状，结算页传 0.96），其他弹窗不变 |

### 7.4 红点出现和消失

| 项 | 值 |
|---|---|
| 出现 | dock 可见后延迟 0.4 s；scale 0→1.15（0.14 s quadOut）→1（0.10 s quadInOut）；opacity 0→255 在前 0.08 s |
| 消失 | 0.12 s quadIn，scale →0.6、opacity →0，结束后 `active=false` |
| 减少动态 | 只做 opacity，时长相同 |
| 夜间 | sprite tint 'half'（K_HALF） |
| 不做呼吸或闪烁 | 静止 |

## 8. 红点方案 A · 数据逻辑

**原则**：所有解锁都汇到旅程册。岛上只在旅程册道具上亮一个点；进了册子以后，点亮在新开放的章节牌上。结算页不写解锁文字。

```
open  = { 'chapter:'+c.id | c ∈ CHAPTERS(tide, meadow, sky, lake),
          gate = islandGates().r5.find(region===c.id),
          gate ? (gate.ok || gate.reason !== 'stage-locked') : !chapterSummary(...).locked }
seen  = localStorage['qfl.ui.seenUnlocks'] = JSON {v:1, book:string[], chapter:string[]}
岛上红点   = (open − seen.book) 非空
章节牌红点 = open − seen.chapter
```

- 打开旅程册（`IslandJourneyOverlay.open('journal')`）：`book ∪= open`，岛上的点立刻灭（dock 隐藏后再写；之后再显示 dock 时就不会出现了）。
- 进章节页（`IslandJourneyOverlay.chapter(region)`）：`chapter ∪= {'chapter:'+region}`，同时也并进 book。册子里那张牌的点播消失动画（§7.4）。openJourney 还在下面，**不用重画整个册子**，只隐藏这个节点。
- **老玩家升级迁移**：key 不存在时，把当前的 open 同时写进 book 和 chapter（老玩家不会冒一堆点）。必须等 `islandGates()` 第一次返回有效 status 后才写；拿不到 status 时不写，也不显示点。
- 什么时候重算：dock 从隐藏变成显示（`sync()` 里 `!this.page && !this.dock.active` 那一刻）、关闭册子的时候；最多 1 s 算一次。
- 读写只放在 UiPrefs（ui/UiPrefs.ts，和 `qfl.ui.seenTools` 同一个风格；`get`/`set` 都 try/catch）。不进旅程存档。
- 新增的函数（UiPrefs.ts）：
  - `SEEN_UNLOCKS_KEY = 'qfl.ui.seenUnlocks'`
  - `seenUnlocks(): {book: string[], chapter: string[]} | null`（null 表示没有 key）
  - `markUnlocksSeen(scope: 'book' | 'chapter', ids: string[])`
  - `initSeenUnlocks(open: string[])`（迁移用）

**节点和位置**

- 岛上红点 `IslandJournalDot`：挂在 `this.dock` 下面（dock 隐藏时它也跟着隐藏），sprite `popup/reddot`，**直径 12 pt**。
  - prop 模式：中心 = `(slot.prop.x + 0.374·slot.prop.height − 2, slot.prop.bottom + slot.prop.height − 6)`（Cocos y 向上，slot 取自 `propButtonLayout()` 里 role 为 journal 的那个）。这是书的右上角，在 390×844 上约等于屏幕 (215, 723)。
  - 非 prop 模式（平面按钮）：按钮中心 + (26, 26)。
  - 在 `layoutProps()` 和非 prop 的 `sync()` 布局里一起更新位置。
- 章节牌红点 `ChapterDot-<id>`：在 openJourney 卡片里。openJourney 坐标是 750 设计 px，弹窗会再乘 popupScale。中心 = `(tx + 标题宽 + 18, cy − 54)`，**直径 20 设计 px**（390 屏 ≈ 10.4 pt）。
  - 锁住的章节不画。
  - openJourney 加一个可选参数 `dots?: Set<string>`，并在 panel 上存 `chapterDots: Record<id, Node>`，供 chapter() 隐藏用。
- 红点切图：`assets/reddot.png`，48×48，白色奶油圈 #f8f2e2 宽 2 pt（12 pt 尺寸时），草莓红 #ce342e 珠子，左上高光。

## 9. Bug：「存档出错提示行被删」（由 Cursor 修，这里只描述）

**现象**

在结算页点「下一关 / 回小岛 / 进入地区」时，host 可能失败。例如草原场景加载失败、`completion-unsaved`、`preserved-storage-error`。失败后结算页上**什么都不提示**，玩家看到的是按钮没反应。

**来源（已在代码里核对过）**

1. `creator-build-project/assets/scripts/WorldIntegrationBoot.ts:548` `invoke()`：把失败原因映射成中文，例如：
   - `'meadow-scene-load-failed'` → 「草原暂时加载失败，成绩与奖励已保留，请重试」
   - `'completion-unsaved'` → 「请先保存当前成绩」
   - `'preserved-storage-error'` → 「记录暂时无法安全读取，请保留并稍后重试」

   然后在 finally 里调 `this.board()?.showHostResultError(this.error)`。
2. `ManagedMobileBoardUI.ts:715` `showHostResultError()`：写 `this.hostResultError`（字段声明在 :53），然后重画结算页。
3. `ManagedMobileBoardUI.ts:912` `resultModel()`：`unlockHint: this.hostResultError || (解锁文案…)`。错误文案和解锁文案共用一个字段。`:921` 的 paint key 包含 `m.unlockHint`，所以会重画。
4. `ui/BoardPanels.ts:51`：`ResultModel.unlockHint` 只剩声明，没人渲染了。commit **d6a0019f**（「Result screen SPEC v2.2 … text cut to 过关啦 / score / 下一关 / 回小岛」）删掉了渲染：
   - 旧 BoardPanels.ts:347 `if (m.kind === 'win' && m.unlockHint && !anyReady()) lines(m.unlockHint, 16);`
   - 旧 :612 `labelRows('ResultUnlockHint', m.unlockHint, 16, 'teal')`

   SPEC v2.2 原本只是要删「解锁文字」，却把同一字段里的存档错误一起删了。
   另外，旧代码也只在 `kind==='win' && !anyReady()` 时才显示，所以即使在 d6a0019 之前，失败页和宝箱未开时也看不到错误。
5. `hostResultError` 从来没被清空。一旦出过错，之后的每一局结算都会带着它（只是现在不显示而已）。

**修复建议**

1. `ResultModel`（BoardPanels.ts:48）加一个独立字段 `hostError?: string`。`resultModel()` 写成 `hostError: this.hostResultError || undefined`。
   `unlockHint` 只保留解锁文案（继续计算，`test_region_flow_ui.cjs:12` 还在断言它；但它**不渲染**，v3-A 不写解锁文字）。
2. 在 paint key（:921）里加上 `m.hostError`。
3. 结算页加专用的一行 `ResultHostError`，所有 kind 都显示：
   - 位置在分数下面、宝箱行上面（失败页在文案下面）。
   - 左边一个 Ø18 的橙色「!」圆标（E8892B 底、白字），右边是 16 pt regular brown 的文字，左对齐，最多 2 行，行高 22，宽 ci − 26。
   - 面板高度加 `行数·22 + 8`。降档时先算上这一行。
   - 出现时 opacity 0→1，0.2 s。
4. 清空：`hostResultError = ''` 的时机有三个：新一局开始（`attemptId` 变化）、`paintResult` 的 key 里 stageId/attemptId 变化、下一次 `invoke()` 成功（`r.ok`）。
5. 要更新的测试：
   - `tools/board-ui/test_user_priority_defects.cjs:21`：它用 unlockHint 传草原错误，改成 `hostError`，并断言 `ResultHostError` 节点文字。
   - `test_result_screen_style.cjs:13`：文字白名单加上 ResultHostError 和奖励名。
   - `test_result_chest_handoff.cjs:15` 和 `test_region_flow_failure.cjs`：检查对 unlockHint 的依赖。

## 10. 要改的文件和函数（已在代码里核对过）

| 文件 | 位置 | 改什么 |
|---|---|---|
| `assets/scripts/ui/BoardPanels.ts` | `interface ResultModel` :48 | 加 `openedItems?: {icon, iconKind, tool?, label}[]` 和 `hostError?: string` |
| 同上 | `openResult` :63 | 去掉 CountBadge；把 hostError 行加进 groups |
| 同上 | `configureResultLayout` :163 | 按 §3 的档位、高度公式重写尺寸常量（:331–348），面板下沿锚定在打开态；奖励名行；ResultHostError；M/X 右列 |
| 同上 | `stars` :699 / `dropStars` :710 | 星尺寸按档位；动画换成 §7.1 |
| 同上 | `rewardSlot` :691 | 结算页奖励名的格式改成 §5（这个函数是非结算的 reward 弹窗在用，不要改坏它） |
| 同上 | 开箱流程（`chestRig` :265 起，`CHEST_HANDOFF_MS`/`SCORE_EASE_S` :675） | §7.2 时间轴；面板上沿上移 0.30 s |
| `assets/scripts/ui/PopupKit.ts` | `pressable` :112，`artButton` :134 | 加 `pressScale` 选项（§7.3） |
| `assets/scripts/ManagedMobileBoardUI.ts` | :53 字段，:715 `showHostResultError` | 清空时机（§9） |
| 同上 | :742–743 | 先 `watchClaims(s)` 再 `paintResult(s)`，让刚开箱的物品进 model |
| 同上 | `resultModel` :901–918 | 写 `openedItems`（来自 watchClaims 的差值）和 `hostError` |
| 同上 | `paintResult` :920–921 | key 加上 `m.hostError` 和 `openedItems` 的 label |
| 同上 | `watchClaims` :927 | 把差值计算抽成 `claimDelta(before, now)`；结算页上把结果存到 `this.resultOpened`（按 stageId+attemptId 分）而不是直接 return；名字格式按 §5（×1 不写） |
| `assets/scripts/world-r2/IslandJourneyOverlay.ts` | constructor :23 | 建 `IslandJournalDot` 节点（挂在 dock 下） |
| 同上 | `sync` :~35，`layoutProps` :59，`setPropMode` :53 | 红点位置；dock 恢复显示时重算 |
| 同上 | `open` :76，`paint` :80/87 | 打开册子时标 book 已看；把 dots 传给 openJourney |
| 同上 | `chapter` :90 | 标 chapter 已看；隐藏这张牌的点 |
| `assets/scripts/ui/IslandPanels.ts` | `openJourney` :26 | 加 `dots` 参数，画 `ChapterDot-<id>` |
| `assets/scripts/ui/UiPrefs.ts` | 新函数 | §8 |
| `tools/board_art_sync.py` | `POPUP` 列表 :30 | 加 `'reddot'` |
| 测试 | `tools/board-ui/test_result_screen_style.cjs`、`test_result_safe_area.cjs`、`test_result_chest_handoff.cjs`、`test_user_priority_defects.cjs`、`test_region_flow_ui.cjs`、`tools/test_result_chest_3d.cjs` | 更新尺寸、文字白名单和红点；新增红点数据测试（迁移、book/chapter、锁住的章节） |

## 11. 切图

**新增（只有一张）**

| 文件 | 尺寸 | 9-slice | 放到 |
|---|---|---|---|
| `final/assets/reddot.png` | 48×48，2,391 B | 不切（圆点整体缩放） | ① `art-src/board-ui/c-popups/slices/reddot.png` ② `tools/board_art_sync.py` 的 POPUP 加 `'reddot'` ③ 运行同步脚本，得到 `creator-build-project/assets/bundles/board_art/popup/reddot.png` 和 meta（uuid5） |

制作：`src/build_reddot.py`，Blender 一期管线。用 c-popups 的 palette_helpers，focus 灯组（key 3.5 / top 0.8 / rim 1.1 / sky 0.22），正交顶视，渲 192²，裁边后缩到 48²，再 `pngquant --quality 70-92 --speed 1 --strip`。

**复用（路径都在 `creator-build-project/assets/bundles/board_art/`）**

| 用途 | 路径 | 原尺寸 | 切法 |
|---|---|---|---|
| 结算面板 | `popup/panel_frame_9s.png` | 624×624 | 9-slice 276（结算页覆写 212 → 23 pt） |
| 标题木牌 | `popup/title_plank_3s.png` | 576×315 | 3-slice 左右 252 |
| 主按钮（常态/按下） | `popup/btn_primary_3s.png` | 486×312 | 3-slice 左右 207，ART_PX 3；按下态用代码变换，不出新图 |
| 次按钮（常态/按下） | `popup/btn_secondary_3s.png` | 486×312 | 同上 |
| 亮星 / 暗星 | `popup/star_full.png` / `popup/star_empty.png` | 184×170 / 190×170 | 整图 |
| 标题字 | `popup/title_4.png`「过关啦」143×49，`popup/title_5.png`「差一点点」186×50，`r2/title_unsaved.png`，`r2/title_review.png` | | 整图 |
| 光芒 | `popup/fx_rays.png` | 310×310 | 整图 |
| 宝箱 3D | `chest/result_chest.glb`（ResultChest3D） | | |
| 宝箱 2D 兜底 | `popup/chest_closed.png` 400×327，`popup/chest_open.png` 400×387 | | |
| 奖励图标 | `board/tool_*`、`r2/tool_*`、`popup/reward_seal_*`、`r2/icon_charm` | | |
| 目标图标 | `board/piece_*` | | |
| 锁 | `r2/icon_lock.png` | 61×72 | |

奖励徽章、光晕、地面阴影、错误行图标都是 Graphics 绘制（现有代码），不需要切图。

## 12. 验收清单

**布局**

- [ ] 7 种竖屏的面板宽等于 §3.4 的 pw（±1）。
- [ ] 按钮外沿（含投影）离面板内沿：左、右、下都是 16 ±1。
- [ ] 面板外沿离 `max(safe.top, 胶囊下沿)` ≥ 16，离 `H − safe.bottom` ≥ 16；7 屏、开箱前后、失败都满足。
- [ ] 档位和附录 A 一致：390×844 N、375×667 C、320×568 M、390×520 X。
- [ ] 开箱时按钮和宝箱的屏幕 y 不变（±1），只有上沿往上走。

**内容**

- [ ] 开箱后每个徽章下面有奖励名，格式「星光 ×2」「潮汐网」（×1 不写）；没有 CountBadge。
- [ ] 失败页文案正好是「还差一点点，换个顺序再试试吧」，一行。
- [ ] 结算页上没有任何解锁文字。
- [ ] 3D 盖子开到最大时，盖顶不压住奖励名（N/C 档）。
- [ ] 夜间：文字用夜间色，星、宝箱、红点用 K_HALF。

**动画**

- [ ] 亮星在 0.30 / 0.45 / 0.60 s 弹出（backOut 0.30 s），暗星静止。
- [ ] chest_open 0.5 s；名字在徽章落位后 0.20 s 淡入。
- [ ] 按钮按下 0.96；减少动态时不缩放。
- [ ] 减少动态：星和名字直接出现。

**存档错误（§9）**

- [ ] 模拟 `meadow-scene-load-failed`：结算页（win，开箱前后都要测）和失败页都显示错误行。
- [ ] 下一局开始后，错误行消失。

**红点 A**

- [ ] 新玩家：通关 04 后回岛，旅程册上有点；打开册子后岛上的点灭，「花粉草甸」牌上有点；进草甸章节页再返回，牌上的点灭；重启游戏后都不再出现。
- [ ] 老玩家升级（没有 `qfl.ui.seenUnlocks`）：没有任何点；key 被写入，内容是当前的 open。
- [ ] 锁住的章节（stage-locked）不出点；`completion-unsaved` 或 `finish-or-discard-current-attempt` 算已开放。
- [ ] 打开册子 / 小憩 / 设置页时 dock 隐藏，红点也跟着隐藏。
- [ ] localStorage 写失败时不报错，最多点不会灭。

**工程**

- [ ] `tools/board_art_sync.py` 能同步出 `popup/reddot.png`，meta 稳定（uuid5）。
- [ ] 相关的 cjs 测试都已更新并通过。

## 13. 没验证的部分（交接说明）

- 出图都是按公式用切图拼的，**没有在 Cocos 或真机上跑过**。3D 宝箱用的是 Blender 按 ResultChest3D 机位渲的近似图（`raw/chest_rt_*.png`），材质和光照可能和引擎里略有不同。
- 375×667 的岛屏底图是 390 截图缩放裁切出来的示意；③④ 的册子底图里，被盖住的道具是用海面修补出来的。
- 夜间底图（棋盘和岛）只是近似乘色。
- 测试 harness 没有重跑（这次没改代码）。

---

## 附录 A · 7 种竖屏取值（h 与奖励件数无关）

| 屏幕 | 安全区来源 | T 顶带 | B 底 | 可用高 A | popupScale | 面板宽 pw | 内容宽 ci | 档位 | h 开箱前 | h 开箱后 | h 失败 | 面板上沿(开) | 面板下沿 | 下沿→安全底 | 按钮宽 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 390x844 | 真机行 | 82 | 34 | 696 | 0.52 | 354 | 276 | N | 477 | 637 | 349 | 127.5 | 764.5 | 45.5 | 130 |
| 414x896 | 真机行 | 88 | 34 | 742 | 0.552 | 375 | 297 | N | 477 | 637 | 349 | 156.5 | 793.5 | 68.5 | 140.5 |
| 360x780 | 真机行 | 74 | 34 | 640 | 0.48 | 326 | 248 | N | 477 | 637 | 349 | 91.5 | 728.5 | 17.5 | 116 |
| 375x667 | 真机行 | 58 | 34 | 543 | 0.5 | 340 | 262 | C | 401 | 537 | 329 | 77 | 614 | 19 | 123 |
| 390x520 | 无 wx 兜底 | 83 | 34 | 371 | 0.4 | 272 | 194 | X | 305 | 361 | 257 | 104 | 465 | 21 | 89 |
| 320x568 | 真机行 | 56 | 34 | 446 | 0.4267 | 290 | 212 | M | 361 | 417 | 321 | 86.5 | 503.5 | 30.5 | 98 |
| 768x1024 | 无 wx 兜底 | 83 | 34 | 875 | 0.62 | 422 | 344 | N | 477 | 637 | 349 | 218 | 855 | 135 | 164 |

各档高度（win 开箱前 / 开箱后，失败，未保存/只读）：
- N：477 / 637，349，349
- C：401 / 537，329，321
- M：361 / 417，321，313
- X：305 / 361，257，257

## 附录 B · 节点坐标表（全部锚点 0.5/0.5；坐标是节点中心）

#### 390×844 · win · closed（档位 N；面板 354×477，屏幕上沿 y=287.5）

| 节点 | 面板内 x | 面板内 y（自上沿向下） | Cocos 位置 (x, h/2−y) | 宽 | 高 | 资源 / 内容 |
|---|---|---|---|---|---|---|
| TitlePlank | 0 | 24 | (0, 214.5) | 134 | 48 | popup/title_plank_3s |
| Title | 0 | 23 | (0, 215.5) | 70 | 24 | popup/title_4 |
| StarGlow | 0 | 96 | (0, 142.5) | 147.2 | 147.2 | glow |
| Star-0 | -68.6 | 102 | (-68.6, 136.5) | 52 | 48 | popup/star_full |
| Star-1 | 0 | 96 | (0, 142.5) | 69.3 | 64 | popup/star_full |
| Star-2 | 68.6 | 102 | (68.6, 136.5) | 52 | 48 | popup/star_full |
| Score | 0 | 164 | (0, 74.5) | 276 | 40 | 630 |
| ResultChestRow | 0 | 280 | (0, -41.5) | 276 | 144 |  |
| ResultChestHalo | 0 | 287.1 | (0, -48.6) | 138.1 | 138.1 | glow |
| ResultChestFloor | 10.1 | 348.6 | (10.1, -110.1) | 168 | 45.8 |  |
| ResultChest3D | 7.5 | 275.6 | (7.5, -37.1) | 280 | 280 | 3D RT 方框 |
| ResultChestTap | 0 | 283.4 | (0, -44.9) | 216 | 169.2 | hit 区 |
| LidTop | 0 | 151.8 | (0, 86.7) | 0 | 0 | 辅助线 |
| Btn-下一关 | -73 | 404 | (-73, -165.5) | 130 | 56 | 下一关 |
| Btn-回小岛 | 73 | 404 | (73, -165.5) | 130 | 56 | 回小岛 |

#### 390×844 · win · open（档位 N；面板 354×637，屏幕上沿 y=127.5）

| 节点 | 面板内 x | 面板内 y（自上沿向下） | Cocos 位置 (x, h/2−y) | 宽 | 高 | 资源 / 内容 |
|---|---|---|---|---|---|---|
| TitlePlank | 0 | 24 | (0, 294.5) | 134 | 48 | popup/title_plank_3s |
| Title | 0 | 23 | (0, 295.5) | 70 | 24 | popup/title_4 |
| StarGlow | 0 | 96 | (0, 222.5) | 147.2 | 147.2 | glow |
| Star-0 | -68.6 | 102 | (-68.6, 216.5) | 52 | 48 | popup/star_full |
| Star-1 | 0 | 96 | (0, 222.5) | 69.3 | 64 | popup/star_full |
| Star-2 | 68.6 | 102 | (68.6, 216.5) | 52 | 48 | popup/star_full |
| Score | 0 | 164 | (0, 154.5) | 276 | 40 | 630 |
| ResultChestRow | 0 | 360 | (0, -41.5) | 276 | 304 |  |
| ResultChestRays | 0 | 398.6 | (0, -80.1) | 276 | 276 | popup/fx_rays |
| ResultChestHalo | 0 | 419.1 | (0, -100.6) | 145.6 | 145.6 | glow |
| ResultChestFloor | 10.1 | 508.6 | (10.1, -190.1) | 168 | 45.8 |  |
| ResultChest3D | 7.5 | 435.6 | (7.5, -117.1) | 280 | 280 | 3D RT 方框 |
| LidTop | 0 | 311.8 | (0, 6.7) | 0 | 0 | 辅助线 |
| ResultFloat-0 | -48 | 240 | (-48, 78.5) | 64 | 64 |  |
| ResultRewardName-0 | -48 | 291 | (-48, 27.5) | 92 | 22 | 星光 ×2 |
| ResultFloat-1 | 48 | 240 | (48, 78.5) | 64 | 64 |  |
| ResultRewardName-1 | 48 | 291 | (48, 27.5) | 92 | 22 | 潮汐网 |
| Btn-下一关 | -73 | 564 | (-73, -245.5) | 130 | 56 | 下一关 |
| Btn-回小岛 | 73 | 564 | (73, -245.5) | 130 | 56 | 回小岛 |

#### 390×844 · lose（档位 N；面板 354×349，屏幕上沿 y=271.5）

| 节点 | 面板内 x | 面板内 y（自上沿向下） | Cocos 位置 (x, h/2−y) | 宽 | 高 | 资源 / 内容 |
|---|---|---|---|---|---|---|
| TitlePlank | 0 | 24 | (0, 150.5) | 153.3 | 48 | popup/title_plank_3s |
| Title | 0 | 23 | (0, 151.5) | 89.3 | 24 | popup/title_5 |
| Star-0 | -68.6 | 102 | (-68.6, 72.5) | 52 | 48 | popup/star_empty |
| Star-1 | 0 | 96 | (0, 78.5) | 69.3 | 64 | popup/star_empty |
| Star-2 | 68.6 | 102 | (68.6, 72.5) | 52 | 48 | popup/star_empty |
| ResultMessage | 0 | 156 | (0, 18.5) | 276 | 24 | 还差一点点，换个顺序再试试吧 |
| ResultGoals | 0 | 204 | (0, -29.5) | 276 | 40 |  |
| Btn-再试一次 | -73 | 276 | (-73, -101.5) | 130 | 56 | 再试一次 |
| Btn-回小岛 | 73 | 276 | (73, -101.5) | 130 | 56 | 回小岛 |

#### 390×844 · unsaved（档位 N；面板 354×349，屏幕上沿 y=271.5）

| 节点 | 面板内 x | 面板内 y（自上沿向下） | Cocos 位置 (x, h/2−y) | 宽 | 高 | 资源 / 内容 |
|---|---|---|---|---|---|---|
| TitlePlank | 0 | 24 | (0, 150.5) | 154.2 | 48 | popup/title_plank_3s |
| Title | 0 | 23 | (0, 151.5) | 90.2 | 24 | r2/title_unsaved |
| Star-0 | -68.6 | 102 | (-68.6, 72.5) | 52 | 48 | popup/star_full |
| Star-1 | 0 | 96 | (0, 78.5) | 69.3 | 64 | popup/star_full |
| Star-2 | 68.6 | 102 | (68.6, 72.5) | 52 | 48 | popup/star_full |
| Score | 0 | 164 | (0, 10.5) | 276 | 40 | 630 |
| ResultNotice | 0 | 212 | (0, -37.5) | 276 | 24 | 成绩还没存进旅程册 |
| Btn-重试保存 | -73 | 276 | (-73, -101.5) | 130 | 56 | 重试保存 |
| Btn-返回海岛 | 73 | 276 | (73, -101.5) | 130 | 56 | 返回海岛 |

#### 375×667 · win · closed（档位 C；面板 340×401，屏幕上沿 y=213）

| 节点 | 面板内 x | 面板内 y（自上沿向下） | Cocos 位置 (x, h/2−y) | 宽 | 高 | 资源 / 内容 |
|---|---|---|---|---|---|---|
| TitlePlank | 0 | 24 | (0, 176.5) | 134 | 48 | popup/title_plank_3s |
| Title | 0 | 23 | (0, 177.5) | 70 | 24 | popup/title_4 |
| StarGlow | 0 | 84 | (0, 116.5) | 128.8 | 128.8 | glow |
| Star-0 | -62.1 | 90 | (-62.1, 110.5) | 47.6 | 44 | popup/star_full |
| Star-1 | 0 | 84 | (0, 116.5) | 60.6 | 56 | popup/star_full |
| Star-2 | 62.1 | 90 | (62.1, 110.5) | 47.6 | 44 | popup/star_full |
| Score | 0 | 140 | (0, 60.5) | 262 | 40 | 630 |
| ResultChestRow | 0 | 232 | (0, -31.5) | 262 | 112 |  |
| ResultChestHalo | 0 | 238.6 | (0, -38.1) | 105.2 | 105.2 | glow |
| ResultChestFloor | 7.7 | 285.4 | (7.7, -84.9) | 128 | 34.9 |  |
| ResultChest3D | 5.7 | 229.8 | (5.7, -29.3) | 213.3 | 213.3 | 3D RT 方框 |
| ResultChestTap | 0 | 235.7 | (0, -35.2) | 176 | 136.5 | hit 区 |
| LidTop | 0 | 135.5 | (0, 65) | 0 | 0 | 辅助线 |
| Btn-下一关 | -69.5 | 330 | (-69.5, -129.5) | 123 | 52 | 下一关 |
| Btn-回小岛 | 69.5 | 330 | (69.5, -129.5) | 123 | 52 | 回小岛 |

#### 375×667 · win · open（档位 C；面板 340×537，屏幕上沿 y=77）

| 节点 | 面板内 x | 面板内 y（自上沿向下） | Cocos 位置 (x, h/2−y) | 宽 | 高 | 资源 / 内容 |
|---|---|---|---|---|---|---|
| TitlePlank | 0 | 24 | (0, 244.5) | 134 | 48 | popup/title_plank_3s |
| Title | 0 | 23 | (0, 245.5) | 70 | 24 | popup/title_4 |
| StarGlow | 0 | 84 | (0, 184.5) | 128.8 | 128.8 | glow |
| Star-0 | -62.1 | 90 | (-62.1, 178.5) | 47.6 | 44 | popup/star_full |
| Star-1 | 0 | 84 | (0, 184.5) | 60.6 | 56 | popup/star_full |
| Star-2 | 62.1 | 90 | (62.1, 178.5) | 47.6 | 44 | popup/star_full |
| Score | 0 | 140 | (0, 128.5) | 262 | 40 | 630 |
| ResultChestRow | 0 | 300 | (0, -31.5) | 262 | 248 |  |
| ResultChestRays | 0 | 337.6 | (0, -69.1) | 213.3 | 213.3 | popup/fx_rays |
| ResultChestHalo | 0 | 353.2 | (0, -84.7) | 110.9 | 110.9 | glow |
| ResultChestFloor | 7.7 | 421.4 | (7.7, -152.9) | 128 | 34.9 |  |
| ResultChest3D | 5.7 | 365.8 | (5.7, -97.3) | 213.3 | 213.3 | 3D RT 方框 |
| LidTop | 0 | 271.5 | (0, -3) | 0 | 0 | 辅助线 |
| ResultFloat-0 | -48 | 204 | (-48, 64.5) | 56 | 56 |  |
| ResultRewardName-0 | -48 | 251 | (-48, 17.5) | 92 | 22 | 星光 ×2 |
| ResultFloat-1 | 48 | 204 | (48, 64.5) | 56 | 56 |  |
| ResultRewardName-1 | 48 | 251 | (48, 17.5) | 92 | 22 | 潮汐网 |
| Btn-下一关 | -69.5 | 466 | (-69.5, -197.5) | 123 | 52 | 下一关 |
| Btn-回小岛 | 69.5 | 466 | (69.5, -197.5) | 123 | 52 | 回小岛 |

#### 375×667 · lose（档位 C；面板 340×329，屏幕上沿 y=181）

| 节点 | 面板内 x | 面板内 y（自上沿向下） | Cocos 位置 (x, h/2−y) | 宽 | 高 | 资源 / 内容 |
|---|---|---|---|---|---|---|
| TitlePlank | 0 | 24 | (0, 140.5) | 153.3 | 48 | popup/title_plank_3s |
| Title | 0 | 23 | (0, 141.5) | 89.3 | 24 | popup/title_5 |
| Star-0 | -62.1 | 90 | (-62.1, 74.5) | 47.6 | 44 | popup/star_empty |
| Star-1 | 0 | 84 | (0, 80.5) | 60.6 | 56 | popup/star_empty |
| Star-2 | 62.1 | 90 | (62.1, 74.5) | 47.6 | 44 | popup/star_empty |
| ResultMessage | 0 | 140 | (0, 24.5) | 262 | 24 | 还差一点点，换个顺序再试试吧 |
| ResultGoals | 0 | 188 | (0, -23.5) | 262 | 40 |  |
| Btn-再试一次 | -69.5 | 258 | (-69.5, -93.5) | 123 | 52 | 再试一次 |
| Btn-回小岛 | 69.5 | 258 | (69.5, -93.5) | 123 | 52 | 回小岛 |

#### 375×667 · unsaved（档位 C；面板 340×321，屏幕上沿 y=185）

| 节点 | 面板内 x | 面板内 y（自上沿向下） | Cocos 位置 (x, h/2−y) | 宽 | 高 | 资源 / 内容 |
|---|---|---|---|---|---|---|
| TitlePlank | 0 | 24 | (0, 136.5) | 154.2 | 48 | popup/title_plank_3s |
| Title | 0 | 23 | (0, 137.5) | 90.2 | 24 | r2/title_unsaved |
| Star-0 | -62.1 | 90 | (-62.1, 70.5) | 47.6 | 44 | popup/star_full |
| Star-1 | 0 | 84 | (0, 76.5) | 60.6 | 56 | popup/star_full |
| Star-2 | 62.1 | 90 | (62.1, 70.5) | 47.6 | 44 | popup/star_full |
| Score | 0 | 140 | (0, 20.5) | 262 | 40 | 630 |
| ResultNotice | 0 | 188 | (0, -27.5) | 262 | 24 | 成绩还没存进旅程册 |
| Btn-重试保存 | -69.5 | 250 | (-69.5, -89.5) | 123 | 52 | 重试保存 |
| Btn-返回海岛 | 69.5 | 250 | (69.5, -89.5) | 123 | 52 | 返回海岛 |

#### 320×568 · win · open（档位 M；面板 290×417，屏幕上沿 y=86.5）

| 节点 | 面板内 x | 面板内 y（自上沿向下） | Cocos 位置 (x, h/2−y) | 宽 | 高 | 资源 / 内容 |
|---|---|---|---|---|---|---|
| TitlePlank | 0 | 24 | (0, 184.5) | 134 | 48 | popup/title_plank_3s |
| Title | 0 | 23 | (0, 185.5) | 70 | 24 | popup/title_4 |
| StarGlow | 0 | 80 | (0, 128.5) | 110.4 | 110.4 | glow |
| Star-0 | -55.6 | 86 | (-55.6, 122.5) | 43.3 | 40 | popup/star_full |
| Star-1 | 0 | 80 | (0, 128.5) | 52 | 48 | popup/star_full |
| Star-2 | 55.6 | 86 | (55.6, 122.5) | 43.3 | 40 | popup/star_full |
| Score | 0 | 132 | (0, 76.5) | 212 | 40 | 630 |
| ResultChestRow | 0 | 232 | (0, -23.5) | 212 | 144 |  |
| ResultChestRays | -44 | 233.8 | (-44, -25.3) | 173.3 | 173.3 | popup/fx_rays |
| ResultChestHalo | -44 | 246.5 | (-44, -38) | 90.1 | 90.1 | glow |
| ResultChestFloor | -37.8 | 301.9 | (-37.8, -93.4) | 104 | 28.4 |  |
| ResultChest3D | -39.4 | 256.7 | (-39.4, -48.2) | 173.3 | 173.3 | 3D RT 方框 |
| LidTop | -44 | 180.1 | (-44, 28.4) | 0 | 0 | 辅助线 |
| ResultFloat-0 | 60 | 182 | (60, 26.5) | 40 | 40 |  |
| ResultRewardName-0 | 60 | 217 | (60, -8.5) | 72 | 22 | 星光 ×2 |
| ResultFloat-1 | 60 | 256 | (60, -47.5) | 40 | 40 |  |
| ResultRewardName-1 | 60 | 291 | (60, -82.5) | 72 | 22 | 潮汐网 |
| Btn-下一关 | -57 | 346 | (-57, -137.5) | 98 | 52 | 下一关 |
| Btn-回小岛 | 57 | 346 | (57, -137.5) | 98 | 52 | 回小岛 |

#### 390×520 · win · open（档位 X；面板 272×361，屏幕上沿 y=104）

| 节点 | 面板内 x | 面板内 y（自上沿向下） | Cocos 位置 (x, h/2−y) | 宽 | 高 | 资源 / 内容 |
|---|---|---|---|---|---|---|
| TitlePlank | 0 | 24 | (0, 156.5) | 134 | 48 | popup/title_plank_3s |
| Title | 0 | 23 | (0, 157.5) | 70 | 24 | popup/title_4 |
| Star-0 | -78.3 | 80 | (-78.3, 100.5) | 26 | 24 | popup/star_full |
| Star-1 | -44 | 76 | (-44, 104.5) | 34.6 | 32 | popup/star_full |
| Star-2 | -9.7 | 80 | (-9.7, 100.5) | 26 | 24 | popup/star_full |
| Score | 55.3 | 76 | (55.3, 104.5) | 72 | 40 | 630 |
| ResultChestRow | 0 | 176 | (0, 4.5) | 194 | 144 |  |
| ResultChestRays | -44 | 177.8 | (-44, 2.7) | 173.3 | 173.3 | popup/fx_rays |
| ResultChestHalo | -44 | 190.5 | (-44, -10) | 90.1 | 90.1 | glow |
| ResultChestFloor | -37.8 | 245.9 | (-37.8, -65.4) | 104 | 28.4 |  |
| ResultChest3D | -39.4 | 200.7 | (-39.4, -20.2) | 173.3 | 173.3 | 3D RT 方框 |
| LidTop | -44 | 124.1 | (-44, 56.4) | 0 | 0 | 辅助线 |
| ResultFloat-0 | 60 | 126 | (60, 54.5) | 40 | 40 |  |
| ResultRewardName-0 | 60 | 161 | (60, 19.5) | 72 | 22 | 星光 ×2 |
| ResultFloat-1 | 60 | 200 | (60, -19.5) | 40 | 40 |  |
| ResultRewardName-1 | 60 | 235 | (60, -54.5) | 72 | 22 | 潮汐网 |
| Btn-下一关 | -52.5 | 290 | (-52.5, -109.5) | 89 | 52 | 下一关 |
| Btn-回小岛 | 52.5 | 290 | (52.5, -109.5) | 89 | 52 | 回小岛 |
