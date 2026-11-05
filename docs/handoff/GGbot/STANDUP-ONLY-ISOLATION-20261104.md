# tip · 起身卡顿（GGbot runtime · standup-only 隔离）· 2026-11-04

## 一句话
Strategy C = **CONTROL_FAIL_NOISE** 后：停 transition 门禁追逐；本 tip **只**在真正 sit→stand 窗做 `warmSampleStandUp` 短窗预热，**零侵入** TransitionShaderWarm / Board / BalloonTransit / K.s1。

## 背景
- live `1.0.202611031613` @ `fb74d437`；Funning「人物起身最卡」
- 角色动画bot STANDUP-PERF：主因 sit→stand morph 暴涨；runtime 需 warm-sample；勿 AnimRig rebuild；MorphDriver 勿整表清零
- 先前 standup tip（burst / bind 期 warm）砸过 integrate；Strategy A/B 证伪后 Strategy C CONTROL 同日也 FAIL setCamera156/board127 → 门禁噪声

## 本 tip 改动
| 文件 | 改动 |
|---|---|
| `WorldIntegrationBoot.ts` | `warmSampleStandUp`（N=4）；仅 `perform(stand)` 前调用；**无** bindVisual |
| `RegionJourneyAdapter.ts` | lakeside `playNamed('stand_up')` 前 `warmSampleStandUp({restoreMorph:false})` |
| `CharacterMotion.ts` | MorphDriver.apply STANDUP-PERF #4 注释（EPS，无整表清零） |
| tests / evidence | 隔离断言；acceptance=体感 |

## 明确不做
- 不改 `TransitionShaderWarm` / `SkycityBoard*` / `BalloonTransit` / `K.s1` / board reveal / setCamera 路径
- 不引入 `armStandupShaderBurst` / DIR_LIGHT 袋
- 不 cherry-pick `299afe73` anim_meta（可叠；资产归角色动画bot）
- 不以 setCamera/board=0 一票否决；upload=NO

## 验收
1. 离线：三测 PASS；transition/board/balloon vs fb74 零 diff
2. Mac / Funning：看 standup 段帧时与卡顿标记（体感），对照 CONTROL 噪声带即可

## 叠合建议
integrate 时可叠 `299afe73`（`anim/standup-perf-morph`）morph 曲线减负；runtime 本 tip 已隔离。
