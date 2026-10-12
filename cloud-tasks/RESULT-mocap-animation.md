# RESULT：任务 1 用真人动捕重做角色动作

分支 `cloud/mocap-animation` → PR 到 `int/v1`（未合并）。

## 改了什么

- **13 个片段全部换成 CMU 动捕重定向**：idle_breathing_loop、walk_loop、walk_start、walk_stop_bodyL/R、walk_turn_90_bodyL/R、
  walk_turn_180、walk_turn_180_bodyR、sit_down、sit_hold、stand_up、door_reach。`wind_sway_loop` 不在任务列表里，保持不变。
  来源 trial、时间窗、许可和每段的修改见 `art-src/animation/mocap/SOURCES.md`
  （CMU Graphics Lab Motion Capture Database：可用于商业产品，不得直接转售数据；原始 ASF/AMC 没有进仓库）。
- **运行时资源**（只改资源，没改任何 TS 运行时代码）：
  - `creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb`：
    动画按名字原位替换，动画索引不变。
  - 同目录 `.glb.meta`：时长和 split 更新，`tangents: 1` 不变。
  - `anim_meta.json`：时长、foot 事件、`root_motion`、hand-off、来源和压缩说明。
  - 已跑 `node tools/test_manifests.cjs --write`，没有报告问题。
- **骨骼和材质**：用脚本逐项比较新旧 GLB，34 个节点（名字、层级、rest TRS）完全相同，skin 的 28 个 joint 相同；
  材质 6、贴图 5、图片 5，都和原来一样。
- **工具链**：全部在 `art-src/animation/mocap/` 下，`build_all.sh` 一键重建：
  - `scripts/`：ASF/AMC 读取、重定向到我们的 28 根骨、脚底顶点锁定、裙子 / 围裙 / 手臂避让求解、GLB 写入。
    求解在 headless Blender 4.5 的 `blender -b -P` 里用 BVH 做。
  - `qa/`：角色动画bot 的检查工具，从附件 `uploads/anim-tools.tgz` 复制过来：
    `loco_qa.py`（只改了 walk_loop 长度从 GLB 读取）、`walk_clipcheck.py`、`walk_qa_arms.py`、`r2_check.py`，
    由 `run_qa.py` 统一跑，结果写在 `qa/summary.json`。
  - 压缩：原 `compress/` 的做法是逐通道贪心减 key，加 float32 和 LINEAR。按原容差（腿 0.03°）会超出 150 KB，
    所以 `write_glb.py` 从紧到松逐档搜索，取第一档能装进预算的容差（见下文“动画大小”）。
- **主要处理**：
  - 踝关节沿骨盆轴外移 4 cm。CMU 的髋宽比我们大很多，不移的话两脚落在一条线上、腿会交叉。
  - 脚底顶点锁地。转身时，每个顶点锁在它第一次触地的位置，支撑期内鞋的朝向在摆动期里平滑过渡，落地时不会突然转向。
  - 原地转身里的 1 帧碎步改成至少 7 帧的小步。
  - 髋高度重新拟合。
  - 裙片和手臂逐帧求避让：腿到裙的最近距离目标 9 mm，压缩误差会吃掉几毫米，留余量后仍 ≥ 6 mm。
  - 摆动脚经过支撑脚时抬高，减轻两只鞋相互穿插。
  - door_reach 里不握门把的那只手也参与避让。

## 对比图和视频

都在 `art-src/animation/mocap/previews/`，用的是我们自己模型的渲染，**没有任何电影截图**。

- **视频**（mp4，2×2 布局：上排侧面、下排正面，左旧右新）：
  - `compare_walk_loop.mp4`：根节点按 0.7 m/s 直线前进。
  - `compare_sit_down.mp4`：idle → sit_down → sit_hold。
  - `compare_stand_up.mp4`：sit_hold → stand_up → idle。
  - 坐下 / 起身视频的相机固定在站立位和坐位中间。根节点按驱动的做法在两处之间线性移动，
    新旧片段用同一条根曲线，所以旧片段坐下的位置和新片段不同。坐姿时大腿穿出裙子，见遗留问题第 1 条。
- **关键帧拼图**（每个片段 6 个关键帧；正面 / 侧面 / 四分之三侧 / 背面，每种视角旧一行、新一行）：
  `sheet_<片段名>.jpg`，13 个片段各一张。

