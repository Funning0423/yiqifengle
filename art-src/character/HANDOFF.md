# 角色建模bot → Cursor 云端（无界面 Blender）交接：女主角模型精修

> 提交：分支 `work/角色建模bot` （SHA 见箱子 handoff 文档）（基于 int/v1 `c5db016`）。仓库里没有 remote，所以**没有 push**。分支里的 `art-src/character/HANDOFF.md` 和本文内容相同。
> 写于 2026-10-11 13:50 CT。body-r3 是按计划变更中途停下的半成品（`body-r3/body_r3_wip.blend`）。

## 0. 目录和来源
仓库内路径：`art-src/character/`（照 `art-src/board-ui/` 的结构来放）。

| 目录 | 内容 | 状态 |
|---|---|---|
| `audit-v1/` | 第一次审查：README（现状数据、问题清单、精修方案）、统计脚本、share/ 对比图 | 完成 |
| `head-r1/` | 头部第 1 版脚本、贴图、数据 | 被 R2 取代 |
| `head-r2/` | **当前头部**：脚本、贴图、`head_r2_work_final.blend` | 已交，但用户不满意，以后换成 AI 生成的头 |
| `head-r3/` | 头部放大 8–10% 的半成品脚本 | 已叫停，只留脚本 |
| `body-r1/` | 肩、臂、袖第 1 版（PM 验收通过） | 被 r2 取代 |
| `body-r2/` | **当前定版候选**：袖、手、小腿、高帮鞋、裙摆上提；`body_r2_final.blend`、静止版和 walk-v2 版 TEST GLB | 已交，PM 看过，有返工意见（即 body-r3） |
| `body-r3/` | 袖、手、鞋、围裙/腰带/蝴蝶结返工的 WIP；`body_r3_wip.blend` | **中途停下**，见 §5(a) |
| `final/` | body-r1 / head-r2 那一轮的渲染和拼图脚本（body-r2/final、body-r3/final 是各自轮次的副本） | — |
| `hunyuan-eval/` | 混元头部的可行性评估脚本和 share/ 对比图 | 未完成，见 §5(b) |
| `reference/character-ankle-balanced-v12.jpg` | V12 站姿参考图（原图 PNG 转 JPG q90，尺寸同为 1536×1024，裁切坐标通用） | 用户 08:36 UTC 只批准作为建模参考，不是成品验收 |
| `_deps/walk-v2/chr_b_r5g2_walk-v2_TEST.glb` | 角色动画bot 的走路 v2 TEST GLB 副本（原件 `/workspace/yiqifengle/previews/角色动画bot/walk-v2/`，sha256 `51795a86…`） | 只读输入 |
| `env.sh` | 所有路径的配置（见 §2） | — |

每个轮次目录的结构都一样：`scripts/`（脚本）、`data/`（params.json、QA json、导出用的 npz）、`tex/`（贴图）、`share/`（压缩对比图，每张 <200 KB）、`README.md`（该轮的改动、数字、穿模表）。

### 参考图说明（重要）
- 草坡画画那张参考图是《起风了》的电影截图。`handoff/20261011-棋盘UI美术bot-to-local-cursor.md` §10 写明了**不能把电影截图提交、打包或放进对比图**，所以我**没有提交它**，也把 body-r2、body-r3 的 share/ 对比图在去掉“参考图”列之后重新拼了一遍再提交（文件名里的 `_ref` 和图上的标题没改，但图里已经没有这一列了）。箱子里原来带参考图列的版本还在 `/workspace/yiqifengle/previews/角色建模bot/body-r2/share/` 和 `.../body-r3/share/`。原图在箱子 `/home/box/agent-data/agents/8c7b417d-ced0-405f-97a8-6cb496b2ecc5/attachments/a144e1a3…ec904.jpg`。需要的话 `export FILM_REF=<路径>`，拼图脚本会自动把这一列加回来。这条规则和 PM 让我提交参考图的要求有冲突，**请 PM / 用户来定**。
- 风掀围裙的参考图 debb2cfc 也没有提交（审查时只用文字描述过）。

