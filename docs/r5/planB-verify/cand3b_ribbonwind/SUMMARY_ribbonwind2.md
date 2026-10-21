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
