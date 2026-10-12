# 走路驱动（walk driver）接口说明 — GGbot

给 角色动画bot：片段怎么命名、`anim_meta.json` 要写哪些字段、风效层怎么叠、怎么在本地验证。
代码：`creator-build-project/assets/scripts/CharacterMotion.ts`（不依赖引擎的核心）+ `WorldIntegrationBoot.ts` 里的
`FlowReferenceStandin`（角色适配器）和 `AnimRig`（Cocos 一侧的采样与混合）。测试：`tools/walk-driver/test_walk_driver.cjs`。

## 1. 驱动在做什么

| 项 | 做法 | 常量（`CharacterMotion.ts`） |
|---|---|---|
| 位置 | 控制器沿路径匀速移动根节点（`pointOnPath(path, elapsed/duration)`，0.7 m/s），片段必须原地（in-place）。 | — |
| 片段时间 | 有 `native_speed_mps` 的片段（`walk_loop` 默认 0.7）按**走过的距离**推进：`Δt_clip = Δs / native_speed`。不移动时（衔接空档）相位冻结，脚不滑。其余片段按时间推进。片段长度读片段本身（`.meta` 的 split），不写死。 | `DEFAULT_NATIVE_SPEED=0.7` |
| 衔接 | 一段走路结束后不立刻切 idle；`WALK_JOIN_GRACE_S` 内来了下一段走路就接着当前相位播（outCrossing→toIsland 隔 0 帧，toThreshold→inCrossing 隔 1 帧）。真正停下时：有 `walk_stop_body{L,R}` 就按**着地的身体脚**选一个，否则淡到 `idle_breathing_loop`。 | `WALK_JOIN_GRACE_S=0.1` |
| 朝向 | 朝向“前方 0.2 m 处的路径点”做阻尼跟随（时间常数 0.12 s），限速 150°/s；拐角不再一帧跳。根节点仍严格在路径上。从静止起步时如果偏差 >100°，按旧行为直接对齐（见 §7）。 | `WALK_YAW_MAX_DEG_S=150` `YAW_TAU_S=0.12` `WALK_YAW_LOOKAHEAD_M=0.2` `WALK_YAW_SNAP_DEG=100` |
| 交叉淡化 | 片段切换 0.2 s 淡入淡出（手动时钟里两套姿势按权重 slerp）。设为 0 关掉。 | `CROSSFADE_S=0.2` |
| 姿势混合开关 | `true`：`useBakedAnimation=false`，驱动自己采样/混合（淡化 + 风效层）。`false`：回到烘焙模式，一次一个片段、硬切、风效层不生效（脚步/围裙事件、walkProgress、转向限速、按距离推进照常）。 | `CHARACTER_POSE_BLEND=true` |

> **烘焙标志必须在女孩进场景之前设好（Mac r4 修复，work/GGbot-animfix）。** Creator 3.8.8 的 `SkeletalAnimationState` 在 `SkeletalAnimation.onLoad` 时创建（animation-component.ts:162-163 → createState :284-288 → initialize），初始化时把当时的 `useBakedAnimation` 记进 `_doNotCreateEval`（skeletal-animation-state.ts:75-76）；之后再 `setUseBaked(false)`（:101-113）虽然重跑 `AnimationState.initialize`，但 evaluator 只在 `!_doNotCreateEval` 时创建（animation-state.ts:370-379），`sample()` 什么骨骼都不写（:546-552），女孩停在 GLB 默认姿势滑行。所以 `mountWorld` 在 `reference.addChild(girl)` 之前就给女孩所有 `SkeletalAnimation` 设 `useBakedAnimation=!CHARACTER_POSE_BLEND`；`AnimRig` 构造时再兜底：任何没有 `_clipEval` 的状态 removeState+createState 重建（记录在 `diagnostics().motion.repairedStates`，`motion.clipEval` 报当前片段状态）。测试：`node tools/walk-driver/test_anim_eval_order.cjs`（按引擎源码转写的 mock + 真实 AnimRig；`--boot <旧 Boot>` 能复现 bug）。真机证据看 T0 `anim:pose-live`。
| `walkProgress()` | 当前这段走路的距离比例 0..1，每段从 0 开始，不在走路时 `null`（`docs/camera/T2-T3a-DELIVERY.md` 的约定）。 | — |
| `onFoot(cb)` | 由走路相位越过事件时间算出（不用 Cocos 片段事件）。返回取消订阅函数。 | — |
| 风 | 每帧读 `WorldFlowComponent.getWindStrength()`（0..1，运镜bot）。驱动 `wind_flutter_loop` 权重和 `apron_lift` 触发。 | `APRON_LIFT_THRESHOLD=0.95` |

