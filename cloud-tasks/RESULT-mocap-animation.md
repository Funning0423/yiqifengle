# RESULT：任务 1 用真人动捕重做角色动作

分支 `cloud/mocap-animation` → PR 到 `int/v1`（草稿，未合并）。

## 第二轮（验收意见）改了什么

| 验收意见 | 结果 |
|---|---|
| 1) 鞋互相穿插必须消掉 | 已合入 `cloud/character-model`（PR #1，细长短靴），在新模型上重做。重定向步宽从每侧外移 4 cm 加到 **5 cm**。13 段 **鞋-鞋穿插全部为 0**，两鞋最近顶点距离 walk_loop 8.4 mm、walk_start 11.6 mm，其余 ≥ 31 mm。**摆动脚抬高在所有片段里都是 0 mm**，抬脚只留作 < 5 mm 时的保护。 |
| 2) 落地 / 离地那一帧的膝盖突变 ≤ 12°/帧 | 摆动期膝角曲线做限速平滑（支撑帧不动，相邻帧变化 ≤ 10°），再用腿 IK 只调踝的高度来实现。站立和行走类片段 **最大单帧变化 ≤ 10.0°**（上一轮 8.5–17.1°），sit_down 11.5°（双脚着地，没有摆动期，限速不起作用，但已在 12° 以内）。 |
| 3) test_walk_driver.cjs 的步数 | 两处写死的步数改成按 `anim_meta` 的 walk_loop 步长（0.50 m）计算。原来就失败的 3 项没改，报告里标为 `knownFailOnIntV1`。 |
| 4) door_reach 手臂穿躯干 | 去掉袖根接缝带后，手臂进入躯干的顶点数 395（int/v1）→ 0（上一轮）→ **0**；进入围裙 37（上一轮）→ **0**；r2_check 伸手那侧袖子和躯干的三角对 255（上一轮）→ **51**（和 idle 的 47 一样）。握门把那只手一直在门把上（误差 0.0 mm）。**注意**：不去掉接缝带的总数是 1498，比上一轮的 348 高。多出来的全部是新模型的袖根接缝带，idle 不动也有 1836。详见下文“door_reach”。 |

坐姿三段和 GLB 大小按要求没有处理。

## 改了什么（累计）

- **13 个片段全部换成 CMU 动捕重定向**：idle_breathing_loop、walk_loop、walk_start、walk_stop_bodyL/R、walk_turn_90_bodyL/R、
  walk_turn_180、walk_turn_180_bodyR、sit_down、sit_hold、stand_up、door_reach。`wind_sway_loop` 不在任务列表里，保持不变。
  来源 trial、时间窗、许可和每段的修改见 `art-src/animation/mocap/SOURCES.md`
  （CMU Graphics Lab Motion Capture Database：可用于商业产品，不得直接转售数据；原始 ASF/AMC 没有进仓库）。
- **合入 PR #1（`cloud/character-model`）**：merge commit，没有冲突。新增 `art-src/character/**` 和
  `cloud-tasks/RESULT-character-model.md`。
- **运行时资源**（只改资源，没改任何 TS 运行时代码）：
  - `creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb`：
    - **网格、材质、贴图换成 PR #1 的 body-r4**（`art-src/character/body-r4/chr_b_r5g2_body-r4_TEST.glb`）。
    - 13 段动作在新网格上重建，按名字原位替换，动画索引不变。
    - PR #1 的 RESULT 写的是“等验收后再替换运行时 GLB”。这里为了在新模型上做检查，并交付“新模型 + 新动作”，
      已经把它换进运行时。做法和 PR #1 的 `splice_glb.py` 一样：骨骼、IBM、rest 和 int/v1 逐字节相同，只换网格和图片。
      如果 PR #1 不通过，用 int/v1 的 GLB 当底重新跑 `build_all.sh` 就能退回旧模型。
  - 同目录 `.glb.meta`：时长和 split 没变，`tangents: 1` 不变。
  - `anim_meta.json`：时长、foot 事件、`root_motion`、hand-off、来源和压缩说明。walk_loop 的 `step_length_m` = 0.5017。
  - 已跑 `node tools/test_manifests.cjs --write`，没有报告问题。
- **骨骼和材质**：用脚本逐项和 int/v1 比较，34 个节点（名字、层级）完全相同，skin 的 28 个 joint 相同；
  材质 6、贴图 5、图片 5，数量和原来一样。
