# RESULT：固定坐姿模型替换骨骼坐姿

分支 `cursor/sit-static-swap-9ed2`，基线 `int/v1`（`195159c`）。草稿 PR，未合并，没有推到 `int/v1`。

## 结论

坐着穿模不再用骨骼铺布。固定坐姿是一个没有骨骼的 glb，放在角色本地空间，跟骨骼角色共用同一个控制器。进门走到座位后默认站在窗边；点「坐下」播已有的 `sit_down`，片段结束后用 0.3 秒淡出换成固定模型。点「起身」先用 0.3 秒淡回骨骼，再播 `stand_up`，然后站回窗边。冷启动仍是坐在椅子上（固定模型），第一次出门仍从 `stand_up` 开始，出门运镜和门的开合角度没有改。

| 项 | 结果 |
|---|---|
| 三角面 | **6395**（上限 8000） |
| 坐姿 glb | **181,588 B**，无内嵌贴图 |
| 角色 glb + 坐姿 glb | 1,373,744 + 181,588 = **1,555,332 B**（上限 1,572,864） |
| 骨盆高度 | **0.4364 m**，与 `sit_down` 末帧相同 |
| 脚底 | sole Y **0.0001 m**（脚骨是踝，不是鞋底） |
| 髋 / 双脚位移 | 相对 `sit_down` 末帧 **0**（抛光只动了脊柱和手臂） |
| 椅子 / 地板穿透 | 各部件 `inside = 0`，`below_floor = 0` |
| `STANCE_MM` | 仍是 **6** |
| 骨骼名 / 层级 / IBM | 角色 glb 未改 |

## 模型

脚本 `art-src/character/sit-static/scripts/build_sit_static.py`（Blender 4.5.14，`blender -b --factory-startup -P`）。把现有角色摆到 `sit_down` 最后一帧，只烘焙脊柱、胸、颈和双臂，髋和脚不动，然后应用蒙皮。黄裙下摆、围裙、蝴蝶结、短袖是新的低面网格，不用形状键，也不用 PR #10 的程序铺布。椅子用阅读椅的测量盒，顶点只做一次推出盒外的投影。

贴图复用 `M_G2_*`。运行时按材质名把骨骼角色的共享材质绑回去。glb 里不嵌图片，只留平涂底色，避免把角色相关 glb 顶过 1.5 MB。预览是在压平材质之前用真实贴图渲的。

对齐（角色空间，Y 朝上，米）：

- 髋 `(0.0032, 0.4364, -0.0345)`
- 左脚骨 `(-0.0707, 0.0906, 0.4472)`，右脚骨 `(0.0706, 0.0926, 0.501)`
- 左手腕 `(-0.0502, 0.4007, 0.1996)`，右手腕 `(0.0070, 0.4247, 0.1628)`

## 切换

`SitStaticSwap`（`creator-build-project/assets/scripts/world-r1/SitStaticSwap.ts`）不依赖引擎。相位：`skeletal` / `to-static` / `static` / `to-skeletal`。冷启动是 `static`。淡入淡出 0.3 秒，smoothstep，两个透明度互补。

`FlowReferenceStandin`：

- 坐姿 glb 挂在控制器下，本地变换是单位阵，和女孩同一个根。缺资源不阻断启动，也没有这个网格时仍播 `sit_hold`。
- `loadDir('character')` 仍然只有一个预制体。坐姿放在 `region_island/sit-static/chr_sit_static`。
- 点「坐下」：`perform(sit)` 播完 `sit_down` 后停在末帧，淡到固定模型，再 resolve。不播 `sit_hold`。
- 点「起身」：`beginStandFade()` 先把骨骼摆到 `sit_down` 末帧（和 `stand_up` 第 0 帧同一姿势），淡 0.3 秒，再播 `stand_up`。
- 从椅子上直接出门：不走这 0.3 秒，立刻切回骨骼再播 `stand_up`，避免出门运镜被拖长。
- 透明度用材质的 transparent technique 副本，不改共享材质。拷贝失败时仍等满 0.3 秒，然后开关 `MeshRenderer.enabled`。

回家后的稳定姿态是窗边站立，不再坐上椅子。原来叫 `sitting` 的镜头段时长不变（转身 + `sit_down`，有 settle 时镜头在 settle 落地，`home` 仍等到片段结束）。这段里人站在 `standingControllerRoot`，朝座位偏航转一下，然后待机。状态名仍是 `sitting`，门的关键帧和进出镜头时长不动。从窗边出门不等 `stand_up`（那会把她弹回坐姿），空等原来的 stand 时长再转身，`standS + turnS` 不变。冷启动从椅子离开时仍播 `stand_up`。

按钮在房间底部中间，文案是「坐下」或「起身」。门的「推开门，开始冒险」先命中，座位按钮不会抢走点门。

## 改了哪些文件