## 2. 片段角色名（全部可选，缺了就退回现在的行为）

| 名字 | 用途 | 时钟 | 缺失时 |
|---|---|---|---|
| `walk_loop` | 走路循环（**必需**） | 距离 | 走路动作报错（和以前一样） |
| `walk_start` | 从静止起步，结束前切到 `walk_loop` | 有 `native_speed_mps` 就按距离，否则按时间 | 直接淡入 `walk_loop` |
| `walk_stop_bodyL` / `walk_stop_bodyR` | 停步；按停下那一刻**着地的身体脚**（最后一次脚跟着地事件的 `body`）选 | 时间 | 淡入 idle |
| `walk_turn_90_bodyL` / `walk_turn_90_bodyR` | 原地转身 45°–135°；向她自己的左边转（yaw 增大）用 `bodyL`，向右用 `bodyR`（内侧脚为轴） | 时间（转身动作固定 1.5 s，片段最好也做 1.5 s） | idle + 控制器线性转 |
| `walk_turn_180` | 原地转身 ≥135° | 时间 | 同上 |
| `idle_breathing_loop` | 站立待机（**必需**） | 时间 | — |
| `sit_hold` / `sit_down` / `stand_up` | 坐着 / 坐下 / 站起（**必需**，与现在相同） | 时间 | — |
| `door_reach` | 开门伸手 | 时间 | 跳过（不再报错） |
| `wind_flutter_loop` | 风效层：持续飘动 | 时间（循环） | 不叠 |
| `apron_lift` | 风效层：一次性掀起再落下 | 时间（单次） | 不叠，但 `onApronLift` 照常发 |

## 3. `anim_meta.json`

放在 `bundles/region_island/character/anim_meta.json`（和角色 glb 同目录，作为 JsonAsset 随包）。启动时读一次，读不到或格式不对就用内置默认值（walk-v1 的数值），不会阻塞启动。现有 walk-v1/v2 的 `anim_meta/v1` 字段名可以直接用。

```jsonc
{
  "schema": "anim_meta/v1",
  "clips": {
    "walk_loop": {
      "cycle_duration_s": 1.133333,        // 或 duration_s；和片段实际长度不一致时，事件时间按片段长度等比缩放（diagnostics().motion.notes 会记一条）
      "native_speed_mps": 0.7,             // 按距离推进用；没有就当按时间推进的片段（walk_loop 例外，默认 0.7）
      "loop": true,
      "events": [                          // onFoot 只发 name 以 "foot:" 开头的事件
        {"name": "foot:R", "time_s": 0.0,      "bone": "foot.R", "body": "L"},
        {"name": "foot:L", "time_s": 0.566667, "bone": "foot.L", "body": "R"}
      ],                                   // body 优先；没写 body 时按骨骼名推断（bone L = body R）
      "phases_fraction_of_cycle": {...}    // 驱动不读；测试用它找脚掌平放区间量滑步
    },
    "walk_start": {"handoff": {"next": "walk_loop", "at_s": 0.9, "next_time_s": 0.0}},
                                           // at_s：起步片段播到这里切到 next；next_time_s：从 next 的哪一秒接。默认 at_s = 长度 - 0.2，next_time_s = 0
    "walk_stop_bodyL": {"events": [...]},  // 可以带脚步事件，onFoot 照样发
    "apron_lift": {
      "lift_time_s": 0.30,                 // 掀起那一帧（或 lift_frame + fps）。这一刻发 onApronLift('full', settle - lift)
      "settle_time_s": 1.40,               // 落定那一帧（或 settle_frame + fps）
      "layer": {"mode": "additive", "mask": ["apron*", "skirt*"], "reference_time_s": 0}
    },
    "wind_flutter_loop": {
      "layer": {"mode": "additive", "mask": ["skirt*", "apron*", "hair*"], "reference_time_s": 0}
    }
  },
  "wind": {
    "windToFlutter": [[0,0],[0.04,0.18],[0.15,0.38],[0.5,0.7],[1,1]],  // 风力 -> wind_flutter_loop 权重，分段线性
    "apronLiftThreshold": 0.95,            // apron_lift 触发阈值（只在往上越过时触发一次，风回落到 ≤0.05 才重新上膛）
    "mask": ["skirt*", "apron*", "hair*"], // 风效层默认遮罩（片段自己的 layer.mask 优先）
    "idleGust": {"min_s": 8, "max_s": 14, "duration_s": 4}  // 可选：岛上待机时每隔 8–14 s 自动来一阵软风（onApronLift('soft', 4)）；不写就不自动
  }
}
```

