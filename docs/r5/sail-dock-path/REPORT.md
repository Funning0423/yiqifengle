# 帆船靠岸——木栈桥 + 草地小路（sail-dock-path）

在 sail-art-fix 最终提交上接入 `transit_landing`：船停在水线船位、靠木栈桥，小路连续接到 `meadow_path`，帆船段计时到踏上栈桥为止。没有 push。

## 需要凌安决定

无（GBT §6 已把栈桥步行挪出 30.5 s；实测帆船段 ≈ 24.6 s，到达步行 ≈ 10.0 s）。

## 提交

父提交 `917099d867d5a03b694a60c1a2155bd8662a886c`（sail-art-fix 末端）。

| SHA | tree | 说明 |
|---|---|---|
| `e5955e2f1594d3b329068cf71f7bfc04973b1555` | `212f3cf3d882c61ab994a77adf2d914d7d9440e3` | transit_landing 入包；航线终点=landing_berth；删旧 pier_land 可见挖方；草叶清除；到达步行与时长拆分；K6/K2/K7 调光；dock-path 测试 |
| `4dbd342ad2…`（完整见 git） | — | sailshot `view=meadow` 到达连续性静帧入口 |

## §1 怎么做的

1. **水面 / 船位**：`SAIL_MEADOW_SINK=1.35` 保留；`SAIL_WATER_Y=SAIL_SEA_Y=-0.91`。`sailRoute()` 终点 = `landing_berth` 世界 (−4.4, −0.91, 48.8)，末段约 10 m 直线；无爬坡到 M0。
2. **栈桥**：`transit_landing.glb` 挂在旅程草地 `model` 下（单位局部变换），不进 SailArt 根，dispose 不销毁。删 `transit_pier_land`。河口摆到约 (−3.55, −0.91, 37.5)。`landing_path` 共用 `meadow_path` 材质；栈桥下留 `landing_sea_tile`。
3. **女孩**：S-f 站起 → 左舷跨步 (+0.62,0.60,−0.07) → `landing_step`（计入帆船段）→ `landing_walk` 加密折线 → M0/M1（到达步行，≤12 s，跟镜头）。
4. **小路接缝**：布局常量对齐 `landing_layout.json`；测试断言起点排与 `meadow_path` 水平 ≤0.02 m、高差 ≤0.01 m；末端贴栈桥根。运行时按 `grass_clear_polygons_xz`+0.3 m 剔草叶连通块。
5. **相机 / 节点**：玩法相机与 `maps/nodes.json` 未改。K6 = berth+(3.15,4.5,−6.4) 系；K2 外拉看全船+尾迹；K7 提高夜环境光、帆夜色压暗、小星点增多。
6. **时长（GBT §6）**：`build05S` ≈ **24.6 s**（起航→踏上栈桥）；`arrivalS` ≈ **10.0 s**（栈桥→小路，不计入 30.5）。

## 测试

Node 22：`run-suite.cjs` **103/104 PASS**，唯一非 PASS = `navigation-guard: BLOCKED_BROWSER`。新增 `sail-dock-path`。`test_sail_clearance` 继续 PASS（最紧间隙 ≈ 0.25 m）。

`test_frame_background.cjs` 0.1 s：**PASS**，3458 帧，最紧 clearM ≈ 2.44（t=22.7，390×844）。

## 包体 / 截图

构建与截图：**排队等构建锁**（`r5-balloon-v22` 自 07:07 持锁，当时无 CocosCreator）。完成后补 wechat-release 字节、`transport_sail` 分包、K1–K7 / K6_dock / meadow_arrival 截图与对比图。

## 可能冲突

`TransportLeg.ts`、`SailArt.ts`、`SailChannel.ts`、`SailRide.ts`、`SailShot.ts`、`RegionJourneyAdapter.ts`、`run-suite.cjs`、新 `SailLanding.ts` / `test_sail_dock_path.cjs` / `transit_landing.glb`。

## 未完成

- Creator 导入 `transit_landing` meta 子资源、build-guard、真实包截图与目视验收（等锁）。
- 到达后若常规棋盘背景是另一份草地、看不到岸边：已备 `view=meadow` 岸边检查图；正式玩法镜头若看不到岸边，REPORT 会说明。

## 磁盘

写本草稿时 `df -h ~` 可用约 5.8 GiB。