- **工具链**：全部在 `art-src/animation/mocap/` 下，`build_all.sh` 一键重建：
  - `scripts/`：ASF/AMC 读取、重定向到我们的 28 根骨、脚底顶点锁定、膝盖限速、裙子 / 围裙 / 手臂避让求解、GLB 写入。
    求解在 headless Blender 4.5 的 `blender -b -P` 里用 BVH 做。
  - `qa/`：角色动画bot 的检查工具，从附件 `uploads/anim-tools.tgz` 复制过来，由 `run_qa.py` 统一跑，结果在 `qa/summary.json`：
    - `loco_qa.py`：只改了 walk_loop 长度从 GLB 读取。
    - `walk_clipcheck.py`：本轮加了一个计数 `arm_in_torso_dyn`，原有计数不变，见下文“door_reach”。
    - `walk_qa_arms.py`、`r2_check.py`：没改。
  - `qa/qa_clash_body-r4.json`：PR #1 自己的 `body-r4/scripts/qa_clash.py` 在最终 GLB 上的结果，见下文。
  - 压缩：原 `compress/` 的做法是逐通道贪心减 key，加 float32 和 LINEAR。按原容差（腿 0.03°）会超出 150 KB，
    所以 `write_glb.py` 从紧到松逐档搜索，取第一档能装进预算的容差。
- **主要处理**：
  - **步宽**：踝关节沿骨盆横轴每侧外移 5 cm（`clipbuild.STANCE_WIDEN`，可用 `MOCAP_WIDEN` 覆盖）。
    CMU 的髋宽比我们大很多，不移的话两脚落在一条线上、腿会交叉。
    步宽试验（不抬脚）中两鞋最近距离如下，取 5 cm：
    | 每侧外移 | 4 cm | 5 cm | 6 cm |
    |---|---|---|---|
    | walk_loop | 3.0 mm | 8.4 mm | 26.5 mm |
    | walk_start | 3.0 mm | 15.2 mm | 34.0 mm |
    | 其余片段 | ≥ 18 mm | ≥ 18 mm | ≥ 18 mm |
  - **膝盖限速**（`author_lib.limit_knee_rate`）：支撑帧固定，摆动帧的膝角投影到“相邻帧差 ≤ 10°”的最近曲线；
    新膝角只靠竖直移动踝来达到，摆动脚的水平轨迹和朝向不变，所以不会在地面附近多出滑动。
  - 脚底顶点锁地。转身时，每个顶点锁在它第一次触地的位置，支撑期内鞋的朝向在摆动期里平滑过渡，落地时不会突然转向。
  - 原地转身里的 1 帧碎步改成至少 7 帧的小步；髋高度重新拟合。
  - 裙片和手臂逐帧求避让：腿到裙的最近距离目标 9 mm，压缩误差会吃掉几毫米，留余量后仍 ≥ 6 mm。
  - **新模型的装袖**：腋下袖根那几圈本来就埋在衣身里（PR #1 RESULT 里说明过，静止姿势就是这样）。
    求解器不再拿“离肩关节 < 10 cm 的手臂顶点”和“静止姿势下已经在躯干里的顶点”去测躯干，
    否则手臂会被外展到上限 25°。现在站立片段手臂外展 5–12°。

## door_reach 手臂穿躯干

- 新模型上，`arm_in_torso` 的总数会被袖根接缝带抬高：idle 和 walk_loop 本身就有 1210–1836（int/v1 模型为 0）。
  所以总数在新旧模型之间不能直接比。
- 为此在 `walk_clipcheck.py` 里加了 `arm_in_torso_dyn`：和 `arm_in_torso` 用同样的射线测法，
  只是去掉“离肩关节 < 10 cm 的袖根接缝带”和“静止姿势下已在躯干里的顶点”，统计的是肘、前臂、手进入躯干。
- **伸手那只手的处理**：door_reach 导出门把 IK 的权重 `arm_hold_L`。求解器把这只手的外展乘以 (1 − hold)，
  hold > 0.98 时不求解。效果是伸手前（第 4.5–10 帧）可以外展避开身体，握住门把时外展为 0，掌心不离开门把。
  - 曲线（每 3 帧取一个，单位 °）：5.0, 5.0, 5.1, 4.2, 2.5, 0.7, 0.1, 0, … 0, 0.1, 1.0, 2.5, 4.2, 5.0, 5.0。
  - 握门把期间掌心到门把的误差为 0.0 mm。对照试过“这只手和另一只一样自由求解”，误差最大 5.1 mm，没采用。