字段别名：`duration`/`nativeSpeed`/`time`/`liftTime`/`settleTime`/顶层 `windToFlutter`/`apronLiftThreshold`/`windMask`/`idleGust` 也认。

### 3.1 `windToFlutter`（字段名就是这个）

`[[风力, 权重], ...]`，按风力排序后分段线性插值，权重夹在 0..1。默认值：风 0 → 0，0.04 → 0.18，**0.15 → 0.38**，0.5 → 0.7，1 → 1。出门跨过门槛时风约 0.1（权重约 0.29），toIsland 开始时 0.15（0.38）：裙摆、围裙边、头发从一出门就轻轻摆，不是只有大风才动。

## 4. 风效层：遮罩 + 叠加（重点：不能破坏防穿模）

- 两层：`wind_flutter_loop`（持续，权重 = `windToFlutter(风力)`，或待机软风的包络）和 `apron_lift`（风力往上越过阈值时从第 0 帧重播，权重 1）。走路层在下面一直播。
- **只影响遮罩里的骨骼**（默认 `skirt*` `apron*` `hair*`，可用名字或带 `*` 的通配）。遮罩外的骨骼完全保持走路姿势（测试里风片段故意也动了 `thigh.L`，结果为 0° 泄漏）。
- **默认是叠加（additive），不是覆盖**：
  `结果旋转 = 走路旋转 × slerp(单位四元数, 参考姿势⁻¹ × 风片段旋转, 权重)`，位置同理加上 `(风片段 − 参考) × 权重`，缩放保持走路的。
  参考姿势 = 风片段在 `reference_time_s`（默认 0，第一帧）的姿势。所以**风片段的第一帧应该是“无风”的中性姿势**，后面的帧只表达相对它的摆动。
  这样走路片段里“大腿/小腿推开裙片”的那部分旋转原样保留，风只是在上面再加一点摆动。
- `layer.mode: "override"` 也支持（slerp(走路, 风片段, 权重)），但会盖掉走路对裙片的推动，**不要用在裙片上**。
- 你那边需要验证：**风效层权重拉满（1.0）叠在走路上**，前片和后片都不能穿腿。测试里有一个合成风片段（±20°）的检查，报告的是“裙片骨骼相对纯走路姿势的角度”，见 §6；它只证明数学是叠加的，真网格穿不穿还得你在 Blender 里用最大摆幅 + 走路逐帧看。
- 摆幅的安全范围由你定：最大权重时，风片段相对第一帧的最大摆角就是叠到走路上的最大偏转。

## 5. 事件与钩子

- `onFoot(cb)`：`{event:'foot:R'|'foot:L', bone:'foot.R'|'foot.L', body:'L'|'R', clip, phase(0..1), time(s), cycle, pos:[x,y,z]}`。在适配器上，也在 `globalThis.__worldIntegration.onFoot`。同时写进 `diagnostics().events`。T0 打点 `GB_MARK anim:foot`。
- `onApronLift(cb)`：`(strength:'full'|'soft', durationSec)`。
  - `'full'`：风力第一次往上越过阈值（出门那段，运镜bot 的风在 14.5 s 左右到 0.95）。有 `apron_lift` 片段时，在片段的 `lift_time_s` 那一帧发，`durationSec = settle − lift`；没有片段时立刻发，`durationSec` 用 meta 的值或 1.2 s。
  - `'soft'`：`apronGust(durationSec=4)`（适配器 / `__worldIntegration.apronGust`），或 `wind.idleGust` 自动触发。走路时不触发。
  - Voice bot 的 `WindAudio` 会自己订阅适配器的 `onApronLift`；只有在 `__voiceWind.snapshot().hooks` 为 0（没订上）时，驱动才直接调 `__voiceWind.notifyApronLift`，不会响两次。T0 打点 `GB_MARK anim:apron-lift`。
- `__worldIntegration.motion()`：驱动状态（片段、相位、淡化、层权重、风、朝向、notes，以及 `morph`）。
- `__worldIntegration.morph()`：围裙形变目标的绑定状态和最近写入的权重，见 §8。

## 6. 本地验证

