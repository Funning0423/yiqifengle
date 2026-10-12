# RESULT：停步片段加静止尾巴（walk_stop_bodyL / walk_stop_bodyR）

分支 `cursor/stop-tail-hold-7194` → PR 到 `int/v1`（草稿，未合并）。起点 `int/v1` 022fcad。

## 结论

- **静止保持 0.6 秒**（18 帧 @30 fps）：两个停步片段从 1.466667 s 加长到 **2.066667 s**，最后 0.6 s 姿态完全不变
  （GLB 里 1.4667–2.0667 s 所有通道的采样差 ≤ 5e-9，即浮点误差）。
- **根节点曲线提前静止**：`root_motion.forward_m` / `lateral_m` 在 **1.233333 s** 到达终值并保持到片段末尾，
  根节点静止段共 0.833 s。之所以要比姿态静止更早：未计划停步的测试要求尾巴里还能播出 settle 小步（落地在 1.333 s），
  所以根节点要在这一步落地之前就停住，见下文“为什么根节点 1.233 s 就停”。
- 原来过不了的两项现在都通过：
  1. 岛上到达后的 25.75° 转身融进停步：`folded into walk_stop_bodyL over 0.830 s`，偏航只在停步片段播放期间变化，
     之后才进 idle，不再在 idle 上原地转。
  2. 未计划的走路结束（`stopAtEnd:false`）：`stopTail` 找到静止段，从 **1.2333 s** 进入 `walk_stop_bodyL` 的尾巴，
     根节点漂移 0 m，settle 小步记录一次，然后进 idle；后面跟一个 20° 转身的情况也融进尾巴（0.833 s）。
- 骨骼名字、层级、IBM、网格、材质、贴图都没动（逐字节比较：nodes、skins、IBM accessor、meshes、materials 全部相同）。
  其余 12 个动画逐字节相同，只有两个停步片段变了。
- 滑步阈值、`STANCE_MM=6`、各项允许值、路线时长都没改；运行时 TS 代码没改；测试文件没改。

## 怎么做的

全部走原来的流水线（`art-src/animation/mocap/`），在云端用无界面 Blender 4.5.3 LTS 跑：

1. 先不改代码，完整重跑 `export_clips.py → blender -b -P solve_skirts.py → write_glb.py`（CMU 原始 ASF/AMC 从
   mocap.cs.cmu.edu 下载到 `/tmp/cmu/raw`，没进仓库）。得到的 GLB、`.glb.meta`、`anim_meta.json` 和 int/v1
   **逐字节相同**，说明流水线可复现，后面的差异只来自本次修改。
2. `scripts/clips.py` 的 `build_stop`：
   - 末尾追加 `STOP_HOLD_FRAMES = 18` 帧，重复最后一帧（姿态、世界轨迹、接触、裙子求解的锁定权重、根曲线都一起延长）。
     可用环境变量 `MOCAP_STOP_HOLD` 覆盖。
   - 根曲线从最后一次真实落脚（第 26 帧）开始用 smoothstep 收向终值，在 settle 小步落地前 `STOP_ROOT_SETTLE_LEAD = 3`
     帧（第 37 帧 = 1.2333 s）完全到达终值。**世界空间的动作不变**：根节点提前走完的那几厘米由髋骨的局部平移补回
     （片段中段髋骨局部平移和 int/v1 最多差 63 mm 前后、45 mm 左右；终帧差 0）。
   - `anim_meta` 新增 `hold` 字段（`from_s`、`to_s`、`frames`、`root_settle_s`），`handoff.at_s` 改为新的片段末尾，
     `driver_note` 写明静止时长。
3. `scripts/write_glb.py` + `scripts/glb_clips.py`：保持段的每一帧强制等于保持起点那一帧（裙子求解可能带来极小抖动），
   并在保持起点强制留一个 key，避免减 key 时跨过保持段插值，姿态在容差范围内漂移。其他片段不受影响（逐字节相同）。
4. Cocos `.glb.meta`：两个片段的 `duration`、`splits.to`、`span.to` 改为 2.066667。
5. 压缩档位不变（髋和腿 0.10°、脊柱 0.35°、手臂 0.80°、裙 0.80°、平移 0.4 mm）。动画数据 143,644 B → **144,740 B**
   （预算 150,000 B）；GLB 1,336,456 B → 1,337,760 B。
