# 运镜 bot 交接说明 v1：开场出门 / 回屋 人物动作＋运镜＋穿模

- 项目：微信小游戏《咦 起风了》（QIFENGLE），Cocos Creator 3.8.8
- 交接人：Grok Bot（美术负责人兼团队负责人，验收方）
- 接收人：运镜 bot（新成员，专门负责本任务）
- 编写时间：2026-10-09 16:20 CT
- 本目录：`/workspace/wechat-game/team/cinematic/`（参考资料在 `refs/`，交付放 `outbox/`）
- 说明：本文只做资料整理，不包含解决方案。下面写的数字都是从文件里实际读出来的；标“待确认”的不要自己猜。

---

## 0. 一句话任务

做出两段**能在 Cocos 3.8.8 / 微信里实际播放**的演出，每一帧都不能有可见穿模：

1. **出门**：女孩坐在灯塔房间的阅读椅上 → 重心前移、起身 → 向左转 → 正常步幅走到门口 → 伸手握住门环、推门（门向画面左开）→ 走出门 → 镜头转出去，升起来看到海岛（路、海，回望小岛）→ 交给海岛玩法镜头。
2. **回屋**：从海岛走回门口 → 进门 → **进门时顺手关门**（不能等坐下才自动关）→ 走回椅子 → 转身坐下 → 回到坐姿待机，镜头回到室内。

这个问题已经卡了好几天。之前另一个模型（经 ChatGPT / Oi 那边）反复修，都没修好，详见第 4 节。Funning 的要求是：**用最强的方法认真解决，不能再拿局部通过来顶替整体通过。**

---

## 1. Funning 的原始需求（10 月 9 日）

> 游戏一开始人物在房间里坐着；开始游戏前要让人物推开门，再通过运镜转回来看到小岛。现在卡在穿模上，人物走动过程中也卡在穿模上，已经卡了好几天。需要做好：人物从房间里起身、转身、走向门口、推开房门，再通过运镜看到小岛。这只是出门，回来的也需要运镜。

GDD 和迁移方案里的硬性要求（原文在 `refs/docs/GDD_v1_1.md` 第 6 节、`refs/docs/Cocos迁移执行方案_v2.md`、`refs/drive/需求状态矩阵_v1_1.md` 的 M01–M07、V01–V06、K01–K05）：

- 稳稳坐在**有靠背、有扶手**的椅子上，臀、腿、脚都有支撑，不能悬空半蹲（M01）。
- 起身 → 向左转 → 自然往前走，重心、步点和根位移连续（M02）。
- 不原地踏步、不瞬移、首步不能过大、不突然加速、不整段慢放（M03）。
- 根节点不能上下跳得像下台阶（M04）。门口有 18 mm 门槛、地上有 6 mm 地毯，不准用整体骨盆下沉来假装落地。
- 走路时手臂自然下垂、前后摆；**只在开门时才伸手**（M05）。
- 回来进门时顺手关门（M06）。
- 椅子的位置和朝向在出门、回屋两次之间保持一致，裙、手、门之间不穿模（M07）。
- 门向画面左开，相机走角色右侧（V01）。注意：“左开”是以站在屋里看门外为参照，从外面看方向反过来属于正常。
- 相机移动时世界保持稳定：岛、海、云不脱节、不复制、不拉伸（V02）。
- 出门后升镜，能看到路和海，并回望小岛（V03）。
- 回屋时室内完整，不用贴图冒充室内的纵深（V04）。
- 保留“固定视角”和“运镜”两条体验线（V05）。两条线用同一套动作输入，速度和流程一致。
- 黄裙和白围裙是两层：白围裙下面两个角能轻轻离开黄裙、随风摆，再回落；黄裙更重（K03/K04）。
- 不准用撑开手臂、把衣服整体放大、换机位、删掉被挡住的面、错位缩放这类办法来藏穿模（K01/K02）。

---

