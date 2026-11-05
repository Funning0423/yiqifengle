# tip · 起身 COUNT53 program warm（standup-only · 零 TSW）· 2026-11-05

## Tip / feature
- **feature** `6dce6a7b09e47c3b5728acb168919629deb5530c`
- **tip** （本 docs commit；以 `git rev-parse HEAD` / PM handoff 为准）

## 一句话
Funning A/B：`0421cfff` 走路顺、起身仍卡；`067afacf` warmSample+曲线 cull 仍不够。本 tip **不起** TSW 主路径，在角色/起身模块内对 `CC_USE_SKINNING|CC_USE_MORPH|CC_MORPH_TARGET_COUNT53` 做 **分帧 getProgramVariant 预热** + 起身首几帧 MorphDriver 软限流。

## 背景
- feel-control `1.0.202611050247` @ `0421cfff`（无 TSW）：走路流畅，**起身很卡** → 起身与 TSW 解耦
- `1.0.202611050137` @ `067afacf`：standup warmSample N=4 + anim `299afe73` 曲线 52→23 **未**修好真机起身
- Mac setCamera/board=0 = CONTROL_FAIL_NOISE；**禁止**再以该门禁否决/堆 TSW critical·burst
- 勿回退 sea-landing / BalloonTransit / K.s1 / black-fence

## 本 tip 改动
| 文件 | 改动 |
|---|---|
| `region/StandupProgramWarm.ts`（新） | COUNT53 define 袋；synthetic+collect jobs；arm/step/flush；直接 `programLib.getProgramVariant`；**不** import TSW |
| `WorldIntegrationBoot.ts` | bindVisual→arm（坐姿窗分帧）；advanceStep→step(≤2/帧)；warmSampleStandUp 前 flush≤2；起身首 4 帧 morph budget=12 |
| `CharacterMotion.ts` | MorphDriver.apply 可选 `maxCalls`（软限流，不整表清零，EPS 保留） |
| tests | `test_standup_program_warm.cjs` + 扩展 warm-sample / identity |

## 明确不做
- 不改 `TransitionShaderWarm` critical/hold/burst/DIR_LIGHT
- 不接回 `armStandupShaderBurst`
- 不改 BalloonTransit / Board / K.s1 / sea-landing / black-fence
- 不 cull mesh morph target 数（需角色动画/建模 tip；本 tip 可叠）

## 验收
1. 离线：四测 PASS；TSW/board/balloon vs fb74 零 diff
2. Funning 真机：**起身体感不卡**；走路保持流畅
3. **不以** Mac setCamera/board=0 否决；upload=等 PM

## 叠合
可叠角色动画/建模 tip：**真正砍 COUNT53 morph targets**（曲线抽稀已证伪不够）。本 tip 只做 runtime 预热/分帧。
