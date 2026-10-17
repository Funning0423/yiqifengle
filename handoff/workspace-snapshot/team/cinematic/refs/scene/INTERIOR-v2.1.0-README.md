# GROKBOT-ART-001-INTERIOR v2.1.0（灯塔室内 + 门/椅子锚点 + 碰撞）

- **任务**：ART-001。按交付顺序这是第一个包，岛外景包 `GROKBOT-ART-001-ISLAND-EXTERIOR-v2.1.0` 在它之后。
- **状态**：已交付，**未验收**。引擎导入、真机和预算都还没测（见测试报告）。
- **作者**：Grok Bot（GBT）。全部是原创的程序化资产（Blender 4.5.14 脚本），本包里没有队友资产。
- **生成时间**：2026-10-08T23:20:11Z（UTC）。源目录是 `env_assets/`（v2.1.0），本包是它的只读快照。

## 1. v2.1 相对 v2.0 改了什么
- **门把手对齐 handleAt**：只挪了门把手（里外两个圆环和底板），对到 CommonR2 interaction_anchors 的 handleClosed (−0.43, 1.1287, −0.0424) m。
  - 关门时握点偏差 0，开到 86.4° 时也是 0；v2.0 偏 0.1157 m。
  - **门的尺寸、铰链和开门角度都没改**：门扇 x/y 尺寸一样，面数 844 不变。包围盒 z 方向变了 1.79 mm，只是把手的厚度。
  - `door_handle` 锚点位置没变（本来就在 handleAt）。
- **椅子没改**：椅子和 seat_anchor 和 v2.0 逐节点比过，网格哈希一样。坐下 / 开门动画不受影响。
- **预览专用节点** `env_interior_floor_skirt_preview`：只在 `scene/env_interior_assembled.*` 里。它是地板外沿的一圈扇环（96 面，1 DC），只用来让旧的室内固定相机（z −7.30，在塔外）的预览图不露出地板切边。在 extras 和 EXPORT-METADATA 里都标了 `preview_only = true`、`ship = false`，**进游戏前要删掉或隐藏**。
  - 建议 dot 把室内相机挪进塔里（z −4.95），或者直接用 camera-world.js 的 t = 0 相机。source/ 没改。
- 调色板新加了一个中性浅灰色块（#c8c8c6，glTF UV (0.96875, 0.96875)），室内资产没有用到它，看起来和以前一样。

## 2. 目录
| 路径 | 内容 |
|---|---|
| `scene/env_interior_assembled.{glb,fbx,blend}` + `_gu.glb` | 只有室内的组合场景：塔壳、玻璃、门、合批道具、5 个动画骨架（一个 12 s idle_loop）、窗景卡、fx 空节点、语义锚点和 col_* 碰撞 |
| `assets/{glb,fbx,blend}/` | 逐资产文件（26 个）：室内塔壳 / 玻璃 / 道具 / 动画道具 / 窗景卡、门 `env_lighthouse_door`、碰撞 `env_interior_collision` |
| `assets/glb_game_units/` | 游戏单位版 `*_gu.glb` |
| `textures/` | 调色板 256²、自发光 256²、窗景 1024×512 |
| `anchors/` + `ANCHORS-interior.json` | 语义锚点：米制和游戏单位两份，ANCHORS 文件把两份合在一起 |
| `EXPORT-METADATA.json` | 约定、预算、每个资产的面数 / DC / 骨骼 / 文件 sha256 |
| `TEST-REPORT.json` | 测试结果（passed / failed / not_run） |
| `PACKAGE-MANIFEST.json` | 包里每个文件的路径、字节数和 sha256 |
| `evidence/` | glTF 校验、游戏单位核对、Blender 4.3.2 兼容、门把手测试、路线 / 可走面检查 |
| `previews/` | 室内预览。`_v2` 的图是 v2.0 渲的，和 v2.1 的区别只有门把手；`preview_interior_fixed_camera_skirt_v2_1.png` 是 z −7.30 相机加上预览裙边的效果（裙边在塔壳外面，室内的灯照不到，直接渲出来是一条暗带；所以这张预览里给它换了调色板自发光材质，模拟引擎里没有墙影的效果。它是纯色，没有地板缝） |
| `source_scripts/` | 生成和检查用的脚本 |

