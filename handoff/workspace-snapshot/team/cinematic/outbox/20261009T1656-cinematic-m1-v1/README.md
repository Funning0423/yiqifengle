# 运镜bot M1 交付 v1：坐 → 起身 → 左转（cine_open_stand / cine_open_turn）

- 编写：运镜bot，2026-10-09 16:56 CT，Blender 4.5.14（`blender-4.5`）。只改了本目录和 `team/cinematic/work/m1/`。没有改工程、.scene、.meta、UUID，没有改人物源文件，没有上传或发布。
- **结论：M1 的“全帧可见穿模为 0”这一项没有通过（FAILED）。** 剩下的穿模大部分是模型层面的问题（详见 §4），按约定停在这里等对齐，没有用 hack 去掩盖。锚点、时长、导出、骨骼数和末帧这几项都已通过（只在 Blender 里验过）。
- 状态标记：`passed(Blender)` 表示只在 Blender 里验过；`not_run` 表示没跑过（Cocos、DevTools、真机都还没跑）。

## 1. 基底（SHA256）
| 文件 | SHA256 |
|---|---|
| pass2b 源 `art/character/r5-fix-g2/pass2b/source/B_R5G2_FIX_PASS2B_SOURCE_grokbot2.blend`（16:07，已验收版。用的是副本，原文件没动） | b5df09f878458247b36136a9b2717bf141ad34c2dad03043c2c50e95ba9841f3 |
| pass2b `scripts/p2_poses.py`（SIT 姿势逐项照抄） | 040814c1259a1779ed6354303132b8530c8e5f3d3459238daf489ec59256cf64 |
| pass2b `export/R5G2_PASS2B_SIT_POSE_grokbot2.json` | 48d7a2fb3dd06ddafe43a288e6a94fda5afe2dae8198cfbe0fb5caf3e580d9cc |
| pass2b `export/chr_b_r5g2_lod0_anim_pass2b_grokbot2.glb`（只作参考） | a38cedcd6dee58572002ce8af717ab2785310e5043150baa9a2dfd834edd2a1d |
| pass2b `REPORT_R5G2_PASS2B_grokbot2.md` | 8374676348793ef9abe935978b9f0934e974052aa85cf2f182a25db0fd47cbce |
| 世界：室内包 v2.1.0 `scene/env_interior_assembled.blend`（真椅、门、墙、col_*）；锚点取自 FirstsliceFacts / CharacterReference.ts | 见 work/m1/probe/facts.json |
| R24 时序参考 `root_reference_curve.json`（Oi 证据包） | 见 Oi 的 EVIDENCE-MANIFEST |

## 2. 交付物
- `clips/cine_m1_open_stand_turn.glb`（3.40 MB），已重新导入复查，结果在 `clips/*.reimport.json` 和 `report/glb_animation_probe.json`：
  - 两段动画：`cine_open_stand` 3.000 s（91 个采样），`cine_open_turn` 1.500 s（46 个采样）。
  - 每段都有 26 根骨的 T/R/S 通道，另有 2 条 morph weights 通道（黄裙、围裙的 `sit_corrective`）。stand 段这个权重从 1 变到 0，turn 段全程为 0。
  - 骨骼 26 根，上限 60，`passed(Blender)`。根缩放为 1，骨骼缩放在 1±1e-5 以内。每个顶点最多 4 个权重，导出后实测最多 3 个。
  - 衣裙导出的是中面（solidify 关闭，即游戏用的双面中面）。
  - 重新导入时出现的 `Icosphere` 是 Blender 导入器生成的骨骼显示形状，不在 GLB 里。
- `blend/B_CINE_M1_open_stand_turn_yunjing_v01.blend`：工作场景，包括人物副本、真实室内、真实椅子、col_* 代理和 A_* 锚点空物体。两段 clip 各是一条 NLA 轨，导出模式用 NLA_TRACKS。
- `timing/cine_open_stand.timing.json`、`timing/cine_open_turn.timing.json`：fps 30，帧号 0..lastFrame 都采样，durationSec = lastFrame/30。**时长 3.0 s 和 1.5 s 定稿**，按 R24 的 0–3 s 起身、3–4.5 s 转身。事件如下：
  - stand：起身开始 f6（收脚抬左脚 f5）；左脚落地 f20，右脚抬起 f12、落地 f27；离座（不再接触椅子）f49；`sit_corrective` 在 f80 变为 0；起身结束 f83；f83–90 静止。
  - turn：转身 f1–44（左转 111.76°）；四步依次是 L 抬 f2 落 f12，R 抬 f12 落 f22，L 抬 f22 落 f33，R 抬 f33 落 f43。
  - `fovVerticalDeg` 是逐帧数组。M1 还没做镜头，所以全是 45（`cameraAuthored:false`），最后一帧是 45。`doorStartFrame` 等门相关字段这两段都是 null。