```bash
export QF_TYPESCRIPT_MODULE=<typescript 路径>
node tools/walk-driver/test_walk_driver.cjs                                   # 默认用 previews/角色动画bot/walk-v1 的 glb + anim_meta
WALK_GLB=<你的 glb> node tools/walk-driver/test_walk_driver.cjs              # 同目录有 anim_meta.json 会一起读
WALK_FLOW_ROOT=<运镜bot-wind 检出> node tools/walk-driver/test_walk_driver.cjs  # 用真实风力通道
```

它跑的是真实的 `FlowReferenceStandin` + `AnimRig` + 真实 `WorldFlow`/路线（60 fps），glb 动画在 JS 里求值（`glb_rig.cjs`），输出 JSON：
滑步（不同速度下脚掌平放区间脚踝的世界位移，新旧时钟对比）、两处衔接的相位连续、转向速度、walkProgress、onFoot 左右和时间、apron 触发、风效层叠加检查（`skirtAngleVsWalkOnlyMaxDeg`、`nonMaskedMaxDeg`、`additiveErrorMaxDeg`）。
形变目标的测试也在这里（`morph:` 开头的几项：淡化连续、只在变化时写、找不到网格不写、无片段时的曲线时间轴、序号映射、烘焙模式）。
要检查你自己的风片段：把 `wind_flutter_loop` / `apron_lift` 放进 glb，在测试里去掉合成层（`makeCharacter({layers:true})` 会追加合成层），或者直接看 `__worldIntegration.motion()`。

## 7. 已知限制 / 给其他人的说明

- 拐角处的脚：身体朝向在转，着地脚跟着绕根节点转，世界里会有几厘米位移（模拟里 24° 拐角最大约 39 mm；直线 ≤3 mm）。根节点必须严格在路径上（镜头约定），所以这里没有用脚做支点；旧代码是一帧跳 20–41°，现在分摊到约 0.2–0.3 s。
- 运镜bot：`toThreshold` 第一段只有 3 mm 且方向和后面相反，WorldFlowCore 里回程转身用的是“第一个距离 >1e-6 的点”，所以她先转到 32°，起步时需要再转 166°。驱动在这种情况下按旧行为直接对齐（`WALK_YAW_SNAP_DEG`）。建议回程转身目标改成“第一个距离 ≥0.05 m 的点”，这样转身就是一次到位的 161°（可以用 `walk_turn_180`）。
- 姿势混合模式（非烘焙）的成本：每帧采样 1 个片段（无淡化、无风）到最多 4 个（淡化中 + 两个风效层），再对约 34 个节点做 slerp。JS 模拟里一次片段求值约 20 µs；Cocos 求值器同一量级，加上 34 个关节的世界矩阵和蒙皮上传。只有一个角色，预计手机上 ≤1 ms/帧，**未在真机测**。烘焙贴图不再使用（省内存）。如果关节数超过 Cocos 的 uniform 上限（30），会改用实时关节贴图，仍然可用。真机上不理想时把 `CHARACTER_POSE_BLEND` 改成 `false` 即可回到烘焙路径。

## 8. 围裙形变目标（morph / blend shape）

围裙 `LOD0_G2_APRON` 带 2 个形变目标：**0 = 掀起时的 S 形卷边（`curl`）**，**1 = 风吹的小抖动（`flutter`）**。
（`curl` / `flutter` 还没做进 glb；现在的 glb 里围裙、裙子、蝴蝶结带的是坐下搭布 `sit_drape` + 空的 `_pad`，按目标名驱动，见 §8.1 多个形变网格。）
权重**只由驱动写**：每帧写完骨骼姿势后，算出每个目标的权重，调 `SkinnedMeshRenderer.setWeight(weight, subMeshIndex, shapeIndex)`。
**动画片段里不要放形变轨道**：烘焙模式根本不播形变轨道；非烘焙模式下 AnimRig 每帧要采样好几个片段（淡化的两个 + 风效层），
最后采样的那个会覆盖前面的，交叉淡化时权重会跳。代码：`CharacterMotion.ts` 的 `morphWeights` / `MorphDriver`，
`FlowReferenceStandin.render()` 里在 `rig.apply(plan)` 之后调用。

### 8.1 `anim_meta.json` 字段