## 3. 约定
- 单位是米，Y-up，右手系。原点在门洞地面中心，门朝 +Z，室内在 −Z。FBX 的设置是 −Z forward、Y up、FBX_SCALE_ALL。
- **游戏单位**：`*_gu.glb` 是把米制文件挂到一个缩放 1.415282 的节点（`GU_root_x1p415282`，即 girlScale）下面。
  - 这个系数是从源码推出来的，**没有在引擎里校准过**，所以米制文件才是基准。
  - **不能认为旧项目的 1 单位 = 1 m。**
- 材质：
  - 共用一张 256 px 调色板图集 `M_env_palette`。
  - 室内塔壳用单面版 `M_env_palette_interior_1s`，需要开背面剔除。
- 动画：每个文件一个 `idle_loop`，30 fps，每个骨架不超过 8 根骨骼。
- 碰撞节点名都是 `col_*`，不渲染。**坐下和起身动画期间要关掉 `col_int_chair_seat` 和 `col_int_chair_back`**（在引擎里做）。
- 锚点是空节点，extras 里带 `interact_height`。

## 4. 数据（manifest 实测）
| | 面数 | DC |
|---|---|---|
| 室内可交付部分（不含预览裙边） | 16,286 | 10 |
| 加上预览裙边 | 16,382 | 11 |
| 算上 col_* 碰撞 | 17,349 | — |

- 骨骼一共 25 根。
- 目标是 ≤ 40k 面 / 10–12 DC。整个切片的预算是 120k 面 / 80 DC，**要在引擎里实测，现在不算通过**。

## 5. 测试
| 测试 | 结果 | 范围 / 说明 |
|---|---|---|
| gltf-transform validate (Khronos glTF-Validator) on every GLB in the package (metre + game_units + scene) | **passed** | 54 GLB; errors 0, warnings 0 |
| game_units copies: GU_root scale 1.415282 + bounds ratio (non-skinned) | **passed** | 27 files |
| Blender 4.3.2 opens every .blend (counts identical to 4.5.14) + 4.3.2 re-export validates | **passed** | {"total": 27, "passed": 27, "failed": 0, "fallback_copies": 0} |
| FBX/blend export checks (no unapplied modifiers except skin ARMATURE, no non-unit object scale) | **passed** | 60 fbx + 60 blend in env_assets checked |
| Door handle at CommonR2 handleAt, door size unchanged | **passed** | grip delta closed 0.0000 m / open 86.4 deg 0.0000 m (v2.0: 0.1157 m); tris 844->844; leaf x/y extents identical; bbox z-min +1.79 mm (handle depth only) |
| Walkable points: all interior route points / foot + door anchors on col_int_floor_walkable | **passed** | 40 points (18 interior), off walkable 0, walkable 15.21 m2 |
| Interior path clearance (exit / return / stand-up) | **passed** | walls >=0.50 m, door frame >=0.52 m, side table >=0.31 m; stand-up steps touch the chair by design |
| Chair geometry / seat_anchor unchanged vs v2.0 | **passed** | node-by-node mesh hash compare v2.0 -> v2.1: only env_lighthouse_door mesh changed |
| Engine import (Cocos Creator 3.8.x) + WeChat device run | **not_run** | no engine/device on this box |
| Budget 120k tris / 80 draw calls in engine | **not_run** | to be tested in engine - not passed |
| game_units scale calibration in engine | **not_run** | x1.415282 is source-derived only |
| Sit/stand with col_int_chair_seat/back disabled | **not_run** | engine-side |

## 6. 待处理事项
- 室内固定相机（z −7.30）在塔外：建议挪到 z −4.95，或者用 camera-world.js 的 t = 0 相机。
- 坐下和起身动画期间关掉 seat / back 碰撞。
- 引擎导入、真机测试、预算测试和游戏单位校准都还没做（not_run）。
- −X 真窗相对 v1.0 的已知差异（出门 t = 12 s 那一帧差 4.1%），详见外景包。
