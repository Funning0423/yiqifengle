# b20 hotfix — 草甸 warm-up C + 天空之城 RT

- 分支：`ggbot/b20-meadow-c-skycity-rt`
- 基底：`ggbot/release-b20` @ `b339414036cbba6d0b3053b035adb045b2e4b0e4`
- 功能提交：
  - `5e89c252750a18ad0841cff8dc1024d01451c201` 天空之城全管线 RT 不再每帧重建
  - `fd68032656d0d5942a7a99e7609d16dde12578ed` 草甸出航 shader warm-up C、两道门、清单
  - `b45315eae7a0c49763a6afb4f974b88816c1d560` 落地阶段附件纹理池（COLOR / DEPTH，尺寸 ≥ 1）
  - `968ab266c4e401e0cac35c5e3efb9b1aab33def2` 同一池扩到稳定尺寸的小纹理和 0×0 pass dummy（本轮）
- 交付头：本文件所在提交。完整 SHA 用 `git rev-parse HEAD`。
- 没有跑微信上传，也没有跑 `cli upload`。

## Mac `ced9972f` 自测

`ced9972fb7917119baa7220c783f4dab40019ab5`：

| 项 | 结果 |
|---|---|
| INTEGRATE 1 草甸 warm-up C | PASS。`QF_MEADOW_SPLIT` maxFrameWorkMs=2。起航没有 `env_meadow` LONG/SHADER |
| INTEGRATE 6 包体 | PASS。trial TOTAL 23,570,361 / MAIN 1,874,614。海岸子包不在这棵树里 |
| INTEGRATE 4 `skycity.board-background` | 73 个样本，98.6% cre=des=0（cre 均值 1.1，DepthStencil churn 1 行，uploads 均值 0.2） |
| INTEGRATE 4 `skycity.landing-board` | 未过。16 个样本 cre 308–399（均值 389.4），zero 比例 0，DepthStencil churn 16/16，uploads 均值 83.4、最大 87、upMB 最大 34.5。具名 SceneDepth/Radiance/LdrColor/UiColor 不在 churn 名单（`rt_named_rows=0`），名单上是匿名 `?:N` |

## Mac `186b34e7` 复测（本轮之前，未过）

`186b34e7f627c3f15ac31c3c5b2c5b30a5d7c015`（功能 `b45315ea`）。DevTools 在录制中途卡住，但落地整段和约 79 秒棋盘背景已经记下。没有截图。没有上传。

| 窗口 | n | cre 均值 | cre/des 中位 | zero 比例 | uploads 中位 | 备注 |
|---|---:|---:|---:|---:|---:|---|
| `skycity.landing-board` 从第 2 个样本 | 15 | 112.3（108–114） | 112 / 112 | 0 | 0 | up_max 0，DepthStencil 具名 churn 行 0，churn 字段 `-` |
| `skycity.landing-board` 全窗口 | 16 | 108.8 | 112 / 112 | 0 | 0 | cre 最小 56（第一秒），up_max 3，upMB 最大 0.9 |
| `skycity.board-background` | 79 | 1.1 | 0 / 0 | 0.975 | 0 | cre 最大 78。大约 2 秒后全 0。waive 要 ≥ 0.98，差大约 2 个非零样本 |

探针包（`STRIP_PROBES=0`）TOTAL 23,600,600 / release-gates MAIN 1,874,614。预算内。正式 strip 重建没做（磁盘 Avail 低于 9 GiB，而且落地未过）。

相对 `ced9972f` 的 ~389/s，附件池把 ≥256KB 的 create 驱动 upload 打到了 0，具名 DepthStencil churn 也是 0。探针仍看见大约 112 次/秒的 `createTexture` / `destroy`。112/s 很平（108–114），约等于每帧 2 次，而且 cre 与 des 成对。池命中会交回同一个对象，探针不会把它再记成 create；所以这 112 次是池键当时拒绝的新对象，不是“命中了但仍被计数”。它们都小于探针的 256KB upload 线，所以 uploads 可以是 0 而 cre/des 仍然很高。waive 要落地从第 2 个样本起 cre 与 des 中位 ≤ 2/s，并且棋盘背景 zero ≥ 0.98。112 和 0.975 都没过。本轮继续修，不是 waive。

## 改了什么

### 1. 草甸 warm-up C

出航起航帧上，`env_meadow` 大约 69 次同步 `createShader`，探针 B 记到 1601 ms。预加载本来只缓存网格和贴图。

`MeadowSailWarm.ts` 在岛上的 SailWarm 副本上，按出航准备的最终宏编译：草用 `meadow-grass-wind`，其余无顶点色的网格关掉 `USE_VERTEX_COLOR`。每帧最多 kick 一个变体，再 cache-hit 编译一个已经 kick 过的变体。离线代价是 kick 0.25 ms + cache-hit 0.5 ms = 0.75 ms，预算 4 ms。起航帧 `noteMeadowSailFrame` 把下一步记成空帧：0 kick、0 compile。还没编译完的 MeshRenderer 保持停用，起航那一帧的绘制带不走剩下的变体。没有新的遮罩或加载页。

