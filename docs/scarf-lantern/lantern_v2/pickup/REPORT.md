# lantern_pick_up 样本（角色动画bot，2026-10-22）

**状态：样本，未达到交付标准。** 按“先做 1 个样本、可行再做其余”的规则，`lantern_put_down` 和梯边版**没有做**，原因见“穿模结论”。

## 动作（2.2 s，67 帧，30 fps，t=n/30）
- 起点 = `idle_breathing_loop` f0；终点 = `idle_breathing_loop_lantern` f0（右臂 = 提灯臂）。
- f0–6 静止预备（让 0.2 s crossfade 不把腿拉偏）→ f6–28 屈膝下蹲（髋降 0.66 m 到 0.39 m，膝最大 146°）→ 前倾只在蹲深 >30% 后才开始，最大 27.3°（≤30°），任何帧都不直腿弯腰 → f28–34 手停在握把点，手型闭合 → f33 交接 → f34–58 起身，灯竖直离地后由程序摆接管 → f58–66 收到提灯待机。
- 双脚全程锁死：漂移 0.0 mm（clip 内）；crossfade 内 ≤0.5 mm。膝角每帧变化 −9.3°~+10.2°，平滑，无突伸。
- 右臂（`.L` = 她的右手）：IK 到握把点，手腕保持绑定局部（扭转 0°），外展最大 25.6°（伸手下够，未外张到身体外侧）；左臂（`.R`）随前倾自然前垂。

## 灯的放置点 / 交接
- 角色根节点空间（glTF/Cocos：+Y 上，+Z 前，她的右 = −X）：**socket.lantern = (−0.240, 0.1502, 0.160)**；灯底中心落地点 = **(−0.240, 0.000, 0.160)**，灯竖直。世界坐标 = 角色根节点变换 × 该点。
- 交接帧 **f33（t=1.100 s）**：该帧 socket 与放置点重合（误差 0.0 mm），代码在同一帧把灯从场景节点挂到 socket.lantern，并重置程序摆（首帧只记位置）。
- 交接前灯底入地 0.0 mm；起身后程序摆最大 7.96°。

## lantern_hold_R 权重曲线（[t s, w]，线性）
`[[0,0],[0.9333,0],[1.1,1],[2.2,1]]`：f28 开始合手，f33 完全握紧（=交接帧），之后保持 1。放下时用反向：交接帧开始 1→0。
> 手型目前用的是 lantern_v1 的草案 morph（lantern_hold_R_delta.npz），正式手型由角色建模bot 出。

## 穿模 QA（Blender BVH 三角形相交，30 fps 逐帧 + 4 段 crossfade，共 95 帧）
crossfade：idle_breathing_loop→pick_up、walk_stop_bodyL→pick_up、walk_stop_bodyR→pick_up、pick_up→idle_breathing_loop_lantern（0.2 s，出权重 1−k/6）。风 = 0（取灯不是行走）。

**为 0 的项**：灯×身体/左右臂/手/裙/围裙/蝴蝶结；右臂、右手×躯干/裙/围裙/蝴蝶结；左臂、左手×腿/裙/围裙；躯干×腿；所有 crossfade 帧全部为 0（除下面列出的 W0 帧外）。

**不为 0（失败项）**：
| 项 | 帧 | 峰值相交三角对 | 归属 |
|---|---|---|---|
| 腿×裙 LEG_DRESS | f10–53（44 帧） | 538 | 布料：深蹲时大腿/膝顶穿裙 |
| 腿×围裙 LEG_APRON | f11–53 | 274 | 布料 |
| 裙×围裙 DRESS_APRON | f12–52 | 1383 | 布料 |
| 裙/围裙入地 | 裙 f19–43，最深 −148.6 mm；围裙 f21–41，−105.3 mm | — | 布料：裙长 0.67 m，髋到 0.39 m 时裙摆必触地 |
| 灯×腿 L_LEG | f41–45 | 229 | 动画：起身时灯从右膝内侧掠过 |
| 右手/右臂×腿 | f41–43 | 95 / 96 | 动画：同上 |
| 左上臂×躯干 | 全程 | 13→16 | idle 基线就有 13，取灯中多了 3 |

试过的修法（各 ≤2 轮）：
1. 裙骨跟随（前片随大腿抬、后片抵消髋前倾并后撩、侧片外展）+ sit_drape 系 morph：裙入地修到 +34 mm，但裙子大幅外翻、腿×裙反而更多 → 弃用。
2. 直接借 sit_hold 的裙骨和坐姿 morph：腿×裙 989，更差 → 弃用。
3. 起身时手/灯路径外鼓 8–12 cm 绕右膝：灯×腿只从 f35–37 移到 f41–45，未消除 → 弃用。

结论：**贴地取灯需要深蹲（髋 0.39 m），这条裙子在深蹲下没有可用的布料形态**，必须由角色建模bot 出“蹲姿 drape”修正 morph（类似 sit 的 cloth_envelope 系列）才能过；按规则不靠让腿外张或缩短动作来躲。灯×右膝是动画侧问题，可以在下一版改起身路径（先抬灯再收臂），未在本轮修。

可选替代（需 PM 定）：灯放在 30–40 cm 高的场景道具上（梯边石台/木箱），只需半蹲（髋约 0.75 m，接近坐姿），裙子问题可能大幅减轻。

## 体积（计入灯塔包 80 KB）
- `lighthouse_lantern_pickup_sample.glb`：25,664 B（gzip 12,210 B），sha256 `f67f8d229bf1e6d2f1136c8a1bae680560acfb0840e18e4702aa0f47a7deb433`；compress_keeptr（旋转 0.2°、平移 0.5 mm），533 旋转键 + 48 平移键，最大误差 0.1985°。
- 灯塔包现有：提灯臂 13,172 B + 本样本 25,664 B = 38,836 B。put_down 若在 Cocos 里倒放 pick_up（WrapMode.Reverse）则 0 B；单独一段约 +25 KB；梯边版若只换放置点也可复用。

## 文件
- `lantern_pick_up_sample_{front,side,close}.mp4`、`lantern_pick_up_sample_contact.jpg`（f0/10/18/24/33/40/48/66）
- `QA_frames.csv`、`qa_frames.json`（逐帧）、`lantern_pick_up_info.json`（作者参数、每帧前倾/膝角/socket/IK 误差、morph 曲线）
- `lantern_pick_up_dense.glb`（仅 QA，不进包）、`lighthouse_lantern_pickup_sample.glb`（子包样本）
- `src/author.py`（作者）、`src/qa_pick.py`（QA/渲染）、`src/summ.py`、`src/sweep.sh`、`src/make_pack_pick.py`

## 未测
Cocos 实机（层权重切换、交接帧同帧挂接、倒放）、正式 lantern_hold_R 手型、风层、put_down/梯边版。
