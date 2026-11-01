# 帆船靠岸——木栈桥 + 草地小路（sail-dock-path）

在 sail-art-fix 最终提交上接入 `transit_landing`：船停在水线船位、靠木栈桥，小路连续接到 `meadow_path`，帆船段计时到踏上栈桥为止。没有 push。

## 需要凌安决定

无（GBT §6 已把栈桥步行挪出 30.5 s）。实测：

| 段 | 秒数 | 门限 |
|---|---|---|
| 帆船段 `build05S`（起航→踏上栈桥） | **24.6 s** | ≤ 30.5 |
| 到达步行 `arrivalS`（栈桥→小路→M0） | **10.02 s**（约 12.0 m） | ≤ 12 |

节拍：S-a 7.6 / S-b 2.0 / S-c 2.0 / S-d 9.0 / S-e 2.2 / S-f 1.0 / S-g 0.8（踏板）。

## 提交

父提交 `917099d867d5a03b694a60c1a2155bd8662a886c`（sail-art-fix 末端）。

| SHA | tree | 说明 |
|---|---|---|
| `e5955e2f1594d3b329068cf71f7bfc04973b1555` | `212f3cf3d882c61ab994a77adf2d914d7d9440e3` | transit_landing 入包；航线终点=landing_berth；删旧 pier_land；草叶清除；到达步行与时长拆分；K6/K2/K7；dock-path 测试 |
| `4dbd342ad29e5bcc7978ce0a7b0e6f2b6d9834a7` | `905a2204e4a70256cfc32676c2eb83729ae3a9bf` | sailshot `view=meadow` 到达连续性静帧入口 |
| `0194a6e2114fa0bec72afb1fa014a4675f3aaea5` | `9fd12249df973c8db7cb6b02373dc017942598ae` | STATUS/REPORT 草稿 |
| `1fedcffd55cc484563037ccd59c09bd8dee12241` | `603fafae991bed7a255912298c1e7cfb02201344` | Creator 导入 meta（transit_landing + SailLanding） |
| `ce116dc0395e968746ca9ce64f1d581223759d53` | `a3569fdd47b61e41e89aac017111540e0783bc68` | 路径 palette 材质、K2 构图、K7 夜星 |
| `2c07fd3bc4429de17184513422fec973c1c30b24` | `01785efdfb1f586f6185cb815fbe073f6db38151` | 小路暖沙 tint（截图用代码 HEAD） |
| `dbd922eae9887f7ea008be094191f1b3f5db3192` | `41f8e3d2a2dbd6805ae1ed0007806157d28d1198` | 截图 + 终稿 REPORT/STATUS |

## §1 怎么做的

1. **水面 / 船位**：`SAIL_MEADOW_SINK=1.35` 保留；`SAIL_WATER_Y=SAIL_SEA_Y=-0.91`。`sailRoute()` 终点 = `landing_berth` 世界约 (−4.4, −0.91, 48.8)，末段约 10 m 直线对准船位；去掉爬坡到 M0。船底/龙骨相对地形间隙测试继续 PASS（≥ 0.08 m）。
2. **栈桥**：`transit_landing.glb`（+ meshCompress 与其他 glb 一致）挂在旅程草地 `model` 下单位变换，不进 SailArt 根，`dispose()` 不销毁。删可见旧 `transit_pier_land`。河口约 (−3.55, −0.91, 37.5)。栈桥下留缩小的 `landing_sea_tile`。
3. **女孩**：S-f 站起 → 左舷跨步 (+0.62, 0.60, −0.07) → `landing_step`（计入帆船段）→ `landing_walk_*` 加密折线（邻点 ≤ 1.5 m、贴板/路）→ 草地原路线到 M0/M1（到达步行，区域节点式镜头跟随，≤ 12 s）。
4. **小路接缝**：布局对齐 `landing_layout.json`；Node 测试断言起点排与 `meadow_path` 水平 ≤ 0.02 m、高差 ≤ 0.01 m；末端贴栈桥根。运行时按 `grass_clear_polygons_xz`（path_strip、jetty）外扩 0.3 m 剔草叶连通块（`clearLandingGrass`，不改冻结 glb/effect）。
5. **材质（保守）**：`landing_path` UV 是调色板图集，直接 `setSharedMaterial(meadow_path)` 会采错贴图变成灰/黑板。改为 palette + nearest + 暖沙 `mainColor(222,198,156)`，夜间经 `take(landing)` 与草地同级压暗。写进 STATUS。
6. **相机 / 节点**：玩法相机与 `maps/nodes.json` / offsets / JOURNEY_TRANSPORT / 桥逻辑未改。K6 = berth 相对 +(3.15,4.5,−6.4) 系；K2 外拉 `back:-10.4 side:-5.8` 保证船+女孩入画与尾迹；K7 提高夜环境光、帆夜色压暗、关掉近场 `night_stars` 大菱形，改用远处小星点。
7. **到达连续性**：`transit_landing` + `landing_sea_tile` 挂在草地模型；交还后仍在。`meadow_arrival` 与旅程末帧对比证明栈桥/小路未消失。

## §7 验收项

- **a/b 灰板**：旧直角挖方改水下-only 沉降；错误共享材质去掉后 K6/俯视不再有悬空灰板盖画面；小路接到栈桥。
- **c K7**：深蓝可读夜景；帆米白压暗；近场大菱形星关掉。
- **d K2**：船与女孩完整入画，尾迹可见。
- **e**：K1/K3–K5 未改坏（重拍确认）。

## 测试

Node 22 `run-suite.cjs`：**103/104 PASS**，唯一非 PASS = `navigation-guard: BLOCKED_BROWSER`。新增 `sail-dock-path` PASS。`sail-clearance` / `sail-art` / `transport-sail` PASS。

`test_frame_background.cjs` 0.1 s：**PASS**，**3458** 帧，最紧 **clearM ≈ 2.441**（t=22.7，390×844，`meadow_terrain`）。

## 包体

| 项 | 字节 |
|---|---|
| wechat-release 总包 | **19,640,423** |
| 相对 sail-art（19,613,723） | **+26,700** |
| 硬上限 | 24,641,536 |
| `transport_sail` 分包 | **206,639**（≤ 1.0 MiB） |
| web-test | 20,429,855 |

HEAD=`2c07fd3b` build-guard both PASS。

## 截图

`docs/r5/sail-dock-path/shots/`（并复制任务包 `shots/`），均 390×844、`sips -Z 900`、&lt; 400 KB：

- `K1_board_pier` … `K5_enter_river`、`K6_dock`、`K6_dock_top`、`K7_night_open_sea` + 各 `*_vs_render.png`
- `meadow_arrival`、`meadow_arrival_vs_lastjourney.png`

## 可能冲突

`TransportLeg.ts`、`SailArt.ts`、`SailChannel.ts`、`SailRide.ts`、`SailShot.ts`、`RegionJourneyAdapter.ts`、`run-suite.cjs`、新 `SailLanding.ts` / `test_sail_dock_path.cjs` / `transit_landing.glb(+meta)` — 与 balloon-v22 / region-nodes-r3 可能撞。

## 未完成 / 残留

- `landing_path` 仍偏平灰（palette UV 无法直接吃 meadow_path 贴图）；暖沙 tint 已加，细纹理与美术渲染不完全一致。
- K7 小星点在 390 宽上几乎看不见；帆仍偏亮于环境（已压到夜色蓝灰，未再做贴图暗化）。
- 岸线仍偏硬（水下-only 挖方，未做可见自然岸 mesh）。

## 磁盘

交付时 `df -h ~` 可用约 **5.7 GiB**。