`SailPreload.preloadMeadowForSail` 在挂上模型后调用 `beginMeadowSailWarm`。帆船 rig 仍然是 inactive。`RegionJourneyAdapter` 复用同一份风材质；没有帧时钟时仍走原来的 `configureMeadowVertexColors`。日景远山和穹顶保持关闭（`__qfSailWant=0`）。夜景穹顶要回来（`__qfSailWant=1`），但变体没编译完之前先停用。

Mac `ced9972f` 已确认这项。本轮没有再改预热。

### 2. 天空之城具名 RT（pin，已在 Mac 稳态上通过）

b3394140 的 pin 只在资源图顶点数量变化时，把 `Shadow*` 和 `DepthStencil\d+` 标成 PERSISTENT。3.8.8 内置前向管线还会为世界相机登记 MANAGED 的 `SceneDepth_*`、`Radiance*_*`、`LdrColor*_*`、`UiColor*_*`（以及 bloom 的 `BloomTex*`）。`_removeDeviceResource` 执行时 `resourceUses` 是空的，所以这些目标每帧销毁再创建。

`RoomLightingRig` 每次 `execute` 前都重新 pin，名字覆盖上述全管线目标。死窗口仍按窗口 id 释放。`SpotShadow*` 仍按灯，不按窗口。`Bloom0` 这种不匹配的名字保持 MANAGED。`SkycityCloudsea` 只在 `camera.far < 1200` 时写成 1200。

这道 pin 解释得了 `skycity.board-background` 的近 0。它解释不了小于 256KB、而且不在 pin 名字里的每帧 create/destroy。

### 3. 落地纹理池扩到小纹理（本轮）

`ensureRtPool` 仍包住 `device.createTexture`，命中时交回同一个对象，不进探针。`b45315ea` 只收 `COLOR_ATTACHMENT`（0x10）或 `DEPTH_STENCIL_ATTACHMENT`（0x20）且宽高都 ≥ 1 的纹理。Mac `186b34e7` 说明屏幕尺寸的附件已经停了（uploads 中位 0），剩下的大约每帧 2 张是这条键拒绝的：纯采样、usage 为空、或者 0×0 的 pass dummy。

现在同一条键覆盖所有非 external、非 texture view 的纹理，包括采样贴图和 `new TextureInfo()` 那种 0×0 描述。缺省的 samples / depth / layer / mip 按引擎默认收成 1，缺省 type 收成 TEX2D（1），这样下一帧省略字段和写明默认值会命中同一张。显式 TEX1D（type 0）仍然分开。external（flags 0x4 / 0x8）和带 `texture` 的 view 仍不进池。

池仍是最多 32 张、保留字节（宽×高×4）不超过 48 MB。更老的一张用原来的 `destroy` 放掉。单张超过 48 MB 的直接真销毁。每次 `BEFORE_DRAW` 和 `execute` 前把池装回最外层。探针若后包上来，下一次绘制前池会再包回去。对象已经在探针的 live 表里、并且标了池，也不再计 create。发布包里探针整段被 strip，池仍在。

没有改落地镜头，没有改走路速度，没有删内容，没有加遮罩。`Bloom0` 仍是 MANAGED。N=600 的 residency 门没有放宽。

若 Mac 上这 112 次/秒的描述每帧都在变尺寸或格式，或者是 external，这道池仍然不会命中。那种情况要在复测里分开记，而不是把探针的小纹理计数藏掉。

## 怎么验证

```
QF_TYPESCRIPT_MODULE=/workspace/wt/ts5/node_modules/typescript \
DRACO3D=/workspace/wt/draco3d/node_modules/draco3d \
node tools/journey-integration/run-suite.cjs
```

本机这两条路径是指向已安装 TypeScript 5.4.5 和 draco3d 1.5.7 的符号链接。部分门会 `git show` 历史提交；那些对象已从 origin 按完整 SHA 取到本地。`glb-skin-bounds` 和 `dev-wording-selftest` 把临时目录放在仓库的父目录。本机仓库在 `/workspace`，父目录不可写，所以套件是在 bind mount `/tmp/qf-parent/repo` 里跑的。Mac 上仓库父目录可写，直接在仓库根跑即可。另外 `t02-dock` 读取 `/tmp/draco3d/node_modules/draco3d/draco3d.js`，本机把同一份 draco3d 链了过去。

套件跑在 `968ab266c4e401e0cac35c5e3efb9b1aab33def2`（启动时的 git HEAD 就是这个功能提交；说明文件在套件之后提交）。369 项，368 PASS，0 FAIL。唯一的 BLOCKED 是 `navigation-guard`（BLOCKED_BROWSER）。运行器因此退出码为 1。没有放宽任何阈值。

单门：

