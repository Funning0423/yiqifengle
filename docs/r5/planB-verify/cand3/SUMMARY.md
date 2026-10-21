# Plan B cand3 验收 + 飘带动画 (2026-10-21)
## 1 cand3 (planB_cand3.glb sha256 2db26e2c90c1ab6414bc490a4e73388bcee9ae7952dc9b995a271f49e8041692, 3,128,940 B; meta a4f5efa3…203a74d)
- 来源：与 cand2 相比只改了 ribbon 的 rotation/translation 通道、ribbon 的 IBM（第 28 行）和静止位置、BOW 顶点位置；其他 30/84 通道、28 骨不变。joint 28 = ribbon，parent hips。无显式 interpolation。morph.meshes 全部正确（DRESS 38 个，新增 5 个背片键）。
- 声称核对：ribbon×裙子/围裙 14 段全 0 ✔；最大拉伸 2.41%（stand_up）✔；飘带只有 X 轴 pitch ✔；sit_hold 恒定 15° 后倾、无摆动 ✔；走路 7.4–10.6°（≈8° 偏置+跟随）✔；stand_up 裙子×身体 332/3589 ✔；sit_down 峰值 398 未修 ✔（如所述）。
- 硬指标：裙子/围裙/蝴蝶结/身体×凳子 0 ✔；手×布料/身体 0（含 31 个淡化帧）✔；手间隙 0.69/0.66 mm ✔；接缝 0.088°/0 mm、morph 差 0 ✔；脚/膝/手腕运动与之前相同 ✔（sit_down 落手 f29/34–36 比原版快 0.2–0.5 mm/帧，旧问题）；走路裙子×身体同 hipsway65 ✔
- 对 v4（accepted, deferred）：裙子×身体 sit_down 398/7042 vs 393/5744（22 帧超）、stand_up 332/3589 vs 242/2696（13 帧超），淡化帧最大 342；裙子×围裙 sit_down 36 vs 49 ✔、stand_up 138 vs 158 峰值 ✔ 但 4 帧超；围裙×身体 sit_down 3 帧略超，峰值 202 vs 204。
- 注意：walk_turn_* 的 ribbon 是 0°，walk_loop 是 ~8°，转身时会在 0.2 s 淡化里转 8°。

## 2 飘带动画 — FAIL（2 次尝试后停止）
- planB_cand3_ribbon.glb sha256 6a994645f2bf698c3b013108d5088ecf68a09a2aaaaaca553277de2c172c46cd, 3,143,168 B（+14,228 B）；anim_meta planB_cand3_ribbon_anim_meta.json sha256 d2029f4c…8e9（wind.mask 加了 'ribbon*'）
- 方法 ribbon_bake2.py：在 cand3 跟随曲线上叠加阻尼弹簧（ζ 0.5、1.6 Hz、±12°），输入 = hips 局部前向加速度 × 3°/(m/s²)，只有 X pitch；loop（walk_loop、idle）取周期稳态并闭合；非 loop 段前后 9 帧平滑到相邻段的值（walk_start 末尾 → walk_loop f0 的 2.5°；stop/turn 开头从 2.5° 开始；坐姿两头 0）；sit_hold ±1.5° 0.5 Hz（2 s 一周，两头 0）；wind_sway_loop ribbon ±6°（相对第 0 帧，加性）。向前(−)摆动软限到 1°；坐姿两段总后倾不超过 15°。只重写了 ribbon rotation 通道，用 compress_keeptr 的同一个均匀步长算法（0.2°），其他通道字节不变（没有整段重跑 compress_keeptr，否则会把已压缩的通道再压一次）；没写 interpolation。
- 尝试 1（无前向限幅）：蝴蝶结×凳子 stand_up 58；蝴蝶结×裙子 walk_stop_bodyL 38、walk_turn_180 60、turn_180_bodyR 49、door_reach 12。
- 尝试 2：14 段中只剩 **蝴蝶结×凳子 stand_up f4 = 8、f7 = 6**（后倾 13.1–14.0°）；其他全 0（裙子、围裙、身体、手）；拉伸最大 2.59%（sit_hold），走路 ≤1.99% ✔；坐姿接缝不变 ✔。
- 建议修法（第 3 次，未做）：stand_up f0–8 偏移限制为 ≤0（起身时不再后摆），其余不变。
- 未测：交叉淡化帧里的蝴蝶结相交（xfade4 不测 BOW）；Cocos 实机。
- **风的接入问题**：CharacterMotion 的风层播的是 `wind_flutter_loop`（CLIP_ROLES.flutter），GLB 里没有这个片段，只有 `wind_sway_loop`，代码没有引用它 → 现在风层根本不播放。我把 ribbon 写进了 wind_sway_loop、mask 加了 'ribbon*'，但要生效需要把片段改名 wind_flutter_loop（或由 Cursor 改映射），这会同时让裙/围裙/头发的风层开始生效，需要 Grok Bot 决定。风只有强度，没有方向。
