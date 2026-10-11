# camera-render（运镜离线预览渲染脚本，QA 用，不进包）

全部是 Blender 4.5 后台渲染 + Node/Python 辅助脚本。渲染出的图片放 `/workspace/yiqifengle/previews/运镜bot/<主题>/`，**不进仓库**。
镜头位姿一律来自运行时代码（`tools/camera-frame-test/flow_sim.cjs` 跑真实 WorldFlowCore + FirstsliceRoutes），不要手填。
用到的场景/角色都是仓库里的 GLB（`creator-build-project/assets/bundles/region_island/combined_visual_m.glb`、
`.../character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb`），没有单独的 .blend 文件。
坐标：Cocos (x, y, z) → Blender (x, -z, y)；相机四元数 [x,y,z,w]，左乘绕 X 轴 90°；`sensor_fit=VERTICAL`，FOV 为竖直 FOV。
画幅 586×1266（游戏竖屏）或 750×1624（加载页）。

## loading-base/（加载页底图）
`bash tools/camera-render/loading-base/run.sh [CHAR_GLB]`
- env：`OUT`（默认 `/workspace/yiqifengle/previews/运镜bot/loading-base`）、`TREE`（int/v1 worktree，默认 `/workspace/yiqifengle/work/int-v1`）、
  `CLIP`/`CLIP_T`（默认 `sit_hold` / 0）、`SHIFT`（镜头 shift_y，默认 -0.14）、`FSTOP`（1.8）、`SAMPLES`（32）、`BLENDER`（默认 `blender`）。
- `mock.py`：`LB_UI_DIR`（棋盘UI美术bot 切图目录，默认 `/workspace/yiqifengle/previews/棋盘UI美术bot/a-loading`）、`LB_FONT`（Noto CJK）。
- `post.py`：`LB_TMP`（中间文件目录，默认 /tmp）。依赖 numpy、Pillow、opencv-python、cwebp。
- 流程：shots.cjs（cameraHome 位姿）→ render_base.py（EEVEE 美术渲染 + mask_girl.py 女孩遮罩）→ post.py（柔焦/奶油调/标题和底部雾化，导出 `loading_base_final.jpg`、`loading_base_final_fs50k.jpg` 等）→ mock.py（叠 UI 切图看可读性）。
- 校验：脚本会打印女孩所占行范围，必须在 32%–75% 之内。
- `home_shot.json`：上一次渲染用的位姿（参考）。

## return-follow/（回屋跟随镜头 + 亮度曲线）
1. `node tools/camera-render/return-follow/lightframes.cjs OUT.json [every=2] [day|night]`（cwd = worktree 根；`QF_TYPESCRIPT_MODULE` 指 typescript）
   —— 每帧相机 + 真实 RoomLightingRig 状态（w、exterior key、主光方向/强度、环境光）。
2. `blender -b -P tools/camera-render/return-follow/bl_light.py -- ISLAND_GLB CHAR_GLB FRAMES_JSON OUTDIR [start] [step] [names_csv]`
   env：`RES_PCT`（25）、`SAMPLES`（8/16）、`ENGINE`（CYCLES 默认 / EEVEE）、`DENOISE=1`。固定曝光（Cocos EV100=15）。
3. `python3 tools/camera-render/return-follow/curve.py OUTDIR FRAMES_JSON [every]` —— 每帧平均亮度曲线。
- `keyframes.json`：交付时那 5 张关键帧（t=24.8/28.5/31.9/34.6/41.9 s）的输入。**夜间版本还没渲**（`lightframes.cjs ... night`）。

## scene-preview/（房间/出门/小岛/回程的 Workbench 快速预览）
- `mkshots.cjs <tools/camera-frame-test 目录> <out.json> 'name|t|label' ...`：按 leaveHome 后的秒数取帧，输出 shots。
- `bl_room.py` / `bl_room_door.py`（`DOOR_DEG` 环境变量转门叶）：`blender -b -P X.py -- ROOM_GLB CHAR_GLB SHOTS_JSON OUTDIR [FLAT|STUDIO]`。
- `bl_int_mask.py`（门洞内景遮罩，doorway-clean 用）、`bl_spill_mask.py`（门缝光斑遮罩，第 5 个参数 spill json）、`spill_comp.py`
  （光斑合成；`SPILL_JSON`/`SPILL_SHOTS`/`SPILL_PREVIEW`/`SPILL_RENDER_DIR`）。
- `bl_render.py` / `bl_top.py`：单 GLB 渲 shots / 俯视路径图。`sheet.py`：拼联系表。`proj.py`：把世界点投到画面像素。
- `shots/*.json`：room-camera、frontal-swing、lens-occlusion、spill 当时用的机位（重渲可直接用，但代码改了以后应该用 mkshots 重新取）。

## design-search/（镜头关键帧的随机搜索脚本，参考）
`swing_opt3.cjs`（出门正面环绕）、`ret_opt.cjs`（回程轨道）、`lensscan.cjs`（逐帧近镜头扫描）。
`CAMERA_TEST_DIR=<worktree>/tools/camera-frame-test/ node swing_opt3.cjs params.json [iters]`。只用于找初值，结果要手工写回
`RegionCameraData.ts` 并跑 `test_camera_frames`。