## 2. 验收标准（我按这个验收，少一条都不算通过）

### 2.1 穿模（最重要）
1. 出门全程（坐 → 起 → 转 → 走 → 握门环 → 推门 → 出门 → 镜头展开到岛）和回屋全程（走回 → 进门 → 关门 → 走到椅子 → 转身 → 坐下 → 坐姿待机），**每一帧都没有可见穿模**。要检查的配对至少有这些：
   - 身体自身：手和腿、手和躯干、前臂和躯干、左腿和右腿、头发和躯干/手臂
   - 身体和衣服：腿穿出黄裙、手臂或手陷进黄裙或围裙、围裙陷进黄裙
   - 角色和场景：椅座、椅背、**两侧扶手**、地面、门槛、地毯、门扇、门框、门环、墙、侧桌
2. **逐帧干涉检查**：按 30 fps 输出每一帧（门环接触那一段建议用 60 fps），每一帧给出各配对的穿入顶点数和最大穿入深度（mm），做成表格（JSON/CSV）。另外要有阳性对照，证明检测程序确实能查出穿模（参考 pass2 用的 legL×legR_ctrl = 300 的做法）。
3. **近景截图**：至少覆盖这些时刻：坐姿、起身离椅、转身、迈第一步、伸手握环、推门最大角度、松手、跨门槛、回屋关门、落座。每个时刻都拍正面、侧面和贴近接触部位的特写。另外要给原速 30 fps 的完整视频，固定视角和运镜两条线各一条。
4. 判定阈值：可见穿入为 0。如果有 ≤2 mm、相机看不到的贴合，要在报告里逐条列出并说明理由，由我决定是否接受。**“几何上 0 穿模，但看起来很怪”不算通过。**
5. 不能只看 Blender：要在 Cocos 3.8.8 实际导入，用游戏的蒙皮（每个顶点最多 4 个权重）、游戏材质和游戏相机再截一遍。Blender 里好看不代表游戏里好看。

### 2.2 动作
- 起身要有重心前移，脚底有支撑，不滑步。
- 转身方向向左。起身后朝向从椅子朝向 yaw −2 rad 转向门。
- 步速和 controller 的速度一致，`FirstsliceRoutes.ts` 里是 speed = 0.7 m/s。如果要改，得说明理由。
- 手到门环的时间和门轴转动要用同步事件对上，手的接触点要落在门环的真实网格上（门环是 64 个顶点的圆环，不是锚点所在的中心线）。
- **root motion 只能有一个来源**：controller 独占世界位移，clip 必须是原地动作。另外交一条参考 root 曲线，加上事件时间戳：脚落地、手碰到门环、开始开门 / 门全开、松手、关门、落座、起身离开椅子的时刻。

### 2.3 镜头
- 相机全程不穿墙、不穿门扇、不穿门框，不能过近把身体切掉，也不能长时间被门挡住。要用碰撞代理做**连续扫掠**检查（swept），不能只抽样几个点（现有检查只抽样，最小余量 0.127 m，见 4.3）。
- 运镜线上相机走在角色的**解剖学右侧**，并且在门扇扫过区域的另一侧。
- 出门升镜的结尾，镜头要平滑衔接到海岛的玩法镜头，不能跳切。
- 回屋时能看到完整的室内。
- 画面比例：竖屏 402×874（DPR 3）和横屏 874×402 都要检查。

### 2.4 工程与包体
- 能在 Cocos 3.8.8 里运行；要过 Oi 那边的 WeChat DevTools 测试。
- **主包 ≤ 4 MB**（现在大约 1.82 MB，余量不多）。角色和动作放分包或远程包，按 GGbot 的命名规范是 `assets/bundles/chr_girl/`，见 `team/ggbot/ASSET-LAYOUT-AND-NAMING-v1.md`。
- 移动端预算（暂定，最终以真机为准）：角色 LOD0 ≤ 25k 三角形，变形骨骼 ≤ 60 根，每个顶点 ≤ 4 个权重。**不准在运行时做逐顶点 CPU 布料或碰撞求解**，旧方案就死在这里，见第 4 节。

