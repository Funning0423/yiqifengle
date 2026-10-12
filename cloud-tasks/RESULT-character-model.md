# RESULT：任务 2 角色模型打磨（cloud/character-model）

分支 `cloud/character-model`（基于 `docs/cloud-tasks`，已合入 `work/角色建模bot`），PR 合到 `int/v1`，**没有自己合并**。
运行时 GLB（`creator-build-project/.../chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb`）**没有覆盖**，`creator-build-project/` 下什么都没改，所以不需要跑 `test_manifests.cjs`。

## 一句话
头部换成从混元 3D 头重拓扑的游戏模型（5582 三角面，眼睛单独建模能眨眼）。袖子、手、短靴、围裙和腰带按 brief 重做了。候选 GLB **1,386,032 B（1.32 MiB）≤ 1.5 MB**。28 根骨的名字、层级、IBM、rest pose 都和运行时 GLB 逐字节相同，14 段动作也原样保留。除了 3 段坐姿（属于任务 3）以外，全部动作的最小间隙都 ≥ 6 mm，围裙片和黄裙之间 8.2–12.2 mm。

## 交付物
| 文件 | 说明 |
|---|---|
| `art-src/character/body-r4/chr_b_r5g2_body-r4_TEST.glb` | 候选运行时 GLB：基于当前运行时 GLB（14 段动作），只换网格和贴图。sha256 `aec882ff…48d15` |
| `art-src/character/body-r4/chr_b_r5g2_body-r4_walk-v2_TEST.glb` | 同一个模型配 walk_loop v2 的版本（1,277,084 B） |
| `art-src/character/head-hy/` | 混元头部重拓扑管线：`scripts/run_all.sh` → `head_hy_work_final.blend` |
| `art-src/character/body-r4/` | 身体这一轮：`scripts/run_all.sh`（读 head-hy 的 .blend）→ `body_r4_work.blend`（不提交，可重建）+ 两个 TEST GLB |
| `art-src/character/body-r4/share/r4_0*.jpg` | 对比图（每张 < 200 KB） |
| `art-src/character/body-r4/data/qa_clash.json`、`qa_animtools_clipcheck.json` | 穿模数据（自己的 QA + 动画工具包的 clipcheck） |

复现（Blender 4.5.14 LTS，无界面）：`cd art-src/character && bash head-hy/scripts/run_all.sh && bash body-r4/scripts/run_all.sh`。混元 glb 不在仓库里（79 MB），`env.sh` 默认读 `/tmp/hy/hunyuan_head_v31.glb`，用 `git cat-file -p origin/assets/hunyuan-head:art-src/character/hunyuan/hunyuan_head_v31.glb > /tmp/hy/hunyuan_head_v31.glb` 取出来。完整命令见 `HANDOFF.md` §3 第 9–12 步。

## 改了什么
### 头部（head-hy，新）
- 以混元 v31 头（150 万面）为底子：按 albedo 把面分成头发、皮肤、草帽、粉带、衬衫等类别，各自建 BVH，然后把**干净的程序化拓扑投影上去**。没有直接减面，因为减面后 UV 很碎、五官糊掉。
- **脸**：四边形球投影到混元脸面上，经过 Laplacian 平滑，下巴往圆形拉（圆下巴），鼻子只留一个小起伏；被头发盖住的地方收进发壳里 9 mm。992 三角面。
- **眼睛单独建模**：每只眼是一块略鼓的眼片（112 三角面）加一圈立体睫毛和上眼睑（75 三角面），所以从侧面看也有厚度，不是只靠贴图。眨眼沿用 HANDOFF §4.6 的方案：`_tag_eyes` 顶点的 UV 偏移，睁眼 (0,0)、半闭 (0,+0.5)、闭眼 (+0.5,0)，眼睛区四宫格画在 `T_G2_FACE` 里。
- **头发**：在头部周围采样混元发型的包络 r(方位角, 极角) 和发际线，再分层做：头顶发冠、内衬、左右侧发、鬓角两缕、后发（`hair.back`，396 顶点）、刘海 7 缕（`hair.fringe`，252 顶点），以及脸颊内侧的暗色填充片。发丝按发束相位做 UV，在 `T_G2_HEAD` 右半边画了明暗和高光环，体积和层次比 R2 明显。
- **草帽**：帽檐平面用 PCA 拟合，帽冠和帽檐轮廓用椭圆拟合，帽檐剖面用指数圆角；帽冠里的头发会被收进帽子。30° 游戏机位下帽檐不挡眼睛（`r4_02` 最后一列）。
- 100% 绑到 `head` 骨，领子和颈部沿用 head-r2。头部合计 **5582 三角面**（R2 是 5628），领→颅 ≥ 21.5 mm。

