# GGbot → Clonebot 本批交接 · 停工 · 2026-11-05

> **状态：DRAFT（等运镜轻俯视 tip 到齐后定稿 push）**  
> 修订：补必链；气球门/seatDef 仍归运镜；定稿前不删此稿。

Funning：本批（升空/着陆 stutter + 湖畔空盘 kit）修完并 push 后，**小游戏开发与测试整体暂停**，交 Clonebot。GGbot **不再开新内容**。

**branch**：`ggbot/b20-meadow-c-skycity-rt` → `github`（Funning0423/yiqifengle）  
**本批 tip 头（GGbot）**：`91177e40`（空盘 fill）叠在 stutter `b79b7e80` / lakeside trial 上  
**对照体验（旧）**：`1.0.202611050927` @ integrate `9ec8410`（TSW OFF + trial kit 默认 ON 但空盘竞态）

---

## 必链（Clonebot / 定稿索引）

| 链 | 路径 | 用途 |
|---|---|---|
| **气球升空缺陷定稿** | `work/pm/balloon-ascent-bugs-20261105.md` | Bug A 甩海 / B 门开 / C stutter 分工；门 rest 180°、B5 seatDef |
| **湖畔空盘根因** | `work/pm/lakeside-empty-on-trial-20261105.md` | preload 竞态：3D 未挂 + 2D 已藏 |
| **SkycityLegHeavy tip** | `docs/handoff/GGbot/SKYCITY-LEG-HEAVY-DEFAULT-OFF-20261105.md` | 升空+广场 walk stutter；`0773db73` / `2beb1cd4` |
| **湖畔空盘竞态 tip（本 tip）** | `docs/handoff/GGbot/LAKESIDE-KIT-EMPTY-BOARD-RACE-20261105.md` | preload 前 fromFlag；`d626718b` / `28f5b386` |
| **气球 tip（运镜 · A/B）** | 见下「运镜并行」；定稿时填运镜 tip SHA + handoff 路径 | 甩海 seatDef + door B rest 180°；**合入勿冲** |
| **湖畔轻俯视相机 tip（运镜）** | **待填**（到齐后定稿） | 样板「带一点俯视」可点格；禁岸边远看 |
| 样板图 | `work/pm/lakeside-fusion-sample-funning-20261105.png` | Funning 定稿构图 |
| 样板对照 | `work/pm/lakeside-fusion-sample-match-20261105.md` | LK_* 对照表 |
| 空盘真机图 | `work/pm/balloon-bugs-20261105/lakeside-empty-board-050927.png` | 050927 空盘+远景 |
| 升空门开图 | `work/pm/balloon-bugs-20261105/ascent-door-open.png` | Bug B |
| 甩海图 | `work/pm/balloon-bugs-20261105/dismount-fling-sea.png` | Bug A |

---

## 本批 GGbot 两刀（必须合入体验版再验）

| 刀 | feature | tip | fill | handoff |
|---|---|---|---|---|
| **C 升空+广场 walk stutter** | `2beb1cd4` | `0773db73` | `b79b7e80` | [SKYCITY-LEG-HEAVY…](./SKYCITY-LEG-HEAVY-DEFAULT-OFF-20261105.md) |
| **湖畔空盘竞态** | `28f5b386` | `d626718b` | `91177e40` | [LAKESIDE-KIT-EMPTY-BOARD-RACE…](./LAKESIDE-KIT-EMPTY-BOARD-RACE-20261105.md) |

PM：stutter 已在合；空盘 tip 合入对照包中。

### 1) SkycityLegHeavy 默认 OFF
- **覆盖**：meadow→skycity **升空**周期掉帧 + 着陆后往广场 **walk 一直掉帧**
- **默认**：`SKYCITY_LEG_HEAVY_ENABLED=false`
- **对照开回**：`?qfskyheavy=1` / `__qfSkyLegHeavy=true`
- **硬约束**：**勿重开 TSW**；不改门/seatDef；不回退 sea-landing 视觉
- **Clonebot 验**：升空周期 + 广场 walk；`qfskyheavy=1` 对照是否回退加重

