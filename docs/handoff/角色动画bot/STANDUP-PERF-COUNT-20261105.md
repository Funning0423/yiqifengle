# tip · 起身 COUNT53/73 · 需建模 · 2026-11-05

Feel-control `1.0.202611050247` @ `0421cfff`：**走路流畅、起身仍卡**；已叠 tip1 `299afe73`（stand_up 曲线 31→23）仍 **不减** GPU `CC_MORPH_TARGET_COUNT53` / `COUNT73`。无 TSW 也卡 → 非 TransitionShaderWarm。

## 一句话结论

**需建模（路径 C）**：live 角色 GLB 是 **APRON 53 / DRESS 73 / BODY 16 / BOW 3**（即日志 COUNT53/73/16/3）；动画侧再砍曲线 **降不了** shader COUNT。真正吃 COUNT 的是 `seat_fix_*` + `skirt_back_thin_*` 坐姿裙修形资产（满权重、建模 `c40de312`），删了要重烤/QA，**不属于动画 bot 可安全真删范围**。

## 关键事实（纠正 tip1 文档）

| 项 | 事实 |
|---|---|
| tip1 文档写的「岛上 APRON29/DRESS32」 | **过时**：那是角色动画bot 工作树里的瘦 GLB，**不是** live/integrate/repo |
| live / `067afacf` integrate GLB | APRON **53** / DRESS **73** / BODY 16 / BOW 3 |
| `CC_MORPH_TARGET_COUNT53` | = `LOD0_G2_APRON` 的 shape key 数 |
| `CC_MORPH_TARGET_COUNT73` | = `LOD0_G2_DRESS` 的 shape key 数 |
| tip1 叠合 | 只换了 `anim_meta`（曲线 23 + 瘦驱动表）；**FAT GLB 未动** → COUNT 不变 |
| tip1 叠合副作用 | FAT 上的 `seat_fix_*` / `skirt_back_thin_*` / `sit_drape_blend_comp` **曲线被摘掉但仍占 morph 槽** → GPU 仍按 53/73 编着色器，坐姿裙修形可能已不驱动（视觉回退风险） |

预览证据（不进仓）：`/workspace/yiqifengle/previews/角色动画bot/standup-perf-count/cut_list.json`

## 三条路评估

### A. 本 bot Blender 真删无引用 key

| 可删（tip1 明确当噪声摘掉） | mesh | 预期 COUNT |
|---|---|---|
| `task21_stand_up_4/5/6` + `task21_refine_stand_up_174/208` | APRON ×5 | 53→**48** |
| `task21_stand_up_4/5/6/9` + `task21_refine_stand_up_174` | DRESS ×5 | 73→**68** |
| `wrist_clearance_stand_up_0` | BODY ×1 | 16→**15** |

**不交付 A 作为本 tip**：只降 5/5/1，**动不到 COUNT53 体感**；且工作树 GLB 是瘦的，真删必须先从 live FAT GLB 开工。  
**禁止**把下方「建模资产」当无引用删掉冒充降 COUNT。

### B. 起身专用低 morph 变体

思路：sit 段用全量 mesh；stand_up 换 ≤16 target 的围裙/裙变体。  
**缺口**：`CharacterMotion` / MorphDriver **无** mesh/morph-set 热切换；要 GGbot 加资源绑定 + 过渡时切 renderer/morph 实例。动画侧单独交不出可跑变体。  
→ 记给 GGbot；本 tip 不交付。

### C. 正式「需建模」（本 tip 采纳）

把 APRON/DRESS 上的逐帧 `seat_fix_*` / `skirt_back_thin_*` **烘成少量 basis**（或坐/起各一套低 morph LOD），才能把 COUNT53/73 打到手机可起身的档位。

## 砍清单摘要（给角色建模bot）

### Live 槽位

| mesh | live COUNT | tip1 安全可删 | 建模烘培候选 | 建议目标 |
|---|---:|---:|---:|---:|
| LOD0_G2_APRON | 53 | 5 | 24（seat_fix×23 + sit_drape_blend_comp） | **≤16**（过渡 ≤32） |
| LOD0_G2_DRESS | 73 | 5 | 41（seat_fix×36 + skirt_back×5 + blend） | **≤16**（过渡 ≤35） |
| LOD0_G2_BODY | 16 | 1（wrist_0） | 0 | ≤12 |
| LOD0_G2_BOW | 3 | 0 | 0（tip1 驱动表曾摘 BOW，需复核 ribbon） | 3 |

