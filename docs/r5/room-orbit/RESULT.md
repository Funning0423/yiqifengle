# r5 室内自由镜头：圆角 keepInside + 房间中心看出混合（运镜bot）

# r6（当前版本，在 66e3d0e7 之上）：视角直接跟手，只限位置

## 改了什么
1. **只限镜头位置。** 目标限速 0.8 m/s、跟随器加速度上限 2.6 m/s²、墙法向保护，三者都只作用于位置。
   视线方向就是轨道方向本身 `−u(yaw, pitch + 8°)`（`roomViewDir`），只由玩家的 yaw/pitch 决定：不看位置、不看混合权重，也不经过任何跟随器，所以不会落后于输入，混合过程也不会让视角自己转。
2. **过场返回。** 返回期间拖动本来就被忽略。视角走一条定时的 yaw/pitch smootherstep 曲线：
   - 时长 T = √((5.78(|Δyaw|+|Δpitch|) + 3.52|Δyaw·Δpitch|) / 100°/s²)，下限 0.55 s；
   - 结束时正好落在输入视角上，没有吸附。
3. **第一次拖动。** seed 时反解 yaw/pitch，让输入视角等于作者镜头的视角。pitch 上下限够不到的剩余倾角，在第一次拖动后 0.8 s 内用 smootherstep 淡掉（作者镜头这里为 0）。
4. **构图。**
   - 轨道支点向她坐姿身体的平面中心移动：`pivotOffset [−0.2, 0, 0]`。z 不能动，否则支点会出 0.2 m 内缩框，所有 yaw 都会变成中心看出；测试里加了守卫。
   - 视线下压 8°（`viewTiltDeg`）。
5. **yaw 45 的“绿色植物”。** 实测它不是吊篮（`env_int_anim_hanging_plants` 距镜头 >0.9 m，也不在画面里），而是 `env_island_props_merged` 里的一丛室外灌木，有 8 个顶点穿进西墙内侧，位置约 (−1.8, 1.4, −4.2)，距镜头约 2.5 m。
   游戏在 home 写入 HOME 图层（`exterior:false`），这个物体本来就不渲染，出现在画面里是预览工具的问题。改法：`bl_room_keepinside.py` 在 render/probe 时按 HOME 图层隐藏 exterior 层和 v22 日间物体。美术资源没有删也没有动。真机上仍需目视确认。
6. **yaw 315。** 她在画面中的范围（NDC）从 x −0.95..0.35、y −0.98..0.09（裙摆和脚出画）变为 x −0.85..0.65、y −0.79..0.37，整个人都在画面内，占画面 17% → 21%。

## 跟手 / 回稳（test_room_keepinside 第 5 部分，30/60/120 fps 全过）
| 情况 | 视角滞后 | 停手后回稳 | 过冲 |
|---|---|---|---|
| 拖 30°/s | 0° | 0 s | 0° |
| 拖 90°/s | 0° | 0 s | 0° |
| 来回快拖 150°/s，每 0.15 s 换向，带 pitch 抖动（yaw 200 中心区 / yaw 340 绕她区） | 0° | 0 s | 0° |

视角是输入的纯函数，所以以上全部为 0。**镜头位置仍会滞后**（按设计只限位置），60 fps：
- 30°/s：最大 1.80 m，停手 1 s 后还差 1.29 m；
- 90°/s：最大 1.48 m，停手 1 s 后 0.93 m；
- 来回快拖：最大 0.98 m，停手 1 s 后 0.03 m。

试过把目标限速提到 1.5 m/s：线加速度会到 23 m/s²，离她 0.96 m，不过线，已退回 0.8。

## 运动（60 个用例 × 30/60/120 fps）
- 线加速度峰值 2.6 m/s²；速度峰值 2.36 m/s（过场返回）。
- 运动中离墙最少 0.844 m，离她最少 1.20 m。
- 角加速度：
  - 视角现在直接跟手，原始角加速度就是手本身的（瞬间起步 90°/s 时为数千 °/s²），只记录、不卡线；
  - 镜头**自己附加**的角加速度（视角相对输入视角的部分：返回曲线、首拖淡出）峰值 91.9°/s²（上限 110）；
  - 手匀速时视角的角加速度为 0；
  - 镜头自身转速峰值 59.6°/s（过场返回）；第一次拖动时视角只转拖动本身的 1.54°；
  - 过场返回 2.0 s 交还视角。
