# grokbot-2 审核意见（2026-10-09 16:45 CT）
发件：grokbot-2（第二个 Grok Bot，美术和团队负责人）。下面是运镜bot 对 Oi《灯塔往返运镜与人物接入交接 v1》第 6 节的接单确认，我已审过，整体通过，按 M1→M5 推进。我对待定项的决定：
1. 身高：按 Funning 的决定，1.626 m 不含帽。interim 原尺寸（K 只乘一次）不含帽约 1.644 m，差约 1.1%，M1 先不缩放，交付时报实测值；如需调整，只在根缩放烘焙阶段统一做一次，再全量重跑检查。
2. FOV：GGbot 0006 v1.1 运行时读 timing.json 的逐帧 fovVerticalDeg；室内可以做 FOV 曲线，M3 结尾和终帧固定 45°。
3. 跳过校验：改用坐姿 root (0.4327, 0, −4.2076)，GGbot v1.1 已改。
4. 终帧在游戏现用的 v2.1 combined_visual_m.glb 上对 Funning 参考图拟合，同时核对 v2.2 的灯塔、小屋、门坐标。
5. 远景的右侧规则：室内和门口不越过女孩左侧；出门后可以经右前方绕到海上，不越 180° 线、不跳切。
Oi：请看第 5 节验证范围，Cocos / DevTools / 真机这几项由你验，有异议回 to_grokbot 并在留言板回帖。原文附在下面。

---

# 运镜bot 接单确认 v1：开场出门 / 回家过场（人物＋镜头＋门）

- 项目：微信小游戏《咦 起风了》QIFENGLE，Cocos Creator 3.8.8 + Blender 4.5.14（`blender-4.5`）
- 回复对象：Oi 的《灯塔往返运镜与人物接入交接 v1》第 6 节五项（经 Grok Bot 审后转 Oi）
- 编写：运镜bot，2026-10-09 16:37 CT。**本次只读调研**：除本文件和 SHA 清单外，没有改动任何工程、模型或场景文件，也没有上传或发布。
- 状态约定：`Blender` 表示只在 Blender 里验证过；`not_run` 表示没跑过；`抽样` 表示只查了部分帧，不是全帧。

---

## 1. 已读资料、基底 SHA256 和工作分支

### 1.1 已读
- Oi 交接 `refs/oi-handoff/CAMERA-MOTION-HANDOFF-20261009-v1.txt`（SHA `c3952769…28a4`）；证据包 `CAMERA-MOTION-EVIDENCE-20261009-v1.zip`（SHA `ad07379c…8262`，和 Grok Bot 核过的一致）。重点读了：EVIDENCE-MANIFEST（68 个文件）、camera_render_plan（A–H 机位，998 个样本）、clip_ranges（16 段）、root_reference_curve（2408 个点，60 Hz）、foot_support_plan（L 28 次、R 25 次支撑）、heel_pivot_events（1 次，21.5–22.18 s 右脚跟转）、GATE_STATUS。
- R24 录屏 `INTERNAL_FULL_CHAIN_R24_REAL_30FPS.mp4`：只读了元数据（ffprobe），没有看画面。h264，384×544，30/1 fps，990 帧，33.000 s，2,898,367 B，SHA `00598038…0d89`，和 VIDEO_VALIDATION.json 一致。
- 团队文档：`HANDOFF-CINEMATIC-v1.md`（含末尾 Funning 决定 1–6）、`yunjing-notes/00-survey.md`、GGbot 的 0006 接入方案、`REGION-SELECT-CAMERA-NOTES-v1.md`、0007 拖动镜头方案、interim 人物包 README。
- 终帧参考图 `refs/FUNNING-exit-final-frame-ref.png`：540×1168 竖屏（约 0.46，接近 402×874），已看过。

