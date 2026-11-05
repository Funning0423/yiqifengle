# tip · standup-perf-count-meta · 可叠包 · 2026-11-05

StandupProgramWarm `5bde177a` / Feel 催叠：建模 aggressive 瘦 GLB 已出；本 tip 出**正式 anim_meta**，与 GLB **成对**上叠。

## 必须成对叠（硬规则）

| 项 | 路径 / 值 |
|---|---|
| GLB | `chr_b_standup_count_v1.glb` |
| sha256 | `e3fbce98135e6370e901dc4eac04d6d531f07aad3ba4b9a0e0db81ee5291eb86` |
| meta | 本 tip 的 `anim_meta.json`（`status=standup-perf-count-v1-FORMAL`） |
| 预览（不进仓） | `/workspace/yiqifengle/previews/角色动画bot/standup-perf-count/` |
| 建模源 | `/workspace/yiqifengle/previews/角色建模bot/standup-perf-count/` |

**禁止**：

1. 用本瘦 meta 盖旧 FAT GLB（`INTERIM_s1_grokbot2` / COUNT53/73）——驱动表与槽位对不上，且会把已删 `seat_fix_*` 当幽灵曲线。
2. 用 tip1 / FAT-era meta 盖本瘦 GLB——`seat_fix_*` / `hand_rest_support` 等名已不存在，COUNT 日志虽掉但曲线空转、坐姿塌。
3. 只换 meta 不换 GLB，或只换 GLB 不换 meta。

叠法：同一次 Feel / integrate 同时替换角色 GLB + `anim_meta.json`；再叠 Warm `5bde177a`。

## COUNT（对齐 mesh.extras.targetNames）

| mesh | COUNT |
|---|---:|
| LOD0_G2_APRON | **16** |
| LOD0_G2_DRESS | **15** |
| LOD0_G2_BODY | **15** |
| LOD0_G2_BOW | **3** |

驱动表 = tipNames 一一对应（`{targets: name→index}`）。  
`flutter` / `apron_lift` / `skirt_lift`：**不在**本瘦资产（COUNT≤16 烘掉/并入 bake）；风摆 flutter 本 tip 不驱动。

## anim_meta 相对建模 DRAFT 的补丁

1. **sit_hold** 补 `seat_bake_sit_0..3` 常值 = `sit_down` settle@0.8667s 权重  
   ≈ `(0.796358, 0.31969, -0.114165, -0.207569)`（全程 hold，防坐姿 bake 塌陷）。
2. **sit_down** bake 自 settle 起 plateau 到 clip 末，与 sit_hold 连续。
3. **stand_up** 增 `seat_bake_sit_*` 0.2s release（hold→0），并保留建模 `seat_bake_stand_0..3` 曲线。
4. 摘净已删名（`seat_fix_*` / `skirt_back_thin_*` / `hand_rest_support` / tip1 噪声等）；曲线 ∩ tipNames = 全覆盖、无幽灵。
5. `morph.meshes` 统一 `{targets:…}`；BOW 保留 ribbon 三槽。

## seat_bake_* 与 0..1 clamp

PCA 系数有符号、可 >1（sit_0 peak≈1.76；stand_0 peak≈3.15）。  
当前 `CharacterMotion.morphWeights` 结果钳 0..1 → bake 会被压扁。  
**可叠优先**：先叠本包降 COUNT；视觉精修 / 解钳（或对 `seat_bake_*` 豁免 clamp）可后轮交 GGbot。本 tip **不**为穿透改手臂。

## 穿透抽检（照抄建模，不改臂）

| clip | maxDepth |
|---|---:|
| sit_hold | **0.26 cm** |
| sit_down | 3.48 cm |
| stand_up | **9.29 cm** |

来源：`pen_sample.json` baked_v1。布料 round-2 可选；**禁止**为 9.29cm 拧腕/外撇手臂。

## 分支 / 叠合

- 分支：`anim/standup-perf-count-meta`（基 `anim/standup-perf-morph2` @ `7b552be9`）
- 仓内：`creator-build-project/assets/bundles/region_island/character/anim_meta.json`
- GLB 不进仓：从预览路径取，或建模同 sha 文件

## 给 Grok Bot / Feel / GGbot

1. 成对叠 GLB+meta → 期望日志 `CC_MORPH_TARGET_COUNT16`（APRON）/ `COUNT15`（DRESS/BODY）。
2. Warm `5bde177a` 按新 COUNT 预热。
3. 真机起身体感优先；Mac setCamera 不否决。
4. 解 `seat_bake_*` clamp / 布料穿透精修 = 后轮，不挡本 tip。