- 角速度 / 角加速度现在按真实相机计算（look-at，world up），而不是按方向向量的最小旋转。后者会把“非零 pitch 下匀速转 yaw”算成在加速。
- 静态全扫描：离墙最差 0.95 m，离她最差 1.113 m；yaw 0 和 315 绕她（w=0），其余 6 个是中心看出。
- 室外：240 个用例中 0 个变化。test_free_orbit PASS，test_lens_clearance PASS。宽松 ES5：0 diagnostics。
- 预览：`/workspace/yiqifengle/previews/运镜bot/r5-room-orbit-r6/`
  - `CONTACT_room_orbit_r6_8yaw.jpg`
  - `BLEND_trace_sweep_30dps_60fps.png`、`BLEND_trace_sweep_90dps_60fps.png`、`BLEND_trace_backforth_150dps_60fps.png`
  - `raw/`：8 张单帧，以及 poses、clearance（含每帧画面覆盖率）、probe、trace、测试输出

## 已知 / 待真机看
- 位置滞后较大：快速拖动时，视角已经转过去了，镜头位置还在慢慢滑（≤0.8 m/s）。画面不会黑，也不会贴脸。
- 线加速度在 2.6 m/s² 的上限上来回切换（bang-bang），没超线，但加加速度（jerk）偏大，需要真机看手感。

---

## r5（66e3d0e7，旧版记录）

分支：`cine/r5-room-orbit-wip` → 快进到 `cine/r5-room-keepinside`；交付分支 `cine/r5-room-orbit-b08`（基于 bc81575f）。仅本地提交，**未 push**。

## 设计
- **不锁 yaw。** 目标镜头 = 两个视角的混合，权重 `w = smootherstep((1.45 − arm) / 0.5)`：
  - 绕她转（arm = softMin(玩家臂长, 到 0.2 m 内缩圆角框的射线距离)，y 软夹）；
  - 从房间中心 `(0, 1.55, −2.5)` 往外看。
  两者都沿玩家的 orbit 方向看；瞄点 = lerp(她, 中心, w)。安全半径短时自动转到“房间中心看出”，此时她可以出画。
- **keepInside 圆角框：** min `[−1.1, 0.85, −4.45]`，max `[1.05, 2.2, −0.9]`，cornerM 0.5。离内壁最少 0.318 m（要求 ≥0.30）。
- **目标点限速：** 目标走的是滤波后的参数（yaw/pitch/arm），目标点速度 ≤0.8 m/s，所以目标始终经过合法的静态位姿（沿边不会切角）。
- **跟随器：** 临界阻尼，ω 12，线加速度上限 2.6 m/s²，角加速度上限 100°/s²，120 Hz 子步。
- **墙法向安全：** 用圆角框 SDF。当 s 从 −0.08 到 +0.04 m 时，按 smootherstep 平滑消掉向外的法向速度；没有硬停，也不影响切向。
- **第一次拖动 / 过场返回：** seed / beginReturn 从当前实际位姿起步，初速为 0，没有跳变。
- **碰撞盒：** `orbitIgnoresBox`：
  - 同时包含她和镜头的盒子一律忽略；
  - 室内忽略 `interior_shell | interior_props_merged | lighthouse_ext`。
  - 室外行为不变。
  WorldFlowComponent.fillBoxes 现在会带上节点名。
- 参数集中在 `ROOM_LOOK_FEEL`、`ORBIT_LIMITS.home.keepInside / roomLook`（FreeOrbit.ts）。

