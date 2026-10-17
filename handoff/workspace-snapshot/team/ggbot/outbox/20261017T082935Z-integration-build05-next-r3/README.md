# integration/build05-next-20261017T0818Z-r3（GGbot，build05-next r3：只做叠加）

- 分支：`integration/build05-next-20261017T0818Z-r3`。仅本地，未 push，主线没有动。
- HEAD：`f3d3614361dd2dc23098353ff314a520c3e1c00e`
- 范围：`228df2f..HEAD`，共 10 个提交 → `patches/0001..0010`
- bundle：`integration-build05-next-20261017T0818Z-r3.bundle`
  - 前置提交为 228df2f，已通过 verify
  - 用法：`git fetch <bundle> integration/build05-next-20261017T0818Z-r3`
- 旧分支 `integration/build05-next-20261017T0807Z-r3`（HEAD 5bb26c5，不含 olive）保留未删，不要使用。

## 提交顺序
| # | 提交 | 来源 |
|---|---|---|
|1|7176c56|Voice Bot：v3.4 桥面发白，光照颜色预编码|
|2|a90b2cf|Voice Bot：v3.4 近水重新拟合水面系数|
|3|78b23c5|Voice Bot：v3.4 凉亭守护测试|
|4|de093cd|Voice Bot：r2 光照编码，每条光路只转换一次|
|5|c60ac55|Voice Bot：r2 亮度，太阳 0.7 加暖色半球补光|
|6|f7f892f|Voice Bot：r2b 暖色补光减半|
|7|a6f39ed|Voice Bot：olive 重新着色（palette PNG，以及 LK_far_hills / LK_terrain / LK_far_shore 的 UV）|
|8|8927443|GGbot：白天 clear colour 修复，dir 模式下与棋盘初始化同为 28/143/184|
|9|b449fc1|GGbot：旅程 instancing 加静态合并（原 55d1922）|
|10|f3d3614|运镜bot：landing→board hook v2（原 4bd6ba3）|

第 9、10 个是用旧 r3 中已经解决过冲突的版本 cherry-pick 过来的，作者信息保留。

## 冲突处理（只做合并，没有改任何颜色或镜头逻辑）
- `run-suite.cjs` 的测试列表：取两边的并集。新增 lakeside-olive、lakeside-journey-merge、lakeside-landing-hook，与运镜bot 的参考 3d0650a 一致。
- `RegionJourneyAdapter.ts` 的 import：两边都保留，与运镜bot 的参考 d71aa62 逐字节一致。

## 白天 clear colour 修复（8927443）
- 原问题：228df2f 中白天 pack 的 clearColor 是 `#f2b98a`（旧的 hemi 橙色），而 dir 模式下棋盘初始化用的是 28/143/184。结果切到白天时会跳成橙色，旅程白天的终点颜色也是橙色。
- 修复：新增唯一的 helper `lakesideDayClearColor()`，棋盘初始化、白天 pack 和旅程白天终点都用它。
  - dir 模式返回 `#1c8fb8`；points 模式仍用 LAKESIDE_CLEAR_COLOR。
  - clear colour 始终是 sRGB 字节，不做光照编码。
- 没有动任何光照、环境光、水面颜色的转换，也没有动夜晚的值。
- lakeside-daynight 测试新增断言：白天 clear 与棋盘初始化逐字节相等，旅程白天终点在 target 和 w=1 时也相等。

## hook 未就绪路径（已核对代码）
1. 预加载 3 s 内没有完成（或失败）时，hook 返回 `{ok:false, reason:'lakeside-assets-not-ready'}`，不写镜头。
2. `WorldNativeComposition` 收到后调用现有的 `lakesideFallback('board', …)`：调用 abandonLakesideJourney 回到小岛，用 `[QF_LAKE]` 记日志，返回 `LAKESIDE_LOAD_FAILED`。
3. `WorldIntegrationBoot.invoke` 只显示 `LAKESIDE_NOT_READY_TEXT` =「湖畔暂时没准备好，先回小岛吧」，技术细节只进日志。

## 测试
- 完整 suite：**69/74 PASS**（suite.json，gitHead=f3d3614）。失败的只有已知的 5 项：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract（FAIL），navigation-guard（BLOCKED）。
- 20 项 lakeside/lake 测试全部 PASS，其中包括 olive、journey-merge、landing-hook、daynight、light-encoding、pavilion。
- 未验证：box 上没有 Creator，也没有真机。

## 包体估算（相对 r2）
- 代码：TS 编译为 ES5 并去掉空白后约 +13.9 KB；压缩后约 +7–9 KB。主要来自 hook v2、BoardLayout、journey batching 和 SceneData。
- 资源：
  - palette PNG：1,803 → 1,007 B（-796 B）
  - 3 个 GLB 只改了 UV，大小不变；olive 预期合计约 -0.9 KB
  - water.effect 只改了数值，大小不变
- 合计：约 +6–8 KB。r3 预计约 19.29–19.31 MB（r2 约 19.28–19.30 MB），比 09a1b8e（19,125,680 B）多约 +0.17 MB，距离上限 24,641,536 B 还有约 5.3 MB。

## Mac 检查清单（界面验收部）
1. **编译和加载**
   - Creator 3.8.8 能编译；不打任何 TEST-ONLY 补丁，湖畔能正常加载（不出现 decodeVertexBuffer 或 prefab-missing）。
   - 断网或模拟失败时，屏幕上只出现「湖畔暂时没准备好，先回小岛吧」。
2. **微信包体**：记录实际字节数，对比上限 24,641,536 B 和 09a1b8e 的 19,125,680 B。
3. **棋盘全屏 DC**：分别记录默认（合并）和 `?lakemerge=off` 的 DC、FPS、内存，白天和夜晚各测一次。
4. **对照 r5h3 的五个区域**（同一机位截图，记录像素值）：
   - 近水，目标 66/152/146
   - 桥栏，目标 108/110/88
   - 草地：左右两侧都要看（olive：左 r5h3 81/107/24，右 72/120/22）
   - 远处树林（olive 后预期约 51/94/28，树本身仍为绿色）和远山（r5h3 约 71/83/20）
   - 左侧屋顶
5. **昼夜切换**
   - 棋盘上和旅程 blend 开始后，日→夜、夜→日都正常。
   - 白天的 clear colour = **28/143/184**，不再跳橙色。
   - 离开湖畔后再切换，小岛表现正常。
   - **夜晚单独检查重新着色后的远山和草地**（不能发黄或发灰）。
6. **旅程三段**（小岛、桥、到达）
   - 白天和夜晚各跑一次。
   - 记录 A–E 计数：
     - A：pageerror
     - B：console.error
     - C：HTTP ≥ 400（按 URL 列出）
     - D：网络失败
     - E：测试脚本错误
   - 记录每段的 DC 峰值和内存峰值。
   - 默认和 `?lakemerge=off` 做 A/B 对比；旅程合并后，到达段预计湖畔约 4 个 DC。
7. **landing→board 平滑度**
   - 在 390x844、360x780、375x667、390x520 上检查。
   - 短屏的 FOV 渐变要平滑，交换的那一帧不能跳。
   - 1 s 的 hook 结束后与棋盘机位一致。
8. **天空穹顶**：截图说明现状（本轮没有改）。