### 身体（body-r4，在 body-r3 WIP 基础上）
| 项 | 做法 |
|---|---|
| 袖子 | 剖面改成顺直的筒形：肩 43 mm → 前臂 45 mm，略放宽、不贴手臂；只在克夫上方用 `gather` 堆一点褶。袖山顶压平 45–50%（`top_flat`），袖窿顶抬高（`armhole.rz` 0.06），躯干的肩宽收到袖窿，所以肩线是一条顺的线，没有泡泡肩的鼓包和折痕。肘后侧压平 13%，给 door_reach 留出余量 |
| 手 | 手指并拢、微弯（各节 7–15°），拇指贴着食指（不再朝身体张开）；整体缩小到 1.16 倍，手腕往下垂（`hang` 0.45），手背圆。每只 448 三角面 |
| 手离身体 | 网格这边能做的已经做了：静止姿势下手→裙从 72 mm 收到 67 mm，手→围裙从 63 mm 收到 56 mm。剩下的距离来自骨骼姿势（A-pose 和动作里的手臂外展），本任务不能改骨骼，见遗留问题 1 |
| 短靴 | 圆筒靴身（指数 1.0，不再是方块），靴筒贴脚踝，离袜子 2–3 mm，往上略收；鞋头圆而窄（鞋宽 6.7–7.0 cm，`toe_ex` 0.78）；薄鞋底边（外扩 1.6 mm、高 1.15 cm），后跟有低跟色块；颜色是 V12 的红棕（皮 178,70,52，底 110,44,36）。靴子里面的小腿收细，避免穿出靴筒 |
| 围裙 | 围裙片在黄裙轮廓以内（顶 ±56°，底 ±60°），圆角下摆，和黄裙间距 12 mm（动作里 8.2–12.2 mm，满足 8–12 mm） |
| 腰带和围兜 | 白腰带上移到自然腰线（z 1.098–1.134，和 V12 比例一致），围兜直接接到腰带，中间不露黄色；背后两条肩带一直延到腰带；蝴蝶结跟着上移 |
| 蝴蝶结颜色 | 贴图缩到 256² 后，原来取的白色像素和周围颜色混成了米色。改成自动取 `T_G2_BODY` 里最大一块纯白区的中心 |
| 贴图 | `T_G2_BODY` 在 GLB 里缩到 256²（它只给蝴蝶结的白色和裙子下面看不见的胯部用），图名不变 |

**没有改的**：骨骼名、层级、IBM、rest pose（逐字节校验过）；网格名、材质名、图片名（没新增材质，也没新增贴图）；顶点格式；动作数据；GLB 的 tangents 设置（运行时 `.meta` 没动）。

## 对比图（`art-src/character/body-r4/share/`）
| 文件 | 内容 |
|---|---|
| `r4_01_fullbody_vs_V12.jpg` | **正面、侧面、四分之三侧、背面**：V12 / 本轮 / 改前（运行时 e60），同角度同大小 |
| `r4_02_head_vs_V12.jpg` | 头部：正面、3/4、侧面、背面、30° 游戏机位，再加线框；和 V12 头部并排 |
| `r4_03_blink.jpg` | 眨眼三个状态（睁开、半闭、闭合） |
| `r4_04_game_camera.jpg` | 俯 30° 游戏机位：本轮 / 改前 |
| `r4_05_upper_sleeve_belt.jpg` | 上身、肩线、袖子、腰带和蝴蝶结特写：V12 / 本轮 / 改前 |
| `r4_06_hands_boots.jpg` | 手和短靴特写：V12 / 本轮 / 改前 |
| `r4_07_wire.jpg` | 全身线框 |
| `r4_08_key_action_frames.jpg` | **关键动作帧拼图**：14 段动作和 walk_loop v2，每段取首帧、中间帧、末帧 |

出图：`bash body-r4/final/render_r4.sh && python3 body-r4/final/sheets_r4.py`。只用了 V12 和自己的渲染，**没有用、也没有提交任何电影截图**。

## GLB 大小（`python3 body-r4/scripts/glb_size.py <glb>`）
| | 本轮 TEST | 改前（运行时） |
|---|---|---|
| **总计** | **1,386,032 B（1.322 MiB）** | 2,115,652 B |
| 网格 | 889,564 B / 22,576 三角面 | 1,377,774 B / 30,451 三角面 |
| 贴图（5 张，名字不变） | 166,490 B | 407,302 B |
| 动作二进制（14 段） | 132,392 B | 132,392 B |
| JSON 块（大部分是动作的 channel/sampler/accessor 条目） | 189,676 B | 190,272 B |