---

## 3. 现有资料与文件路径

### 3.1 Cocos 工程（当前运行基线 5b449fa）
工程根目录：`/workspace/wechat-game/src/QIFENGLE-COCOS-5b449fa-SOURCE/creator-build-project/`

| 文件 | 作用 | 现状 / 已知问题 |
|---|---|---|
| `assets/scenes/WorldR5Integration.scene` | 当前主场景，挂着 WorldIntegrationBoot | 场景相机：透视，**fov 45（竖直方向）**，near 0.05，far 1000 |
| `assets/scripts/WorldIntegrationBoot.ts` | 启动脚本；内含 `FlowReferenceStandin` | **场景里没有真实角色**，只有一个紫色几何标记。stand/sit 只是 3 秒的定时瞬移，turn 是 1.5 秒的线性旋转，walk 沿路径做线性插值 |
| `assets/scripts/world-r1/WorldFlowCore.ts` | 出门 / 回屋状态机 | 状态有：home → standing → turning-out → walking-out → opening-door → crossing-out → island；回程是 walking-home → crossing-in → closing-door → walking-to-seat → sitting。运镜（motion）模式下相机和走路同步插值。**回屋顺序是先走进门、停下、再关门、再走向椅子，和 M06“顺手关门”不一致** |
| `assets/scripts/world-r1/FirstsliceRoutes.ts` | 路线和相机位姿 | cameraHome 位置 (−1.1, 1.8, −2.9)，看向 (0.35, 0.85, −4.1)。cameraToDoor 沿路线跟随：偏后 0.26 m、偏侧 0.32 m、高 1.55 m，看向前方 0.7 m 处、高 1.1 m 的点。cameraOutside 位置 (−0.58, 1.65, 1.6)，看向 (−0.2, 1.1, 2.6)。**cameraIsland 位置 (−3.4, 2.3, 6.6)，看向 (−1.5, 1.05, 4.5)**。speed 0.7，openDeg 86.4 |
| `assets/scripts/world-r1/WorldFlowComponent.ts` | 世界层：门动画、相机插值（setWorldPosition + lookAt） | 相机在位姿之间做线性插值，没有缓动，也没有避障 |
| `assets/scripts/world-r1/CharacterReference.ts` | 坐 / 站参考坐标 | seatedRoot (0.433, 0, −4.208)，standingRoot (−0.016, 0, −4.413)，walkEndRoot (−0.092, 0, −2.885)，seatYaw −2 rad，standSeconds 3，turnSeconds 1.5，provisionalCharacterScale 1.0611643605。原文写明“只是下半身参考，**未验收**” |
| `assets/scripts/world-r1/WorldGeometry.ts` | 门扇扫掠和路径间距检查 | 只是数学工具 |
| `assets/scripts/world-r1/FirstsliceFacts.ts` | 所有锚点（从 GLB 生成） | 见 3.3 |
| `assets/scripts/world-r2/WorldNativeComposition.ts` | 组合层；`attachCalibratedCharacter(adapter)` 是接真实角色的入口 | 真实角色必须实现 `CharacterAdapter` 接口（定义在 WorldFlowCore.ts 里：perform / advance / cancelAndReset / coordinates） |
| `assets/resources/firstslice/combined_visual_m.glb` | 室内＋外景合并 GLB，6.2 MB，74,799 三角形 | 已被 GGbot 移到 `region_island` 分包（`work/ggbot-island-bundle/assets/bundles/region_island/`） |
| `tools/audit_camera_runtime.py`、`audit_camera_proxy_surfaces.py`、`test_world_camera_audit.cjs` | Oi 写的相机避障审计工具 | 只做抽样，**不是连续扫掠检查** |
| `docs/WORLD-UI-FIX-20261009.md`、`WORLD-R5-INTEGRATION-20261009.md` | Oi 关于相机的结论 | 见 4.3 |

