# planB_cand3b_ribbonwind（飘带 v3 + 风层，底子 cand3b 02bd4c2b…，2026-10-21 美东时间）
文件：planB_cand3b_ribbonwind.glb / _anim_meta.json / walk_loop_wind_ribbonwind.mp4（sha 见 rw2/sha.txt）；脚本 ribbon_bake4.py、rw2/wscale.py、rw2/wq.py、rw2/ana.py
## 恢复后状态
- 留存：ribbon_bake.py/2/3、xfade5.py、wind2/wq.py、planB_cand3_ribbon(.glb v2 6a994645)、planB_cand3_ribbon2.glb(08559455)。
- 丢失：ribbon_bake4.py、xfade6.py、wind.py、qa3w.py、qa_walk4.py、planB_cand3_ribbonwind.glb(7e4989f8)、提交 8b72b2d4。ribbon_bake4 由 bake3 重建；xfade6/qa3w/qa_walk4 未重建，用 xfade5/qa3b/qa_walk3/wq 代替。
## cand3b 声明核对（30fps）
- 蝴蝶结×凳子：三段各帧 0，sit_hold→stand_up 淡化 xA/xB 全 0 ✔（cand3 时是 42–46）；拉伸 2.41% ✔；飘带×裙/围裙 0 ✔。四分之一帧 3.84%（sit_down f35.5、stand_up f12.5）为既有，未复测。
## 飘带 v3
- ζ0.5/1.6Hz/±12° 弹簧，只 X pitch，叠在 cand3b 跟随曲线上；前摆软限 1°；坐姿总后倾 ≤15°；stand_up 0.4 s 前弹簧 0（保留建模的保持段），f12–18 缓入；sit_hold ±1.5° 0.5 Hz 一周两头 0（ribbon_bend=1 下 0 穿模，拉伸 2.59%）；loop 周期稳态；转身带 walk_loop 前倾并在两头等于 walk_loop f0。只重写 ribbon rotation（0.2° 步长，无显式 interpolation）；其余通道逐字节相同（已校验），ribbon translation 与形态键曲线未动。
- 14 段：蝴蝶结×凳子/裙/围裙/身体/手 0；最大拉伸 2.69%（walk_turn_180）。坐姿淡化 0。sit_down 裙×身体 398、stand_up 332 同 cand3b（已接受）。
## 风层
- wind_sway_loop → wind_flutter_loop；mask 加 ribbon*。注意：该片段只有 skirt.* 和 ribbon 有风动作，apron*/hair* 在片段里没有通道（mask 匹配不到东西）。
- 规则：手×布、蝴蝶结×任何 = 0；布×身体、裙×围裙每帧不比无风差。walk_start/loop/stop×2/turn×4/idle/door_reach + 13 个 0.2s 淡化，风 1.0 相位 0/1/2/3 s，风 0.5 相位 0.5/2.5 s。
- 结论（FAIL 风的可见度）：裙子 8 根有风动作的骨（front/front.low/left/left.low/back/back.low/right/right.low，原幅 0.8–12°）在所有试过的幅度下（单骨 1.0；整体 0.4/0.2/0.1；上段 0.5；上段 0.25+下摆 0.05；下摆 0.1–0.5）都会让裙×身体 / 裙×围裙比无风更差（最多 +32 对三角形，door_reach 裙×围裙 245→249–293）。所以交付的是：ribbon ×0.4（6.0°→2.5°），裙子各骨 ×0（front.mid、front.low.mid 原本就是 0）。这个配置在所有相位与 0.5 风下 0 失败。实际上只有飘带在风里动，裙子没有风。
- 需要 Grok Bot 决定：接受「只有飘带有风」，或放宽为「峰值不超过无风」而不是逐帧，或由角色建模bot 加裙子与腿的间隙后再加风。
## 未测
Cocos 实机；风下的拉伸；头发（无风通道）；xfade6 级别的出图。

