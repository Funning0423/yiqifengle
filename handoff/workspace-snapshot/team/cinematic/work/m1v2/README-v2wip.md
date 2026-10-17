# 运镜bot M1 v2-wip（工作副本，不是交付）：坐 → 起身 → 左转

- 编写：运镜bot，2026-10-09 17:50 CT，Blender 4.5.14。
- 范围：只改了 `team/cinematic/work/m1v2/` 和 `team/cinematic/yunjing-notes/`。v1 outbox 没动。没有改工程、.scene、.meta、UUID，没有改人物源文件（用的是 `src_copy` 副本），没有上传、发布或发消息。
- 基底仍是 pass2b（v1 同一个人物）。按 17:02 的指示，**这一版没有调任何裙子相关的东西**。pass2c 到了以后换基底，整条流程重跑，作为 v2。
- 状态标记：`passed(Blender)` = 只在 Blender 里验过；Cocos、DevTools、真机都还是 `not_run`。
- **M1「全帧零穿模」仍然没有通过（FAILED）。** 剩下的全部是模型侧问题，外加 1 项 ≤0.04 mm 的鞋底贴地（见 §4、§5）。

## 1. 基底和替换方法（drop-in）
| 输入 | SHA256 |
|---|---|
| pass2b 源（副本）`src_copy/B_R5G2_FIX_PASS2B_SOURCE_grokbot2.blend` | b5df09f878458247b36136a9b2717bf141ad34c2dad03043c2c50e95ba9841f3 |
| pass2b `src_copy/p2_poses.py`（SIT 姿势） | 040814c1259a1779ed6354303132b8530c8e5f3d3459238daf489ec59256cf64 |
| R24 视频审阅笔记 `team/cinematic/yunjing-notes/01-R24-video-review.md` | 436245386c870b80506870e401e30451212a38c2275af927fcadc2353c3bd43b |
| 0006 v1.2 `team/ggbot/outbox-to-dot/CINEMATIC-INTEGRATION-PLAN-0006-v1.2.md` | 444b7a55639b1582e07cad532675e936646c0c0ced238200839faefa404e6f9d |

```
cd team/cinematic/work/m1v2
CHAR_BLEND=/abs/path/pass2c.blend SIT_POSES_PY=/abs/path/p2_poses.py ./run_all.sh v2      # build_scene → anim_build → anchors → 逐帧检查 → 汇总
# 全局缩放开关（默认 bakeK，不另外缩放）：CHAR_SCALE_MODE=bakeK|removeK CHAR_SCALE=<系数>
./probe/package.sh   # 冻结 blend → 导出 GLB → glb_probe → timing → 接触报告 → v1 对比 → 连续性 → 关键帧渲染 → 视频（先把脚本里的 T= 改成新 tag）
```
- build_scene 会从当前模型**重新计算**蝴蝶结尾带的顶点（hips 主导、低于 0.97·身高、在身后），并把 blend 路径和 sha256 写进日志。
- 坐姿 root 也会按真实椅子重新推导（§2.3），所以重新做的 `sit_corrective` 和新权重可以直接放进来重跑。
- 动画参数都有环境变量：`HAND_LIFT`=0.008、`HAND_OFF`=0.05、`STEP_WIDTH`=0.05、`ARMFIX`=0（旧的前臂抬法，已停用）。

## 2. 相对 v1 的改动（都是动画侧）
### 2.1 手压大腿 → 手掌贴大腿、滑到膝盖、借力起身（a）
- 两段骨 IK：
  - stand f0 记录手相对大腿的位置和朝向；
  - 肘的 pole 方向取胸腔坐标系里坐姿时的肘线，**所以肩、臂没有往外推**。
- 手的路径：
  - f10–24 抬起 8 mm；
  - f15–40 沿大腿滑到膝盖（0.82×大腿长）；
  - f44–58 沿大腿表面法线离开 5 cm；
  - f58–74 松开，手臂 f52 起回 rest，一直延续到 turn f10。
- 时序参考 R24（手先在大腿上，滑到膝盖后借力），姿势是自己解的。裙子没有缩。

### 2.2 转身两腿互穿 → 修正迈步顺序和步宽（b）
- 根因：v1 左转时先迈 foot.L（解剖学右脚），右脚从左脚前面交叉过去，两只鞋尖在中线前 13.5 cm 处相撞。
- v2：
  - 解剖学左脚（骨骼 foot.R）先迈：f2–12、f22–33；
  - 右脚跟进：f12–22、f33–43（最后一步落地 f43）；
  - 每一步中段向外张开 5 cm（sin 曲线，起止都是 0）。
  - 3 cm 时 f21–23 还剩 19 对，5 cm 时 0 对。
