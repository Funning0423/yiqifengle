# r5-integrated-fix1 报告

整合包里，热气球把人送到天空之城之后，广场地面变成一块浅青蓝平面。这次只修到达后的可见性，不改镜头，也不改热气球飞行中的云海、光照和球囊。

## 根因

文件 `creator-build-project/assets/scripts/region/BalloonTransit.ts`，函数 `mountBalloonLease` 里的 `paint`。

飞行过程中 `paint` 会按时间关掉天空之城的岛体和花草：`t` 过了 `STRATA_OFF_T`（31 秒）或进入交接（`HANDOFF_COVER_T` = 35.9 秒）之后，`env_sky_static_palette`、`env_sky_static_rock_strata` 被关掉；花草灌木被 `/foliage_card|env_sky_static_foliage|.../` 和 `hideCityNightGlow` 关掉；`clouds_floor` 等转场云海留着。骑乘结束时仍然调用 `paint(plan.total)`，而 `plan.total` 是 36 秒，已经过了交接点。这一下把刚才准备打开的草地又关掉，并把 `__QF_BALLOON_LENS`、`__QF_BALLOON_HOLD_SKY` 重新设上。米色星形是 `state_court_before`，不在隐藏名单里，所以浮在浅青蓝上。浅青蓝是方案 B 的海面色（`Color(172,216,236)`）以及还开着的云海盘；柱子和岩块下面的地面节点是关的，所以看起来悬空。

这条路径只在草原→天空之城走热气球时才会跑。r3 单独分支用的是桥，不会调用这次 `paint`，所以 r3 截图是完整草地。合并进整合包、默认交通改成热气球之后，冒烟才看到。飞行中「脚下没有草」是 `STRATA_OFF` 之后的降落镜头，这次没有改。

冷启动读档也会走到同一次收尾。行程地区没有存档。`qaShot({region:'skycity'})` 经 `ensureRegion` 从海岛走到草原再走到天空之城，仍然会乘热气球，然后执行同一段到达恢复。直接挂上天空之城模型时并不会按名字关掉 `SKY_LAWN`，这一点由回归测试断言。

拍关卡棋盘时又看到一块全黑。`handoffFade(36)` 仍是 1：0.15 秒的淡出写在时钟终点之后，骑乘在 `t=36` 停住，最后一帧 `fadeCover(1)` 把 `HomeFadeCover` 留成不透明黑。导航画布重新打开（棋盘）时，这块黑盖住整个画面。世界散步镜头会把导航画布关掉，所以 09/10 看得到草地。到达后补了一次 `fadeCover(0,0)`。

## 修法

`BalloonFlight.ts` 增加 `SKY_LAWN`、`TRANSIT_OFF_AFTER` 和 `skyNodeAfterArrival`。骑乘正常返回之后才把 `arrived` 设为真，再 `paint(plan.total)`。`arrived` 为真时：草地、岩层、花草卡片、藤蔓打开；转场云海、海面盘、远景卡片、夜穹关掉；主光和阴影回到上车前；`__QF_BALLOON_LENS` 与 `__QF_BALLOON_HOLD_SKY` 清掉。飞行中的 `paint`（包括降落镜头）不变。

`tools/transitions/test_sky_arrival.cjs` 已登记进 `run-suite.cjs` 的 `sky-arrival`。它断言到达后草地节点为开、转场背景为关，直接挂载不会按名字藏起草地，并且 `arrived=true` 写在最后一次 `paint(plan.total)` 之前、其后有 `fadeCover(0,0)`。

## 证据截图

视口 390×844，长边 900。洋红（R>200, G<80, B>200）抽样占比都是 0。没有彩虹桥。各文件 md5 不同。

| 文件 | 内容 |
| --- | --- |
| `01_island_nodes.png` | 海岛节点 |
| `04_meadow_arrival.png` | 草原到达（本地时间已过 18:00，截图时把昼夜锁在白天，和 build06 的白天草原对照） |
| `06_balloon_board.png` | 热气球登艇，t≈0.9 |
| `07_balloon_cruise.png` | 热气球巡航，t≈18.5 |
| `08_balloon_skycity.png` | 看见浮岛，t≈24 |
| `09_skycity_nodes.png` | 热气球到达后的天空之城广场：草地、花、灌木、星形广场，柱子落在地上 |
| `10_skycity_walk.png` | 到达后的散步：人物站在花草地上，石柱和岩块不悬空 |
| `skycity_board.png` | 天空之城关卡棋盘，背后是绿草地。由最终构建 edfcb02c 重拍，没有再手动关掉遮罩 |
| `skycity_direct.png` | 冷启动 `?qa=1` 后 `qaShot` 进天空之城散步。行程不存档，仍会乘船再乘热气球，然后走同一段到达恢复 |
| `sky_before_after.png` | 左＝修前（build06 的 09/10），右＝修后。图顶文字是「左＝修前 / 右＝修后」 |

无头浏览器里热气球资源有时超过 6 秒准备时限，会退回彩虹桥。截图脚本只在页面里把这一次 6000ms 的 `setTimeout` 放宽，游戏源码里的时限没改。06/07/08 的 `__QF_BALLOON.t` 都出现了，不是桥。

## 测试与包体

`run-suite.cjs`：121/122 通过。唯一非 PASS 是 `navigation-guard: BLOCKED_BROWSER`。`sky-arrival` 通过。

`test_frame_background.cjs`：PASS。帆船 3458 帧，最紧 `clearM` 2.441（390×844 白天 `meadow_terrain`）。热气球 5054 帧，`seamLeak=0`，`minClear` 12.37，`minClearCam` 11.05，缝 11.4（草原关 11.2，城开 11.6）。

构建 HEAD `edfcb02c415449547296a0fc3e72e308df5c5bb2`，tree `aec8646b52af06f265296f57b1d89aaab3062960`。

| 包 | 字节 | 相对 build06 |
| --- | --- | --- |
| wechat-release | 20,267,421 | +886（build06 为 20,266,535） |
| web-test | 21,066,167 | +894（build06 为 21,065,273） |

硬上限 24,641,536。增量都在 `main`（1,442,555，build06 为 1,441,669）。

## 提交

- `a83e1c2bde62a348543365a0a762c73ac1ee49a7` 整合包报告（本分支起点）
- `cbecdf2a0cd1c83de1023c6401ac882fe8d7e8ac` 到达后恢复天空之城草地
- `1233700300c6f6f32edb78809a4b41926bbab88c` 到达后关掉交接黑遮罩（下一笔修掉多出来的括号）
- `edfcb02c415449547296a0fc3e72e308df5c5bb2` 修好解析，这是持锁构建的 HEAD

未 push。

## 磁盘

开工 `df -h ~`：Avail 7.0Gi。交付时 Avail 3.9Gi。构建前都高于 3.5Gi。没有清别人的锁。
