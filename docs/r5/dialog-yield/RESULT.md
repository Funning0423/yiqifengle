# r5 对话镜头让位（运镜bot，第一版）

分支 `cine/r5-dialog-camera-yield`，基于 int/v1 @084ccf6c。只在本地提交，**未 push**（箱子上没有 GitHub 登录）。
对话框规格：ui/r5-design @1f3258c7 `docs/r5/ui/dialog/final/IMPLEMENT.md`。UI 美术没有合进来，只用了 §4–§6 的版式数字（写在测试和 overlay 里）。

## 做法
- **让位方式**：对话框打开时，镜头绕自身水平右轴往下俯一点，镜头位置一点不动。
  - 这在几何上等价于把注视点往下压，所以她在画面里上移，气泡就放得下了。
  - 镜头位置不变，所以离物体的净距（≥1.1 m）和遮挡情况跟底下的镜头完全一样，不会有新的穿模或遮挡。
- **取值**（`world-r1/DialogCameraYield.ts`，`DIALOG_CAMERA_YIELD`）：
  - `pitchDeg 2.6`：returnFollow 下约等于目标点下压 0.128 m。UI bot 建议 0.10 m，我多给了一点余量。
  - `fullBelowPt 540`，`noneAbovePt 640`：屏高 ≤540 pt 时俯满额；≥640 pt 时为 0；中间用 smoothstep 过渡。
  - `seconds 0.6`
- **各屏实际下俯角**：

  | 屏幕 | 下俯角 | 约等于目标下压 |
  |---|---|---|
  | 390×520 | 2.60° | 0.128 m |
  | 320×568 | 2.10° | 0.103 m |
  | 375×667、360×780、390×844、414×896、768×1024 | 0（完全不动） | — |

- **缓动**：用 quintic 重定向，从当前值和当前速度出发，在 0.6 s 内到达目标，终点速度、加速度都是 0。
  - 开着开着又关上时连续可导，不会跳。
  - 中途反向时会自动拉长时长（最多 3 倍），保证峰值加速度不超过一次正常打开。
- **接入**：在 `WorldFlowComponent.update` 里，等 flow 和 jobs 都写完镜头后，加一个后处理 `applyDialogYield(frameDt)`。
  - 先读当前镜头。如果这一帧有别人写过，就把它当新的基准。
  - 再叠加让位，通过唯一的写镜头入口 `applyCameraPose(...,'dialog.yield')` 写回。
  - 不让位时什么都不写。
- **对话开关事件**：int/v1 上没有 DialogBubble，也没有开关事件。所以加了一个**最小钩子**：`DialogCameraYield.setDialogCameraOpen(open)`。
  - 对话框打开时调 `true`，关闭时调 `false`。
  - 接 U2 对话框时需要在它的 open/close 里各调一次。这一版没有接任何 UI。

## 各屏间距（测试实算）
- **怎么算的**：她的姿态网格凸包，用 Blender 从 A1 final GLB 导出，取 toThreshold 进度 0.45 / 0.60 / 0.75 三个位置。按 IMPLEMENT §4 算气泡、尾巴、名牌三个矩形（名字 2 个字，Wt=64），取三者到她包围盒的最小距离；表里是三个进度中最差的那个。
- **投影核对**：同一投影在 0.60 / 390×520 下跟 UI bot 的 Blender bbox（391.2）误差小于 0.6 pt。

| 屏幕 | 下俯 | 关：能放几行 / 1 行时间距 | 开：行数（fit） | 开：间距 pt | 最近的部件 | 她顶部 pt |
|---|---|---|---|---|---|---|
| 390×520 | 2.60° | 0 / 0（重叠） | 1 (1) | **21.9** | 尾巴 | 58.9 |
| 320×568 | 2.10° | 0 / 9.9 | 1 (1) | **27.8** | 名牌 | 69.5 |
| 360×780 | 0 | 2 / 27.5 | 2 (2) | **27.5** | 名牌 | 124.5 |
| 390×844 | 0 | 3 / 20.4 | 3 (3) | **20.4** | 尾巴 | 134.7 |
| 768×1024 | 0 | 4 / 64.0 | 3 (4) | **64.0** | 尾巴 | 163.4 |
| 375×667（参考） | 0 | 2 / 15.2 | 2 | 15.2 | 尾巴 | 114.5 |
| 414×896（参考） | 0 | 3 / 33.0 | 3 | 33.0 | 尾巴 | 143.0 |

