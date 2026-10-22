# 后续场景动作清单与工时（角色动画bot，2026-10-22 草案）
基线：生产角色 planB_cand3b_ribbonwind4b_stepdown.glb（15 clip，动画数据约 164 KB，预算 150 KB，超出已获 Grok Bot 接受）。30 fps QA，压缩用 compress_keeptr.py。
自然度标准不变：重心转移、脚不滑、膝不突伸、手臂不外张、不扭腕；穿模从布料一侧解决。
包体估算口径：当前约 11 KB/秒（28 骨 TRS，压缩后），新增骨后约 11.4 KB/秒。

## 配件规划（来自角色建模bot CONCEPT_scarf_lantern.md，已对齐）
- **围巾 scarf.tail = 索引 29**，父骨 neck，加入 wind.mask，风系数从 0.5 起；摆幅上限：向后 ≤35°，左右 ≤20°（滑翔同样适用，超过会碰帽子和后发）。主尾权重 1.0（18 cm），副尾 0.7（14 cm）。
- **关节数到 30 = 上限（Cocos 最低设备 floor((vectors−38)/3)=30），以后不能再加骨。** 后续一切新需求（灯晃、第二飘带等）只能用节点动画 / morph / 程序摆。
- 所有已有 clip 需给 scarf.tail 补通道（静止或随 neck 的轻跟随），约 +1.5 KB。
- **提灯**：socket.lantern 挂 hand.L（镜像 rig，即她的右手），握把直径 1.2 cm，吊环 6 cm，灯身钟摆在 Cocos 做程序摆。需要 **lantern_hold 手型叠加层**（additive，只遮罩 hand.L/forearm.L）。提灯一侧手臂摆幅略收（约 60–70%），另一侧保持正常，保持自然，不靠夹臂/外张躲灯，灯穿腿裙由缩短吊环、调挂点解决。
- **爬梯前放灯**：把灯放在梯子边，按场景道具交接处理（socket 解挂 → 场景节点），新增 lantern_put_down 动作；爬完是否取回待 PM 定。