- 转身期间脚 IK 最大误差 3.75 mm（步幅中段，脚离地时）。
- **这些脚步是自己解的，不是 Oi 的数据**：Oi 的 `foot_support_plan` 从 4.58 s 才开始，只在 21.5 s 有 `heel_pivot`，起身和转身这两段都没有脚步数据。

### 2.3 坐姿 root 按真实接触推导（Oi 第 3 项）
- **座面（高度）**：坐姿状态下（身体不含蝴蝶结尾带，衣服按中面），用真正的三角–三角相交、二分法求出刚好不碰真实座面和前沿三角形的高度，再留 1 mm 间隙。椅背和椅腿不参与这一步。
- **椅背（水平）**：沿椅子前后方向移动，让身体和头发离真实椅背网格保持 5 mm；3 轮迭代后为 5.87 mm。
- **脚（地面）**：脚踩真实地面和地毯，用 IK。
- 结果（游戏坐标）：坐姿 root = (0.46267, −0.59137, −4.19391)，yaw −2 rad。
  - 和 R24 坐姿 root (0.43273, 0, −4.20761) 比：**水平差 32.93 mm，方向朝椅背**。
  - 高度比 v1 的 −0.62912 **高 37.75 mm**，比 pass2b 设计值 −0.6462 高 54.9 mm。
- v1 偏低的原因：v1 用射线测座面间隙，取样范围只到椅子局部 y<0.12，**没测到臀部后侧**。那里实际穿进座面约 15 mm，而深度估计又饱和在 19 mm，把问题盖住了。
  - v2 先试了带法线过滤的射线（v2f），结果碰到座面和椅背的接缝，把人抬高了 +50 mm，错了。最后改成真三角相交（v2g）。
  - 复核：v2g f0 时射线间隙 1.000 mm；再往下 5 mm 就会和座面后部（y 0.05–0.19）相交，再往下 20 mm 头会碰到椅背。
- ⚠ 影响：回家跳过的检查点原定 = 坐姿 root (0.4327, 0, −4.2076)。现在推导出的坐姿 root 差了 32.9 mm。请工程决定改用新值，还是放宽容差。

### 2.4 片段之间速度连续，结尾不停在 rest（Oi 第 6 项）
- stand 末尾不再停 6 帧 rest：
  - 根位置按 R24 进度覆盖完整 3.0 s；
  - 手臂摆动延续到 turn f0–10；
  - 腿一直用 IK 到 f90（v2d 在 f78–88 把腿混到 FK rest 时，鞋底最多陷进地面 1.19 mm，所以去掉了这段混合）。
- 连续性检查 `report/continuity_stand_to_turn.json`：
  - stand f90 和 turn f0 的姿势跳变：所有骨骼 0.000°，位置 0.001 mm；
  - 角速度最大不一致 hand.L 1.14 → 0.99 °/帧；线速度差 0.86 mm/帧。
- 两个单帧安全收尾（跳过时用，干净，在锚点上）：
  - `cine_open_safe_end`：站立 rest，位置 standingRoot，朝向 walkYaw。M1 暂定，M3 移到 exit_path_17。
  - `cine_home_safe_end`：坐姿 f0 姿势，放在推导出的坐姿 root 上。
- 交接处的裙子：裙子形态跟着 zprog 走；因为时间轴连续了，zprog 的终点从 v1 的 f80 移到了 f86。这只是时间轴的连带变化，不是调裙子。

### 2.5 检查器（Oi 第 5 项）
- 新增：
  - 真三角–三角相交（BVH overlap，和 v1 一样）；
  - **薄片自交**：`thin_sheet:dress_self`、`thin_sheet:apron_self`，共用顶点的三角形不算；
  - **层间穿越**：`layer_cross:apron_vs_dress`，以 rest 为基准，看围裙顶点有没有跑到黄裙里面。
- ≤2 mm 不自动算通过，逐条列在 §5。
- 阳性对照全部检出（`passed(Blender)`）：
  - 座面下注 30 mm：body×seat 133 对，dress×seat 822 对，地面以下 111 个顶点、30.0 mm；
  - 地面下注 20 mm：103 个顶点、20.0 mm；
  - 围裙往后注入黄裙 15 mm：层间穿越 318 个顶点、12.56 mm，三角对 580；
  - 合成薄片交叉：预期 1，检出 1；
  - legL×legL_ctrl 每帧都检出。
