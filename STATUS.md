# scene/b17-skycity-walk-r4 — 进度（场景设计部执行者）
基于 cine/p0drag9 936a3309（最初在 b916204f 上开工，后来 rebase 到这里）。worktree /workspace/wt-skw4。不 push。
- [x] 读 ui-audit/2026-10-24/p0drag8/summary.md 和 trace。用 Mac 的镜头模型复现（枢轴=脚+1.25，fov 48，390×844，Mac 的 C 记录给出俯仰和臂长）
- [x] P0 hW6 (346,581) 返回 none：r2/r3 的启发式规则只认“钻到地面下”和“飞 3 m”两种情况。从她 (11.24,9.6) 扫 4 种臂长 × 26 种俯仰 × 120 种朝向，修改前有 484 个姿态返回 none，修改后 0。改法：烘焙体素场（0.25 m 一层，按格），射线碰到几何就落到她这一侧的地面
- [x] 高：E3/E6/Root 在 (13,7.4) 差 1.5 m 停下，是 r3 的“绕远就停在近侧”规则造成的，这条规则已去掉。r3 的 y>0.3 矩形只挖掉了树根，没碰地面；剪分量也没剪掉地面（1 个分量）。院子 x 13.6–14.6 只向北开口，所以 1.7 m 直线却走 14.5–17 m 是真实绕路
- [x] 方案 C：凹角 x 12.0–13.4、z 6.8–10.2 设为不可走（noWalk，没改 GLB）。点凹角 169 次：none 0，停点被挡角 ≤ 80°（原来 90–130°）
- [x] 连通分量 1；可走格 26618 → 26594；RegionWalkableData 112 KB → 183 KB
- [x] suite：176/179，没过的 3 项是已知的 BLOCKED（Node≥22.6 两项、浏览器一项）；报告已还原，没有提交
- [x] 对比图 product/2026-10-24/skycity-walk-r4/skycity_walk_r4_before_after.png

# scene/b17-skycity-walk-r3 — 进度（场景设计部执行者）
基于 89c33d4b（已含 r2 a8e4069a）。worktree /workspace/wt-skw3。
- [x] 读 ui-audit/2026-10-24/p0drag7/summary.md
- [x] 问题 2：东侧高台 (20.84,1.65,7.13) 用 Blender 看过（/tmp 渲染）：是两根靠在蓝顶房屋上的装饰巨根（env_sky_static_palette 里一片 2 个三角形的斜面，从 (17.6,-0.4,-4.5) 一直升到 (21.3,1.45,7.2)）和房屋附属屋顶（y≈2）。不是路 → 不该可走
  - 修法：skycity spec.noWalk [[17.0,-5.2,22.8,14.6, y>0.3]]，把树根和屋顶上的格子挖掉；另外烘焙时按运行时 walkPath 的规则（8 邻接、台阶 0.36·对角、不切角、Float32 高度）算连通分量，只保留含故事节点的分量，反复算到稳定
  - 结果：可走格 27872 → 26618；连通分量 21 → 1（剔除 21 个分量共 993 格，加上 noWalk）。高台不再可走；从那里吸附到地面 (21.8,-0.17,6.6)，走回 S3 是 24.61 m
- [x] 问题 2 已提交 d3799a5d
- [x] 问题 3：S3 往东绕路。根因：E3 的目标 (13.82,7.56) 落在矮废墟墙（x≈13.4）背后那条 1.2 m 宽的窄条上，窄条只能从北边 z≈12.6 绕进去，所以寻路结果没错，只是点击的目标不对。E6 的目标是装饰树根和附属屋顶（问题 2）；树根挖掉后，射线会穿过房屋落到房子后面（39.7 m）
  - 修法 1：新增 RegionWalkable.walkTapPath（只对天空城生效）。路径长度 > 1.5×直线+1 m 时，在点击点 1.6 m 内找“走的路程 + 3×离点击点的距离”最小的可走格（有界 Dijkstra，邻接规则和 walkPath 一样），也就是让她停在墙的这一侧。RegionNodeStage.groundWalkTo 改用它
  - 修法 2：walkRayHit 里，射线在同一段挡住的格子上方、头高（1.8 m）以下飞了 3 m 以上，就算撞到墙或房子，停在这段挡格入口前面的地面上（包括从屋顶上方进来的情况）
  - 结果：E3 14.67 → 1.54 m；E6 33.09 m（上屋顶）→ 0.71 m（停在房屋西墙前）；r2 的 E0–W9p 全部不变