6. 已跑 `node tools/test_manifests.cjs --write`（更新了 `assets-MANIFEST-SHA256.json`、`text-MANIFEST-SHA256.json`），
   之后再跑一次 `node tools/test_manifests.cjs`：PASS。
7. `qa/run_qa.py` 只重跑了两个停步片段，结果合并进 `art-src/animation/mocap/qa/summary.json`。

风格：没有换动捕源，也没有重新取时间窗。1.4667 s 之前的骨骼旋转和 int/v1 的差 ≤ 0.48°，这是减 key 时选点不同造成的，在原来的压缩容差以内。
保持段是 idle 第 0 帧的姿态（和原来的终帧一样，和 idle 第 0 帧差 0.148°）。

### 为什么根节点 1.233 s 就停

- 驱动的 `stopTail` 从根曲线静止的时刻进入停步片段，并要求后面至少还有 `CROSSFADE_S` = 0.2 s。
  测试还要求这段尾巴里播出 settle 小步（1.333 s 落地），所以根节点必须在 1.333 s 之前就停。
- 越早停，未计划停步进入尾巴时髋骨离根节点越远：在 0.2 s 的交叉淡化里会看到身体往后再往前挪一下。
  1.233 s 时剩下约 3.6 cm 前后、2.9 cm 左右；如果在最后一次落脚后的 0.933 s 就停，会剩 17 cm 左右，太明显。
- 定在第 37 帧（settle 小步落地前 3 帧），而不是第 38 帧：`test_walk_driver.cjs` 的 morph 测试给停步片段配了一条合成的
  curl 曲线 `[[0,.6],[1.5,0]]`。尾巴在 t0 进入时，每帧最大跳变 = 0.4·(t0 + 11/60)/12 + 0.4/60，
  t0 = 1.2667 s 时正好等于上限 0.055（四舍五入到 1.266667 后超出 1e-8，两项 morph 测试失败）。t0 = 1.2333 s 时为 0.0539。
  上限本身没改。

## 测试结果

`tools/walk-driver/test_walk_driver.cjs`（36 项；会一起跑 `test_locomotion.cjs`）：

| | int/v1 022fcad | 本分支 |
|---|---|---|
| 通过 | 32 / 36 | **34 / 36** |
| 岛上 < 45° 转身融进停步 | 失败（`turn-choice ... reason: small turn`） | **通过**（融进停步，0.830 s） |
| 未计划停步的尾巴（stopAtEnd:false） | 失败（`stop-unplanned` 0 次，stopTail 返回 null） | **通过**（从 1.2333 s 进入，根节点漂移 0） |
| 滑步：toDoor 4.198 m / 5.997 s，全程最大 < 12 mm | 失败 16.77 mm（walk_loop） | 失败 **18.00 mm**（walk_loop） |
| 停步变体扫描 3.0–3.7 m，滑步 ≤ 允许值 | 失败 L=3.3：21.24 > 21.23 mm（walk_loop） | 失败 L=3.3：**21.24 > 21.23 mm**（walk_loop，和原来完全一样） |

其他：

- `tools/walk-driver/test_anim_eval_order.cjs`：PASS。
- `tools/camera-frame-test/test_sit_timing.cjs`、`test_turn_targets.cjs`、`tools/test_character_action_clock.cjs`：全部通过（exit 0）。
- `node tools/test_manifests.cjs`：PASS。
- 角色 QA（`qa/run_qa.py`，CLIP_MARGIN 6 mm）停步片段：

| 片段 | 滑步 mm（int/v1 → 新） | 腿-裙余量 mm | 腿/手臂穿布 | 鞋-鞋穿插 | 膝盖支撑期最小角 ° | 衔接：入口 vs walk_loop / 终帧 vs idle |
|---|---|---|---|---|---|---|
| walk_stop_bodyL | 2.41 → **2.37** | 16.2 → 16.2 | 0 / 0 | 0 | 7.0 | 0.352° / 0.148°（不变） |
| walk_stop_bodyR | 2.17 → **2.11** | 20.9 → 20.9 | 0 / 0 | 0 | 6.0 | 1.136° / 0.148°（不变） |

  `arm_in_torso` 总数变大（1243 → 1855、1337 → 1949）只是多了 18 帧的静止袖根接缝带（上一轮 RESULT 里说明过）。
  去掉接缝带的 `arm_in_torso_dyn` 仍然是 0。

