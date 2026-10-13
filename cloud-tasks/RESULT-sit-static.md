# RESULT：静态坐姿（不用骨骼驱动）

分支 `cloud/sit-static` → 草稿 PR 到 `int/v1`，未合并。运行时 TypeScript 没改，运行时角色 GLB 没替换。

坐姿方案按用户确认改成静态网格：把 body-r4 运行时角色摆到 `sit_down` 最后一帧，应用蒙皮，再按房间里的阅读椅把裙摆和围裙铺成一块布。

## 交付

| 文件 | 内容 |
|---|---|
| `art-src/character/sit-static/chr_sit_static.glb` | 静态坐姿，613368 字节。无骨骼、无 skin、无动画、无贴图、无切线。 |
| `art-src/character/sit-static/scripts/build_sit_static.py` | Blender 4.5.14，`blender -b -P` 重建。 |
| `art-src/character/sit-static/scripts/pose_match.py` | 比较 `sit_down` 末帧和 `stand_up` 首帧。 |
| `art-src/character/sit-static/data/qa_sit_static.json` | 穿模计数和包围盒。 |
| `art-src/character/sit-static/data/pose_match.json` | 边界姿势差：最大 0.0396°，平移 0 mm。 |
| `art-src/character/sit-static/INTEGRATION.md` | 接入说明：改哪些文件和接口。代码没动。 |
| `art-src/character/sit-static/share/front.jpg` | 正面 |
| `art-src/character/sit-static/share/side.jpg` | 侧面 |
| `art-src/character/sit-static/share/three_quarter.jpg` | 3/4 |
| `art-src/character/sit-static/share/back.jpg` | 背面 |

椅子只在预览图里，用的是房间 GLB 里拆出来的阅读椅，没有写进角色文件。

## 网格

底模是 `int/v1` 的 `chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb`（body-r4）。姿势是 `sit_down` 最后一帧（Blender 场景 24 fps 下第 29 帧）。放置用 `CharacterReference.seatedRoot` `[0.43273, 0, -4.20761]` 和 `seatYawRad` -2，对齐 `FirstsliceFacts` 的 `seat_anchor`（`[0.4203, 0.38, -4.2133]`，yaw -2）。

顶点是房间世界坐标（Y 上，米）。运行时挂在 `scene_root` 下用单位矩阵。节点名 `LOD0_G2_BODY` / `DRESS` / `APRON` / `BOW`。材质名 `M_G2_FACE`、`M_G2_HEAD`、`M_G2_BODY`、`M_G2_HAIR`、`M_G2_DRESS`、`M_G2_APRON`（蝴蝶结用 `M_G2_BODY`）。贴图不嵌在文件里，按名字复用角色上已有的。没有新材质。`M_env_palette` 仍只属于椅子和房间。

导出后的游戏坐标包围盒：身体约 x -0.19..0.57，y 0..1.09，z -4.57..-4.06，落在座椅上，脚在地面。

裙摆按绑定姿势的环向角和高度铺成一整片：前面垂在小腿前方，两侧在扶手以下向外落下，后面停在座面上、靠背竖条之前。围裙整片（含原本跟着髋骨翻到座面上的围兜）重铺成胸前围兜、从两手之间的空隙收窄、再在裙前铺开。蝴蝶结从椅面下的空隙收到座面上、靠背前面。

## 动捕片段

`sit_down`（1.2 s）和 `stand_up`（1.266667 s）留在运行时 GLB 里，时长没改，关键帧没改。

`pose_match.py` 对全部 30 条通道做了比较：`sit_down` 最后一个采样和 `stand_up` 第一个采样，旋转最大 0.0396°（`skirt.front`），髋和根的平移是 0 mm。静态身体就是这一帧应用蒙皮的结果，身体相对椅子移动了 0 个顶点。

铺过的裙摆和围裙不再跟裙子骨骼走。换模时用接入说明里的约 0.3 秒镜头淡变盖住这块布的差别。

## 穿模

计数来自 `qa_sit_static.json`。`free` 不含髋骨权重大于 0.45 的顶点。腰带宽本来就埋在衣身里（站立时也有），没有把这些点往外推，避免拉出尖刺。

| 部件 | 椅子（自由顶点） | 身体（自由顶点） | 身体（含腰封） |
|---|---|---|---|
| 身体 | 0 | 0 | 0 |
| 裙子 | 7 个，深 0.45 mm | 2 个，深 6.6 mm | 253 个，深 37.4 mm（腰封） |
| 围裙 | 0 | 7 个，深 29.0 mm | 同左（围兜已全部重铺） |
| 蝴蝶结 | 0 | 0 | 5 个，深 6.1 mm（结心贴在后腰） |

围裙相对裙子的审计：13 个顶点、深 26 mm。围兜贴在衣身前面，开放曲面的有符号距离会把贴在外面的一层算成“里面”。

地面以下：0。

## 还没收干净的地方

- 两只手叠在腿上，手和肚子之间几乎没有缝。围裙若按原宽度铺过去会穿进手指，所以手的高度上收成一条窄带，下面再在裙前铺开。那 7 个、深 29 mm 的围裙点在这条窄带和围兜上沿。
- 裙子腰封的 253 个点是原来的蒙皮接缝，不是这次铺布推进去的。自由裙边上还有 2 个点、6.6 mm 在身体里，紧挨这条接缝。
- 裙子有 7 个点离椅子表面 0.45 mm，在未焊接的椅条上，算贴着表面。
- 裙摆下沿是低面数的一整片，侧面看得到折边。后面停在座面上，不穿过竖条。
- 运行时代码、运行时 GLB、`.meta` 和三份 scope 哈希都没动。