## 1. 环境
- Blender：**4.5.14 LTS**（hash 62c1db4208e8，2026-09-15 构建），箱子里装在 `/opt/blender-4.5/`，`/usr/local/bin/blender` 是它的链接。Blender 自带 Python 3.11.15 和 numpy 1.26.4；我们的 Blender 脚本只用到 bpy、bmesh、mathutils、numpy，**不需要在 Blender 里装 PIL**。
- Linux 安装（官方包）：
  ```bash
  cd /opt && curl -LO https://download.blender.org/release/Blender4.5/blender-4.5.14-linux-x64.tar.xz
  tar xf blender-4.5.14-linux-x64.tar.xz && ln -sf /opt/blender-4.5.14-linux-x64/blender /usr/local/bin/blender
  # 无界面运行需要的系统库（Debian/Ubuntu）
  apt-get install -y libxi6 libxxf86vm1 libxfixes3 libxrender1 libgl1 libxkbcommon0 libsm6 libice6
  blender --version   # 应输出 Blender 4.5.14 LTS
  ```
  下载页：https://download.blender.org/release/Blender4.5/ （箱子里实测 HTTP 200，378 MB）。也可以 `export BLENDER=/其他/路径/blender`。
- 系统 Python（箱子里是 3.13.5）：`pip install pillow numpy`（箱子里是 Pillow 12.3.0、numpy 2.5.4）。GLB 拼接、裙摆、remap_mid、stats、拼图都用系统 Python 跑。
- 字体：拼图用 `/usr/share/fonts/opentype/noto/NotoSansCJK-{Regular,Bold}.ttc`，装 `apt-get install -y fonts-noto-cjk`。
- 渲染用 Workbench（studio light `paint.sl`、曝光 +0.30、背景 (0.58,0.61,0.66)），只用 CPU，不需要 GPU。hunyuan-eval 用 Cycles CPU。
- 内存：渲染脚本会同时开 3–4 个 Blender 进程；箱子 15 GB 内存时出现过 OOM（`Aborted`）。内存小的话，把 `render_*.sh` 里的 `&` 去掉，按顺序跑。

## 2. 路径配置
所有 `.sh` 开头都会向上找 `env.sh` 并 source 它。下面每一项都可以先 `export` 覆盖：

| 变量 | 默认值 |
|---|---|
| `CHAR_ROOT` | `art-src/character` |
| `REPO_ROOT` | 仓库根目录 |
| `BLENDER` | `command -v blender`，找不到就用 `/usr/local/bin/blender` |
| `E60` | `$REPO_ROOT/creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb`（运行时 GLB，**只读**） |
| `W2` | `$CHAR_ROOT/_deps/walk-v2/chr_b_r5g2_walk-v2_TEST.glb` |
| `V12_REF` | `$CHAR_ROOT/reference/character-ankle-balanced-v12.jpg` |
| `FILM_REF` | 空，不进仓库，留空时自动去掉“参考图”列 |
| `HUNYUAN_GLB` | `/workspace/yiqifengle/previews/grokbot/hunyuan-head/hunyuan_head_v31.glb` |

Python 脚本先读环境变量，没设就按 `__file__` 推出仓库里的相对路径。仓库里已经没有写死的 `/workspace/yiqifengle/previews/...` 路径了，只剩 `HUNYUAN_GLB` 的默认值。

## 3. 命令顺序
依赖链是 head-r2 → body-r1/r2/r3。body-r* 读的是 `head-r2/head_r2_work_final.blend`（已经提交了，所以可以直接从第 2 步开始）。