检查帧（进度 0.60，Blender 渲染）：

| 屏幕 | 关 | 开 |
|---|---|---|
| 390×520 | fit 0，间距 2.8 | fit 1，间距 24.6 |
| 320×568 | fit 0，间距 10.8 | fit 1，间距 30.0 |

她没有被裁切：开的时候顶部 ≥58.9 pt，高于安全区顶部 47 pt。

注意：短屏只保证放得下 **1 行**。要放 2 行，大约还得再让 24 pt，那样她会顶到安全区，所以没这么做。

## 运动（参考位姿 0.60，390×520 满额 2.6°）
峰值，30/60/120 fps 全部情况里取最大：
- 角速度 8.1°/s
- **角加速度 41.7°/s²**（上限 120）
- 注视点线速度 0.35 m/s
- **注视点线加速度 1.81 m/s²**（上限 3；按镜头到目标 2.43 m 的距离计算）
- 镜头位置线加速度 0

测过的情况：开→关、开 0.15 s 后关、开 0.30 s 后关、关到一半又开、每 0.1 s 来回切换。
- 全部情况都满足上限，无跳变，最后都回到 0。
- 单帧最大 0.27°（30 fps），远低于跳变判据：单帧步长 × fps ≤ 15°/s。

## 测试与检查
- **`node tools/test_dialog_camera_yield.cjs`：PASS。**
  - 投影跟 Blender 对得上；5 个指定屏都能放下 1 行且间距 ≥13；她没被裁切；镜头位置不变；`validateCameraPose` 通过；更高的屏下俯为 0。
  - 运动上限覆盖上面所有情况。
  - 另外检查了 WorldFlowComponent 已接入后处理。
  - 需要 `QF_TYPESCRIPT_MODULE`。
- **loose-ES5**：`DialogCameraYield.ts`、`WorldFlowComponent.ts` 用 ES5 transpile（不开 downlevelIteration）诊断数 0。
- **`test_manifests.cjs --write`**：已更新 `text-MANIFEST-SHA256.json`。
- **已有测试**：
  - `test_window_view_night`、`test_startup_ready_gate`、`test_manifests`：PASS。
  - `test_camera0007_failure`：PASS（需要先建 `evidence/camera0007/` 目录，跑完已删）。
  - `test_world_camera_audit`：箱子上没有 Playwright 跑不了，基线上同样跑不了。

## 产物
- 检查帧在 `/workspace/yiqifengle/previews/运镜bot/r5-dialog-yield/`：
  - `CHECK_390x520_closed|open.png`、`CHECK_320x568_closed|open.png`
  - `CHECK_sheet_closed_vs_open.jpg`（也拷到本目录）
  - `raw/`（无叠加的原图和 json）
- 叠加内容：黄框是她的 bbox 和外扩 13 pt 的范围；气泡、尾巴、名牌框达标为绿色，不达标为红色。
- 角色：A1 final `/workspace/yiqifengle/previews/角色动画bot/r5-wrist-footik/final/chr_b_r5g2_r5wrist_v4_final.glb`，walk_loop 第 8 帧。
- 岛：`bc81575f:creator-project/assets/firstslice/combined_visual_m.glb`，锚点 `combined_anchors_m.json`。
- 工具：
  - `tools/camera-render/dialog-yield/bl_dialog.py`：从 UI bot 的 render_scene_bg.py 改来，加了凸包导出。
  - `overlay.py`
  - 夹具 `tools/fixtures/dialog-yield/girl_hull_p*.json`

## 未做 / 待定
- 没有接 U2 对话框 UI（int/v1 上没有）。接入时在 open/close 里调 `setDialogCameraOpen`。
- 对话框开着时转屏导致下俯角变化，会直接跟着新值走，没有做缓动。
- 只验证了 returnFollow.out。其他镜头下，这个钩子同样只做俯仰，镜头位置不动，但间距没有逐个验证。
