# r5 房间自由镜头 keepInside 修正（运镜bot，第一版）

分支 `cine/r5-room-keepinside`，基于 `github/feat/free-camera-r1` @a79ee49a。用这个分支是因为 keepInside 只在它上面有，int/v1 没有 FreeOrbit。只在本地提交，**未 push**。

## 原因
- 房间内壁是一个近似圆形的壳：圆心 x 0, z −2.6，内切半径 2.31 m。
- 旧的 keepInside 盒子是 x −1.85..1.05、z −4.72..−1.55，四个角伸到圆形墙外面去了。
  - yaw 270：镜头被夹到 (−1.85, 1.45, −4.21)，离墙中心 2.45 m，**已经在墙外**（离内壁 0.02 m）。
  - yaw 315：镜头被夹到 (−1.84, 1.62, −1.94)，**插进了西墙柜**（离柜子 0.02 m）。
  - 这两个角度都是全黑。

## 新边界（`region/FreeOrbit.ts` → `ORBIT_LIMITS.home.keepInside`）

| | x | y | z |
|---|---|---|---|
| 旧 | −1.85..1.05 | 0.70..2.20 | −4.72..−1.55 |
| 新 | **−1.10..1.05** | **0.85..2.20** | **−4.45..−0.90** |

量法：
- 用 `tools/camera-render/room-keepinside/bl_room_keepinside.py measure` 对运行时世界 `combined_visual_m.glb` 量内壁。
  - 从房间中心每 2° 打一条射线，取镜头高度 0.85–2.2 m 范围内最近的墙。墙包括壳体、门、灯塔外壳和窗玻璃。
  - 结果：地面 0，顶 3.06。
- 再对全部场景几何（含家具）做 3D 净距场，在里面搜索这个盒子：
  - 条件一：盒子本身离内壁 ≥0.30 m。
  - 条件二：各个 yaw / pitch / 臂长下，镜头离家具 ≥0.15 m。
  - 在满足条件的盒子里，选臂长最长的那个。
- y 下限从 0.70 提到 0.85，是为了避开桌面高度的家具（pitch −14° 时会贴上去）。

## 余量
- **盒子到内壁 ≥0.30 m**（实测 0.318）。
- **任意镜头位置到内壁 ≥0.25 m**（测试最差 0.274：yaw 165、pitch 10、臂长 1.25）。
- 对比：近裁面 0.1 m，竖直 fov 60° 时近裁面四角到镜头约 0.12 m；0.25 m 大约是它的 2 倍。
- HANDOFF 的 1.1 m 在这个房间里做不到：她坐的位置离后墙只有约 0.8 m，房间内切半径只有 2.31 m。
- 关于 yaw 135–225（镜头在她背后）：
  - 臂无论怎么缩都进不了盒子，这时停在 FreeOrbit 原有的最短臂（约 0.55 m）。
  - 这个落点跟旧盒子完全一样，不是这次改出来的。
  - 离墙 0.28–0.30 m，仍然满足 0.25 m 的要求。

## 各 yaw 结果
条件：pitch 10°，臂长 3.35 m，只用 keepInside，跟 场景特效bot 的 360 抓帧相同。净距是 Blender 用 BVH 算的精确最近距离，不含她本人。

| yaw | 镜头位置 | 臂长 m | 离内壁 m | 离全部几何 m（最近物体） |
|---|---|---|---|---|
| 0 | 0.43, 1.63, −0.91 | 3.35 | 0.615 | 0.615（壳体） |
| 45 | 1.04, 1.20, −3.60 | 0.88 | 1.029 | 0.646（家具） |
| 90 | 1.03, 1.16, −4.21 | 0.61 | 0.567 | 0.397（家具） |
| 135 | 0.85, 1.15, −4.63 | 0.60 | 0.283 | 0.283（壳体） |
| 180 | 0.43, 1.15, −4.75 | 0.55 | 0.296 | 0.296（壳体） |
| 225 | 0.01, 1.15, −4.63 | 0.60 | 0.463 | 0.452（家具） |
| 270 | −1.08, 1.32, −4.21 | 1.54 | 0.540 | 0.533 |
| 315 | −1.09, 1.43, −2.69 | 2.18 | 1.350 | 0.267（家具） |
| 旧 270 | −1.85, 1.45, −4.21 | 2.31 | **0.025** | 0.025 → 全黑 |
| 旧 315 | −1.84, 1.62, −1.94 | 3.26 | 0.412 | **0.024**（墙柜）→ 全黑 |