- `art-src/character/sit-static/scripts/build_sit_static.py`
- `art-src/character/sit-static/chr_sit_static.glb`
- `art-src/character/sit-static/data/qa_sit_static.json`
- `cloud-tasks/sit-static-swap/`（三视图对照、阅读椅、单视图；`previews/` 被 gitignore，不进提交）
- `creator-build-project/assets/bundles/region_island/sit-static/chr_sit_static.glb` 及目录 / gltf `.meta`
- `creator-build-project/assets/scripts/world-r1/SitStaticSwap.ts`（及 `.meta`）
- `creator-build-project/assets/scripts/world-r1/WorldFlowCore.ts`
- `creator-build-project/assets/scripts/world-r1/WorldFlowComponent.ts`
- `creator-build-project/assets/scripts/WorldIntegrationBoot.ts`
- `creator-build-project/assets/scripts/RoomExploreOverlay.ts`
- `tools/test_sit_static_swap.cjs`
- `tools/camera-frame-test/test_camera_frames.cjs`（回家坐段改为检查人停在窗边）
- `tools/grokbot-autoplay/test/integration-boot.ts`（补上坐姿 glb 那一次 `load` 的回调）
- `assets-MANIFEST-SHA256.json` / `text-MANIFEST-SHA256.json`（`node tools/test_manifests.cjs --write`）

没有改角色 glb、`RegionCameraData`、门的开合角、`STANCE_MM`，也没有给 `sit_down` / `stand_up` 手 K 帧。

## 图

`art-src/character/.gitignore` 忽略 `previews/`，脚本仍会写到 `art-src/character/sit-static/previews/`。提交里的副本：

- 三视图对照（左参考，右渲染）：`cloud-tasks/sit-static-swap/compare_views.png`
- 贴在阅读椅测量盒上：`cloud-tasks/sit-static-swap/chair.png`
- 单视图：`cloud-tasks/sit-static-swap/front_figure.png`、`side_figure.png`、`back_figure.png`

草帽、粉色帽带、深蓝短发、黄裙、白围裙和背后的白蝴蝶结都在。裙摆盖过膝、小腿和鞋露在外面，脚在地板上。QA 里裙子、围裙、蝴蝶结都没有进椅面、椅背或地板。

卡在模型上的地方（同一类问题没有再做第三次）：

- 手腕已经在大腿高度，但手指网格仍顺着前臂朝上，看起来不像双手叠在腿上。把掌骨再拧一次会把手指甩到脸上，这次已经撤掉，没有第三次拧。
- 蝴蝶结是低面飘带环，白色，能从背后看见，不是参考图里那种软蝴蝶结。
- 围裙中部有一小块黄裙漏出来。
- 鞋是现有 `M_G2` 贴图上的颜色（偏红），没有重画。

没有 Cocos 编辑器，0.3 秒淡出没有在真机画面里看过。相位机和镜头时长是单测覆盖的。

## 测试

| 命令 | 结果 |
|---|---|
| `node tools/test_sit_static_swap.cjs` | PASS。冷启动 `static`；0.3 秒互补淡入淡出；snap 不留在淡出中。冷启动按钮是「起身」，起身先等 0.3 秒再 `stand`，然后是「坐下」。坐下播 `sit`。从窗边出门第一个动作是 `turn`，不播 `stand_up`。从椅子出门第一个动作仍是 `stand`。`STANCE_MM=6`。 |
| `node tools/camera-frame-test/test_sit_timing.cjs` | ALL PASS。镜头在 turn+settle 落地，`home` 仍等到片段结束。 |
| `node tools/camera-frame-test/test_camera_frames.cjs` | 全部 PASS（装了 `draco3d@1.5.7` 之后）。`return-entry-continuous` 里坐段根位移离开窗边 **0**。`door-drift` 仍是 islandDeg **45**、openDeg **86.4**。 |
| `node tools/test_character_action_clock.cjs` | PASS。没有坐姿网格时，`sit` 仍在片段结束 resolve，复位仍是 `sit_hold`。 |
| `node tools/audio-unlock/test_audio_unlock.cjs` | ALL PASS。`RoomExploreOverlay` 没有 for-of / Map-Set spread。 |
| `tools/grokbot-autoplay/test/build_and_run.sh`（`GB_LOOSE=0`） | PASS integration boot，以及出门再回家的 integration。坐姿那次 load 回调了，启动没有挂住。 |
| `node tools/cloud-island-camera/test_composition.cjs` | 在 **未改** 的 `WorldFlowCore` 上就已经失败：`cameraCrossOut` 和快照不一致，flow 镜头第 3 段是 392 个关键帧、快照是 15 个。本分支的镜头时长与快照相同（2.5 / 5.997 / 12.094 / 19.875 秒），没有重写快照。 |
| `node tools/walk-driver/test_walk_driver.cjs` | FAIL，和基线逐项相同（`failedOther` 4 条，含走路滑步）。不是这次坐姿改出来的。 |

`node tools/test_manifests.cjs --write` 和这次提交一起跑过。