这些文件都已复制到 `refs/cocos_code/` 和 `refs/cocos_docs/`。

### 3.2 角色（最新是 R5G2 pass2；pass2b 正在返工，还没有 GLB）
目录：`/workspace/wechat-game/art/character/r5-fix-g2/`

- **最新可用 GLB**：`pass2/export/chr_b_r5g2_lod0_anim_pass2_grokbot2.glb`，1,653,348 字节
  - 24,542 三角形：身体 18,044、黄裙 5,399、围裙 1,099。6 个图元，JPEG 贴图，身高 1.7253 m（含帽子），面朝 +Z
  - 骨架 `R5G2_RIG_22P4`，26 根骨：root, hips, spine, chest, neck, head, upper_arm.L/R, forearm.L/R, hand.L/R, thigh.L/R, shin.L/R, foot.L/R, skirt.front/left/back/right，以及 skirt.*.low ×4（辅助骨）
  - 根缩放 K = 1.061164379119873，**只能应用一次**，不能再乘上环境的 ×1.415282
  - 注意：**hand.L 是角色的右手**（角色面朝 +Z 时，右侧是 −X）。骨骼名字保持原样，不要因为左右看着不对就去改名或交换
  - 重新导入检查时列出了一个 `Icosphere` 网格对象，**需要确认是不是多余的辅助物体**
- **已有的 clip（只有 2 个，都是原地循环）**：`wind_sway_loop`、`idle_breathing_loop`，30 fps，120 帧，4.0 s
  - **完全没有** sit / stand_up / turn / walk / door_open / enter_close / sit_down 这些 clip，都要新做
- **坐姿**目前只是 `pass2/scripts/p2_poses.py` 里的 POSES['sit']（骨骼旋转数据），没有烘焙成 clip。'walk' 也只是一个静态姿势
- 源文件：`pass2/source/B_R5G2_FIX_PASS2_SOURCE_grokbot2.blend`、`pass2/lod/B_R5G2_PASS2_SOURCE_PLUS_LOD0_grokbot2.blend`（Blender 4.5.14 保存）
- pass2b（16:07 的 WIP）：`pass2b/source/B_R5G2_FIX_PASS2B_SOURCE_grokbot2.blend`，检查数据在 `pass2b/export/*.json`
- **pass2 / pass2b 已知问题**：
  1. 坐姿时裙子在椅面上撑成一个臃肿的钟形（为了不让裙子穿进座位盒子，后片和侧片各张开了约 55°）
  2. 坐姿时手陷进腿上的围裙：pass2 有 156–265 个顶点最深陷入 17 mm；pass2b 还剩 3 个手臂顶点穿进黄裙（−23 mm）、14 个围裙顶点穿进黄裙（−14 mm）、8 个腿部顶点穿出裙子（13 mm）
  3. **pass2b 的 walk 姿势**：腿和黄裙有 15 对三角形相交，前臂 / 手和围裙有 36 对三角形相交
  4. 坐姿检查用的是一个 0.46×0.40 m 的**盒子代理**（座面 z 0.4），**没有拿真实椅子网格测过，也没测扶手**。大腿底面比盒子顶高约 7 mm
  5. LOD0 下巴边缘的头发有阶梯状锯齿
- 交接说明（必读）：`refs/character/START_HERE_GROK_美术交接.md`，以及坐标和比例：`refs/character/ACTUAL_SCENE_AXES_AND_SCALE.json`
- 更早的静态起点：`/workspace/wechat-game/handoff-art-v2/x/GROK_ART_SAFE_HANDOFF_20261009_R5/character/VERTICAL_SLENDER_STAGE_R5/B_VERTICAL_SLENDER_STAGE_R5.blend`
- **旧动作参考（旧身体，只能参考节奏和路线，不能当作通过）**：
  - `.../character/actual_motion_branch/REALSCENE-FULLCHAIN-R24/B_ACTUAL_FULL_CHAIN_POSE_PREP_v24.blend`：33 秒完整链路（坐 → 起 → 转 → 走 → 门 → 出 → 回 → 关 → 坐）。下半身在真实场景里 3,961 个 120 Hz 采样点都没有穿模，但外观和服装是旧的
  - `.../character/actual_motion_branch/tail_surface_gate/SPINAL20_SUPPORTED_TAIL_DENSE_R10/B_SPINAL_SUPPORTED_TAIL_RISE.blend`：3 秒起身参考
