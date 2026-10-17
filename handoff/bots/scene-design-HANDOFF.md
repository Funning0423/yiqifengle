# 场景设计部 交接（2026-10-17）

> 统一由 GGbot 按 Funning 的指示推送到 GitHub。**场景设计部自己不推送、不 force、不碰主线。**
> 本文路径都以 `/workspace/wechat-game/` 为根。时间是美东时间（ET）。

## 0. 要带上的目录

| 目录 | 内容 | 说明 |
|---|---|---|
| `product/2026-10-15/` | DESIGN.md 等 | 设计依据 |
| `product/2026-10-16/`（含 `SCENE-ROADMAP.md`） | 路线图 | 设计依据 |
| `product/2026-10-16/gameplay-integration-concepts/` | v3、v4 概念（`v4/THINKING.md`、`v4/C_palm`、`v4/C_palm/_r1`、`v4/scripts`），野餐布 `D_refine`（r1）、`D_refine_r2`、`D_refine_r3`、`D_refine_r3b` | r3b 和 C_palm r2 还会往里面写文件，见 §3 |
| `product/2026-10-17/rainbow-bridge/` | 彩虹桥概念，`engine-draft/`、`export/`、`qa/`、`renders/`、`scripts/`、`skycity-B/`（含 `r2/`、`r2/scripts/`、`r2/deps/skycity_decoded.glb`） | 天空之城 B r2 的脚本已复制到 `skycity-B/r2/scripts/` |
| `product/2026-10-17/bamboo-raft-S2/` | 竹排 S2 的**快照**，从 `art/regions/bamboo-raft/` 复制而来（CONCEPT.md、blend、models、renders、scripts），另含 `_deps/region-export/`（导出和检查工具） | 原目录还在被管线 pid 202902 使用，没有移动。管线跑完后要再同步一次（§3） |
| `product/team/scene/HANDOFF.md` | 本文 | |

- 没有大于 50 MB 的文件，最大的也不到 20 MB。
- 三个目录的大小：2026-10-16 约 100 MB，rainbow-bridge 约 50 MB，bamboo-raft-S2 约 43 MB。

## 1. 代码分支

- **这次的彩虹桥和天空之城 B 没有代码分支。** 产物只有概念、文档和草稿，都在 `product/` 里。
  - `engine-draft/RainbowBridgeMesh.ts` 和两个 `.effect` 是给 GGbot 的草稿，没有进 yiqifengle 仓库。
  - 引擎里的实现是 GGbot 自己做的，在 `ggbot/build05-r5-rainbow-bridge`（fb37a67），归 GGbot，不归场景设计部。
- 仓库里原来就有场景设计部的本地分支，都没有推送，`git branch -r --contains` 查不到：

| 分支 | SHA | 内容 |
|---|---|---|
| `scene-design/export-fix` | b9f04f7632fd3fb36101386338a47c9832abb160 | 通用区域导出器跳过 ASSETS 模板和隐藏物体；lakeside r5h3 transforms 重新导出（581 = 431 场景 + 150 棋盘动态）。基于 09a1b8e，包含 Voice Bot 的 lakeside L1–L5 |
| `scene-design/bamboo-s2` | b9f04f7（同上） | 给竹排 S2 预留的分支，还没有 S2 的提交 |

- 两个 worktree（`work/scene-design-export-fix`、`work/scene-design-bamboo-s2`）都是干净的。yiqifengle 主工作区（`integration/build05-a3b-…`）里没提交的改动只有测试报告，不是场景设计部的，没有动。
- 天空之城 B 的验算依赖运镜bot 的 worktree：`/workspace/tmp-lkcam/wt-r4`，分支 `cine/region-hooks-meadow-r4.1-on-260ea02`，0ea1564。

## 2. 各方案状态