| GLB | 手臂进躯干：总数 | 不含袖根接缝带（dyn） | dyn 最深 | 手臂进围裙 | r2_check 袖-躯干三角对 L / R（单帧最大） |
|---|---|---|---|---|---|
| int/v1（旧模型、手 K 动作） | 449 | 395 | 15.5 mm | 0 | 21 / 268 |
| 上一轮（旧模型、动捕） | 348 | 0 | 0 | 37 | 255 / 67 |
| **本轮（body-r4、动捕）** | **1498** | **0** | **0** | **0** | **51 / 61** |

r2_check 的 L / R 按 x 坐标分（L = 她的右侧，即伸手的 bone .L）。int/v1 的手 K 动作是另一侧手臂压进躯干。
本轮 51 / 61 和 idle（47 / 59）基本一样，是静止姿势就有的袖根接缝。

## 对比图和视频

都在 `art-src/animation/mocap/previews/`，本轮全部重新生成（新模型 + 新动作），用的是我们自己模型的渲染，**没有任何电影截图**。

- **视频**（mp4，2×2 布局：上排侧面、下排正面，左旧右新；旧 = int/v1 的模型和手 K 动作）：
  - `compare_walk_loop.mp4`：根节点按 0.7 m/s 直线前进。
  - `compare_sit_down.mp4`：idle → sit_down → sit_hold。
  - `compare_stand_up.mp4`：sit_hold → stand_up → idle。
  - 坐下 / 起身视频的相机固定在站立位和坐位中间。根节点按驱动的做法在两处之间线性移动，
    新旧片段用同一条根曲线，所以旧片段坐下的位置和新片段不同。
- **关键帧拼图**（每个片段 6 个关键帧；正面 / 侧面 / 四分之三侧 / 背面，每种视角旧一行、新一行）：
  `sheet_<片段名>.jpg`，13 个片段各一张。

文件清单（全部约 3 MB）：

- 视频：`art-src/animation/mocap/previews/compare_walk_loop.mp4`、`art-src/animation/mocap/previews/compare_sit_down.mp4`、`art-src/animation/mocap/previews/compare_stand_up.mp4`
- 拼图：`sheet_walk_loop.jpg`、`sheet_walk_start.jpg`、`sheet_walk_stop_bodyL.jpg`、`sheet_walk_stop_bodyR.jpg`、`sheet_walk_turn_90_bodyL.jpg`、`sheet_walk_turn_90_bodyR.jpg`、`sheet_walk_turn_180.jpg`、`sheet_walk_turn_180_bodyR.jpg`、`sheet_idle_breathing_loop.jpg`、`sheet_sit_hold.jpg`、`sheet_sit_down.jpg`、`sheet_stand_up.jpg`、`sheet_door_reach.jpg`（同一目录）

## GLB 大小和动画大小

| | int/v1（旧） | 上一轮 | 本轮 |
|---|---|---|---|
| GLB 总大小 | 2,115,652 B | 2,067,344 B | **1,336,456 B** |
| 动画数据（全部 14 个片段，含未改的 wind_sway_loop） | 132,392 B | 144,740 B | **143,644 B**（预算 150,000 B） |

- 最终容差：髋和腿 0.10°，脊柱 / 胸 / 颈 0.35°，头 / 手臂 / 手 0.80°，裙骨 0.80°，平移 0.4 mm。
  动捕源先做了低通（120 fps 下 gauss σ=4 帧）。
- 换成 body-r4 网格后 GLB 已在 1.5 MB 以内（这一项本轮按要求没有专门处理）。

## 穿模 / 脚滑 / 膝盖检查数据

用 `qa/run_qa.py`（角色动画bot 工具，CLIP_MARGIN 6 mm）跑了三个 GLB：int/v1、上一轮、本轮。本轮完整数据在 `art-src/animation/mocap/qa/summary.json`。

表中各列含义：

- 滑步：loco_qa 的 planted slide，即支撑期内触地鞋底顶点的位移，取左右脚的最大值。
- 腿-裙余量：腿顶点到裙子网格的最近距离。
- 腿穿布：腿穿出裙子 / 围裙的顶点数。
- 手臂穿布 / 躯干：手臂进入裙子、围裙或躯干的顶点数；括号里是把躯干一项换成 `arm_in_torso_dyn`（不含袖根接缝带）的值。
- 鞋-鞋穿插：两只鞋相交的三角形数。
- 膝盖：相邻帧之间的最大变化，以及支撑期最小角。

