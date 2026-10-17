# 出门运镜 B5（运镜bot，2026-10-16）· 候选，本地分支，没推送

Funning 否了 B4：① 出门后镜头突然加速（0.9 → 6.1 m/s，约 0.6 s 内），② 抬升是一下子跳上去的。
B5：出门后镜头先按她的步速（≈0.7 m/s）跟一段，再从她**右侧**沿一条 smootherstep（最小加加速度五次曲线）慢慢往右上方升到终帧。

## 代码
| | |
|---|---|
| 基线 | **b14067c**（招牌站西草坪；含 edc65d5 瘦身房间）。B4 是在旧的 **5c54f7a** checkout 上做的（5c54f7a 不是 b14067c 的祖先）；两个镜头文件在 5c54f7a / b14067c / d317b2f / int/v2 上逐字节相同，所以 patch 能直接用 |
| 分支 | `cine/exit-cam-B5`（仓库 /workspace/wechat-game/yiqifengle，worktree /tmp/wt-b5）。**没推送、没 force** |
| commit | `15b164c4b59467a60061c40ef671c154f6ca4671` |
| tree | `5c53f36dc39e73ff37907801f8c36d936c9eaa76` |
| patch | `patch/exit-cam-B5.patch`（相对 b14067c，包含 B4 的改动 + B5）。`git apply --check` 通过：d317b2f（PR #56）、int/v2 f77dce9、aabd8a2（PR #58）、2936c30（招牌 C）、3e6b7df（招牌 A2） |
| 回退到 B4 | 删掉 `TRANSITION_CAMERA.crane.pace.b5`（depart 还是 B4 的弧），settleSeconds 改回 1.0 |

改动（两个文件：`world-r1/FirstsliceRoutes.ts`、`world-r1/RegionCameraData.ts`）：
- `paceOutbound` 新增 `paceB5`（`crane.pace.b5` 存在时走它）。镜头 C(t) = H(t) + 柱坐标偏移(方位, 半径, 高度)(t) + e(t)：
  - H = 她的 root 按时间做高斯低通（σ 0.45 s，C∞），所以她路线的折线拐点不会传到镜头上。
  - 偏移三段用 smootherstep 权重混合：门口键 → 跟随（她右后方 1.6 m / 2.0 m、高 1.6 m）→ cameraIsland。方位/半径的侧移在门口键后 1.2 s 才开始（等镜头出了门框），用 3.0 s 走完。
  - 抬升：从门口键后 2.6 s 开始到终帧，共 **9.0 s**；高度用其中前 80%（7.2 s），方位转到她正前方用前 55%（5.0 s），都是 smootherstep（两端速度、加速度为 0）。方位插值强制经过她右侧（不会从她背后翻到左边）。
  - e(t)：把门口曲线末端的速度和加速度带进来，1.2 s 内淡出 → 门口交接处位置/速度/加速度都连续。
  - 镜头目标：她胸前略低（0.68 m，前方 0.2 m）→ 终帧目标，同一组权重；FOV 69.5 → 73 → 70。
  - 保留游戏原有的检查：水平距离 ≥1.7 m（“crowds her”）、风的正面标记。B5 不走 7 m/s 巡航检查（这是 B4 时代的约束，见下）。
- 出门路线（沿用 B4 的写法，点改了）：先基本直着出门约 2.3 m（x≈-0.3…-0.5），再一个缓弯接回 exit_path_17（终点不变）。B4 的路线往右（-x）拐得早，她和镜头会贴着 palm_tall_01（x≤-2.89, z≤2.09）。
- `crossOutEnd.distance` 0.25 → **-0.1**（门口键在她右边 0.1 m）；X2/O 的 x 恢复原值（-0.4 / -0.353）。门 86.4°、终帧 yunjing-final 与 B4 相同。
- `crane.settleSeconds` 1.0 → **5.5**（给抬升留时间）。

## 结果（flow_sim 60 fps，恒速走路；B5 段 = 门口键之后，t ≥ 2.54 s）
| 项 | B4（同样在 b14067c 上重跑） | **B5** |
|---|---|---|
| 门口后速度 | 0.9 → 6.1 m/s 急加速（t≈3.0–3.6 s），之后 6.1 m/s 匀速 | 跟随段 0.66–0.74 m/s（她 0.70），然后单峰平滑升到 **8.06 m/s**（t=8.5 s）再平滑减到 0 |
| 最大加速度 \|a\|（原始差分 / SG9 平滑） | **62.0** / 51.2 m/s²（t=3.25 s 尖峰） | **7.51** / 7.10 m/s² |
| 最大 jerk（原始 / SG9） | **912** / 749 m/s³ | **69** / 25.5 m/s³（原始值里的锯齿是 60 Hz 关键帧 + pchip 插值的数值噪声） |
| 竖直加速度 \|a_y\| 最大 | 37.3 m/s² | **1.85** m/s² |
| 抬升 | 无 ease，阶跃 | smootherstep，**9.0 s**（高度 7.2 s ≥ 2 s） |
| 出门总时长（crossing-out 开始 → settled） | 9.77 s | **14.18 s**（+4.4 s，crane-start 6.20 → 8.52 s） |
| 最近净空（B5 段） | 0.018 m（灯塔外墙，t=3.43） | **0.514 m**（灯塔外墙，t=3.6 s）；全程最小 0.150 m 是 t=0 屋内道具（门里那段没改） |
| 穿模（相邻帧线段穿过网格） | 0 | **0** |
| 挡脸/头/胸 | 5 帧（palm_tall_01） | **0 帧**；脚被草/道具挡 8 帧（只有脚） |
| 镜头在她右侧 | — | 是；最大“偏左”0.16 m，出现在她停下转身、镜头在她正前方 10.6 m 时（≈正前方）；5 m 内偏左 >5 cm 的只有门口键 2 帧（≤0.10 m） |
| 最小水平距离 | 1.70 m | 1.89 m |
| 她最低点 NDC y > -0.5 | 26 帧不过（门口后 0.4 s） | **门口键后 0.82 s 起全过**；前 49 帧（2.55–3.35 s）最差 -0.70，是从门里那段继承的构图；终帧 -0.218 |
| 招牌 C/A2 的道具位置（棕榈 [2.0,0.04,6.6]） | — | 结果完全一样（`csv/B5_frames_signC_A2props.csv`） |