### 2) 湖畔空盘 preload 竞态
- **根因**：见 [lakeside-empty-on-trial](../../../work/pm/lakeside-empty-on-trial-20261105.md)（相对 repo 根：`work/pm/…`）
- **修**：`buildLakesideBoard` 开头先 `lakesideBoardKitFromFlag()`（trial 默认 ON 语义保留）
- **关回**：`?qflakesidekit=0` / `__qfLakesideBoardKit=false`
- **Clonebot 验（无 query）**：`LK_wb_line` + `LK_buoy_lantern` + `LK_chime_raft` + `LK_piece_*`；托盘/2D 藏。`qflakesidekit=0` → 2D tray
- **相机**：本 tip **不改**；等运镜轻俯视 tip

---

## 运镜并行（GGbot 不主改，合入时别冲）

权威：[balloon-ascent-bugs-20261105.md](../../../work/pm/balloon-ascent-bugs-20261105.md)

| Bug | Owner | 一句话 |
|---|---|---|
| A 甩海 | **运镜**（GGbot 合入审） | B5 禁用草原 seatDef；按当前篮位重算 |
| B 门开 | **运镜** | door B 关/开保留 rest **180°**；飞行强制双门关 |
| 湖畔轻俯视 | **运镜** | 样板俯视近景可点格；禁岸边远看 |
| C stutter | GGbot（上表） | SkycityLegHeavy OFF |

**气球 tip**：运镜交 tip 后，把 **feature/tip SHA + handoff 路径**填进上表「必链 · 气球 tip」行，再定稿本文件。  
GGbot 合入审：别冲掉 B5 seatDef + door B rest。

---

## 仍生效的 FPS / 默认 OFF 栈（勿擅自翻回）

| 项 | tip/feature（短） | 默认 |
|---|---|---|
| TransitionShaderWarm | `8f520d00` / 真机 HIT `dc248d14` @ `1.0.202611050759` | **OFF**（**勿开**） |
| StandupProgramWarm | `ba8ea27e` 等 | OFF |
| Morph idle drive | `5acfa98d` | OFF |
| PeriodHeavyRefresh | `403462f1` | OFF |
| SceneAudioPoll | `761d1bf7` | OFF |
| LAKESIDE_KIT formal HOLD | `05ca7c50` / `ee791ad5` | 正式 OFF；**trial** ON（`e74c0f76`）+ 竞态修 `28f5b386` |
| SkycityLegHeavy | `2beb1cd4`/`0773db73` | **OFF** |

COUNT16↔FAT：**暂缓**，仅 stutter 复发再作。

---

## Clonebot 检查清单

1. [ ] STRIP 合入 `0773db73` + `d626718b` + 运镜气球 tip + 运镜轻俯视 tip → integrate → upload  
2. [ ] 升空：周期 stutter；`?qfskyheavy=1` 对照  
3. [ ] 着陆后往广场 walk  
4. [ ] 湖畔无 query：LK_* vs 样板；`?qflakesidekit=0` 回 2D  
5. [ ] 湖畔相机：样板轻俯视可点（运镜 tip）；勿回滚空盘 tip  
6. [ ] 回归：起身；TSW OFF；门关/不甩海（运镜 tip）  
7. [ ] **停开新内容**直至 Funning 再开  
8. [ ] 定稿：运镜两 tip SHA 填入「必链」后去掉 DRAFT 标记并 push

---

## Owner

- **GGbot**：本批 tip 已交；DRAFT 总交接；停开新内容；运镜 tip 到齐后定稿补链  
- **PM**：STRIP / upload / 总调度  
- **运镜**：门 / B5 seatDef / 湖畔轻俯视  
- **Clonebot**：接验 + 停工后测试/维护

upload = 始终等 PM；GGbot 不自行 WeChat upload。
