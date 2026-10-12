# RESULT：任务 3 坐姿裙子垂坠

分支 `cursor/sit-drape-0dfd` → PR 到 `int/v1`（草稿，未合并，没有 push 到 int/v1）。起点 int/v1 `022fcad`。

## 结论

| 验收项 | 结果 |
|---|---|
| 坐稳那一帧不穿椅子 | 黄裙-椅子 458 → **0**，围裙-椅子 33 → **0**（Blender 三角形求交，房间里真实的椅子网格）。蝴蝶结-椅子 32 → 32 没变，见“遗留”。 |
| 不穿腿 | 腿-黄裙 450 → **0**，腿-围裙 236 → **0** |
| 黄裙和围裙不互相穿 | 围裙-黄裙 32 → **0** |
| anim_meta 写上 settle_time_s | `clips.sit_down.morph.settle_time_s = 0.8667`（和片段原有的 `settle_time_s` 相同），另有 `clips.stand_up.morph.release_time_s = 0.8667` |
| 每个形状键 ≤ 20 KB | 黄裙 `sit_drape` **17,220 B**（1230 个顶点），围裙 `sit_drape` **3,948 B**（282 个顶点） |
| 坐稳那一帧截图 | `art-src/animation/sit-drape/previews/settled_frame_q34.jpg`（1280×1600），同目录 `settled_frame_front.jpg`、`settled_frame_side.jpg` |
| 运行时 glb ≤ 1.5 MB | 1,336,456 → **1,374,704 B** |

“坐稳那一帧” = sit_down 结束 = sit_hold 第 0 帧（根节点已经到座位上，形状键权重 1）。上表都是这一帧的数据。

## 改了什么

### 运行时资源（`creator-build-project/assets/bundles/region_island/character/`）

- `chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb`
  - `LOD0_G2_DRESS` 和 `LOD0_G2_APRON` 各加 2 个形变目标：序号 0 = `sit_drape`（坐姿垂坠），序号 1 = `sit_drape_mid`（占位，只动 1 个顶点，14 B）。Cocos 只有 1 个目标时形变变体编号会出问题（`docs/walk-driver.md` §8.4），所以凑 2 个；产品要求的“各一个坐姿垂坠形状键”就是 `sit_drape`。
  - 形变目标只有 POSITION 差值，float32，sparse accessor（只存动了的顶点：uint16 下标 + xyz，每个 14 B），没有法线/切线差值。`mesh.extras.targetNames` 写了目标名。
  - sit_down / sit_hold / stand_up 这 3 个片段里 10 根裙骨（`skirt.*`）的旋转、平移通道重新摆过。没有加骨头，34 个节点的名字、层级和 skin 的 28 个 joint 和 int/v1 逐项相同（28 根身体骨 + 2 根头发骨没动）；材质 6、贴图 5、图片 5，数量不变。
  - `.glb.meta` 没改（`tangents: 1` 不变，片段时长和 split 不变）。
- `anim_meta.json`：只加字段，原有内容不变。
  - `sit_down.morph.curves.sit_drape = [[0,0],[0.2,0],[0.8667,1],[1.2,1]]`，`settle_time_s = 0.8667`
  - `sit_hold.morph.curves.sit_drape = [[0,1],[2,1]]`
  - `stand_up.morph.curves.sit_drape = [[0,1],[0.1333,1],[0.8667,0],[1.2667,0]]`，`release_time_s = 0.8667`
  - 顶层 `morph`：`mesh = LOD0_G2_APRON`，`meshes = {LOD0_G2_APRON: {sit_drape:0, sit_drape_mid:1}, LOD0_G2_DRESS: {同}}`
- 已跑 `node tools/test_manifests.cjs --write`，`problems: []`。

### 驱动（`creator-build-project/assets/scripts/`）

