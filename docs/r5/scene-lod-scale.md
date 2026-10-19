# R5 场景三级细节与比例基准（scene LOD / scale）

场景特效bot · 2026-10-18 · 分支 `fx/r5-s2-360`。参考 `/workspace/b05/research/acnh/REPORT.md` 中的“粗密の歩み寄り”、L1/L2/L3 和背面封闭三节。

- 实测工具：`tools/scene-fx/blender_lod_audit.py`。它导入每个 GLB，记录每个网格的三角面数、glTF 包围盒和贴图尺寸。原始 JSON 在 `previews/场景特效bot/r5/s3/lod_scale/lod_audit.json`。
- 比例对照图：`previews/场景特效bot/r5/s3/lod_scale/scale_lineup.png`。由 `blender_lod_scale_lineup.py` 出图（Cycles 64 + OIDN，正交前视，同一比例尺），再用 `annotate_lod_lineup.py` 标注。
- 测量范围：
  - `creator-build-project/assets/bundles` 下的全部 72 个 GLB。
  - 海岛 `combined_visual_m.glb`（sha 77bff8b3，取自 场景特效bot worktree，本 worktree 没有这个文件）。
  - 湖畔的 885 个实例按 `scene_r5h_slim_transforms.json` 的缩放换算成场景内的实际高度。

## 1. 比例基准件

| 基准 | 实测 | 来源 |
|---|---|---|
| **H = 女主身高 1.74 m**（主基准） | LOD0_G2_BODY 包围盒高 1.74 m | 运行时缩放 1（`WorldIntegrationBoot` 中 `girl.setScale(1,1,1)`）。`CharacterReference.provisionalCharacterScale 1.06` 标注了 doNotApply，不计入 |
| 门（副基准） | 灯塔门 `env_lighthouse_door` 高 2.39 m、宽 1.47 m，即 **1.37H** | 海岛 GLB |
| 椅子（副基准） | 阅读椅座面 0.38 m（0.22H），靠背 0.862 m（0.50H），宽 0.49 m | `FirstsliceFacts` seat anchor / chair_spec。`reading_chair.glb`（圆凳）高 0.37 m，与之一致 |
| 船凳 | seat_anchor 高 0.44 m（0.25H） | sailboat.glb |

**比例规则**（以 H 为单位，新物件以此为准）：

| 类别 | 区间 | 说明 |
|---|---|---|
| 门洞 | 1.2–1.4H（2.1–2.4 m） | 女主要能直立走过 |
| 座面 | 0.22–0.26H（0.38–0.45 m） | |
| 桌面、台面 | 0.40–0.45H | |
| 小屋、建筑主体 | 2–3H（3.5–5.2 m） | 按 REPORT“大物缩到主角 2–3 倍” |
| 地标 | ≤ 4H（≤ 7 m） | 灯塔、风车等单个视觉锚点 |
| 近景树 | 1.5–3H；远景树 ≤ 4H | |
| 草、花丛 | ≤ 0.3H（≤ 0.5 m） | 芦苇 ≤ 0.8H |
| 小道具 | ≥ 0.15H 才单独建模 | 更小的并进母件或用贴图表现 |

## 2. 三级细节表（近 / 中 / 远）

| 级别 | 适用对象 | 镜头距离 | 单件面数 | 贴图 | 细节程度 |
|---|---|---|---|---|---|
| **L1 近** | 女主；可交互件（木板入口、宝箱、阅读椅、帆船、热气球、风铃）；室内道具 | ≤ 8 m，或可点击 | 角色 ≤ 25k；交互件 300–1,500（上限 2,500） | 角色 1024（脸、裙），饰件 512；道具共用 256 palette，最大 512 | 有厚度和倒角；背面封闭并上色；二级形体（把手、钉、缝）可以建模 |
| **L2 中** | 建筑、船、桥、凉亭、近景树和棕榈、NPC 机器人 | 8–40 m | 建筑 400–1,500；地标 ≤ 3,000；NPC ≤ 5,000 | 共享 256 palette，最大 512 | 主形加门窗凹凸；小于 0.1 m 的件不建模；背面封闭 |
| **L3 远** | 草、花、石、远树、远山、云、天空 | > 40 m 或大量散布 | 散布单件 ≤ 200（草 ≤ 20）；整片远景 ≤ 3,500；天空和云 ≤ 2,500 | 128 或顶点色；共享 256 palette；天空最大 1024 | 只要剪影和色块 |

单区域可见面数预算（实测校准）：**≤ 90k 三角形**。实测海岛 81.5k，草原 89.5k，天空城 89.8k，湖畔 54.7k（885 个实例展开，含岸边泡沫 2.8k）。总包上限 24.6 MB（当前 20.3 MB）。

## 3. 实测校准（摘录）

### 同类物件跨区对比

