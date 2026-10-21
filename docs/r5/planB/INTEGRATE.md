# 方案B 候选 planB_cand1（飘带骨）— INTEGRATE

> 状态：**候选，未接入，未推送**。飘带骨槽位**待定**（29–30 号槽位等角色动画bot确认，刘海/后发梢可能也要用）。

## 0. 文件
| 项 | 路径 | sha256 | 大小 |
|---|---|---|---|
| 候选 GLB | previews/角色建模bot/planB/planB_cand1.glb | 7a1039fb85484ba5a0deb80008ea73885634c12778677359aad1900ba021ccda | 3,153,752 B |
| 配套 anim_meta | previews/角色建模bot/planB/planB_cand1_anim_meta.json | ce227a05… | — |
| 底子 | previews/角色动画bot/planA-verify/hipsway/chr_b_r5g2_planA_hipsway65_cand1.glb | adde69a6… | 3,194,476 B |
| 方案A fix1 meta | previews/角色建模bot/planA-final/anim_meta_planA_fix1.json | 3b85b0cd… | — |
- 包体：底子去掉孤立 buffer 数据后 3,125,200 B；cand1 比它 **+28.5 KB**（超出原估 ±3 KB：飘带 14 段旋转+平移通道、两个弯曲 key、1 个裙子过渡 key）。可压：sit_hold 61 帧→隔帧、走路 15fps→更稀。
- glTF-Validator：**0 错误**，警告 3790 与底子相同（无新增）。

## 1. 骨骼
- 新骨 `ribbon` 追加在 skin.joints **末尾，索引 28（第 29 根）**，父级 hips，头在飘带根 (0, 1.104, -0.0745)（glTF 绑定空间），绑定朝向与 hips 一致。原 28 根骨骼、顺序、命名、IBM 均未动。
- 改名/改槽位：只改 `previews/角色建模bot/planB/rig.py` 的 `RIBBON_NAME`，重跑 `build_cand.py`。GLB extras.planB 与 anim_meta.planB 里都写了“槽位待定”。

## 2. 权重（BOW 解冻，仅 BOW）
- BOW 共 186 顶点。改动 40 个（原来带 skirt.* 权重的尾部，y≤1.064；文档早先写的“61”是旧统计，实测 40）→ 100% `ribbon`。结身与飘带顶圈（y≥1.104）仍 100% hips。
- 渐变权重（0.3/0.7 之类）试过：大角度时线性混合蒙皮把过渡圈拉长 12–16%，所以改用“铰链”：转轴穿过飘带顶圈中面，根部弯折的平滑由 ribbon_bend 分布式弯曲承担（见 3）。
- skirt.* 对 BOW 的权重全部去掉。

## 3. Morph（BOW）
- `bow_sit_drape`：改为**刚体版**（原结身 morph 的 Kabsch 刚体拟合：后移 3.4 mm、0.6°），尾部 delta=0。尾部的同量平移由 ribbon 骨平移通道承担，所以铰链不错位。BOW×裙子由 5 降到 0。
- `bow_stool_fix`：**删除**。原来没有任何曲线驱动，方案B也不需要。
- 新增 `ribbon_bend_half`（24°）/`ribbon_bend`（48°）：飘带下 4 圈各弯 1/4 的分布式弯曲（稀疏，40 顶点），只在 stand_up 第 1–6 帧和 sit_down 第 35 帧用到。两个 key 接力，避免线性插值缩短。
- BOW targets 现在是 {bow_sit_drape:0, ribbon_bend_half:1, ribbon_bend:2}，已登记到 anim_meta morph.meshes.LOD0_G2_BOW。

## 4. 动画（ribbon 通道，14 段都有，避免段间残留）
- sit_hold：俯仰 17.5°，再加 ±0.5° 的 2 s 正弦微摆（首尾相等，可循环）。
- sit_down / stand_up：在 I 和 sit_hold 姿态之间做 slerp（权重=bow_sit_drape 曲线），再逐帧搜索俯仰偏移避开凳子，平滑后不比搜索结果差的帧才保留。平移通道 = rest + 3.4 mm × bow_sit_drape 权重。
- 走路四段：跟随 skirt.back 增量的 60%，再加风（绕 hips X 后飘 4°·sin²，加 ±2.5° 前后、±2° 侧摆，周期 = 片段长度，首尾为 0）。按 15 fps 采样。
- 其余 7 段（idle、wind_sway、door、四个转身）：只跟随 skirt.back 的 60%。
- 风向写死在 hips 局部，全局风向以后由角色动画bot接入。**所有曲线都是占位，正式动画由角色动画bot重做。**

## 5. 裙子过渡修正
- 逐帧推出身体 3 mm 的 morph key（每 3 帧一个，帐篷曲线，两端为 0），围裙跟随，逐对回滚。跑了 2 轮（围裙跟随半径 12 mm 和 25 mm），只有 `planB_tr_sit_down_24` 通过回滚（DRESS 330 顶点，APRON 189 顶点）。其余全部因为裙×围裙变差被回退。
- **按“最多重试 2 次”停止**：裙×身体没达到 a96 标准（见 6）。