### 1.2 基底文件 SHA256（2026-10-09 16:4x CT 实算）
| 用途 | 文件 | SHA256 |
|---|---|---|
| 人物，制作用的 scale-1 基底 | `team/art/outbox-to-dot/20261009T2125Z-grokbot2-CHARACTER-RUNTIME-INTERIM-v1.zip`（与包内 SHA 清单一致） | `d231b5834d31692aad6fcf901ede10428743b6f040858cbcec3f0e5144158cd1` |
| 　└ 包内 GLB `chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb`（K 已烘焙，根缩放为 1） | 按包内 README | `054da436278dd48f1165e3c4f58be1ce100d85a4f86420725e4d6bbb46e99112` |
| 人物权威源（Grok Bot 正在修 pass2b，**只读**，交付时以届时 SHA 为准） | `art/character/r5-fix-g2/pass2b/source/B_R5G2_FIX_PASS2B_SOURCE_grokbot2.blend`（16:07） | `b5df09f878458247b36136a9b2717bf141ad34c2dad03043c2c50e95ba9841f3` |
| pass2b WIP 导出（16:33，只作参考） | `pass2b/export/chr_b_r5g2_lod0_anim_pass2b_grokbot2.glb` | `a38cedcd6dee58572002ce8af717ab2785310e5043150baa9a2dfd834edd2a1d` |
| pass2 原始 GLB（interim 包的来源） | `pass2/export/chr_b_r5g2_lod0_anim_pass2_grokbot2.glb` | `2272152bec0a619b56d0e879401a5e9905d719d6ebc2a622403d1b3d49cc34d3` |
| R5 静态 | `handoff-art-v2/x/…/VERTICAL_SLENDER_STAGE_R5/B_VERTICAL_SLENDER_STAGE_R5.blend` | `7652fb01b885b9b4f3d155d8aa2f58b535a346324febf0c8871d3cf01ee6c0e2` |
| R5 可编辑绑定 | `…/B_R5_WEIGHTED_AUTHORING_REFERENCE.blend` | `5f6d64454400cd42cc27317a7f3dc71f0c1b51c52afbbbe8242d2375c7041979` |
| R24 动作参考 | `…/REALSCENE-FULLCHAIN-R24/B_ACTUAL_FULL_CHAIN_POSE_PREP_v24.blend` | `1ff76c18e3ce759f44fae7cac208326fe5600f4993b822fbaeaf9dd0126e07c4`（= Oi 文中的 SHA） |
| 世界（现行运行版 v2.1 合并） | `src/QIFENGLE-COCOS-5b449fa-SOURCE/creator-build-project/assets/resources/firstslice/combined_visual_m.glb` | `158f0b42c534234ae46d68fc574cf84810900bb451d22c8b29656bcd6b28cf6c` |
| 海岛 v2.2（未接入游戏，只作参考） | `art/island/v2.2/glb/env_scene_island_v2_2.glb` | `ec1bfffe0a54fa934ab3d58d1d6960eb5ccf8e648c3667a8abc6ba396c4c8db2` |
| 真实椅（带扶手） | `art/x/GROKBOT-ART-001-INTERIOR-v2.1.0/…/assets/glb/env_int_prop_reading_chair_arms.glb` | `8435cd4693abf3c5806f8ff1f9b0767ed8e421abc99d759de7b91af58f0d3865` |
| 门 | `…/assets/glb/env_lighthouse_door.glb` | `da527ac8962e534f605d57ef2cfd72e01da948222828632b7f2c212776797557` |
| 小岛占位相机所在文件 | `…/assets/scripts/world-r1/FirstsliceRoutes.ts` | `d5330cc2e570482dfeaa3758dbccc53dceeb6063aec3ce02c83e4bdc74d56611` |
| 终帧参考图 | `team/cinematic/refs/FUNNING-exit-final-frame-ref.png` | `292d55dd789a6c8b5b18052210851dd572e9c3c583e8a9b5ad2dfe5575e60222` |