- Funning 认可的裙角方向：`.../physical_cloth_trial/standing_garment_proof_R8_art_gain_natural_body/local_corner_arap`（181 帧，30 fps）

### 3.3 房间、门、椅子、海岛
- 室内包：`/workspace/wechat-game/art/GROKBOT-ART-001-INTERIOR-v2.1.0.zip`，已解压到 `art/x/GROKBOT-ART-001-INTERIOR-v2.1.0/GROKBOT-ART-001-INTERIOR-v2.1.0/`
  - 椅子：`assets/{glb,blend}/env_int_prop_reading_chair.*`、`env_int_prop_reading_chair_arms.*`（带扶手）
  - 门：`env_lighthouse_door.*`；碰撞：`env_interior_collision.*`
  - README 写明：“**坐下和起身期间要关掉 col_int_chair_seat 和 col_int_chair_back**”。但 Dot 的 A–F 交接写的是“禁止全局关闭椅子碰撞，只能在坐姿状态下过滤 locomotion capsule，手、裙、围裙仍保留和椅子的接触”。**两者冲突，以 Dot 的 A–F 为准**（更严格）
- 碰撞代理（游戏实际使用）：`work/ggbot-island-bundle/assets/bundles/region_island/combined_collision_proxies.json`，包括 col_lighthouse_door_leaf、col_int_ceiling、col_int_chair_armrest_l/r、col_int_chair_back、col_int_chair_seat、col_int_desk、col_int_door_frame、col_int_props_misc、col_int_side_table、col_int_stairs、col_int_stool、col_int_walls、col_int_floor_walkable
- 关键锚点（米，+Y 向上，室外方向是 +Z，原点在门洞地面中心）：
  - seat_anchor (0.42, **0.38**, −4.213)，yaw −2 rad。这是座面中心，不是骨盆或 root 的位置
  - seat_back (0.642, 0.862, −4.112)
  - seated_foot_anchor (0.494, 0, −3.823)；stand_up_foot_anchor (−0.152, 0, −4.26)
  - door_hinge (0.720, 0, 0)：绕 +Y 旋转，打开角 86.4°，最大 105°，打开时朝 +Z 方向
  - 门扇尺寸：宽 1.44 m，高 2.40 m，厚约 0.09 m
  - door_handle（门环，关门状态）(−0.43, 1.1287, −0.0424)；开到 86.4° 时在 (0.6057, 1.1287, 1.1453)。圆环中心线半径 0.07 m，管半径 0.012 m
  - door_stand_point (−0.212, 0, −0.332)，是伸手拉门环时站的位置；exit_point (−0.212, 0, 0.141)，是出门后松手的位置；entrance_point (−0.218, 0, −0.367)，是回屋进门后的第一个落脚点
  - exit_path_00…17、return_path_00…15：完整的出门 / 回屋路线点。完整列表在 `refs/cocos_code/FirstsliceFacts.ts`，以及 `refs/scene/combined_anchors_m.json`
