# tip · 起身 program warm 跟 COUNT16/15（standup-only · 零 TSW）· 2026-11-05

## Tip / feature
- **feature** `1e80b25b5191261173c7a65c954587156fa30e91`
- **tip** （本 docs commit；以 `git rev-parse HEAD` / PM handoff 为准）

## 一句话
体验包 `1.0.202611050458` @ `6bd40657` 已叠 COUNT16/15 GLB + formal anim_meta，但 StandupProgramWarm（`5bde177a`/`6dce6a7b`）仍按 COUNT53 预热。本 follow-up **只改预热袋** → `CC_MORPH_TARGET_COUNT{16|15|3}`（APRON16 / DRESS15 / BODY15 / BOW3），**零侵入** TransitionShaderWarm。

## 宏 / define
| mesh | COUNT | shader 名片段 |
|---|---:|---|
| LOD0_G2_APRON | **16** | `CC_MORPH_TARGET_COUNT16` |
| LOD0_G2_DRESS | **15** | `CC_MORPH_TARGET_COUNT15` |
| LOD0_G2_BODY | **15** | `CC_MORPH_TARGET_COUNT15` |
| LOD0_G2_BOW | **3** | `CC_MORPH_TARGET_COUNT3` |

Define 名仍是 `CC_MORPH_TARGET_COUNT`（数值）；**不再** warm 53/73。

## 改动
| 文件 | 改动 |
|---|---|
| `region/StandupProgramWarm.ts` | 袋改 16/15/3；synthetic+collect；`bagReady`；弃用 COUNT53 强制 |
| `WorldIntegrationBoot.ts` | 注释 + programWarm 默认加 `bagReady`（无逻辑变更） |
| tests / evidence | gate → `standup-program-warm-count16-15` |

## 明确不做
- 不改 `TransitionShaderWarm` / Board / BalloonTransit / K.s1 / sea-landing / black-fence
- 不接 `armStandupShaderBurst`
- 不换 GLB / anim_meta（已在 integrate `6bd40657`）

## 验收
1. 离线：`test_standup_program_warm.cjs` + `test_standup_warm_sample.cjs` PASS；TSW 文件 hash 不变
2. Funning 真机：起身体感；upload=等 PM / Funning 摸完 `1.0.202611050458` 再定
3. 不以 Mac setCamera/board=0 否决

## 叠合
叠在 integrate `6bd40657`（或已含 COUNT16/15 GLB+meta 的 tip）之上；替代仍 warm COUNT53 的 `246c50db`/`6dce6a7b` 行为。