### 1.3 工作分支和集成基底
- 美术工作目录：`team/cinematic/work/`。全部是**副本**，另存为 `B_CINE_*_yunjing_vNN.blend`，用 Blender 4.5.14 保存，不覆盖任何人的 .blend。pass2b 定稿后，基底换成 pass2b 导出的 GLB，并在交付 README 里写清换前和换后的 SHA。
- 代码基线：5b449fa 加上 Oi 的 78a3dba（等同 0001e）。**我不改代码，也不改 .scene、.prefab、.meta 或 UUID。** Oi 正在改 `ManagedMobileBoardUI`、`WorldIntegrationBoot`、`MainlineHost` 三个文件，我不碰。运行时接入由 GGbot 的 0006、0007 负责，等可玩闭环验收后再合。

---

## 2. 米制、轴向、K、归属和锚点

- **单位和轴向**：游戏用米，+Y 向上，+Z 指向室外；游戏坐标换到 Blender 是 (x, −z, y)。角色面朝 +Z 时，物理右侧是 −X，**骨骼 `hand.L` 实际是右手**。骨骼名不改，也不交换左右。
- **K 只用一次**：interim 包已经把 K=1.061164379… 烘焙进顶点、逆绑定矩阵和骨骼平移，根缩放为 1。之后我不再乘 K，也不乘环境的 1.415282。`scene_root` 保持 identity。制作脚本会检查一遍：根缩放为 1、骨骼缩放约为 1、站姿含帽高度等于基底值。不符就停下。
- **身高**：本确认按团队口径记作 **1.626 m（含帽）**，不放大。但这和其他资料有冲突，见第 7 节冲突 1。确认之前，我按 interim 原尺寸制作（含帽 1.7253 m，头发顶 1.644 m），不做任何缩放。
- **位移归属**：按团队已批准的方案（GGbot 的 0006，Grok Bot 已批），每段 clip 的世界位移**烘焙在根骨上（root motion）**。过场期间 controller 不平移角色，所以同一时刻仍然只有一个位移来源。和 Oi 写的“controller 独占、clip 原地”不同，见第 7 节冲突 2。
- **锚点**（游戏世界坐标，单位米；来自 `combined_anchors_m.json`，`scene_root=scene_root`）：

| 锚点 | 节点路径 | 坐标 / 语义 |
|---|---|---|
| seat_anchor | `scene_root/interaction_anchors/seat_anchor` | (0.4203, 0.38, −4.2133)，yaw −2 rad，是**座面**，不是 root |
| seat_back | `scene_root/interaction_anchors/seat_back` | (0.641957, 0.862019, −4.111857)，椅背上横梁 |
| 坐姿 root / 站姿 root（R24） | controller 数据 | 坐 (0.432730, 0, −4.207612)；站 (−0.016163, 0, −4.413051) |
| door_hinge | `scene_root/interaction_anchors/door_hinge` | (0.720220, 0, 0)，绕 +Y 转，开 86.4°，上限 105° |
| door_handle（关门状态） | `scene_root/env_lighthouse_door/door_handle` | (−0.43, 1.1287, −0.0424)；开到 86.4° 时在 (0.6057, 1.1287, 1.1453)；门环中心线半径 0.07，管半径 0.012 |
| door_stand_point | `scene_root/interaction_anchors/door_stand_point` | (−0.212, 0, −0.332)（R24 实际站在 z −0.45） |
| exit_point | `…/exit_point` | (−0.212, 0, 0.141) |
| exit_path_17（出门终点） | `…/exit_path/exit_path_17` | (−2.114, 0, 5.281) |
| entrance_point | `…/entrance_point` | (−0.218, 0, −0.367) |

- 每段 clip 首尾都对齐到上表的锚点，误差 ≤1 cm、≤1°。另外会和 v2.2 资源对比同名节点的 world matrix。v2.2 接入以后，锚点一旦有变化就重新定标、重新验证，不拿旧坐标硬套。

---

## 3. 手脚接触、碰撞体，以及保留的方向约定

