# 帆船离岛镜头 × 首页招牌候选 C / A2 净空检查（运镜bot，2026-10-16，只读，未推送）

## 结论：C、A2 都通过
| 候选 | tree（b14067c 上 git am 后核对） | 招牌最近 | 棕榈最近 | 岛体最近 | 挡脸 | 她最低点 NDC y |
|---|---|---|---|---|---|---|
| C 2936c30 | 9ff75f76afd7d8da2cd47df3b2a0dc618744663b ✅ | 49.72 m @帧0 | 44.41 m @帧0 | 16.42 m @帧0 | 0 帧 | -0.109（帧0–12） |
| A2 3e6b7df | 526722d627bf135ccfb20b5ae0e5f76e73cf09bc ✅ | 49.40 m @帧0 | 44.41 m @帧0 | 16.42 m @帧0 | 0 帧 | -0.109（帧0–12） |
规则：净空 >1 m ✅；镜头不穿任何东西 ✅；不挡脸 ✅；最低点 NDC > -0.5 ✅。最近点都在帧 0–12（S1 停留，镜头最靠近岛），之后镜头只会后退。

## 用的是游戏实际会跑的镜头
- b14067c **没有帆船转场代码**（cine/ 目录是 PR #56 新增），所以用 PR #56 head d317b2f 的 `SailboatTransitionDriver.syncCamera` + `SailboatTransitionModel.presentation` + `resources/cine/transition_island_to_meadow.timing.json`。
- 起始镜头 = `islandPoseEntry()` = v24-readable：position [-12,15.5,48] → target [1,0.5,1]，竖直 FOV 42。`RegionCameraData.ts` 在 b14067c 和 d317b2f 上逐字节相同；也等于 Voice Bot track_cur.json 出门去程最后一帧。
- 岛上段（帧 0–80）：S1 帧 0–12 静止；S2 帧 12–48 沿视线后拉 0–8 m（`PLACEHOLDER_DEPARTURE_DOLLY_M`），FOV 42→45 线性；帧 48–80 不动。帧 81 换到草甸场景，之后跟招牌/棕榈无关（CSV 里标 meadow）。草甸晚到的等待和跳过都不会动岛上镜头。
- 她：帧 0–12 可见，站在 islandCharacter root [-2.1135,0,5.2814]；`syncActor` 从 departure>0（帧 13）起把她隐藏，所以挡脸只对帧 0–12 有意义（CSV 里帧 13–80 也算了射线，全是 0 遮挡）。

## 方法（沿用 Voice Bot camera_path/campath.py 和 meadow-cam-check proj.py）
- 场景 json 用 Voice Bot 的 `tools/gen.cjs` 从我自己的 scratch worktree 重新生成（`scene/`）；招牌/棕榈参数和 Voice Bot fin/*_far.json 逐项一致。
- `scripts/sail_measure_bl.py`（Blender 5.2.2）：跟 campath.py 一样导入 GLB、建 BVH，每帧算镜头到招牌、棕榈、岛体（combined_visual_m.glb，hide 列表同 gen.cjs）的最近距离；从镜头往她的脸（root+1.55）、头顶（+1.7253）、脚底打射线，看有没有被招牌/棕榈挡住。
- `scripts/ndc_csv.py`：Cocos lookAt（up +Y）、竖直 FOV、竖屏 402×874 投影，算脸和脚的 NDC。
- `scripts/sail_track.py`：按 d317b2f 代码逐帧重建镜头 → `track_sail.json`。

## 文件
`sail_frames_C.csv`、`sail_frames_A2.csv`（30 fps 逐帧 157 行）· `summary.json` · `track_sail.json` · `scene/` · `scripts/` · `keyframes/`：`*_sail_f00-12`（= 起始镜头，复用 Voice Bot 同机位远景白天帧）、`*_sail_f48`（后拉结束，Blender 预览）。

## 注意
1. 都是离线计算 / Blender 预览，不是 Cocos 实机；关键帧图里还画着首页三个道具按钮（gen.cjs 生成的），帆船转场时 HUD 实际是隐藏的。
2. A2 加长左腿（0.057 本地单位）没有在 BVH 里模拟，跟 campath.py 一致；离镜头 49 m，影响可忽略。
3. 起始 pose 假设出门结束在 v24-readable；如果 Funning 以后改用 yunjing-final（timing.json 里写的候选 (1.1,20.5,35.77)），需要重跑 `sail_track.py`。
4. 帆船本身（占位船在 dock/exit_path_17 附近）没有纳入检查；她在帧 13 起隐藏，没有"在船上"的脸可挡。
5. 只读：没有提交、没有推送；scratch worktree 已删除。
