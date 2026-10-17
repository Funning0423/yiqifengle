# 主页招牌美术候选 A / B（第 16 项附注）· Voice Bot · 2026-10-16 01:31 UTC

只是候选，等 Funning 选。没有改主干，没有推送。两个候选各是一个本地 commit，都直接叠在 GGbot 的 b14067c（ui/audit-fix-20261015，PR #55）上，互相独立。

| | commit | tree | patch |
|---|---|---|---|
| A 招牌放大 | 3080d07b794e3c66a6dbc119ab5484dddc4eccca | 74e9decdbc5112b07938fa0b9270b24ce5e19365 | patches/0001-candidate-A-home-sign.patch |
| B 深色底板 | 50eceeaf5705b704ba711cc3901f003677891421 | 6e90c0bbe0b3ff9b7f928f91bafab8e7bb9a0c16 | patches/0001-candidate-B-home-sign.patch |

本地分支：voicebot/home-sign-A（worktree /tmp/wt-sign-A）、voicebot/home-sign-B（/tmp/wt-sign-B）。
应用方法：在 b14067c 上执行 `git am patches/0001-candidate-X-home-sign.patch`，得到的 tree 应该等于上表（两个 patch 都已经用 `git apply --check` 在 b14067c 上验证过）。

## 对比图（都是未裁切的整屏）
- compare_far_402x874.png、compare_far_600x800.png、compare_close_402x874.png、compare_close_600x800.png：每张从左到右是 现状 b14067c / A / B
- frames/：12 张单独的整屏图（cur|A|B × far|close × 402x874|600x800）
- zoom_sign_*.png：招牌局部放大（远景放大 4 倍、近景放大 2 倍，最近邻采样），只用来看字，不是交付画面
- 渲染方式：离线预览，用 Blender 5.2 Cycles 渲染，**不是 Cocos 实机**。镜头直接取游戏的 IslandRail（far = restore(1)，close = restore(0)，也就是 0.46 最近停靠）；岛模型是 creator-project/assets/firstslice/combined_visual_m.glb，道具用 0f28044 的 glb-preview。底排 3D 道具按运行时的 `screenPropPose` 摆放；"继续旅程"四个字和底板用 2D 透视贴到牌面上，并按射线遮挡（树挡住的部分不画）。没有用 GGbot 的 three.js 脚本：box 上找不到那个脚本。渲染脚本放在 tools/。
- far 镜头和 GGbot 的 three.js 参考图对齐过：招牌在同一位置，宽度差 1 px 以内。

## 节点与变换改动

### 共同改动（A 和 B 都有）：近景的大棕榈叶
近景下方那片大叶子是 T9 道具 `beach_palm_tall`。它原来种在 0.46 最近停靠的镜头正下方（镜头位置 (0.16, 7.62, 11.94)）。
- `ISLAND_PROPS.palms[0]`（beach_palm_tall）：position [-0.5, -0.30, 9.0] → **[-3.3, 0.05, 6.6]**，yaw 200° → **60°**，scale 0.9 → **0.75**
- 新位置是西岸 env_island_main 的地面（射线测得地面高约 0.05–0.07），不在石头上，也不在水里。远景里它不挡招牌和女主，门露出的像素比现状还多（现状被旧棕榈挡了一点）
- tools/camera-frame-test/t9_props.cjs 里的 PROPS 同步修改，docs/T9.md 同步修改

### 候选 A：远景放大招牌
节点 `ui_signpost`（ISLAND_PROPS.signpost）：
- position [-4.08, 0.127, 0.7] → **[-4.38, -0.02, 1.25]**（向西 0.3 m，朝远景镜头方向 0.55 m）
- yawDeg 5.58 → **2**（牌面偏离最近停靠镜头约 21°，偏离远景镜头约 11°）
- scale 0.79 → **1.0**（放大 1.27 倍）
- 不改原位直接放大的原因：原位只要放大到 0.92 以上，远景里牌子右上角就会压到灯塔墙脚；再往西挪，左立柱又会落到草坡外，悬空约 0.4 m。现在这个点是三者之间的折中：左立柱贴在草地上（高出地面 1 cm），右立柱沿坡埋进草地约 0.14 m
- 同步修改：GullFlockCore.ts 里 `GULL_FX.sign` 的 base 改为 [-4.38,-0.02,1.25]，topY 1.85 → 2.1；test_island_fx.cjs 里的 SG；test_island_props.cjs 里的位置断言；docs/T9.md

