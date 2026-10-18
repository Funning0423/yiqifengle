# 区域关卡节点 r3 报告

分支 `gbt/r5-region-level-nodes-r3`，从 r2 末端 `cb08312da61c93ca8bf573cdff1b1fe453bfdcd8`（tree `c823818800b14e909fd9ce9cd307254bb044d0e1`）起。未 push。`RegionJourneyAdapter.ts` 与 `f569ff0d9eeb9f6ab26bdc56276fa234e60c5ac4` 无差异。`JourneyTransport.ts` 相对 r2 末端无差异，`transportFor` 三条腿都是 `bridge`。

截图来自 build-guard 的 web-test，`?qa=1`，390×844，hasTouch。玩家包不挂测试横幅（`cc/env` 的 `MINIGAME` 把 `qaShot` 折叠掉）。构建头 `09bfd2841f7e54a78ec037d9ca2ecd96ecf80511`，tree `e7bda169e33c5fcf4c66b55d573eed85c1b1bf15`。

## 验收

1. **标记**：白色大菱形已换成约人物身高 1/4–1/3 的低多边形小旗，顶点色有明暗。已完成 `#e2b657`，当前暖奶油 `#f0d7a2`（不是纯白），未解锁 `#9aa0a6`。人物站在节点上时旗子偏到脚边约 0.66 m。海岛近景里能看到脚边的小橙旗，不再穿过人物。同一张静帧里三种颜色并排并不总是都入画（节点彼此离得远）。仍是一个 `MeshRenderer`，约 +1 DC。自制程序化，无外部贴图。
2. **天空之城终幕：未达到。** 见下文。
3. **物件反馈**：三个区域各一张，互不重复。海岛是人物旁边的椰树；草地是木架上倾斜的金色风铃（反馈能看出来，风铃后面有一块灰平面）；天空之城是园丁机器人背面全身。风铃 `env_sky_windchime_01` 和草地栅栏没有单独当主体，因为那两个节点在这套镜头里对不上画面。
4. **棋盘**：三张都是三消棋盘，脚本回报 `pause:false`。海岛「04 小径守卫」，草地「08 长风的约定」，天空之城「12 天空之城的回声」。没有「暂停一下」，也没有「星光」道具介绍。
5. **包体：未回到 +52,428 B。** 数字在下面，差额全部在 `main`。
6. **DC / 帧率 / 棋盘首帧**：在 web-test 无头软件渲染里测过，见下文。

## 终幕为什么还是不行

S6 的人物在星环中心底下，星环是直径约 48 m 的水平环（世界高度大约 13–27 m）。竖屏要把人物拍清楚（大约 8–10 m 内）又要把整圈拍清楚，两者对不上。人物射线还不能先打到星环（`test_lens_clearance.cjs` 不允许，这个断言没有放宽）。

当前终幕在人物/星环地面坐标系里：后退 26 m、侧向 −10 m、抬高 6 m、垂直 FOV 58°。镜头测试 PASS，相机离 `env_sky_starring` 最近 4.63 m，人物射线和星环射线（星环自身除外）都是空的。运行时相机世界坐标 `97.2, 44.9, 150.8`。

`sky-finale.png` 里人物只是底部的一个小点。画面中部是粗棕色树干和根，顶上是一块白平板（离环面 4.6 m 时，环看起来像一块板，不像一圈）。天空在右侧能看见，不是整屏钻进模型，但树干挡在镜头和观景台之间。

藏树没有去掉这棵干：`env_sky_greattree_canopy` 和 `env_sky_greattree_canopy_cards` 在旅程副本和棋盘副本上都被关掉（`buried:4`，缩放 0、停用、挪层、渲染器关闭，并暂停天空动画）。解码后的调色板 `env_sky_static_palette`（24,696 三角形）里，树冠柱范围内还有 1,593 个三角形（高度约 19–40 m）。整块调色板是岛体，不能藏。视线网格在「藏掉 greattree」之后，当前这个机位的中心仍然主要打在调色板上。

自由探索的 `sky-map.png` / `sky-tap.png` 仍是从台阶踏步底面往上拍人物。包围盒回退、沿视线抬高、以及「地图镜头若变成仰视就抬回人物上方」都没有把这个机位抬出台阶。

## 提交