曲线图：`plots/exit_B4_vs_B5_curves.png`（位置 x/z、高度、速度、竖直速度、加速度、竖直加速度、jerk、水平速度；红 B4 / 蓝 B5；虚线 = 门口键）。

## 游戏测试（`tests/`，Node 22.14 /exec-daemon/node，TS 5，ES5 用 QF_TS_TARGET=ES5）
`run_camera_suite.sh`：es5_safety、sit_timing、turn_targets、wind_api、door_spill **PASS**。
`test_camera_frames`（default / ES5 / real-walk / ES5+real-walk）：
- **PASS**：lens-clearance、line-of-sight、door-leaf-clearance、lens-near-geometry、lens-near-movers、occlusion:palms、no-hard-cut、角/线速度连续、in-frame（default/ES5）、wind、crane-marks 等。
- **FAIL exit-overlap / exit-cruise-real**：这两条写死了 B4 时代的“匀速巡航”合同（巡航带 5.4–6.5 / 6.6–7.4 m/s、转身中后速度比 ≥0.8），跟 Funning 要的“慢—平滑加速—平滑减速”正面冲突；exit-cruise-real 还写死了门 = 45°（B4/B5 都是 86.4°）。要 B5 进游戏，这两条测试要改，需要 Grok Bot 定。
- real-walk 的 in-frame：9 帧（crossing-out 开始后 0.75 s，门里那段，B5 之前），差 0.09% 屏高；B4 在同一位置 33 帧。real-walk 的 return-entry-continuous：基线就不过（B4 一样，standstill 0.767 s）。
- composition（T2+ 快照）：B4、B5 都不过（cameraCrossOut 快照），选定后要更新快照。
- 对照：B4 patch 在 b14067c 上跑，**lens-clearance（0.042 m 灯塔外墙）、line-of-sight / occlusion:palms（palm_tall_01 挡头）、lens-near-geometry、lens-near-movers 都 FAIL**（B4 README 里只写了 exit-cruise-real 不过，那是 5c54f7a 上的结果）。
- manifests：基线 b14067c 已有 79 个问题；B5 多 2 个（两个改过的脚本 hash 过期），合并时要 `--write`。

## 视频
- `video/exit_B4_vs_B5_0.46.mp4`、`video/exit_B4_vs_B5_0.75.mp4`：左 B4｜右 B5，10 fps，t=0 = crossing-out 开始，B4 结束后停在终帧；每栏顶部标着实时速度和高度。
- **不是 Cocos 实机录屏**：Blender 5.2 EEVEE 离线预览（太阳光 + 天空色，和 exit-cam-v2 的 island_check 同样设置），镜头逐帧用 flow_sim 的位姿/FOV；角色是静止姿势沿真实 root/yaw 滑动（没有走路动画）；T9 道具（白色棕榈、路牌）没贴图；没有音频。0.46 是 0.75 渲染的中间裁切（竖直 FOV 相同，所以画面一致）。
- 实机效果要在 Funning 的 Mac 上录。

## 风险 / 要定的事
1. 出门变长 4.4 s：PR #56 帆船转场、Voice Bot 的音效时刻（crane-start、settled 帧号见 `timing/exit_outbound_B5.timing.json`）都要跟着改。想短一点：settle 4.5 s → 峰值 9.2 m/s、总 13.2 s；6.0 s → 7.6 m/s、14.7 s。
2. 终帧沿用 B4 的 yunjing-final（y 15.5、FOV 70、Funning 还没定）。FOV 70 比原来的 42 广很多，边缘会拉伸；而且帆船离岛镜头（sail-cam-signcheck）是按 v24-readable 起始算的，采用 yunjing-final 就要重跑。
3. 门口那 0.8 s 她的脚低于 NDC -0.5，是门里那段构图继承来的（门里那段 B5 没动）；要改得动 crossOutEnd 的高度/目标。
4. 所有数字都是离线 flow_sim（恒速走路）+ 解码 GLB 几何，**不是原生 Cocos 实测**。

## 文件
`patch/` · `timing/exit_outbound_{B4,B5}.timing.json`（30 fps，同 exit-cam-v2 格式，B5 另有 riseStart/riseEnd）· `csv/`（逐帧：镜头/她的位置、水平距离、右侧偏移、净空和最近网格、脸/头/胸/脚遮挡、线段穿模、FOV、0.46/0.75 的脚和头 NDC）· `plots/` · `data/`（frames_B4/B5.json、kin_summary.json）· `tests/` · `scripts/`（kin/plot/stats/evalf/frame_chk/render/compose）· `renders/`（关键帧）· `SHA256SUMS`