- 椅子：游戏里的椅子没有扶手（16:59）。`col_int_chair_armrest_l/_r` 不参与判定，`col_int_chair_back` 照常参与。扶手版网格的检查保留为**仅供参考**（`info_chair_variant:*`）：全帧 0 对。

## 3. v1 → v2 对比（中面 = 游戏模式；三角对：单帧最大 / 全片段累计，帧范围）
完整对比在 `export/report/compare_v1_vs_v2g.txt`。
| 片段 | 类别 | v1 | v2-wip (v2g) |
|---|---|---|---|
| stand | **手×大腿 handL×legL** | 134 / 1664，f26–41 | **0** |
| stand | **手×大腿 handR×legR** | 136 / 1785，f23–41 | **0** |
| turn | **两腿 legL×legR** | 96 / 948，f6–38 | **0** |
| stand | body×椅座（不含蝴蝶结尾带） | 34 / 960，f0–30，约 19 mm（饱和） | **0** |
| stand | body×椅座（含尾带） | 92 / 3291，f0–48 | 72 / 1931，f0–48，14 mm（全是尾带，模型侧） |
| stand | dress×椅座 | 905 / 17752，f0–44 | 623 / 6354，f23–45（f0–22 已为 0） |
| stand | dress×前沿 | 591 / 8565，f0–45，46 mm | 546 / 5609，f27–45，19 mm |
| stand | apron×前沿 | 6 / 6，f31 | 10 / 20，f32–33，0.00 mm（≤2 mm，逐条列出） |
| stand | legL×dress / legR×dress | 832 / 863 | 813 / 804（f0–75） |
| stand | legL×apron / legR×apron | 289 / 288 | 291 / 288（f21–75） |
| stand | torso×dress | 18，f0–81 | 18，f0–85 |
| stand | torso×apron（rest） | 4，f79–90 | 4，f82–90 |
| stand | apron×dress | 604 | 586 |
| stand | 薄片自交 dress / apron（新） | — | 2676 / 115，f0–63 / f0–65 |
| stand | 层间穿越 apron vs dress（新） | — | 47 个顶点，29 mm，f0–67 |
| stand | 地面（body 在地面以下） | 0 | 0（v2d 曾有 1.19 mm，已修） |
| turn | torso×apron（rest） | 4，f0–45 | 4，f0–45 |
| turn / stand | 鞋底×地板 env shell | 5，≤0.05 mm | 5，≤0.04 mm（≤2 mm，逐条列出） |
| 代理盒 | body×col_chair_back / hair×col_chair_back | 419 / 1188 | 377 / 906（真实椅背网格 0 交叉，身体离椅背 5.87 mm） |
| 代理盒 | body×col_chair_seat / dress×col_chair_seat | 182 / 1485 | 19 / 860 |
| 安全收尾 | cine_open_safe_end | — | 只有 torso×apron 4 对（rest，模型侧） |
| 安全收尾 | cine_home_safe_end | — | 坐姿的模型侧问题：legs×dress、torso×dress、dress 薄片、层间穿越、尾带×座面 |

## 4. 剩余问题
### A. 模型侧（pass2c 修，只报告，没动）。证据见 `export/report/attribution_v2g.txt`
1. **蝴蝶结尾带**绑死在 hips 上：stand f0–48 穿进座面，最深 14 mm；占 body×chair_seat 剩余的全部。
2. **legs×dress 和 legs×apron**（可见网格 76–80 / 65–80 mm，中面约 800 / 290 对，f0–75）：根因是 `sit_corrective` 和裙子骨骼是按 pass2b 的盒子座椅和水平大腿做的。
   - 用同一帧、**原始权重**重跑：legs×dress 781/792 对，4 权重时是 813/804；legs×apron 两者一样，都是 291/288。**所以 4 权重限制不是主要原因**（这一条更正了 v1 的说法）。
   - f0–20：腿换回 pass2b 自己的 FK 坐姿后，只剩 legL 78 对（这 78 对就是 4 权重带来的）。
     - 我们的腿不一样，原因是真实座面要求 root 比 pass2b 设计值高 54.9 mm（真三角相交拟合）。
     - 要让脚踩到真实地面，大腿只能往下斜。
     - 这属于「sit_corrective 按真实椅子重做」，即 pass2c 第 2 项。
   - f23–75（起身过程）：裙子保持坐姿、完全放开、或者现在的过渡混合，三种情况下都会被抬起的腿穿过。需要一个能支持起身动作的 sit_corrective 或裙子绑定（模型侧）。调裙子骨骼或 morph 的时序属于调裙子，按指示在 v1 基底上不做。
