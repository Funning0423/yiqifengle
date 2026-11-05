# GGbot → Clonebot 本批交接 · 停工 · 2026-11-05

> **状态：定稿**（运镜气球 + 湖畔轻俯视 tip 已齐）  
> tip 文档 SHA：见本文件末次 commit（branch `ggbot/b20-meadow-c-skycity-rt`）

Funning：本批修完并 push 后，**小游戏开发与测试整体暂停**，交 Clonebot。GGbot **不再开新内容**。

**branch（GGbot tip 栈）**：`ggbot/b20-meadow-c-skycity-rt` → `github`（Funning0423/yiqifengle）  
**GGbot 本批 tip 头**：`91177e40`（空盘 fill）叠 stutter `b79b7e80` / lakeside trial  
**对照体验（旧）**：`1.0.202611050927` @ integrate `9ec8410`（TSW OFF + trial kit 默认 ON 但空盘竞态）

---

## 必链（Clonebot 索引）

| 链 | 路径 / SHA | 用途 |
|---|---|---|
| **气球升空缺陷定稿** | `work/pm/balloon-ascent-bugs-20261105.md` | Bug A 甩海 / B 门开 / C stutter 分工 |
| **湖畔空盘根因** | `work/pm/lakeside-empty-on-trial-20261105.md` | preload 竞态：3D 未挂 + 2D 已藏 |
| **SkycityLegHeavy tip** | `docs/handoff/GGbot/SKYCITY-LEG-HEAVY-DEFAULT-OFF-20261105.md` · feature `2beb1cd4` / tip `0773db73` / fill `b79b7e80` | 升空+广场 walk stutter |
| **湖畔空盘竞态 tip** | `docs/handoff/GGbot/LAKESIDE-KIT-EMPTY-BOARD-RACE-20261105.md` · feature `28f5b386` / tip `d626718b` / fill `91177e40` | preload 前 fromFlag |
| **气球 tip（运镜）** | fix `24fd2f22` / HEAD `1d29c5c7`（或 `6a587f26`）· 分支 `cine/balloon-door-dismount-fix` · `docs/handoff/运镜bot/HANDOFF.md` + `previews/运镜bot/balloon-door-dismount/` | 甩海 seatDef + door B rest 180° |
| **湖畔轻俯视 tip（运镜）** | fix `c6835e99` / HEAD `82ccdbe2` · 分支 `cine/lakeside-board-cam-fix` · `previews/运镜bot/lakeside-board-cam/` + `docs/handoff/运镜bot/cine-lakeside-board-cam-fix.bundle` | 样板轻俯视可点格；禁岸边远看 |
| 样板图 | `work/pm/lakeside-fusion-sample-funning-20261105.png` | Funning 定稿构图 |
| 样板对照 | `work/pm/lakeside-fusion-sample-match-20261105.md` | LK_* 对照表 |
| 空盘真机图 | `work/pm/balloon-bugs-20261105/lakeside-empty-board-050927.png` | 050927 空盘+远景 |
| 升空门开图 | `work/pm/balloon-bugs-20261105/ascent-door-open.png` | Bug B |
| 甩海图 | `work/pm/balloon-bugs-20261105/dismount-fling-sea.png` | Bug A |

---

## 本批 tip 总表（STRIP 合入）

| 刀 | Owner | feature / fix | tip / HEAD | branch |
|---|---|---|---|---|
| C 升空+广场 stutter | GGbot | `2beb1cd4` | tip `0773db73` | `ggbot/b20-meadow-c-skycity-rt` |
| 湖畔空盘竞态 | GGbot | `28f5b386` | tip `d626718b` | `ggbot/b20-meadow-c-skycity-rt` |
| 气球门/甩海 | 运镜 | `24fd2f22` | HEAD `1d29c5c7`（或 `6a587f26`） | `cine/balloon-door-dismount-fix` |
| 湖畔轻俯视相机 | 运镜 | `c6835e99` | HEAD `82ccdbe2` | `cine/lakeside-board-cam-fix` |

合入审：**勿冲** B5 seatDef + door B rest；**勿重开 TSW**；空盘 tip 与轻俯视 tip 互补（露出 vs 机位），勿互回滚。

---

## GGbot 两刀要点

### 1) SkycityLegHeavy 默认 OFF · tip `0773db73`
- 覆盖：升空周期掉帧 + 着陆后往广场 walk 一直掉帧
- 默认：`SKYCITY_LEG_HEAVY_ENABLED=false`
- 对照：`?qfskyheavy=1` / `__qfSkyLegHeavy=true`
- 硬约束：不改门/seatDef；不回退 sea-landing 视觉；TSW 保持 OFF

### 2) 湖畔空盘 preload 竞态 · tip `d626718b`
- 根因：preload 时 `lakesideKitAssetsOn=false` → 滤 `LK_piece_*`+RING/SHD；进盘才 hide 2D = 空盘
- 修：`buildLakesideBoard` 开头先 `lakesideBoardKitFromFlag()`（trial 默认 ON）
- 关回：`?qflakesidekit=0` / `__qfLakesideBoardKit=false`
- 相机：**不改**（见运镜轻俯视 tip）

---

## 运镜两刀要点（合入勿冲）

权威：`work/pm/balloon-ascent-bugs-20261105.md`

| Bug | tip | 验收 |
|---|---|---|
| A 甩海 | `24fd2f22` / `1d29c5c7` | 着陆前后角色相对篮 ≤ 数 cm；无「人在蓝空」 |
| B 门开 | 同上 | 巡航双门关；door B rest 180° |
| 湖畔轻俯视 | `c6835e99` / `82ccdbe2` | 进盘 ≈ 样板轻俯视可点格；禁岸边远看 |

---

## 仍生效的 FPS / 默认 OFF 栈（勿擅自翻回）

| 项 | tip/feature（短） | 默认 |
|---|---|---|
| TransitionShaderWarm | `8f520d00` / HIT `dc248d14` @ `1.0.202611050759` | **OFF（勿开）** |
| StandupProgramWarm | `ba8ea27e` 等 | OFF |
| Morph idle drive | `5acfa98d` | OFF |
| PeriodHeavyRefresh | `403462f1` | OFF |
| SceneAudioPoll | `761d1bf7` | OFF |
| LAKESIDE_KIT formal HOLD | `05ca7c50` / `ee791ad5` | 正式 OFF；trial ON（`e74c0f76`）+ 竞态修 `28f5b386` |
| SkycityLegHeavy | `2beb1cd4` / `0773db73` | **OFF** |

COUNT16↔FAT：**暂缓**，仅 stutter 复发再作。

---

## Clonebot 检查清单

1. [ ] STRIP 合入上表四刀 → integrate → upload 新体验版  
2. [ ] 升空：周期 stutter；`?qfskyheavy=1` 对照  
3. [ ] 着陆后往广场 walk  
4. [ ] 下篮：不甩海；飞行中门关（运镜气球 tip）  
5. [ ] 湖畔无 query：LK_* vs 样板；`?qflakesidekit=0` 回 2D  
6. [ ] 湖畔相机：轻俯视可点（运镜 `82ccdbe2`）  
7. [ ] 回归：起身；TSW OFF  
8. [ ] **停开新内容**直至 Funning 再开  

---

## Owner

- **GGbot**：本批 tip + 本定稿；停开新内容  
- **PM**：STRIP / upload / 总调度  
- **运镜**：气球 A/B + 湖畔轻俯视（上表）  
- **Clonebot**：接验 + 停工后测试/维护  

upload = 始终等 PM；GGbot 不自行 WeChat upload。
