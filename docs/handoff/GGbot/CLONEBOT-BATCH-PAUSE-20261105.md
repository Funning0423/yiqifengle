# GGbot → Clonebot 本批交接 · 停工 · 2026-11-05

Funning：本批（升空/着陆 stutter + 湖畔空盘 kit）修完并 push 后，**小游戏开发与测试整体暂停**，交 Clonebot。GGbot **不再开新内容**。

**branch**：`ggbot/b20-meadow-c-skycity-rt` → `github`（Funning0423/yiqifengle）  
**本批 tip 头**：`91177e40`（空盘 fill）叠在 stutter `b79b7e80` / lakeside trial 上  
**对照体验（旧）**：`1.0.202611050927` @ integrate `9ec8410`（TSW OFF + trial kit 默认 ON 但空盘竞态）

---

## 本批两刀（必须合入体验版再验）

| 刀 | feature | tip | fill | handoff |
|---|---|---|---|---|
| **C 升空+广场 walk stutter** | `2beb1cd4` | `0773db73` | `b79b7e80` | `docs/handoff/GGbot/SKYCITY-LEG-HEAVY-DEFAULT-OFF-20261105.md` |
| **湖畔空盘竞态** | `28f5b386` | `d626718b` | `91177e40` | `docs/handoff/GGbot/LAKESIDE-KIT-EMPTY-BOARD-RACE-20261105.md` |

PM 已在合 stutter；空盘 tip 刚交，等 STRIP。

### 1) SkycityLegHeavy 默认 OFF
- **覆盖**：meadow→skycity **升空**周期掉帧 + 着陆后往广场 **walk 一直掉帧**
- **默认**：`SKYCITY_LEG_HEAVY_ENABLED=false`（BalloonTransit 升空重 paint + Cloudsea 着陆后每帧 syncDay）
- **对照开回**：`?qfskyheavy=1` / `__qfSkyLegHeavy=true`
- **硬约束**：**勿重开 TSW**（`9ec8410` 已 OFF 且整机「不卡了」）；不改门/seatDef；不回退 sea-landing 视觉
- **Clonebot 验**：合入后摸升空是否还周期 stutter、着陆后往广场是否还一直掉；若仍卡再开 `qfskyheavy=1` 对照是否回退加重

### 2) 湖畔空盘 preload 竞态
- **根因**：`preloadLakesideBoard` 时 `lakesideKitAssetsOn=false` → 滤 52×`LK_piece_*`+RING/SHD；进盘才 `fromFlag` hide 2D → **3D 未挂 + 2D 已藏 = 空盘**。再 upload `9ec8410` 无意义。
- **修**：`buildLakesideBoard` 开头先 `lakesideBoardKitFromFlag()`（trial 默认 ON 语义保留）
- **关回**：`?qflakesidekit=0` / `__qfLakesideBoardKit=false`
- **Clonebot 验（无 query）**：白线 `LK_wb_line` + 角桩灯笼 `LK_buoy_lantern` + 木筏 `LK_chime_raft` + 格上 `LK_piece_*`；托盘/2D 棋子应藏。`qflakesidekit=0` 应回 2D tray。
- **相机**：**运镜主责**。本 tip **不改** pose。合入后若盘面 LK_* 已在、仍岸边远看 → 转运镜（样板：`work/pm/lakeside-fusion-sample-funning-20261105.png`）。

---

## 运镜并行（GGbot 不主改，合入时别冲）

见 `work/pm/balloon-ascent-bugs-20261105.md`：
- **Bug A 甩海**：B5 禁用草原 `seatDef`，按当前篮位重算（对齐湖畔 getout）
- **Bug B 门开**：door B 关/开保留 rest **180°**；飞行强制双门关  
GGbot 合入审：别冲掉 B5 seatDef + door B rest。

---

## 仍生效的 FPS / 默认 OFF 栈（勿擅自翻回）

| 项 | tip/feature（短） | 默认 |
|---|---|---|
| TransitionShaderWarm | `8f520d00` / 真机 HIT `dc248d14` @ `1.0.202611050759` | **OFF**（周期 stutter ROOT；**勿开**） |
| StandupProgramWarm | `ba8ea27e` 等 | OFF |
| Morph idle drive | `5acfa98d` | OFF |
| PeriodHeavyRefresh | `403462f1` | OFF |
| SceneAudioPoll | `761d1bf7` | OFF |
| LAKESIDE_KIT formal HOLD | `05ca7c50` / `ee791ad5` | 正式语义 OFF；**trial** 默认 ON（`e74c0f76`/`457b359c`）+ 本批竞态修 `28f5b386` |
| SkycityLegHeavy | `2beb1cd4`/`0773db73` | **OFF**（本批） |

COUNT16↔FAT：**暂缓**，仅 stutter 复发再作。

---

## 样板 / PM 审计路径

- 湖畔融合样板：`work/pm/lakeside-fusion-sample-funning-20261105.png`
- 样板对照：`work/pm/lakeside-fusion-sample-match-20261105.md`
- 空盘根因：`work/pm/lakeside-empty-on-trial-20261105.md`
- 气球升空缺陷：`work/pm/balloon-ascent-bugs-20261105.md`
- 空盘真机图：`work/pm/balloon-bugs-20261105/lakeside-empty-board-050927.png`

---

## Clonebot 检查清单

1. [ ] STRIP 合入 `0773db73` + `d626718b`（+ 运镜 A/B 若已交）到 integrate，upload 新体验版  
2. [ ] 升空：周期 stutter 是否缓解；`?qfskyheavy=1` 对照  
3. [ ] 着陆后往广场 walk：是否仍一直掉帧  
4. [ ] 湖畔无 query：LK_* 露出 vs 样板骨架；`?qflakesidekit=0` 回 2D  
5. [ ] 湖畔相机：若仍观光远景 → **运镜**，不回滚空盘 tip  
6. [ ] 回归：起身手感；TSW 仍 OFF；门/seatDef（运镜 tip）不回归甩海/门开  
7. [ ] **停开新内容**直至 Funning 再开

---

## Owner

- **GGbot**：本批 tip 已 push；暂停新开发  
- **PM**：STRIP / upload / 总调度  
- **运镜**：门 / B5 seatDef / 湖畔俯视相机  
- **Clonebot**：接验 + 停工后的测试/维护

upload = 始终等 PM；GGbot 不自行 WeChat upload。
