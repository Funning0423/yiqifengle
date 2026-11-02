# b20 hotfix — 草甸 warm-up C + 天空之城 RT

- 分支：`ggbot/b20-meadow-c-skycity-rt`
- 基底：`ggbot/release-b20` @ `b339414036cbba6d0b3053b035adb045b2e4b0e4`
- 功能提交：
  - `5e89c252750a18ad0841cff8dc1024d01451c201` 天空之城全管线 RT 不再每帧重建
  - `fd68032656d0d5942a7a99e7609d16dde12578ed` 草甸出航 shader warm-up C、两道门、清单
- 交付头：本文件所在提交。完整 SHA 用 `git rev-parse HEAD`。套件跑在功能头 `fd68032656d0d5942a7a99e7609d16dde12578ed` 上（本文只加说明，不改脚本）。
- 没有跑微信上传，也没有跑 `cli upload`。

## 改了什么

### 1. 草甸 warm-up C

出航起航帧上，`env_meadow` 大约 69 次同步 `createShader`，探针 B 记到 1601 ms。预加载本来只缓存网格和贴图。

`MeadowSailWarm.ts` 在岛上的 SailWarm 副本上，按出航准备的最终宏编译：草用 `meadow-grass-wind`，其余无顶点色的网格关掉 `USE_VERTEX_COLOR`。每帧最多 kick 一个变体，再 cache-hit 编译一个已经 kick 过的变体。离线代价是 kick 0.25 ms + cache-hit 0.5 ms = 0.75 ms，预算 4 ms。起航帧 `noteMeadowSailFrame` 把下一步记成空帧：0 kick、0 compile。还没编译完的 MeshRenderer 保持停用，起航那一帧的绘制带不走剩下的变体。没有新的遮罩或加载页。

`SailPreload.preloadMeadowForSail` 在挂上模型后调用 `beginMeadowSailWarm`。帆船 rig 仍然是 inactive。`RegionJourneyAdapter` 复用同一份风材质；没有帧时钟时仍走原来的 `configureMeadowVertexColors`。日景远山和穹顶保持关闭（`__qfSailWant=0`）。夜景穹顶要回来（`__qfSailWant=1`），但变体没编译完之前先停用。

### 2. 天空之城 RT

b3394140 的 pin 只在资源图顶点数量变化时，把 `Shadow*` 和 `DepthStencil\d+` 标成 PERSISTENT。3.8.8 内置前向管线还会为世界相机登记 MANAGED 的 `SceneDepth_*`、`Radiance*_*`、`LdrColor*_*`、`UiColor*_*`（以及 bloom 的 `BloomTex*`）。`_removeDeviceResource` 执行时 `resourceUses` 是空的，所以这些目标每帧销毁再创建。验收里天空之城到达后大约 400 次/秒的 DepthStencil 创建/销毁是同一类现象（帧率更低，探针名字有上限）。

`RoomLightingRig` 现在每次 `execute` 前都重新 pin，名字覆盖上述全管线目标。死窗口仍按窗口 id 释放。`SpotShadow*` 仍按灯，不按窗口。`Bloom0` 这种不匹配的名字保持 MANAGED。

`SkycityCloudsea` 只在 `camera.far < 1200` 时写成 1200，避免每帧改投影。棋盘额外相机没有私有 RenderTexture，没有改它，也没有改走路速度或删内容。

## 怎么验证

```
QF_TYPESCRIPT_MODULE=/workspace/wt/ts5/node_modules/typescript \
DRACO3D=/workspace/wt/draco3d/node_modules/draco3d \
node tools/journey-integration/run-suite.cjs
```

本机这两条路径是指向已安装 TypeScript 5.4.5 和 draco3d 1.5.7 的符号链接。部分门会 `git show` 历史提交；那些对象已从 origin 按完整 SHA 取到本地。`glb-skin-bounds` 和 `dev-wording-selftest` 把临时目录放在仓库的父目录。本机仓库在 `/workspace`，父目录不可写，所以套件是在 bind mount `/tmp/qf-parent/repo` 里跑的。Mac 上仓库父目录可写，直接在仓库根跑即可。另外 `t02-dock` 读取 `/tmp/draco3d/node_modules/draco3d/draco3d.js`，本机把同一份 draco3d 链了过去。

套件（功能头 fd680326）：368 项，367 PASS，0 FAIL。唯一的 BLOCKED 是 `navigation-guard`（BLOCKED_BROWSER）。运行器因此退出码为 1，状态记作 BLOCKED。没有放宽任何阈值。

单门：

- `tools/meadow/test_meadow_sail_warm.cjs`：69 个变体，未修复出航帧 1601 ms；修复后每帧至多 1 kick + 1 compile，模型时间 ≤ 0.75 ms；第 5 帧提前起航的那一帧 0 kick、0 compile；全部编译次数仍是 69。
- `tools/shadow-churn/test_skycity_rt_residency.cjs`：N=600，每帧把 residency 打回 MANAGED。修复后 steady creates = 0（DepthStencil0 与 SceneDepth_0 都是 0）。`b3394140` 的 RoomLightingRig 是 6000 次（10 个目标 × 600 帧），按 60 fps 就是 600 次/秒。原有 shadow-churn 与 rt-depth 门仍是 0 steady creates，负例仍然失败。

## 包体增量（估算）

本机没有 Cocos Creator，没有打微信包。

| 项 | 增量 |
|---|---|
| 新脚本 `MeadowSailWarm.ts` | 14,314 B 源码 |
| 新 `.meta` | 171 B |
| 其余脚本净增 | 约 1 KB 源码 |
| 海岸子包 | 0 |
| 主包上界 | ≤ 16 KB（按未压缩源码；Creator 压缩后更小） |
| 总包上界 | ≤ 16 KB |

预算仍是总包 ≤ 24,641,536 B，主包 ≤ 4,000,000 B，海岸子包 ≤ 943,718 B。绝对包体要 Mac 上的正式构建量。

## 证据

- `docs/r5/b20-hotfix/evidence/warmup-c-cost.json`
- `docs/r5/b20-hotfix/evidence/skycity-rt.json`
- `docs/r5/b20-hotfix/evidence/suite-summary.json`

## 已测 / 未测

已测：上面的离线门和全套件（0 FAIL，仅 navigation-guard BLOCKED_BROWSER）。

未测（Mac）：

1. 出航预热期间和起航帧的真实帧时间。目标是预热 ≤ 4 ms/帧，起航帧不再出现约 1.6 s 的 `env_meadow` shader 编译。看 `[QF_GPU]`，起航帧不应再为这批变体打 LONG。
2. 玩家在大约 70 帧预热结束前就起航：未编译的渲染器保持关闭，画面会晚几帧补上，换来的是起航帧不编译。
3. 夜景穹顶在自己的变体编译完之前保持关闭，编译完再打开。
4. 到达天空之城之后，DepthStencil / SceneDepth / Radiance / LdrColor / UiColor 的 cre/des 应接近 0，上传带宽应掉下来。手机上约 400 次/秒是同一类，要用真机探针确认。
5. 旅途里 `env_skycity` 第一次绘制的 shader 风暴没有被这次改动摊开。棋盘副本仍由已有的 RegionBoardStaging 管。
6. 正式包的总大小、主包、海岸子包。
7. 每帧重 pin 会扫一遍资源图。离线模型认为这是小开销；Mac 确认它没有变成新的长帧。

## Mac 下一步

按 HANDOFF 的空闲和锁屏规则，在 Mac 上量上面 1、4、6。通过之前不要上传。上传仍只走 `FORMAL_RELEASE=1 tools/build-guard/build-production-upload.sh`，脚本本身不上传。