文件清单（全部约 3 MB）：

- 视频：`art-src/animation/mocap/previews/compare_walk_loop.mp4`、`art-src/animation/mocap/previews/compare_sit_down.mp4`、`art-src/animation/mocap/previews/compare_stand_up.mp4`
- 拼图：`sheet_walk_loop.jpg`、`sheet_walk_start.jpg`、`sheet_walk_stop_bodyL.jpg`、`sheet_walk_stop_bodyR.jpg`、`sheet_walk_turn_90_bodyL.jpg`、`sheet_walk_turn_90_bodyR.jpg`、`sheet_walk_turn_180.jpg`、`sheet_walk_turn_180_bodyR.jpg`、`sheet_idle_breathing_loop.jpg`、`sheet_sit_hold.jpg`、`sheet_sit_down.jpg`、`sheet_stand_up.jpg`、`sheet_door_reach.jpg`（同一目录）

## GLB 大小和动画大小

| | int/v1（旧） | 本分支 |
|---|---|---|
| GLB 总大小 | 2,115,652 B | **2,067,344 B** |
| 动画数据（全部 14 个片段，含未改的 wind_sway_loop） | 132,392 B | **144,740 B**（预算 150,000 B） |

- 动画在 150 KB 以内。最终容差：髋和腿 0.10°，脊柱 / 胸 / 颈 0.35°，头 / 手臂 / 手 0.80°，裙骨 0.80°，平移 0.4 mm。
  动捕源先做了低通（120 fps 下 gauss σ=4 帧）。
- **GLB 仍然超过 1.5 MB 上限**。超出部分来自网格和贴图（旧文件同样超），不是动画；
  这个任务没有动模型，GLB 反而比原来小 48 KB。

## 穿模 / 脚滑 / 膝盖检查数据

用 `qa/run_qa.py`（角色动画bot 工具，CLIP_MARGIN 6 mm）对旧 GLB（int/v1）和新 GLB 各跑一遍。完整数据在 `art-src/animation/mocap/qa/summary.json`。

表中各列含义：

- 滑步：loco_qa 的 planted slide，即支撑期内触地鞋底顶点的位移，取左右脚的最大值。
- 腿-裙余量：腿顶点到裙子网格的最近距离。
- 腿穿布：腿穿出裙子 / 围裙的顶点数。
- 手臂穿布 / 躯干：手臂进入裙子、围裙或躯干的顶点数。
- 鞋-鞋穿插：两只鞋相交的三角形数。
- 膝盖：支撑期最小角，以及相邻帧之间的最大变化。

| 片段 | 滑步 mm（旧 → 新） | 腿-裙余量 mm | 腿穿布 | 手臂穿布 / 躯干 | 鞋-鞋穿插 | 膝盖 最小角 / 最大单帧变化（°） |
|---|---|---|---|---|---|---|
| `walk_loop` | 3.22 → **3.64** | 8.4 → **13.4** | 0 → **0** | 0 → **0** | 0 → **1045** | 19.5 / 7.4 → **10.0 / 8.5** |
| `walk_start` | 3.28 → **2.43** | 8.6 → **11.4** | 0 → **0** | 0 → **0** | 0 → **1205** | 1.4 / 8.8 → **7.0 / 12.6** |
| `walk_stop_bodyL` | 1.96 → **2.25** | 10.9 → **10.5** | 0 → **0** | 0 → **0** | 0 → **0** | 1.4 / 7.0 → **6.0 / 13.0** |
| `walk_stop_bodyR` | 1.90 → **2.18** | 8.0 → **16.5** | 0 → **0** | 0 → **0** | 0 → **199** | 1.4 / 7.1 → **6.4 / 10.6** |
| `walk_turn_90_bodyL` | 1.13 → **1.92** | 11.8 → **12.0** | 0 → **0** | 0 → **0** | 0 → **0** | 0.2 / 7.7 → **4.7 / 12.4** |
| `walk_turn_90_bodyR` | 1.07 → **1.74** | 12.8 → **11.0** | 0 → **0** | 0 → **0** | 0 → **545** | 0.2 / 7.7 → **7.0 / 17.1** |
| `walk_turn_180` | 1.09 → **1.99** | 10.9 → **10.3** | 0 → **0** | 0 → **0** | 0 → **0** | 1.4 / 15.6 → **7.0 / 13.7** |
| `walk_turn_180_bodyR` | 1.02 → **1.09** | 10.8 → **8.1** | 0 → **0** | 0 → **0** | 0 → **72** | 1.4 / 15.6 → **6.0 / 13.5** |
| `idle_breathing_loop` | 0.00 → **1.59** | 43.4 → **14.3** | 0 → **0** | 0 → **0** | 0 → **0** | 1.4 / 0.0 → **7.0 / 0.3** |
| `sit_hold` | 0.00 → **1.76** | 0.0 → **0.0** | 16770 → **25170** | 13884 → **41189** | 0 → **0** | 84.9 / 0.0 → **100.2 / 0.4** |
| `sit_down` | 596.23 → **2.05** | 0.0 → **0.0** | 3935 → **38767** | 3861 → **14968** | 0 → **0** | 0.8 / 2.4 → **7.0 / 11.5** |
| `stand_up` | —¹ → **1.63** | 0.0 → **0.0** | 3505 → **26380** | 3502 → **32493** | —¹ → **0** | —¹ → **6.4 / 6.6** |
| `door_reach` | 0.00 → **2.11** | 43.4 → **16.5** | 0 → **0** | 449 → **385** | 0 → **0** | 1.4 / 0.0 → **7.0 / 2.7** |

