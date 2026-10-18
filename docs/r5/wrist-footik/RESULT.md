# r5 A1 — 手腕补丁 / 脚部 IK 锁脚 / 骨盆下沉（候选，不进包）

- 分支 `anim/r5-wrist-footik`，基线 `gbt/r5-integrated-b07-wip` @ `bc81575f`
- 作者：角色动画bot　日期：2026-10-18
- **冻结核对**：`tools/journey-integration/frozen-production-inputs.json` 里包含
  `region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb`、`anim_meta.json`、`CharacterMotion.ts`。
  三项要改的文件全在冻结清单里 → **本分支只提交本文档和对比图，没有改任何生产文件**。
  候选 GLB、脚本、全部 QA 数据在 box `/workspace/yiqifengle/previews/角色动画bot/r5-wrist-footik/`（不进仓库）。
- 骨骼左右是反着标的：**bone `.L` = 她的右侧，bone `.R` = 她的左侧**。下文一律写「她的右手（hand.L）」这种写法。

## 0. 先说一个和派单前提不一致的地方
派单写的是 walk 4 段里手绕手指轴扭了约 155–165°。在 `bc81575f` 的 GLB 上实测（`twist_probe.py`，按骨骼 Y 轴分解扭转）：

| 片段 | 她的右手 hand.L 扭转 | 她的左手 hand.R 扭转 |
|---|---|---|
| idle / 4 段转身 | +3.3° | +2.0° |
| walk_loop | −25.0° | −27.3° |
| walk_start | 3.3° → −24.7°（渐变） | 2.0° → −27.3° |
| walk_stop L/R | −25° → 3.3°（渐变） | −27° → 2.0° |

所以 r5 上残留的扭转差约 **28°**，不是 160°（`/workspace/research/wrist/` 的图和数字是旧身体、旧 walk_loop 上做的，当时那版 walk_loop 至少有 26 帧，现在是 43 帧的 mocap 版）。
在 r5 上真正看得出的「歪来歪去」是下面三个问题，候选修复也是针对它们的：
1. walk_loop ↔ 四段转身交接时，手相对前臂差 **43.6° / 42.3°**（她的右手 / 左手）。
2. **单帧跳变**：walk_start 第 38→39 帧前臂跳 58°（手跟着跳 55°）；walk_stop_bodyL/R 第 31→32 帧跳 49–64°；stand_up 第 4→5 帧前后臂和手跳 49–66°；sit_down 第 1–3 帧跳 20–30°。
3. **手扫进裙子**：她的右手（hand.L）在 walk_loop 里**每一帧**都有顶点在裙子/围裙里面（3273 个顶点·帧），walk_start 后半段、stop 前半段也是。对比图 T2 左半边第 37–42 帧，她的右手整只没进裙子里。

## 1. 手腕补丁（候选）
做法（`wristfix.py`，全部烘成 30 fps 逐帧关键帧，只拼回改动的片段，其余片段和网格、morph 逐字节不变）：
- walk_start / walk_loop / walk_stop_bodyL / walk_stop_bodyR：两只手的手指轴扭转改成 idle/转身的自然值（hand.L 3.3°，hand.R 2.0°），只动扭转，不动摆动。
- 单帧跳变：跳变 > 20° 且大于该片段中位数 3 倍的帧，把前后各 3 帧换成平滑过渡（smoothstep slerp）。walk_start f38、stop L/R f31、stand_up f4、sit_down f1–3、f19–20 都处理了。
- 外展：在 walk 4 段里给肩部加外展，从 0° 往上扫，取「扫裙 = 0」的最小值。walk_start 从 0.25 s 开始渐入（第 0 帧和 idle 完全一样），stop 从 0.45 s 开始渐出（结束帧和 idle 完全一样），walk_loop 全程都加。
  - **她的右手（upper_arm.L，局部 X 轴）：要 11° 才是 0**（6° 还有 740，8° 还有 145，10° 还有 1）。派单里说「8° 就是 0 次」，那是旧身体上的数，r5 上不成立。
  - **她的左手（upper_arm.R，局部 −Z 轴）：2°** 就是 0（基线的 walk_loop f26–29 有 45，stop_bodyR f4–11 有 233）。
- sit_down / stand_up 里单帧 163° 的手翻面：r5 上按胸腔空间逐帧看，**没有 163° 那么大的翻面**。真正有的是上面那几处 20–66° 的跳变，已经一起平滑。GLB 里 stand_up upper_arm 有 q / −q 的符号翻转（dot = −1，实际只转 1–9°），Cocos 的 slerp 会走最短路径，所以看不出来，就没动它。

### 扫裙穿插（手 + 前臂顶点在裙子/围裙里面的个数 ×帧，逐帧 30 fps，morph 按 anim_meta 曲线驱动）
| 片段 | 现状 她的右手 hand.L | 现状 她的左手 hand.R | 候选 hand.L | 候选 hand.R |
|---|---|---|---|---|
| walk_start | 1517 | 4 | **0** | **0** |
| walk_loop | 3273 | 45 | **0** | **0** |
| walk_stop_bodyL | 619 | 0 | **0** | **0** |
| walk_stop_bodyR | 278 | 233 | **0** | **0** |
| sit_down | 0 | 0 | 0 | 0 |
| stand_up | 1（f13） | 0 | 1（f13，没动） | 0 |

