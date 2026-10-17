# 湖畔灯光精简（DC 兜底，Mac 实测 DC > 60 时再用）
- 分支 integration/build05-next-lights-20261017T0445，基于 f60c8ec，只有 1 个提交：**268b58e452ad618bcab9a65587a1febe907d12d4**。f60c8ec 那条分支没动，只在本地。
- 应用：`git fetch lakeside-lights-trim.bundle integration/build05-next-lights-20261017T0445:integration/build05-next-lights-20261017T0445`（前置提交 f60c8ec），或 `git am 0001-*.patch`。

## 改了什么（按 lead 裁定）
- 去掉亮度 0.08 的 Sun.001。它的贡献并进环境光：湖畔显示时，场景 ambient.skyIllum ×1.08（+8%）；隐藏或销毁时恢复原值。这个 8% 是按"约等于该灯 0.08 的份额"估的，需要看实机截图再调（`LAKESIDE_LIGHT_TRIM.ambientFold`）。
- Sun（1.0）和 SUN_dusk_side（0.31）的范围从 600 改成 **40**。
  - 注意：原来的灯放在离棋盘 220 m 的地方，范围 40 根本照不到。所以沿原方向拉近到离棋盘中心 **20 m**。
  - 亮度按平方反比和 Cocos 范围衰减换算，棋盘中心受光和原来一样，测试里误差小于 1%。
- 开关都在 `LakesideSceneData.ts` 的 `LAKESIDE_LIGHT_TRIM`：
  - `enabled:false`：回到原来 3 盏灯、600 范围。
  - `keepMainFull:true`：Voice Bot 方案，1.0 主灯保持 220 m / 600 不动，只精简 dusk 灯。

## 覆盖范围
- 棋盘外缘 x ∈ [−3.85, 3.85]、z ∈ [8.15, 15.85]，半对角线 5.44 m（HANDOFF §2）。
- 灯在 20 m 处时，棋盘四角距离：Sun 是 15.5–24.9 m，dusk 是 16.1–24.5 m，都在 40 以内，最远的角也只到 0.62 倍范围。
- 在 r=40 下扫描了 d=8–39，d=20 时四角受光最均匀。均匀度（最暗角 / 最亮角）约 0.29，原来近似平行光约为 1。所以棋盘上会有明显的明暗渐变，需要看截图。
- 仍在范围内的实例：Sun 覆盖 386 个，dusk 覆盖 345 个（共 465 个）。

## Draw call 估算（B1 instancing 后，基础 pass 42 批）
| 方案 | 叠加光 pass | 估算 DC |
|---|---|---|
| 现在（3 盏 × 600） | 42 + 42 + 42 | 约 168 |
| lead 方案（本提交：2 盏 × 40） | 42 + 42 | **约 126** |
| Voice Bot 方案（主灯 600，dusk 40） | 42 + 42 | 约 126 |

⚠️ 缩小范围本身几乎不省 DC：42 种 GLB 里每一种都至少有一个实例在棋盘 40 m 以内，而 instancing 批次只要有一个实例被照到就整批多画一遍。省下来的 42 个 DC 全部来自去掉 0.08 那盏灯。两种方案估算都是 126，都可能仍然超过 60。若实测还超，可以考虑：只留 1 盏 SphereLight（≈84），或者不用 SphereLight、改用烘焙或调色板提亮（≈42）。以 Mac 实测为准。

## 测试
- 新增 lakeside-lights-trim：
  - 只放 Sun 和 dusk 两盏；
  - 范围 40，棋盘四角都在 0.7 倍范围内；
  - 方向不变，中心受光不变；
  - 测了两个开关（keepMainFull、enabled:false）；
  - ambient 显示时 ×1.08，隐藏或销毁时恢复。
- lakeside-entry 有一处断言随代码改了（onlyLayer 的跳过逻辑移到了 lakesideLightPlacements）。
- Suite 57 项 52 项通过；没通过的只有已知 5 项。见 suite.txt。
- 包体：只改脚本，约 +1 KB。
