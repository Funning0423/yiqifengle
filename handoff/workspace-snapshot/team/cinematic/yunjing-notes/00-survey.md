# 运镜 bot 熟悉工程：调查笔记 00（只读）
2026-10-09 16:20 CT。本次没有修改、导出、上传或发布任何东西。人物模型只看了 JSON、报告和脚本，没有用 Blender 打开 pass2b，因为另一个 agent 正在改。
注意：调查时 `team/cinematic/` 还不存在，交接文档 HANDOFF-CINEMATIC-v1.md 和 refs/ 也还没有。为了建这个笔记目录，`mkdir -p` 顺带创建了空的 `team/cinematic/`，里面只有 `yunjing-notes/`。

## 0. 结论先行
- **现在没有任何可用的过场动作 clip。** 角色 GLB 里只有 `wind_sway_loop` 和 `idle_breathing_loop`。`sit` 和 `walk` 只是静态 pose 数据（`scripts/p2_poses.py`），起身、转身、走路循环、推门、坐下都还没做。
- Cocos 工程里也没有开场过场。流程由 `WorldFlowCore.leaveHome()/returnHome()` 状态机驱动：相机是 position/target 在关键点之间做**线性插值**，门是 1 s 线性转动，角色现在是紫色胶囊占位（`FlowReferenceStandin`），没有手和门的接触。
- 旧版 CommonR2（纯 JS）有一套完整的 18 s 出门链：手扶门环、推门时序、相机，但它用的是 CPU 逐顶点的布料避让，已明确“不直接搬”。它的**时序和锚点可以当参考**。

## 1. Cocos 工程
根目录 `/workspace/wechat-game/src/QIFENGLE-COCOS-5b449fa-SOURCE/creator-build-project/`（Creator 3.8.8，type 3d）
- 场景：`assets/scenes/FirstsliceImport.scene`（启动脚本 FirstsliceBoot，诊断相机）和 `WorldR5Integration.scene`（启动脚本 WorldIntegrationBoot，世界流程加占位角色）。两个场景都只有 Main Light 和 Main Camera，其余节点都在运行时 instantiate。
- 世界资源：`assets/resources/firstslice/combined_visual_m.glb`（米制，Y 上，+Z 朝外；一个 GLB 里同时有房间、门、岛、海和天空），以及 `combined_anchors_m.json`、`combined_collision_proxies.json`（col_* 只有数据，**引擎里还没建碰撞体**）。
- 流程相关代码：
  - `assets/scripts/world-r1/WorldFlowCore.ts`：状态机。
  - `world-r1/WorldFlowComponent.ts`：WorldLease 的实现，包括 setCamera、animateCamera、animateDoor、setLayers。
  - `world-r1/FirstsliceRoutes.ts`：路线和相机关键点。
  - `world-r1/FirstsliceFacts.ts`：从 GLB 生成的锚点、门和渲染层，**不能手改**。
  - `world-r1/CharacterReference.ts`：控制器的坐/站 root。
  - `world-r1/WorldGeometry.ts`：门的 OBB 距离，以及 auditDoorTrack 连续净空审计。
  - `world-r2/WorldNativeComposition.ts`：组装。
  - `WorldIntegrationBoot.ts`：调试 UI 上的“出门”“回主页”按钮调用 `leaveHome()` 和 `returnHome()`。
- 工程里没有 Animation 或 Timeline 资产，也没有 tween 过场。世界里唯一的动画是环境的 `idle_loop`。

### 1.1 状态序列（开场要无缝接上它）
`leaveHome`：
- `standing`：先执行 stand action（占位实现 3 s）。motion 模式下，相机在 1 s 内从 cameraHome 移到 cameraToDoor[0]。
- `turning-out`：turn 1.5 s，从 seatYaw −2 rad（−114.6°）转到约 −2.8°，方向向左。
- `walking-out`：沿 toDoor 走，长 4.198 m，速度 0.7 m/s，约 6.0 s。相机沿 cameraToDoor 移动，按 progress 定时。
- `opening-door`：角色**静止**，门在 1 s 内线性转 0→86.4°。
- setLayers(BOTH) 后进入 `crossing-out`：沿 outCrossing 走 1.99 m，约 2.84 s，相机从 cameraInside 移到 cameraOutside。
- 接着走 toIsland（exit_path_07..17），相机从 cameraOutside 移到 cameraIsland，最后进入 `island`。

`returnHome`：
- 先进入 `walking-home`：走 toThreshold，相机从 cameraIsland 移到 cameraOutside。
- `crossing-in`：走 inCrossing（return_07、return_08、entrance_point），相机从 cameraOutside 移到 cameraInside。
- `closing-door`：先停稳，再在 1 s 内把门从 86.4° 关到 0°。
- setLayers(HOME) 后进入 `walking-to-seat`：沿 toSeat 走，相机从 cameraInside 移到 cameraHome。
- `sitting`：执行 sit，最后回到 `home`。

