# r5-balloon-v25fix

在 v24fix（`c7d023b47cb01c47aaff07ab2c00163ce8b9ecc5`，tree `f7a777e18d910933987ee86f2e9fa36697d2b7ee`）上小改。分支 `gbt/r5-balloon-v25fix`。未 push。

## 提交

| SHA | tree | 说明 |
| --- | --- | --- |
| `dd5789b8e43a627497107d2d595855f689f9839e` | `7b4ad5cb7f145f6defff4395a5cd4dcc21155ba6` | 白天球囊、巡航云海、降落岛体、天空抖动、树冠 alpha |
| `c7878f189130b5f50534a649f92e7d6595933e89` | `9dc3e519e6892f4477dfaa75d9f7aa434bcaf9e2` | STATUS |
| `37ab9b36318662255c6c5d8e07b7ed2d55f7cb9d` | `5512f291d4d5eb975717d63655beb3457855177f` | 去掉着色器里没有 uniform 的 `mainColor`（否则效果导入失败） |
| `385dab1ca99bec460c755ff71f73fa0a64bf85b5` | `7efbe02fc73c2387e6ddf7ad6387018b015a3edb` | 截图、对比图、本报告初稿 |

游戏代码以 `37ab9b36` 为准。最终门禁跑在 `385dab1ca99bec460c755ff71f73fa0a64bf85b5`（含截图与报告，不含游戏改动）：`BUILD GUARD PASSED`，wechat-release 19,960,670 B，web-test 20,753,299 B，`dirty=0`。其后的提交只补本段和 STATUS 的交付行。

## 1. 03/04 巡航球囊偏暗

原因：接缝之后镜头在球囊的背光一侧。球囊仍走标准光照，红、黄被阴影乘暗；贴图本身是亮红 `(224,64,48)` / `(176,48,32)` 和黄 `(240,192,64)`。夜间压暗没有在白天打开。

修法：白天和夜间都改成 `builtin-unlit` 乘反照率。白天 `mainColor` 为白，`colorScale` 为线性 `(1.12, 1.12, 1.12)`，把显示出来的红 R 和黄 G 抬过 200。火焰 `burner_flame` 不动。夜间仍是 `Color(118,110,116)`，与 v24fix 相同。

证据（实拍平均 RGB，R>180 且明显偏红 / R、G>170 且偏黄）：

| 镜头 | 红 | 黄 |
| --- | --- | --- |
| 02 起飞 | (222.8, 72.2, 60.0) | (229.8, 213.5, 75.1) |
| 03 穿云 | (222.1, 73.2, 59.8) | (229.5, 213.1, 75.5) |
| 04 巡航 | (223.0, 72.0, 60.0) | (229.7, 213.3, 75.3) |
| 05 城 | (219.7, 77.9, 61.2) | (227.0, 212.0, 79.7) |
| 06 降落 | (222.7, 72.4, 60.0) | (229.2, 212.9, 76.1) |
| 07 夜 | (131.1, 57.1, 18.6) | 没有亮黄块 |

04 的红 R 与黄 R、G 都大于 200。07 红通道大约 131，夜景压暗还在。截图：`02_liftoff.png`、`03_clouds.png`、`04_cruise.png`、`05_city.png`、`06_land.png`、`07_night.png`。

## 2. 04 巡航云海是一块平涂

原因：`clouds_floor` 顶点亮度均值约 0.82、标准差只有约 0.059，简单重映射拉不开明暗。城出现之后 `clouds_horizon` 被关掉，云和天空的交界变成远景卡片的硬边；云缝里看见的也是那张卡片。

修法：白天用 `balloon-grade.effect` 的 cloud-day，把 `(l-0.82)/0.059` 拉开后在浅灰蓝 `(0.55,0.64,0.75)` 和白之间混合。作用在 `clouds_floor`、`clouds_floor_puff`、`clouds_city_sea`、`clouds_horizon`。夜间仍是 v24fix 的 unlit `RGB(68,80,94)` 乘顶点色，不走这条拉伸。`clouds_horizon` 只在 `t<21.5`（`ISLETS_ON_T`）显示，所以 04（t=18.5）有远云，05（t=24）关掉，避免把 DC 顶过 53。

