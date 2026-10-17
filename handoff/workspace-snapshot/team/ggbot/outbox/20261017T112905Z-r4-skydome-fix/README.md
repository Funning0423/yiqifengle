# r4 天空球修正 + [QF_LAKE] 改为 error（ggbot/build05-r4-journey-fixes）

- 分支：`ggbot/build05-r4-journey-fixes`，只在本地，没有推送，没有改写历史
- 在 939049c 上新加两个提交，最终 HEAD 是 **5bb9e0da057efde43879b7cd1e98adf8f09c7788**
- 没改 `lakesideModeLighting`，也没改陆地材质（LakesideSceneData.ts 和 9581c23 完全相同）

| SHA | 内容 |
|---|---|
| 2519d35 | **天空球目标改成棋盘的 clear colour。**<br>• 天空球和云层的目标颜色改为棋盘实际显示的天空，按模式取 clear colour：白天 28/143/184（= `lakesideDayClearColor()`），夜间 28/39/64。<br>• 只从一个入口读：`lakesideSkyDomeColor(mode)`。Voice Bot 导出 skyDomeColor 后，改这一处就行。<br>• 天空球不再读 waterSky*，那组参数只给水面反射用。<br>• `skyFollowColor` 把网格的平均显示色从岛上起点沿 sRGB 直线插到目标，每个通道单调，色相只朝一个方向走。用线性 RGB 插值的话，云层的色相会先偏一下再回来，所以改用 sRGB。<br>• `SKY_FOLLOW_MAX_GAIN` 恢复为 8，现在最大增益只有 1.93。 |
| 5bb9e0d | **`[QF_LAKE] journey-water-fallback` 改用 console.error。**<br>• 消息内容、字段和回退行为都不变。<br>• 测试改为抓 console.error，并确认没有 warn。 |

## 测试

- 在 `lakeside-sky-follow` 里新加了测试：白天和夜间各取 blend 0..1 共 21 步，用真实的天空球和云层平均色。检查这几点：
  - 每个通道单调，并且始终在起点和终点之间；
  - 色相落在起点和终点之间较短的那段弧上，并且不往回走；
  - 目标颜色不是任何 waterSky* 值；
  - 灯光代码里不出现 waterSky；
  - 增益上限是 8。
- 全套（最终 HEAD，两个 detached worktree，跑完已删除）：
  - Node 20（v20.19.2）：**81/86**
  - Node 22（v22.23.3，日志第一行 `node=v22.23.3`）：**81/86**
  - 没过的都是已知的 5 条：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract，以及 navigation-guard（BLOCKED_BROWSER）。
- 叠到 a8ba19a：f3d3614..HEAD 共 21 个提交，cherry-pick 没有冲突。叠完后跑了 9 个相关测试，全部通过（`logs/cherry-pick-a8ba19a*.log`）。

## 天空球颜色（⚠️ 计算值，不是截图）

盒子上没有 Cocos Creator，也没有游戏的 web 构建，所以拍不了真实引擎画面。
`images/dome-blend-swatches-COMPUTED-not-screenshot.png` 是用代码算出来的色块，数据在 `images/dome-colours-computed.json`。
数值是天空球网格的平均显示色（sRGB）。a 是岛屿天空道具的不透明度 `islandSkyFade(w)`；a<1 时，实际画面里还叠着相机的 clear colour。

| | w=0 岛上 | w=0.6 | w=0.8 | w=0.95 | w=1（棋盘 clear） |
|---|---|---|---|---|---|
| 白天天空球 | 44/105/144 | 34/128/168（a 1.00） | 31/135/176（a 0.39） | 29/141/182（a 0.00） | 28/143/184 |
| 白天云层 | 190/201/206 | 93/166/193 | 60/155/188 | 36/146/185 | 28/143/184 |
| 夜间天空球 | 14/52/100 | 22/44/78（a 1.00） | 25/42/71（a 0.39） | 27/40/66（a 0.00） | 28/39/64 |
| 夜间云层 | 94/112/141 | 55/68/95 | 41/54/79 | 31/43/68 | 28/39/64 |

### Mac 实拍步骤（交给界面验收部）

1. 构建 5bb9e0d 的 web-test，用和 r3 一样的 lk.cjs 跑法，加上 `?lakediag=1`，并打开 `__worldFlowLog`。
2. 白天从岛出发去风铃湖畔。从日志里 journey-atmosphere 的 progress，或者 `journey_samples.json` 的 blend 权重，找到 w 第一次 ≥ 0.6、0.8、0.95 的那几帧，各截一张全屏图。
3. 切到夜间，重复第 2 步。
4. 在天空同一个位置取色（比如画面上方中间，避开云），对照上表看颜色走向：应该从岛上的蓝直接走向棋盘 clear colour，中途不能偏紫或偏青绿。
5. 截图放到 ui-audit，文件名带上 day/night 和 w 值。

## B 类错误计数（console.error）

**怎么检查的：**
- 看了 Mac 的抓取和分类脚本：
  - `ui-audit/2026-10-17/next-r3-f3d3614/logs/r3/lk.cjs` 用 `p.on('console')` 记录 `[t, m.type(), text]`；
  - `ui-audit/2026-10-17/a3b-a995c41/errs.py` 把 type 为 `error` 的行算进 B（只排除 "Failed to load resource" 回显）。
  - Playwright 里 console.error 的 type 是 `error`，console.warn 是 `warning`，所以之前的 warn 不会被算进 B。
- 实际跑了一遍：用真实的 `logLakesideJourneyWaterFallback` 生成一行日志，按 lk.cjs 的格式写入，再交给 errs.py：
  - 结果 **B = 1**，就是这条 `[QF_LAKE] journey-water-fallback`；
  - 旧的 warn 写法同时放进去了，**没有被计入**。
  - 见 `logs/b-class-check/`。
- r3 的 summary 里，失败注入那一轮的 B 也计入了 3 条 `[QF_LAKE]` 的 console.error，和这次结论一致。
- 仓库里的全套测试和打包体积守卫都不统计 console 错误；B 类只由 Mac 的抓取脚本统计。

**提醒：** 现在的失败注入是拦掉整个 region_lakeside，这会在 prepare 阶段就失败，走不到水面这条日志。要验证这条日志，只拦 `water/lakeside-water` 那个材质请求：预期 B 正好 +1，旅途照常走完，湖面是旧外观。

## 包体

- 这两个提交相对 939049c：脚本源码 +339 B，去掉注释后的 JS 是 −105 B，约等于 0。
- 整条分支相对 9581c23：源码 +9,775 B，JS 约 +5.9 KB。估计微信包增加 +4 到 +7 KB，离 24,641,536 B 的安全线还很远。

## 文件

- `patches/0001-0002`：基于 939049c
- `ggbot-build05-r4-journey-fixes-skydome.bundle`：前置提交 939049c，已校验
- `images/`：计算出的色块图和对应数据，不是截图
- `logs/`：两套全套测试日志、cherry-pick 日志、B 类检查
- `SHA256SUMS`