```bash
cd art-src/character
# 1)（可选）重建头部：贴图 → build_head → 拼 GLB；最后会把 head_r2_work.blend 复制成 _final
bash head-r2/scripts/run_all.sh
# 2) 重建 body-r2（当前定版候选）：build_body.py（Blender）→ splice_glb.py（e60 静止版和 W2 版）→ raise_hem.py → 眨眼预览变体 previews/blink_*.glb
bash body-r2/scripts/run_all.sh
#    产出 body-r2/chr_b_r5g2_body-r2_TEST.glb、..._walk-v2_TEST.glb、body_r2_work.blend、data/head_prims.npz
# 3) body-r3 WIP：多一步 remap_mid.py（黄裙去掉 .mid 骨）；围裙、腰带、蝴蝶结在 scripts/apron_r3.py 里（被 build_body.py exec）
bash body-r3/scripts/run_all.sh
# 4) 统计（面数、顶点、包体、骨骼、贴图）
python3 body-r2/scripts/stats.py body-r2/chr_b_r5g2_body-r2_TEST.glb
# 5) 穿模检查（7 段 e60 动作 + walk_loop_v2，每 2 帧采样；重叠三角对 + 最小间隙 mm）
(cd body-r2 && "$BLENDER" -b body_r2_work.blend --python scripts/qa_clash.py -- "$W2" data/qa_clash.json)
#    头部：head-r2/scripts/qa_head_clash.py、qa_head_range.py（转头极限）
# 6) 渲染对比用的原始图（e60 / 本轮 / 走路帧 / 坐姿）→ final/raw/
bash body-r2/final/render_r2.sh          # body-r3：bash body-r3/final/render_r3.sh（加 extra 参数补 e60/r2 的额外机位）
# 7) 拼对比图 → previews/*.png（大图，不提交）+ share/*.jpg（<200 KB，提交）
(cd body-r2/final && python3 sheets_r2.py)  # body-r3：sheets_r3.py；头部和 body-r1：final/render_all.sh + final/sheets.py
# 8) 单张渲染：blender -b --python scripts/render.py -- <glb 或 .blend> <输出目录> <shots.json> [动作名 帧]
# --- 云端 cloud/character-model 这一轮（head-hy + body-r4，见 cloud-tasks/RESULT-character-model.md）---
# 9) 混元头部重拓扑：分类 → 贴图 → build_head_hy.py → head-hy/head_hy_work_final.blend（混元 glb 用 env.sh 的 HUNYUAN_GLB）
bash head-hy/scripts/run_all.sh
# 10) body-r4（读 head-hy 的 .blend；T_G2_BODY 在 GLB 里缩到 256²）→ body-r4/chr_b_r5g2_body-r4_TEST.glb、..._walk-v2_TEST.glb
bash body-r4/scripts/run_all.sh
# 11) 穿模：全部 14 段运行时动作 + walk_loop_v2，每帧；表格：qa_table.py --md；另用动画工具包 walk_clipcheck.py 复核
(cd body-r4 && "$BLENDER" -b body_r4_work.blend --python scripts/qa_clash.py -- "$E60" "$W2" data/qa_clash.json 1 && python3 scripts/qa_table.py data/qa_clash.json --md)
# 12) 包体：python3 body-r4/scripts/glb_size.py body-r4/chr_b_r5g2_body-r4_TEST.glb；出图：bash body-r4/final/render_r4.sh && python3 body-r4/final/sheets_r4.py
```
- GLB 导出不走 Blender 的 glTF 导出器：`build_body.py` / `build_head.py` 把新网格按材质分组写进 `data/head_prims.npz`，`splice_glb.py` 只替换 e60 GLB 里对应的 primitive 和图片，其余字节（骨骼、IBM、动作、其他网格）原样保留。所以 28 根骨、IBM、动作都和 e60 逐字节一致。
- 快速自查：`body-r2/scripts/quick.sh [/tmp/q.png]` 输出一张 V12 / 新版 4×3 的拼图。

