# 出门运镜 v2（运镜bot，2026-10-15）· 候选，游戏没改，没推送
基线 5c54f7a。改动只在 `patches/`（`git apply --check` 在 5c54f7a 上两份都通过）。几何 = 5c54f7a `combined_visual_m.glb`（原房间，不是 slim）。数字来自仓库 `tools/camera-frame-test/flow_sim.cjs`（真 WorldFlowCore/routes，60 fps），离线，**不是原生 Cocos 实测**。

## 改了什么（patch 内容）
| | 改前 5c54f7a | after A `patches/exit-cam-A.patch` | after B `patches/exit-cam-B.patch` |
|---|---|---|---|
| `FirstsliceRoutes` distanceRate | 1.176 | **1.0** | 1.0 |
| `crane.settleSeconds` | 4.02 | **1.2**（见注）| **2.0** |
| 终帧 | v24-readable (-12,15.5,48)→(1,.5,1) 42° | `yunjing-final` **(1.1, 20.5, 35.77)→(1.1, 1.0, 2.0) FOV 42**，`islandPoseSource='yunjing-final'` | 同 A |
| 门 `doorDrift.islandDeg` | 45 | **86.4**（= openDeg，全开不回摆）| 同 A |
| 出门弧 | 走海那侧（她左边）| 不变 | **翻转**：`depart.turn: 1`（新可选字段，默认 -1 = 原样），`radial 1.55→2.2`、`climb 1.35→2.0`（不加大会被 "rotate, dolly and lift must overlap" 校验拒绝）|

注：Grok Bot 定的 settle 2.5 是按旧终帧算的。新终帧更近，弧从 ~50 m 缩到 47.3 m，settle 2.5 只有 5.9 m/s（代码校验直接报错）；**1.2 s 才回到 7 m/s**。

## 结果
| 项 | 改前 | A | B |
|---|---|---|---|
| 巡航（常速走路 / 真走路驱动）| 5.91 / 5.92 m/s | **6.99 / 7.01**（最大 7.04 / 7.17）| **6.97 / 6.98**（最大 7.01 / 7.14）|
| 出门总长（crossing-out 起 → 落定）| 13.15 s | 10.30 s | 11.13 s |
| 镜头在她右侧（547 帧有走路方向的）| 264 右 / 283 左 | 248 / 299 **FAIL** | **511 / 36**；剩下的 36 帧是门里 10.42–11.02 s（crossOutEnd 门口键 side -1，没动）|
| 穿墙（相邻帧线段 vs 墙/房间/地面/道具/开着的门板）| 0 | **0 PASS** | **7 次 FAIL** |
| 最近距离 灯塔外墙 / 房间壳 / 门板 / 道具 | 0.258 / 0.342 / 0.171 / 0.150 m | 0.253（t=12.78，门楣下）/ 0.341 / 0.167 / 0.150 | **0.001**（t=12.92 (-0.43,2.72,0.00) 门楣上方外墙）/ 0.116 / 0.344 / 0.150 |
| 终帧：岛（灯塔顶→岛底）占画高 | ~30% | **~48%**（投影计算）| 同 A |
| 终帧：灯塔+小屋中心 NDC x | -0.08 / -0.05 | **0.00 / 0.00**（0.46 / 0.75）| 同 A |
| 终帧：俯角 | -17° | **-30°** | 同 A |
| 终帧：她的盒 y_min（要 > -0.5）| -0.116 | **-0.19 PASS**（0.46 和 0.75）；x -0.56…-0.45（0.46）/ -0.34…-0.27（0.75），在 |x|≤0.7 内 | 同 A |
| 门 | 落在 45° | 86.4° 全开 | 同 A |

### B 穿墙（没解决）
弧翻转后，镜头出门口时往她右边转，正好贴着灯塔正面往上走，7 帧线段穿过门楣上方的外墙（t 12.83–13.12 s，x -0.06 → -1.47，y 2.45–3.15）。另外试了 9 种组合，都还在穿墙（最好的 2 次，0.008 m）：把外移方向反过来（`shiftX`）、去掉跃起（`hop 0`）、延长沿门口直线出去的距离（`rayTau 2.0–2.6`）+ `radial 2.6`。这两个选项默认值不变，只用于测试，没写进 patch。
我的判断：要右侧规则，得让镜头先沿门口直线出去 ≥2 m（离开墙面）再开始绕，或者干脆从她头顶越过到右侧。这需要改弧的结构，不是调参能解决的。**B 现在只能看效果，不能进游戏。**

