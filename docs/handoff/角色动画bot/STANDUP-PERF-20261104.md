# tip · 起身卡顿（动画侧）· 2026-11-04

体验版 `1.0.202611031613` @ tip `fb74d437`：Funning「人物起身最卡」。本 tip 只动动画侧（clip / morph 曲线 / 驱动表）；runtime 预热归 GGbot；**不改手臂动作**躲裙。

## 结论（一句话）

动画侧主因是 **sit_hold→stand_up 瞬间 morph 从 ~4 路暴涨到 ~30 路**（含 6 条 task21 单帧尖峰 + 稠密 cloth_envelope），GPU 走 `CC_USE_SKINNING1|CC_USE_MORPH1`（日志 COUNT53/73）；**不是**起身时 AnimRig rebuild（rebuild 仅启动 ctor 一次）。

## 证据

| 项 | 事实 |
|---|---|
| `[walk-driver] rebuilt states without clip evaluator: stand_up:direct-trs,...` | `WorldIntegrationBoot.ts` `AnimRig` **构造函数**内 `requireDirectTrsStates` + `repairStates`；mac-selftest-fb74d437 `console.log` **仅一条**，在 `WORLD_STARTUP_READY` 之前 → 启动成本，非起身帧 |
| sit_hold 有效 morph | 4：`sit_drape` / `hand_rest_support` / `corrective_stand_up_0` / `corrective_shoulder_surface_relax` |
| stand_up 有效 morph（改前） | 30；相对 sit_hold **新开 27 路**（约 1.27 s） |
| 岛上 GLB morph 槽 | APRON 29 / DRESS 32 / BODY 16 / BOW 0；anim_meta 驱动名合计 **52**（与 COUNT53 接近） |
| 曲线噪声 | `wrist_clearance_stand_up_0` peak≈0.042；`hand_rest_support` 在 stand_up 上全 0；`task21_stand_up_*` / `task21_refine_stand_up_*` 各 5 keys 单帧尖峰；`cloth_envelope_stand_up_0/1/2` 141/299/173 keys |
| sit_down 死曲线 | `corrective_door_0/1/4` 各 145 keys、peak=0（仍挂在 sit_down） |

预览统计（不进仓）：`/workspace/yiqifengle/previews/角色动画bot/standup-perf/`（`curve_analysis.json`、`patch_stats.json`）。

## 本分支已落地的动画侧减负（`anim/standup-perf-morph`）

改文件：`creator-build-project/assets/bundles/region_island/character/anim_meta.json`

1. **删 stand_up 噪声/尖峰曲线**（8）：`wrist_clearance_stand_up_0`、`hand_rest_support`（本 clip 全 0）、`task21_stand_up_4/5/6/9`、`task21_refine_stand_up_174/208`
2. **抽稀** `cloth_envelope_stand_up_0/1/2`（869→315 keys 量级；包络形状保留）
3. **删 sit_down 零权重 door 曲线**（3）：`corrective_door_0/1/4`
4. **驱动表摘掉** 上述仅 stand_up 用且已无曲线的 target（APRON/DRESS/BODY 共 11 条映射；**网格 shape key 仍在，COUNT 不变**）

效果（曲线层）：stand_up 曲线 31→23；sit→stand **新开** 27→20；每帧仍按 `morphMeshes.targets` 求值，但少 7 路从 0 冲非零的 `setWeight` 尖峰。

## 必须保留（QA）

- `sit_drape` 释放、`sit_drape_mid`、`sit_clearance_rise`
- `corrective_stand_up_0..8`、`corrective_shoulder_surface_relax`
- `cloth_rise_clearance` / `cloth_waist_rise_seam` / `cloth_cuff_clearance`
- `cloth_envelope_stand_up_4/5` 与抽稀后的 `0/1/2`
- `wrist_clearance_stand_up_1/2`（peak=1，真清腕；**禁止**改成拧腕/外撇手臂）
- 原则：穿帮靠布料 collider / 形变，不改手臂 timing/root

QA 注意：起身中段围裙/裙摆瞬时穿帮是否因砍 task21 尖峰变明显；若有，优先加 collider 或短 corrective，**不要**拧腕。

## 交给 GGbot（runtime）

1. **不要**在 sit→stand 再跑 `AnimRig.repairStates` / 重建 state（当前 ctor 一次即可；请保持）
2. 起身前 **warm-sample** `stand_up`（pose + morphWeights 走一遍，把将非零的 target 先 `setWeight`），避免首帧 20+ 路齐写
3. Shader / morph **预热** 精确宏：`CC_USE_SKINNING1|CC_USE_MORPH1` 及日志里的 `CC_MORPH_TARGET_COUNT53` / `CC_MORPH_TARGET_COUNT73`（含 `CC_MORPH_PRECOMPUTED1` 变体），覆盖起身灯光组合
4. 确认 MorphDriver `MORPH_EPS=1e-3` 路径在起身段无额外整表清零重写

## 角色建模bot

**需要（可选、结构性 GPU 收益）**：从角色 GLB 删掉已不再驱动的 shape key（本 tip 摘掉的 `task21_stand_up_*`、`task21_refine_stand_up_*`、`wrist_clearance_stand_up_0` 等），把子网格 morph COUNT 从 ~29/32 降下来，才能动到 `CC_MORPH_TARGET_COUNT*`。仅改 anim_meta **降不了** shader COUNT。若暂时不做网格砍键，写「可延后」。

## 不做

- 不改手臂/根位移/stand_up timing
- 不写 Cocos 预热代码（GGbot）
- 不把 sit 专用 drape 硬留在 stand 全段

## 已测 / 未测

- **已测**：anim_meta 曲线统计；fb74 日志 rebuild 时机；AnimRig 源码 ctor-only；岛上 GLB morph 槽计数
- **未测**：本 tip 合入后手机实机起身帧率；Blender 30 fps 视觉回归（砍 task21 后）；COUNT 砍键后的 GPU 对比（需建模）
