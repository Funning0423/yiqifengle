# T6 画外帧根因（>12 m 时她不在画面内的 910 帧）— 运镜bot, base 8c98bbfe

T6 = 97.40% (34138/35048)。910 帧全部逐帧复算（`t6-offframe-analyze.cjs`，与 `test_sky_walk_whole.cjs` 同一 `sky-rail-model` + `LensSmooth.herMargin`，60 Hz，7 屏），合计 910 帧，一帧不差。

## 结论
- 49 段，**全部 (a) 设计内**：910 帧 / 49 段。**(b) 跟丢：0 段 / 0 帧**。
- 走路轨道上（rail parts）、walk-plan skip 衔接、S4>S6 站位：>12 m 画外帧 = 0。
- 画外帧只出现在 **棋盘镜头 ↔ 轨道** 的 board join 两端：进场 join (`SKY_JOINS.i`) 的最前 16–20 帧、出场 join (`SKY_JOINS.o`) 的最后 18–21 帧（每段 0.27–0.35 s）。

## 机制（带数字）
写入方：`RegionNodeStage.skyJoin`（RegionNodeStage.ts:320）→ `SkyRunLens.skyRailJoin`（SkyRunLens.ts:21）。join 的朝向 = 在“看她胸口”和“棋盘镜头朝向 D(board)”之间混合；混合窗口 u = min(0.4, 0.6/T)，即固定 0.6 s smootherstep：进场 `1-ss(x/u)` 从棋盘朝向放开，出场 `ss((x-1+u)/u)` 收回棋盘朝向。
- 棋盘镜头本身（`SkycityVisitPose.skycityVisitPose(anchor_spawn_girl, anchor_starcourt_center, aspect)`，RegionBoardLanding 交给世界镜头的 live lens）拍的是星庭全景；她站在 S2…S5 节点时离棋盘镜头 36.8–71.2 m、偏离其光轴 27.6–35.0°，棋盘镜头里她的 herMargin = −0.77…−1.58（本来就不在棋盘构图内）。
- 规则“第一帧 = live lens”要求进场 join 从这个棋盘镜头开始，出场 join 结束在它上面；每段都含这一帧（49/49）。
- 她进画/出画发生在棋盘朝向权重降到 ≈0.43–0.50（进场）/升到 ≈0.43–0.66（出场）时。
- 为什么不算跟丢：轨道跟随没有滞后（rail 段 0 帧画外）；画外帧里没有 margin 裁切、胶囊安全区裁切或轨道瞄偏；她完全在棋盘构图之外（不是贴边）。要更早把她拉进画面，只能加快 0.6 s 的瞄准混合：28–35° 用 0.6 s smootherstep，峰值角速度已经是 1.875·θ/0.6 ≈ 86–109°/s；缩到 0.4 s 就是 131–164°/s，超过 120°/s 上限，0 s 就是硬切。所以这是棋盘↔行走交接的设计帧。

## 分段汇总（7 屏合并；逐屏 49 段见 t6-offframe.json）
| walk | case | join | 屏数 | 帧 | 每屏帧 | 距离 m | 棋盘镜头偏轴 ° | 她进/出画时棋盘权重 | 类 |
|---|---|---|---|---|---|---|---|---|---|
| S2>S3 | board entry → exit | out | 7 | 137 | 18–21 | 36.8–45.6 | 27.6–35.0 | 0.44 | a |
| S3>S4 | board entry → exit | in | 7 | 134 | 18–20 | 36.8–45.6 | 27.6–35.0 | 0.45 | a |
| S3>S4 | board entry → exit | out | 7 | 128 | 16–20 | 50.9–59.8 | 27.7–33.1 | 0.47 | a |
| S4>S5 | board entry → exit | in | 7 | 125 | 16–19 | 50.9–59.8 | 27.7–33.1 | 0.50 | a |
| S4>S5 | board entry → exit | out | 7 | 136 | 18–21 | 62.5–71.2 | 29.6–34.2 | 0.43 | a |
| S4>S6 | board entry → exit | in | 7 | 125 | 16–19 | 50.9–59.8 | 27.7–33.1 | 0.50 | a |
| S4>S6 | from S6 (planSkip) | in | 7 | 125 | 16–19 | 50.9–59.8 | 27.7–33.1 | 0.50 | a |
合计 137+134+128+125+136+125+125 = **910**。S2>S3 出场 / S3>S4 进场 95.1% 最低，因为这两段 >12 m 的总帧数最少（2776 / 2759），不是因为画外帧多。

## (b) 段的修法与体积
无 (b) 段，不需要修。如果 Grok Bot 想把 T6 做到 100%（不是本次要求）：
- 镜头侧没有合规修法：加快瞄准混合会违反 ≤120°/s；在棋盘镜头里提前转向会违反“第一帧 = live lens”。
- 唯一办法在棋盘构图本身：让 `skycityVisitPose` 在走路前后把她当前所在节点也框进去（GGbot / RegionBoardLanding 的文件，改的是棋盘 UI 构图，需界面验收部同意）。估算约 +150–250 B，未实现，未测。

## 联系表
`t6-offframe-390x844.png`：390x844，每行一种 join（S2>S3 out, S3>S4 in, S3>S4 out, S4>S5 in, S4>S5 out, S4>S6 in；S4>S6 from-S6 与 S4>S6 in 逐帧相同，不重复）。顶条红 = 画外，绿 = 画内。进场行：#0（棋盘镜头）、中、最后画外、第一帧画内、+15；出场行：−15、最后画内、第一帧画外、中、最后一帧（棋盘镜头）。NOT_ENGINE 扁平光栅，红色小盒 = 她。

## 文件
- t6-offframe.json：49 段逐段数据（帧号、join 进度、棋盘权重、距离、偏轴角、margin）
- t6-offframe-analyze.cjs / t6-offframe-sheet.cjs：复算与出图脚本（在 worktree 根目录用 `QF_TYPESCRIPT_MODULE=/workspace/wt/ts5/node_modules/typescript` 运行；中间文件写到 /workspace/t6scratch）
- MAC-CHECKLIST-fullN.diff：给 GGbot 的 MAC-CHECKLIST 补丁（未直接改 GGbot 的文件）
- 门禁没改，代码没改。