## 动作清单
| # | 动作 / clip 拆分 | 时长 | 来源 | 风层 / 布料风险 | 需要配合 | 工时(天) | 包体增量 |
|---|---|---|---|---|---|---|---|
|1|雪地行走 顺风 walk_snow_tail（循环，步幅+5%、上身略后仰、脚稍拖雪）|1.1 s|在 walk_loop 上手 K 改|风从背后：裙前摆贴腿（安全），飘带/围巾前飘 → 围巾向前不是上限内方向，需另定前向上限；雪深遮脚，脚滑更难看出但仍按 0 滑做|场景：雪面高度/脚印贴花；建模：无|1.5|~12 KB|
|2|雪地行走 顶风 walk_snow_head（循环，前倾 15–20°、步幅 −15%、手护帽/围巾可选叠加）|1.3 s|手 K（参考迎风行走 mocap 若有）|风从前：裙前摆贴腿后摆后飘 → skirt.back 外向，可复用 ribbonwind4 策略；围巾向后 ≤35° 正好触上限，需钳制|游戏层需传风向（目前只传强度）——**代码需改**|2|~15 KB|
|2b|顺/顶风起步、停步各 1（复用现有 stop/turn 加风姿态叠加层）|0.8 s×2|手 K|同上|—|1.5|~18 KB|
|3|顺风滑翔：glide_takeoff（预备下蹲→蹬伸→离地）/ glide_loop（空中循环，含风层）/ glide_land（脚跟先着地→缓冲→站起）|0.9 / 1.6 / 1.2 s|手 K（无合适 mocap）|**最高**：全身离地、风强，裙后摆+飘带+围巾三层同时动；前裙摆贴大腿前侧、两腿前后分开时裙子跨腿穿；落地缓冲深蹲裙后摆压大腿|建模：裙子加滑翔用收边/降低 skirt 骨权重；场景：起跳台、落点平台高度、空中风带特效；代码：滑翔期间 wind 层权重需例外（现为 walk-only）|5|~42 KB|
|4|坐上小火车 train_sit_on（站→跨台阶→转身→坐）/ train_sit_hold（循环，随车厢轻晃）/ train_get_off（起身→下台阶→站）|1.6 / 2.0 / 1.6 s|复用 sit_down/stand_up + stepdown 方法，手 K 补台阶|室内/车厢风=0；裙×座椅、裙×车门框（与吉球篮同类）|场景：车厢座高、台阶高度、门宽尺寸单；建模：可能要座位侧裙摆缩放|3.5|~30 KB（hold 可很短）|
|5|灯塔爬梯：lantern_put_down（蹲放灯）/ ladder_mount / ladder_climb_loop（一个手脚交替周期）/ ladder_dismount_top|1.2 / 1.0 / 1.0 / 1.4 s|手 K（梯级间距需固定）|风≈0（塔内）或弱；裙下摆×梯级、抬腿时裙前摆穿大腿；**仰视机位要避免走光**（需建模加衬裙/裙内面封闭）；手必须精确贴梯级|场景：梯级间距固定 30 cm、梯宽、顶部出口；建模：衬裙/裙内面；灯交接节点|4.5|~38 KB|
|6|lantern_hold 手型叠加层 + 提灯 walk 变体（单臂摆幅收）|0.1 s pose + 1.1 s|手 K|灯×裙/腿（靠吊环长度解决）|建模：socket.lantern 已规划|1.5|~8 KB|
|7|林间小镇：推门/打招呼挥手（小幅、手不过肩）/ 蹲下看小动物（可选）|1.2 / 1.0 / 2.0 s|手 K|弱风；蹲下裙×小腿（同 sit 问题）|场景：门把高度|2.5|~25 KB|
|8|终章·风之庭院：仰望风/闭眼迎风 idle（循环）+ 结尾张开手臂感受风（**小幅**，上臂外展 ≤35°，治愈轻盈不夸张）|3.2 / 2.0 s|手 K|最强风+静止：裙/围巾/飘带全幅，围巾上限要卡死；手臂抬起时袖/飘带|代码：idle 也要开风层|2.5|~30 KB|
|9|全部已有 clip 补 scarf.tail 通道 + 重新压缩/对比|—|脚本|—|建模交付围巾骨|0.5|~1.5 KB|
|10|每项逐帧 QA（30 fps、过渡含）、Cocos 实机联调缓冲|—|—|—|—|4|—|

**总工时约 28.5 人日**（制作 24.5 + QA/联调 4）。**包体增量约 220 KB**，动画数据将从 164 KB 涨到约 380 KB。建议：按场景分包加载（每个场景的 clip 走各自子包），主包只留通用 clip；否则需 PM 重新定预算。

## 依赖与风险汇总
- 风向：顶风/顺风行走、滑翔都需要游戏传风向（或改为按 clip 固定方向），现在只传强度。
- 风层 walk-only 规则需要为滑翔、终章 idle 开例外。
- 骨骼满 30，裙子问题只能靠建模（权重、收边、衬裙）或 morph 解决，不能加裙骨。
- 爬梯仰视机位需运镜bot 配合避开裙底。

## 概念样本：顺风滑翔（为什么最难）
全身离地、强风、三层布料（裙/飘带/围巾）同时动，起跳和落地都要求重心连续且脚不滑，而且需要代码、场景、建模三方同时改规则。
文件：glide_concept.mp4（126 帧 @30fps，4.2 s）、glide_keyframes.png（f0/20/25/40/60/84/95/125）、glide_block.py、glide_concept.blend、glide_metrics.json。
- 已测（脚本测骨骼）：支撑期脚踝滑动 ≤0.1 mm；膝角逐帧最大变化 12°/帧（f31 空中收腿，非着地）；无膝锁直 snap（迭代 2 次后修掉起跳 f27 和着地 f85 的突伸）。
- 未测：网格穿模（未逐帧查）、围巾（骨未交付，没做）、风层叠加（用的是手 K 的 skirt.back/ribbon 后摆，不是 wind_flutter_loop）、压缩、Cocos。
- 已知穿模/风险（目测）：空中双腿前后分开时裙前摆被前腿顶穿；落地深蹲 f90–97 裙后摆压进大腿后侧；skirt.back 后摆 −14°/−18° 时与飘带可能交叠；起跳前臂后摆时 hand 靠近裙侧。手臂外展 ≤14°。
- blocking 粗糙：上身前倾幅度在侧视机位偏小、手臂姿态偏僵，正式制作需重做曲线。

