# 手提灯 v2 + lantern_tuck_R + lantern_hold_R（角色建模bot，2026-10-22 ET）
GLB 不进仓库，全部在 previews/角色建模bot/accessories/。
## 交付物
| 文件 | sha256 | 字节 |
|---|---|---|
| prop_lantern_v2.glb | 5c932309eab7e2a40d1cf94507587e6a85d430dbac7ead8c588c633bcc9087e7 | 10,132 |
| chr_b_scarf_lantern_v2.glb（=角色动画bot stepdown_scarf c394131e + tuck_R + hold_R） | cd2f0390bb3f10893d593d83d86aa9265ad01bdbcaaf4d5b123748a2113a9e44 | 3,355,864 |
| chr_b_scarf_lantern_v2_anim_meta.json | 1a37124a346da02d50b26552cd47d39ac10336b1db489610ba570d37aa8f116c | 284,753 |
| test_lantern_on_chr_v2.glb（测试：上者 + socket.lantern + 灯 v2） | 4f714a2db70f4ae419f5c274443bfaa360cd84a35f06e917e541410aba89dcc4 | 3,366,240 |
包体：基底 3,194,716 → 3,355,864（+161,148 B）：tuck_R 占 +144,760（裙 3971 顶点 + 围裙 495 顶点的稀疏位移和法线），hold_R 占 +16,388。
## 灯 v2
- 灯身等比 0.72，高 11.5 cm，最大半径 3.74 cm；握把仍 φ1.2 cm；吊环 3.5 cm（宽 1.2 cm）；336 三角。
- lantern.core 相对 socket：(0, −0.0984, 0) m，灯竖直时在挂点正下方 9.84 cm。
- socket.lantern（hand.L 局部）：(0.0138, 0.0803, 0.0073) m。由 v1 的 (0.010, 0.080, 0.006) 沿角色动画bot 给的掌心法线 n 外移 4 mm（n 在局部为 (0.943, 0.075, 0.324)）。
## lantern_tuck_R（DRESS 目标 38，APRON 目标 30）
- 做法：在她右侧（−X）、y 0.50–1.00、峰值 y 0.76 的区域内收；用 PBD 保边长求解，只固定腰部；围裙用最近点位移转移后再求一次 PBD；最后补层距。
- 内收 10 mm（最大位移 10.4 mm），前后鼓出 −4.3/+5.7 mm。
- 拉伸（同前法，只计 >1 mm 的边）：裙 2.467%，围裙 1.313%。
- 层距：原 ≥8 mm 的 663 个围裙顶点改后仍 ≥8 mm，原 <8 mm 处没有变小（违规 0）；全体最小 5.16→5.16，平均 14.42→14.45 mm。
- 求解共 2 轮：第 1 轮 PBD 不加权，裙最大拉伸 18–80%；第 2 轮按 1/L0 加权，内收 25 mm 时 4.4%。只有把内收量降到 10 mm 才满足 ≤2.5%，按规则停在这里。
- 前视外形：轮廓自然。tuck=1 时围裙上有轻微明暗起伏（层距补偿造成），见 preview/v2/tuck_front_off_on.png。
## lantern_hold_R（BODY 目标 16）
- 来自角色动画bot lantern_hold_R_delta.npz：prim0/1/2 分别动 150/96/96 个顶点，最大 93.3 mm（向量长）。prim3–5 用 1 个零值稀疏项占位，保证 6 个 primitive 的目标数一致。
## meta
- morph.meshes 已登记 DRESS.lantern_tuck_R=38、APRON.lantern_tuck_R=30、BODY.lantern_hold_R=16。morph.lantern 写了默认 0 和驱动说明，现有片段都没写曲线。
## 整套 QA：见 QA_v2_full.md