| 片段 | 滑步 mm（int/v1 → 新） | 腿-裙余量 mm | 腿穿布 | 手臂穿布 / 躯干：总数（不含袖根接缝带） | 鞋-鞋穿插（int/v1 / 上一轮 / 新） | 膝盖最大单帧变化 °（int/v1 / 上一轮 / 新） | 膝盖支撑期最小角 ° |
|---|---|---|---|---|---|---|---|
| `walk_loop` | 3.22 → **2.70** | 8.4 → **9.9** | 0 → **0** | 0 → **1210 (0)** | 0 / 1045 / **0** | 7.4 / 8.5 / **9.7** | 19.5 → **10.9** |
| `walk_start` | 3.28 → **2.22** | 8.6 → **10.2** | 0 → **0** | 0 → **1803 (0)** | 0 / 1205 / **0** | 8.8 / 12.6 / **10.0** | 1.4 → **7.0** |
| `walk_stop_bodyL` | 1.96 → **2.41** | 10.9 → **16.2** | 0 → **0** | 0 → **1243 (0)** | 0 / 0 / **0** | 7.0 / 13.0 / **10.0** | 1.4 → **7.0** |
| `walk_stop_bodyR` | 1.90 → **2.17** | 8.0 → **20.9** | 0 → **0** | 0 → **1337 (0)** | 0 / 199 / **0** | 7.1 / 10.6 / **10.0** | 1.4 → **6.0** |
| `walk_turn_90_bodyL` | 1.13 → **1.85** | 11.8 → **10.5** | 0 → **0** | 0 → **1415 (0)** | 0 / 0 / **0** | 7.7 / 12.4 / **10.0** | 0.2 → **7.0** |
| `walk_turn_90_bodyR` | 1.07 → **2.42** | 12.8 → **16.6** | 0 → **0** | 0 → **1443 (0)** | 0 / 545 / **0** | 7.7 / 17.1 / **10.0** | 0.2 → **7.0** |
| `walk_turn_180` | 1.09 → **2.22** | 10.9 → **8.7** | 0 → **0** | 0 → **1088 (0)** | 0 / 0 / **0** | 15.6 / 13.7 / **10.0** | 1.4 → **7.0** |
| `walk_turn_180_bodyR` | 1.02 → **1.66** | 10.8 → **15.9** | 0 → **0** | 0 → **957 (0)** | 0 / 72 / **0** | 15.6 / 13.5 / **10.0** | 1.4 → **6.2** |
| `idle_breathing_loop` | 0.00 → **1.42** | 43.4 → **33.9** | 0 → **0** | 0 → **1836 (0)** | 0 / 0 / **0** | 0.0 / 0.3 / **0.3** | 1.4 → **7.0** |
| `sit_hold` | 0.00 → **1.68** | 0.0 → **0.0** | 16770 → **36433** | 13884 → **23119 (18523)** | 0 / 0 / **0** | 0.0 / 0.4 / **0.4** | 84.9 → **100.0** |
| `sit_down` | 596.23 → **2.05** | 0.0 → **0.0** | 3935 → **30922** | 3861 → **5855 (3694)** | 0 / 0 / **0** | 2.4 / 11.5 / **11.5** | 0.8 → **7.0** |
| `stand_up` | —¹ → **1.64** | —¹ → **0.0** | —¹ → **21552** | —¹ → **7715 (5709)** | —¹ / 0 / **0** | —¹ / 6.6 / **6.5** | —¹ → **6.5** |
| `door_reach` | 0.00 → **2.16** | 43.4 → **14.1** | 0 → **0** | 449 → **1498 (0)** | 0 / 0 / **0** | 0.0 / 2.7 / **2.7** | 1.4 → **7.0** |

¹ 旧 stand_up 跑 loco_qa 时脚的检查报错（IndexError），这一行不完整。
旧 sit_down 的 596 mm 不能和新值直接比：loco_qa 把整段（第 0–38 帧）当成一次支撑，测到的是双脚在整段里的总位移，不是每步的滑步。

结论：