## 还没过的项

1. **两项滑步测试仍然失败，原因是 walk_loop 本身，不是停步**：
   - 扫描测试的 L=3.3 m：walk_loop 21.24 mm，允许 21.23 mm。和 int/v1 的数值一模一样，本次修改没有影响它。
   - toDoor 测试要求全程 < 12 mm。从扫描测试的允许值反推，walk_loop 在 rate 1 时自己就漂移约 13.4 mm，
     所以只改停步过不了这一项。测试里也写了“the clip's heel lands slower than the ground ... even rate 1 drifts ~15–17 mm”。
   - toDoor 从 16.77 变成 18.00 mm：停步的根节点更早静止，`walkProfileExtraSeconds` 从 1.206 s 变成 0.972 s，
     这条路线需要的加速变少了（walk_start ×1.15 → ×1.10，stop ×1.15 → ×1.05），walk_loop 支撑窗口落的位置随之变了。
     同一次跑 walk_start 的滑步 11.32 → 9.10 mm，停步片段 9.54 → 11.17 mm（仍 < 12）。
   - 要过这两项，需要改 walk_loop 的落脚（例如脚跟落地时的地面速度），超出本任务范围。阈值和路线时长都没动。
2. **wind_flutter 测试的度量问题（已经出现过）**：`qang(a,b) = 2·acos(|a·b|)` 没有对四元数归一化。idle 第 0 帧的 spine key
   以 float32 存储，|q|² = 1 − 5.96e-8，同一个四元数和自己比也会算出 0.0396°，超过 1e-3 的上限。
   调试过程中有一版停步（尾巴进入得更晚）让一个硬切到 idle 的帧落进了这个测试的 300 帧窗口，于是报错。最终版本不会触发，测试通过。
   以后片段时长再变，这个误报可能再出现。建议在测试里把 `|a·b|` 除以 `|a||b|`（没在本任务里改测试）。
3. **未计划停步进入尾巴时，髋骨相对根节点会有约 4.6 cm 的往返**（3.6 cm 前后 + 2.9 cm 左右）：走路姿势的髋骨在根节点正上方，
   尾巴第 1.2333 s 那一帧的髋骨在根节点后面，然后在 1.2333–1.4667 s 这 0.233 s 里回到根节点上方，大部分和 0.2 s 交叉淡化重叠。
   正常路线全部是计划停步，不走这条路；只有未计划的走路结束才会看到。
4. 预览拼图 `previews/sheet_walk_stop_body{L,R}.jpg` 没有重新生成，1.4667 s 之前的动作不变，拼图只是没有包含新的静止段。

## 复现

```
# Blender 4.5.3 LTS（download.blender.org 被 Cloudflare 拦截，用镜像 mirror.clarkson.edu/blender/release/Blender4.5/）
CMU_DIR=/tmp/cmu/raw art-src/animation/mocap/build_all.sh skip-previews
# 只重建停步：
cd art-src/animation/mocap/scripts
python3 export_clips.py /tmp/mc/out walk_stop_bodyL walk_stop_bodyR
blender -b -P solve_skirts.py -- /tmp/mc/out walk_stop_bodyL walk_stop_bodyR
python3 write_glb.py /tmp/mc/out          # /tmp/mc/out 里要有其余 11 个片段的完整输出
node tools/test_manifests.cjs --write
```

测试需要 TypeScript：`QF_TYPESCRIPT_MODULE=<typescript 包路径> node tools/walk-driver/test_walk_driver.cjs`。

## 卡住的报错（同一报错最多重试 2 次）

- `download.blender.org` 返回 403（Cloudflare）：换镜像，一次解决。
- 第 1 版只在末尾加 0.6 s 保持（根节点 1.4667 s 才静止）：岛上转身通过，未计划停步报 `settle step of the tail [] 0 !== 1`
  （尾巴从 1.4667 s 开始，settle 小步在 1.333 s，已经过去了）。
- 第 2 版根节点在 1.2667 s 静止：未计划停步通过，两项 morph 测试超出上限 1e-8（原因见上文）。
- 第 3 版根节点在 1.2333 s 静止：通过。剩下的两项失败都在 walk_loop，见“还没过的项”。