| SHA | tree | 说明 |
|---|---|---|
| `e26e4d4ba8c4f0230dc972f073f12cec7dbd78c1` | `a4378640716ed92da93fd9693288dfcc7ff2c406` | 小标记，终幕退出岛体 |
| `ecc9446c7511e62fbd32f0840f335dc16e62c81d` | `337985dc3c22ff9b23ae3f29457bf32f0b5065dc` | 构建前的进度说明 |
| `7aff92559e60d9da76e1c04d7b4e91f143e9cd1a` | `7000f77a24fb3decfd8a352e57a33de0be1b269b` | 星环放到树旁，棋盘去掉道具介绍 |
| `333417ebb3f368be40941b733dafd125c00d090b` | `22f2faf9bec8a66358f989f0281d543e89a77b0f` | 终幕藏大树，物件镜头对机器人/风铃 |
| `2506c9d7f3e730ffe98543e231769e85c20af1e9` | `96180aaa9104ca25594b8d536fa4952b3854649a` | 终幕抬到星环上方 |
| `27f600d6baa43e64c242e345430ed3961dff0d1a` | `608c1c5bce16853176dbdc5246e0adf2a30e3e7e` | 重建前的进度说明 |
| `409f77034f22845dc704499aa095da20402a9456` | `c5ece31b8223df697fff594b98bbc83805304a56` | 沿射线藏树，按住物件镜头 |
| `e9b4367d4b8453974358092e5ccba83dfce8f160` | `fef98d99d6cb40b18a38cc8b0e3e51b3b3144678` | 等锁时的进度说明 |
| `a7d43703740f6298963d98be2b8f7d359f69b993` | `224f579ad672b760b9df026de4dea3c3e7929240` | 停天空动画，按包围盒藏树冠 |
| `2ee61238a91c1f9cb4398e8f362d3cb7ba89089a` | `0bc2ba629f08f1cc2cbde162035632c3cb581d1d` | 终幕侧移，让中心射线躲开大树 |
| `18fbcc0049a3772a61f5cbdf17545d1706860afc` | `90e550af026305a2946b8b44d596b3940b6e156b` | 终幕降低，少拍树冠 |
| `c8416c6bb48bb0371d162ac3fecb09b75490eaf9` | `ed313ea41d3c074710ff55ad8900375efd3709d4` | 终幕站到环的侧面 |
| `09bfd2841f7e54a78ec037d9ca2ecd96ecf80511` | `e7bda169e33c5fcf4c66b55d573eed85c1b1bf15` | 用旅程副本星环的包围盒中心，终幕不再交给镜头守卫改机位 |

本报告提交在上表之后。

## 测试

HEAD `09bfd2841f7e54a78ec037d9ca2ecd96ecf80511`。

- Node 22.22.2：109 项里 108 PASS。唯一非 PASS 是 `navigation-guard: BLOCKED_BROWSER`。套件状态 BLOCKED，退出码 1，和基线一样。没有 FAIL。
- Node 20.19.5：106 PASS。另外三项是 `navigation-guard: BLOCKED_BROWSER`、`legacy-board-ui-pure: BLOCKED_NODE`（需要 Node ≥ 22.6）、`reward-background-return: BLOCKED_NODE`（同样原因）。没有 FAIL。
- `frame-background` 门限没有放宽。`lens-clearance` 仍要求离网格 ≥ 0.6 m，并且人物射线不能先打到星环。

## 包体

wechat-release 未压缩字节和 **19,443,415**。web-test **20,238,040**。硬上限 24,641,536，还差很远。

相对 r4（19,335,755）**+107,660 B**。目标 +52,428 B（0.05 MiB）没有达到，超出目标 55,232 B。相对 r2 截图那次（19,435,130）**+8,285 B**。

非 `main` 分包与 r2、也与 r4 的非 main 合计相同，都是 18,086,784 B。r4 的 main = 19,335,755 − 18,086,784 = **1,248,971**。本轮 main = **1,356,631**。差值 1,356,631 − 1,248,971 = **107,660**，和总包差值一致。相对 r2 的 main（1,348,346）多 8,285 B，也和总包相对 r2 的差值一致。

| 分包 | 字节 |
|---|---:|
| root | 1,870,865 |
| audio_bgm_island | 418,907 |
| board_art | 2,131,356 |
| internal | 297,535 |
| main | 1,356,631 |
| region_island | 2,998,394 |
| region_lakeside | 541,965 |
| region_meadow | 2,934,449 |
| region_skycity | 3,326,944 |
| resources | 446,303 |
| shared_effects | 563,694 |
| static_seat_preview | 2,556,372 |

r1 那 47,294 B「非脚本」增量，对照文件清单之后就是编进 `main` 的脚本变大，不是另一类资源。相对 `f569ff0` 的玩家包没有新增二进制资源；非 main 分包字节与 r4 相同。把只在世界场景用的脚本挪到区域分包不会减少 guard 的总字节（分包计入总额）。`qaShot` 已按 `MINIGAME` 折叠，不进微信包。未引用的 `ExploreCamera.ts` 已删。要再削掉约 55 KB 的 main，就得删掉已经在玩的逻辑，这一轮没有这样做。

