# b20 hotfix — 草甸 warm-up C + 天空之城 RT

- 分支：`ggbot/b20-meadow-c-skycity-rt`
- 基底：`ggbot/release-b20` @ `b339414036cbba6d0b3053b035adb045b2e4b0e4`
- 功能提交：
  - `5e89c252750a18ad0841cff8dc1024d01451c201` 天空之城全管线 RT 不再每帧重建
  - `fd68032656d0d5942a7a99e7609d16dde12578ed` 草甸出航 shader warm-up C、两道门、清单
  - `b45315eae7a0c49763a6afb4f974b88816c1d560` 落地阶段匿名附件纹理池（本轮）
- 交付头：本文件所在提交。完整 SHA 用 `git rev-parse HEAD`。
- 没有跑微信上传，也没有跑 `cli upload`。

## Mac `ced9972f` 自测（本轮之前）

`ced9972fb7917119baa7220c783f4dab40019ab5`：

| 项 | 结果 |
|---|---|
| INTEGRATE 1 草甸 warm-up C | PASS。`QF_MEADOW_SPLIT` maxFrameWorkMs=2。起航没有 `env_meadow` LONG/SHADER |
| INTEGRATE 6 包体 | PASS。trial TOTAL 23,570,361 / MAIN 1,874,614。海岸子包不在这棵树里 |
| INTEGRATE 4 `skycity.board-background` | 73 个样本，98.6% cre=des=0（cre 均值 1.1，DepthStencil churn 1 行，uploads 均值 0.2） |
| INTEGRATE 4 `skycity.landing-board` | 未过。16 个样本 cre 308–399（均值 389.4），zero 比例 0，DepthStencil churn 16/16，uploads 均值 83.4、最大 87、upMB 最大 34.5。具名 SceneDepth/Radiance/LdrColor/UiColor 不在 churn 名单（`rt_named_rows=0`），名单上是匿名 `?:N` |

稳态棋盘已经被 pin 稳住。问题留在落地阶段。

## 改了什么

### 1. 草甸 warm-up C

出航起航帧上，`env_meadow` 大约 69 次同步 `createShader`，探针 B 记到 1601 ms。预加载本来只缓存网格和贴图。

`MeadowSailWarm.ts` 在岛上的 SailWarm 副本上，按出航准备的最终宏编译：草用 `meadow-grass-wind`，其余无顶点色的网格关掉 `USE_VERTEX_COLOR`。每帧最多 kick 一个变体，再 cache-hit 编译一个已经 kick 过的变体。离线代价是 kick 0.25 ms + cache-hit 0.5 ms = 0.75 ms，预算 4 ms。起航帧 `noteMeadowSailFrame` 把下一步记成空帧：0 kick、0 compile。还没编译完的 MeshRenderer 保持停用，起航那一帧的绘制带不走剩下的变体。没有新的遮罩或加载页。

`SailPreload.preloadMeadowForSail` 在挂上模型后调用 `beginMeadowSailWarm`。帆船 rig 仍然是 inactive。`RegionJourneyAdapter` 复用同一份风材质；没有帧时钟时仍走原来的 `configureMeadowVertexColors`。日景远山和穹顶保持关闭（`__qfSailWant=0`）。夜景穹顶要回来（`__qfSailWant=1`），但变体没编译完之前先停用。

Mac `ced9972f` 已确认这项。本轮没有再改预热。

### 2. 天空之城具名 RT（pin，已在 Mac 稳态上通过）

b3394140 的 pin 只在资源图顶点数量变化时，把 `Shadow*` 和 `DepthStencil\d+` 标成 PERSISTENT。3.8.8 内置前向管线还会为世界相机登记 MANAGED 的 `SceneDepth_*`、`Radiance*_*`、`LdrColor*_*`、`UiColor*_*`（以及 bloom 的 `BloomTex*`）。`_removeDeviceResource` 执行时 `resourceUses` 是空的，所以这些目标每帧销毁再创建。