- `CharacterMotion.ts`：`MotionConfig.morphMeshes`（每个网格自己的 目标名 → 序号），默认 = 围裙 + 黄裙 `LOD0_G2_DRESS`（`{sit_drape:0, sit_drape_mid:1}`）。`parseAnimMeta` 读顶层 `morph.meshes`：主网格（围裙）那项优先于 `morphTargets`，其他项替换默认的额外网格。`morphWeights` 对所有网格的目标名算一次权重（同名目标共用一个值，算法和原来一样：底层淡化 + 风效层）。
- `WorldIntegrationBoot.ts`：每个网格一个 `MorphDriver`，都绑在同一组 renderer 上。某个网格找不到或没有形变数据时只影响它自己。`__worldIntegration.morph()` 顶层仍是围裙的状态（T0 `device:caps` 的 `apronDriver` 不受影响），另加 `meshes` 数组，每个网格一项。
- `tools/grokbot-autoplay/prereq-allowlist.txt`：追加新 `WorldIntegrationBoot.ts` 的 SHA-256（T0 读的 Boot 字段没变）。
- `tools/walk-driver/test_walk_driver.cjs`：新增 2 项，都通过：
  - `morph.meshes` 多网格：一套权重，各网格按自己的序号写；不存在的网格报 `not-found`，其他网格照常写。
  - 真实 anim_meta：坐着时围裙和黄裙都是 1，stand_up 结束时都是 0，sit_down 结束时回到 1，每帧变化 ≤ 0.03。
  - 原有形变测试的 `morphMeta()` 去掉了真实的顶层 `morph`（它现在映射的是坐姿垂坠，不是 curl/flutter），原有 8 项全部通过。
  - 结果：通过，只剩 4 项 `loco:` 失败（脚滑、停步变体、上岛转身、未计划停步）。这 4 项在 `022fcad` 上不改任何东西也是同样失败，和本任务无关。运行需要 `QF_TYPESCRIPT_MODULE` 指向一个 typescript 包。
- `docs/walk-driver.md` §8：多网格、`morph.meshes`、sparse accessor 说明，新增 §8.5 坐姿垂坠曲线。

### 工具链（`art-src/animation/sit-drape/`）

`build_all.sh` 从 `022fcad` 的 glb 一键重建，需要 Blender 4.5 LTS（这里用的是 4.5.14，`blender -b -P`）。步骤见 `README.md`：

1. **布料目标**：用 Blender 布料模拟站立 → sit_down → sit_hold 第 0 帧。根节点按 anim_meta 往后滑，和驱动一致。碰撞体是身体、房间里的椅子（`combined_visual_m.glb` 的 `env_int_prop_reading_chair`，摆在 `seat_anchor` 处）和地面。
2. **裙骨拟合**：坐稳那一帧，8 根裙骨各一个刚体修正（mid 子骨跟父骨）。腰带固定在原位，蝴蝶结不动。
3. **形状键**：拟合后剩下的差平滑成黄裙形状键，然后做碰撞修正：
   - 腿：7 mm；座面以下那一带 3.5 mm，因为臀部离座面只有 9.7 mm。
   - 椅子：座面上方 3 mm，其他面 2 cm；裙子不进座面下方。
   - 地面。
   - 围裙：腿上那片按高度场铺在黄裙和大腿上面，跨过两腿之间的缝。不这样做的话，围裙会被拉进两腿之间、整排三角形挤成一条线，这正是之前 161 对围裙-黄裙穿插的主要来源。
   - 腰带最后再往外推，离开最终的黄裙。
4. **三角形级收尾**（`resolve.py`）：在 Blender 里用 BVH 求交，把剩下的穿插一点点推开。最后这一版只剩 11 对腿-黄裙，3 步推完，最多移动 4 mm。
5. **跟随拟合**（`fit_follow.py`）：形状键是固定的，但 sit_hold 循环里髋部前后晃约 27°（0.5–1.5 s 都在那个角度）。只用第 0 帧的骨骼修正时，裙子在膝盖上撑起来，腿-黄裙约 700。所以 sit_hold 每 0.25 s、sit_down 0.4–1.2 s、stand_up 0.13–0.75 s 各做一次裙骨拟合：
   - 目标 = 坐稳的形状跟着身体蒙皮移过去，按权重和原来的 LBS 混合；
   - 加腿 / 椅子惩罚，椅子按根节点位移平移。
6. **写 glb / anim_meta**（`build_glb.py`），再用 `verify.py` 在 Blender 里按驱动的摆法检查（根节点位移 + 曲线权重）。

## 截图和对比图

都在 `art-src/animation/sit-drape/previews/`，全部是自己渲染的，没有电影截图：