其他要点：
- 相机只在 `mode==='motion'` 时移动，fixed 模式不动。
- 控制器独占 root 位移，clip 必须原地。
- 每帧 dt 上限 0.1 s，`advance` 是唯一时钟。

### 1.2 路线和相机坐标（米，Y 上）
- 座位：
  - seat_anchor (0.4203, 0.38, −4.2133)：座面顶，yaw −2 rad。椅子宽 0.4946 m，深 0.3815 m，靠背高 0.862 m。
  - seat_back (0.642, 0.862, −4.112)。
  - seatedRoot (0.4327, 0, −4.2076)，standingRoot (−0.0162, 0, −4.4131)，两者相距约 0.49 m。
  - walkEndRoot (−0.0917, 0, −2.8849)。
- toDoor：standingRoot → walkEndRoot → exit_path_03 (0.2295, 0, −2.0004) → exit_path_04 (−0.0653, 0, −0.773) → door_stand_point (−0.212, 0, −0.3321)。
- outCrossing：door_stand_point → exit_point (−0.212, 0, 0.1413) → exit_path_06 (−0.0482, 0, 0.6892) → exit_path_07 (−0.4376, 0, 1.5469)。
- 回程：
  - inCrossing：return_path_07 (−0.1581, 0, 1.0699) → return_path_08 (−0.1444, 0, 0.4008) → entrance_point (−0.2181, 0, −0.3674)。
  - toSeat：entrance_point → return_path_10..15 → standingRoot。
- 门：
  - 铰链 (0.7202, 0, 0)，绕 +Y 转，向外（+Z）开 86.4°，上限 105°。
  - 门叶局部 bounds 为 x[−1.4404, 0]、y[0, 2.4023]、z[−0.0057, 0.085]。
  - door_handle (−0.43, 1.1287, −0.0424)，是门叶的子节点；开到 86.4° 时在 (0.6057, 1.1287, 1.1453)。门环中心线半径 0.07，管半径 0.012。
  - 角色面朝 +Z 时，门环在物理右手侧，对应旧骨骼的 `hand.L`。
- 相机（`FirstsliceRoutes`）：
  - cameraHome 位置 (−1.1, 1.8, −2.9)，目标 (0.35, 0.85, −4.1)。
  - cameraToDoor[i]：位置 = 路点 − 侧向 0.32 − 后退 0.26，高 1.55；目标 = 路点 + 前方 0.7，高 1.1。我算出的值：

    | i | 位置 | 目标 | progress |
    |---|---|---|---|
    | 0 | (−0.323, 1.55, −4.689) | (−0.051, 1.1, −3.714) | 0 |
    | 1 | (−0.447, 1.55, −3.094) | (0.013, 1.1, −2.193) | .364 |
    | 2 | (−0.105, 1.55, −2.242) | (0.269, 1.1, −1.302) | .589 |
    | 3 | (−0.302, 1.55, −1.111) | (−0.258, 1.1, −0.100) | .889 |
    | 4 = cameraInside | (−0.434, 1.55, −0.680) | (−0.433, 1.1, 0.332) | 1 |

  - cameraOutside 位置 (−0.58, 1.65, 1.6)，目标 (−0.2, 1.1, 2.6)。
  - cameraIsland 位置 (−3.4, 2.3, 6.6)，目标 (−1.5, 1.05, 4.5)。
- 室内尺寸（GLB 包围盒）：env_interior_shell 为 x ±2.454，z −5.101..−0.008，高 3.95；大致是半径约 2.45 的圆筒。**圆心约在 z −2.55，这是我估的**，墙的真实形状要用 col_int_walls 核实。
- 橱窗玻璃在 y 1.82..3.0，吊灯等物件最低 y 2.195，猫在 x −1.34..−0.82、z −3.21..−2.69。
- 碰撞代理：col_int_{walls, chair_seat, chair_back, armrest_l/r, desk, side_table, stool, stairs, props_misc, door_frame, ceiling, floor_walkable} 和 col_lighthouse_door_leaf。契约还要求把 18 mm 门槛和 6 mm 地毯算进去。

### 1.3 旧版参考（CommonR2，只读）
`/workspace/wechat-game/src/commonr2/x/motion/shared/`：
- `door-interaction.js`：时序为 reachStart 4.25、contact 4.55、doorStart 4.70、release 5.28（此时 30°）、retractEnd 5.72、doorEnd 5.9（86.4°）。门角是 hermite 曲线，先推出净空，然后脚才跨过门槛（约 5.14 s）。推门时空手贴住髋部，因为普通走路摆臂会打到门。
- `scene-timing.js`：起身显示 1.75 s，source 1.1 s。
- `camera-world.js`：returning 6.2 s。
- `cinematic-scene.js`、`continuous-seat-stand.js`，以及 `*-clearance.js` 一组文件。