按网格分：DRESS 9774 三角面（没动）；BODY 里，M_G2_FACE 7350（脸、眼、躯干、袖、手、腿、靴）、M_G2_HAIR 3068、M_G2_HEAD 1148（草帽）、M_G2_BODY 432；APRON 456；BOW 348。
**离 1.5 MB 还剩 113,968 B（按 1,500,000 算）**。动捕任务如果加动作或加关键帧，要从这个余量里出（见遗留问题 6）。

## 穿模检查（所有动画片段）
### 1）自己的 QA：`body-r4/scripts/qa_clash.py`，14 段运行时动作 + walk_loop v2，**每帧**采样
要求：最小间隙 ≥ 6 mm，围裙片→裙 8–12 mm。最后一列只统计身体和衣服之间的动态穿插；头部内部的静态接触单独说明。

| 片段 | 袖→围裙 L / R | 手→围裙 L / R | 手→裙 L / R | 腿→裙 | 围裙片→裙 | 领→颅 | 身体/衣服穿插三角对 |
|---|---|---|---|---|---|---|---|
| door_reach | 33.2 / 7.2 | 56.2 / 48.1 | 66.7 / 57.2 | 21.0 | 11.7 | 22.2 | 0 |
| idle_breathing_loop | 54.8 / 54.9 | 141.1 / 141.4 | 97.9 / 98.0 | 21.0 | 11.7 | 22.1 | 0 |
| sit_down | 0.0 / 0.0 | 41.7 / 43.2 | 53.3 / 54.9 | 0.0 | 0.0 | 22.2 | legs-dress 296, sleeve_R-apron 44, sleeve_L-apron 44, sleeve_R-dress 64, sleeve_L-dress 64, legs-apron 98, apron-dress 86 |
| sit_hold | 1.0 / 1.4 | 50.4 / 49.7 | 59.7 / 59.7 | 0.3 | 0.0 | 22.2 | sleeve_L-dress 64, sleeve_R-dress 64, sleeve_L-apron 44, sleeve_R-apron 44, legs-dress 218, legs-apron 98, apron-dress 86 |
| stand_up | 0.0 / 0.0 | 41.7 / 43.2 | 53.4 / 54.9 | 0.0 | 0.0 | 22.2 | sleeve_L-dress 64, sleeve_R-dress 64, sleeve_L-apron 44, sleeve_R-apron 44, legs-dress 296, legs-apron 98, apron-dress 86 |
| walk_loop | 16.4 / 16.5 | 8.5 / 9.0 | 19.3 / 20.2 | 9.2 | 8.2 | 22.7 | 0 |
| walk_start | 19.8 / 16.7 | 18.0 / 8.5 | 29.2 / 19.4 | 9.4 | 8.2 | 22.2 | 0 |
| walk_stop_bodyL | 26.9 / 32.6 | 71.2 / 46.1 | 50.8 / 40.1 | 17.8 | 9.9 | 22.2 | 0 |
| walk_stop_bodyR | 32.9 / 27.1 | 46.2 / 71.8 | 40.8 / 50.9 | 14.1 | 9.3 | 22.2 | 0 |
| walk_turn_180 | 53.5 / 55.2 | 116.3 / 141.3 | 94.8 / 94.3 | 13.7 | 10.8 | 21.5 | 0 |
| walk_turn_180_bodyR | 55.1 / 53.8 | 141.0 / 116.2 | 94.3 / 94.9 | 13.1 | 10.9 | 22.2 | 0 |
| walk_turn_90_bodyL | 53.5 / 55.1 | 135.3 / 141.4 | 95.0 / 97.6 | 12.4 | 10.1 | 21.6 | 0 |
| walk_turn_90_bodyR | 55.1 / 53.8 | 141.1 / 135.6 | 97.5 / 95.0 | 12.0 | 9.8 | 22.2 | 0 |
| wind_sway_loop | 33.2 / 32.7 | 56.7 / 26.9 | 66.6 / 38.6 | 15.5 | 11.4 | 22.2 | 0 |
| walk_loop_v2 | 16.4 / 16.5 | 8.5 / 9.0 | 19.3 / 20.2 | 9.2 | 8.2 | 22.7 | 0 |
| rest | 33.2 / 33.7 | 56.2 / 57.0 | 66.7 / 68.1 | 21.0 | 11.7 | 22.2 | 0 |