| 文件 | 内容 |
|---|---|
| `settled_frame_q34.jpg` / `_front.jpg` / `_side.jpg` | 坐稳那一帧（EEVEE，柔光，1280×1600），给以后重渲加载页底图用 |
| `compare_settled_sit_hold_0.jpg` | 坐稳那一帧，上：int/v1，下：本次；正面、侧面、四分之三侧、背面 |
| `compare_sit_hold_1.0.jpg` | sit_hold 1.0 s（髋部后仰时），同上四个角度 |
| `keyframes_sit_down_hold_stand.jpg` | 关键帧拼图：sit_down 0.2 / 0.5 / 0.8667 / 1.2，sit_hold 1.0，stand_up 0.3 / 0.6 / 1.0；侧面和四分之三侧，int/v1 与本次上下对比（根节点按驱动的位移摆放） |

## 穿模检查数据

运行时 glb 导入 Blender，按驱动的方式摆：片段姿势 + anim_meta 的根节点位移 + 曲线权重。统计相交的三角形对数（BVH overlap）。原始数据：`art-src/animation/sit-drape/qa/verify_before.json`（int/v1 `022fcad`）和 `verify_after.json`（本次）。下表格式为 int/v1 → **本次**：

| 帧 | 权重 | 腿-黄裙 | 腿-围裙 | 围裙-黄裙 | 黄裙-椅子 | 围裙-椅子 | 蝴蝶结-椅子 | 黄裙-地面 |
|---|---|---|---|---|---|---|---|---|
| **sit_hold 0（坐稳）** | 1 | 450 → **0** | 236 → **0** | 32 → **0** | 458 → **0** | 33 → **0** | 32 → 32 | 252 → **0** |
| sit_hold 0.5 | 1 | 254 → **0** | 91 → **0** | 32 → **6** | 415 → **12** | 0 → 0 | 32 → 32 | 250 → **0** |
| sit_hold 1.0 | 1 | 236 → **0** | 78 → **0** | 32 → **6** | 408 → **11** | 0 → 0 | 32 → 34 | 248 → **0** |
| sit_hold 1.5 | 1 | 242 → **0** | 93 → **0** | 32 → **0** | 405 → **16** | 0 → 0 | 32 → 34 | 243 → **0** |
| sit_down 0.2 | 0 | 189 → 189 | 76 → 76 | 28 → 28 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| sit_down 0.4 | 0.3 | 331 → **82** | 207 → **0** | 32 → 101 | 338 → **0** | 0 → 0 | 0 → 0 | 0 → 0 |
| sit_down 0.6 | 0.6 | 322 → **213** | 169 → **13** | 32 → 157 | 526 → **0** | 18 → **0** | 0 → 0 | 0 → 0 |
| sit_down 0.7 | 0.75 | 361 → 443 | 157 → 247 | 32 → 241 | 464 → **156** | 27 → **0** | 0 → 0 | 26 → **0** |
| sit_down 0.8 | 0.9 | 371 → 428 | 161 → **33** | 32 → 156 | 578 → **0** | 42 → **0** | 0 → 0 | 332 → **0** |
| sit_down 0.8667 | 1 | 385 → 408 | 157 → **17** | 32 → 152 | 610 → **29** | 78 → **0** | 30 → 31 | 341 → **0** |
| sit_down 1.0 | 1 | 389 → **37** | 187 → **0** | 32 → 75 | 517 → **75** | 52 → **0** | 32 → 38 | 299 → **0** |
| sit_down 1.2 | 1 | 452 → **10** | 248 → **0** | 32 → **4** | 458 → **20** | 33 → **0** | 32 → 32 | 252 → **0** |
| stand_up 0.1333 | 1 | 379 → **12** | 191 → **0** | 32 → 49 | 453 → **6** | 33 → **0** | 32 → 34 | 297 → **0** |
| stand_up 0.3 | 0.77 | 383 → 424 | 179 → **90** | 32 → 208 | 596 → **173** | 26 → **0** | 0 → 0 | 323 → **0** |
| stand_up 0.45 | 0.57 | 394 → 405 | 229 → 262 | 32 → 62 | 451 → **375** | 0 → 0 | 0 → 0 | 46 → **0** |
| stand_up 0.6 | 0.36 | 432 → 479 | 208 → 296 | 32 → 216 | 403 → **340** | 0 → 0 | 0 → 0 | 0 → 0 |
| stand_up 0.75 | 0.16 | 187 → **172** | 81 → **0** | 34 → **24** | 525 → 551 | 0 → 0 | 0 → 0 | 0 → 0 |
| stand_up 0.8667 | 0 | 48 → 48 | 0 → 0 | 34 → 34 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| stand_up 1.0 | 0 | 0 → 0 | 0 → 0 | 30 → 30 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |

腿-椅子、躯干-椅子在所有帧都是 0（两边一样）。

## 遗留

1. **过渡帧**：sit_down 0.7–0.8667 s 和 stand_up 0.3–0.6 s 仍有穿插，数量和 int/v1 差不多：
   - 腿-黄裙约 400；
   - 黄裙-椅子 150–375；
   - 本次新增的围裙-黄裙 150–240。

   原因有两个：
   - 驱动让根节点在整个 sit_down（1.2 s）里线性后滑。髋部在 0.8667 s 已经坐到底，这时根节点还在座位前 13.7 cm，sit_down 1.0 时还差 8.2 cm。所以“已经坐下但还没到座位上”的这段时间，坐稳的形状和椅子的相对位置是错的。
   - 形状键只有一个，过渡时只能靠 8 根裙骨带。

   改进方向：
   - 让根节点和髋部同步落座（改驱动或 root_motion 曲线）；
   - 或者把占位的 `sit_drape_mid` 做成真正的过渡形状。它已经在 glb 和驱动里，只差数据，曲线已预留在 `build_glb.py` 的 `CURVES`。但这超出了“各一个形状键”的产品决定，需要先确认。
2. **蝴蝶结尾巴穿座面**：坐稳那一帧有 8 个顶点，最深 18 mm，在她臀部后面、靠背下方，正面、侧面和四分之三侧都看不到。和 int/v1 一样，32 对三角形。
   - 蝴蝶结 `LOD0_G2_BOW` 不在形状键的范围里，产品只要黄裙和围裙。
   - 它的尾巴挂在 `skirt.back` 上。试过让裙骨拟合把它抬起来：只能从 18 mm 减到 11 mm，而且整个蝴蝶结要挪 6 cm，所以没采用。
   - 要彻底解决，需要给蝴蝶结也加一个形状键，或者把尾巴改短。
3. **手放在腿上会陷进围裙**：坐稳那一帧手-围裙 0 → 135 / 215 对，最深约 18 mm；sit_hold 循环里手-黄裙 70–180 对。
   - 动捕片段把手腕 IK 放在**光腿**上，手离大腿只有 18 mm。
   - 黄裙离腿 7 mm、围裙离黄裙 7 mm 以上，正好占满这 18 mm。以前裙子直接穿进腿里，所以手不穿。
   - 截图里看是手掌压在围裙上，手指可见。
   - 根本解决是在 sit 片段里把手抬高约 1.5 cm，属于动作任务。试过在跟随拟合里加“手下方的布要低于手”的约束，结果腿-黄裙反弹到 110 以上，已关掉（`SD_KHAND`，默认 0）。
4. **sit_hold 循环里的小穿插**：黄裙-椅子 11–16 对，围裙-黄裙 0–6 对。形状键是按第 0 帧做的，其他时刻只能靠裙骨贴近。
5. **没在 Cocos / 真机验证**：
   - 本机没有 Cocos Creator。
   - glb 用的是 sparse accessor，这是 `art-src/character/HANDOFF.md` 第 5 条约定的导出方式。但 Cocos 3.8.8 导入时能不能正确读出，需要在 Mac 上打开编辑器确认：`__worldIntegration.morph()` 里围裙和黄裙都应是 `status: ok`、`targetCounts: [2]`。
   - 编辑器里 glb 的 Morph Normals 设置：目标里本来就没有法线，所以 `.meta` 没动；编辑器要是自动改了，核对一下即可。
   - 形变走贴图，低端机的表现见 §8.4 的说明。
6. **重新跑动捕管线会覆盖**：`art-src/animation/mocap/build_all.sh` 重建 glb 时不知道坐姿垂坠，会写回没有形状键、裙骨没重摆的版本。重跑之后需要再跑一次 `art-src/animation/sit-drape/build_all.sh`，并把脚本里的 `BASE` 改成新的起点。