¹ 旧 stand_up 跑 loco_qa 时脚的检查报错（IndexError），只有穿模数据。
旧 sit_down 的 596 mm 不能和新值直接比：loco_qa 把整段（第 0–38 帧）当成一次支撑，测到的是双脚在整段里的总位移，不是每步的滑步。旧 anim_meta 里没有 sit_down 条目，拿不到根位移。

结论：

- **站立和行走类 10 个片段**（walk / start / stop / 4 个转身 / idle / door_reach）：
  - 脚滑全部 ≤ 3.64 mm，满足每步 ≤ 5 mm。
  - 腿-裙余量全部 ≥ 8.1 mm，满足 ≥ 6 mm，腿和裙子 0 穿插。
  - 膝盖没有反折：支撑期最小角 4.7°–10°，均为正值。
- **衔接**（loco_qa handoff）：
  - walk_start 在 1.533 s 之后和 walk_loop 的差 < 0.81°，鞋顶点差 ≤ 0.24 mm。
  - 两个 stop 入口和 walk_loop 的差 ≤ 1.14° / 1.4 mm。
  - stop 和转身的首尾与 idle 第 0 帧的差 ≤ 0.13°，鞋 0 mm。
  - door_reach 首尾和 idle 的差 2.3°（hand.L）。
- **根位移**：`anim_meta.json` 的每个片段都写了 `root_motion`。
  - walk_start / stop：forward_m（stop 还有 lateral_m）逐帧曲线。
  - 转身：yaw_deg 曲线。
  - sit_down / stand_up：在站立根和坐下根之间的 forward_m。
  - walk_loop / idle / sit_hold / door_reach：in-place，有说明。
- **坐姿三段**（sit_down / sit_hold / stand_up）穿模严重，见遗留问题第 1 条。

## 测试

- `node tools/test_manifests.cjs --write`：通过，problems 为空。
- `tools/camera-frame-test/test_sit_timing.cjs`、`test_turn_targets.cjs`、`tools/walk-driver/test_anim_eval_order.cjs`、
  `tools/test_character_action_clock.cjs`：全部通过。
- `tools/walk-driver/test_walk_driver.cjs`：5 项失败，没有改测试。
  - 3 项在 int/v1 上同样失败，与本任务无关：phase continuity、onFoot timing、morph remap。
  - 2 项是新增的：baked fallback 要求 `fe.length>=4`，实际 3；morph missing-mesh 要求 `feet>=3`，实际 2。
    原因是新 walk_loop 的一步从 0.40 m 变成 0.50 m（1.433 s 一个周期、0.7 m/s），同样的测试距离里脚步事件少一个。
    测试里写死了步数，需要跟着新步长改。
- `test_character_interim_display.cjs` 需要 Playwright 浏览器，没跑。

## 遗留问题

