# 【重点标记】ROOT HIT · 周期整机掉帧 = TransitionShaderWarm

**状态：已确认。Funning 2026-11-05 ~08:32 America/New_York：「不卡了」。不要再查这条根因。不要把 `TRANSITION_SHADER_WARM_ENABLED` 默认改回 ON。**

优先级：Funning 明确要求记住，并在 GitHub 留永久笔记。本文只记结论与证据。不改玩法代码，不翻转 TSW 默认值。

游戏：微信小游戏《咦，起风了》。AppID `wx3bdd911c5c06f591`。

---

## 1. 已确认结论

手机上的**周期整机掉帧 / 周期卡**（standup 起身动画仍然顺）的根因是 `TransitionShaderWarm`（TSW）。

Live 构建里 `TRANSITION_SHADER_WARM_ENABLED` 为 **ON**，`director_after_draw` 每帧都在跑。流畅基线 tip `0421cfff` **没有** TSW。COUNT16 瘦包在线之后，warm 的 `CRITICAL_CACHE_NEEDLES` 仍在等 `CC_MORPH_TARGET_COUNT53` / `COUNT73`。这两根针在设备上几乎不可能再出现 → `needlesMissing()` 永远 > 0 → `criticalPending()` 永不归零 → `onFrame` 的早退永不命中 → 过渡结束后仍每帧最多 `CRITICAL_PER_FRAME=3` 次 compile，并且每 `SCAN_EVERY=10` 帧 `absorb()` 整树扫描。这是整机 after_draw 税，所以 UI 一起卡，起身路径本身可以仍然顺。

默认改为 `TRANSITION_SHADER_WARM_ENABLED=false` 之后，Funning 体感 stutter 消失。命中。

---

## 2. 症状

- 手机上周期整机 stutter / 掉帧（周期掉帧）。
- 起身动画保持顺滑。这把根因从 standup 动画路径上拆开。
- 对照：早期 feel-control `0421cfff`（无 TSW）是「除起身外稳定高帧 / 走路很流畅，起身很卡」。

---

## 3. 命中试验

| 项 | 值 |
|----|----|
| 体验版 | `1.0.202611050759` |
| 上传说明 | `gbt/r5-b20-integrate-landing-visual-bg2@dc248d14-transition-shader-warm-off` |
| AppID | `wx3bdd911c5c06f591` |
| Integrate tip | `dc248d14869750e64a3e086e5877c395c353a492`（短 `dc248d14`） |
| 提交说明 | `fix(perf): default TransitionShaderWarm OFF for period-stutter A/B` |
| Feature 源 | `8f520d0004ae82b8f06b75b3ef8e6a66616db5e2`（短 `8f520d00`） |
| 叠在 | SceneAudioPoll-OFF integrate tip `324e50b13641d37bcc6c8e5e8ce5bd139f5a7b88`（短 `324e50b1`） |
| 分支 | `gbt/r5-b20-integrate-landing-visual-bg2` |
| Funning | 2026-11-05 ~08:32 America/New_York：「不卡了」— stutter 消失 |
| 上传时刻 | 2026-11-05 07:59 America/New_York（体验版；正式版未发） |
| 包体 | 约 22.4 MB（`total_bytes` 23495124）；`STRIP_PROBES=1`；`FORMAL_RELEASE=0` |
| 在线角色对 | GLB sha256 `e3fbce98135e6370e901dc4eac04d6d531f07aad3ba4b9a0e0db81ee5291eb86`（COUNT16/15/3）+ anim_meta tip `6fd22962`。成对未拆。 |

同包仍保持的其它默认 OFF（本命中没有把它们打开）：

- `STANDUP_PROGRAM_WARM_ENABLED=false`
- `MORPH_IDLE_DRIVE_ENABLED=false`
- `PERIOD_HEAVY_REFRESH_ENABLED=false`
- `SCENE_AUDIO_POLL_ENABLED=false`

源码闸（`creator-build-project/assets/scripts/region/TransitionShaderWarm.ts`，本笔记不改这个文件）：

- `export let TRANSITION_SHADER_WARM_ENABLED=false`
- OFF 时 `beginTransitionShaderWarm` 不挂 `director.on`
- `watchTransitionRoot` / `noteTransitionSailFrame` / `noteTransitionHeavyFrames` / `holdTransitionShaders` / `armTransitionHold` / `onFrame` 在 OFF 时空转
- BalloonTransit / Board / Sail / sea-landing 的 hold/note 调用不抛；视觉保留

---

## 4. A/B（先失败，再命中）

先前几刀都明文「零侵入 TransitionShaderWarm」，所以对周期卡是结构性零改善。Funning 体感不变 = 非主因。