### 必须保留（动画驱动 / 起身观感）

- 布料主链：`sit_drape` / `sit_drape_mid` / `sit_clearance_rise` / `cloth_rise_clearance` / `cloth_waist_rise_seam` / `cloth_cuff_clearance` / `cloth_envelope_stand_up_0/1/2/(4/5)`  
- BODY：`corrective_stand_up_0..8`、`corrective_shoulder_surface_relax`、`wrist_clearance_stand_up_1/2`  
- 原则：自然摆臂；穿帮靠布料 collider / 形变，**禁止**拧腕外撇

### 建模烘培对象（满权 peak=1，来自 `c40de312` 坐姿裙修）

- APRON：`seat_fix_sit_down_04..08,20..29`（15）+ `seat_fix_stand_up_03..10`（8）+ `sit_drape_blend_comp`  
- DRESS：`seat_fix_sit_down_04..08,20..35`（21）+ `seat_fix_stand_up_02..15`（14）+ `skirt_back_thin_sit_d_26/32` + `skirt_back_thin_stand_02/08/11` + `sit_drape_blend_comp`  
- 建议：坐、起各烤 **≤4** 个 basis（或 PCA/关键帧合并），写回 anim_meta 曲线；顺带可删 tip1 安全噪声 11 槽

### tip1 安全可删（建模包里顺手删即可）

- APRON `[21,22,23,27,28]`：`task21_stand_up_4/5/6`、`task21_refine_stand_up_174/208`  
- DRESS `[22,23,24,25,31]`：`task21_stand_up_4/5/6/9`、`task21_refine_stand_up_174`  
- BODY `[13]`：`wrist_clearance_stand_up_0`

### 验收

1. 新 GLB：`CC_MORPH_TARGET_COUNT*` 日志 APRON≤16（过渡≤32）、DRESS≤16（过渡≤35）；BODY≤16  
2. 坐/起裙前摆穿透不回归（对照 `c40de312` 门禁）  
3. anim_meta 索引与 `extras.targetNames` 对齐；stand_up 曲线驱动烘后 basis  
4. Tangents=Exclude；包体预算参考原 ~3.2MB 角色 GLB，增量勿暴涨  
5. 手机 feel：起身不再明显卡于走路

## 交给 GGbot

1. 续 tip1：起身前 warm-sample；预热新 COUNT 宏（目标 COUNT16 档，不再按 53/73）  
2. **不要**在 sit→stand 重建 AnimRig  
3. 若走路径 B：需 morph-set / mesh LOD 热切换 API（当前无）  
4. 叠合时：**FAT GLB + 匹配的 anim_meta 必须成对**；禁止再把瘦驱动表盖到 FAT GLB 上导致 seat_fix 占槽却不驱动

## 交给产品经理

- 本 tip **无新动画 SHA 可叠**（故意不交「再砍曲线」）  
- 请转 **角色建模bot** 按上表烘培；动画 bot 可在建模出 GLB 后重接 anim_meta 曲线  
- 注意：当前 feel-control 叠 tip1 后，seat_fix 可能已不驱动但仍付 COUNT53/73 成本 — 短期要么恢复曲线（更卡），要么加速建模降槽

## 不做

- 不再只删 anim_meta 曲线冒充降 COUNT  
- 不在未建模 QA 下删除 `seat_fix_*` / `skirt_back_thin_*`  
- 不改手臂 timing / 根位移躲裙

## 已测 / 未测

- **已测**：live/integrate/repo GLB morph 名与计数；tip1 vs repo 曲线对照；seat_fix/skirt peak=1；shader 宏与 mesh 对应；CharacterMotion 无 morph 变体切换  
- **未测**：手机在建模降 COUNT 后的起身帧率；Blender 烘培视觉；恢复 seat_fix 曲线后的卡顿对比

## 分支

- `anim/standup-perf-morph2`（本文档 + HANDOFF；**无** GLB/anim_meta 伪降 COUNT 提交）
