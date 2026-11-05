# tip · TransitionShaderWarm 默认 OFF（A/B 剥 director_after_draw 周期税）· 2026-11-05

## Tip / feature
- **feature** `8f520d0004ae82b8f06b75b3ef8e6a66616db5e2`
- **tip** `7374aea05646a59f3e31c82cfd7f496d9997b97f`

## 一句话
PM 深挖报告对齐：前五轮「零侵入 TransitionShaderWarm」零改善；流畅基线 `0421cfff` **没有** TSW；live 已是 COUNT16（`e3fbce98`）但 TSW `CRITICAL_CACHE_NEEDLES` 仍要 COUNT53/73 → `needlesMissing()` 永久>0 → `criticalPending` 永不归零 → 每帧 compile（`CRITICAL_PER_FRAME=3`）+ 每10帧 absorb。本 tip 把 `TRANSITION_SHADER_WARM_ENABLED` **默认 false**：关掉 `director_after_draw` 常驻暖机；hold/note/arm API **空转**（BalloonTransit / Board / Sail 不抛）；**保起身**；保留 BalloonTransit/sea-landing 视觉。**本 tip 故意动 TSW——不再「零侵入」；这正是本刀。**

## 成对约束（未拆 · 本 tip 不碰）
| 资产 | 标识 |
|---|---|
| COUNT GLB | content sha **e3fbce98…** |
| formal anim_meta | tip **`6fd22962`** |

## 改动
| 文件 | 改动 |
|---|---|
| `region/TransitionShaderWarm.ts` | `TRANSITION_SHADER_WARM_ENABLED` 默认 false；`setTransitionShaderWarmEnabled`；begin/watch/onFrame/hold/note/arm 闸；OFF 调 `resetTransitionShaderWarm` |
| tests / evidence / identity | 默认 OFF + 手动 ON；TSW 从 LOCK_SAME 剥出（intentional DIFF vs fb74） |
| handoff / NOTES | 本文件 + NOTES 段 |

## 明确不做
- **不**追 setCamera / board=0（CONTROL_FAIL_NOISE）
- **不**拆 e3fbce98 + 6fd22962（COUNT16↔FAT 为失败后 #2）
- **不**叠内容线；**不**传微信；push feature；**upload=等 PM**
- **不**回退 warm/idle/period-heavy/SceneAudioPoll 默认 OFF + Morph GPU 闸（均保留）
- **不**改 BalloonTransit / K.s1 / sea-landing / black-fence 视觉路径（仅 hold/note 空转）

## 已排除（本 tip 保留其 OFF / 闸）
| tip | 结论 |
|---|---|
| StandupProgramWarm 默认 OFF | 非周期主因；起身仍顺 |
| Morph idle-drive 默认 OFF | 非周期主因 |
| PeriodHeavyRefresh 默认 OFF | 非周期主因 |
| SceneAudioPoll 默认 OFF | 非周期主因 |
| Morph GPU 真闸 | 保留 |

## 回滚 API
```js
// 控制台 / DevTools（恢复旧暖机行为）
setTransitionShaderWarmEnabled(true);
beginTransitionShaderWarm();
watchTransitionRoot(/* scene or transition root */);
```
源码：`export let TRANSITION_SHADER_WARM_ENABLED=false` + `setTransitionShaderWarmEnabled(on)`.

## 如何验证默认 OFF
1. 源码：`TRANSITION_SHADER_WARM_ENABLED=false`；`begin`/`watch` 首行 `if(!TRANSITION_SHADER_WARM_ENABLED)return`
2. 离线：`node tools/walk-driver/test_standup_program_warm.cjs` → `transitionShaderWarmDefaultOff/ManualOn/Gates=true`
3. 离线：`node tools/meadow/test_transition_shader_warm.cjs` → 先断言 OFF 不挂 listener，再 ON 跑暖机套件
4. 真机：周期 stutter 对照；起身仍顺；BalloonTransit/sea-landing 视觉仍在；控制台按上节回滚

## 验收读法（Funning / PM）
1. **若周期 stutter 消失 / 明显减轻**：命中 TSW `director_after_draw` + orphan needles → 可再开局部暖机或修 needles 对齐 COUNT16
2. **若周期 stutter 仍在**：TSW 非主因 → 下一刀 **#2 COUNT16↔FAT Morph 对照**（须标明拆对；**回 FAT 更可能伤起身而非消周期 after_draw 税**）
3. **若起身变卡**：本 tip 未碰 Standup/Morph seat；若仍变卡请回报
4. 不以 Mac setCamera/board=0 否决

## 失败后 #2（COUNT16↔FAT）备忘
- 仅当本 tip 周期 stutter **仍在**才做
- 拆对必须标明；默认安全 + kill-switch；保起身
- FAT 更可能伤起身，**不能**指望它消掉本 tip 针对的 after_draw 税

## 叠合
叠在 SceneAudioPoll OFF `761d1bf7` / PeriodHeavy OFF `403462f1` / Morph idle-OFF / warm-OFF / 真 GPU 闸 的 tip 栈之上。