3. dress×座面和前沿（f23–47）、层间穿越（f0–67）、薄片自交（dress f0–63，apron f0–65）、坐姿裙子皱成一团（不符合 Funning 的决定 3）：都属于同一个 sit_corrective 问题。
4. torso×dress：坐姿就有（f0–85），原始权重下一样是 18 对。
5. **torso×apron 在 rest 时就有**：4 对、6.29 mm，可见网格 9.23 mm。出现在 stand f82–90、整个 turn、open_safe_end（纯 rest）。原始权重下完全一样。属于模型的 rest 问题，pass2c 第 4 项。
6. apron×dress：586 对，原始权重下 519 对（全片段累计 18122 → 8894，这一项有一半来自 4 权重）。
7. **body×椅背**：
   - 和**真实椅背网格**每一帧都是 0 交叉（body、dress、apron、hair 都是），坐姿时离椅背 5.87 mm。
   - 和 `col_int_chair_back` 代理盒（113×495×512 mm，比真实椅背厚）有接触：
     - f0–15：377 个顶点在盒内（头和帽子 353 个），20.8 mm；
     - f32：63 个顶点（蝴蝶结和尾带），45.2 mm；不算尾带时 32.5 mm（f30）。
   - 要让代理盒也清零，就得坐到离真实椅背 30 mm 以外，这和 Oi 第 3 项（按真实接触推导）矛盾。所以只是代理盒偏保守，报告但不改。

### B. 动画侧（我负责）
1. 鞋底×地板：5 对，深 0.00–0.04 mm。都是 foot.L 的鞋底和地板共面：
   - stand f23–90 断续出现；
   - turn f0–10；
   - turn f43–44 为 0.04 mm（最后一步落地）。
   - 提议：所有脚 IK 目标整体抬 0.2 mm。不影响 root 锚点，pass2c 重跑时一起处理。
2. apron×前沿 f32–33：10 对，0.00 mm。是起身时围裙擦过前沿，和裙子形态（模型）相关。按指示没调。
3. 其余手、腿、地面、连续性方面的问题已经清零。
4. 观感（不是穿模）：坐姿 f0 时双手本来就在膝盖附近，所以「滑向膝盖」的位移很小，借力起身的动作在画面里不明显。手臂保持坐姿的肘线，没有往外推。如果要更明显的撑膝动作，需要 Funning 认可坐姿的手位。

## 5. ≤2 mm 项逐条（不自动算通过；完整清单 `export/report/contact_report_v2g.json`，共 90 段，其中 37 段 ≤2 mm）
- `env:body×env_interior_shell`（同一批三角对，`body_nobow` 也一样）：
  - stand f23、26、28、30、35–36、41–47、50、56–58、62、65–67、71–72、76、81–83、85–90，各 5 对，0.00 mm；
  - turn f0–8、f10 各 5 对，0.00 mm；
  - turn f43–44 5 对，0.04 mm。
  - 全部是 foot.L 鞋底贴地。
- `chair:body×chair_seat` stand f48：6 对，0.00 mm（蝴蝶结尾带最后一次接触）。
- `chair:apron×chair_front_edge` stand f32–33：10 对，0.00 mm。
- `garment[visible]:legL×dress` cine_home_safe_end：1042 对，0.00 mm（坐姿，模型侧 §4-A3）。

## 6. 锚点和 root（`export/report/anchors_v2g.json`、`export/clips/*.root_poses.json`）
- 时长：stand 3.0 s（f0–90），turn 1.5 s（f0–45）。
- 0006 v1.2 A2：每段首帧 root 的水平位置和 yaw 都是 0（只有高度可以不为 0），由 GLB 实测验证。rootStart / rootEnd 已写入每个 timing.json（游戏坐标）：
  - stand：rootStart (0.46267, 0, −4.19391)，yaw −114.5916°（= −2 rad）→ rootEnd (−0.016249, 0, −4.413085)，yaw −114.5916°。
    - 和 standingRoot 差 0.000 mm、0°；和 Oi §4 的 R24 站姿 root 差 0.093 mm。
  - turn：rootStart = standingRoot → rootEnd = standingRoot，yaw −2.8290°（= walkYawRad −0.049376），误差 0.000 mm、0.000°。
  - open_safe_end = turn 的 rootEnd；home_safe_end = 坐姿 root，高度 −0.59137。
- GLB：
  - 4 段动画，每段 80 条通道，其中 weights 通道 2 条；
  - `sit_corrective` 只在 G2_DRESS 和 G2_APRON 上（身体和头发没有 morph）；
  - 骨骼 26 根（上限 60）；根缩放为 1；每个顶点最多 3 个权重。