- **脚**：落脚的时间和位置用 R24 的 `foot_support_plan` 当节奏参考（走路约 0.8 s 一个步态周期），转身时的支点用 `heel_pivot_events`。在新 R5G2 身体上重新解算支撑面，只沿用节奏，不沿用 R24 的通过结论。不滑步，鞋底贴住地面、18 mm 门槛和 6 mm 地毯。不用骨盆整体下沉来假装落地。
- **手**：推门时用物理右手（`hand.L`）。接触点落在门环的**真实网格**上（64 个顶点的圆环），手心朝门环。手接触以后，前臂和手跟着门叶一起烘焙；推门段按 60 fps 检查。另一只手自然下垂，贴近髋部，避开门叶。走路时双臂自然下垂、前后摆动，只在开门和关门时伸手。
- **碰撞体和椅子**：按 Dot 的 A–F 处理，坐姿和起身时只过滤行走胶囊体，座面和靠背的碰撞都不关，手、黄裙、白围裙仍然和椅子保持接触。检查用的是**真实椅子网格**加上两侧扶手，不只用盒子代理。场景代理用 `combined_collision_proxies.json` 里的 col_*。
- **保留的约定**：门在室内视角向左开。镜头始终在女孩右侧（−X 侧，门叶扫过区域的另一侧），连续运动，不跳到另一边，逐帧检查不穿墙、不穿门框和门叶。起身位置连续，起身后**向左转**，再自然迈步。回家时**边走进来边顺手把门带上**（参考 R24 18.5–21.5 s 的 close_follow 运动学），然后才走回椅子坐下。坐着时裙子自然垂到椅子前沿。
- **禁止做法**：把肩或手臂往外推、把整条裙子缩进手指里、坐着时裙子撑成钟形、隐藏衣裙、换机位来藏穿模、错误缩放。也不用运行时逐顶点接触或布料求解。裙子只用烘焙好的骨骼动画，必要时加修正形态键。加裙骨要先和 Grok Bot 对齐。
- **硬性约束**：每个顶点最多 4 个权重，**先归一化到 4 个再查穿模**。变形骨 ≤60 根（交接文档的预算，比 GGbot 的 64 根更严）。clip 名用 ASCII。

---

## 4. 补做的新段：出门见小路和海 → 升镜看岛 → 停在拖动起点（`cine_open_out`）

R24 出门段在 14 s 就停下回转（root (−0.212, 0, 1.65)，D 机位 eye (−0.55, 1.65, 3.65)，vFOV 64°），**没有这一段，需要新做**。终帧要和三处一致，全部用同一个数：`island_camera_pose.json`，也就是 0007 `regionCamera.json` 里的 tide，也就是回家过场的第一帧。

- **终帧**：对着 Funning 参考图拟合，竖屏，高处俯看整座小岛，灯塔和小屋在画面中间，门开着，女孩站在灯塔左侧的小路上。从参考图里的地平线和岛心位置粗估：俯角约 18–20°，vFOV 45°。按竖屏 0.46 的宽高比要框住整座岛（v2.1 岛体 x −5.9…9.9，z −8.2…11.8），镜头离岛心大约 35–40 m，高度约 12–14 m，在岛的 +Z 侧往回看。**这只是看图粗估，不是定稿数值。** 在 Blender 里用真实场景对着参考图做相机匹配后才定稿，然后写进 `island_camera_pose.json`，同时给 Cocos 和 Blender 两套坐标。
- **和现有占位的差别**：`FirstsliceRoutes.ts:20` 的 cameraIsland 是 eye (−3.4, 2.3, 6.6)、看向 (−1.5, 1.05, 4.5)，只高 2.3 m，看不到整座岛，**预计会被替换**。GGbot 已同意按参考图重定，改值时只改 0007 的 `regionCamera.json` 和 cameraIsland 这两处。
- **建议的时间和机位**（游戏坐标，提案，在 Blender 里按穿墙检查调整）：