### 候选 B：文字加深色底板（变换不动）
`ui_signpost` 的变换和 b14067c 完全一样。改动在 `SignText` 节点（RenderRoot2D）：
- 结构从「SignText（RenderRoot2D + Label）」改成「SignText（RenderRoot2D + UITransform + UIOpacity）→ 子节点 SignPlate（Graphics）→ 子节点 SignLabel（Label）」。底板先画，字在上面
- 新增 `ISLAND_PROPS.signpost.plate`：{ widthM 1.40, heightM 0.44, radiusM 0.07, edgeM 0.03, fill #5b3a1f, edge #3e2612, nightFill #3e2a18, nightEdge #24160a, text #fbf3df, nightText #d8cdb5 }（牌面局部坐标，单位米）
- 有底板时，Label 用奶油色字（plate.text），夜间按原来那套夜间权重（paintSignInk）混到 nightText；底板颜色也按同一权重重画，只在颜色变化时重画
- 字号、SHRINK、加粗都不变；dispose 时清掉 signPlate
- 试过奶油色底板加同色描边：牌面本来就是奶油色，这样只是多一道框，描边在小字上还会糊成一团，所以改成深色底板、不加描边。`signpost.text.color` 保持 #633f21（测试里有断言）

## 实测（离线渲染逐像素射线统计，数据在 metrics.json）
招牌宽度是整块道具的可见宽度（含灯和立柱），按画面宽度的百分比算。

| | 远景 402×874 | 远景 600×800 | 最近 402×874 | 最近 600×800 |
|---|---|---|---|---|
| 现状 宽度 | 43 px / 10.7% | 39 px / 6.5% | 104 px / 25.9% | 96 px / 16.0% |
| A 宽度 | 54 px / 13.4% | 50 px / 8.3% | 136 px / 33.8% | 124 px / 20.7% |
| B 宽度 | 43 px / 10.7% | 39 px / 6.5% | 104 px / 25.9% | 96 px / 16.0% |
| 字区宽度（现状 / A / B） | 23 / 30 / 23 px | 21 / 27 / 21 px | 55 / 71 / 55 px | 50 / 65 / 50 px |

棕榈叶（beach_palm_tall）覆盖率：

| | 最近 402×874 全屏 | 最近 402×874 下 40% | 最近 600×800 全屏 | 最近 600×800 下 40% |
|---|---|---|---|---|
| 现状 | 21.8% | 54.4% | 13.8% | 34.3% |
| A / B | 1.4% | 0.0% | 3.1% | 1.5% |

约束核对（A、B 都满足）：
- 最近停靠 0.46 没动，底栏 8% 没动
- 门和灯塔被招牌挡住的像素都是 0；最近停靠时整块牌子都在画面内，不碰边
- 招牌离镜头最近 12.78 m（A）/ 13.35 m（B），都大于 1.7 m
- 远景宽度不超过 22%
- 立柱都站在 env_island_main 的草地上
- 只用了现有资源和程序生成的 Graphics
- 测试：test_island_props 20 项全过，test_es5_safety 全过。test_island_fx 在 b14067c 上本来就跑不了（box 上的 creator-build-project 里没有 bundles/region_island/combined_visual_m.glb），所以没跑

## 包体差异
- 资源字节：A、B 都是 **0 B**（没有新贴图、字体或模型）
- 运行时源码字节（creator-build-project/assets）：A **+356 B**（IslandPropsLayout.ts，几乎都是注释）；B **+2,274 B**（IslandProps.ts +1,507，IslandPropsLayout.ts +767）
- 去掉注释后转成 ES5 的估算：A **−4 B**，B **+1,852 B**。Graphics 引擎模块原来就在用（NativeBoardUI 等），不会新增引擎模块
- 草甸那次之后的余量：分包剩 1.18 MB，主包来源 1.79 / 4 MiB。两个候选都不影响这个余量，最终以 Mac 真构建为准

## 弱点（请一起看）
1. **远景的字两个候选都读不出来。** A 的字区约 30 px，四个字每个约 7 px；B 的深色底板能认出是一块"有字的牌子"，但字一样读不出来。另外，远景里牌子右侧被一棵岛上自带的小树（env 模型里的，不是 T9 道具）挡住约一半，三个版本都一样。要真正读出字，需要挪树，或者把牌子换到不被挡的位置，这都超出这次的范围
2. **A 的近景：左边那棵小树挡住了"继"字的左下角**（600×800 更明显，402×874 也看得到）。按运镜bot的规则，挡到字就要把树往左挪，但那棵树是 env 合并模型的一部分，A 里没改
3. A 的位置是被灯塔墙脚和草坡边缘夹出来的：再放大就会压到灯塔，再往西左腿就会悬空。右立柱埋进坡里约 0.14 m
4. B 的深色底板改变了牌子的风格（从奶油色牌面变成像黑板的效果），夜间颜色还没在渲染里验证
5. 棕榈换了位置也缩小了，远景构图有变化：原来岛前方中间那棵棕榈现在挪到了左侧草地边，`palm z on beach` 测试的下限是 6.5，这次放在 6.6，刚好擦边。T9 的 lens_rays/camera 套件要 T9_ROOT 和 Mac，这次没跑
6. 这些都是 Blender 离线图：光照、描边和 Label 的实际字形都和 Cocos 不同。最终要在 Mac 上用 Cocos 实机按第 16 项同机位截图核对。IslandProps.ts 没有用 cc 类型做完整类型检查（只跑了 ES5 转译检查）