- [x] suite（最终状态）：174/177，没过的 3 项就是已知的 BLOCKED（Node≥22.6 两项、浏览器一项）；报告已还原，没有提交
- [x] 对比图：product/2026-10-24/skycity-walk-r3/skycity_walk_r3_before_after.png；树根渲染图：skycity_roots_annex_render.png

# scene/b17-skycity-walk-r2 — 进度（场景设计部执行者）
基于 ggbot/b17-cand-r16d becc6583。worktree /workspace/wt-skw2。
- [x] 读 ui-audit/2026-10-24/p0drag6/summary.md 的 S3 点击表；用 E0–E3 / W0 的本地+世界坐标拟合天空城模型矩阵（转约 118.9°，缩放 0.9996，平移 58.68,18.63,143.84；5 个点误差 ≤0.01 m）
- [x] 问题 1 根因：废墟墙（env_sky_ruins，x 13.4–13.6，z 4.5–13.5，墙顶 y≈1.0–1.17）的墙顶被当作地面烘焙（每格只取最高层），墙两侧地面因为头顶有“地面”被判不可走。E3 落在墙顶，A* 只能经北侧门廊上墙，所以要绕 25.85 m → 加 ridge 规则（墙顶不是地面），只对天空城生效
- [x] 问题 2 根因：W 点在 S3 东侧花坛（env_sky_static_palette，x 9.1–11.4，z 7.5–9.8，顶部 1.45）上，这些格子不可走。射线穿过花坛钻到地面下，就 break 返回 none → 天空城点到障碍物时，吸附到障碍物前方最近的可走点
- [x] 问题 3：regionBounds 把局部框当世界坐标用（错）；房屋是合并网格，超过 14 m 的 AABB 上限，镜头看不到它 → 镜头单独设 lensBox，并换算成世界 AABB；新增 1758 个天空城遮挡代理，接入 LensGuard
- [x] 重新烘焙：RegionNodes 不变（节点和边一致）；天空城可走格 27977 → 27872（-105，都是墙顶以及只能经墙顶到达的格子）；岛、草原、湖畔不变
- [x] 回归测试：test_lakeside_walkable.cjs 加了 r2 段
- [x] suite（最终状态）：174/177，没过的 3 项就是已知的 BLOCKED（Node≥22.6 两项、浏览器一项）；报告已还原，没有提交
- [x] 对比图：product/2026-10-24/skycity-walk-r2/skycity_walk_r2_before_after.png
- [x] suite 复跑（最终状态）：166/169，没过的 3 项就是已知的 BLOCKED（Node≥22.6 两项、浏览器一项）；报告已还原，没有提交

- b17 skycity-walk-r5：用 p0drag9 的 trace 真机射线在本地复现了 Mac 结果。问题是低矮花坛体素按厚度截停，以及点到树冠叶片时会走开。现在低矮物体可以穿透，点到树冠原地不动。测试 `skycity-walk-r5 Mac rays`。
- b17 skycity-walk-r6：点到墙面时她停在墙靠自己这一侧，点得高于墙面时原地不动。用 p0drag10 真机镜头写了测试 `skycity-walk-r6 Mac p0drag10 rays`。
- b17 skycity-walk-r7：点击解析到离她不到 1 m、又不是地面时，她原地不动（stay）。snapNear 的偏移权重改为 3。用 p0drag11 白天和夜间的真机射线写了测试 `skycity-walk-r7 Mac p0drag11 rays`。