- **站立和行走类 10 个片段**（walk / start / stop / 4 个转身 / idle / door_reach）：
  - 鞋-鞋穿插全部为 0。
  - 膝盖单帧变化全部 ≤ 10.0°。两个 180° 转身比 int/v1 的手 K 片段低（15.6° → 10.0°）；
    walk_loop、walk_start、两个 stop 和两个 90° 转身仍比手 K 片段（7.0–8.8°）高 1.2–3.0°。
  - 脚滑全部 ≤ 2.70 mm，满足每步 ≤ 5 mm。
  - 腿-裙余量全部 ≥ 8.7 mm，满足 ≥ 6 mm，腿和裙子 0 穿插。
  - 手臂进入布料为 0；去掉袖根接缝带后，手臂进入躯干也为 0。
  - 膝盖没有反折：支撑期最小角 6.0°–10.9°，均为正值。
- **衔接**（loco_qa handoff）：
  - walk_start 在 1.533 s 之后和 walk_loop 的差 < 0.82°，鞋顶点差 ≤ 0.91 mm。
  - 两个 stop 入口和 walk_loop 的差 ≤ 1.14° / 1.76 mm。
  - stop 和转身的首尾与 idle 第 0 帧的差 ≤ 0.15°，鞋 0 mm。
  - door_reach 首尾和 idle 的差 2.3°（hand.L），和上一轮一样。
- **根位移**：`anim_meta.json` 的每个片段都写了 `root_motion`。
  - walk_start / stop：forward_m（stop 还有 lateral_m）逐帧曲线。
  - 转身：yaw_deg 曲线。
  - sit_down / stand_up：在站立根和坐下根之间的 forward_m。
  - walk_loop / idle / sit_hold / door_reach：in-place，有说明。

### PR #1 的 qa_clash（新模型 + 新动作）

PR #1 的 RESULT 要求换上新动作以后再跑一次它的 `body-r4/scripts/qa_clash.py`。已在最终 GLB 上跑过（每 2 帧），
结果在 `art-src/animation/mocap/qa/qa_clash_body-r4.json`：

- 站立和行走类片段：身体 / 衣服之间的穿插三角对为 0。唯一的接触是头部的静态接触：帽子和发壳 4、和刘海 1。
  这些部件都 100% 绑在 head 上，所有片段一样，PR #1 里已说明。
- door_reach：围裙-裙 23 对，见遗留问题第 3 条。
- 间隙低于 PR #1 标准（6 mm；围裙→裙 8 mm）的，见遗留问题第 4 条。

`run_qa.py` 里 r2_check 的 legs-dress 在新模型上 idle 就有约 103 对（各站立片段 104–110），是静止姿势下就有的。
r2_check 是按 body-r2 的部件规则分类的，body-r4 把身体合到了一个 primitive 里，分类不再准确。
qa_clash 用的是 body-r4 的顶点组，结果是 0，以 qa_clash 为准。

## 测试

- `node tools/test_manifests.cjs --write`：通过，没有改动。
- `tools/camera-frame-test/test_sit_timing.cjs`、`test_turn_targets.cjs`、`tools/walk-driver/test_anim_eval_order.cjs`、
  `tools/test_character_action_clock.cjs`：全部通过。
- `tools/walk-driver/test_walk_driver.cjs`：`status FAIL`，`failedKnownOnIntV1: 3`，`failedOther: 0`。
  - 步数：两处原来写死 `fe.length>=4`（2 m）和 `feet>=3`（1.5 m）。
    改成 `round(距离 / 步长) − 1`，步长取 `anim_meta` 里 walk_loop 的 `step_length_m`（0.50 m）。
    - 手 K 的 0.40 m 步长下仍然是 4 和 3，和原来一致。
    - 新步长下是 3 和 2，实际 3 和 2，通过。
  - 原来就失败的 3 项没改，结果里加了 `knownFailOnIntV1: true`：phase continuity、onFoot timing、morph remap。
    用 int/v1 的 GLB 和 anim_meta 跑过同一个测试：同样只有这 3 项失败，其余（包括两处步数检查）通过。
- `tools/camera-frame-test/test_camera_frames.cjs`、`test_door_spill.cjs`：在这台机器上失败，
  原因是没装 `draco3d`（环境 GLB 解码），和角色 GLB 无关。
- `test_character_interim_display.cjs` 需要 Playwright 浏览器，没跑。

## 遗留问题

1. **坐姿的布料穿模（任务 03）**：sit_down / sit_hold / stand_up 的腿穿布 2.2 万–3.6 万顶点，按要求本轮没动。
   坐下时裙子和围裙的垂坠属于 `cloud-tasks/03-sit-drape.md`。坐姿片段关掉了裙子近距离余量和手臂避让，
   只保证脚不滑、膝盖不翻折。