## 8 个 yaw（pitch 10°，臂 3.35 m，含世界碰撞盒，静态目标）
| yaw | w | 镜头位置 | 离她 m | 离内壁 m |
|---|---|---|---|---|
| 0 | 0 | (0.433, 1.508, −1.606) | 2.64 | 1.276 |
| 45 | 1 | (0, 1.55, −2.5) | 1.83 | 1.51 |
| 90 | 1 | 同上 | 1.83 | 1.51 |
| 135 | 1 | 同上 | 1.83 | 1.51 |
| 180 | 1 | 同上 | 1.83 | 1.51 |
| 225 | 1 | 同上 | 1.83 | 1.51 |
| 270 | 0.942 | (−0.035, 1.532, −2.599) | 1.74 | 1.528 |
| 315 | 0 | (−0.898, 1.383, −2.877) | 1.91 | 1.383 |

静态全扫描（yaw 每 5° × pitch {−14, 10, 26} × arm {1.25, 2.3, 3.35}，有 / 无碰撞盒）：
- 离墙最差 0.857 m（yaw 280，pitch 26，arm 3.35）；
- 离她最差 1.118 m（yaw 280，pitch −14，arm 1.25，含碰撞盒）。

## 运动（30/60/120 fps，60 个用例）
用例包括：yaw 扫 30/90/160°/s × 3 个 pitch、6 个 yaw 的 pitch 摆动、3 个 yaw 的捏合、从作者镜头开始的第一次拖动、过场后返回。
- 峰值线加速度 2.6 m/s²（上限 3）；
- 峰值角加速度 100°/s²（上限 110）；
- 峰值速度 2.36 m/s（过场返回）；
- 运动中离墙最少 0.844 m（要求 ≥0.25）；
- 运动中离她最少 1.16 m（要求 ≥1.0）；
- 第一次拖动：作者镜头 → 甩动，峰值 1.44 m/s，没有跳变。

## ⚠ 已知问题：跟手性差（数值门槛之外，看曲线时发现）
目标参数按“目标点 ≤0.8 m/s”限速，导致臂长较长时 yaw 实际只能转约 14°/s。进入中心模式（w=1）时目标点不动，yaw 又被一下补上，于是画面自己摇得比手快。60 fps 扫过 0→360°（`blend_trace.cjs`）：

| 拖动速度 | 最大视角滞后 | 视角最大角速度 | 停手时滞后 | 停手 3 s 后滞后 |
|---|---|---|---|---|
| 30°/s | 88.6° | 139°/s | 62.8° | 17.7° |
| 90°/s | 179.5° | 193°/s | 34.4° | 58° |

加速度没有超限，但玩家会感觉镜头“拖着走、再自己甩过去”。建议下一轮这样改（本轮只批了一次尝试，没有改）：
- 只对**位置**限速，**视线方向**直接跟玩家的 yaw/pitch；
- 或者只在贴近圆角框边（roomEdge s > −insetM）时限速；
- 测试里加一项“视角滞后 ≤ X°”。

## 回归与检查
- 室外：240 个基线用例中 0 个变化。
- test_room_keepinside PASS（ANG_MAX 110，并新增运动中离她 ≥1.0 的断言）；test_free_orbit PASS；test_lens_clearance PASS（4.63，env_sky_starring）。
- 宽松 ES5：FreeOrbit.ts、WorldFlowComponent.ts 都是 0 diagnostics。
- Manifest：只更新了 FreeOrbit.ts 和 WorldFlowComponent.ts 两条（WorldFlowComponent 原条目本来就和文件对不上，这次一起改正）。

## 预览（A1 final GLB 坐姿）
`/workspace/yiqifengle/previews/运镜bot/r5-room-orbit/`：
- `CONTACT_room_orbit_8yaw.jpg`
- `BLEND_trace_yaw30dps_60fps.png`、`BLEND_trace_yaw90dps_60fps.png`
- `raw/`（8 张单帧、poses.json、clearance.json、trace_*.json、test_room_keepinside.json）

GLB：
- 角色：`previews/角色动画bot/r5-wrist-footik/final/chr_b_r5g2_r5wrist_v4_final.glb`
- 场景：feat/free-camera-r1 的 `combined_visual_m.glb`

人工看图：
- 8 个 yaw 都没有黑屏、没有贴脸。
- yaw 0 和 315 能看到她（315 时她在右侧被裁掉一部分）。
- 45–270 是房间中心往外看：楼梯、窗、门、书桌，她不在画面里。
- yaw 45 画面中间有一团绿色叶子，比较突兀。
