# 可走区查询接口（b16）— 给运镜bot

模块：`creator-build-project/assets/scripts/region/RegionWalkable.ts`。它是纯逻辑，不依赖 `cc`，可以直接 import，也可以在 node 测试里加载。
数据：`region/RegionWalkableData.ts`，由 `tools/region-walkable/bake-region-walkable.cjs` 从出包的 GLB 和湖畔 r5h3 transforms 烘出来。湖畔数据已包含 b16 栈道。
校验：`node tools/region-walkable/bake-region-walkable.cjs --check`。
回归测试：`tools/lakeside-walkable/test_lakeside_walkable.cjs`。

```ts
import {nearestWalkable,isWalkable,walkFloorY,walkRayHit,walkPath,lineWalkable,walkPathLengthM,walkGrid,
        WALK_REGIONS,WALK_STEP_M,type WalkRegion,type WVec,type NearestHit} from '../region/RegionWalkable';
```

## 坐标系（重要）

所有输入和输出都是**区域模型本地坐标**，单位米，y 轴朝上。它和 RegionNodes 的 `at` 以及 LakesideCameraLayout 的 `stopLocal` 是同一套坐标。

模型节点：

| 区域 | 模型节点 |
|---|---|
| lakeside | `RegionJourney-lakeside` 下的 `LakesideJourneyScene` |
| meadow / skycity | `RegionJourney-<region>.children[0]` |
| island | 没有缩放节点；本地坐标等于世界坐标 |

做法与 RegionNodeStage.model() / toWorld() 一致：

- 世界坐标转本地：`Vec3.transformMat4(out, world, Mat4.invert(tmp, model.worldMatrix))`
- 本地坐标转世界：`Vec3.transformMat4(out, local, model.worldMatrix)`

**不要把世界坐标直接传进来。** 湖畔模型有缩放和平移，直接传世界坐标会落到错误的格子。

## 类型

- `WalkRegion = 'island'|'meadow'|'skycity'|'lakeside'`
- `WVec = readonly [x,y,z]`

## 函数

| 函数 | 返回 | 说明 |
|---|---|---|
| `nearestWalkable(region, pos, radiusM=3)` | `{at, distanceM, exact} \| null` | **吸附用。** 见下一节。 |
| `isWalkable(region, x, z)` | boolean | 该 xz 所在格是否可走。 |
| `walkFloorY(region, x, z)` | number \| null | 可走地面高度；不可走时返回 null。 |
| `walkRayHit(region, origin, dir)` | `{kind:'walk', at} \| {kind:'water', at} \| {kind:'none'}` | 本地空间射线（例如屏幕点击的射线），返回第一个碰到的可走地面或水面。 |
| `walkPath(region, from, to)` | `WVec[] \| null` | A* 寻路后再拉直，路径只走在可走区上。到不了时返回 null，例如湖面或隔断。 |
| `lineWalkable(region, a, b)` | boolean | 线段每 0.1 m 采样一次，要求全部可走，且每步高差 ≤0.36 m。 |
| `walkPathLengthM(path)` | number | 路径长度，单位米。 |
| `walkGrid(region)` | `{W,H,c,x0,z0,waterY,minY,h}` | 原始网格。`c=0.4` m；`h[i]` 是地面高度，`NaN` 表示不可走。 |

## 打断落地时把阿芳吸到最近可走点

```ts
const local = worldToLocal(region, afangWorldPos);          // 用上面的 invert(worldMatrix)
const hit = nearestWalkable(region, local, 3);              // 3 m 内找
const snap = hit ? hit.at : nearestWalkable(region, local, 12)?.at; // 远一点再兜底
if (snap) afang.setWorldPosition(localToWorld(region, snap)); // y 已经是地面高度
```

`nearestWalkable` 的语义：

- `pos` 所在格本身可走时，返回 `pos` 自身的 xz 加上该格地面高度，`exact = true`，`distanceM = 0`。例外：高差超过 1.5 m 时，`distanceM` 等于这个高差。
- `pos` 所在格不可走时，在 `radiusM` 半径内找最近的可走格中心，`exact = false`，`distanceM` 是水平距离。
- 搜索时优先选高度和 `pos.y` 相差 1.5 m 以内的地面，所以在楼梯或桥面上不会被吸到桥下。
- 半径内一格可走的都没有时返回 null。这时可以加大半径再查一次，或者退回落地停点：
  - 湖畔用 `LAKESIDE_CAMERA_LAYOUT.stopLocal`；
  - 其他区域用 `REGION_NODES[r].nodes[0].at`。
- 开销：半径 3 m 约 240 格，半径 12 m 约 3.6k 格，单次都在毫秒以内，每帧调用也没问题。

## 各区覆盖（0.4 m 格）

| 区域 | 可走格 | 面积 | 备注 |
|---|---|---|---|
| island | 3642 | 146 m² | 海面 y = -0.6 |
| meadow | 23987 | 3838 m² | 限 exploreBox；房子、石头、树干处挖空；河面不可走 |
| skycity | 24093 | 3855 m² | 限 exploreBox；每格只保留可达的最高一层（桥下那层不算） |
| lakeside | 11183 | 1789 m² | 水面 y = 0，永不可走；近岸、b16 栈道（x=-13）、远岸、拱桥全部连通 |

