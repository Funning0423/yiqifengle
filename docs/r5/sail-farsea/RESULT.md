# r5 帆船远海镜头：风车可辨识（cine/r5-sail-farsea）

基线 `gbt/r5-integrated-b07-wip` @ bc81575f（含 sail-qa4）。**只改** S-d 段远海机位 K3（K7 夜景静帧与 K3 同机位，随之改变），其余 K1/K2/K4/K5/K6 机位、帆船总时长（build05S = 24.6 s，≤ 30.5 s）不变。

## 改了什么
`creator-build-project/assets/scripts/region/TransportLeg.ts`
| | 旧（sail-k2k7） | 新 |
|---|---|---|
| K3 偏移（船体系） | back 8.2 / side +7.8（左舷后方）/ up 5.0 / fov 52 / look 0.2 | back 10.5 / side −2（略偏右舷正后方）/ up 4.4 / fov 52 / look 3（看船头前 3 m） |
| 进入 K3 的弧（orbitMix） | S-d u 0.12→0.24（约 42°） | u 0.12→0.30（约 96°，1.62 s，smootherstep 等半径弧） |
| K3 定格 | u 0.24–0.42 | u 0.30–0.42（1.08 s） |
| 离开 K3→K4 | u 0.42→0.56 | 不变 |

原因：风车在船头方向偏左约 15°、约 80 m 远处。旧机位在左舷后方看向右前方，风车落在画面左边外约 6.5 ndc，全程 0%（qa4 实机录屏 15–17 s 也印证了这一点）。新机位在船后略偏右、压低一点、看向前方，风车、铃架、小路和草地会出现在船上方的上三分之一处，女孩位于画面中下部。
回滚：K3 恢复旧那行，并把 `SAIL_K3_IN` 改回 0.24。

## 数据（真实 env_meadow.glb + sailboat.glb，z-buffer 光栅，60 fps）
- **风车屏占比**：
  - 390×844 静帧 2.73%（包围盒高 17.2% H、宽 35.4% W，位于上半屏）；改前 0%。
  - 定格期间各屏最差值：390×844 2.53%、414×896 2.55%、360×780 2.48%、375×667 2.04%、320×568 2.05%、390×520 1.55%、768×1024 1.55%。
  - Blender 蒙版复核：390 静帧 2.82%。
  - 对比度：日间风车与周围的亮度 Michelson 对比只有 0.047，主要靠颜色和轮廓辨认（白塔 + 棕顶对蓝绿）；夜间 0.465（剪影）。
- **离几何最近距离**：S-d 全段最小 5.7 m（meadow_terrain，t = 14.1 s），≥ 1.1 m。
- **运动**：
  - 摆镜窗口 u 0.12–0.56：角速度峰值 103.4°/s（原窗口 65°/s），角加速度 322°/s²，镜头线加速度 57.4 m/s²，速度 18.3 m/s。
  - 整段帆船峰值不变：172.5°/s、705.7°/s²，出现在没改过的 K2→Kbeam。
  - 无跳变：机位连续，orbitMix 两端导数为 0。
- **女孩**：
  - 头部从不被遮挡。胸口仅在摆镜中被灯笼和缆绳这种细物件挡了 0.033 s；帆、桅杆、船体、座椅都不遮挡。
  - |ndc| ≤ 0.8，静帧头部 ndc 为 (−0.22, −0.16)。
  - 已有、未改动的情况：S-d u 0.02–0.056（K2→Kbeam）头部被短暂遮挡，属于基线原样。

## 新增检查 `tools/transitions/test_sail_farsea.cjs`（已加入 run-suite，排在 sail-continuity 之后）
- 风车占比：7 种屏在定格全程 ≥ 1.0%，390 静帧 ≥ 2.0%。包围盒高 ≥ 12% H，留 3% 边距，位于上半屏。
- 离几何 ≥ 1.1 m。
- 摆镜窗口：w ≤ 110°/s，a ≤ 360°/s²，线加速度 ≤ 60 m/s²。整段帆船：≤ 173°/s，≤ 706°/s²。
- 女孩：头部不被遮挡；细物件遮挡 ≤ 0.15 s；实体物件遮挡 0 帧；|ndc| ≤ 0.8。
- 金标：K1/K2/K4/K5/K6 机位不变，build05S = 24.6。
- 共享库：`tools/transitions/sail_farsea_lib.cjs`。

## 测试
- 通过：test_sail_farsea、test_sail_k2k7（星空 28 px 通过，K7 换机位后仍满足）、test_sail_continuity、test_sail_art、test_sail_clearance、test_transport_sail、test_sail_dock_path、test_frame_background。
- 全套 `run-suite.cjs`（2026-10-18 box）：PASS 121 项；navigation-guard = BLOCKED_BROWSER（预期）。另有 2 项是**环境原因的 FAIL，基线一样会失败，与本改动无关**：
  - region-nodes-data：suite 环境下找不到 blender，也没有 fixture `tools/region-nodes/fixtures/room_no_original_chair.glb.walk.gz`。单独运行 `node tools/region-nodes/test_region_nodes_data.cjs` 通过（exit 0）。
  - lens-clearance：测试读的是 `ROOT/../../r5-region-nodes-r3/maps/topmap.cjs`，worktree 放在 work/ 下时路径不存在。临时软链到本分支的 `docs/r5/maps` 后运行通过（PASS，最小 4.63 m，env_sky_starring），软链已删除。

**未测**：
- 真机 / 微信开发者工具录屏（需走 Mac 队列）。
- Cocos 实际着色下的风车对比度：Blender 只是代理渲染，没画尾迹、浪花和海面道具。
- 岛屿几何的净空：离线库只载入了草原和船，岛屿在 S-d 段距离 > 60 m。

## 预览
`/workspace/yiqifengle/previews/运镜bot/r5-sail-farsea/`
- `compare/u040_K3still.png`（★ 390 日间改前/改后）
- `compare/K7night.png`（★ 夜景）
- `compare/u040_K3still_360x780.png`、`compare/u040_K3still_768x1024.png`
- `compare/seq_before.png`、`compare/seq_after.png`（S-d 关键帧 u 0.12→0.56）
- `raw/`：单帧及风车蒙版

渲染脚本：`tools/camera-render/sail-farsea/shots.cjs`（需要旧 TransportLeg：`git show bc81575f:creator-build-project/assets/scripts/region/TransportLeg.ts`）和 `bl_sail.py`（`blender -b -P bl_sail.py -- shots.json OUTDIR`；MASK=1 时输出蒙版）。

本目录：`k3_before_after_390.jpg`、`sd_keyframes_after.jpg`。