### 复现测试（2026-10-11，在仓库 worktree 里实际跑过）
- `bash body-r2/scripts/run_all.sh`：两个 TEST GLB 和 3 个 npz 的 sha256 和提交的版本**完全一致**（`97791452…`、`d89ff612…`），也和箱子 previews 里的原件逐字节相同。
- 单张渲染 `B_front`（render.py + final/shots_r2.json）：和箱子原图**逐像素一致**（最大差 0）。
- 只读校验：body-r2 两个 GLB 和 body-r3 WIP GLB 的骨骼名和顺序、IBM（sha256 前 16 位）、材质名、图片名、网格名都和 e60 相同。
- 第一次跑时发现 `previews/` 目录不存在会报错，已在 run_all.sh 里加了 `mkdir -p previews`。

## 4. 硬约束
1. **骨骼**：28 根，名称和顺序如下，绑定矩阵（IBM）不能变：
   `root, hips, spine, chest, neck, head, upper_arm.L, forearm.L, hand.L, upper_arm.R, forearm.R, hand.R, thigh.L, shin.L, foot.L, thigh.R, shin.R, foot.R, skirt.front, skirt.front.low, skirt.front.low.mid, skirt.front.mid, skirt.left, skirt.left.low, skirt.back, skirt.back.low, skirt.right, skirt.right.low`
   总数不能超过 30（Cocos 的 uniform skinning 上限），剩下 2 根留给 `hair.fringe` 和 `hair.back`，由角色动画bot 来加。
2. **名字不变**：网格 `LOD0_G2_APRON / LOD0_G2_BODY / LOD0_G2_BOW / LOD0_G2_DRESS`；材质 `M_G2_APRON / M_G2_FACE / M_G2_HEAD / M_G2_BODY / M_G2_HAIR / M_G2_DRESS`；图片 `T_G2_APRON_512 / T_G2_FACE_1024 / T_G2_HEAD_1024 / T_G2_BODY_1024 / T_G2_DRESS_1024`（名字里的尺寸是历史遗留，实际尺寸见各轮 README，名字不要改）。不新增材质和贴图：新部件都用 `T_G2_FACE` 里的色块，色块位置见 `head-r2/scripts/paint_textures.py`（手固定用 UV (0.80,0.72) 的肤色块，袖褶用 v 0.49–0.52 的黄色渐变条）。
3. **穿模余量**：求解余量 6 mm（动作下最小间隙 ≥ 6 mm）；风效层外扩 3 mm；裙子和围裙两层之间 8–12 mm。
4. **预算**：口径还没定，“新增 ≤ 600 KB”和“角色总共约 600 KB”二选一，请 PM 定。现状：e60 GLB 1945 KB / 30451 三角面；body-r2 1412 KB / 23421（−533 KB，−23%）；body-r3 WIP 1357 KB / 22350。按“总共约 600 KB”算还差约 800 KB，主要在贴图（5 张 jpg 约 300 KB）和 DRESS（9774 三角面没动）。
5. **围裙形状键**：现在没有任何 morph。要做的话只加在 `LOD0_G2_APRON` 上（动画bot 的 anim_meta 里叫 curl / flutter 权重，不进 clip），总量不超过 **36 KB**（这个上限是 PM 给的）。导出设置：只导 POSITION 的 delta（不导形状键的法线和切线），float32，数值为 0 的顶点用 sparse accessor；最多 2 个 key。估算：r3 围裙 282 个顶点 × 12 B ≈ 3.4 KB / key，e60 围裙 656 个顶点 ≈ 7.9 KB / key，都在上限内。注意 `splice_glb.py` 现在**不会写** morph targets，加形状键时要扩展它（primitive.targets + mesh.weights + extras.targetNames），并先确认 Cocos 3.8.8 在微信上能同时跑骨骼和 morph。
6. **眨眼**：同一个网格，只改眼片顶点的 UV 偏移（眼片顶点在 `.blend` 的 `_tag_eyes` 组里）：睁眼 (0,0)、半闭 (0,+0.5)、闭眼 (+0.5,0)。贴图是 `T_G2_FACE` 的眼睛区四宫格。预览变体用 `BLINK=dx,dy NPZ=… build_body.py` 生成（见 run_all.sh），这不是交付物。运行时怎么做（改 UV、换材质的 tilingOffset 或者用 morph）要和 GGbot 一起定。
7. **顶点组只存在 `.blend` 里**：`hair.fringe`（刘海 7 缕，252 个顶点）和 `hair.back`（后发梢 396 个顶点），权重 100% 给 head。GLB 里只有 JOINTS/WEIGHTS，看不到这两个组。以后动画bot 加骨时，从 `head_r2_work_final.blend`（或 body-r*.blend）里按组转权重。另外还有 `_tag_*` 组（`_tag_skull`、`_tag_eyes`、`_tag_legs_r2` 等），只给 QA 和导出用，名字以 `_` 开头的组不会传到权重里。
8. 运行时的 `creator-build-project/assets/.../chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb` **不要覆盖**，定版以后才换（见 §5(c)）。

