# integration/build05-next-20261017T0725Z（GGbot，build05-next r2）

- 分支：`integration/build05-next-20261017T0725Z`（仅本地分支，未 push；旧分支都没有移动）
- HEAD：`228df2fee791ea14b6da683c8362a69d603d801a`
- 范围：`21c187d..HEAD`，共 20 个提交 → `patches/0001..0020`
- bundle：`integration-build05-next-20261017T0725Z.bundle`（`git bundle verify` 通过，前置提交为 21c187d）
  - 用法：`git fetch <bundle> integration/build05-next-20261017T0725Z`
- 取代：`20261017T071930Z-integration-build05-next/`，该目录已标记为 SUPERSEDED。

## 相对 071930Z 的改动
1. **水色与静态合并并入主线**（原来是可选分支，现在接在 be1cd5a 之后）
   - 51aaa85：只作用于水面的光照系数（主光 0.8，环境光 0.35），天空反射强度从 1.0 降到 0.4，去掉湖中间的橙/青条纹。
   - c2eaf64：在 instancing 之后做静态合并，背景 DC 约从 36 降到 4，总 DC 约从 79 降到 47（这是按真实 bundle 估算的计划值）。
   - 做 A/B 对比时加 `?lakemerge=off`，关闭合并（回到只做 instancing 的状态）。
2. **228df2f：修复「到达湖畔后切换昼夜，主光被重置成小岛的样子」**
   - 原因：`WorldFlowComponent.applyDayNight` 只会写小岛的主光，湖畔里没有组件响应这次切换。
   - 做法：
     - `applyDayNight` 末尾广播 `emitDayNightChange(mode)`（`DayNightContract.onDayNightChange`），并在 `__worldDayNight` 上加 `reapply()`。
     - 湖畔有自己的昼夜两套参数：`lakesideModeLighting(mode)`。
       - 白天：沿用原来的黄昏参数，不做任何改动。
       - 夜晚（新的代理值，需要看 Mac 截图来调）：
         - 主光颜色 0.36/0.46/0.78
         - 环境光 sky 0.012/0.03/0.09，ground 0.02/0.022/0.04
         - clear colour `#1c2740`
         - 雾色 44/54/84
         - 水面系数：main 0.8，ambient 0.6，天空反射 0.12
     - 棋盘（LakesideBoardBackground）：显示期间由它负责光照。切换昼夜时按当前模式重写以下全部内容：
       - 方向光
       - 环境光
       - clear colour
       - 雾
       - 水面的 lightParams 和 fresnel.w
     - 旅程（新文件 `LakesideJourneyLighting.ts`）：
       - blend 已经开始（w>0）且棋盘没有接管时，切换后按当前模式重算 blend 目标。
       - blend 开始前切换，仍然是小岛的样子。
       - 基础照度按白天存储，再乘以当前模式的小岛系数，避免叠乘两次。
     - 离开湖畔时，先恢复到进入时的值。如果期间模式变过，再调用 `reapply()`，所以小岛显示的是当前模式。
     - 棋盘隐藏后：如果旅程还在，就把光照交回旅程；否则由世界重新应用昼夜。
   - 测试：`tools/lakeside/test_lakeside_daynight.cjs`（suite id `lakeside-daynight`，11 项全部 PASS）
     - 湖畔里 日→夜→日、夜→日 两个方向
     - blend 中途切换
     - blend 开始前切换
     - 离开后在小岛上切换
     - 夜里进、夜里出时不会多余地调用 reapply
     - 棋盘接管与交还
   - 天空穹顶问题按要求**没有碰**（等 Mac 截图）。

## 提交列表（来源）
| # | 提交 | 来源 |
|---|---|---|
|1|0cbce91|scenefix 92b2df0（← b9f04f7）|
|2|46c66a4|f85ddbf，删除 4 个零实例 LK 资源|
|3|68da5fb|e94ba61，启用 meshopt 模块|
|4|2aa5957|04da633，Array.from|
|5|240ac97|63f2803，友好 toast，技术细节只写日志|
|6|0af6131|888daeb，prewarm|
|7–12|6942e9a 17ddca2 a8bc792 aa15e04 a724d48 5e1a291|运镜bot 7595b85 eee4dfe c375304 0e39055 b0c21d2 68478d9|
|13|88ed387|Voice Bot 4728814（含冲突说明）|
|14|5bdfdc5|Voice Bot f3fce67，湖畔环境音|
|15|655ecd5|测试跟随 b0c21d2 的 pitch|
|16|9060208|(c) 旅程平滑过渡到湖畔光照|
|17|be1cd5a|所有失败路径共用一个友好 fallback|
|18|51aaa85|水色（ded0725）|
|19|c2eaf64|静态合并（42126a0）|
|20|228df2f|**r2 新增**：湖畔内的昼夜切换|

## 测试
- 完整 suite：**64/69 PASS**（suite.json，gitHead=228df2f）
- 失败的只有已知的 5 项：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract（FAIL），navigation-guard（BLOCKED）
- 15 项 lakeside/lake 测试全部 PASS（含 lakeside-daynight、lakeside-static-merge）
- 未验证：box 上没有 Creator，也没有真机。shader 没有编译；夜晚参数是代理值。