## 视频
`video/exit_compare_before_A_B.mp4`：竖屏三栏（左 = 改前，中 = A，右 = B），10 fps，每栏 270×588（0.46），从 crossing-out 开始（视频 t=0 = 模拟 9.53 s），短的那栏停在终帧等长。B 穿墙在视频 3.3–3.6 s。画面提亮过（gamma 1.4）。Blender Workbench 带贴图粗渲；角色是静止姿势沿真实 root/yaw 滑动（没有走路动画），只用来看镜头路线。门角度逐帧用模拟值。

## 给 Voice Bot / GGbot
- `timing/exit_outbound_{before,A,B}.timing.json`（和 m1v2 的 timing.json 同格式，30 fps，frame 0 = crossing-out 开始）：walkEnd、craneStart、settledIsland、风 base/满开始/满结束帧、门角度、逐帧 FOV。A：总 309 帧（10.3 s），craneStart 188，settled 310，风满 186–236。
- 草甸转场 timing：`../sailboat-transition-storyboard/transition_island_to_meadow.timing.json`。

## 文件
- `patches/` 两份 patch；`out/camera_track_{before,A,B}.json`、`out/frames_*.json`、`out/speed_*`、`out/clear_{A,B}/`（逐帧净空 + 穿墙点）
- `renders/compare_ref_before_after_{0.46,0.75}.png`、`afterA_final_*`、`before_final_*`
- `scripts/`：dump_frames.cjs、side_count.py、make_timing.py、island_check.py、render_video_frames.py

---
## B2（2026-10-15 16:10 要求）：右侧 + 不穿墙 —— **没做成，下面是最好的一次尝试**
在 `paceOutbound` 里加了几个可选参数（默认都和现在一样）：`straightM`（沿门口直线先出去几米再开始绕）、`rayMps`（这段直线的速度）、`preTurnDeg`、`minZ`。这些只用于测试，**patch 里只用了 straightM / rayMps**。A 的其他值都没动：distanceRate 1.0、终帧 (1.1,20.5,35.77)→(1.1,1.0,2.0) FOV 42、门 86.4°。A 的 settle = 1.2（已确认）。

**最好的 B2（`patches/exit-cam-B2.patch`）**：`depart{turn:1, straightM:2.5, rayMps:1.0, radial:2.6, climb:2.4}`，`settleSeconds 4.0`
- 速度：常速走路 7.06 / 真走路 7.07 m/s（最大 7.14 / 7.22），**游戏自己的速度检查通过**（cruise、overlap、crowd 三项都过）。
- 右侧：475 右 / 72 左（左边那些：门里 10.43–11.02 s，加上 12.83–13.45 s 直线出门时镜头就在她正后方，左右符号来回跳）。
- 穿墙：**3 次 FAIL**。t=13.55 s 在门楣上方外墙 (0.10,3.23,-0.01)，t=13.93/13.95 s 在灯塔外墙 (-2.2,3.66,-1.5)；灯塔外墙最近 0.010 m，房间壳最近 0.013 m。门板 0.185 m，道具 0.150 m。在视频里是 B2 栏 4.0–4.4 s。
- 出门 13.13 s；craneStart 帧 311 在她停下（274）**之后**，也就是正面那一下要等她站住才出现。
- 终帧和 NDC 和 A 一样（PASS：她的盒 y_min -0.19，0.46 和 0.75 都过）。

**原因**：门外她只走到离墙大约 2 m（z≈1.8–2.4）。往右绕的弧一开始在她身后，身后就是灯塔，所以半径 ≥1.7 m（游戏的 "crowds her" 下限）的身后位置几乎都在墙里。直线出去 2–3 m 也只是把撞墙往后推了一点，因为弧随后会绕回她身后。
**试过但都被游戏自己的检查拒绝**（大约 150 组）：
- `preTurnDeg` 45–120（弧直接从她右侧开始，不经过身后）：crowds her，minD 0.16–1.43 m。
- `minZ` 1.0–1.8（把弧挡在墙前面）：crowds her。
- 从她头顶越过：这个检查量的是水平距离，越顶的时候水平距离是 0，必定不过，除非改检查本身。
**我的建议**：要右侧，需要两件事里做一件：(a) 对出门这一段放宽 crowd 下限（比如 1.7→1.0 m，门口她身后只有大约 2 m 空间），配 preTurn 90 + minZ 1.0；(b) 镜头在门里先移到她右边（改 crossOutEnd 的 side，改成 +1），这样出门时已经在右侧，不用从身后绕。两种都要 Grok Bot 定，我没做。