另有两个 Blender 参考：
- `handoff-art-v2/x/GROK_ART_SAFE_HANDOFF_20261009_R5/character/actual_motion_branch/REALSCENE-FULLCHAIN-R24/B_ACTUAL_FULL_CHAIN_POSE_PREP_v24.blend`：旧身体，991 帧，30 fps，33 s 全链。22 骨，带 1.061 的 K 父级，场景里有 CAM_door_closeup 等相机。
- `tail_surface_gate/SPINAL20_SUPPORTED_TAIL_DENSE_R10/B_SPINAL_SUPPORTED_TAIL_RISE.blend`：3 s 起身。

这两份都要重定向到 R5G2，不能直接套用。

## 2. 角色（r5-fix-g2）
- pass2 为定稿基线，路径 `/workspace/wechat-game/art/character/r5-fix-g2/pass2/`：
  - 源文件：`source/B_R5G2_FIX_PASS2_SOURCE_grokbot2.blend`，用 Blender 4.5.14 保存。
  - LOD：`lod/B_R5G2_PASS2_SOURCE_PLUS_LOD0_grokbot2.blend`。
  - 导出：`export/chr_b_r5g2_lod0_anim_pass2_grokbot2.glb`，1.65 MB，24,542 三角。
- pass2b 进行中，另一个 agent 在修坐姿裙子和手。目前有 `source/B_R5G2_FIX_PASS2B_SOURCE_grokbot2.blend`（16:07），**还没有 GLB 和 LOD**，`probe/lodtest` 在做。
- 骨骼：26 根，包括 root、hips、spine、chest、neck、head、upper_arm/forearm/hand.L/R、thigh/shin/foot.L/R、skirt.front/left/back/right，加 4 根 skirt.*.low。契约只写了 22 根主骨，`.low` 是文档里登记过的辅骨。
- 权重每顶点不超过 4。GLB 根缩放 K = 1.061164（**只能应用一次**），身高 1.7253 m，面向 +Z，物理右侧是 −X。
- 裙子：黄裙 G2_DRESS 和白围裙 G2_APRON 共用 8 根裙骨，没有布料模拟，Cocos 里也不能用 MDD。
- pass2b 给坐姿加了形态键 `sit_corrective`（布料垂坠修正，坐姿时权重为 1，见 `pass2b/scripts/p2_poses.py` 里的 SHAPEKEY_FOR_POSE）。
- pass2b 坐姿数据：root 下移 0.609；thigh −98° / shin 98°；裙骨 back −31/−113，front −93/71，左右各 −75。
- 检测结果（`pass2b/export/*_p2b.json`）：
  - 坐姿：0 个顶点进入座面盒，大腿离座面 7 mm。
  - **静态 walk pose 仍有穿插：腿 × 黄裙 15 对三角，前臂/手 × 围裙 36 对。**
  - rest 和 sit 都是 0。
- 材质有 6 个：BODY、FACE、HEAD、HAIR、DRESS、APRON。贴图是 JPEG，最大 1024。

## 3. 工具
- `blender` 指向 **5.2.2**，`blender-4.5` 指向 4.5.14（`/opt/blender-4.5.14-linux-x64`）。角色源是 4.5 保存的，**编辑和导出要用 blender-4.5**，免得被版本升级。
- Cocos Creator 3.8.8 只有 Windows 版，通过 wine 跑：`/usr/local/bin/cocos-creator`，打开的是 GUI，使用 DISPLAY :2。**命令行 headless 构建没验证过**，wechatgame 模板是加密的。另有测试工程 `/home/box/cocos-projects/hello-wx`。
- node v24.21，`/opt/artvenv`（Python 环境）。
- 检查脚本：`team/ggbot/tools/{art_import_check.py, glb_budget_check.py}`，以及 r5-fix-g2 的 `p2b_overlap.py`、`p2b_seatcheck.py`、`p2_bodyclip.py`（BVH 穿插检测，可以改成逐帧跑）。

## 4. 穿模风险排序（从重到轻）
1. **起身和坐下的过渡：裙子、围裙、大腿对椅子（座面、扶手、前缘），以及手对围裙。** 出门在 standing 段，0–3 s（旧参考 1.75 s）；回家在 sitting 段的最后 3 s。
   - 原因一：坐姿裙骨折角非常大（−113°、−93°、−75°），还叠了 `sit_corrective` 形态键，rest 时这些都是 0。中间帧做骨骼和形态键线性插值，裙摆会扫过座面和扶手。
   - 原因二：root 同时要水平移动 0.49 m 并下沉或上升 0.609 m，椅子宽只有 0.49 m，还有扶手。
   - 原因三：手从膝上抬起时会穿过围裙，pass2 时就有 ≤17 mm 的残留。
   - 目前只验证了“静态坐姿”，过渡完全没有数据。