### 手腕连贯性
| 项目 | 现状 | 候选 |
|---|---|---|
| walk_loop ↔ 转身交接，手相对前臂（她的右手 / 左手） | 43.6° / 42.3° | 30.7° / 29.4°（剩下的是手腕摆动差，不是扭转） |
| idle→walk_start、walk_start→walk_loop、walk_loop→stop、stop→idle 交接 | ≤ 0.2° | ≤ 0.2°（没变坏） |
| walk_start 单帧最大跳变（她的右手 / 左手） | 55.3° / 29.1° | 12.4° / 7.3° |
| walk_stop_bodyL 单帧最大跳变 | 52.7° / 53.9° | 9.0° / 11.6° |
| walk_stop_bodyR 单帧最大跳变 | 61.0° / 39.8° | 12.2° / 6.1° |
| sit_down 单帧最大跳变 | 29.2° / 18.8° | 19.2° / 19.2° |
| sit_down→sit_hold、sit_hold→stand_up 交接 | 82° / 66–74° | 没动（坐姿另案） |

### 其他 QA（候选 vs 现状）
| 片段 | 腿出裙 | 脚滑 她的右脚 / 左脚 mm | 两脚重叠 | 上臂正面外展角最大值 hand.L 侧 |
|---|---|---|---|---|
| walk_start | 7 → 7 | 15.8/7.8 → 15.4/7.8 | 0 | 17.5° → **28.0°** |
| walk_loop | 9 → 9 | 11.1/2.6 → 10.6/2.6 | 0 | 17.5° → **28.0°** |
| walk_stop_bodyL | 0 → 0 | 9.7/7.9 → 8.8/7.7 | 0 | 14.4° → 25.1° |
| walk_stop_bodyR | 0 → 0 | 16.1/15.9 → 16.1/14.8 | 0 | 19.6° → 22.7° |

**要拍板的风险：** 她的右臂要外展 11° 才能完全不扫裙，正面看上臂和身体的夹角最大从 17.5° 变成 28°（转身片段本来最大也有 22–24°）。对比图 T2 右半边第 34–36 帧能看出右手离裙子稍远一点。我自己看的感觉是不算张开，但处在边界上。备选方案：外展 8° + 裙子/围裙侧面收窄约 1 cm（角色建模bot 那边），那样扫裙会剩下约 145，需要靠网格来消掉。

对比图（左 = 现状 bc81575f，右 = 候选；每个交接都是前一段最后 5 帧 + 后一段开头 5 帧；`herR` 是镜头在她右侧，看她的右手 hand.L；`herL` 是镜头在她左侧，看她的左手 hand.R）：
- T1 idle→walk_start：`img/T1_herR.jpg` `img/T1_herL.jpg`
- T2 walk_start 34–43（含 f38 跳变，进 walk_loop 段）：`img/T2_*.jpg`
- T3 walk_loop→walk_turn_90_bodyL：`img/T3_*.jpg`
- T4 walk_turn_180→walk_loop：`img/T4_*.jpg`
- T5 walk_loop→walk_stop_bodyL：`img/T5_*.jpg`
- T6 walk_stop_bodyR 27–36（f31 跳变）：`img/T6_*.jpg`
- T7 walk_stop_bodyL→idle：`img/T7_*.jpg`
- T8 sit_down→sit_hold：`img/T8_*.jpg`
- T9 sit_hold→stand_up（含 f4 跳变）：`img/T9_*.jpg`
- T10 stand_up→idle：`img/T10_*.jpg`

## 2. 脚部 IK 锁脚移植：只出方案（冻结 + 禁改文件）
- 参考包 `0001-foot-ik…patch`（5d7fbce）改的是 `CharacterMotion.ts`、`WorldIntegrationBoot.ts`、`anim_meta.json`、`test_locomotion.cjs`。其中 CharacterMotion.ts 和 anim_meta.json 既在冻结清单里，也是禁改文件，所以**没有移植进分支**。
- 在临时 worktree 里对 bc81575f 做了三方合并试验（`cherry-pick -n`，试完就删了）：CharacterMotion.ts 有 1 处大冲突，WorldIntegrationBoot.ts 有 4 处，anim_meta.json 有 2 处。原因是 **r5 已经有 `SoleContactSolver` 了**：混合之后在世界空间锁鞋底刚体接触点，有 turn landing / settle 计划，用的是 `anim_meta.sole_contact`。它是旧 `FootLock`（踝关节两骨 IK + `foot_ik`）的后继版本，两者都挂在 `render()` 里 `rig.apply()` 之后，同一个位置。
- **建议：不要移植旧 FootLock**，会和 SoleContactSolver 抢同一副腿。旧包里还有用的只有一样：`seatedOutfit` 坐姿换装时间点。它要等混元坐姿网格到了，再单独开一个提交。弹簧骨脚本（`art-src/proto/walk-sit/`）按要求不带。
- 如果一定要比较两种做法，得等冻结解除，由能改 CharacterMotion.ts 的人在 SoleContactSolver 上做 A/B，用 `tools/walk-driver/test_locomotion.cjs` 的 `slideOf` 量。
- 运行时滑步没测：`node tools/walk-driver/test_walk_driver.cjs` 在**未改动的 bc81575f** 上就失败，报 `returnHome {"ok":false,"reason":"TypeError: Cannot read properties of undefined (reading 'points')"}`，所以拿不到运行时滑步的数（typescript 用的是 `/tmp/qfts/node_modules/typescript`）。

