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
- `__worldIntegration.motion()`：驱动状态（片段、相位、淡化、层权重、风、朝向、notes）。

## 6. 本地验证

```bash
export QF_TYPESCRIPT_MODULE=<typescript 路径>
node tools/walk-driver/test_walk_driver.cjs                                   # 默认用 previews/角色动画bot/walk-v1 的 glb + anim_meta
WALK_GLB=<你的 glb> node tools/walk-driver/test_walk_driver.cjs              # 同目录有 anim_meta.json 会一起读
WALK_FLOW_ROOT=<运镜bot-wind 检出> node tools/walk-driver/test_walk_driver.cjs  # 用真实风力通道
```

它跑的是真实的 `FlowReferenceStandin` + `AnimRig` + 真实 `WorldFlow`/路线（60 fps），glb 动画在 JS 里求值（`glb_rig.cjs`），输出 JSON：
滑步（不同速度下脚掌平放区间脚踝的世界位移，新旧时钟对比）、两处衔接的相位连续、转向速度、walkProgress、onFoot 左右和时间、apron 触发、风效层叠加检查（`skirtAngleVsWalkOnlyMaxDeg`、`nonMaskedMaxDeg`、`additiveErrorMaxDeg`）。
要检查你自己的风片段：把 `wind_flutter_loop` / `apron_lift` 放进 glb，在测试里去掉合成层（`makeCharacter({layers:true})` 会追加合成层），或者直接看 `__worldIntegration.motion()`。

## 7. 已知限制 / 给其他人的说明

- 拐角处的脚：身体朝向在转，着地脚跟着绕根节点转，世界里会有几厘米位移（模拟里 24° 拐角最大约 39 mm；直线 ≤3 mm）。根节点必须严格在路径上（镜头约定），所以这里没有用脚做支点；旧代码是一帧跳 20–41°，现在分摊到约 0.2–0.3 s。
- 运镜bot：`toThreshold` 第一段只有 3 mm 且方向和后面相反，WorldFlowCore 里回程转身用的是“第一个距离 >1e-6 的点”，所以她先转到 32°，起步时需要再转 166°。驱动在这种情况下按旧行为直接对齐（`WALK_YAW_SNAP_DEG`）。建议回程转身目标改成“第一个距离 ≥0.05 m 的点”，这样转身就是一次到位的 161°（可以用 `walk_turn_180`）。
- 姿势混合模式（非烘焙）的成本：每帧采样 1 个片段（无淡化、无风）到最多 4 个（淡化中 + 两个风效层），再对约 34 个节点做 slerp。JS 模拟里一次片段求值约 20 µs；Cocos 求值器同一量级，加上 34 个关节的世界矩阵和蒙皮上传。只有一个角色，预计手机上 ≤1 ms/帧，**未在真机测**。烘焙贴图不再使用（省内存）。如果关节数超过 Cocos 的 uniform 上限（30），会改用实时关节贴图，仍然可用。真机上不理想时把 `CHARACTER_POSE_BLEND` 改成 `false` 即可回到烘焙路径。
