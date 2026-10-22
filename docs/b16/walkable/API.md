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