## 风下的飘带/蝴蝶结拉伸（2026-10-21 美东时间，只读，GLB b31fff35 未改）
算法同 qa_walk3（BOW 每条边对静止长度的最大相对变化，含形态键），wq 加性风层，30fps 每帧 + 13 个 0.2 s 淡化。脚本 rw2/ws.py，结果 rw2/st_*.json。限值 2.8%。
| 片段 | 无风 | 风1.0 相位0/1/2/3 | 风0.5 相位0.5/2.5 |
|---|---|---|---|
| walk_turn_180 | 2.69 | 2.50 / **2.89** / 2.53 / **2.89** | 2.55 / 2.56 — **FAIL**（f35–36，风1.0 相位1 s、3 s） |
| walk_turn_180_bodyR | 2.58 | 2.37 / 2.78 / 2.39 / 2.78 | 2.44 / 2.45 ✔（余量 0.02） |
| walk_stop_bodyL | 1.99 | 最高 2.31 | 2.07 ✔ |
| walk_stop_bodyR | 1.87 | 最高 2.19 | 1.94 ✔ |
| walk_loop | 1.86 | 最高 2.15 | 1.80 ✔ |
| walk_start | 1.72 | 最高 2.03 | 1.77 ✔ |
| walk_turn_90_bodyL / R | 1.62 / 1.66 | 最高 1.96 / 1.95 | 1.78 ✔ |
| door_reach / idle | 0.32 / 0.01 | 最高 0.68 / 0.39 | ✔ |
| 淡化 13 段 | — | 最高 2.28（turn_180_bodyR→loop） | ✔ |
结论：FAIL，只有 walk_turn_180 f35–36 在风 1.0 的两个相位超限（2.89% > 2.8%），按要求停止，GLB 未改。可选修法（待定）：ribbon 风 ×0.4→约 ×0.3，或 walk_turn_180 末段弹簧幅度压低。

## ribbonwind3（2026-10-21 美东时间，Grok Bot 批准；b31fff35 文件不变）
- 风层 ribbon ×0.3（相对原始，6.0°→1.8°），裙子仍 ×0。ribbon_bake5.py：walk_turn_180/_bodyR 的弹簧摆幅以 f35 为中心、f26–44 平滑钟形压到 0.5（向末端值靠拢），两端仍等于 walk_loop f0（2.499°）。
- 与 b31fff35 相比只改了 3 个通道：walk_turn_180、walk_turn_180_bodyR、wind_flutter_loop 的 ribbon rotation；其余逐字节相同，无显式 interpolation。坐姿三段与 b31fff35 逐字节相同（接缝不变）。
- 穿模：14 段 + 坐姿淡化 + 13 个走路淡化，蝴蝶结×凳子/裙/围裙/身体/手 = 0，手×布 = 0；风 1.0（8 相位）/0.5 下布×身体、裙×围裙每帧不比无风差（0 失败）；无风走路布料与 cand3b 相同。
- 拉伸（限值 2.8%，目标 ≤2.6%）：
| 片段/淡化 | 无风 | 风1.0（8 相位 0–3.5 s） | 风0.5（0.5/2.5 s） | ≤2.6 |
|---|---|---|---|---|
| walk_start | 1.72 | 1.95 | 1.73 | ✔ |
| walk_loop | 1.86 | 2.07 | 1.77 | ✔ |
| walk_stop_bodyL | 1.99 | 2.23 | 2.05 | ✔ |
| walk_stop_bodyR | 1.87 | 2.11 | 1.92 | ✔ |
| walk_turn_90_bodyL | 1.62 | 1.87 | 1.74 | ✔ |
| walk_turn_90_bodyR | 1.66 | 1.87 | 1.74 | ✔ |
| walk_turn_180 | 2.20 | 2.46 | 2.21 | ✔ |
| walk_turn_180_bodyR | 2.11 | 2.33 | 2.17 | ✔ |
| idle_breathing_loop | 0.01 | 0.29 | 0.14 | ✔ |
| door_reach | 0.32 | 0.59 | 0.31 | ✔ |
| walk_start->walk_loop | 1.53 | 1.77 | 1.65 | ✔ |
| walk_loop->walk_stop_bodyL | 1.84 | 2.06 | 1.77 | ✔ |
| walk_loop->walk_stop_bodyR | 1.63 | 1.89 | 1.76 | ✔ |
| walk_loop->walk_turn_90_bodyL | 1.62 | 1.88 | 1.75 | ✔ |
| walk_loop->walk_turn_90_bodyR | 1.62 | 1.88 | 1.75 | ✔ |
| walk_loop->walk_turn_180 | 2.06 | 2.28 | 2.17 | ✔ |
| walk_loop->walk_turn_180_bodyR | 2.03 | 2.25 | 2.14 | ✔ |
| walk_turn_90_bodyL->walk_loop | 1.58 | 1.83 | 1.54 | ✔ |
| walk_turn_90_bodyR->walk_loop | 1.55 | 1.80 | 1.51 | ✔ |
| walk_turn_180->walk_loop | 1.65 | 1.86 | 1.57 | ✔ |
| walk_turn_180_bodyR->walk_loop | 1.87 | 2.06 | 1.79 | ✔ |
| walk_stop_bodyL->idle_breathing_loop | 0.24 | 0.45 | 0.33 | ✔ |
| idle_breathing_loop->walk_start | 0.62 | 0.84 | 0.73 | ✔ |
| idle_breathing_loop->door_reach | 0.06 | 0.28 | 0.17 | ✔ |
| door_reach->idle_breathing_loop | 0.15 | 0.39 | 0.13 | ✔ |
| sit_down / sit_hold / stand_up（无风，qa3b） | 2.41 / 2.59 / 2.41 | — | — | ✔ |
- 未测：Cocos 实机；头发（片段里没有风通道）。

