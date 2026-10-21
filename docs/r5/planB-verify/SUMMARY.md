# Plan A fix1 / Plan B cand2 验收 + 关节上限 + 飘带方案 + 过渡裙子×身体修复 (2026-10-21)
所有 QA 30fps 逐帧；交叉淡化 0.2 s（xfade4 模拟 CharacterMotion）。基准 v4 = cand3_dense 动作 + v4 网格（q5_v4.json）。

## 1 Plan A anim_meta_planA_fix1.json
- sha256 3b85b0cd98257f9e03f65b8061f9ca820a3c41d825dbc15c4bef908f6f4e5a68 ✔（以 3b85b0cd 开头）
- 和 anim_meta_planA 相比只加了 3 处登记：APRON.sit_drape_blend_comp:29, DRESS.sit_drape_blend_comp:32, BOW {bow_sit_drape:0,bow_stool_fix:1}；对 GLB targetNames 全部正确，没有没登记的曲线 → PASS（planA_fix1_meshes_check.txt）
- 曲线没变 → 合入后的权重 = 上次的 fixed 配置。重跑 q_Afix1.json：蝴蝶结×凳子 sit_down 最多 88（f24–35）、stand_up 44（f1–9），sit_hold 0 → **FAIL（方案B解决）**。其余同上次（凳子 0、手 0、间隙 0.69/0.66 mm、接缝 0.088°/0 mm）。
- 附带发现：plan A 的 BOW 边长形变最多 230%（sit_down），walk 中 64%（BOW 蒙皮在裙骨上被拉扯）；plan B 降到约 3%。

## 2 Plan B cand2 (planB_cand2.glb sha256 ea4524620d8886bcaad2668877ee519a9a8c78ed9762e8e75b12e2d47b4b2b07, 3,121,832 B; meta sha256 9d0ac694…f383)
- 来源：14 段 × 原有 30/84 通道与 hipsway65 cand1 逐 accessor 完全一致；只多了 ribbon 的 2 个通道（cand2 稀疏化，常量 1 key）；与 cand1 只在这 2 个通道上不同。29 关节，ribbon=index 28（parent hips）；前 28 个 IBM/rest 不变。没有显式写 interpolation 的 sampler（0 个）。BOW 的 JOINTS/WEIGHTS 改了（绑到 ribbon）。
- morph.meshes：所有 target 都登记且索引正确（APRON 30、DRESS 33、BOW 3 = bow_sit_drape:0, ribbon_bend_half:1, ribbon_bend:2）→ PASS
- 坐姿三段 + 交叉淡化：
  - 裙子/围裙/蝴蝶结/身体×凳子 全程 0 PASS
  - 手/前臂×布料/身体 0（三段 + 31 个淡化帧）PASS；sit_hold 手间隙 0.69/0.66 mm PASS
  - 接缝 0.088°/0 mm、morph 差 0 PASS；脚/膝/手腕运动与 plan A 逐帧完全相同（已验证）→ 滑步、手腕标准同 plan A（stand_up PASS；sit_down 落手 f29/34–36 比原版快 0.2–0.5 mm/帧，同上次）
  - 过渡 裙子×身体：sit_down 398/7164 vs v4 393/5744（22 帧超）；stand_up 378/3998 vs 242/2696（15 帧超）→ accepted, deferred（第 5 项尝试未成功）
  - 裙子×围裙 sit_down 36 vs 49 ✔；stand_up 138 vs 158 峰值 ✔ 但 4 帧超；围裙×身体 不超
- 飘带（BOW）：
  - ×身体 0、×手 0、×凳子 0（坐姿三段 + 所有走路/转身/idle/door）PASS
  - **×裙子 FAIL**：walk_start f40–57 最多 32、walk_loop f2–3,f28–37 最多 34（hipsway65/plan A 为 0）
  - ×围裙：28–44 每帧都有，包括 idle（plan A 同样 28），是蝴蝶结结点和围裙腰带的建模接触，不是新问题
  - 拉伸：坐姿最大 2.81%（sit_hold f11–19），走路最大 3.23%（walk_stop_bodyL f12），walk_start/loop 2.97% → **超过声称的 ≤2.8%**（指标：BOW 网格边长相对静止的最大变化，含 morph）
- 走路（hipsway65 基础）：手×裙子/围裙 0，裙子×身体与 hipsway65 完全相同，动作字节一致 → 滑步不变 PASS
- 文件：perframe_planB2_clips.csv, perframe_planB2_crossfades.csv, q_B2.json, w_B2.json, xf_B2/（每帧 game+hands 图）, hands_planB2.mp4, game_planB2.mp4

## 3 Cocos 3.8.8 关节上限（cocos-engine tag v3.8.8, 411f98d）
- cocos/rendering/define.ts:600 `JOINT_UNIFORM_CAPACITY = 30`（旧常量）；实际用 UBOSkinning.JOINT_UNIFORM_CAPACITY（define.ts:653, initLayout 676–681），运行时按设备算：
  - custom pipeline（本项目 settings 用 custom-pipeline）：cocos/rendering/custom/web-program-library.ts:915 `maxJoints = floor((maxVertexUniformVectors - 38)/3)`，上限 256（注释 914：128 个向量时 = 30）
  - root.ts:809–815 `_resizeMaxJointForDS`：floor((maxVertexUniformVectors - max(used,100))/3)，root.ts:317 初始化时调用
