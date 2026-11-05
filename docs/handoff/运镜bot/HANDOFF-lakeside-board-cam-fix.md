# HANDOFF — cine/lakeside-board-cam-fix（湖畔进盘轻俯视相机）

**日期**：2026-11-05（America/New_York）  
**分支**：`cine/lakeside-board-cam-fix`  
**tip**：`ef19b1af` / `ef19b1af39a7d8b8ed51cf1be31a8686dd92ca11`（fix `c6835e99`）  
**基线**：`gbt/r5-b20-integrate-landing-visual-bg2` @ `6bd40657`  
**验收前**：不推 GitHub、不传微信。可 bundle。  
**范围**：仅运镜（portrait 双机位 + kit flag 切换）。**零碰** TSW / morph / 气球 tip / kit 实例过滤与 preload 竞态（空盘资产挂载归 GGbot，见 PM `work/pm/lakeside-empty-on-trial-20261105.md` §2.1 / §4.1）。

---

## 1. 改了啥

### 根因（PM §2.2）
- 不是「没进盘相机」：`LakesideBoardBackground.frame()` 已 `applyCameraPose(lakesideAlignedBoardPose)`。
- portrait 机位本身是 b18 **岸边观光镜** `[2,6,33]→[.5,.7,2]`（≈22 m、俯角 ~−10°）——与 Funning 空盘坏样一致；样板要**带一点俯视、盘面可点**。

### 改法（PM §4.2）
1. **保留两套 authored lens**（勿毁掉 kit OFF 观光镜）  
   - `board.portrait` = b18 观光（kit OFF / 2D tray 路径：托盘下仍见南岸人物/桥）  
   - `board.portraitFusion` = 轻俯视近景（kit ON）：`main [0,9.5,23]→[0,.15,10] fov 50` ≈ **−36°**；`short [0,10.2,24]→[0,.1,10] fov 50`
2. **`lakesidePortraitLens` / `lakesideAlignedLookAt` / `lakesideAlignedBoardPose` / `lakesideScreenLanding` / `lakesideLandingBlend`** 全部经 `lakesidePortraitLens` → 当 `lakesideKitAssetsEnabled()` 为 true 用 fusion，否则观光。旅程终点与 lease.frame **同一 pose**（零缝）。
3. **`LakesideSceneData`**：仅追加 `setLakesideKitAssets` / `lakesideKitAssetsEnabled`（默认 `false`）。**未改** `lakesideSceneInstances` 过滤（GGbot 负责竞态 + keep pieces / RING/SHD）。
4. **`FreeOrbit` lakeside `pitchMaxDeg` 54→66**：仅使 kit-ON fusion 镜相对角色 look point（~63.6°）能 `seed` 零夹；kit OFF 观光仍 ≪ 54。

### 文件
| 文件 | 变更 |
|---|---|
| `creator-build-project/assets/scripts/region/LakesideCameraLayout.ts` | `portraitFusion` + kit 切换 |
| `creator-build-project/assets/scripts/region/LakesideSceneData.ts` | flag getter/setter only |
| `creator-build-project/assets/scripts/region/FreeOrbit.ts` | lakeside pitchMax 66（kit-ON seed） |
| `tools/journey-integration/test-lakeside-camera.cjs` | K9 kit OFF/ON 双断言 |

---

## 2. 怎么验

```bash
cd /workspace/yiqifengle/work/cine-lakeside-board-cam
export QF_TYPESCRIPT_MODULE=/home/box/.local/lib/node_modules/typescript   # or Mac TS path
node tools/journey-integration/test-lakeside-camera.cjs   # 期望 PASS，含 K9 OFF + K9 ON
node tools/lakeside/test_lakeside_reveal_orbit.cjs
node tools/journey-integration/test-lakeside-landing-hook.cjs
```

| 断言 | 期望 |
|---|---|
| kit OFF | pose = `[2,6,33]→[.5,.7,2]` fov 56，pitch ≈ −9.7°；K1–K8 原观光契约 PASS |
| kit ON | pitch ∈ [−48,−28]；盘心 `[0,0.02,12]` 进画；近格 ≥ 44 px；`lakesideLandingBlend` gap ≈ 0 |
| FreeOrbit kit ON | seedErr ≈ 0（pitchMax 66） |

**真机**（需 GGbot 先修 preload 竞态，否则仍无 3D 棋子）：trial kit 默认 ON 时进湖畔盘，构图应对齐样板骨架（轻俯视可点格），不再是南岸远看。

样板：`work/pm/lakeside-fusion-sample-funning-20261105.png`  
坏样：`work/pm/balloon-bugs-20261105/lakeside-empty-board-050927.png`

---

## 3. 证据路径

`previews/运镜bot/lakeside-board-cam/`
- `pose-metrics-390x844.json` — kit OFF/ON 数值
- `kitOFF-sightseeing-390x844.svg` / `kitON-fusion-mild-overhead-390x844.svg` — 投影示意
- `SAMPLE-funning-fusion.png` / `BAD-empty-shore-far-050927.png` — 对照拷贝

OFF：pitch −9.69°，dist≈21.9 m，cell≈48 px  
ON：pitch −35.72°，dist≈14.5 m，cell≈88 px，seedErr 0

---

## 4. 已知未做

1. **空盘竞态（GGbot §4.1）**：preload 时 kit flag 仍 false → 无 `LK_piece_*` / RING/SHD；本 tip 零碰。
2. **莲座 / 棋子造型 / 夜景灯笼发光**：美术 + 场景特效（PM §2.3）。
3. **未打 Creator / 未真机截图**：仅 Node 几何 + SVG 示意；合包后需真机对样板。
4. **未推 GitHub / 未 upload**。
5. 与气球门/甩海 tip **分支分离**（`cine/balloon-door-dismount-fix` 勿混）。

---

## 5. 给 Clonebot / 停工交接

本 tip 交完后小游戏开发/测试整体暂停交 Clonebot。运镜侧本项可 pause；下一包需同时含本 tip（近景镜）+ GGbot 竞态 fix 才有「有棋子的俯视近景」真机观感。