我逐张看过：新的 8 张没有黑帧，她都在画面里，没有穿模。
- yaw 45–225 是很近的特写（臂长 0.55–0.9 m），因为她坐的地方贴着后墙和书桌。旧盒子在这几个角度的结果一样。
- yaw 90 前景有一盆植物挡了一点。
- yaw 270 和 315 现在是完整的坐姿中景。

## 测试
- **`tools/region-nodes/test_room_keepinside.cjs`（新，已加进 run-suite）：PASS。** 检查内容：
  - 盒子离内壁多边形 ≥0.30 m。
  - yaw 0..345（每 15°）× pitch −14 / 10 / 26 × 臂长 1.25 / 2.3 / 3.35，镜头离内壁都 ≥0.25 m，且不在她身体里。
  - 旧盒子在 yaw 270 不满足要求（回归用例）。
- **`test_free_orbit.cjs`：PASS。**
- **loose-ES5**：`FreeOrbit.ts` 用 ES5 transpile（不开 downlevelIteration）诊断数 0。
- **manifest**：
  - `--write` 会顺带把基线上 400 多条旧的不一致一起改掉，所以我没有用它的结果。
  - 只在 `text-MANIFEST-SHA256.json` 里加了 `FreeOrbit.ts` 一条。
  - run-suite.cjs 和新工具文件本来就不在清单范围里。
  - `test_manifests` 在基线上本来就不通过（457 条问题），改后 456 条，减少的就是这一条。

## 产物
- 预览在 `/workspace/yiqifengle/previews/运镜bot/r5-room-keepinside/`：
  - 总览：`CONTACT_room_keepinside.jpg`。前两行是改后 8 个 yaw，第三行是改前/改后的 270 和 315。也拷到了本目录。
  - 单张：`AFTER_yaw000..315.png`、`BEFORE_yaw270|315.png`、`BEFORE_AFTER_yaw270|315.png`。
  - `raw/`：无标注原图，以及 `clearance.json`。
- 角色：A1 final `/workspace/yiqifengle/previews/角色动画bot/r5-wrist-footik/final/chr_b_r5g2_r5wrist_v4_final.glb`。
  - 任务里写的文件名 `chr_b_r5wrist_v4_final.glb` 在箱子上不存在，实际文件名多了 `r5g2_`。
  - 动作 `sit_hold` 第 24 帧；位置 seatedRoot，朝向 seatYawRad −2.0。
- 世界：`feat/free-camera-r1:creator-project/assets/firstslice/combined_visual_m.glb`。渲染时模拟了 Cocos 的单面剔除。
- 工具：
  - `tools/camera-render/room-keepinside/bl_room_keepinside.py`（measure / render 两种模式）
  - `orbit_poses.cjs`：用真实的 `FreeOrbit.solve` 算镜头位置。

## 发现的另一个问题（没修，待定）
- 运行时 `WorldFlowComponent.fillBoxes()` 会把 `env_interior_shell`、`env_interior_props_merged`、`env_lighthouse_ext` 的包围盒都当成碰撞体，因为它们的跨度都小于 16 m。
- 镜头本来就在这些包围盒里面，所以 `clearPose` 每一轮都会往回推。结果是 8 个 yaw 的臂长全部缩到 0.55–0.70 m。
- 这一点是用 GLB 的 AABB 和真实的 `FreeOrbit.solve` 在 node 里复现出来的。
- 也就是说，真机室内大概率一直是贴脸特写，keepInside 基本用不上。
- 建议：碰撞时忽略同时包住看点和镜头的盒子，或者室内跳过壳体/合并家具。这需要用户或 自由镜头 bot 来决定。