1. **坐姿的布料穿模（任务 03）**：sit_down / sit_hold / stand_up 的腿穿布 2.5 万–3.9 万顶点，手臂穿布 1.5 万–4.1 万顶点，
   旧片段本来也穿（sit_hold 腿 1.7 万）。坐下时裙子和围裙的垂坠属于 `cloud-tasks/03-sit-drape.md`，这里没做：
   坐姿片段关掉了裙子近距离余量和手臂避让，只保证脚不滑、膝盖不翻折。
   坐下后手放在腿上，压进了围裙，也要在任务 03 里和垂坠一起处理。
2. **鞋-鞋穿插**：旧片段为 0，新片段在 walk_loop 1045、walk_start 1205、walk_stop_bodyR 199、turn_90_bodyR 545、
   turn_180_bodyR 72 个三角形。
   - 原因：鞋宽约 85 mm，按 CMU 步宽重定向后两踝只相距 53 mm，俯视时两只鞋本来就重叠，摆动脚从支撑脚的鞋头上方经过。
   - 已做：抬高摆动脚（最多 30 mm），穿插减少了 27–71 %（例如 walk_loop 从 1568 降到 1045，turn_180 从 8 降到 0）。
     试过横向推开两只脚，但摆动脚是从支撑脚鞋头的正上方经过，横向推不开，所以只保留了抬高。
   - 彻底解决需要加大步宽（会偏离动捕），或者等任务 02 换鞋型以后重新求解。
3. **膝盖在触地 / 离地边界有小突变**：
   - 位置：walk_loop 右膝离地时（第 20–21 帧，单帧最多 +5.5°），插入的小步起步时，以及落地进入 idle 锁定时。
   - 程度：单帧最大变化 8.5°（walk_loop）到 17.1°（turn_90_bodyR），旧片段 7°–15.6°；loco_qa 的 spike ratio 为 7–30。
   - 没有反折。肉眼在视频里可以看到 walk_loop 离地那一下略快。
4. **door_reach 手臂穿躯干**：手臂进入躯干的顶点 348（旧 449），进入围裙 37。
   握门把那只手按门把位置固定；另一只手的避让角已经到上限 25°，求解器还剩 7 处接触。
5. **腋下袖子和躯干重叠变多**：r2_check 的 sleeve-torso 重叠三角形，站立片段从约 20 增加到 40–67。
   CMU 演员手臂贴身，避让求解把手臂外展了一些，但腋下的袖子网格仍有交叠。walk_clipcheck 的手臂射线检查对这些片段为 0。
6. **GLB 超过 1.5 MB**：2,067,344 B，超出部分来自网格和贴图，属于模型任务（02）。
7. **运行时还没用 `root_motion`**：现在根节点由 controller 驱动（`rootMotion: 'controller-only'`），
   walk_start / walk_stop 的前进速度曲线写进了 anim_meta，但驱动仍按自己的速度移动根节点。
   起步和停步在游戏里可能有少量滑步，需要驱动读 `root_motion.forward_m`（不在本任务允许修改的范围内）。
8. **演员不统一**：walk、start、stop、180° 转身和 idle 都来自 91_29；90° 转身来自 69_16 / 69_18；
   坐下 / 起身来自 113_15，door_reach 来自 15_06。CMU 没有同一女性演员的全套动作，风格上略有差别（见 SOURCES.md）。
9. **两项 walk-driver 测试**写死了旧步长，见上文“测试”。

## 卡住的报错（按“同一报错最多重试 2 次”）

- turn_180_bodyR 腿-裙余量不足：重建后 4.2 mm，加脚抬高后 0.3 mm、3 处穿插。
  - 第 1 次重试：补偿裙子锁定增益，结果 3.7 mm，撤回。
  - 第 2 次重试：转身首尾裙子更快地交还给 idle，结果 **8.1 mm、0 穿插**，已解决。
- 没有因为重试次数用完而卡住的问题。上面的遗留问题都是做了取舍或者超出了本任务范围。

## 复现

```
CMU_DIR=/tmp/cmu/raw art-src/animation/mocap/build_all.sh   # 需要 Blender 4.5、ffmpeg、python3 + numpy + PIL
```

对比图以 `$OLD_REF`（默认 `origin/int/v1`）上的旧 GLB 为基准。
