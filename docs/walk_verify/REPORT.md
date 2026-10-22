# 核实：走路类动作腿穿裙（28.5 mm）是否新增 —— **不是新增，55368056 基线里已有**

## 对比
- 基线：55368056 里 creator-build-project/…/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb（sha256 31ebfa53…，就是 2f7b6102 交付的 stepdown 合并包），meta 用 55368056 的 anim_meta.json。
- 当前：split/planB_cand3b_ribbonwind4b_stepdown_scarfbones.glb（3132274b…）+ 其 meta；QA 动画 GLB work_dense.glb 也一并比对。
- 数据比对：10 段走路/待机 clip 的全部通道逐值相同（差 0），当前只多一条 scarf.tail 旋转（不影响腿和布）；BODY/DRESS/APRON 顶点差 0，形变目标名相同；meta 里这些 clip 的形变曲线完全相同。
- 网格 QA（30 fps，t=n/30，原 clip，无风，同一套局部化深度口径）：基线与当前**逐帧结果完全相同**（summary.json `base==current True`）。

## 每段帧范围与峰值（两者相同；深度 mm / 最多三角对）
| clip | 腿×裙 帧 | 峰值 | 腿×围裙 | 裙×围裙 |
|---|---|---|---|---|
| walk_loop（44） | f1–2 | 12.4 @f2 / 39 | 0 | 0 |
| walk_start（59） | f12–20, f38, f47–48 | 19.9 @f14 / 40 | 0 | 0 |
| walk_stop_bodyL（45） | f22–24 | **28.5 @f24** / 28 | 0 | 0 |
| walk_stop_bodyR（45） | f21–24 | **28.5 @f22** / 41 | 0 | 0 |
| walk_turn_90_bodyL（46） | — | 0 | 0 | 0 |
| walk_turn_90_bodyR（45） | f20–23, f27–29 | 14.9 @f21 / 37 | 0 | f18–32，14.4 @f27 / 23 |
| walk_turn_180（46） | f7–8, f30–37 | 19.9 @f35 / 116 | f7, f36：23.2 @f36 / 59 | f3–38，14.9 @f27 / 25 |
| walk_turn_180_bodyR（45） | f5–7, f35–36 | 19.1 @f5 / 49 | f6：9.7 / 20 | f3–39，15.4 @f23 / 43 |
| idle_breathing_loop（55） | — | 0 | 0 | 0 |
| walk_start_stepdown（53） | f12–14, f17, f41–42 | 21.5 @f17 / 40 | 0 | f6–52，16.1 @f47 / 47 |

结论：不是本轮或最近提交引入，55368056 已存在；更早的引入点未追（任务限定"如果是新增的再找"）。只核实，未修。
## 已测 / 未测
已测：上表 10 段，基线 vs 当前，逐帧。未测：14 段过渡、风层叠加、Cocos 实机；早于 55368056 的历史版本。