2. **步宽比动捕宽**：每侧外移 5 cm（上一轮 4 cm）。正面看两脚间距比演员略宽，视频里不明显。
3. **door_reach 围裙压进裙子**：t ≈ 1.0–1.25 s 前倾时，髋前方（高 0.79 m）有 2–3 个围裙顶点进入裙子，最深 19.5 mm。
   - walk_clipcheck：dress_out_apron 6、apron_in_dress 36；qa_clash：围裙-裙 23 对。
   - 上一轮旧模型上为 0。本轮裙片曲线和改手臂之前完全一样，所以这是新模型的裙子 / 围裙形状在这个前倾姿势下的问题。
   - 求解器目前只处理腿和手臂对布料，不处理布料对布料，没在本轮范围内处理。
4. **qa_clash 里低于 6 mm 的间隙**（都不是穿插，最小值和所在帧）：
   - 领→颅：walk_turn_90_bodyR 1.1 mm（第 10 帧），walk_stop_bodyR、walk_turn_180_bodyR 3.7 mm，walk_stop_bodyL 4.6 mm。
     旧动作是 21.5–22.7 mm。原因是动捕的头在转身和停步时低头 / 转头更多。
   - 手→裙：walk_loop 3.8 mm（bone .R 那只手，第 26 帧）。手→围裙：walk_start 4.6 mm。
   - 围裙→裙：行走类 4.2–7.2 mm，低于 PR #1 的 8 mm 标准。旧动作是 8.2–11.7 mm。
5. **手离身体的距离**：PR #1 建议 idle 手→裙约 45–50 mm。
   现在求解器为了避开装袖把手臂外展了 5–12°，idle 手→裙 17–26 mm（旧动作约 98 mm），比建议更贴身。
6. **膝盖的 spike ratio**：验收标准是单帧变化，这一项已 ≤ 10°。
   loco_qa 另一个按加速度算的 spike ratio 并没有整体变好：限速在曲线上留下了拐点，例如 walk_stop_bodyL 的 knee_R（bone .R）从 4.7 变成 55.9。
   视频里看不出来。
7. **运行时还没用 `root_motion`**：现在根节点由 controller 驱动（`rootMotion: 'controller-only'`），
   walk_start / walk_stop 的前进速度曲线写进了 anim_meta，但驱动仍按自己的速度移动根节点。
   起步和停步在游戏里可能有少量滑步，需要驱动读 `root_motion.forward_m`（不在本任务允许修改的范围内）。
8. **演员不统一**：walk、start、stop、180° 转身和 idle 都来自 91_29；90° 转身来自 69_16 / 69_18；
   坐下 / 起身来自 113_15，door_reach 来自 15_06。CMU 没有同一女性演员的全套动作，风格上略有差别（见 SOURCES.md）。
9. **walk-driver 原来就失败的 3 项**：phase continuity、onFoot timing、morph remap。按要求只做了标注。

## 卡住的报错（按“同一报错最多重试 2 次”）

- 第一轮：turn_180_bodyR 腿-裙余量不足，第 2 次重试解决（转身首尾裙子更快地交还给 idle）。
- 本轮：
  - 新模型上旧片段直接跑 loco_qa 报错（`min() arg is an empty sequence`：旧的脚底锁定点和新鞋底对不上）。
    在新网格上完整重建后解决。
  - 新模型上求解器把手臂推到 25° 上限（装袖腋下的静态接触）。用“袖根接缝带 + 静止姿势已接触”排除解决。
  - door_reach 伸手那只手：第 1 次让它自由求解，掌心偏离门把 5.1 mm，撤回；第 2 次用门把 IK 权重做遮罩，解决。
- 没有因为重试次数用完而卡住的问题。

## 复现

```
CMU_DIR=/tmp/cmu/raw art-src/animation/mocap/build_all.sh   # 需要 Blender 4.5、ffmpeg、python3 + numpy + PIL
```

- 底模是运行时 GLB（现在是 body-r4）。
- 对比图以 `$OLD_REF`（默认 `origin/int/v1`）上的旧 GLB 为基准。
- qa_clash：`blender -b body_r4_work.blend --python art-src/character/body-r4/scripts/qa_clash.py -- <GLB> <walk_v2_GLB> <out.json> 2`。
  `body_r4_work.blend` 由 `body-r4/scripts/build_body.py` 生成，要在副本目录里跑，因为它会写数据文件。