## ribbonwind4：裙子风加回（2026-10-21 美东时间，底子 ribbonwind3 b505d545，未覆盖）
- 先读了角色建模bot 的 cand3c（09a7e714）：×0.2 时下摆骨在转身和 door_reach 被推进腿里。
- 代码（只读）：CharacterMotion 的 flutter 层权重 = windToFlutter(windDrive)，与当前片段无关，没有每段风权重 → 转身/door_reach 淡出做不了，跳过。
- 第 1 轮（只向外，rw2/owind.py：风的旋转投影到「远离腿的倾斜轴」= 下方向 × 骨头相对 hips 的水平外向，整流到 0..峰值，f0=0，循环相移）：全部 ×0.5、×0.25、上段 ×0.5（下摆 0）都 FAIL（door_reach、turn_180 淡化裙×身体/裙×围裙变差）。
- 第 2 轮（每根骨单独、向外 ×0.5）：只有 skirt.back 与 skirt.back.low 单独 0 失败；front/front.low/left/left.low/right/right.low 失败。
- 交付组合：skirt.back 向外峰值 0.96°（原 1.92°），skirt.back.low 向外峰值 6.08°（原 12.16°），其余裙骨 0，ribbon ×0.3（1.8°）。
- 全量 QA：10 个走路片段 + 13 个淡化，风 1.0 8 个相位 + 风 0.5（0.5/2.5 s）：布×身体、裙×围裙不比无风差，手×布、蝴蝶结×一切 = 0 → 0 失败。拉伸：风 1.0 最高 2.459%、风 0.5 最高 2.211%（walk_turn_180）≤2.6 ✔。
- 与 ribbonwind3 只差 wind_flutter_loop 里 skirt.back、skirt.back.low 两个 rotation 通道；坐姿与其他通道逐字节相同。文件大了 30,048 B，是追加写入后留下的未用 buffer 数据，没有清理。
- 未测：Cocos 实机；头发（无通道）；风下的坐姿（代码里坐姿风为 0）。

## ribbonwind4b：清掉未用数据（2026-10-21 美东时间）
- rw2/pack.py：只保留被引用的 accessor/bufferView（含 sparse 的 indices/values、draco bufferView），重排 buffer。3,189,280 B → 3,141,660 B（−47,620 B）。比 ribbonwind3（3,159,232 B）还小 17,572 B，因为 ribbonwind3 自己也带着烘焙飘带时留下的旧数据；两个新通道和被替换的旧通道一样大，所以 buffer 净增 0。
- 校验：664 个动画通道解码值与 ribbonwind4 完全相同；与 ribbonwind3 只差 wind_flutter_loop 的 skirt.back、skirt.back.low rotation；mesh/morph/skin/IBM/nodes/materials/extras 原始字节相同；无显式 interpolation；glTF Validator 0 错误（3790 个警告与 ribbonwind4 相同：NODE_SKINNED_MESH_NON_ROOT、ACCESSOR_JOINTS_USED_ZERO_WEIGHT）。穿模 QA 未重跑（数据相同）。meta 不变，用 ribbonwind4 的。