- 超过时：cocos/3d/models/skinning-model.ts:146 `if (JOINT_UNIFORM_CAPACITY < skeleton.joints.length) this._realTimeTextureMode = true` → 关节矩阵写进 256×3 的 RGBA32F 纹理（skinning-model.ts:82–85），设备不支持浮点纹理采样时退回 RGBA8888（skinning-model.ts:314–316）。不会报错或丢骨，只是换路径。
- 结论：29 或 30 个关节都可以。最低规格 WebGL1 设备（128 个顶点 uniform 向量）在 custom pipeline 下正好 30；常见手机 ≥256 个向量 → ≥52（DS 公式）或 72（custom 公式）。即使超出也会走纹理模式。未在微信真机测；RGBA8888 退化路径精度较低（理论风险）。

## 4 飘带动画方案（未制作）
- 现状：风只有标量强度 WorldFlowComponent.getWindStrength() 0..1（world-r1/WorldFlowComponent.ts:189），由 WorldIntegrationBoot.ts:523 setWindSource 传进 CharacterMotion.tick(dt,ds,wind)（CharacterMotion.ts:292–299）；windDrive()=max(风, idle 阵风)（:312）；风层 = wind_flutter_loop 等加性层，按 mask 驱动（默认 ['skirt*','apron*','hair*']，:34；anim_meta wind.mask 可覆盖，:175）。**没有风向**，风层按身体局部方向写死。
- 建议（推荐 A + B）：
  A. 离线烘焙二阶跟随：ribbon 对 hips 角速度/加速度做阻尼弹簧（ζ≈0.5，f≈1.6 Hz，限幅 ±12°），14 段逐段烘焙，在接缝处让状态连续（walk_loop 循环烘 3 圈取最后一圈）；sit_hold 加 0.3–0.5 Hz、±1.5° 的轻微摆动（Grok Bot 要求）。不改 CharacterMotion（冻结），淡化由现有骨骼插值处理。
  B. 风：把 'ribbon*' 加进 anim_meta wind.mask，在 wind_flutter_loop / wind_sway_loop 里给 ribbon 写加性摆动，强度跟随 windToFlutter；风向固定（向后），因为引擎拿不到风向。若以后要真风向，需要 WorldFlow 暴露 getWindDir 并改 CharacterMotion（冻结文件，需 Cursor）。
  运行时代码弹簧：效果最好、0 文件体积，但要改冻结的 CharacterMotion.ts，并在 baked 模式下失效 → 不推荐作为第一步。
- 体积：14 段共约 20.5 s + wind_sway ≈ 650 帧。ribbon 1 个旋转通道，按 0.3° 容差压缩通常是 1/3–1/5 关键帧：≈ 130–220 个 key × 20 B ≈ 3–5 KB（完全不压缩上限约 13 KB）；ribbon_bend/half morph 曲线在 anim_meta 里另加 ~2–4 KB JSON。远低于 600 KB 预算。
- 飘带当前 BOW×裙子（走路）和拉伸 >2.8% 需要先由角色建模bot 修权重或碰撞，否则摆动只会更糟。

## 5 过渡裙子×身体（动画侧）— FAIL，2 次尝试后停止
- 定位（diag_B2.json vs diag_v4.json）：
  - sit_down f17 峰值 398（v4 393）：99% 是 dress 的 hips 权重区域 × 身体臀部/腰（hips/spine 权重）背侧。两者都刚性跟随 hips，骨骼动画改不动 → 只能布料/形态键解决（v4 同样 393）
  - sit_down f26–35、stand_up f2–11 的增量：**skirt.back / skirt.back.low 面板 × 两条大腿背面（坐下时大腿下侧）**；v4 在这些帧里 skirt.back 接触为 0。另有 dress hips 区域 × 臀部
- 尝试 1、2（skirtfix.py，sf1.json/sf2.json）：skirt.back(+.low) 在 sit_down f18→26 渐入、f33→36 渐出到 0，stand_up f0→3 渐入、f10→16 渐出（接缝差 0）；绕局部 X/Z ±3–8°，以及 .low 反向。
  - 减少裙子×身体的方向（+X）都把裙子压进凳子：例如 +8°：stand_up 裙子×身体 378→289，但裙子×凳子 0→466；+3°：裙子×凳子 201。反方向则裙子×身体更多（565）。
  - 结论：skirt.back 面板被夹在大腿下侧和凳面之间，没有空间，骨骼旋转只能把穿模从身体挪到凳子。未做 cand3_anim GLB（没有可交付的改进）。杠杆 2（时间调整）、3（≤2–3° 大腿/骨盆）没有试（已到 2 次上限）；而且杠杆 3 要让大腿离开面板必须抬骨盆，接缝差必须为 0，f34–35 也仍需恢复。
  - 建议：由角色建模bot 在 sit_drape 过渡中把 skirt.back 区域做薄/贴凳（或给 skirt.back 一个随 sit_drape 权重的形态键），或者重新定义基准（v4 网格本身的裙子背片更薄）。