## 7. 转身方向（核对场景几何）
- 结论：**左转（从上往下看逆时针，yaw 增大）111.76°**，保持 v1 的方向。
- 依据：
  - 起点朝向：seatYaw −2 rad，游戏坐标朝向 (−0.909, −0.416)。
  - 终点朝向：walkYawRad −0.04937，朝向 (−0.049, 0.999)，指向门、走路的终点（门在椅子的 +Z 方向）。
  - 叉积 y = +0.93，是逆时针，也就是向左，转 111.8°；向右要转 248°。
  - R24 的 `root_reference_curve` 里 yaw 也是从 −2 到 −0.0494，同样是左转。
  - Oi §3 写的是「3–4.5 左转」；需求原文是「随后向左转」；WorldFlowCore 用的是 `direction:'left'`。
- R24 视频「看起来向她右边转、以左脚为轴」，很可能是 L/R 骨骼命名或画面镜像造成的错觉。
  - 本流程里骨骼 `foot.L` 是解剖学右脚。
  - 所以 R24 只用来参考时序，不参考姿势。

## 8. R24 视频审阅要点（全文见 `yunjing-notes/01-R24-video-review.md`）
- 起身在 f10–40：手先在大腿上，滑到膝盖后借力，身体前倾约 45°，脚大约在 f17 往后收。
  - v2 的时序跟它一致：前倾 f15–42，手滑到膝盖 f15–40，收脚 f5–27。
- R24 本身穿模很严重：
  - 裙子穿过座面；
  - 约 f25 手插进大腿；
  - 转身约 f75 时裙子夹在两腿之间；
  - 关门时门穿过帽子、蝴蝶结和裙子；
  - 坐下时裙子穿过座面。
  - 所以不照搬它的姿势。

## 9. 其他说明
- 「镜头在她右边」指的是相对她**当前**的朝向（Oi 第 4 项）。转身之后，「右边」跟着她转。等做镜头时照这个执行。
- M1 还没做镜头：`fovVerticalDeg` 全是 45，`cameraAuthored:false`。
- `seatOffFrame` = 49：按全身（含蝴蝶结尾带）最后一次碰椅子计算。不含尾带的话，臀部在 f30 前后就离开座面了。
- M3 相关的约束记在 `yunjing-notes/02-M3-plan-notes.md`：0007 v1.1–v1.3，NDC y > −0.5，镜头 pose 只有 position、target、FOV，roll 检查等。

## 10. 文件
- `export/clips/cine_m1_open_stand_turn.glb`（同目录还有 `.root_poses.json`、`.reimport.json`）
- `export/blend/cine_m1_v2wip.blend`：GLB、渲染、视频都从这一份导出。
- `export/timing/`：4 个 timing.json，另有 `cine_m1_reference_root_curve.json`。
- `export/report/`：
  - 逐帧检查 `clipping_per_frame_v2g.json`；
  - 汇总 `clipping_summary_v2g.txt`；
  - 对比 `compare_v1_vs_v2g.txt`；
  - 接触报告 `contact_report_v2g.json`；
  - 连续性 `continuity_stand_to_turn.json`；
  - 锚点 `anchors_v2g.json`；
  - 构建日志 `anim_build_log_v2g.json`；
  - GLB 探查 `glb_probe_v2g.json`。
- `export/renders/`：12 个时刻 × 4 个视角。
- `export/video/cine_m1_v2wip_right34.mp4`（她的右前方，以坐姿朝向为准）和 `cine_m1_v2wip_front.mp4`：30 fps，stand f0–90 接 turn f1–45，共 136 帧，Workbench 渲染。为了看清接触，隐藏了墙、玻璃、杂物和猫。
- `scripts/`、`run_all.sh`、`probe/`（各轮日志）
- `SHA256SUMS.txt`：本目录交付文件的完整 SHA 清单。

## 11. pass2c 到了以后
1. 校验 `art/character/r5-fix-g2/pass2c/` 的 SHA（等团队贴出来）。
2. 运行 `CHAR_BLEND=… SIT_POSES_PY=… ./run_all.sh v2`，再运行 `package.sh`。
3. 验 GLB：morph 只在实际变形的裙子和围裙上。
4. 脚 IK 抬 0.2 mm（§4-B1）。
5. 复核 §4-A 的每一项。
6. 打包到 outbox 作为 v2：GLB、blend、视频、接触报告、完整 SHA。
