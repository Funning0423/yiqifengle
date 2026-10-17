# 出门运镜验收 · 5c54f7a（运镜bot，2026-10-15，只读，游戏没改）
主线 `mac/task21-web-ui` @ 5c54f7a。房间/海岛几何 = 5c54f7a 的 `creator-project/assets/firstslice/combined_visual_m.glb`（blob 43f0d21d，**不是** GGbot 的 slim 房间）。

## 实现在哪
代码驱动，不是烘焙：`RegionCameraData.ts` → `TRANSITION_CAMERA.crossOutEnd` + `crane`（`settleSeconds 4.02`，`pace.cruiseMps 7`，`depart{aimDeg 14,radial 1.55,climb 1.35,…}`）；`FirstsliceRoutes.paceOutbound` 生成一条弧（门口 → cameraIsland）；`WorldFlowCore.leaveHome` 播放。终帧 = `islandPoseSource 'v24-readable'`：position (-12,15.5,48) target (1,0.5,1) FOV 42。`'yunjing-final'` 仍是 null。
测量：仓库自带 `tools/camera-frame-test/flow_sim.cjs`（真 WorldFlowCore + routes，60 fps），常速走路 + GGbot 真走路驱动（`--real-walk` 同款）各跑一次。

## 结果
| 项 | 结果 | 数值 |
|---|---|---|
| 巡航速度 ≈7 m/s | **FAIL** | 实测 **5.92 m/s**（常速 5.91，真走路 5.92；最大 5.94/6.04），平台 13.0–21.75 s（leaveHome 起算），整段出门 13.15 s / 58.7 m。原因：代码假设走路距离钟比时间钟快 1.176×（`distanceRate=1.176`），实测两种走路下都≈1.0，所以 7/1.176=5.95 |
| 走路速度 | PASS | 0.70 m/s（真走路峰值 1.22 m/s 是起步段） |
| 镜头穿墙 / 门楣 | PASS | 逐帧相邻位置线段对墙、房间壳、地面、道具、开着的门板：**0 次穿过**。最近：灯塔外墙 **0.258 m**（t=12.82 s，(0.482,2.291,0.328)，正好是出门口往上升、门楣下方那一帧），房间壳 0.342 m，门板 0.171 m，道具 0.150 m（t=9.52 起点 D4 键，刚好等于 0.15 m 线）|
| 镜头在她右侧 | **FAIL（和设计冲突）** | 出门 547 帧里 283 帧在她左侧：10.43–11.02 s 和 **12.83–16.97 s**（整个摆到正面的弧都走海那侧 = 她左边，代码注释写明 outbound seaward = side -1）。要满足右侧规则得把弧整体镜像，这是构图改动，等 Funning 定 |
| 终帧 vs 参考图 | **FAIL（构图）** | 见下 |
| 角色盒在 NDC y=-0.5 以上 | PASS | 现终帧 y_min -0.116（0.46 和 0.75 一样）|

### 终帧和 Funning 参考图的差别（`renders/compare_ref_before_after_{0.46,0.75}.png`）
- 俯角：现在 ≈ -17°（参考 ≈ -25～-30°），所以岛很扁，地平线压得低，上半屏全是海。
- 大小：现在岛只占画高约 30%；参考约 50%（岛宽撑满屏宽）。
- 居中：灯塔 bbox 中心 NDC x -0.083 / -0.051（0.46/0.75），灯塔+小屋这一对偏左；参考里这对居中。
- 门：运行时终帧门是 `doorDrift.islandDeg 45°`（半开），参考里门大开能看到屋内。离线渲染里门洞读不清（EEVEE 粗渲 + 黑点伪影），**门开度这一项没法从渲染判，只按数据报**。

## 建议值（只是候选，没改游戏）
1. 速度（二选一，都实测 **7.01 m/s**，最大 7.05）：
   - 纯数据：`crane.settleSeconds 4.02 → 2.5`，`crane.pace.cruiseMps 7 → 8`（校验仍按 1.176 算，8/1.176≈6.8 在 0.45 容差内）。
   - 正确修法（改一行代码）：`FirstsliceRoutes.ts` `distanceRate 1.176 → 1.0`，`settleSeconds 4.02 → 2.5`，`cruiseMps` 保持 7。
   - 副作用：出门总时长 13.15 → ~11.6 s；crane-start/settled 标记、风的键、音频对时跟着提前，要 Voice Bot 对一下。轨迹是同一条弧（只改时间），但穿墙复查还没在新时间上跑。轨迹：`out/camera_track_proposed_rate1_settle2.5.json`。
2. 终帧 `'yunjing-final'` 候选 **candC**：position **(-4.4, 22.5, 45)** target **(1.5, 2.0, 1.0)** FOV **42**。俯角约 -25°，灯塔 x -0.093/-0.057，她 x -0.375/-0.23、y_min -0.227（PASS）。参考图里的岛还要再大约 15%；要更近可以用 candB (-3.9,24,39.6)→(1.5,1.5,1.0)（大小更接近，但看不到地平线）。终帧位姿一变，出门弧的终点也跟着变，速度要重测。
3. 门：要像参考那样大开，`doorDrift.islandDeg 45 → ~80`（之前选 45 是为了不露出乱的屋内，所以要 Funning 定）。

## 没做 / 限制
- 渲染是 Blender EEVEE 粗渲（小屋/树有黑点伪影，光照不是游戏里的光），只用来比构图；还没在原生 Cocos 里实测。
- 右侧规则修正（弧镜像）没出方案值。
- 在新时间上没复查穿墙，也没复查 lens-near-geometry 套件。

## 文件
- `out/camera_track_5c54f7a.json` 逐帧轨迹；`out/outbound_speed.json`、`out/speed_5c54f7a_{const,realwalk}.json` 速度；`out/lens_clearance_per_frame.json`、`out/island_check_result.json` 净空/NDC；`out/cand*/` 候选 NDC
- `renders/current_final_*`（改前）、`candA/B/C_*`（候选）、`compare_ref_before_after_*`（参考｜改前｜改后）
- `scripts/speed.py`、`scripts/realwalk_speed.cjs`、`scripts/island_check.py`（Blender，.blend 不保存）