## 3. 起步、转身中段滑步：骨盆下沉原型（评估结论：这一版不建议用）
r5 上**动画片段本身**的滑步（脚底接地点、根运动按 anim_meta 走，2 次采样/帧）：walk_start 15.8 mm，walk_turn_90_bodyL **36.9 mm**（她的右脚），walk_turn_180_bodyR 17.6/19.0 mm。派单里的 50–70 mm 是旧 int/v1 运行时（根节点锁路径）的数。

原型 `pelvis.py`：站立期按鞋底支点（逐帧最低的那个鞋底顶点，锁在它第一次落地的世界位置）做解析两骨 IK，膝盖保持在原来的弯曲平面里，脚的朝向保留原样。P0 = 只加 IK，P1 = IK + 骨盆下沉（腿够不着时才下沉，上限 40 mm，平滑过）。前后试了两轮（踝关节锁 → 鞋底支点锁），按「最多重试 2 次」的规则停在这里。

| 片段 | 版本 | 她的右脚 / 左脚滑步 mm | 膝最小角 | 膝加速度尖峰比 | 下沉最大 mm | 腿出裙 |
|---|---|---|---|---|---|---|
| walk_start | 现状 | 15.8 / 7.8 | 10.5° | 13.8 | – | 7 |
| | P0 | 16.4 / 8.0 | **4.7°（接近绷直）** | 12.9 | 0 | 13 |
| | P1 | 17.0 / 8.2 | 10.5° | 15.9 | 6.4 | 8 |
| walk_turn_90_bodyL | 现状 | 36.9 / 10.9 | 10.5° | 16.5 | – | 0 |
| | P0 | 43.2 / 13.9 | 9.2° | 16.9 | 0 | 0 |
| | P1 | 43.2 / 16.4 | 11.7° | **7.3** | 4.3 | 0 |
| walk_turn_180_bodyR | 现状 | 17.6 / 19.0 | 10.5° | 40.9 | – | 0 |
| | P0 | 15.9 / 10.8 | 9.5° | 39.2 | 0 | 0 |
| | P1 | 16.0 / **10.8** | 11.6° | **16.5** | 3.6 | 0 |

结论：
- 骨盆下沉本身是有用的：只加 IK 时膝盖会被拉直（4.7°），加了下沉就保住了（≥ 10.5°），转身的膝盖尖峰也减了一半多。
- **但滑步没有降下来**（只有 turn_180 她的左脚从 19 降到 10.8 mm）。原因：转身的根运动是线性 yaw，脚站着的时候整只脚跟着根一起转，鞋底各点绕根中心划弧。这一版只锁了支点的位置，脚的朝向保留在片段局部，所以世界里还在转。下一步要做的是**站立期把脚的 yaw 也反向锁住**（脚的朝向跟世界走，不跟根走），起步要把 heel→toe 滚动的支点连续切换做顺。这一块和 r5 运行时 SoleContactSolver 的 turn landing 是重叠的，建议先等驱动那边确认：转身滑步是在动画片段里修，还是交给运行时修，然后再继续。
- 这几处的候选 GLB 没进包，只在 previews 里。

## 测了什么 / 没测什么
- 测过：box 上 Blender 4.5.3 逐帧（30 fps，morph 按 anim_meta 曲线驱动）扫裙穿插、手腕扭转和单帧跳变、交接角度、`loco_qa`（脚滑、膝盖、两脚重叠、交接）、`walk_clipcheck`（腿出裙、裙子穿围裙）、`walk_qa_arms`（手臂外展）；对比图 20 张自己逐张看过（T2、T3、T6、T9 重点看过）。
- 没测：Cocos 构建、真机、Mac 开发者工具；运行时驱动套件（基线就失败，见上）；候选 GLB 没走项目的动画压缩，大小 3.56 MB，基线 3.58 MB。
- `walk_clipcheck` 的 `arm_in_dress` 在这版身体上没法用：DRESS 网格包含袖子，上臂永远「在裙子里」。所以扫裙改用自己写的指标：手 + 前臂顶点，对比髋部以下的裙子/围裙面，3 cm 内法线判内外。