| 体验版 | tip | 闸 | Funning |
|--------|-----|----|---------|
| `1.0.202611050621` | `c6725112` | `STANDUP_PROGRAM_WARM_ENABLED=false` | 周期卡仍在；起身顺 |
| `1.0.202611050645` | `6954a20b` | `MORPH_IDLE_DRIVE_ENABLED=false` | 一样 |
| `1.0.202611050717` | `f2b89b7c` | `PERIOD_HEAVY_REFRESH_ENABLED=false` | 一样 |
| `1.0.202611050734` | `324e50b1` | `SCENE_AUDIO_POLL_ENABLED=false` | 一样 |
| **`1.0.202611050759`** | **`dc248d14`** | **`TRANSITION_SHADER_WARM_ENABLED=false`** | **「不卡了」— ROOT HIT** |

读法：周期 stutter 与起身预热 / Morph idle-drive / orbit·sector·markers·5s tick / SceneMusic·Landmark 轮询解耦。关掉 TSW 的 after_draw 之后消失。

流畅分界（脚本面，诊断时相对 `0421cfff..324e50b1`）：

| 文件 | 相对 `0421cfff` | 命中前默认 |
|------|-----------------|------------|
| `region/TransitionShaderWarm.ts` | 新增；boot 即 `director_after_draw` | **ON，无 kill-switch** |
| `region/StandupProgramWarm.ts` | 新增 | OFF（已排除） |
| `region/PeriodHeavyRefresh.ts` | 新增闸 | OFF（已排除） |
| `audio/SceneAudioPoll.ts` | 新增闸 | OFF（已排除） |
| Morph idle-drive | 闸 | OFF（已排除） |

`2672b080+` 引入 TSW + live-cache 全袋。文件头注释已自证旧史：`criticalPending 300–680 forever and every frame recompiled`。COUNT16 叠入后，orphan needle 把「难 cache」升级成「结构上不可能 cache 完」。

---

## 5. 根因机制（已由体感关闭）

源码：`creator-build-project/assets/scripts/region/TransitionShaderWarm.ts`。

```text
CRITICAL_CACHE_NEEDLES 含
  CC_MORPH_TARGET_COUNT53, COUNT16, COUNT3, COUNT73, CC_MORPH_PRECOMPUTED1, …
needlesMissing()   cachedNames 里找不到 needle 则 +1
criticalPending()  needlesMissing() + 未 cached 的 critical jobs
onFrame (director_after_draw):
  absorb every SCAN_EVERY=10 frames
  if compiled>=jobs.length && !crit → return    // crit 含 needlesMissing
  else 每帧最多 CRITICAL_PER_FRAME=3 次 compileItem
```

Live GLB 是 COUNT16/15/3（`e3fbce98…`），不是 FAT 的 COUNT53/73。设备上几乎不会再产出带 `CC_MORPH_TARGET_COUNT53` / `COUNT73` 的 createShader 名。这两根 needle **永久 missing** → `criticalPending ≥ 2` **永久** → 早退永不命中 → 过渡结束后仍每帧走 compile；每 10 帧整场景 `absorb()` 重扫 MeshRenderer/passes。

与体感对齐，并且已被 OFF 试验证实：

- 周期 / 整机 UI 卡：after_draw 全局税，不只角色。
- 起身仍顺：StandupProgramWarm 已 OFF；起身路径不依赖 TSW 早退。
- 关 Morph / PeriodHeavy / SceneAudio 零改善：那些刀没碰 TSW。
- `0421cfff` 流畅：根本没有 TSW。
- `dc248d14` 默认 OFF：Funning「不卡了」。

---

## 6. 已出货的修复（保持，不要再翻）

Feature `8f520d00`，integrate `dc248d14`，cherry-pick 在 docs 冲突上取 incoming 后为 CLEAN。默认：

```text
TRANSITION_SHADER_WARM_ENABLED = false
```

OFF 时 begin / watch / onFrame / absorb / compile 空转。`armTransitionHold` / `noteTransitionHeavyFrames` / `holdTransitionShaders` 仍可调用，避免 BalloonTransit / Board / Sail 调用方抛错。视觉（BalloonTransit / sea-landing / K.s1 / black-fence）不回退。

本笔记**不**改 `TransitionShaderWarm.ts`。源码里的默认值已经是 `false`。文件头注释仍写成 A/B「suspect」口吻；以本文的 ROOT HIT 为准，不要按那句注释把默认开回去。

---

## 7. 回滚（只用于复现旧卡顿，不要当默认）

运行时打开旧 warm：

```text
setTransitionShaderWarmEnabled(true)
```