## 5. 各版本现状
| 版本 | 三角面 | 顶点 | GLB 静止版 | 穿模（walk_loop_v2 最小间隙，要求 ≥ 6 mm） |
|---|---|---|---|---|
| e60（运行时） | 30451 | 19794 | 1945 KB | 袖→围裙 7.8，手→围裙 9.4 |
| head-r2（e60 身体 + 新头） | 26786 | 17211 | 1654 KB | 头部 5628 三角面；领→颅 ≥ 16.8 mm，发梢→领 ≥ 22.8 mm |
| body-r1（头 R2 + 上身 R1） | 22387 | 13237 | 1380 KB | 袖→围裙 7.0，手→围裙 9.1，0 穿插 |
| **body-r2** | **23421** | **13514** | **1412 KB**（walk-v2 版 1428 KB） | 0 穿插，最小 6.8（右手→围裙）。door_reach 第 4 帧右袖→围裙 2.8 mm（15 个三角对）；坐姿的穿插是 e60 就有的 |
| body-r3 WIP | 22350 | 12606 | 1357 KB | walk_v2 0 穿插，袖→围裙 7.3；**walk_loop 手→裙 4.8 mm、围裙→裙 4.3–5.8 mm，不达标** |
| **body-r4 + head-hy**（云端，待验收） | 22576 | 12781 | 1,386,032 B（14 段动作的运行时 GLB 为 2,115,652 B） | 除坐姿 3 段外全部 ≥ 6 mm（最小：door_reach 右袖→围裙 7.2，walk 手→围裙 8.5，围裙→裙 8.2）；头部 5582 三角面。详见 `cloud-tasks/RESULT-character-model.md` |

各部件的三角面（body-r2）：躯干 840、袖 2×1000、围兜 160、肩带 2×48、手 2×448、小腿 2×364、鞋 2×432、头部 5628。详细的逐动作穿模表见 `body-r2/README.md`、`body-r2/data/qa_clash_final.json`、`body-r3/data/qa_clash.json`。