- 海岛：新版 `art/island/v2.2/glb/env_scene_island_v2_2.glb`（源文件 `art/island/v2.2/scene/env_scene_island_v2_2.blend`）。游戏里目前用的还是 `combined_visual_m.glb`（v2.1 合并版）
- **各场景用的相机**：
  - 室内 / 门口 / 海岛：Cocos 场景相机 fov 45，位姿按 3.1 节的 FirstsliceRoutes 设置，**默认是 fixed 模式**
  - 海岛 v2.2 的渲染相机 CAM_hero（vfov 36，pitch −12.4°）**只用于宣传图，不是游戏相机**
  - 天空之城的游戏相机是 **C 机位**：3/4 高位俯视，竖直 fov 45°，pitch −31.89°，yaw −16.76°，Funning 确认全程只用 C 机位（见 `refs/scene/skycity_v0.3_design_cameraC.md`）。**本任务不涉及天空之城**，只做灯塔房间和海岛
  - 旧 CommonR2 的结束相机：vfov 62，竖屏 390×844（`refs/commonr2_legacy/camera-world.js`）

---

## 4. 之前的方案，以及为什么失败

### 4.1 旧方案：CommonR2 → R11 → R12（Dot / Oi，用 GPT 做的，非 Cocos）
- 代码：`/workspace/wechat-game/src/commonr2/x/`（`fixed/` 和 `motion/` 两条线；README 在 `refs/commonr2_legacy/README-R2.txt`）
- 做法：用纯 JS 和 WebGL 自写的微信小游戏引擎。角色是 CPU 逐顶点蒙皮，衣服接触也在**运行时**算，靠一大堆程序化修正模块：`garment-support-domain.js` 一个文件就有 **14.5 MB**，此外还有 `garment-body-seams`、`garment-shoulder-target-data`、`natural-arm-contact`、`door-hand-contact`、`chair-cloth-clearance`、`continuous-seat-stand` 等，共 136 个 shared 模块。镜头用 `camera-world.js` 和 `camera-v4.js` 做两线运镜，出门时间轴在 `scene-timing.js`（起身约 1.75 s，伸手、开门、松手、跨门槛都有显式的时间段）
- 为什么失败：
  1. **衣服和手的穿模一直没解决**。可编辑基底在无编辑往返测试后，严格检测器仍然查出 **752 对接触**；R12 自己标注的未通过项是“原有衣手穿模、完整衣物接触、手机运行预算”
  2. 运行时求解成本太高，**超出手机预算**
  3. 他们说的“PASS”都只是**等值测试**（68 个姿势在优化前后几何完全一样），只证明优化没有改变结果，**不证明没有穿模**。door micro-smoke 也只跑了开门后 2 个逻辑帧，没有跑完整出门流程
  4. 坐姿用 Blender 原生布料模拟时，先出现急折和厚壳自穿，后来又出现中面越过自身接触，**多轮调参后已经停掉**。用户和主线允许改用“以真实人体和椅面为约束的离线衣片美术动画”，但必须明确标注
  5. 为了躲开裙子把肩膀往外扩、手臂往外撑，被用户**否决**；“把整条裙子缩到手指最内侧以内”的瓶身方案也被否决
  6. 从这个阶段起，Funning 把美术转给 Grok Bot
- Cocos 迁移文档明确写了：**不搬旧的 CPU 逐顶点蒙皮和全量衣物求解**；换引擎**不会自动解决穿模**（T02）

### 4.2 Cocos 现状（Oi）
- 流程状态机和相机路径已经在 Cocos 里跑通，但用的是**紫色标记代替角色**。Oi 明确声明：没有角色、碰撞、衣服、坐姿接触、门接触的验收
- 目前没有任何真实角色、骨骼动画或 clip 接进游戏

### 4.3 镜头相关的已知问题（Oi 自己报告的）
- 默认的 home 相机在坐姿 yaw −2 时，实际位于角色**解剖学左侧**（右向投影 −1.827 m）。之前说的“在右侧”已经撤回，和 V01 冲突
- 默认 fixed 相机在角色走过时会换到另一侧，所以**不能说全程都在右侧运镜**
- motion 候选在转身、走路、开门、出门几段上，右向投影一直是正的；相机球（半径 0.12 m）到代理面的**抽样**最小余量是 0.127 m，**不是连续扫掠检查**
- 相机只做线性插值和 lookAt，没有缓动和防抖