然后再次 `beginTransitionShaderWarm` / `watchTransitionRoot`，listener 才会挂回 `director_after_draw`。`setTransitionShaderWarmEnabled(false)` 会 `resetTransitionShaderWarm()`（卸 listener、清 jobs）。

不要把 `export let TRANSITION_SHADER_WARM_ENABLED` 改回 `true` 并出包。那会把已确认的整机 after_draw 税装回去。

---

## 8. 站立规则

1. **未经 Funning，不要把 TSW 默认再开成 ON。** 包括「修完 needle 就可以默认 ON」「只在过渡时 ON」「Mac setCamera/board LONG 没过所以要 warm」。
2. **COUNT16↔FAT 只是应急对照。** 仅当周期 stutter **再次出现** 时，才标明拆对、临时挂回 FAT GLB + 旧 meta 做体感对照。预期：多半消不掉周期卡，起身可能变差。现在 stutter 已经消失，不要为了对照去拆 `e3fbce98` + `6fd22962`。
3. 不要为 Mac `setCamera` / `board-bg` LONG=0 再加 warm，也不要用 Mac LONG=0 否决这条手机根因。
4. 若将来有人要在默认仍为 OFF 的前提下修 needle：可以从 `CRITICAL_CACHE_NEEDLES` 去掉 COUNT53/73，或按 live COUNT 动态生成。那是防止「有人违规把默认开回去之后 forever pending」的保险丝，**不是**重新默认 ON 的理由。
5. 起身卡与这条周期整机卡是两条线。起身顺、周期卡，打的是 TSW。不要把 standup morph / COUNT 工作倒回去当这条的修复。

---

## 9. 深挖草稿（2026-11-05，结论已关闭）

诊断写于命中包上传之前（当时 integrate 停在 `324e50b1` / 体验版 `1.0.202611050734`，约 07:48 America/New_York）。当时的排序：

1. **主刀：** TSW 常驻 + orphan COUNT53/73 needles。动作是默认 OFF。**这条已被 Funning 体感关闭，见上文 ROOT HIT。**
2. **对照刀（未做，保持不做）：** COUNT16↔FAT。仅当 #1 失败才走。#1 已成功，此刀降为「stutter 再现才启用」。
3. **低杠杆残留（未做）：** `skyNearAt` ~400ms、`PersistentMainlinePort` sync、`BedLayerAudio.update`。它们解释不了「0421 稳 → 现卡」，也解释不了「只关 TSW 就不卡」。不要为了这条已关闭的周期卡去闸它们。

诊断约束（仍然有效）：不以 Mac `setCamera`/`board` LONG=0 否决；不把 orphan 构建上传；不拆 sea-landing / BalloonTransit 视觉。

当时给 GGbot 的 ONE cut（默认 OFF + `setTransitionShaderWarmEnabled` + hold/note 空转）已经在 `8f520d00` / `dc248d14` 落地，并由 `1.0.202611050759` 证实。

---

## 10. 证据索引

| 项 | 路径 / tip |
|----|------------|
| 本笔记 | `docs/fps/PERIOD-STUTTER-TSW-ROOT-HIT-20261105.md` |
| 同系列 A/B 续记 | `docs/r5/b20-hotfix/NOTES-SETCAM-BOARD-LONG.md`（文首指向本文） |
| 根手记指针 | `HANDOFF.md` 文首 |
| Integrate handoff 指针 | `docs/handoff/GrokBot/HANDOFF-b20-integrate-landing-visual.md` |
| TSW 源 | `creator-build-project/assets/scripts/region/TransitionShaderWarm.ts` |
| 流畅基线 | tip `0421cfff`（无 `TransitionShaderWarm.ts`） |
| 命中前 tip | `324e50b1` / 体验版 `1.0.202611050734`（TSW 仍 ON） |
| 命中 tip | `dc248d14` / 体验版 `1.0.202611050759` |
| Feature | `8f520d00` |
| COUNT16 对 | GLB `e3fbce98…`；anim_meta `6fd22962` |
| 上传摘要（本机，不进仓） | Mac evidence `/Users/shineanl/mac-upload-dc248d14`；版本 `1.0.202611050759`；`formal_release=0` |

---

## 11. 给后来 bot 的三行

1. 周期整机掉帧已经命中 **TransitionShaderWarm after_draw**，不是下一刀 COUNT16↔FAT。
2. 默认保持 `TRANSITION_SHADER_WARM_ENABLED=false`。回滚只走 `setTransitionShaderWarmEnabled(true)`，且要 Funning 点头。
3. Funning 原话：「不卡了」。体验版 `1.0.202611050759` @ `dc248d14`。