| 方案 | 状态 | 主要文件 | 没做完的 |
|---|---|---|---|
| **彩虹桥（概念）** | **已验收**（Grok Bot）。引擎实现等 GGbot | `rainbow-bridge/IMPLEMENTATION.md` §0–7、日夜图 `rainbow_bridge_{day,night}_720x1280.png`、`rainbow_bridge_ends_closeup.jpg`、`rainbow_bridge_current_vs_new.jpg`、`qa/rainbow_bridge_closeup_QA.jpg`、`engine-draft/`、`export/*.glb` | GGbot 实现时按验收意见改：拱形改 sin²；桥面的 alpha 和饱和度明显调低；白横线去掉或做到极淡；夜间不能过曝 |
| **天空之城 B r2** | **已交付，等运镜bot / GGbot 回复（未验收）** | `rainbow-bridge/IMPLEMENTATION.md` §8（r1 标为作废 §8.R1）、`skycity-B/skycity_B_board_camera_verify_r2.jpg`、`skycity-B/r2/`（centerline_world.json、slope_profile.json/.png、obstacles_bbox.json、_eval_12_15_30_45.json 推荐 A、_eval_12_15_28_45.json 备选 B）、`skycity-B/DONE_r2` | 运镜bot 选 A 还是 B；旅途镜头没渲染，城底沉进山谷是否可见还没确认；草坡网格只给了数据 |
| 野餐布 D r1（`D_refine`）/ r2 | r2 的**方向已认可** | `gameplay-integration-concepts/D_refine*/`（README、qa.txt、概念图、遮棋图、格子标注图） | — |
| 野餐布 D r3 | **扣下，没有交付** | `D_refine_r3/` | 不要发出去 |
| 野餐布 D r3b | **进行中**（另一个任务在跑） | `D_refine_r3b/`（scripts/status.txt、runD.sh） | 等它写出 `D_refine_r3b/DONE` |
| C_palm（老铆掌心）r1 | **自检没过** | `v4/C_palm/_r1/`、`v4/C_palm/qa.txt`（R2、R3、R4 是 ⚠，R5 是 ✘：云影落进第 6 列第 3–4 行） | 由 r2 修 |
| C_palm r2 | **排队中** | 产出会写到 `v4/C_palm/` | 见 §3 |
| B 积雪木格露台、A 林中小站月台、N1 磨坊方格菜园 | **还没开始** | `v4/THINKING.md`；`v4/{A_platform,B_deck,N1_garden}/` 是空目录 | 要等 C_palm r2 之后 |
| 竹排 S2 | **建模完成，导出管线在排队** | `art/regions/bamboo-raft/`（快照在 `product/2026-10-17/bamboo-raft-S2/`）：CONCEPT.md、blend/bamboo_s2.blend、renders/s2/s2_preview_720x1280.png、scripts/build_s2.py、s2_pipeline*.sh、slim_glb.py | 模板导出、slim、transforms 导出、check_region_export 都还没跑，`models/` 还是空的。实测 S2 场景 25,948 面，239 个实例，35 个模板 |

## 3. 后台进程和续跑方法

当前排队顺序：**D_refine_r3b → C_palm r2 →（v4/DONE）→ 竹排 S2 导出**。同一时间只能有 1 个 Blender 进程。**不要打断这些进程，也不要自己另开 Blender。**

| pid | 进程 | 在等什么 | 跑完的标志 |
|---|---|---|---|
| D_refine_r3b 那个任务自己的 Blender 或 runD.sh（pid 会变） | `D_refine_r3b/scripts/runD.sh`、`d_r3b.py` | 它自己的测试轮已经跑完，status.txt 里最后一行是 test 21:46:19（box 时钟），还没出 DONE | `D_refine_r3b/DONE` |
| 407784 | `v4/scripts/run_dir.sh C_palm C_palm.py "v4 C 老铆掌心 r2" …/D_refine_r3b/DONE` | 等 `D_refine_r3b/DONE` 出现，再等 120 s 没有 Blender | `v4/scripts/status.txt` 里出现 `C_palm RENDERED`；结果在 `v4/C_palm/` |
| 202902 | `art/regions/bamboo-raft/scripts/s2_pipeline_resume.sh` | `D_refine/DONE` 已经看到了；**还在等 `v4/DONE`** | `renders/s2/pipeline.log` 里出现 `PIPELINE_DONE` |

- ⚠ **现在没有任何脚本会自动写 `v4/DONE`**，`run_dir.sh` 不写这个文件。C_palm r2 渲完、自检过了以后，需要 v4 的负责人手动 `touch product/2026-10-16/gameplay-integration-concepts/v4/DONE`，S2 管线才会接着跑。
- 如果进程死了，续跑方法：
  - C_palm r2：`cd product/2026-10-16/gameplay-integration-concepts/v4/scripts && nohup ./run_dir.sh C_palm C_palm.py "v4 C 老铆掌心 r2" <等待文件> &`
  - 竹排 S2：`cd art/regions/bamboo-raft && nohup bash scripts/s2_pipeline_resume.sh &`。它会先删掉 `models/*.glb` 再重新导出。跑完后把 `art/regions/bamboo-raft/` 再同步一份到 `product/2026-10-17/bamboo-raft-S2/`（`cp -a`），`_deps` 不用动。
  - 天空之城 B r2 重算（只用 node，不需要 Blender）：`cd product/2026-10-17/rainbow-bridge/scripts && QF_TYPESCRIPT_MODULE=/workspace/tools/gltfpack/node_modules/typescript WRITE=1 node sky_b2.cjs 12 15 30 45 full`。验证图要用 Blender：`gate_sky_r2.sh` 会等到没有 Blender 进程时才开始，然后跑 `compose_sky_r2.py`。
    - 依赖 `/workspace/tmp-lkcam/wt-r4`（运镜bot 的 r4 harness）和解码过的 GLB `work/b05an/dec/skycity.glb`。GLB 已经备份到 `skycity-B/r2/deps/skycity_decoded.glb`。