### 4.4 Grok Bot 这边已经做的（R5G2）
- pass1 / pass2 把身体自身的穿模清零了（站姿、走路姿势、坐姿，加上风吹和呼吸各取 4 帧检查）。但**坐姿下的衣服问题**（钟形裙、手陷进围裙）还在 pass2b 修
- 没有任何连续的起身、走路、开门动作

---

## 5. 约束

- **Blender 4.5.14 LTS** 保存源文件（`/opt` 里也有 5.2.2，但只能用来渲染）。另存成新分支，不要覆盖别人的 .blend
- 导出 GLB（glTF 2.0）。单位米，+Y 向上，角色面朝 +Z。K 只应用一次。每个顶点 ≤ 4 个权重。clip 用稳定的 ASCII 名字（建议：sit_idle、stand_up、turn_left、walk_loop/walk_start/walk_stop、door_reach_push、door_release、enter_close_door、turn_to_seat、sit_down），每个 clip 写明时长、帧率、是否循环、事件
- 布料不能指望 Cocos 实时模拟。**Blender 布料缓存要烘焙成骨骼动画**（比如给裙子和围裙加辅助骨，每根骨骼都要列入预算），或者用其他在 Cocos 里实际验证过能播放的格式。MDD 不能直接给 Cocos 用
- controller 独占根位移。不要改 WorldFlowCore 的公开接口。如果非改不可，写一份变更说明，交给 GGbot 和 Oi 审
- 场景 .scene / .prefab / .meta 由集成方统一维护。运镜 bot 交付 GLB、clip、相机路径数据（JSON）和适配脚本草案，**不要直接改主工程的 UUID 或 .meta**
- 主包 ≤ 4 MB，角色放分包 `chr_girl`
- **不上传、不发布微信**，不改微信后台，也不碰 AppID
- 交付方式：放到 `/workspace/wechat-game/team/cinematic/outbox/<时间戳>-cinematic-<版本>/`，里面必须有 README.md（改了什么、怎么应用、测试结果标 passed / failed / not_run、已知问题）和 SHA256SUMS.txt。Grok Bot 验收后上传到 Drive 的 `06_inbox/to_dot`，由 Oi 在 Cocos / DevTools 里测，结果回到 `06_inbox/to_grokbot`
- 不能说没跑过的测试已经通过。抽样就写“抽样”，Blender 里的结果就写“Blender”

---

## 6. 建议的工作顺序（只是建议，方法由运镜 bot 自己定）

1. 先打开 pass2 或 pass2b 的源文件，把**真实**的椅子（带扶手）、门、门环、门框和地面放进同一个场景，用米制坐标和真实锚点对齐。核对 K 是否只应用了一次。
2. 先写好干涉检测器（要有阳性对照），在静态坐姿上跑通，再开始做动作。
3. 做动作分段，先在 Blender 里做到逐帧零穿模，再导出给 Cocos。
4. 用碰撞代理设计相机路径，做连续扫掠检查。
5. 在 Cocos 里写一个 CharacterAdapter 草案，把动画播放和 WorldFlowCore 的 perform / advance 接起来。

---

## 7. 只有 Oi 或 Funning 能回答的问题

