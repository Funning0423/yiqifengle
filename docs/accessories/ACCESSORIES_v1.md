# 配件 v1：雪山围巾 / 灯塔手提灯（角色建模bot，2026-10-22 ET）
GLB 不进仓库，全部在 previews/角色建模bot/accessories/。概念见 CONCEPT_scarf_lantern.md。

## 交付物
| 文件 | sha256 | 字节 |
|---|---|---|
| chr_b_scarf_v1.glb（cand3b + 围巾） | 9a5d8ce43825af0ee31d52f6d071726933c0cd89f23ae7247b809777bc1e68bc | 3,147,740 |
| chr_b_scarf_v1_anim_meta.json | b73170ece1bedc33b87c363dfb9b9e53d10a36494756da84c0d63c4832028c43 | 275,502 |
| prop_lantern_v1.glb（独立道具） | 0a199fcb1a92c08daf18cdefc48c6731778e42b633932c0ee7989b6ac6427f83 | 10,088 |
| test_lantern_on_chr_v1.glb（测试用：ribbonwind+围巾+socket+灯） | 2c6d1c19e1cf6a0273eb96f4737caecd41333da515236724d0259a0dd1a1f4b5 | 3,187,432 |
| qa/qa_scarf_on_ribbonwind.glb（QA 用：ribbonwind+围巾） | c1680ab040400ad4e99159ac055a347734b0674f3116f6d6532f4beedb2f5146 | 3,177,064 |
基础：planB_cand3b.glb 02bd4c2b…59ac（3,129,296 B）；动画以 planB_cand3b_ribbonwind.glb d5f84569…76cf 为准。

## 围巾
- LOD0_G2_SCARF：400 三角 / 230 顶点（颈圈 252 + 两尾 128 + 结 20）；材质 M_G2_SCARF，贴图 T_G2_SCARF_64.png（397 B：米白底 #F3ECDE、淡黄细条纹 #F6E080、截面内侧 AO 带）。
- 颈圈与身体最小间隙 6.0 mm（1 段 5.92 mm），按 BVH 逐段迭代求出。
- 骨骼：scarf.tail = joint 29，父 neck，绑定位置 (0.044, 1.395, 0.065)，相对 neck (0.044, −0.0064, 0.0651)，旋转与 neck 一致。关节 30，到上限。
- 蒙皮：颈圈/结 → neck(≤0.6，随高度) + chest（chest 是 spine 链上一级；纯 spine 在 1.17 m 太远会错位）。主尾 18 cm：scarf.tail 0→1.0（前 35% 长度 smoothstep）；副尾 14 cm：0→0.7，其余给 neck/chest。
- 原 28 骨 + ribbon 的节点、IBM、所有原网格属性/形态键/动画采样逐字节一致（脚本校验 diffs=0）。
- anim_meta：wind.mask 加 scarf*；wind.scarf 写 coef 0.5、上限 后 35° / 左右 20°、轴约定和 QA 结论。v1 不带 scarf.tail 动画通道。
- 包体：+18,444 B（≈18.0 KB；gzip 后 +8.0 KB）。

## 手提灯
- 336 三角：框 204、握把 20（直径 1.2 cm）、吊环 48（6 cm）、玻璃 60（双面，BLEND）、灯芯 4。灯身高 16 cm，最大半径 5.2 cm，无骨骼，无贴图（铜/玻璃/自发光 3 个因子材质）。
- 原点 = 握把中心 = socket.lantern 挂点 = 钟摆轴心；灯向 −Y 下垂；灯顶 y=−0.06，灯底 y=−0.22。
- lantern.core 节点相对 socket（灯竖直时）偏移 (0, −0.148, 0) m，即挂点正下方 14.8 cm。
- socket.lantern：父 hand.L（她的右手），局部 (0.010, 0.080, 0.006) m。hand.L 局部 +Y=指根方向，+X=掌心法线（掌心朝向的一侧）。掌心中点取 (0, 0.055, 0.006)，再加 +2.5 cm(Y)、+1.0 cm(X)。socket 旋转 = 绑定姿态下 hand.L 世界旋转的逆，使绑定姿态下灯竖直。
- 包体：独立 10,088 B（≈9.9 KB；gzip 4.6 KB）。

## 穿模 QA（qa3 同法：30 fps 逐帧、anim_meta morph 曲线、BVH 三角对数；表见 QA_TABLES.md，格式为 峰值/帧数）
- 围巾 W=0、13 个片段：12 个全 0。sit_down f4–f22 有 脸 75/15、下巴 18/13、头发 249/20、围裙 62/11、裙 38/10。基线（不戴配件）同一段已有 头发×躯干 74/19、下巴×躯干 30/28，低头幅度大，头已压进领口。
- 风（系数 0.5，顶风=后摆，顺风=前摆；走路 8 段 + idle）：W=0.5 顶风/顺风、W=1.0 顺风全 0；W=1.0 顶风（后摆峰值 17.5°）尾巴×胸 9–87 对。
- 上限：向前 35°±左右 20° 全 0；左右 +20° 全 0；−20° 在 walk_turn_180_bodyR 有 8/5；向后 10° 只有 walk_turn_180_bodyR 119/11；向后 15° 有 4 段出问题；向后 35° 全部片段 68–190 对（尾巴压进胸），+左右 20° 时 尾×手臂 21–28 对。结论：尾巴在胸前，向后 35° 不可达，安全后摆约 ≤10°（turn_180_bodyR 要 0°）。
- 提灯（竖直下垂；走路 8 段 + idle）：灯×腿 0、灯×躯干/飘带/围巾 0；灯×裙 9 段全部有，峰值 264–505；灯×围裙 6 段有，峰值 74–210。刚性跟手：turn/idle 5 段 0，walk_loop/start/stop 4 段仍 259–413。
- 修正尝试（每法 ≤2 轮）：
  - 围巾颈圈加 head 权重 0.4 / 0.25：sit_down 脸下巴降到 0/35，但头发 193/228，颈圈×躯干新增 60/42 → 不采用。
  - 颈圈间隙 6 mm + neck 权重上限 0.6：walk_turn_180_bodyR 颈圈×躯干 20/10 → 0（已采用）。
  - 灯：吊环 6→3→1.5 cm、挂点 X +1.0→−1.0→−3.0 cm：最好仍 灯×裙 65–154、灯×围裙 116–136 → 失败，已停。诊断（非方案）：挂点需外移 6–9 cm 才归零，握把会离开手掌。原因：手自然下垂时紧贴 A 字裙外侧，灯直径约 10 cm，只改灯不可能不碰裙。
- 未测：lantern_hold 手型（还没出）；钟摆摆动（只测静止竖直和刚性）；sit 片段提灯；Cocos 实机；交叉淡化；重力补偿尾巴通道（QA 试过一次 sit_down 尾×围裙 62→28，未采用）。

## 预览（accessories/preview/）
compare_{front,side,back,34,top30}.png（左 cand3b、右 围巾+提灯，idle f0），compare_all_small.jpg，scarf_close_{front,side,back}.png，lantern_close_{front,side}.png。
