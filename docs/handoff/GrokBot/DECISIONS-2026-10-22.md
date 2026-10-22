# Grok Bot PM 决定（2026-10-22 15:24 America/New_York）

小事项按用户授权自行拍板，不打断。场景特效bot / 运镜bot 交接里「待 Grok Bot 定」项如下。

## 场景特效bot

1. **雪山白模 `SP_snowpass.glb.meta` 只有 uuid**  
   **可以。** Creator 在 Mac 导入时生成子资源 meta 是常规流程。下次在 Mac 上打开工程导入 `region_snowpass` 即可，不必先手写子 meta。

2. **`fx/r5-b11-balloon-sail` 是否 rebase 到 `55368056`**  
   **要 rebase，但先别合。** 基点 `a83e1c2b` 偏旧；需要该帆船/尾迹修复时再 rebase 到 `gbt/r5-integrated-b15`（`55368056`）后合入。b15 气球相关以 `fx/r5-b15-*` 为准。

3. **云海三角面 98,840 > 旧预算 90k**  
   **接受，不削。** 用户已于 2026-10-20 把天空城三角预算提到 100k，专为 `env_sky_cloudsea_soft.glb`。保持现状。

4. **小屋窗 A（关百叶）还是 B（开窗 / 运行时切墙）**  
   **用 B。** 开窗更贴「起风」主题，也多一层窗外纵深；合入 `fx/r5-s2-360-windowB`（`99bbeaa8` 一带）。A 方案可留作对照，不必再迭代。

## 运镜bot

5. **湖畔主镜头 7 m 还是 6 m**  
   **用 7 m**（P `[1.5,7,34.5]` → T `[1,-0.5,0]`）。6 m 在 360×780 上距右侧道具只剩约 3 px，过险。短屏（高宽比 < 2.0）仍走短镜方案。

6. **b17 着陆 0.40 m 姿势跳变**  
   **派给角色动画bot**（动作/落地姿态，不是运镜）。角色建模bot 只在动画侧确认需要改 mesh/权重时再介入。

## 接下来（给各 bot，不要求用户操作）

- 场景特效bot：按交接续做灯塔概念 v3 终参重渲，再小镇 / 庭院 v3；雪山 Creator 导入等 Mac 有空再做。
- 运镜bot：按 b18 HANDOFF「NOT DONE」写代码，主镜锁定 7 m。
- 角色动画bot：接 b17 0.40 m 着陆姿态跳变。

预览对照（窗 AB）：`previews/场景特效bot/r5/s2/room/ab/cmp_room_window_AB.png`（仅路径，未入库）。