- `timing/cine_m1_reference_root_curve.json`：给 Oi 和兜底路点流程用的参考 root 曲线（游戏坐标，逐帧位置和 yaw）。按 0006 v1.1，root motion 烘焙在根骨上。
- `report/`：
  - 逐帧穿模报告 `clipping_per_frame_v5.json` / `.csv`，含阳性对照，共 17,830 行。
  - 汇总 `clipping_summary_v5.txt`。
  - 锚点、身高、骨骼 `anchors_height_bones_v5.json`。
  - 动画构建日志 `anim_build_log_v5.json`。
  - 4 权重诊断 `model_diag_weights_limit4.json`。
- `renders/`：三个必需时刻都有，每个时刻四个视角（右侧、正 3/4、背 3/4、髋部和座面特写）：
  - 坐姿 f0；
  - 离椅 f30（前滑）和 f45（离座）；
  - 转身 f12、f24、f45；
  - 另加站起末帧 f90。
  - 总览图是 `CONTACT_SHEET_m1_v5.png`。为了看清接触，渲染时隐藏了墙、侧桌和杂物，真实椅子保留。
- `scripts/`：可完整复现。顺序是 build_scene → anim_build → check_run → anchors_report → render_m1 → make_timing → export_glb。

## 3. 数值
- **尺寸**：用 interim 原尺寸，K=1.061164 只烘焙一次，根缩放为 1，**没有另外缩放**。
  - 含帽 1.7253 m；**不含帽：头发顶 1.6441 m，头皮顶 1.626 m**。
  - 和 Funning 的 1.626 m（不含帽）比，按头发顶算差 1.8 cm，按头皮顶算差 0。
  - 要统一缩放时，只改 `CHAR_SCALE_MODE` / `CHAR_SCALE` 这个开关，然后整条流程重跑。
- **锚点误差**（`passed(Blender)`，要求 ≤1 cm、≤1°）：
  - stand 首帧对坐姿 root (0.43273, 0, −4.20761)、yaw −2：0.000 mm、0.000°。
  - stand 末帧对 standingRoot (−0.016249, 0, −4.413086)：0.000 mm、0°；和 Oi §4 的 R24 站姿 root 差 0.093 mm。
  - turn 首帧同上。turn 末帧对 standingRoot + walkYawRad (−0.049376)：0.000 mm、0.000°。
  - 只作参考：stand_up_foot_anchor 差 204 mm，turnStartFoot 差 75 mm。这两个是旧的脚参考，不是 root。
- **末帧**：两段末帧所有骨骼都正好是 rest（偏差 0°），`sit_corrective` 为 0，root 高度为 0。
  - 末帧仅剩的穿模是 torso×apron：中面 4 对，可见网格 8 对，约 6–9 mm。这在 pass2b 的 rest 姿势里就有，用原始权重也一样，属于模型问题。
- **坐姿和真实椅子的贴合误差**：
  - 把 pass2b 设计的坐姿 root（−0.609 源单位 × K = −0.6462 m）放到 seatedRoot 时，臀部穿进真实座面 16.1 mm（蝴蝶结尾带不算），黄裙穿进 45.7 mm。
  - 处理：root 抬高 17.1 mm（root z = −0.6291），让身体离座面 1 mm。这样黄裙在臀下仍穿入约 28.5 mm。
  - 原因：pass2b 是对一个 0.46×0.40×0.40 的盒子调的，而真实椅子座面 0.4946×0.3815、高 0.38，前沿和靠背也都不同。
- **阳性对照**（`passed(Blender)`）：
  - stand f0 座位往下注入 30 mm：body×seat 68 对，dress×seat 132 对，col_seat 内 178 个顶点，地面以下 110 个顶点、30.0 mm。
  - turn f45 地面往下注入 20 mm：地面以下 103 个顶点、20.0 mm。
  - legL×legL_ctrl 每帧都检出。
- 深度说明：`depth_mm` 是近似值，取“落在对面一侧的顶点”的最大距离。对椅垫这种薄件会饱和在约 19 mm，所以要以三角对数为准。self 配对只给三角对数。

## 4. 穿模清单（中面，即游戏模式；帧号按 30 fps）
**A. 模型层面（只报告，没修）：**
1. **蝴蝶结尾带**：155 个顶点 100% 绑在 hips 上，坐着时穿过座面和座面下方，stand f0–48 都有。
2. **sit_corrective 的垂坠是按盒子座椅调的**，和真实椅子不符：
   - dress×座面 905 对（f0–44）；
   - dress×前沿 591 对，约 46 mm（f0–45）；
   - 臀下黄裙比身体低约 30 mm。