**需要问 Oi：**
1. GPT 对话里“最新运镜方案”指的是哪一版？是 CommonR2 的 camera-v4 / camera-world，还是 Cocos 的 FirstsliceRoutes motion 线，或者还有更新的、没上传 Drive 的版本？请把对应文件或提交号放到 `06_inbox/to_grokbot`。
2. 那个模型修了好几天，**最后卡在哪几帧、哪几对配对上**？是手和裙、肩和袖、裙和椅，还是门和手？有没有失败帧截图和日志？
3. Cocos 默认会用 fixed 还是 motion 模式？正式版要两条线都保留，还是只保留一条？
4. 坐下和起身时，椅子碰撞的处理方式按 Dot 的 A–F 规定执行（只过滤 locomotion capsule），还是按室内包 README 的写法（直接关掉 seat/back 碰撞）？
5. 角色的 CharacterAdapter 打算用 Cocos 的 SkeletalAnimation（预烘焙）还是实时骨骼？需不需要支持 clip 之间的混合？
6. 出门的终点和海岛玩法镜头怎么交接？玩法时的相机是 cameraIsland（−3.4, 2.3, 6.6），还是别的镜头？
7. `combined_visual_m.glb` 什么时候换成海岛 v2.2？门、椅子和锚点的坐标会不会变？
8. 回屋时 WorldFlowCore 的顺序是“先停下，再关门，再走”。能不能改成“边走边顺手关门”（M06）？

**需要问 Funning：**
1. “开始游戏前”的出门演出，是每次进入游戏都播，还是只在第一次播？能不能跳过？
2. 出门时镜头最终要看到的小岛构图（升镜高度、回望角度），有没有参考图？
3. 女孩的身高是 1.626 m（不含帽子，K 由此推出），这一点是否确认？
4. 坐姿时裙子在椅面上应该怎么铺？现在的“钟形”已经被否决，是要自然垂到椅子前沿，还是更贴腿？
5. 固定视角和运镜两条线是否都要保留（GDD 要求保留两条）？
6. 回屋时进门后，要不要转身面对门、用手去关门，还是背手带上门就可以？

---

## 8. 参考资料索引（`refs/`）
- `refs/docs/`：GDD、迁移方案、迁移附录、Dot 的 A–F 交接、当前状态、美术交接 v1 和 v2、Dot 当前游戏总交接
- `refs/drive/`：需求状态矩阵（M/V/K 各条）、Grokbot 工程交接 A–F（Drive 原件）、R12 WIP 日志、Blender 研究日志
- `refs/cocos_code/`：WorldFlowCore、FirstsliceRoutes、WorldFlowComponent、CharacterReference、WorldGeometry、FirstsliceFacts、WorldIntegrationBoot、WorldNativeComposition，以及相机审计工具
- `refs/cocos_docs/`：Oi 的 world / 相机结论
- `refs/character/`：pass2 报告、重新导入检查、clip 和检查用 JSON、p2_poses.py、对比图、风吹视频、R5 START_HERE、坐标和比例；`pass2b_wip/` 是 pass2b 当前的检查数据
- `refs/scene/`：combined_anchors、interior_anchors、碰撞代理、室内包 README 和测试报告、天空之城 C 机位说明
- `refs/commonr2_legacy/`：旧方案的 README、两张截图、相机 / 门 / 座椅 / 回屋相关的 JS 文件、协作基底 README

大文件（.blend、GLB、旧的 33 秒动作）没有复制，直接用 3.2 和 3.3 节写的绝对路径。

## Funning 决定（2026-10-09 16:24 CT）
1. 出门过场只在第一次启动时自动播放，之后可以点击跳过（跳过的逻辑见 GGbot 的 0006 方案）。
2. 女孩身高 1.626 m，不含帽子，人物比例按这个计算。
3. 坐姿时裙子自然垂到椅子前沿（不要撑成钟形）。
4. 回家进门时顺手把门带上（边走进来边关门）。
5. 出门镜头最后一帧的视角：`refs/FUNNING-exit-final-frame-ref.png`。手机竖屏，高处俯看整座小岛，灯塔和小屋在画面中间，门开着，四周是海。
6. （16:25 CT 补充）出门镜头停在参考图视角后，游戏界面可以左右拖动：从灯塔小岛向左拖，先看到后面的草原（meadow），再往左是天空之城（skycity）。所以出门镜头的最后一帧必须正好是横向拖动镜头的起点，也就是小岛那一格，交接时不能跳。回家的过场也要从这个拖动镜头出发。