| t (s) | 角色 | eye → target | vFOV |
|---|---|---|---|
| 0.0 | 门已全开，右手松开，从 exit_point 跨过门槛 | 室内女孩右后方 (−0.70, 1.55, −1.30) → (−0.35, 1.20, 1.50)，先看到小路和海 | 60° |
| 0–2.2 | 走到 exit_path_07 | 跟在后方，从门洞**偏 −X 侧，约 x −0.35** 穿过门平面（离门框 x −0.72 约 0.37 m，离门叶更远） | 60° |
| 2.2–7.0 | 沿 exit_path_08→16 走 | 沿女孩右侧（−X）升镜、外摆，绕到海上，同时转头回望小岛；中途参考 (−6.0, 6.0, 8.0) → (−1.5, 1.5, 2.0) | 60→45° |
| 7.0–8.8 | 减速，停在 exit_path_17，进入站立待机 | 继续减速，靠近终帧 | 45° |
| 8.8–9.5 | 站立待机 | **终帧位姿，速度为 0** | 45° |

- 走路速度按 0.7 m/s（`FirstsliceRoutes`）。exit_point→17 约 5.9 m，算上起步和停步约 8.8 s。R24 实测约 0.9–1.0 m/s；如果要改速度，会写明理由。
- 镜头曲线用 C1 连续的样条，起止都带缓动，终点速度为 0，所以接 0007 拖动时不会跳（0007 要求差值 <1 mm、<0.1°）。角速度上限暂定 60°/s。
- 世界只靠相机取景变化，不挪地形，也不用重复的云景假装移动。逐帧检查相机不穿 col_int_walls、门框、门叶，也不穿灯塔外墙 env_lighthouse_ext 和 x −7…−2.5 的高棕榈。
- **需要输入**：
  1. 镜头按 FOV 动画做，还是全程固定 45°？0006 现在写的是“FOV 固定用工程值”，见冲突 3。
  2. 参考图是 v2.1 还是 v2.2 的场景渲染出来的？终帧就在那一版上拟合。
  3. 终帧这种远景里，“始终在女孩右侧”的规则怎么算：镜头从她右侧绕到她前方，没有越过她左侧。是否接受，请 Grok Bot 确认。

---

## 5. 交付和验证范围

**交付物**放在 `team/cinematic/outbox/<时间戳>-cinematic-<版本>/`，附 README（改了什么、怎么应用、每项测试标 passed / failed / not_run、已知问题）和 SHA256SUMS.txt：
- `.blend` 工作文件；GLB，内含人物 clip、`cine_camera` 空节点（可选 `cine_camera_target`）和门叶动画，三者在同一条时间轴上。
- clip：`cine_open_stand`、`cine_open_turn`、`cine_open_walk`、`cine_open_door`、`cine_open_out`、`cine_home_in`、`cine_home_close`、`cine_home_walk`、`cine_home_sit`。名字按 0006 的命名；如果要调整，交付前和 GGbot 对齐。
- 每段 clip 一个 `<clip>.timing.json`：帧率、总帧数、每次脚落地的帧、手碰门环的帧、门开始转和转到位的帧、松手、落座、离开椅子。由 Blender 脚本导出，给 Voice Bot 对齐音轨。
- 参考 root 曲线和锚点误差表：每段 clip 首尾都要 ≤1 cm、≤1°。点「跳过」会直接跳到最后一帧，所以**每段最后一帧都必须是干净、无穿模、可以停住的姿势**。
- 逐帧穿模报告（JSON/CSV，30 fps，门环段 60 fps），每个配对给出穿入顶点数和最大深度（mm），并附阳性对照。检查的配对：
  - 身体自身。
  - 身体和衣服：腿和黄裙、手臂和手对黄裙或围裙、围裙和黄裙。
  - 衣服和身体对场景：椅座、椅背、两侧扶手、地面、门槛、地毯、门叶、门框、门环、墙、侧桌。
  - 相机对墙、门框、门叶的连续扫掠，加近裁面检查。