---
# PM 决定（Grok Bot，2026-10-22）与落实

## D1. 风向：取自全局风（docs/r5/global-wind.md，`scripts/render/GlobalWind.ts`）
GlobalWind 现状：`{dirX, dirZ, strength, pennantMps}`，`dir` = 世界 xz 中**风吹去**的方向（默认 (0.944,−0.330)，方位 109.3°），`strength` 默认 1（文档测试覆盖到 2）。女主现用的 `getWindStrength()` 是阵风事件通道（0..1），文档明确未接入 GlobalWind。接口由 Grok Bot 集成时加，动画侧需要的字段：

| 字段 | 来源 / 算法 | 取值范围 | 用途 |
|---|---|---|---|
| `windRelDeg` θ | `atan2(cross(facing, dir), dot(facing, dir))`，facing = 角色世界前向 xz（归一化），dir = GlobalWind dir | (−180°, 180°]；**0 = 顺风**（风往她面朝的方向吹），**±180 = 顶风**，+ = 风吹向她左侧 | 顺/顶风混合、侧风 |
| `windStrength` s | GlobalWind.strength，钳制 | 0..1.5（>1.5 截断；1 = 默认观感） | 风层权重、姿态混合量 |
| `gust` g | 现有 `getWindStrength()` 阵风通道 | 0..1 | 只叠加到风层（布料/飘带/围巾），**不改行走姿态** |
| `windEnabled` | 场景/状态 | bool | 室内、坐姿 = false；行走、滑翔、终章待机 = true（D2） |

混合算法（每帧，动画侧建议；代码由 Grok Bot 落）：
1. θ 平滑：对 (cosθ, sinθ) 做一阶低通，时间常数 0.4 s（转身 180° 时不跳变）；s 低通 0.6 s。
2. 有效强度 `e = smoothstep(0.15, 0.8, s)`（微风不改步态）。
3. `wTail = e · max(0, cosθ)²`，`wHead = e · max(0, −cosθ)²`，`wWalk = 1 − wTail − wHead`（平方让 ±90° 侧风时回到普通 walk_loop）。
4. 三个 clip 同步混合：按归一化相位同步（三者 0% 和 50% 都是同一只脚着地，已对齐）。播放时长按权重插值：`T = 1.433·wWalk + 1.267·wTail + 1.533·wHead` s；角色根速度按同权重插值：`v = 0.696·wWalk + 0.727·wTail + 0.554·wHead` m/s（场景走速若用 walkMps，则按 `walkMps/0.696` 统一缩放播放速率，保证不滑）。
5. 侧风：`side = e · sinθ` ∈ [−1,1]，只给风层用（裙/飘带/围巾侧偏），不做侧风步态。
6. 风层权重 = f(s) 不变（只看强度）；风向只决定风层 clip 的方向分量（需要时再做“前飘/后飘”两版 wind_flutter，现阶段保留单版）。

## D2. 风层开启范围
walk-only 改为：行走（含雪地顺/顶风）、**滑翔**（takeoff 起跳后 → land 着地前）、**终章待机**开风层；室内、坐姿、爬梯仍为 0。围巾 scarf.tail 向后 ≤35°、左右 ≤20° 的上限在风层上钳制。

## D3. 分包分配（主包保持现 164 KB；场景包各 ≤80 KB，放各自 region bundle）
估算口径：11 KB/秒（压缩后），scarf 补通道后约 11.4 KB/秒。