视频（按要求改成三栏）：`video/exit_compare_before_A_B2.mp4`（改前｜A｜B2）。B 的旧视频 `video/exit_compare_before_A_B.mp4` 保留。
B2 的数据：`out/camera_track_B2.json`、`out/frames_B2.json`、`out/speed_B2_*`、`out/clear_B2/`（穿墙检查到 t≤17 s，之后镜头已经在 7 m 以上）；timing：`timing/exit_outbound_B2.timing.json`。

---
## B3（2026-10-15 16:42，Grok Bot 选了 (b)）：门里就把镜头放到她右边 —— **FAIL：穿墙 5 次**
`patches/exit-cam-B3.patch`（对 5c54f7a，`git apply --check` 通过）= A 的值（distanceRate 1.0、终帧、门 86.4°）再加：
- `crossOutEnd.side -1 → +1`（门口那个键放到她右边，其他数不变）
- `crane.pace.depart.turn: 1`（弧往右绕；radial 1.55 / climb 1.35 和原来一样），`settleSeconds 1.6`
- 1.7 m 的距离下限没动。

| 项 | B3 |
|---|---|
| 巡航（常速走路 / 真走路）| 7.01 / 7.02 m/s（最大 7.05 / 7.18），游戏自己的速度检查都通过 |
| 出门时长 | 10.73 s（322 帧 @30 fps）|
| 右 / 左 帧数 | **406 / 141**。左边的段：门里 10.42–11.02 s；12.18–12.68 s 跨门槛时镜头在她正后方，左右来回跳；15.58–16.97 s 绕到她正面以后、往终帧去的那一段。终帧在她 +x 一侧（= 她左边），所以最后这段只要终帧不动就一定在左边 |
| 穿墙（全程 645 帧都查了）| **5 次 FAIL**：t 12.98–13.12 s（视频 3.45–3.6 s），灯塔外墙在门楣上方 (x -0.56→-1.33, y 2.9–3.1, z≈0→-0.2) |
| 最近距离 | 外墙 **0.008 m**，房间壳 0.103 m，门板 **0.009 m**，道具 0.150 m，地面 1.51 m |
| 终帧（和 A 同一个位姿）| 岛约占画高 48%（投影计算）；她的盒最低点 y **-0.19**（0.46 和 0.75 都过）；灯塔+小屋 x 0.00 |

**0 穿墙在 1.7 m 下限下做不到，原因**：出门以后她离灯塔正面只有大约 1.8–2.4 m。镜头要从门口（她背后）绕到她右边，同时离她水平 ≥1.7 m，就会走到墙面的位置上，没有既在墙外、又离她 1.7 m 的通道。
我量过两头：
- 用 `minZ` 把弧挡在墙外：0.4 / 0.8 / 1.2 m 都被游戏拒绝，因为离她太近（minD 1.36 / 1.12 / 0.85 m）。
- 再加 `preTurnDeg 45`：转身、后拉、升高不再同时进行（overlap 检查不过），速度也不够。
- 让弧在门口沿直线走 2 m、去掉外移、降低跃起（四个组合）：7–12 次穿墙，比上面这版还差。
所以这个开局要达到 0 穿墙，只能在这几样里改一样：(1) 只对出门这段把下限降到大约 1.2 m；(2) 允许出门第一秒镜头在她左边（= A）；(3) 让她先走离墙更远，比如出门路线前 2 m 直走，再开始绕。都要 Grok Bot 定。

文件：`patches/exit-cam-B3.patch`、`timing/exit_outbound_B3.timing.json`、`video/exit_compare_before_A_B3.mp4`（改前｜A｜B3，0.46）、`renders/B3_final_0.75.png`（终帧位姿/门/角色和 A 完全一样，所以就是 A 的 0.75 渲染）、`out/{camera_track,frames,speed}_B3*`、`out/clear_B3/`。

## B4（方案 3：改她的出门路线）— 2026-10-15