```jsonc
{
  "clips": {
    "apron_lift": {
      "lift_time_s": 0.37, "settle_time_s": 1.4,
      "morph": {
        "mesh": "LOD0_G2_APRON",                       // 可省略，默认 LOD0_G2_APRON
        "curves": {
          "curl":    [[0,0],[0.37,1],[1.2,0.3],[1.6,0]] // [片段秒数, 权重]，分段线性，权重夹在 0..1
        }
      }
    },
    "wind_flutter_loop": {"morph": {"curves": {"flutter": [[0,0.2],[1,0.8],[2,0.2]]}}},
    "walk_loop":         {"morph": {"curves": {"curl": [[0,0.1],[1.133,0.1]]}}}   // 任何片段都可以带，按需
  },
  "wind": {
    "windToMorphFlutter": [[0,0],[0.5,0.3],[1,0.6]]  // 可选：风力 -> flutter 权重（和 windToFlutter 一样的写法）
  },
  "morphTargets": {"curl": 0, "flutter": 1}           // 可选：目标名 -> 形变目标序号；默认就是这个。也可写成 "morph": {"targets": {...}, "mesh": "..."}
}
```

- 曲线时间是**片段自己的秒数**（循环片段取循环内时间）。anim_meta 的 `duration_s` 和片段实际长度不一致时，曲线时间和事件一样等比缩放。
- 目标名就是 `morphTargets` 里的键；曲线里写了不在 `morphTargets` 里的名字会被忽略。
- 主形变网格：`morph.mesh`（顶层）> 第一个写了 `morph.mesh` 的片段 > 默认值（围裙）。
- **多个形变网格**（坐下搭布 `sit_drape`，见下）：`morph.meshes` 列出另外要驱动的网格，写法 `{"网格名": {"目标名": 序号}}` 或 `["网格名", ...]`。
  每个网格一个 `MorphDriver`，**权重按目标名共用**（同一条曲线同时写到裙子、围裙、蝴蝶结上）。
  目标序号优先用网格自己的目标名（glTF `mesh.extras.targetNames`，Cocos 导入后是 `mesh.struct.morph.targetNames`）；
  网格没带名字时才用这里写的序号；顶层写了 `morphTargets` 时一律按 `morphTargets` 的序号（旧行为）。
  片段的 `morph.mesh` 不在这些网格里时，在 `motion().notes` 里记一条，曲线仍按目标名作用在所有网格上。
- 参与计算的目标名 = `morphTargets` 的键 + `morph.meshes` 里写的目标名 + 所有片段曲线里出现的名字；网格没有的目标不写。

```jsonc
"morph": {
  "mesh": "LOD0_G2_APRON",
  "meshes": {"LOD0_G2_DRESS": {"sit_drape": 0, "_pad": 1}, "LOD0_G2_BOW": {"sit_drape": 0, "_pad": 1}}
},
"clips": {
  "sit_down": {"settle_time_s": 0.8667, "morph": {"mesh": "LOD0_G2_DRESS", "curves": {"sit_drape": [[0,0],[0.6,0.4],[1.2,1]]}}},
  "sit_hold": {"morph": {"curves": {"sit_drape": [[0,1],[1.9667,1]]}}},
  "stand_up": {"morph": {"curves": {"sit_drape": [[0,1],[1.2667,0]]}}}
}
```

`sit_drape`：裙子 / 围裙 / 蝴蝶结各一个稀疏位置目标（只有位置差，≤ 20 KB），坐下时 0 → 1，坐着保持 1，起身 1 → 0（实际曲线见 anim_meta）。
`_pad` 是空的第二个目标（Cocos 只有 1 个目标时编号有问题，见 §8.4）。制作脚本和数据：`art-src/animation/sit-drape`，结果：`cloud-tasks/RESULT-sit-drape.md`。

### 8.2 每帧权重怎么算（和姿势同一套权重）

| 部分 | 算法 |
|---|---|
| 底层 | `曲线(当前片段, 当前时间) × (1 − 淡化) + 曲线(淡出片段, 它的时间) × 淡化`，淡化权重就是姿势交叉淡化用的那个（0.2 s）。没写曲线的片段算 0，所以切到 idle 时卷边会跟着姿势在 0.2 s 内淡掉，不会跳。 |
| 风效层 | 对每个层（`wind_flutter_loop`、`apron_lift`）加上 `层权重 × 曲线(层片段, 层时间)`。`apron_lift` 层权重 1，从风力越过阈值那一刻的第 0 帧开始；`wind_flutter_loop` 层权重 = `windToFlutter(风力)`。 |
| 合计 | 底层 + 风效层，再夹到 0..1。 |
| `flutter` 额外规则 | 写了 `windToMorphFlutter` 时：`flutter = max(上面的合计, windToMorphFlutter(风))`。用 **max 不用加**：片段曲线和风力映射同时写也不会叠成两倍；只写其中一个就完全等于那一个。风 = `max(风力, 待机软风包络)`，和 `windToFlutter` 用的是同一个输入。 |