- 所有片段里都有同样数量的头部静态接触：脸/颅和发壳 23、和后发 33，发壳/刘海和帽子 5。这些部件都 100% 绑在 `head` 一根骨上，相对位置是刚性的，任何动作都不会让它们变多或变深；位置在发际线、后颈发梢收口处，以及左前帽檐下面，都是被遮住的内侧边。侧面、背面、仰视的特写都检查过，没有皮肤从头发里露出来。
- 腰带→裙 4.5–5.8 mm：腰带本来就是系在裙子上的一圈（随裙子顶部的权重运动），不算分层间隙。

### 2）动画工具包复核：`uploads/anim-tools.tgz` 里的 `角色动画bot/walk-v2/walk_clipcheck.py`（每帧 2 个子采样，水平射线法）
| 片段 | 腿穿出裙/围裙 mm | 裙穿出围裙 / 围裙陷进裙 mm | 手臂陷进裙/围裙 mm | 手臂→布料最小间隙 mm | 手臂陷进躯干 mm（见说明） |
|---|---|---|---|---|---|
| 改前 door_reach | 0 / 0 | 0 / 0 | 0 / 0 | 6.4 | 18.6 |
| 改前 idle_breathing_loop | 0 / 0 | 0 / 0 | 0 / 0 | 56.3 | 0 |
| 改前 sit_hold | 69.9 / 55.6 | 391.4 / 48.2 | 48.1 / 50.0 | 0.1 | 21.8 |
| 改前 walk_loop | 0 / 0 | 0 / 0 | 0 / 0 | 6.8 | 0 |
| 改前 walk_start | 0 / 0 | 0 / 0 | 0 / 0 | 8.5 | 0 |
| door_reach | 0 / 0 | 0 / 0 | 0 / 0 | 7.7 | 26.0 |
| idle_breathing_loop | 0 / 0 | 0 / 0 | 0 / 0 | 53.7 | 1.6 |
| sit_down | 139.8 / 56.2 | 307.8 / 50.0 | 49.8 / 49.9 | 0.0 | 27.4 |
| sit_hold | 139.8 / 56.2 | 288.9 / 49.8 | 47.2 / 47.3 | 0.0 | 27.4 |
| stand_up | 139.8 / 56.2 | 307.8 / 50.0 | 49.8 / 49.9 | 0.0 | 27.4 |
| walk_loop | 0 / 0 | 0 / 0 | 0 / 0 | 7.4 | 9.2 |
| walk_loop_v2 | 0 / 0 | 0 / 0 | 0 / 0 | 7.4 | 9.2 |
| walk_start | 0 / 0 | 0 / 0 | 0 / 0 | 7.4 | 9.2 |
| walk_stop_bodyL | 0 / 0 | 0 / 0 | 0 / 0 | 26.9 | 8.5 |
| walk_stop_bodyR | 0 / 0 | 0 / 0 | 0 / 0 | 27.2 | 8.7 |
| walk_turn_180 | 0 / 0 | 0 / 0 | 0 / 0 | 52.9 | 4.3 |
| walk_turn_180_bodyR | 0 / 0 | 0 / 0 | 0 / 0 | 53.1 | 4.4 |
| walk_turn_90_bodyL | 0 / 0 | 0 / 0 | 0 / 0 | 52.9 | 2.1 |
| walk_turn_90_bodyR | 0 / 0 | 0 / 0 | 0 / 0 | 53.1 | 2.7 |
| wind_sway_loop | 0 / 0 | 0 / 0 | 0 / 0 | 25.2 | 6.6 |

- 除坐姿外：腿、裙、围裙、手臂进布料全部是 0，手臂→布料最小 7.4 mm（改前是 6.4–6.8 mm）。
- “手臂陷进躯干”这一列：这个工具把所有主权重是 upper_arm/forearm/hand 的顶点当成手臂，把主权重是 chest/spine/hips 的面当成躯干。新做的是装袖（set-in sleeve），袖子腋下那几圈本来就埋在衣身侧壁里 5 mm 左右（静止姿势下就是这样），用来封住接缝。逐个顶点查过：命中的全是腋下袖根（z 1.27，半径 0.126），以及 door_reach 伸手时的前腋窝。door_reach 最深那一帧也看过特写，衣身没有从袖子里穿出来。改前的模型在 door_reach 也有 18.6 mm。