规则：

- 地面平整度 |ny| > 0.72；
- 每 0.4 m 的台阶高差 ≤0.36 m；
- 头顶净空 1.7 m；
- 从落地点开始泛洪，到不了的碎块会被丢掉。

## b17 skycity-walk-r2（Mac p0drag6）

- 天空城烘焙加了 `ridge` 规则：一格宽、沿一个轴（含对角）两侧都比它低 0.5 m 以上的地面层（墙顶、栏杆顶）不算可走。S3 东侧 0.2 m 宽的废墟墙顶以前可走，点墙会绕门廊走 25.85 m。
- `walkRayHit` 在天空城（`WALK_TAP_SNAP=['skycity']`）：射线在头高以下穿过挡住的格子（花坛、墙）后钻到地面下，就返回障碍物前方 1.6 m 内最近的可走点（kind 'walk'），不再返回 'none'。湖畔、小岛、草原的行为不变。
- `RegionGraph.lensBox`（可选）：镜头用的框，天空城是 [-34.8,-41,39.6,47.6]（烘焙地面范围）。`RegionNodeStage.regionBounds()` 现在用模型矩阵把这个局部框换成世界 AABB 再交给 FreeOrbit。以前直接把局部框当世界坐标用；天空城模型转了约 119°、离原点约 150 m，这样用是错的。
- `SkycityLensOccluders.ts`（由 `tools/region-walkable/gen-skycity-lens-occluders.cjs` 生成，模型局部坐标）：天空城房屋、废墟、墙的镜头遮挡代理，每 1 m 一列，只收可走区 7 m 内的；运行时只取她 18 m 内的交给 LensGuard。

## b17 skycity-walk-r3（Mac p0drag7）

- 天空城东侧蓝顶房屋旁的两根装饰巨根和房屋附属屋顶（本地 x 17.0–22.8，z −5.2–14.6，高于 y 0.3 的部分）**不可走**（bake spec `noWalk`）。这个范围里只有 y≤0.3 的地面可走。
- 天空城可走区只有 **1 个连通分量**（按 walkPath 的规则：8 邻接、台阶 ≤0.36 m×对角系数、不切角、Float32 高度），所有故事节点都在里面。bake 时会剔除不含节点的分量（`keepNodeComponents`），所以不存在上得去下不来的格子。
- `walkTapPath(region, from, to)`：点地用这个，不用 walkPath。天空城里如果点到的地方要绕很远（路径 > 1.5×直线+1 m，例如矮墙背后），就改走到点击点 1.6 m 内“路程 + 3×偏移”最小的格子，也就是墙的这一侧。其他区域和直线可达的点击，结果和 walkPath 相同。
- `walkRayHit`（天空城）：射线在同一段挡住的格子上方、头高以下飞了 3 m 以上，就算撞到房子或墙，返回这段入口前面的地面，不会再穿过房屋落到房子后面。

## b17 skycity-walk-r4（Mac p0drag8 / p0drag9 方案 C）
- r3 的两条规则去掉了：`walkTapPath` 现在就是 `walkPath`（点到可达地面就走到点击点，误差 ≤ 0.3 m）；“头高以下飞 3 m 算撞墙”也去掉了。
- `walkRayHit(region, o, d, maxM?, stepM?, from?)`：天空城的射线额外查一张烘焙的体素场（`RegionWalkableData.skycity.obs/obsH/obsSlab`，每格 0.25 m 一层，记录墙、房、篱笆、树根、树冠、崖壁的表面采样；可走格只记地面以上 0.3 m 的东西；高度只取最低地面 −2.5 m 到最高地面 +12 m）。射线碰到场景几何一定返回 'walk'，不会是 'none'：
  - 在离地 2.5 m 以内穿过 ≥ 0.6 m 的体素（厚墙、树根），或者从体素里出来进到不可走格且头顶还有几何（穿过地面或进到房子里面），或者从几何里出来时已经在地板下面，就算命中；
  - 命中后的落点：给了 `from`（她的位置）时，取“从她走过去的路程 + 2 × 离命中点的平面距离”最小的可走格（Dijkstra），也就是停在她这一侧；没给时，取命中点前 0.3 m 的最近可走点（1.6 → 24 m）；
  - 擦过细杆、树叶片、2.5 m 以上的树冠、檐口的射线照常落到后面的地面；完全没碰到东西的射线（天空）仍是 'none'。
- 方案 C：矮篱笆西侧凹角 x 12.0–13.4、z 6.8–10.2 设为不可走（spec.noWalk，没改 GLB）。站在那里时，6 m 环绕镜头有 90–130° 的方向被篱笆或房子挡住；现在点那里，她会停在凹角西边，被挡的角度 ≤ 80°。
- `RegionNodeStage.groundTap` 会把她的位置传给 `from`。