**结论：除一项外全部达标。** 剩下那项是游戏测试 `exit-cruise-real` 里写死的“门 = 45°”条件。B4 要求门全开（86.4°），和这条正面冲突，不是镜头本身的问题。把门改回 45° 时，B4 的游戏测试 **ALL PASS**（2376 帧）。

### 改动（相对 5c54f7a，见 `patches/exit-cam-B4.patch`，`git apply --check` 通过）
- **路线**：出门后先向右前方走约 2 m，离开灯塔墙，再接回原来的 exit_path_17。终点不变，所以岛上停留和回家路线都不受影响。
  新点（Cocos x,z）：(-0.3,0.69) (-0.6,1.45) (-1.1,2.2) (-1.65,2.95) (-2.05,3.7) (-2.15,4.35) (-2.12,4.85) → exit_path_17。她走这条路线（根高 0.5 m）：0 次碰撞，离道具最近 0.33 m，离墙最近 0.49 m。
- **distanceRate 1.176（原值，不改）**。速度按游戏自己的时钟（按她走过的距离计时）测。我之前得出的“1.0”结论作废。
- `crane.settleSeconds` 4.02 → **1.0**（路线短了）；`pace.rampSeconds` 0.92 → **1.03**。
- `depart`：新增 `turn: 1`（向右绕）、`straightM: 0.45`、`rayMps: 1.15`；`aimDeg` 14 → **22**。
- `crossOutEnd.distance` 0.158 → **0.25**（side 不变）；`X2.x` -0.4 → **-0.5**，`O.x` -0.353 → **-0.5**。
- `doorDrift.islandDeg` 45 → **86.4**（门全开）。
- **终帧位姿改动**（`yunjing-final`，islandPoseSource 指向它）：position (-3.26, 15.5, 24.73)，target (1.1, 1.0, 0.0)，fov **70**。俯角 30°，方位和 B3 那版一样，只是拉近到高度 15.5，因为游戏测试要求终点高度正好 15.5（B3 版是 y 22.5）。旧 A 位姿在她左边，已弃用。
- `FirstsliceRoutes` 新增的 depart 参数都是可选的，不填时和原逻辑一样。lens-crowds 的调试信息已删掉。

### 数字
| 项目 | 要求 | B4 |
|---|---|---|
| 穿墙（整条路线，`out/clear_B4`） | 0 | **0**（walls_ext 最近 0.017 m @12.95 s，room_shell 0.181 m，门板 0.587 m，道具 0.150 m，地面 1.51 m） |
| 在她左边的帧 | 0 | **0 / 586**（全程在右，离中线最近 +0.086 m @3.2 s） |
| 水平最小距离 | ≥1.7 m | 通过（routes 内置检查） |
| 游戏时钟巡航 | 6.6–7.4 | 峰值 7.261，持平段 6.828–7.261，转身段 6.332–7.261，2.07 s |
| 动画时间时钟（exit-overlap） | 5.4–6.5 | 6.13（转动中和转完后都是 6.13，比值 1.0），转身段 5.645–6.127 → PASS |
| 角加速度 | <360 °/s² | **347.9**（13.02 s）PASS |
| 终帧岛高度（渲染实测，灯塔顶到浪花底） | 45–50% | **47.6%**（0.75）/ **47.9%**（0.46） |
| 她的 bbox NDC 最低点 | > -0.5 | **-0.231**（0.46 和 0.75 相同） |
| 灯塔+小屋中心 NDC | 居中 | x -0.040（0.46）/ -0.024（0.75），y 0.135 |
| 门 | 全开 | 86.4° 从头到尾 |
| 游戏测试（`out/suite_B4.txt`） | ALL PASS | 只有 exit-cruise-real 不过，原因是 `doors = islandDeg===45`；它的速度数值全部在范围内。门改成 45 时 ALL PASS |

时间（`timing/exit_outbound_B4.timing.json`，30 fps）：时长 9.733 s，镜头升起开始 186 帧，岛上停稳 293 帧，她停步 263 帧。

文件：`patches/exit-cam-B4.patch`、`timing/exit_outbound_B4.timing.json`、`video/exit_compare_before_B4.mp4`（改前｜B4，0.46，540×588，10 fps）、`renders/B4_final_0.75.png`、`renders/B4_final_0.46.png`、`out/frames_B4.json`、`out/camera_track_B4.json`、`out/clear_B4/`、`out/finalB4/`。