## 6. 待办
### (a) body-r3（从 `body-r3/` 继续：改 `data/params.json` 和 `scripts/apron_r3.py`，然后跑 `run_all.sh`）
| 项 | 现状（WIP） | 验收标准 |
|---|---|---|
| 袖子 | 半径已经往 r1 收回，肩部的鼓包基本去掉了，垂坠和褶皱也减弱了；新加了 `top_flat` 参数，袖山和躯干交界处还有一道圆鼓的折痕 | 宽松顺直地垂下来，肩线平顺没有台阶，只在克夫上方稍微堆一点；前臂是略宽的筒形，不贴手臂；大致在 r1 和 r2 之间、偏 r1；和 V12 正面、侧面同角度同大小并排，轮廓对得上。走路 v2 袖→围裙 ≥ 6 mm |
| 手 | 掌宽收窄，手指加长、弯曲减小，外偏量 `out` 从 0.032 改成 0.016；还没出特写复核 | 放松自然下垂：手指并拢、微弯，手背圆润，不像爪子；每只约 450 三角面；外偏约 1.6 cm；手→围裙、手→裙 ≥ 6 mm（WIP 里 walk_loop 手→裙只有 4.8 mm，**要先解决**） |
| 鞋 | 新的 shoe_rings：鞋头更窄更圆，鞋帮收紧，加了低跟（`heel`）和薄鞋底（`sole_z`）；每只 496 三角面 | 细长的低跟短靴：鞋帮贴着脚踝，靴筒往上略收，鞋头圆而窄，有一道薄鞋底边，颜色往 V12 的红棕色偏；踝关节弯曲时不塌 |
| 围裙 / 腰带 / 蝴蝶结 | `apron_r3.py` 重做了围裙：下摆圆角、10 排横向环线、收进黄裙轮廓以内；加了白腰带；新做了蝴蝶结（两个圈、一个结、两条带 V 形缺口的飘带）；权重从 DRESS 传递过来，前片映射到 .mid 链；DRESS 已经去掉 .mid 骨的权重（`remap_mid.py`） | 下摆在黄裙以内、圆角，和黄裙的间隙 8–12 mm（**WIP 只有 4.3–5.8 mm，不达标**）；8–10 排环线；白腰带和 V12 一致；蝴蝶结不再是勺子形，没有悬在外面的系带；走路时 0 穿插 |
| 对比图 | `body-r3/share/` 01–07（e60 / r2 / r3 / V12）是停工前最后一次的渲染 | 每轮按 §7 出图 |

### (b) 混元头部
- 源文件：`/workspace/yiqifengle/previews/grokbot/hunyuan-head/hunyuan_head_v31.glb`，82,981,176 B（79 MB），sha256 `5187ef317287f8e5acc4689b619d1d1975ec604db19528a1210cd49eceb90fd2`。超过 50 MB，**没有提交**。仓库没有装 git-lfs（`git lfs` 命令不存在），`.gitattributes` 里也没有 LFS 规则。云端要拿到它，有两种办法：① 由 PM 或用户从箱子里把这个文件上传到云端能访问的存储（比如 Google Drive），云端下载后 `export HUNYUAN_GLB=<路径>`；② 仓库启用 LFS 以后再按 LFS 提交（建议，需要 PM 同意，并且 remote 要支持 LFS）。同目录还有混元的预览图 head_front/side/back.png。
- 已经做的评估（`hunyuan-eval/`，没做完）：
  - `inspect_glb.py`：源文件 150 万三角面（下巴以上 109 万），4096² 的 albedo、normal、MR 三张贴图（PNG 分别 18.7 / 6.6 / 12.1 MB），UV 很碎。
  - `classify_faces.py`：按 albedo 分类，头发 48.5 万、帽子 45 万、皮肤 7.2 万面。
  - `render_eval.py`：V12、混元、R2 的正面、侧面、背面、3/4、俯 30° 并排 → `hunyuan-eval/share/01_head_V12_hunyuan_r2.jpg`（灯光模拟 Cocos 岛上主光，Cycles）。
  - `lowpoly_test.py`：只取头部，自动减面到约 5000 面，试了 4 种做法 → `share/02_lowpoly_5k_tests.jpg`：A 减面 + 原 4k 贴图（形状保留得好）；B 减面 + 512² 贴图沿用原 UV（UV 太碎，糊）；C 减面 + 重新展 UV + 烘焙到 512²（620 个 UV 岛，脸上有接缝）；Q QuadriFlow 重拓扑到约 2.2k 四边面 + 512² 烘焙（4446 三角面、109 个 UV 岛，但帽檐和发梢的轮廓碎了）。
  - 初步结论：比例、帽子、发型比 R2 更接近 V12；但脸的五官是烘在贴图上的，减面并降到 512² 以后眼睛会变糊，而且没有眨眼用的眼片 UV。所以不能直接用，要手动重拓扑，眼睛单独做。
