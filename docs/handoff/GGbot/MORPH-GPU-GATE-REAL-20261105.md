# tip · MorphDriver 真 GPU 闸门（Cocos watch 拆卸）· 整机不掉帧 + 起身仍顺 · 2026-11-05

## Tip / feature
- **feature** `ad76cf64efe0fc6ed596cb5f7077e7a394c1f78e`
- **tip** `01a9a995a5bcfeb6214b94c2919b10148b220726`

## 一句话根因（相对 `4c668c91` / 体验 `1.0.202611050530`）
上轮 tip 只把 `MeshRenderer.enableMorph=false`，**Cocos Creator 3.8.8 的 setter 仅翻转 `_enableMorph`，不会调用 `_watchMorphInMesh`**。结果：MorphRenderingInstance 仍在、`MorphModel.getMacroPatches` 仍打 `CC_USE_MORPH` + `CC_MORPH_TARGET_COUNT{16|15|3}` —— **flag 关了 GPU 税还在**。微信 STRIP 包上 unit mock「enableMorph===false」PASS 无法证伪。Funning 摸 `050530` 仍整机掉帧，与此一致。

## 成对约束（未拆）
| 资产 | 标识 |
|---|---|
| COUNT GLB | content sha **e3fbce98…** |
| formal anim_meta | tip **`6fd22962`**（APRON16 / DRESS15 / BODY15 / BOW3） |

## 改动
| 文件 | 改动 |
|---|---|
| `CharacterMotion.ts` | `applyRendererMorphGate`：关闸时 `enableMorph=false` → `_watchMorphInMesh()`（或 STRIP 缺 private 时 `mesh=mesh` 公共 setter）→ `model.setMorphRendering(null)` → PSO/`onMacroPatchesChanged`；开闸对称重建。`MorphDriver` 暴露 `gpuGateOn/gateFlips/gatePath/gateHasInstance`；steady all-zero early-return；bind：`enableMorph=false`+有 morph 数据仍 `ok`（闸中 remount） |
| `WorldIntegrationBoot.ts` | `applyMorph` 在 `gateFlips` 递增时 `logEvent({kind:'morph-gpu-gate',...})`（可 grep） |
| `StandupProgramWarm.ts` | **A/B kill switch** `STANDUP_PROGRAM_WARM_ENABLED` / `setStandupProgramWarmEnabled`（false 时 arm/open/step/flush 全 no-op；默认 true，保住起身预热） |
| tests | 断言 watch / setMorphRendering(null) / mesh-reassign / kill switch；`morph-disabled` 用例改为无 morph 数据 |

## 明确不做
- **零侵入** TransitionShaderWarm / Board / BalloonTransit / K.s1 / sea-landing / black-fence
- **不**擅自拆 e3fbce98 + 6fd22962（A/B 剥 FAT 须 PM 明示）
- **upload=等 PM**

## 如何验证 gate（真机 / 微信）
1. 离线：`node tools/walk-driver/test_standup_program_warm.cjs` → `gpuGate.watchTearDown/stripFallback/killSwitch=true`
2. 合入后体验包：坐姿起身走几步 → 日志搜 **`morph-gpu-gate`**（或 autoplay `QF_MORPH_GPU_GATE`）
   - 离开 sit_hold 后 DRESS/BOW：`gpuGateOn=false`，`gatePath`=`watch` 或 `mesh-reassign`，`morphInstance` 空/false
   - BODY 在 idle/walk 可仍 `gpuGateOn=true`（correctives 常活）— **预期**
3. 若永远看不到 flip / `gatePath=flag-only`：STRIP 连 mesh setter 也残了，回报 PM（需引擎侧补丁）

## 若本 tip 合入后仍整机掉帧 → 最短 A/B
1. **优先（本 tip 已带）**：boot 一次 `setStandupProgramWarmEnabled(false)` → **剥 StandupProgramWarm**，保留 COUNT16+meta。对照包内容 = 本 tip + warm OFF。
2. 若 warm OFF 仍掉帧：再开 **剥 COUNT16 → FAT** 对照（须标明拆对；另 tip）。

## 验收
1. 离线 PASS（见 evidence）
2. Funning：整机不掉帧 + 起身仍顺
3. 不以 Mac setCamera/board=0 否决（CONTROL_FAIL_NOISE）

## 叠合
叠在 integrate `6d5a5d1d`（已含 `1e80b25b`+`4c668c91`）之上；**替换**上轮「flag-only enableMorph」行为。
