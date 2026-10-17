# 帆船转场 PR56（第 12/13 项）· 运镜bot · 2026-10-15 · 候选，没推送、没合并

**基线 `2a216a0`**（feat/sailboat-transition-20261015，GGbot，未合并）→ 本补丁 1 个提交 `41f47f7`（本地 worktree，未推送），**tree `ea9456c8e647b539e588a73e9a99d1b830e3955c`**。
用法：在 2a216a0 上 `git am patch/0001-*.patch`，tree 应为 ea9456c（已在干净 worktree 上复核）。

## 改了什么（在 2a216a0 之上，没重做）
| 问题（r2 录屏） | 原因 | 改法 |
|---|---|---|
| 总长约 7 s，31.93 s 起灰白停 4.2 s | 草甸 bundle 在帆船开始（约 29.5 s）才开始加载，2.7 s 时（换场帧 81）没加载完 → 模型按设计停在云里等 | 新 `cine/SailboatMeadowPrefetch.ts`：共享一次加载；`WorldFlowComponent.forwardCameraEvent` 在出门起吊（crane）/ 落定在岛上时就开始预加载。驱动先用预加载好的 prefab。正常情况下不会再停，总长 = 时间文件的 156 帧 = **5.2 s** |
| 灰白一块、没有云纹理 | 9 片纯色圆盘、每片 96% 不透明、0.2 s 内淡入 | 新 `cine/SailboatCloudTexture.ts`：程序生成 fBm 云纹理（128²，3 个种子，**无外部素材**），云片改成带 UV 的方片贴纹理；`SailboatCloudLayout` 改为 9 片大底云 + 14 片小云团，每片有溶解顺序；小云团先从画面外滑入并变大，大底云最后合上、最先打开（`puffPlacement`）；深度补偿，保持屏幕大小 |
| 云淡入太快，看起来像硬切 | cloudCover 72→78、84→90（各 0.2 s） | 改成 **66→78 合上，84→96 打开（各 0.4 s）**；总帧数、换场帧 81、S1–S5 分镜都没变 |
| 夜间云会是白的（推断） | 云色固定 | 按 `uiNightWeight()` 做月光蓝灰色调（`cloudNightTint`） |
| 草甸黑剪影 | 2a216a0 已修（顶点色 + 主光 + 暖机 2 帧） | 没动；揭开前仍要求暖机 2 帧 |

时间文件 sha256 变了，`test_sailboat_transition.cjs` 里的哈希已更新；两份 MANIFEST 已用 `test_manifests.cjs --write` 刷新。

## 分段时间（30 fps，frame 0 = 帆船开始；白天和夜间相同，详见 `timing/sail_transition.timing.json`）
| 段 | 帧 | 秒 |
|---|---|---|
| S1 岛上停留 | 0–12 | 0–0.40 |
| S2 起航 | 12–48 | 0.40–1.60 |
| S3 过海，**云开始合上 66** | 48–90 | 1.60–3.00（云 2.20 起） |
| **全遮 78–84**，换场 81 | | 2.60–2.80，换场 2.70 |
| **溶解打开 84→96**（揭开结束 96） | | 2.80–3.20 |
| S4 到岸 | 90–126 | 3.00–4.20 |
| S5 升到草甸机位 | 126–156 | 4.20–**5.20** |
草甸晚到时：在帧 81 暂停（全遮、风声循环），准备好后再继续，总长 = 5.2 s + 等待（模拟：第 180 帧才准备好 → 8.5 s）。

## 跳过（按真实帆船开始时间，录屏里约 29.5 s）
在游戏的时间模型上逐帧模拟（`timing/skip_verification.json`）。r2 第 13 项的点击在流程第 0.6 s，那时帆船还没开始，所以无效，不是跳过坏了。
- 0.1 s（帧 3，跳过还没开放）：忽略，正常播完 5.2 s
- 0.3 / 0.5 / 1.5 / 2.33 / 2.7 / 3.33 / 4.67 s 点击：0.3 s 白场后落在草甸终帧（点击后 9 帧完成）
- 0.5 s 点击但草甸到帧 120 才准备好：停在白云里（skip-hold），准备好后落地，4.03 s
- **重录第 13 项：在录屏约 30.0–31.0 s 点击**（帆船开始 + 0.5–1.5 s）

## 测试（box，Node 24）
全部通过：`tools/cine/test_sailboat_transition.cjs`（加了 r3：纹理有不规则边和明暗、溶解单调、全遮=全不透明、滑入、夜色、预加载接线、两段 ≥0.4 s、总长 5.2 s）、`test_sailboat_audio.cjs`（8 例）、`tools/test_manifests.cjs`、`camera-frame-test/test_es5_safety.cjs`（需设 QF_TYPESCRIPT_MODULE / QF_CC_DTS）、`meadow/test_meadow_vertex_colors.cjs`、`meadow/test_meadow_scene.cjs`。
另用 TS 5.9 + cc.d.ts（ES5、strict）检查 cine 文件：新文件没有报错；`SailboatTransitionDriver.ts` 228/229 行 2 个 strict 类型报错在 2a216a0 里就有，不是本补丁引入的。

## 视频（`video/`，整屏不裁切，每栏 402×870，30 fps）
- `sail_before-r2-real_vs_after-41f47f7-proxy_{day,night}_402x870.mp4`
- **左 = 改前：r2 Mac 上 Cocos web 构建的真实录屏**（2a216a0 之前的 PR56，`ui-audit/.../pr55-recordings-r2/raw/12_sail_*`；录屏有效画面在 750×1624 的左上 375×812，已裁出再缩放）。白天从 29.53 s 开始；**夜间那段录屏 35.2 s 就结束了**，之后是黑屏，夜间起点 32.0 s 是估计的。
- **右 = 改后：代理合成，不是 Cocos 实机**。云层用游戏里同样的 TS 代码逐帧算（时间模型、布局、纹理像素、溶解、滑入、夜色），按相机空间投影画到 2D 上；云下面的岛 = 同一段真实录屏（S1–S3 本补丁没改）；草甸 = Voice Bot 的 v7.5 meadowScenePose Blender 渲染图，S4/S5 镜头移动用缩放模拟；**夜间草甸只是把这张图调暗调蓝**。
- `shots/`：关键帧拼图。

## 弱点 / 没验证的
1. **没有 Cocos 实机或真机验证**。builtin-unlit + USE_TEXTURE + 运行时 ImageAsset(RGBA8888) 这条路在 Creator 3.8.8 上应该能用，但没跑过；云层会不会被 HUD/后处理排序影响也没看。需要在 Mac 上用 Cocos 录第 12/13 项（白天 + 夜间）。
2. 预加载让草甸在出门途中就加载（内存/带宽提前占用），没有量过对出门镜头帧率的影响。如果加载慢于出门 + 2.7 s，还是会停在云里，只是停得比原来短。
3. 全遮时云主要是浅色带明暗的雾感，云团轮廓在合上和打开的 0.4 s 里看得清，全遮的 0.2 s 里不太明显。
4. 夜间草甸的光照：2a216a0 加的主光是固定的暖白色，夜间可能显得太亮，代理视频看不出来。
5. 跳过：白场到 0.89 就直接切到草甸，这是原来的设计，没改。
6. 时间 JSON 的段长度只是游戏模型的数值，不是从录屏量出来的。

## 文件
`patch/` · `timing/sail_transition.timing.json`（给 Voice Bot 对 5.2 s 风声）· `timing/skip_verification.json` · `video/` · `shots/` · `scripts/`（dump_cloud.cjs 从游戏 TS 导出逐帧云参数；compose.py 合成并排视频；skip_and_timing.cjs）