## 6. QA（30 fps 逐帧；底子=hipsway65+fix1 meta）
| 项（max/sum） | a96 | 底子 | cand1 |
|---|---|---|---|
| sit_down BOW×凳 | 78/641 | 88/643 | **0/0** |
| stand_up BOW×凳 | 44/355 | 44/294 | **0/0** |
| sit_down 裙×身体 | 393/5908 | 398/7164 | 398/6992 ✗ |
| stand_up 裙×身体 | 264/3046 | 378/3998 | 378/3998 ✗ |
| sit_down 围裙×身体 | 204/2891 | 202/1829 | 202/1675 |
| BOW×裙子（三段） | — | 5 | 0 |
| 飘带拉伸（相对静止边长，忽略 <1 mm 的边） | — | 230%/124%/205%（skirt 蒙皮造成） | **2.79%/2.81%/2.74%** |
| sit_hold 全部对 | — | 0 | 0 |
| 走路四段 手×布、裙×围裙 | — | 0 | 0 |
- 其余各对（裙×凳、围裙×凳、裙×围裙、手×*）与底子相同或更好。
- 未测：Cocos 实机（光照、morph 负载、蒙皮上限）；走路和其他 7 段的飘带拉伸与 BOW 穿插（转角 ≤6.8°，估计 <1.5%）；段间交叉淡化。

## 7. 需要角色动画bot配合
1. 确认 ribbon 用第 29 槽（索引 28），以及刘海/后发梢怎么安排。
2. 用正式动画替换 14 段的 ribbon 占位曲线，接入全局风向。
3. 裙×身体的过渡回退在动画侧更容易解决（坐下/起身时大腿、手臂与裙子的关系），或者允许修改裙子/围裙的层间距规则。
4. 合入 anim_meta：morph.meshes.LOD0_G2_BOW 的新索引，以及 ribbon_bend_half/ribbon_bend 两条曲线。

## 8. 复现
previews/角色建模bot/planB/：`build_cand0.py`→`design.py`（RIGID=1 RKNOT=1 RTRANS=1 BETA=48 HOLDAMP=0.5）→`dressfix.py`→`build_cand.py BASE design_b48 OUT dfix2.npz`；QA 用 `ribqa.py`、`../r5-sit-drape/qa3_patched.py`、`../planA-final/qa_walk.py`。

---
# planB_cand2（2026-10-21，在 cand1 上稀疏化；cand1 保留）
| 项 | 值 |
|---|---|
| GLB | previews/角色建模bot/planB/planB_cand2.glb |
| sha256 | ea4524620d8886bcaad2668877ee519a9a8c78ed9762e8e75b12e2d47b4b2b07 |
| 大小 | 3,121,832 B |
| anim_meta | planB_cand2_anim_meta.json（9d0ac694…） |
| 与底子比 | 与压缩后的底子（3,125,200）相比 **−3,368 B**；与底子原文件（3,194,476）相比 −72,644 B |
| 与 cand1 比 | −31,920 B |

## 改动（脚本 previews/角色建模bot/planB/sparsify.py）
1. ribbon 通道稀疏化：按线性/slerp 插值误差去点。旋转误差 ≤0.25°，平移误差 ≤0.1 mm；sit_down/stand_up 这两段收紧到 ×0.2（0.05°/0.02 mm）。按 0.25° 跑时，sit_down 有 1 帧 BOW×凳 = 8，所以收紧。
   各段 key 数：sit_down 旋转 37→14、平移 37→7；stand_up 旋转 39→14、平移 39→5；sit_hold 旋转 61→4、平移→1；wind_sway 旋转 97→6；走路四段旋转 23–30→10–11、平移→1；其余 6 段→1。
   sit_hold 原有 ±0.5° 的微摆在阈值以内，被去掉了，基本是静止。
2. 常量通道压成 1 个 key，时间和取值 accessor 在各段之间共享。没有删除通道：如果某段缺通道，Cocos 可能保留上一段的姿态（例如 sit_hold 的 17.5°）。
3. ribbon 动画数据合并进 1 个 bufferView。
4. **JSON 规范化：** 删掉全部 544 个 sampler 上显式写的 `"interpolation":"LINEAR"`（glTF 默认就是 LINEAR，语义不变）。这一步约省 13.6 KB；不做的话，比底子 **+10.2 KB**。
5. **删除了 cand1 的裙子过渡 key `planB_tr_sit_down_24`**（DRESS 和 APRON 各一个，约 7.3 KB）。原因：裙×身体交给角色动画bot。删除后 sit_down 的裙×身体回到底子水平：6992 → 7164，围裙×身体 1675 → 1829。
6. bend/bow_sit_drape 曲线：只去掉平台中间的重复点，所有 30 fps 采样值不变。
7. 去掉 ribbon 节点的 extras；根 extras.planB 简写为 'joint28 slot29 TBD'（槽位待定）。

## QA（30 fps 逐帧，max/sum）
| 项 | 底子 | cand1 | cand2 |
|---|---|---|---|
| sit_down BOW×凳 | 88/643 | 0/0 | 0/0 |
| stand_up BOW×凳 | 44/294 | 0/0 | 0/0 |
| 飘带拉伸（坐下/坐着/起身） | 230/124/205% | 2.79/2.81/2.74% | 2.79/2.81/2.74% |
| BOW×裙、BOW×身体 | 5 / 0 | 0 / 0 | 0 / 0 |
| sit_hold 全部 | 0 | 0 | 0 |
| sit_down 裙×身体 | 398/7164 | 398/6992 | 398/7164（交角色动画bot） |
| stand_up 裙×身体 | 378/3998 | 378/3998 | 378/3998 |
| sit_down 围裙×身体 | 202/1829 | 202/1675 | 202/1829 |
| 裙×围裙 | 36/108、138/381 | 同左 | 同左（回滚规则未放宽） |
| 走路四段 手×布、裙×围裙 | 0 | 0 | 0 |
| validator | 0 错误 | 0 错误 | 0 错误，警告 3790，与底子相同 |

未测：Cocos 实机（是否兼容省略 interpolation、光照、蒙皮上限）；走路和其余段的飘带拉伸与 BOW 穿插；交叉淡化。