- `tools/meadow/test_meadow_sail_warm.cjs`：69 个变体，未修复出航帧 1601 ms；修复后每帧至多 1 kick + 1 compile，模型时间 ≤ 0.75 ms；第 5 帧提前起航的那一帧 0 kick、0 compile；全部编译次数仍是 69。
- `tools/shadow-churn/test_skycity_rt_residency.cjs`：N=600，每帧把 residency 打回 MANAGED。修复后 steady creates = 0（DepthStencil0 与 SceneDepth_0 都是 0）。`b3394140` 的 RoomLightingRig 是 6000 次（10 个目标 × 600 帧）。没有放宽 N。
- `tools/shadow-churn/test_skycity_landing_rt_pool.cjs`：1170×2532 的 depth + color 连续销毁/创建 40 帧，原生 create 停在 2，原生 destroy 为 0。探针先包在池外，再被 BEFORE_DRAW 把池装回最外层；探针 cre=2、des=0、uploads=2。同一张 64×64 采样贴图连续 10 帧，原生 create 停在 1。16×16 的 usage-none 贴图加一个空描述，40 帧原生 create 停在 2、destroy 为 0。external 和 texture view 不进池。超过 48 MB 的附件真销毁。`Bloom0` 仍是 MANAGED。

## 包体增量

本机没有 Cocos Creator，没有打微信包。

Mac 在 `186b34e7` 上量过探针包（`STRIP_PROBES=0`）：TOTAL 23,600,600，release-gates MAIN 1,874,614。`ced9972f` 的 trial 是 TOTAL 23,570,361 / MAIN 1,874,614。

本轮进包的只有 `RoomLightingRig.ts`，相对 `186b34e7` 少 31 字节未压缩源码（50,853 → 50,822），相对 `ced9972f`（45,929）多 4,893 字节。`CamTraceLog.ts` 多 62 字节，在 `QF_PROBE` 里，release strip 后不进包。海岸子包 0。

| 项 | 上界 |
|---|---|
| 相对 `186b34e7` 的进包源码 | −31 B（未压缩）。探针行 +62 B，strip 后不进包 |
| 探针包 TOTAL（`STRIP_PROBES=0`） | ≤ 23,600,662（已量 23,600,600，加上未压缩探针行 62 B；rig 源码更小） |
| 探针包 MAIN 根 | ≤ 1,874,676（1,874,614 + 62） |
| 相对 `ced9972f` trial 的 strip 推算 | 总包 ≤ 23,575,254；主包 ≤ 1,879,507（增量若全在主包） |
| 预算 | 总包 ≤ 24,641,536；主包 ≤ 4,000,000；海岸 ≤ 943,718 |

绝对包体仍以 Mac 新构建为准。

## 证据

- `docs/r5/b20-hotfix/evidence/warmup-c-cost.json`
- `docs/r5/b20-hotfix/evidence/skycity-rt.json`（具名管线 pin；注明 Mac `186b34e7` 落地余量在纹理池，不在这道 pin）
- `docs/r5/b20-hotfix/evidence/skycity-landing-rt.json`（扩池之后的门，以及 `ced9972f` / `186b34e7` 的落地数字）
- `docs/r5/b20-hotfix/evidence/suite-summary.json`

## 已测 / 未测

已测：上面的离线门，以及本轮全套件（369 项，368 PASS，0 FAIL，仅 navigation-guard BLOCKED_BROWSER）。草甸 warm-up C 和 `ced9972f` 包体已在 Mac 上通过。`skycity.board-background` 在 `186b34e7` 上 zero 比例 0.975（中位 cre 0）。落地从第 2 个样本起仍是 112/s，本轮的池还没在 Mac 上复测。

未在本机测：微信开发者工具、真机 GPU 探针、正式包。本轮没有上传。

## Mac 还要复测什么

同一条天空城自动播放（`?camTrace=1`，preTransition meadow→skycity，盖过 `skycity.landing-board` 和后面的 `skycity.board-background`）。构建用本交付头。通过标准：

1. `skycity.landing-board` 从第 2 个样本起：cre 与 des 的中位数 ≤ 2/s，最好是 0。uploads 中位仍 ≤ 1/s。不要再停在 ~112/s。
2. `skycity.board-background`：zero 比例 ≥ 0.98（`186b34e7` 是 0.975，cre 均值 1.1，大约 2 秒后全 0）。
3. 若 cre=des 已经接近 0 但 uploads 仍高：那是已有纹理的 copy，分开记。
4. 若 cre 与 des 仍然成对地停在大约 112/s：描述每帧都在变，或者是 external。把那一秒的宽高、format、usage 记下来。不要靠放宽探针阈值过线。
5. 重新打 trial 包。进包源码相对 `186b34e7` 少 31 B。总包、主包、海岸子包仍要落在预算内。

磁盘 Avail 建议 ≥ 9 GiB 再开 Creator。第一次 `cli open` 若没有游戏目标，按 HANDOFF R1 关掉再开一次。

通过之前不要上传。上传仍只走 `FORMAL_RELEASE=1 tools/build-guard/build-production-upload.sh`，脚本本身不上传。

waive 条没有放宽，本轮也不是 waive：`skycity.board-background` 的 zero 比例 ≥ 0.98，并且 `skycity.landing-board` 从第 2 个样本起 cre 与 des 的中位数 ≤ 2/s、uploads ≤ 1/s。`186b34e7` 的 112/s 和 0.975 都达不到。
