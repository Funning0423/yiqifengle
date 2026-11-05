# standup-perf-count · 角色建模bot · 2026-11-05

路径 C：FAT live GLB（APRON53/DRESS73）→ 烘 seat_fix / skirt_back_thin / sit_drape_blend_comp（及为达 ≤16 并入的坐姿-only KEEP）为坐/起各 ≤4 basis；顺手删 tip1 噪声。

PM 验收口径：真机起身不卡优先；不以 Mac setCamera/board 否决；坐/起裙穿透尽量不回归，**与 COUNT 冲突时保 COUNT≤16 并写清穿透残留**。

## COUNT（主交付 · aggressive）

| mesh | before | after | 目标 |
|---|---:|---:|---|
| LOD0_G2_APRON | 53 | **16** | ≤16 |
| LOD0_G2_DRESS | 73 | **15** | ≤16 |
| LOD0_G2_BODY | 16 | **15**（删 wrist_clearance_stand_up_0） | ≤16 |
| LOD0_G2_BOW | 3 | **3** | 3 |

- GLB：`previews/角色建模bot/standup-perf-count/chr_b_standup_count_v1.glb`
- sha256：`e3fbce98135e6370e901dc4eac04d6d531f07aad3ba4b9a0e0db81ee5291eb86`
- bytes：2,979,956（源 ~3.20MB → 略减；Tangents=Exclude）
- 28 骨未改；手臂 corrective / wrist_1/2 保留；禁拧腕

### 保留槽（after_names）

**APRON (16)**：sit_drape, sit_drape_mid, cloth_rise_clearance, cloth_waist_rise_seam, cloth_envelope_stand_up_0/1/2, task21_walk_layer_gap, seat_bake_sit_0..3, seat_bake_stand_0..3

**DRESS (15)**：sit_drape, sit_drape_mid, cloth_rise_clearance, cloth_waist_rise_seam, cloth_envelope_stand_up_0/1/2, seat_bake_sit_0..3, seat_bake_stand_0..3  
（`cloth_envelope_stand_up_4/5` 已并入 stand bake 以压到 ≤16）

**BODY (15)**：corrective_stand_up_0..8, corrective_door_0/1/4, corrective_shoulder_surface_relax, wrist_clearance_stand_up_1/2

### 烘入 basis 的源（摘要）

- 坐：seat_fix_sit_down_* + sit_drape_blend_comp + skirt_back_thin_sit_* + **手扶/回摆/sit envelope / task21_sit* / refine_sit***（COUNT 优先并入）
- 起：seat_fix_stand_up_* + skirt_back_thin_stand_* + **sit_clearance_rise / cloth_cuff_clearance**（+ DRESS env_stand_4/5）
- tip1 噪声一并删除：task21_stand_up_4/5/6(/9)、refine_stand_up_*、BODY wrist_0

## 过渡档（对照 · 已落盘）

未并 KEEP_FOR_SIT 时：APRON **32** / DRESS **35** / BODY 15 / BOW 3  
`chr_b_standup_count_v1_interim32.glb`（sha 见 `count_interim32.json`）——穿透更轻，COUNT 不达真机目标。

## 重建误差（mesh units，aggressive）

| | sit RMSE / max | stand RMSE / max |
|---|---|---|
| APRON | 0.020 / 0.055 | 0.0004 / 0.0019 |
| DRESS | 0.072 / **0.235** | 0.016 / 0.054 |

DRESS sit max ~23.5 cm 顶点误差 → 穿透风险高；PM 口径下接受并记录。

## 穿透抽检（对照 c40de312）

工具：`repo/tools/skirt-hem` hem_lib.penetration；clip = sit_down / sit_hold / stand_up @30fps。  
基线：源 FAT + `/tmp/anim_meta_c40.json` → **hits=0**。  
烘后：v1 GLB + DRAFT remap `anim_meta.json`（补丁曲线 + 保留名；**非**动画侧终稿）。

| 档 | sit_down hits / maxDepth | sit_hold | stand_up |
|---|---|---|---|
| c40 基线 | 0 / 0 | 0 / 0 | 0 / 0 |
| interim32 | 194 / 4.48 cm（apron front.mid） | **0** | 114 / 4.56 cm |
| **aggressive v1** | 684 / 3.48 cm（apron axis@0.2s） | 122 / **0.26 cm**（dress skirt.back） | 927 / **9.29 cm**（apron axis@0.9s） |

**残留结论（写清）**

1. COUNT≤16 达成后，坐/起严格 0 穿透 **未** 恢复到 c40de312；sit_hold 近可接受（≤3 mm），stand_up / sit_down 有厘米级 axis / panel 穿透。
2. 主要来自：把 hand_rest / sit envelopes / task21_sit / cuff / clearance / DRESS env_stand_4/5 压进 4+4 PCA basis，DRESS sit recon max 偏大。
3. 未跑全量 skirt-leg-penetration 门禁（含 runtime ride-seated / 负例）；未上真机 feel；未跑 Mac setCamera/board（PM 不否决）。
4. 若动画侧重接后仍不可接受：可回退 interim32（32/35）或只对 DRESS 加回 1–2 个 sit envelope / 提高 sit basis 数（会突破 16）。

明细：`pen_sample.json`。

## 动画侧重接（必须）

- 草案：`anim_meta_patch_draft.json`（deleted / added / name_to_index / curves for sit_down&stand_up bake / morph_meshes_targets_draft）
- 坐 hold：草案未写 sit_hold bake 常值；抽检用 sit_down 末帧权重；动画侧需正式写 sit_hold 的 `seat_bake_sit_*`
- 索引必须与 GLB `extras.targetNames` 对齐；旧 seat_fix_* / 已删名曲线必须摘掉，否则驱动空槽
- tip1 叠在 FAT 上的「摘曲线仍占槽」问题：本 GLB 真删槽后 COUNT 才会掉

## 产物清单（GLB 不进仓）

```
previews/角色建模bot/standup-perf-count/
  chr_b_standup_count_v1.glb              # 主交付 COUNT 16/15/15/3
  chr_b_standup_count_v1_interim32.glb    # 过渡 32/35
  anim_meta_patch_draft.json
  anim_meta.json                          # 抽检用 DRAFT remap（勿当终稿）
  count_before_after.json
  pen_sample.json
  bake_report_internal.json
  REPORT.md
  src/bake_count.py  src/glb.py
```

仓内：`docs/handoff/角色建模bot/STANDUP-PERF-COUNT-20261105.md` + `standup-perf-count/` 脚本与 JSON 副本。

## 未测 / 不做

- 真机 feel / Cocos CC_MORPH_TARGET_COUNT 日志（需集成替换 GLB+meta）
- 全量 skirt-leg gate、截图 QA、Mac board
- 灯塔右手环线 / 半蹲 / 走路穿裙（暂停，见 HANDOFF）