## 4. 验收标准（所有场景都要满足）

**v4 棋盘融合 R1–R6**（`v4/THINKING.md`）：
- R1 本来就在：不提"游戏"，这个东西也说得通它为什么在故事里。
- R2 地面连续：载体周围的地面至少有 3 条边延伸出画面。
- R3 格子是物件自己的纹理：格子来自接缝、格纹、田埂或板缝，不额外画框，不画金线。
- R4 前景压边：底部 ≥100 px 有前景，至少 2 处跨过棋盘边；左右两侧各有 1–2 处跨边；跨边只能盖住格子外缘，不能盖住棋子中心。
- R5 同一套光：棋盘和场景共用太阳、接触阴影和色温，**大块投影不能落进格子**。
- R6 遮棋测试：遮掉棋子以后还是一张风景画。每个方向都要另交一张遮棋版。
- 出图：每个方向交 720×1280 概念图、遮棋版、格子尺寸标注版，再加一张总览和近景验收图。镜头沿用 v3：55° 俯角，屏幕方格反投影。

**通用硬指标**：
- 格子 ≥ 88 px，接近正方形（7 列 × 88 px = 616 px）。
- 场景大约 ≤ 45k 面。
- 分包 ≤ 1.0 MiB（C_palm 目标 ≤ 0.8 MiB）。用 gltfpack `-cc` 实测；位置误差过大时改用 `-cc -noq`。
- **棋子必须是立体的，不能是扁平的。**
- 消除效果要跑出棋盘、进入场景。
- **Funning 的红线**：
  - 不加雾，不加可见的光柱或体积光（他觉得假）。
  - 颜色饱和，不能发白。
  - 要有具体的结构和细节，不能只是"一块填了颜色的形状"。
  - 造型原创，不照搬吉卜力，只用免费工具。

**彩虹桥硬性要求**：
- 桥面有厚度、侧面和边缘，略微拱起（sin²）。
- 半透明，微微发光，有流光或粒子；验收时要求 alpha 和饱和度再调低。
- 夜间好看，不过曝，不能是纯色条带。
- 两端在地面上渐隐，或者化成光点和花瓣，和小路、草地之间有渐变过渡。不能有硬断口，不能插进地面，不能有 z-fighting。
- 低多边形，同一画面约 4 DC（最多 7–8），新增包体 < 35 KB（实测端帽每处 5–6 KB）。

**天空之城 B r2 关键数字**（推荐 A；详见 IMPLEMENTATION.md §8）：
- 约束：坡度 ≤ 35°（实际最陡 30°）；俯仰 ≤ 约 5°/s（实际 4.99°/s）；比 Build05（42.865 m）最多 +6 s，实际 7 种竖屏最多 +4.59 s（390×520）。
- 停点：离 UI ≥ 13 pt，按 260ea02 的提示牌、托盘、道具栏算；实际最小 13.3 pt（360×780）。
- 草地出口抬高 1.719 m。
- 桥：起点 [−0.960, 3.568, 49.278]，朝向 24.26°；终点 [12.254, 13.849, 68.405]，朝向 45°；单向左弯，R 64.5 m；平面 23.36 m，弧长 25.83 m。
- 城：yaw 208.301°，偏移 [40.172, 14.099, 106.753]。
- 旅途副本要隐藏 floatingrocks_1 和 floatingrocks_cards_1。
- 断桥只显示 `state_bridge_after`，两个状态都保留在 GLB 里。
- O4 入口：local [6.4, −0.25, 47]。
- 镜头通道：她右后方 1.1 m 内畅通。

## 5. 敏感信息检查（2026-10-17）

- 用 rg 扫了 `product/` 全部文本，查了这些模式：AWS AKIA、GitHub ghp_/github_pat_/gh*_、sk-、Slack xox*-、Google AIza、PRIVATE KEY、api_key/secret/token/password=…、JWT、邮箱、手机号、微信 appid/AppSecret、SAND_ 变量，以及 .env/.pem/.key/id_rsa 文件。**一条都没有命中。**
- 文档里只出现了项目负责人的名字 "Funning"，没有联系方式。
- 二进制文件（png/jpg/glb/blend）没有逐字节扫描。