- 验收标准：① V12 / 混元 / R2 四个角度（正、侧、背、3/4，再加俯 30°）并排，PM 认可方向；② 头部约 5.6k 三角面（R2 是 5628），脸贴图 512²，并入 `T_G2_FACE` 或 `T_G2_HEAD` 的现有图名；③ 100% 绑到 head 骨（领子附近和 neck 渐变）；④ 拆出 `hair.fringe` 和 `hair.back` 两片，各自有同名顶点组；⑤ 眼片保留 §4.6 的 UV 偏移眨眼方案；⑥ 和立领、帽子接好：领→颅 ≥ 6 mm，俯 30° 机位下帽檐不挡眼睛；⑦ 28 根骨和 IBM 不变；⑧ 包体增量要写明。

### (c) 之后的工作
- 围裙形状键（§4.5，≤ 36 KB）：要扩展 `splice_glb.py`，并和角色动画bot 的 anim_meta curl/flutter 对接。
- 黄裙去掉 .mid 骨权重：body-r3 的 `remap_mid.py` 已经实现了（GLB 和 .blend 都做了），但要等 body-r3 验收后才算数；动画bot 要复核风效动作。
- 坐姿穿模：sit_down / sit_hold / stand_up 下，袖→裙、腿→裙、围裙→裙都有穿插（e60 就有），要在裙子和围裙分层的时候一起解决。
- 定版后替换运行时 GLB 的流程：PM 和用户验收 → 把 TEST GLB 复制成运行时 GLB（文件名不变，保留 `.meta` 的 uuid 和 subMeta）→ 在 Cocos 3.8.8 里确认导入（材质覆盖、动画分段 `.meta` splits 还在）→ 更新 manifest 的 sha256（`tools/test_manifests.cjs`）→ 走 PM 审核合并，不要直接 push int/v1。
- 和角色动画bot 对接：① door_reach 第 4 帧，动画bot 会把右肘外展 2–3°（body-r2 右袖→围裙 2.8 mm；body-r3 WIP 是 6.6 mm）；② body-r2-check：请动画bot 用 body-r2 的 walk-v2 TEST GLB 复核蒙皮（肘、腕、膝、踝的弯折，袖子摆臂时有没有扭成麻花）；③ 以后加 `hair.fringe`、`hair.back` 两根骨，从 .blend 的顶点组转权重。

## 7. 验收方式
每一轮都要出 V12 和新版**同角度、同大小**并排的正面、侧面、背面、3/4、俯 30° 游戏机位对比图（外加该轮重点部位的特写和走路 v2 摆臂极限帧），压缩后放进 `share/`（每张 <200 KB），由项目经理看图验收。同时附穿模表（§3 第 5 步）和包体统计（§3 第 4 步），每一步都先存 `.blend`。

## 8. 没有提交的文件（都在箱子里）
| 路径 | 说明 |
|---|---|
| `/workspace/yiqifengle/previews/grokbot/hunyuan-head/hunyuan_head_v31.glb` | 79 MB，见 §6(b) |
| `/workspace/yiqifengle/previews/角色建模bot/*/previews/`、`*/final/raw/`、`*/raw/` | 渲染出来的大 PNG（可以重新渲染） |
| `/workspace/yiqifengle/previews/角色建模bot/*/*_iter*.blend`、`*_work.blend`、`*.blend1` | 中间轮次的存档（每个约 5–6 MB） |
| `/workspace/yiqifengle/previews/角色建模bot/{head-r1,head-r2,body-r1,body-r3}/*_TEST.glb`、`body-r1/previews/blink_*.glb` | 其他轮次的 TEST GLB（脚本可以重建） |
| `/workspace/yiqifengle/previews/角色建模bot/hunyuan-eval/data/face_comp.npy`（6.0 MB）、`face_class.npy`（1.5 MB） | 评估中间数据（可以重新生成） |
| `/workspace/yiqifengle/previews/角色建模bot/audit-v1/*.png` | 审查原图（share/ 里有压缩版） |
| 草坡电影截图、debb2cfc 围裙参考 | 见 §0 参考图说明 |