`RoomLightingRig` 每次 `execute` 前都重新 pin，名字覆盖上述全管线目标。死窗口仍按窗口 id 释放。`SpotShadow*` 仍按灯，不按窗口。`Bloom0` 这种不匹配的名字保持 MANAGED。`SkycityCloudsea` 只在 `camera.far < 1200` 时写成 1200。

这道 pin 解释得了 `skycity.board-background` 的近 0，解释不了落地阶段的匿名 `?:N`。探针只在纹理还挂在 `deviceTextures` 上时才能叫出 SceneDepth 这类名字。落地阶段被销毁的纹理不在这张表里。

### 3. 落地阶段匿名附件池（本轮）

`RenderWindow` 自己的 color / depth 是 `device.createTexture` 出来的，不进 `deviceTextures`。销毁发生在 `Texture.destroy`。探针因此记成 `?:N`，格式仍是 DepthStencil。每秒大约 389 次创建和销毁，和整套附件每帧重建是同一类。

`ensureRtPool` 包住 `device.createTexture`。带 `COLOR_ATTACHMENT`（0x10）或 `DEPTH_STENCIL_ATTACHMENT`（0x20）的纹理，按 usage、format、宽高、samples、type、flags、depth、layer、mip 复用。纯采样贴图和 external（flags 0x4 / 0x8）不进池。池最多 32 张，并且保留的字节（宽×高×4）不超过 48 MB；更老的一张用原来的 `destroy` 放掉。单张超过 48 MB 的附件直接真销毁。

池在每次 `BEFORE_DRAW` 和 `execute` 前重新装到最外层。GPU 探针如果后包上来，下一次绘制前池会再包回去。探针对 `__qfRtReuse` 的命中不计 create / upload，也不把池的 recycle 换成自己的 destroy。发布包里探针整段被 strip，池仍在。

没有改落地镜头，没有改走路速度，没有删内容，没有加遮罩。`releaseResized` 仍会在描述尺寸变化时丢掉具名设备纹理；池只是让同尺寸的下一次创建不再向 GL 要新纹理。

## 怎么验证

```
QF_TYPESCRIPT_MODULE=/workspace/wt/ts5/node_modules/typescript \
DRACO3D=/workspace/wt/draco3d/node_modules/draco3d \
node tools/journey-integration/run-suite.cjs
```

本机这两条路径是指向已安装 TypeScript 5.4.5 和 draco3d 1.5.7 的符号链接。部分门会 `git show` 历史提交；那些对象已从 origin 按完整 SHA 取到本地。`glb-skin-bounds` 和 `dev-wording-selftest` 把临时目录放在仓库的父目录。本机仓库在 `/workspace`，父目录不可写，所以套件是在 bind mount `/tmp/qf-parent/repo` 里跑的。Mac 上仓库父目录可写，直接在仓库根跑即可。另外 `t02-dock` 读取 `/tmp/draco3d/node_modules/draco3d/draco3d.js`，本机把同一份 draco3d 链了过去。

套件跑在落地池代码上（工作区脚本与 `b45315eae7a0c49763a6afb4f974b88816c1d560` 一致；套件记录的 git HEAD 是启动时的 `ced9972fb7917119baa7220c783f4dab40019ab5`，因为说明文件还没提交）。369 项，368 PASS，0 FAIL。唯一的 BLOCKED 是 `navigation-guard`（BLOCKED_BROWSER）。运行器因此退出码为 1。没有放宽任何阈值。

单门：

- `tools/meadow/test_meadow_sail_warm.cjs`：69 个变体，未修复出航帧 1601 ms；修复后每帧至多 1 kick + 1 compile，模型时间 ≤ 0.75 ms；第 5 帧提前起航的那一帧 0 kick、0 compile；全部编译次数仍是 69。
- `tools/shadow-churn/test_skycity_rt_residency.cjs`：N=600，每帧把 residency 打回 MANAGED。修复后 steady creates = 0（DepthStencil0 与 SceneDepth_0 都是 0）。`b3394140` 的 RoomLightingRig 是 6000 次（10 个目标 × 600 帧）。没有放宽 N。
- `tools/shadow-churn/test_skycity_landing_rt_pool.cjs`：1170×2532 的 depth + color 连续销毁/创建 40 帧，原生 create 停在 2，原生 destroy 为 0。探针先包在池外，再被 BEFORE_DRAW 把池装回最外层；探针 cre=2、des=0、uploads=2（只有第一次分配）。采样贴图 10 张全部真创建真销毁。external 不进池。超过 48 MB 的附件真销毁。`Bloom0` 仍是 MANAGED。