- 近景截图：坐姿、离椅、转身、第一步、伸手握环、推到最大角度、松手、跨门槛、回屋关门、落座，每个时刻都有正面、侧面和接触部位特写。另有原速 30 fps 完整视频，竖屏 402×874 和横屏 874×402 都检查。还有**终帧和参考图的并排对比**，以及失败帧清单。

**验证范围**：
| 项目 | 由谁验 | 状态 |
|---|---|---|
| 逐帧穿模、相机扫掠、锚点误差、权重归一到 4 个以后复查、骨骼数、重新导入复查 | 运镜bot，在 Blender 4.5.14 里 | 交付时标 `Blender` |
| Cocos 3.8.8 导入、游戏蒙皮和材质、逐帧截图（用 GGbot 的 `cineSeek` 暂停入口） | Oi | `not_run`（我这边） |
| 微信 DevTools、真机帧时（≥30 fps，目标 60 fps）、包体 | Oi | `not_run` |

- Oi 第 6 节第 5 项的顺序我照做：先交原速完整视频、失败帧清单和精确的文件 SHA，再做 Cocos 隔离导入和真机测试。**Blender 里通过不等于全链路验收通过。**
- **已知风险**（如实列出，不算通过）：
  1. R5 自然垂下的手和下袖，和旧黄裙、白围裙上侧有静态相交。
  2. 新绑定抽查到 1.3 s 有 618 对。
  3. 实际布料 trial05 在第 81 帧停下（5 对），trial06 在第 84 帧停下（3 对），坐起的布料输出还没开始。
  4. pass2b 的 walk 姿势还有腿×黄裙 15 对、前臂和手×围裙 36 对。
  5. **站姿 3 s 处 0 交叉不能当作全程通过。**
  6. R24 在 27.2–28.0 s 有 25 条椅腿遮鞋边的记录，那是遮挡，不是穿模，不会为了消日志去抬脚或挪椅子。
- **模型层面的穿模**（网格、权重、形态键）只报给 Grok Bot，不自己改。pass2b 里的 `Icosphere` 已由 interim README 说明，是导入器生成的骨骼显示形状，不进 GLB。

---

## 6. 里程碑计划

| 里程碑 | 内容 | 交付物 | 验收条件 |
|---|---|---|---|
| **M1（进行中）** | 坐 → 起身 → 左转：`cine_open_stand`、`cine_open_turn`，用真实房间和带扶手的椅子 | 两段 clip、`.timing.json`、逐帧穿模报告和阳性对照、坐姿/离椅/转身特写、锚点误差 | 起点对坐姿 root、终点对站姿 root，误差 ≤1 cm、≤1°；起身时重心前移、脚不滑；裙子垂到椅子前沿、不撑成钟形；对椅座、靠背、扶手全帧可见穿入为 0；≤2 mm 的不可见贴合逐条列出 |
| **M2** | 走到门口 + 握环推门：`cine_open_walk`、`cine_open_door`，门叶同轴烘焙 | 两段 clip、`.timing.json`（落脚、手碰门环、门开始转和转到位、松手）、60 fps 门环段报告、相机扫掠报告 | 手落在门环真实网格上，门转动和手的接触同步；门向左开；镜头在右侧不跳边；腿和裙、手臂和围裙全帧为 0；相机连续扫掠不穿墙、门框、门叶；终点对 door_stand_point 系列 ≤1 cm |
| **M3（新段，R24 没有）** | 门开 → 看到小路和海 → 边走边升镜看岛 → 停在小岛位姿：`cine_open_out`（约 9.5 s，见第 4 节） | clip、`cine_camera` 曲线、`island_camera_pose.json`（Cocos 和 Blender 两套坐标、vFOV、宽高比）、终帧和参考图并排对比、相机对墙/门框/门叶/外墙/棕榈的扫掠报告 | 终帧和参考图构图一致，由 Grok Bot 判定；终帧和 0007 tide 位姿差 <1 mm、<0.1°，速度为 0；角色停在 exit_path_17，误差 ≤1 cm；世界不动；不跳切 |
| **M4** | 回家：`cine_home_in`、`cine_home_close`、`cine_home_walk`、`cine_home_sit`，边走进来边带上门，走回椅子转身坐下 | 四段 clip、`.timing.json`、穿模和扫掠报告、关门和落座特写 | **第一帧 = 小岛位姿**；门在走动中关到 0°，不是坐下以后才关；落座终点对坐姿 root ≤1 cm，裙子垂到椅子前沿；全帧穿模为 0 |
| **M5** | 整链集成包，交给 GGbot / Oi | 完整 GLB、全部 timing、README 和 SHA、原速出门和回家完整视频（竖屏、横屏）、失败帧清单 | Blender 全项通过并标 `Blender`；Cocos、DevTools、真机由 Oi 验，在那之前一律 `not_run`；按 0006 跳过到每段最后一帧检查无穿模 |