3. **4 权重限制带来的问题**：pass2b 原始权重下坐姿 legs×dress 为 0；限到 4 个并归一化后，legL×dress 变成 78 对。黄裙有 1,432 个顶点、围裙有 180 个顶点超过 4 个权重，需要模型侧按 Cocos 4 权重重新调权重后再验收坐姿。
   - 加上我对腿做的 IK（脚踩真实地面、收脚 75 mm），stand f0–72 的 legs×dress 和 legs×apron 有 790–860 对和约 290 对。
4. torso×dress：坐姿就有 16–18 对（f0–81），pass2b 原始权重下也一样。
5. torso×apron：rest 姿势就有 4 对（stand f79–90，turn 全程）。
6. 坐下时上身、帽子和头发会进入椅背的 col 代理盒，最多约 27–28 mm（f0–22）。但和**真实椅背网格是 0 交叉**，所以只是代理盒偏保守。
7. 坐姿裙子不是自然垂到椅子前沿，是皱成一团、左右不对称（见 A_seated 特写）。这不符合 Funning 的决定 3。

**B. 动画层面（我负责，还没修完）：**
1. 起身前倾时手压进大腿：handL×legL 134 对、handR×legR 136 对（f23–41）。前臂已经往回收了 45°。
2. 转身时两腿内侧互穿：legL×legR 96 对（f6–38）。原来 3 步时是 180 对，改成 4 步后降到这个数。
3. 鞋底贴地：浮点级 ≤0.05 mm，属于“不可见贴合 ≤2 mm”，单独列出。

**C. 已经为 0 的项**：
- 和真实椅腿、椅背网格；
- 带扶手椅变体的扶手网格（游戏里没摆这个变体，只用来检查）；
- 侧桌、门、墙；
- turn 的手×衣裙、腿×衣裙、地面；
- stand 后半段的地面（v1 里裙摆曾穿地 60 mm，已修好）。

## 5. 这一轮在动画侧修了什么
- 修了 turn 首帧被错录成坐姿的 bug（NLA 轨在烘焙时被重新求值）。
- 起身终点改成精确的 standingRoot，靠先收脚 75 mm 实现。
- 时长按 R24 改为 3.0 s + 1.5 s。
- 裙子和 `sit_corrective` 的释放改为跟着髋部高度走，不再让裙摆穿地。
- 前倾时收前臂。转身改为 4 步，脚和身体朝向的差不超过约 25°。
- 末帧做成干净的 rest。
- 坐姿高度改为按真实椅面贴合。

## 6. 冲突和备注
- 位移来源：按 0006 v1.1 烘焙在根骨上，另外导出参考 root 曲线。这和 Oi 写的“clip 原地、controller 独占”冲突，已在接单确认第 7 节记录。
- 椅子：游戏里摆的是**无扶手**椅，网格逐顶点一致；但 col_* 里有扶手盒，M01 也要求有扶手。扶手网格的检查已经做了，结果为 0。到底用哪把椅子，需要定。
- 骨骼名照旧：`hand.L` 是物理右手。
- 镜头（M3 再做，这里只记规则）：
  - 室内和门口，镜头永远不越到她左侧。出门以后可以从她右侧经右前方摆到海上，不越过她左侧的 180° 线，也不切镜。
  - 终帧在游戏现用的 v2.1 `combined_visual_m.glb` 上拟合参考图构图（GGbot 已核过，v2.2 的关键节点差 0.0000 m），写进 `island_camera_pose.json`。
  - 室内 vFOV ≤75°，每段最后一帧 45°。

## 7. 需要对齐（停在这里）
1. Grok Bot（模型）：按 §4-A 处理。重点是：
   - 尾带的权重；
   - 按**真实椅子**（座高 0.38、面 0.4946×0.3815、有靠背）重做 `sit_corrective`，裙子要自然垂到前沿；
   - 在 4 权重限制下重新验收坐姿。
2. 我：等模型更新后修 §4-B 的两项（手×大腿、两腿互穿），然后整条流程重跑，版本记为 v2。
3. 待定：用不用扶手椅。

## 8. 验证范围
| 项目 | 状态 |
|---|---|
| 逐帧穿模（全帧，30 fps）、阳性对照、锚点、末帧、骨骼数、GLB 重新导入 | passed(Blender)；全帧穿模为 0 这一项：**FAILED** |
| Cocos 3.8.8 导入、蒙皮、morph 动画播放 | not_run |
| 微信 DevTools、真机 | not_run |