## 网上查的做法（怎么用到这一轮的）
- 低多边形头发：先做一层底壳（发冠和内衬），上面叠发束和外轮廓发缕，分层而不是共面插片；发根埋进头皮，发尾收拢；UV 顺着发丝走向。参考 [Mariia Zatorska - Real-time Hair Creation Workflow](https://marizatorska.artstation.com/blog/40NN/real-time-hair-creation-workflow)、[Reallusion Hair Mesh Production](https://wiki.reallusion.com/Content_Dev:CC_3.4_Hair_Mesh_Production)、[3DCG暮らし Anime Hair Modeling](https://tohawork.com/en/hairmodeling)（每个角度都要看得出发束是锥形，轮廓的乱度要适中）。
- 二次元眼睛：眼片单独建模，眼睑和睫毛在上层；用贴图图集加 UV 偏移切换眨眼帧。参考 [Twilight Princess Eyes Breakdown](https://www.benjones.us/twilight-princess-eyes-breakdown/)、[Wind Waker 风格 2D 脸部绑定](https://neidio.dev/blog/01face-rig)。这里没新增材质，所以眨眼帧画进 `T_G2_FACE` 的四宫格，偏移量沿用 HANDOFF 的约定。
- 袖子：装袖的袖山略高、袖窿接缝；褶只放在受力处（克夫上方、肘弯）；游戏模型的褶尽量少、靠法线表现。参考 [r/blender 关于动漫袖褶的讨论](https://www.reddit.com/r/blender/comments/1eqx102/whats_the_best_way_to_get_stylized_anime_sleeve/)、[Style3D 泡泡袖说明](https://www.style3d.com/blog/how-to-design-puff-sleeves-with-3d-simulation-and-ai-tools/)（反过来用：要去掉泡泡感，就把袖山高度和抽褶量压到最低）。
- 手和短靴：手按放松状态做（手指并拢、拇指贴着食指）；短靴贴着脚踝，鞋头窄而圆，鞋底边薄。这些都直接按 V12 和 brief 的描述做了。

## 遗留问题
1. **手离身体的距离**：网格这边已经往身体收了（静止姿势下手→裙 72 → 67 mm，手→围裙 63 → 56 mm）。要再“收回一半”，需要让动作里的手臂外展角变小（idle 的手→裙现在约 98 mm）。这属于骨骼姿势和动作，归动捕任务（`cloud/mocap-animation`）。建议 idle 手→裙做到约 45–50 mm；本模型在 walk 下手→围裙还有 8.5 mm 余量。
2. **坐姿 3 段（sit_down / sit_hold / stand_up）**：腿、袖、围裙都穿过裙子。改前就有，属于任务 3（03-sit-drape，坐姿形状键）。注意：腿穿出裙的深度从改前的 69.9 mm 变成了 139.8 mm，主要因为 body-r2 已经通过的“裙摆上提”和 body-r3 的黄裙去掉 .mid 骨。任务 3 要以这一版为准。
3. **头部静态接触**（上面说明过）：所有片段里一样，看不见。如果以后要求表里是 0，可以把后发和发际线的收口再往外推 2–3 mm（`build_head_hy.py` 的 `back_fn` 和 skull 的 gap），代价是从下往上看时发根会有缝。
4. **运行时 GLB 还没替换**：等 PM 和用户看图验收后，按 HANDOFF §6(c) 的流程把 TEST GLB 换上去（文件名、`.meta` 的 uuid 和 subMeta 都不变），再跑 `node tools/test_manifests.cjs --write`。
5. **眨眼在运行时怎么驱动**（改 UV、改材质的 tilingOffset，还是用 morph）要和 GGbot 一起定。模型这边准备好的是：眼片顶点在 `.blend` 的 `_tag_eyes` 组，眨眼帧在 `T_G2_FACE` 的四宫格。
6. **和动捕任务对接**：本轮没碰骨骼，也没碰动作。GLB 是用 `splice_glb.py` 生成的：以运行时 GLB 为底，只替换网格 primitive 和图片。动捕那边交付新的运行时 GLB 以后，用 `E60=<新 GLB> bash body-r4/scripts/run_all.sh` 就能直接重新拼出“新模型 + 新动作”，再跑一次 `qa_clash.py`。包体余量约 114 KB；JSON 块现在约 190 KB，基本都是动作的条目，加动作时要注意。
7. **`hair.fringe` 和 `hair.back` 两根头发骨**还没加（总数会到 30 根）。两个顶点组在 `head-hy/head_hy_work_final.blend` 和 `body_r4_work.blend` 里，权重现在是 100% head。
8. **和 V12 还有差别、但不在本任务范围的**：黄裙比 V12 短、下摆不够撑（裙摆上提是 body-r2 定下来的）；V12 原画里是一脚蹬，brief 要的是短靴，这里按 brief 做了。
9. 混元源文件（79 MB）没有提交，只在 `assets/hunyuan-head` 分支里，`env.sh` 写了怎么取。