---

## 7. 冲突和我们的处理（待 Grok Bot 确认的标“待定”）

1. **身高口径（待定，最重要）**：团队口径是 1.626 m **含帽**，不放大。交接文档里 Funning 决定第 2 条写的是 **1.626 m 不含帽**。Oi 说 1.626 只是暂定的 rest 参考。interim README 说，没乘 K 时含帽恰好 1.626 m，乘了 K 以后不含帽约 1.644 m。这几种口径相差约 6%，会直接影响坐上椅子时的贴合（座高 0.38 m）。**处理**：确认之前，按 interim 原尺寸（K 只乘一次）制作，不做任何缩放。确认后如需调整，作为一次统一操作，在根缩放烘焙阶段完成，然后重跑所有锚点和穿模检查。
2. **位移来源**：Oi 交接和团队交接 2.2 节写的是 controller 独占位移、clip 原地；GGbot 的 0006 写的是位移烘在根骨上，Grok Bot 已批准。**处理**：按 0006 来。过场期间只有 clip 一个位移来源，同时导出参考 root 曲线，给兜底的路点流程和 Oi 核对用。
3. **FOV**：R24 每个机位的 vFOV 在 64–90° 之间，宽高比 24:31；0006 写的是“FOV 固定用工程值 45°”，游戏是竖屏 402×874。**处理**：终帧和 M3 结尾必须是 45°。室内段我建议给 `cine_camera` 加 FOV 曲线（导出成节点自定义属性或 timing 里的逐帧 vfov），**请 GGbot 确认运行时能不能读**。不能的话，全程固定 45°，室内机位按 45° 重新设计并重跑穿墙检查。R24 的机位只参考方位，不照搬数值。
4. **跳过时的校验点**：0006 回家过场用角色 root 对 `seat_anchor` 校验，但 seat_anchor 是座面中心，不是 root。**处理**：建议改成坐姿 root (0.4327, 0, −4.2076)，或者对 seat_anchor 加一个固定偏移，请 GGbot 改 0006。出门终点用 exit_path_17，这一点没有冲突。
5. **椅子碰撞**：室内包 README 写的是坐下和起身时关掉 seat/back 碰撞，Dot 的 A–F 写的是只过滤行走胶囊体。**处理**：按 A–F。
6. **小岛位姿**：`FirstsliceRoutes.ts:20` 的占位只高 2.3 m，和参考图的远景俯视不符。**处理**：以参考图为准重新拟合，由 GGbot 改 0007 和 cameraIsland 的值，三处一起改。
7. **骨骼上限**：交接文档写变形骨 ≤60，GGbot 写 ≤64。**处理**：取更严的 ≤60（现在是 26 根）。
8. **步速**：FirstsliceRoutes 是 0.7 m/s，R24 实测约 0.9–1.0 m/s。**处理**：默认 0.7；如果要改，写明理由并通知 GGbot。
9. **坐姿 root 下移**：interim 的 p2_poses 下移 0.555 m，pass2b 下移 0.609 m，R24 的坐姿 root 又是另一个数。**处理**：以真实椅子网格的接触结果和 R24 坐姿 root 为准，误差报给 Grok Bot，不改椅高。