| 类别 | 物件 | 面数 | 高度 | 级别 | 判定 |
|---|---|---|---|---|---|
| 小屋 | LK_house_A/B/C | 928–984 | 4.74–5.10 m（2.7–2.9H） | L2 | 合格（基准） |
| 小屋+地标 | env_lighthouse_ext（灯塔连小屋） | **7,764** | **9.08 m（5.2H）** | L2 地标 | 面数超 2.6 倍；高度超 4H |
| 凉亭 | LK_pavilion | 486 | 4.22 m（2.4H） | L2 | 合格 |
| 风车 | windmill_static_merged + sails | 380 | **13.4 m（7.7H）** | L2 地标 | 高度超标 |
| NPC | chr_robot_gardener_mesh | **16,308** | **6.68 m（3.8H）** | L2 | 面数超 3.3 倍；比例偏大 |
| 树 | LK_tree_round | 172 | 2.53–**7.06 m（≤4.1H）** | L3 | 最大缩放 2.69 偏大 |
| 树 | LK_tree_conifer | 58 | 2.17–**9.16 m（≤5.3H）** | L3 | 最大缩放 3.13 偏大 |
| 棕榈 | env_prop_palm_tall/lean/young | 610–768 | 6.07 m（3.5H）/ 4.0 / 2.4 | L2 | 面数是湖畔树的 4 倍（棕榈叶片多，可接受），高棕榈略超 3H |
| 草丛 | LK_grass_tuft | 9 | 0.29–**0.94 m（≤0.54H）** | L3 | 最大缩放 2.61 超 0.3H |
| 芦苇 | LK_reed_card | 2 | 1.29–**2.06 m（≤1.19H）** | L3 | 比女主还高，超 0.8H |
| 门 | 灯塔门 / 湖畔屋门 | — | 2.39 m（1.37H）/ **约 1.8 m（≈1.0H，按图测）** | L1/L2 | 湖畔屋门偏低，两区不一致 |
| 门 | 天空城 state_gate_before | 12 | **1.60 m（0.92H）** | L2 | 低于女主；如果要走过去就不一致 |
| 凳 | reading_chair.glb（圆凳） | **2,556** | 0.37 m | L1 | 0.37 m 的凳子用 2.5k 面，偏密 |
| 宝箱 | result_chest | **3,556** | 1.36 m | L1 | 超上限 2,500 |
| 帆船 | sailboat | 1,510 | 5.16 m（桅 2.5H） | L1 | 合格 |
| 热气球 | transport_balloon | 1,085 | 10.4 m | L1/L2 | 合格（载具，高度不受建筑规则约束） |

### 远景、地形与贴图

| 物件 | 面数 / 贴图 | 级别 | 判定 |
|---|---|---|---|
| meadow_far_hills | **11,602** | L3 | 超 3,500。湖畔同类 LK_far_hills 只有 3,106 |
| meadow_terrain | 12,800 + 1024² | L3 地形 | 是湖畔地形（3,284，256²）的 3.9 倍 |
| meadow_grass_instances ×5 | 41,050（草原总面数的 46%） | L3 | 单片草 ≤ 20 合格，但总量重。可做远处稀疏一档 |
| env_cloud_layer（海岛） | **7,914** | L3 天空 | 超 2,500 |
| env_sky_static_palette（天空城） | 24,696 | L2 合并件 | 合并件，需按单件复核 |
| env_sky_greattree_canopy | 10,480 | L2 | 超 3,000（地标树冠） |
| env_island_props_merged | 26,748 | L1/L2 合并件 | 合并件，需按单件复核 |
| meadow_sky_dome 贴图 | **4096×1024** | L3 | 超 1024 |
| transit_night_dome 贴图 | **2048×1024** | L3 | 超 1024 |
| meadow_terrain / meadow_river_bank 贴图 | 1024² | L3 | 超 512，可降一档 |
| 湖畔全部 48 件 | 256 palette | L2/L3 | 合格，一致 |
| 女主 | 1024（脸、裙）/ 512（围裙）/ 256（蝴蝶结） | L1 | 合格 |

### 结论（按优先级）

1. **比例**
   - 灯塔 5.2H、风车 7.7H、机器人 3.8H 超出“2–3H，地标 ≤ 4H”的规则。
   - 湖畔松树和圆树的最大缩放到 4–5H。
   - 草丛 0.54H、芦苇 1.19H 比例偏大。
   - 湖畔屋门约 1.0H，与灯塔门 1.37H 不一致。
   - 天空城门 0.92H。
   - 以上需美术决定改模型还是改实例缩放。湖畔的树、草、芦苇只需改 transforms，成本最低。
2. **面数**
   - 灯塔 7.8k 和机器人 16.3k 是同级物件的 3–8 倍，细节密度与湖畔小屋（约 0.9k）明显不一致。
   - 草原远山和地形是湖畔的 4 倍。
   - 海岛云层 7.9k。
3. **贴图**：两张天空贴图（4096×1024、2048×1024）超 L3 上限；草原地形和河岸 1024 可以降到 512。
4. 本次只出表，不改任何资产（不改模型、不改 transforms）。

## 4. 复测方法

```
B=/workspace/tools/blender-4.5.3-linux-x64/blender
$B -b --factory-startup -P tools/scene-fx/blender_lod_audit.py -- out.json <glb...>
QF_ISLAND_GLB=<combined_visual_m.glb> $B -b --factory-startup -P tools/scene-fx/blender_lod_scale_lineup.py -- lineup_raw.png lineup_layout.json
QF_LINEUP_N=9 QF_LINEUP_RX=2400 ... -- lineup_near_raw.png lineup_near_layout.json   # 近景放大
python3 tools/scene-fx/annotate_lod_lineup.py <dir>
```