| 包 | 动作 | 估算 |
|---|---|---|
| **主包**（通用） | idle_breathing_loop、walk_loop、walk_start、walk_stop_bodyL/R、walk_turn_180/_bodyR、walk_turn_90_bodyL/R、wind_flutter_loop；气球段已上线的 sit_down、sit_hold、stand_up、door_reach、walk_start_stepdown（不搬，保持现状） | 164 KB（+围巾补通道约 1.5 KB，届时需 PM 确认） |
| **region_snowpass 雪山风铃山口** | walk_snow_tail（1.27 s，14 KB）、walk_snow_head（1.53 s，17 KB）、顺/顶风起停 4 个改为**姿态叠加层**（共约 8 KB，替代原 2b 的 18 KB） | ≈39 KB |
| **region_lighthouse 星夜灯塔海岸** | lantern_hold 叠加 + walk_lantern（8）、lantern_put_down（13）、ladder_mount / ladder_climb_loop / ladder_dismount_top（38）、**lantern_pick_up**（1.3 s，15） | ≈74 KB |
| **region_forest_town 林间小镇** | train_sit_on / train_sit_hold / train_get_off（30）、推门 / 挥手 / 蹲看小动物（25） | ≈55 KB |
| **region_courtyard 终章·风之庭院** | 迎风 idle 循环 + 张臂感受风（30）、glide_takeoff / glide_loop / glide_land（42） | ≈72 KB |

> 待确认：滑翔若实际发生在雪山山口，则雪山包 39+42=81 KB 超线，届时把滑翔拆为独立子包 `region_snowpass_glide`。小火车默认放林间小镇。

## D4. 爬梯镜头
仰视避裙底已转给运镜bot，动画侧不为机位改动作。

## D5. lantern_pick_up（新增，灯塔包）
爬完梯回到地面后取回梯边的灯：走近 → 屈膝下蹲（重心下沉、上身前倾 ≤30°，不直腿弯腰）→ 她的右手（hand.L，lantern_hold 手型）握把 → socket 重新挂接（场景节点 → socket.lantern，交接帧需代码同帧切换）→ 起身时灯自然下垂、程序摆接管。约 1.3 s，15 KB；与 lantern_put_down 镜像设计，复用同一交接点位。工时 +0.8 天（总计 29.3 人日）。

---
# 雪地行走 blocking（2026-10-22，未做正式制作）
脚本 `snow_walk_block.py`（以 walk_loop 按相位重采样，IK 放脚，上身叠加），预览在 `previews/角色动画bot/future-scenes/snow/`。

| 参数 | walk_loop | walk_snow_tail 顺风 | walk_snow_head 顶风 |
|---|---|---|---|
| 时长 / 帧@30 | 1.433 s / 43 | 1.267 s / 38（略快） | 1.533 s / 46 |
| 根速度 | 0.696 m/s | 0.727 m/s | 0.554 m/s |
| 步幅（单脚行程） | 0.463 m | 0.424 m（×0.92） | 0.392 m（×0.85） |
| 抬脚（踝最高） | 12.2 cm | 15.8 cm | 16.4 cm |
| 重心（髋高） | 1.011–1.043 | 0.999–1.031（−1.2 cm） | 0.976–1.008（−3.5 cm） |
| 躯干前倾均值 | −1.9° | −3.8°（更直） | +14.2°（头净低约 4°） |
| 摆臂 | 1.0 | 1.0 | ×0.75，前臂多屈 12° |

已测（骨骼数据，t=n/30）：着地脚相对履带速度偏差 ≤1.8 mm/帧（walk_loop 原为 2.7）；膝无突伸（每帧最大变化 8.2°/11.3°，walk_loop 13.6°）；上臂外展 ≤17.6°（不超原 walk_loop 17.7°）；腕扭沿用原 walk_loop，未新增；循环首尾一致。
目测（Workbench 侧/正视）：未见腿穿裙、手穿裙。
未测：逐帧网格穿模、风层叠加后（尤其顶风裙后摆、顺风裙前摆贴腿）、围巾（骨未交付）、抬手挡风叠加层（未做）、压缩后误差、与 walk_loop 的实际同步混合（相位已对齐但未在 Cocos 测）、Cocos 实机。
字节估算：tail ≈14 KB、head ≈17 KB（11 KB/s 口径，未实压）。