## 静态合并是否覆盖旅程中的 431 个实例？**没有覆盖**
- `RegionJourneyAdapter.prepareLakesideJourney`（约第 121 行）只调用了 `mountLakesideScenery`，既没有做 instancing，也没有做 merge。
- 所以旅程中湖畔约有 431+ 个 renderer 单独绘制；c2eaf64 只作用于棋盘背景。
- 修复很便宜：在 mount 之后加大约 4 行：
  - `owned.push(...enableLakesideInstancing(model))`
  - `mergeLakesideStatic(model, isWater)`，把合并出的 mesh 加进 owned，离开时一起释放
- 合并是相对 scenery 根节点做的，所以模型移动之后结果仍然正确。
- 预期：旅程中湖畔约 4 个 DC。
- 代价：
  - prepare 阶段多一次合并的 CPU 开销（发生在 loading 进度条期间）
  - 棋盘和旅程两份同时存在时，合并 mesh 多占约 1.6 MB
- **本次没有实现**，远景隐藏也没有实现，等 lead 看完实测数据再决定。

## 包体
- 参考：09a1b8e = 19,125,680 B；上限 24,641,536 B
- 新增内容都是代码：水色、静态合并、昼夜，合计约 +10–15 KB（压缩后）。meshopt 模块 +8.6 KB 和环境音约 58 KB（region_lakeside 分包）都已经算在上一版里。
- 估算：约 **19.28–19.30 MB**（上一版约 19.27–19.29 MB），比 09a1b8e 多约 +0.16 MB，离上限还有约 5.3 MB。需要以 Mac 实际构建结果为准。
- meshopt 实测（48 个 GLB，详见 meshopt_measure_48glb.txt）：

  | 方案 | 大小 |
  |---|---|
  | quantize+encode+zlib（选用） | mesh 122,869 B + 模块 8,612 B = 131,481 B |
  | 关闭 encode | 170,187 B |
  | 只用 zlib | 214,151 B |
  | 原始 | 888,316 B |

## Mac 检查清单
### 一、基础
1. 不打任何 TEST-ONLY 补丁，湖畔能正常加载，没有 `ek.decodeVertexBuffer`，也没有 `lakeside-prefab-missing`。
2. 失败路径（断网或模拟失败：旅程 prepare/walk、ensureRegion、棋盘）：
   - 屏幕上只出现「湖畔暂时没准备好，先回小岛吧」，人物留在小岛，小岛仍可操作。
   - `[QF_LAKE]` 和 `[QF_LAKESIDE]` 只出现在日志里。
3. 只有环境音加载失败时：不弹 toast，海浪继续播放，只写日志。
4. 环境音：
   - 到达湖畔那一段和棋盘上都能听到湖水和风铃。
   - 海浪会淡出；离开湖畔后海浪恢复。
5. 落地到棋盘的衔接：镜头连续，pitch 58 时没有出现空洞。
6. 包体：记录实际字节数，对比 09a1b8e（19,125,680 B）和上限（24,641,536 B）。
7. 水色：取湖中间的像素，对照 r5h3 的 66/152/146，看橙/青条纹是否消失。

### 二、棋盘 DC / FPS / 内存（白天和夜晚各测一次）
- 默认（合并）：背景 DC 约 4，总 DC 约 47。
- `?lakemerge=off`：背景 DC 约 36，总 DC 约 79。
- 记录 FPS 和内存峰值。

### 三、旅程 DC / 内存（单独一节，按 A–E 计数规则）
每次运行先报告 A–E 计数，然后报告各段的峰值。白天、夜晚各跑一次。
- A：pageerror 数量
- B：console.error 数量（`[QF_LAKE]` 单独列出）
- C：HTTP ≥ 400，按 URL 列出（URL → 状态码 × 次数）
- D：网络失败（requestfailed），按 URL 列出
- E：测试脚本自身的错误

| 段落 | 白天 DC 峰值 | 白天内存峰值 | 夜晚 DC 峰值 | 夜晚内存峰值 |
|---|---|---|---|---|
| 小岛段（出发到上桥） | | | | |
| 桥段（桥面，blend 从桥中间 15.5 m 开始） | | | | |
| 到达段（38.2 m 之后，直到落地进入棋盘） | | | | |

- 注意：旅程中湖畔**没有合并**（见上文），所以到达段 DC 预计明显偏高。请如实记录，供 lead 决定是否加那 4 行合并、是否隐藏远景。

### 四、昼夜切换（本次修复）
1. 棋盘上 日→夜：湖畔变成夜色（偏蓝的主光、深蓝的 clear colour、蓝灰色的雾、水面变暗），**不能**变回小岛的灯光。
2. 棋盘上 夜→日：回到原来的黄昏样子。
3. 旅程中，过了桥中间（blend 已经开始）后切换：过渡继续，目标是对应模式的湖畔光照。
4. 旅程在过桥中间之前切换：仍然是小岛对应模式的样子。
5. 在湖畔切换后离开：小岛显示的是当前模式；离开后再在小岛上切换，表现正常。
6. 夜里进、夜里出：小岛夜色正常，不闪烁。
7. 夜晚参数是代理值，请截图供调参。天空穹顶这次没有改。
