# journey-merge 侧分支（GGbot）

- 分支：`integration/build05-next-20261017T0725Z-journey-merge`（只在本地，**没有并入主线**，没有 push）
- 基于：`228df2fee791ea14b6da683c8362a69d603d801a`（build05-next r2 的 HEAD）
- 提交：`55d1922353f29f32b73754c298081099d4d1fd10`，只有 1 个提交，即 `0001-*.patch`
- bundle 需要的前置提交是 228df2f。用法：`git fetch <bundle> integration/build05-next-20261017T0725Z-journey-merge`
- 启用条件（lead 已批准）：Mac 上旅程的 DC 峰值 **> 60** 时才并入。

## 改了什么
1. `prepareLakesideJourney` 在 `mountLakesideScenery` 之后，按顺序做两件事：
   - 先 `enableLakesideInstancing(model)`；
   - 再 `mergeLakesideStatic(model, isWater)`。
2. 水面不参与合并：`mountLakesideScenery` 挂载时会给水面 GLB 的节点打标记（`isLakesideWaterNode`），合并时跳过这些节点。
3. 加 `?lakemerge=off` 时只做 instancing，不做合并，和棋盘的行为一致。
4. 合并出的 mesh 和 instancing 的材质副本统一在 lease 的 `release()` 里释放，而且只释放一次。以下几种情况最终都会走到这里：
   - 离开（returnToIsland）
   - controller dispose
   - 友好 fallback（abandonLakesideJourney）
   - prepare 失败
5. 远景**没有**隐藏。
6. 新文件 `LakesideJourneyBatching.ts`：不依赖 cc 的纯逻辑。新测试 `lakeside-journey-merge`，6 项全部 PASS，覆盖：
   - 挂载时会合并
   - 离开时释放，且只释放一次
   - off 开关生效
   - 中途抛错时会释放已创建的资源
   - 代码接线检查

## 预期
- 旅程中湖畔的绘制：约 431+ 个 renderer → 约 **4 个 DC**（和棋盘的合并计划一样：2 个 palette chunk、1 个未合并的、水面）。
- 旅程总 DC 预计降低大约 30～40 以上，具体以 Mac 实测为准。重点看到达段。
- 代价：
  - prepare 阶段多一次合并的 CPU 开销（在 loading 进度条期间完成）；
  - 棋盘和旅程两份同时存在时，内存多约 1.6 MB（lead 已接受）。
- 包体：只增加代码，约 +1～2 KB。

## 测试
- 完整 suite：**65/70 PASS**（suite.json，gitHead=55d1922）。
- 失败的只有已知的 5 项：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract（FAIL），navigation-guard（BLOCKED）。
- 未验证：box 上没有 Creator，也没有真机。

## Mac 验证（并入前）
按 r2 README 里旅程一节的 A–E 规则计数。分别在白天和夜晚，记录小岛段、桥段、到达段的 DC 峰值和内存峰值，并分别在默认设置和 `?lakemerge=off` 下各测一次。另外检查：
- 合并后，到达段的画面和 off 时一致（没有缺块，也没有错位）；
- 离开后内存能回落。