- 曲线建议**首尾都是 0**（尤其 `apron_lift` 的第 0 帧和最后一帧），否则层开始/结束那一帧会有台阶。
- glb 里还没有 `apron_lift` 片段时：`onApronLift` 照旧在越过阈值时立刻发（不变），但 `apron_lift.morph.curves` 仍会从那一刻按自己的时间轴播完（时长 = 曲线最后一个关键帧），方便先只用形变做原型。
- 烘焙模式（`CHARACTER_POSE_BLEND=false`）同样生效：骨骼是硬切，形变权重仍按上表的淡化权重平滑过渡。
- **只在变化时写**：某个目标和上一次写入的值相差 > 1e-3（`MORPH_EPS`），或刚好到 0 / 1 时，才调 `setWeight`；绑定后的第一帧会写一次把状态对齐。网格有多个子网格时，写到每个形变目标数够用的子网格上。

### 8.3 找不到网格时

按节点名（优先）或网格名找 `LOD0_G2_APRON` 的 MeshRenderer（SkinnedMeshRenderer 也是 MeshRenderer）。下列情况**什么都不写**，只记状态，走路/事件照常：

| `morph().status` | 意思 |
|---|---|
| `ok` | 已绑定；`subMeshes` 是会写的子网格，`weights` 是最近一帧的权重，`setWeightCalls` 是累计调用次数 |
| `not-found` | 角色下面没有叫这个名字的 MeshRenderer |
| `morph-disabled` | `enableMorph=false` |
| `no-morph` | 网格没有形变数据（sit-drape 之前 int/v1 的 glb 就是这个状态） |
| `too-few-targets` | 形变目标数 < 需要的数（默认要 2 个；`targetCounts` 给出每个子网格的实际数） |
| `error` / `unbound` | 运行中出错（附 `reason`）/ 还没绑定角色 |

查看：`__worldIntegration.morph()`，或 `__worldIntegration.motion().morph`。顶层字段是主网格（围裙）的状态，`meshes` 列出每个绑定网格的 `mesh / status / reason / targets / setWeightCalls`。T0 启动时的 `GB_MARK device:caps` 也会带上 `apronMorph=` 状态和目标数。

### 8.4 Blender 导出（给 角色建模bot / 角色动画bot）

- 导出 glTF 时：**Shape Keys 开**；**Shape Key Normals 关**、**Shape Key Tangents 关**（只要位置差，包体最小，也和角色 `Tangents=Exclude` 一致）；**Shape Key Animations 关**（形变不进片段，见上）。
- **Apply Modifiers 开**，但要确认形状键能跟着导出（带形状键的网格上不要留会改顶点数的修改器，先应用掉）。
- 形状键顺序就是目标序号：`Basis` 之后第 1 个 = 序号 0（`curl`），第 2 个 = 序号 1（`flutter`）。名字建议就叫 `curl`、`flutter`，`morph().targetNames` 会显示出来方便核对。
- 只做 1 个目标时 Cocos 的形变变体编号会有问题，所以原型直接做 2 个；不够 2 个时驱动报 `too-few-targets` 并且不写。
  `sit_drape` 的网格都带一个空的 `_pad` 作为第 2 个目标（1 个顶点、位移 0，14 字节）。
- 稀疏目标：glTF 允许形变目标用稀疏 accessor（没有 bufferView，只存动过的顶点：uint16 序号 + 3×float32）。Cocos 导入时会展开成完整数组，
  所以包体小，但**运行时内存按完整顶点数算**（裙子 5323 顶点 × 12 字节 ≈ 64 KB / 目标）。
- Cocos 导入：在 glb 的导入设置里把 **Morph Normals 设为 Exclude**（和 Tangents 一样，设完在 `.meta` 里核对实际写进去的数值，不要靠猜）。
- **未在真机测**：形变走贴图（WebGL1 上要 `OES_texture_float` 才用 RGBA32F，否则退到 RGBA8）。T0 的 `GB_MARK device:caps` 会记设备能力，原型出来后在 Mac 开发者工具、iOS 微信和低端安卓上分别看。