## 包体增量

本机没有 Cocos Creator，没有打微信包。Mac 在 `ced9972f` 上量过 trial：TOTAL 23,570,361，MAIN 1,874,614。

本轮会进包的只有 `RoomLightingRig.ts`，相对 `ced9972f` 增加 4,924 字节未压缩源码。`CamTraceLog.ts` 增加 396 字节，在 `QF_PROBE` 里，release strip 后不进包。海岸子包 0。

| 项 | 上界 |
|---|---|
| 相对 `ced9972f` trial 的源码增量 | ≤ 4,924 B（未压缩；Creator 压缩后更小） |
| 推算 trial 总包 | ≤ 23,575,285 |
| 推算 trial 主包 | ≤ 1,879,538 |
| 预算 | 总包 ≤ 24,641,536；主包 ≤ 4,000,000；海岸 ≤ 943,718 |

绝对包体仍以 Mac 新构建为准。

## 证据

- `docs/r5/b20-hotfix/evidence/warmup-c-cost.json`
- `docs/r5/b20-hotfix/evidence/skycity-rt.json`（具名管线 pin；注明 Mac 落地阶段仍未过）
- `docs/r5/b20-hotfix/evidence/skycity-landing-rt.json`（匿名附件池，以及 `ced9972f` 落地/稳态数字）
- `docs/r5/b20-hotfix/evidence/suite-summary.json`

## 已测 / 未测

已测：上面的离线门，以及本轮全套件（369 项，368 PASS，0 FAIL，仅 navigation-guard BLOCKED_BROWSER）。草甸 warm-up C 和 `ced9972f` 包体已在 Mac 上通过。`skycity.board-background` 已在 Mac 上接近 0。

未在本机测：微信开发者工具、真机 GPU 探针、正式包。本轮没有上传。

## Mac 还要复测什么

同一条天空城自动播放（`?camTrace=1`，preTransition meadow→skycity，盖过 `skycity.landing-board` 和后面的 `skycity.board-background`）。通过标准：

1. `skycity.landing-board`：第一秒可以有一次分配。从第二个样本起，cre、des、以及由 create 带来的 uploads 接近 0，和现在的 `skycity.board-background` 同一类（zero 比例接近 1，而不是 cre 均值 ~389、uploads ~83/s）。DepthStencil churn 行接近 0。匿名 `?:N` 不再每秒往上加。
2. `skycity.board-background`：保持接近 0（cre 均值约 1、zero 比例约 0.99 这一档）。用来确认池没有把稳态打回去。
3. 若 cre=des=0 但 uploads 仍高：那是已有纹理的 copy，不是附件重建。分开记。本轮的通过线是 cre/des 和 create 驱动的 upload。
4. 重新打 trial 包。相对 23,570,361 / 1,874,614，源码上界 +4,924 B。总包、主包、海岸子包仍要落在预算内。

磁盘 Avail 建议 ≥ 9 GiB 再开 Creator。第一次 `cli open` 若没有游戏目标，按 HANDOFF R1 关掉再开一次。

通过之前不要上传。上传仍只走 `FORMAL_RELEASE=1 tools/build-guard/build-production-upload.sh`，脚本本身不上传。

若这道池在 Mac 上仍盖不住落地风暴，才考虑 waive。标准要同时满足：`skycity.board-background` 的 zero 比例仍 ≥ 0.98，并且 `skycity.landing-board` 从第二个样本起 cre 与 des 的中位数 ≤ 2/s、uploads ≤ 1/s。`ced9972f` 的 ~389/s 达不到这条。当前交付是修复，不是 waive。