## DC、帧率、棋盘首帧

无头 web-test，软件 GL。FPS 是 1000/帧间隔中位数，会被软件渲染压低，不能当成真机帧率。`boardPresentMs` 是棋盘帧之后等到下一次 `AFTER_DRAW` 的时间，不是 16.7 ms 预算。

这一次（HEAD `09bfd284`）：

- 棋盘：DC 31（31–31），间隔中位数 18.7 ms，约 53.5 FPS。`boardPresentMs` 1.5。棋盘截图耗时 1212 ms，采样 777 ms。
- 海岛世界：DC 32（31–34），约 24.2 FPS。标记开关这一帧读到 34/34，增量 0；同一段里 DC 自己在 31–34 之间跳。更早一次同标记代码的采样是 32（开）/ 31（关），增量 +1，和「只多一个 MeshRenderer」一致。
- 草地：DC 49（38–50），约 23.5 FPS。
- 天空之城：DC 38（35–41），约 22.4 FPS。

更早一次（HEAD `2ee61238`，同样无头）棋盘约 60 FPS、DC 31，`boardPresentMs` 3；海岛约 32 FPS、标记增量 +1。无头帧率两次差一截，以 DC 为准更稳。

## 截图

23 张，拍摄时哈希互不相同。除草地棋盘外都是 `sips -Z 900`。草地棋盘在 900 px 时有 438,204 B，改成了长边 800 px（362,226 B）。其余都 ≤ 400 KB。没有两张文件内容相同。棋盘三张没有暂停菜单。终幕和天空地图的问题在上面，不把它们算成通过。

- `island-blend.png`：海岛，棋盘镜头切到人物的中途，人物在海边小路。
- `island-walk.png`：海岛两节点之间走路。
- `island-board.png`：真棋盘「04 小径守卫」。
- `island-markers.png`：人物脚边一把小橙旗，不再是穿身的白菱形。另外两种颜色的节点不在这张近景里。
- `island-map.png`：海岛自由探索，俯看小岛。
- `island-tap.png`：点按后沿路走。
- `island-prop.png`：人物站在椰树旁。
- `meadow-blend.png`：草地，镜头从棋盘切向人物。
- `meadow-walk.png`：草地小路走路。
- `meadow-board.png`：真棋盘「08 长风的约定」。长边 800 px。
- `meadow-markers.png`：草地节点小旗。
- `meadow-map.png`：草地自由探索。
- `meadow-tap.png`：草地点按走路。
- `meadow-prop.png`：木架上的金色风铃偏过一个角度，能看出点按反馈。后面有一块灰平面。
- `meadow-night.png`：夜间。人物在小路，风车，三只风铃，夜空。画面底部能看到彩虹桥的边。
- `sky-blend.png`：天空之城镜头切换。
- `sky-walk.png`：人物在花丛里，前方是柱廊。
- `sky-board.png`：真棋盘「12 天空之城的回声」。
- `sky-markers.png`：天空之城广场远景，旗子很小，三态看不清。
- `sky-map.png`：从台阶踏步底下往上拍。未过。
- `sky-tap.png`：同样从台阶底面看。未过。
- `sky-prop.png`：园丁机器人背面全身，花圃里。偏航从背后不容易看出来。
- `sky-finale.png`：树干占中部，顶上白平板，人物是小点，右侧有天空。未过。

## 可能和 sail / balloon 冲突的文件

`WorldIntegrationBoot.ts`、`WorldFlowComponent.ts`、`WorldNativeComposition.ts`、`RegionFlowTest.ts`、`ExploreInput.ts`、`RegionNodePlay.ts`、`ExploreCameraCore.ts`、`ExploreGate.ts`、`RegionNodes.ts`、`RegionNodeStage.ts`、`NodeMarkers.ts`、`ManagedMobileBoardUI.ts`、`tools/journey-integration/run-suite.cjs`。没有改 `JourneyTransport.ts` 和 `RegionJourneyAdapter.ts`。

## 未完成

- 终幕没有同时给出看得清的人物和看得清的 `env_sky_starring`。树干在调色板网格里，藏独立树冠节点无效。
- 天空之城自由探索镜头仍在台阶底面。
- 三态标记的颜色在代码里分开了，但没有一张近景把三种同时拍清楚。
- 包体相对 r4 多 107,660 B，没有回到 +52,428 B。

## 磁盘

结束时 `df -h ~` 可用约 4.9 GiB。`library` / `temp` / `build` 已删。未 push。
