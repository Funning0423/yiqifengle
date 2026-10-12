# 静态坐姿接入说明

这次只交资源和说明。运行时 TypeScript 没有改。静态网格的顶点已经在房间世界坐标里，挂到 `scene_root` 上时节点变换必须是单位矩阵。再乘 `seatedRoot` 或 `seatYawRad` 会把人挪离椅子。

## 玩家看到的流程

1. 进门之后，沿现有回程走到窗边的站立点，停在那里播 `idle_breathing_loop`。不要自动坐下。
2. 点「坐下」：播放 `sit_down`，控制器根从站立点插值到坐点，同时镜头推近或切到窗边坐姿机位，淡入淡出约 0.3 秒。
3. 片段结束（或 `settle_time_s`）时隐藏蒙皮网格，显示静态坐姿网格。
4. 点「起身」：先淡出约 0.3 秒，藏起静态网格、显示蒙皮网格，播放 `stand_up`，根从坐点回到站立点，再回到窗边待机。镜头按同样的 0.3 秒淡回站立机位。

`sit_down` 最后一帧和 `stand_up` 第一帧的骨骼差是 0.04° / 0 mm（`data/pose_match.json`）。静态身体就是 `sit_down` 最后一帧应用蒙皮后的结果，身体顶点没有再移动。裙子和围裙是在那之后按椅子重铺的，骨骼裙摆对不上这块布。0.3 秒的镜头淡变盖住这次替换。

## 网格约定

文件：`art-src/character/sit-static/chr_sit_static.glb`（613368 字节）。

- 无骨骼、无 skin、无动画、无贴图、无切线。
- 节点：`LOD0_G2_BODY`、`LOD0_G2_DRESS`、`LOD0_G2_APRON`、`LOD0_G2_BOW`。
- 材质名沿用 `M_G2_FACE`、`M_G2_HEAD`、`M_G2_BODY`、`M_G2_HAIR`、`M_G2_DRESS`、`M_G2_APRON`。蝴蝶结用 `M_G2_BODY`。按名字绑回角色 GLB 里已有的材质和贴图，不要再嵌一份 `T_G2_*`。
- `M_env_palette` 是椅子和房间的材质，这块网格不加新材质。
- 坐标：Y 轴向上，米，和 `combined_visual_m.glb` / `seat_anchor` 同一个房间。身份变换放在 `scene_root` 下即可。
- 椅子：`seat_anchor` 位置 `[0.4203, 0.38, -4.2133]`，`yaw_rad` -2，座面高 0.38 m。人根用的是 `CharacterReference.seatedRoot` `[0.43273, 0, -4.20761]`，朝向 `seatYawRad` -2。这些已经烘焙进顶点。

## 要改的文件和接口

下面都还没改。

| 文件 | 接口 | 改什么 |
|---|---|---|
| `assets/scripts/world-r1/WorldFlowCore.ts` | `returnHome`（约 429 行）、`entrySpan`（约 474 行） | 回程的 `toSeat` 走到 `standingRoot` 后停住，播 idle。删掉末尾自动 `action({kind:'sit'})` 和 `entrySpan` 里 `state:'sitting'` 的那段。坐下改成单独的命令。 |
| 同上 | `leaveHome`（约 366 行） | 起身仍播 `stand`，但只在玩家点「起身」之后。从静态网格换回蒙皮网格再播 `stand_up`。 |
| `assets/scripts/WorldIntegrationBoot.ts` | `initialSeatedClip`（约 270 行）、启动时选中的 `SkeletalAnimation`（约 333–337 行） | 进房时不要以 `sit_hold`、`seatedRoot` 开场。开场在 `standingRoot`，片段 `idle_breathing_loop`。 |
| 同上 | `perform` / `playNamed`（约 193 行）、`actionSeconds`（约 180 行）、`actionSettleSeconds`（约 183 行） | `sit` / `stand` 仍读 `sit_down` / `stand_up` 的时长。坐姿替换放在片段结束或 `settle_time_s`（0.8667 s），不要再交给 `sit_hold`。 |
| `assets/scripts/CharacterMotion.ts` | `CLIP_ROLES`（72 行） | `sitDown` = `sit_down`，`standUp` = `stand_up`，`idle` = `idle_breathing_loop` 保持。`sitHold` 不再是坐下后的停留姿势。 |
| `assets/scripts/world-r1/CharacterReference.ts` | `seatedRoot`、`standingRoot`、`seatYawRad` | 数值不变。静态网格不要再应用这些数。蒙皮角色在播 `sit_down` / `stand_up` 时仍由控制器在这两个根之间插值（`anim_meta` 的 `root_motion`，前向约 -0.494 m）。 |
| `assets/scripts/world-r1/FirstsliceRoutes.ts` | `toSeat`（约 112 行，终点已是 `standingRoot`）、`seat`（约 210 行） | 路线不用改。窗边站立点就是 `standingRoot` `[-0.01616, 0, -4.41305]`。 |
| `assets/scripts/world-r1/RegionCameraData.ts` | `home.variants['sitting-room']`（约 45 行）、`TRANSITION_CAMERA` 的 sit 键 | 坐下时从站立/跟随机位切到 `sitting-room`（位置 `[-1.32022, 1.38613, -2.11374]`，目标 `[0.04, 1.22, -4.45]`，fov 75）。淡入淡出约 0.3 秒，和片段同时开始。起身反向。 |
| `assets/scripts/RoomExploreOverlay.ts` | `Commands`（第 4 行，目前只有 `roomView` / `lookRoom` / `leaveHome`） | 加上「坐下」「起身」。现在没有这个按钮。点击走新的 world 命令，不要复用进门自动坐。 |
| `assets/bundles/region_island/character/anim_meta.json` | `clips.sit_down.handoff`（约 2447 行，`next` 现为 `sit_hold`，`crossfade_s` 0.2） | 坐下结束不要再交到 `sit_hold`。`settle_time_s` 0.8667 保留，给镜头和换模当时间点。`sit_down` 1.2 s、`stand_up` 1.266667 s 的时长不要改，Cocos `.meta` 的 split 卡在这些时长上。 |
| 运行时角色 GLB | `chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb` | 这次不替换。两条动捕片段留在里面。边界姿势已经和静态身体一致，见 `data/pose_match.json`。 |

换模时：隐藏带 `SkeletalAnimation` 的四个蒙皮网格，显示静态 GLB 的同名节点。反过来时先显示蒙皮网格（它停在 `sit_down` 末帧 / `stand_up` 首帧），再播 `stand_up`。两套网格不要同时用非单位变换叠在椅子上。

如果以后把静态网格或片段写进 bundle，要跑 `node tools/test_manifests.cjs --write`，并更新 `tools/verified_restoration_scope.json`、`tools/integrated_3d_scope.json`、`tools/audio_gesture_scope.json` 和 `assets-MANIFEST-SHA256.json` 里锁住的运行时 GLB 哈希。在那之前不要覆盖运行时 GLB。