证据：`04_cruise.png`。下半屏亮度标准差 24.2；亮白约 2.6 万采样、浅灰蓝约 16.4 万、偏蓝海面约 2.8 万（步长 3）。草原岛从云缝里露出来，周围没有青色方块。对比图 `04_cruise_vs_render.png`（左游戏、右效果图）。

## 3. 06 降落看不到草地和岩体

原因：`STRATA_OFF_T` 从 v23fix 起是 31。降落关键帧 t=33.6 时 `showIsland` 为假，`env_sky_static_palette`（草地）和 `env_sky_static_rock_strata` 被关掉。不是镜头穿到岛面以下，近裁剪仍是 0.3，机位没有改。

修法：`STRATA_OFF_T=36`。草地和岩体留到降落镜头之后；35.9 的交接 fade 仍会把岛体关掉。05 的机位公式没动。

证据：`06_land.png`。下半屏抽样里草地 51029、偏岩色 30797（共 164580）。人物、气球、机器人站在草地上。`05_city.png` 仍是原来的城岛机位。

## 4. 05 天空色带，07 树冠黑边

05：穹顶 `env_sky_dome` 顶点环少，8 位颜色出水平带。白天把这张共享材质换成 sky-dither（`gl_FragCoord` 上 ±2.5/255 的 IGN），租约结束时 `setSharedMaterial` 还原。中线天空大约 628 行里有 97 次亮度变化，不再是一条条长色带。见 `05_city.png`。夜间穹顶不走这条抖动。

07：`dimCityNight` 用了不透明 unlit，会把 alpha 卡片里的黑纹素画成黑块。树冠卡片、叶卡、藤卡改为 `USE_ALPHA_TEST`，夜间阈值 0.72，白天 `clipCanopy` 把阈值设到 0.68。树冠顶上剩下的锯齿是不透明低模轮廓，和 v24 的黑边像素数量同一量级，没有再为它重编包。见 `07_night.png`。

## 保持的 v24fix 行为

洋红占比 0（全部 shots，判定 R>200、G<80、B>200）。05/07 岛体仍在，夜间城压暗、灯塔窗不参与压暗。04 岛周无青色方块。01/02 与草原玩法一致（`00_meadow_gameplay_ref.png`、`01_board.png`）。时长 36 s。海面方案 B 与 35.9 满屏 fade 未改。`handoff_after.png` 在 t=36、`fade=1`。

## DC、测试、包体

05 实拍 `dcWorst=42`（t=24.07，画面 DC 42），预算 ≤53。同一次巡航 `04` 的 `dcWorst=42`。`handoff_after` 的 `dcWorst=45`。

Node 22 `run-suite`：98/99，唯一失败是 `navigation-guard: BLOCKED_BROWSER`（进程退出码 1，允许）。`test_frame_background`：5054 帧通过，`seamLeak=0`，`seamCamErr=0.000071`，`minClear=12.37`，`minClearCam=11.05`，`handoffFade=1`。报告目录已还原。

包体（`385dab1` 的 wechat-release / web-test，与 `37ab9b36` 的游戏代码相同）：

| 项 | 字节 |
| --- | --- |
| wechat-release | 19,960,670 |
| 上限 | 24,641,536 |
| 相对 v24fix 19,947,978 | +12,692 |
| 相对 r4 19,335,755 | +624,915 |
| web-test | 20,753,299 |
| `region_transit_balloon` | 541,784（v24fix 531,126，+10,658，上限 1,048,576） |
| 主包（不含 subpackages） | 1,871,040 |

## 截图

`docs/r5/balloon-v25fix/shots/`，并复制到任务包 `shots/`。390×844、DPR 2、有触摸，780×1688。对比图游戏半幅短边 ≥844，文件均 <1.5MB。标签「左＝游戏 / 右＝效果图」，左半是游戏画面。`contact_vs_render_v2_3.png`。

洋红：00–07、handoff_*、light_* 占比都是 0。

## 磁盘

开工 Avail 7.1Gi。截图结束与交付时 Avail 4.3Gi。构建过程中空闲始终高于 3.5Gi。