2. **走路循环：腿对黄裙，前臂和手对围裙。** 出现在每一步的极点，贯穿 walking-out 约 6 s、crossing-out、toIsland 和整个回程。静态 walk pose 就已经测出 15 对和 36 对三角穿插（pass2b overlap）。裙骨只有前、后、左、右 4 片加下段，大步时侧缝和后缝很难跟上腿。
3. **转身（约 112°，1.5 s）：裙摆和腿互相穿，裙摆还可能扫到椅子或扶手。** 出现在 turning-out，起身后马上开始。standingRoot 离椅子只有约 0.5 m。原地转身的支撑脚交叉会把裙子夹在两腿之间。现在的占位实现只是直接设 yaw，没有脚步。
4. **推门和门槛：手对门环和门叶，裙摆和鞋对门框和门槛。** 出现在 opening-door 和 crossing-out 的头约 1 s；回程在 crossing-in 和 closing-door。
   - 现行状态机里角色静止、门自己开，没有手接触。如果要加推门手势，手必须跟着门叶转，否则手会穿进门叶或者悬空。物理右手对应 hand.L，门环在 x −0.43。
   - 回程关门时角色站在 entrance_point，z −0.367，背对门。门叶内侧到 z ≈ −0.05，加上裙后摆和帽檐，净空估计只有约 0.1–0.15 m，要实测。
   - 门框宽 1.44 m，没有问题。18 mm 门槛要让脚抬起来。
5. **相机贴近角色：近裁面切进帽子和头发。** 出现在整个 walking-out 和转身段。cameraToDoor 离角色 root 水平只有约 0.41 m，高 1.55 m，正好在帽子和头发的高度。转身时相机不动，帽檐会扫向镜头。路点转角处还会加速，因为每段是线性插值，到拐点有速度突变。
6. **相机穿墙或擦墙。**
   - cameraToDoor[0] 按我估的圆心，离墙约 0.3 m，要用 col_int_walls 核实。
   - cameraInside → cameraOutside 这段直线在 x ≈ −0.49 处穿过门洞，离门框 x −0.72 只有约 0.23 m，加上墙厚，近裁面可能切到门框。
   - 回程 cameraInside → cameraHome 是直线，途中没有和道具做检测。
   - 现在所有相机路径都没有任何碰撞审计。
7. **路线净空低估。** 占位控制器的 `clearanceRadiusM` 是 0.15，但裙子半径约 0.19，坐姿时裙子前后范围达 0.6 m。路线离书桌、边桌、凳子、楼梯有多远还没有按真实裙摆半径审计。WorldGeometry.auditDoorTrack 只审了门。
8. **坐标和缩放错位，表现为坐进椅子或悬空。** 出现在落座和起身的首尾帧。CharacterReference 的 seatedRoot 来自旧的下半身参考，pass2b 的坐姿 root −0.609 是另外调的。K = 1.061 一旦被乘两次，或者场景按 game unit 再放大 1.415，就会整体错位。
9. **LOD0 减面和导出后重新出现穿模，以及微信端的形态键性能。** pass2b 还没导 LOD 和 GLB。减面会让原本 0 穿插的结果回退。Cocos 只取前 4 个权重。`sit_corrective` 形态键要和骨骼同步驱动，在手机上的开销没测过。

## 5. 开放问题
- 交接文档和 refs 还没出来。开场到底以哪一版为准：旧版 18 s 链（带手扶门、推门时序），还是 WorldFlowCore 现在的简版（门自己开）？
- 动作 clip 由谁做：起身、转身、走路循环、推门、关门、坐下？我们需要在 Blender 4.5 里基于 pass2b（定稿后）制作，还是用旧 R24 的 991 帧重定向？pass2b 什么时候定稿，裙骨会不会再变？
- 是否允许给裙子加更多骨（例如 8 片 × 2–3 段），或者给每个动作加形态键？契约允许追加辅骨，但要登记。
- 相机能不能改成样条加碰撞检测的路径，替换 FirstsliceRoutes 里的线性关键点？这需要工程侧（Oi 或 dot）同意。fixed 模式是不是不需要运镜？
- 验收工具：逐帧 BVH 穿插检测（角色对 col_* 和真实网格，30 fps 全帧），相机对 col_int_walls 和 door_frame 的近裁面检测，然后在 Cocos 和微信里实机复查。Cocos 在 wine 下能不能 headless 构建，还是由 Oi 在真机上验？
