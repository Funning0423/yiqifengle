# b20 hotfix — 草甸 warm-up C + 天空之城 RT

- 分支：`ggbot/b20-meadow-c-skycity-rt`
- 基底：`ggbot/release-b20` @ `b339414036cbba6d0b3053b035adb045b2e4b0e4`
- 功能提交：
  - `5e89c252750a18ad0841cff8dc1024d01451c201` 天空之城全管线 RT 不再每帧重建
  - `fd68032656d0d5942a7a99e7609d16dde12578ed` 草甸出航 shader warm-up C、两道门、清单
  - `b45315eae7a0c49763a6afb4f974b88816c1d560` 落地阶段附件纹理池（COLOR / DEPTH，尺寸 ≥ 1）
  - `968ab266c4e401e0cac35c5e3efb9b1aab33def2` 同一池扩到稳定尺寸的小纹理和 0×0 pass dummy
  - `36df21330a478355236b3e4b9deff4dd62fde29d` 纹理 view 入池，sub-256KB 同族可 `resize`；探针每秒行带 small 直方图
  - `6c11ebd0bd7d0cfa387ae2f1cee280a4e9c47981` 底图 `resize` 之后丢掉尺寸已过期的 view
  - `2179dd9953b6db16ef08b861a3c9308ef6a564e6` 棋盘标签条（约 1 MB 以内）同族 `resize`，view 跟着底图改尺寸而不是新建（本轮）
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

相对 `ced9972f` 的 ~389/s，附件池把 ≥256KB 的 create 驱动 upload 打到了 0，具名 DepthStencil churn 也是 0。探针仍看见大约 112 次/秒的 `createTexture` / `destroy`。112/s 很平（108–114），约等于每帧 2 次，而且 cre 与 des 成对。池命中会交回同一个对象，探针不会把它再记成 create；所以这 112 次是池键当时拒绝的新对象。它们都小于探针的 256KB upload 线，所以 uploads 可以是 0 而 cre/des 仍然很高。waive 要落地从第 2 个样本起 cre 与 des 中位 ≤ 2/s，并且棋盘背景 zero ≥ 0.98。112 和 0.975 都没过。

## Mac `606f434e` 复测（扩池之后，落地仍未过）

`606f434eb6289aa03585165ee9f76aff775fa504`（功能 `968ab266`）。DevTools 在 `recordMs` 中途卡住。落地 16 秒和大约 85 秒棋盘背景已经记下。没有截图。没有上传。

| 窗口 | n | cre 均值 | cre/des 中位 | zero 比例 | uploads 中位 | 备注 |
|---|---:|---:|---:|---:|---:|---|
| `skycity.landing-board` 从第 2 个样本 | 15 | 112.8 | 114 / 114 | 0 | 0 | up_max 0，具名 churn 行 0，churn 字段 `-` |
| `skycity.landing-board` 全窗口 | 16 | 112.1 | 114 / 114 | 0 | 0 | up_max 0 |
| `skycity.board-background` | 85 | 0.4 | 0 / 0 | 0.988 | 0 | up_max 7。zero ≥ 0.98，这一半过了 |

`live` 在落地全程是 384，所以是成对 create/destroy。落地窗口里 ≥256KB 的 TEX 明细是 0 行（整段运行 TEX create 明细 32 行，都在更早的加载）。探针包（`STRIP_PROBES=0`）TOTAL 23,600,616 / release-gates MAIN 1,874,614。预算内。正式 strip 重建没做。上传继续停着。

精确尺寸池没有把这 114/s 吃掉。`TextureViewInfo` 没有 width/height，探针按描述算出来是 0 字节，所以既不进 TEX 明细，uploads 也是 0，但 `createTexture` / `destroy` 仍然各记一次。大约每帧 2 次，和 114/s 对得上。尺寸每帧在变、而且小于 256KB 的图像也会错过精确键。

## Mac `ac9a0aeb` 复测（落地已过，棋盘背景未过）

整合头 `ac9a0aeb224e6e7281bd576f7e0e97ca9bebdf0f`（`4804822f` + 运镜 `f2075503` + 场景特效 `6f95dd71`，分支 `gbt/r5-b20-integrate-landing-visual`）。本分支不包含那两个提交。没有上传。

| 窗口 | n | cre/des/up 中位 | zero 比例 | 结果 |
|---|---:|---:|---:|---|
| `skycity.landing-board` 从第 2 个样本 | 15 | 0 / 0 / 0 | 1 | 过。cre/des ≤ 2/s，uploads ≤ 1/s |
| `skycity.board-background` | 55 | 0 / 0 / 0 | 0.964 | 未过。要 ≥ 0.98。`606f434e` 是 0.988 |

棋盘背景只有开头两秒 `cre>0`，`des` 全程是 0，之后整段 `cre=0`。`live` 从 405 到 407 再到 411，然后停住。

- `smallN=5 small=f35:u0:g0:s0:t1:v1:e0=5@1-1187x1-170`（cre=6，up=3）
- `smallN=3 small=f35:u0:g0:s0:t1:v1:e0=3@300-1367x158-175`（cre=5，up=5）

`v1` 是 `TextureViewInfo`（没有 usage/flags/samples，所以记成 u0 g0 s0）。宽高是底图的尺寸，不是裁切矩形。同一秒里 view 的张数多于「不进 small= 的 create」，说明小于 256KB 的底图已经被同族 resize 吃掉，view 和 ≥256KB 的底图仍是新的 `createTexture`。标签 `reset` 先销毁 view 和底图，再按 canvas 的新尺寸创建。1×1 占位到大约 1367×175（约 1 MB）正好跨过当时的 256KB 上限。

## 改了什么

### 1. 草甸 warm-up C

出航起航帧上，`env_meadow` 大约 69 次同步 `createShader`，探针 B 记到 1601 ms。预加载本来只缓存网格和贴图。

`MeadowSailWarm.ts` 在岛上的 SailWarm 副本上，按出航准备的最终宏编译：草用 `meadow-grass-wind`，其余无顶点色的网格关掉 `USE_VERTEX_COLOR`。每帧最多 kick 一个变体，再 cache-hit 编译一个已经 kick 过的变体。离线代价是 kick 0.25 ms + cache-hit 0.5 ms = 0.75 ms，预算 4 ms。起航帧 `noteMeadowSailFrame` 把下一步记成空帧：0 kick、0 compile。还没编译完的 MeshRenderer 保持停用，起航那一帧的绘制带不走剩下的变体。没有新的遮罩或加载页。

`SailPreload.preloadMeadowForSail` 在挂上模型后调用 `beginMeadowSailWarm`。帆船 rig 仍然是 inactive。`RegionJourneyAdapter` 复用同一份风材质；没有帧时钟时仍走原来的 `configureMeadowVertexColors`。日景远山和穹顶保持关闭（`__qfSailWant=0`）。夜景穹顶要回来（`__qfSailWant=1`），但变体没编译完之前先停用。

Mac `ced9972f` 已确认这项。本轮没有再改预热。

### 2. 天空之城具名 RT（pin，已在 Mac 稳态上通过）

b3394140 的 pin 只在资源图顶点数量变化时，把 `Shadow*` 和 `DepthStencil\d+` 标成 PERSISTENT。3.8.8 内置前向管线还会为世界相机登记 MANAGED 的 `SceneDepth_*`、`Radiance*_*`、`LdrColor*_*`、`UiColor*_*`（以及 bloom 的 `BloomTex*`）。`_removeDeviceResource` 执行时 `resourceUses` 是空的，所以这些目标每帧销毁再创建。

`RoomLightingRig` 每次 `execute` 前都重新 pin，名字覆盖上述全管线目标。死窗口仍按窗口 id 释放。`SpotShadow*` 仍按灯，不按窗口。`Bloom0` 这种不匹配的名字保持 MANAGED。`SkycityCloudsea` 只在 `camera.far < 1200` 时写成 1200。

`606f434e` 上棋盘背景 zero 比例 0.988。落地余下的 114/s 不在这份具名名单里：TEX 明细是 0 行。本轮把 pin 扩到每一个 MANAGED 顶点，`Bloom0` 仍是 MANAGED。名字从资源图消失时，`releaseOrphans` 放掉对应的 device texture（`find` 返回 null 或 0xFFFFFFFF 都算消失）。死窗口仍按窗口 id 释放。

### 3. 落地纹理池：精确键、view、2 MB 以内同族 resize（本轮）

`ensureRtPool` 仍包住 `device.createTexture`，命中时交回同一个对象，不进探针。

`968ab266` 的精确键覆盖所有非 external、非 view 的纹理，包括采样贴图和 0×0 pass dummy。Mac `606f434e` 说明这条键不够：落地 cre/des 仍是 114/s。

本轮加两道：

- **View**。`TextureViewInfo` 带 `texture`，没有宽高。按底图对象 id 加子资源范围（type / format / baseLevel / levelCount / baseLayer / layerCount / basePlane / planeCount）入池。缺省按引擎收成 TEX2D、level/layer/plane count = 1。两张同时活着的 view 不会共用同一个对象。底图真销毁时，它的 view 一并放掉。底图尺寸变了之后，空闲 view 若有 `resize`，就地改掉初始化时拷下的宽高再交回（WebGL 的 view 和底图共用 GL 纹理，`resize` 只改 view 上的那份尺寸）。没有 `resize`、或改完宽高对不上时，旧 view 真销毁，下一次是原生 create。view 单独封顶 64，不占 32 张纹理的名额。
- **2 MB 以内同族 resize**。精确键没命中、请求的宽×高×层×4 小于 2 MB、并且空闲纹理自己也小于 2 MB 且有 `resize` 时，取一张同族纹理改尺寸再交回。同族是 usage / format / samples / type / flags / depth / layers，mip 只分成「1」和「有 mip」。没有 `resize` 的对象不改尺寸，下一档尺寸仍是一次真的 `createTexture`。2 MB 及以上不走这条：1024×512 仍是精确键，1170×2532 的屏幕目标（约 12 MB）不会被缩掉。`ac9a0aeb` 的棋盘条最大约 1367×175（约 1 MB），盖得住。

external（flags 0x4 / 0x8，或 `externalRes`）仍不进池。池仍是最多 32 张纹理、保留字节不超过 48 MB。每次 `BEFORE_DRAW` 和 `execute` 前把池装回最外层。发布包里探针整段被 strip，池仍在。

探针在每秒那一行加上 `smallN=` 和 `small=`。小于 256KB 的 create（含 view，宽高用底图的）按 format / usage / flags / samples / type / v / e 归族，并带宽高或宽高范围。不走 `Error().stack`。TEX 明细仍只给 ≥256KB。池命中不会记进 `smallN`。若 Mac 上 cre/des 仍成对偏高，这一行就是剩下的描述，不用再降 TEX 阈值。

没有改落地镜头，没有改走路速度，没有删内容，没有加遮罩。`Bloom0` 仍是 MANAGED。N=600 的 residency 门没有放宽。waive 条没有放宽。

## 怎么验证

```
QF_TYPESCRIPT_MODULE=/workspace/wt/ts5/node_modules/typescript \
DRACO3D=/workspace/wt/draco3d/node_modules/draco3d \
node tools/journey-integration/run-suite.cjs
```

本机这两条路径是指向已安装 TypeScript 5.4.5 和 draco3d 1.5.7 的符号链接。部分门会 `git show` 历史提交；那些对象已从 origin 按完整 SHA 取到本地。`glb-skin-bounds` 和 `dev-wording-selftest` 把临时目录放在仓库的父目录。本机仓库在 `/workspace`，父目录不可写，所以套件是在 bind mount `/tmp/qf-parent/repo` 里跑的。Mac 上仓库父目录可写，直接在仓库根跑即可。另外 `t02-dock` 读取 `/tmp/draco3d/node_modules/draco3d/draco3d.js`，本机把同一份 draco3d 链了过去。

套件跑在 `2179dd9953b6db16ef08b861a3c9308ef6a564e6`（启动时的 git HEAD 就是这个功能提交；说明文件在套件之后提交）。369 项，368 PASS，0 FAIL。唯一的 BLOCKED 是 `navigation-guard`（BLOCKED_BROWSER）。运行器因此退出码为 1。没有放宽任何阈值。

单门：

- `tools/meadow/test_meadow_sail_warm.cjs`：69 个变体，未修复出航帧 1601 ms；修复后每帧至多 1 kick + 1 compile，模型时间 ≤ 0.75 ms；第 5 帧提前起航的那一帧 0 kick、0 compile；全部编译次数仍是 69。
- `tools/shadow-churn/test_skycity_rt_residency.cjs`：N=600，每帧把 residency 打回 MANAGED。修复后 steady creates = 0（DepthStencil0 与 SceneDepth_0 都是 0）。`b3394140` 的 RoomLightingRig 是 6000 次（10 个目标 × 600 帧）。没有放宽 N。
- `tools/shadow-churn/test_skycity_landing_rt_pool.cjs`：1170×2532 的 depth + color 连续销毁/创建 40 帧，原生 create 停在 2，原生 destroy 为 0。探针先包在池外，再被 BEFORE_DRAW 把池装回最外层；探针 cre=2、des=0、uploads=2。同一张 64×64 采样贴图连续 10 帧，原生 create 停在 1。16×16 的 usage-none 贴图加一个空描述，40 帧原生 create 停在 2、destroy 为 0。同一张 view 连续 40 帧，原生 create 停在 1，探针 des=0；两张同时活着的 view 不是同一个对象。底图从 32 改到 40 且 view 有 `resize` 时，交回同一张 view，探针 cre 不增加。view 没有 `resize` 时，旧 view 销毁，新尺寸是一次原生 create。usage 22 的 1×1 与 1187×170 来回 40 帧，图像加 view 只各创建一次。300×158 再要 1367×175 也不再分配。16×8 的采样图宽在 16–20 之间变，有 `resize` 时原生 create 停在 1。1024×512 换成 1024×256 仍是两次原生 create（2 MB 不进 loose）。没有 `resize` 的 12×12 换成 13×12 也是两次。external 不进池。超过 48 MB 的附件真销毁。`Bloom0` 仍是 MANAGED，未具名的 MANAGED 顶点会被 pin。`find` 返回 null 的 device texture 会释放。
- `tools/sync-probe/test_gpu_probe_src.cjs`：16×16 不产生 TEX 明细行。跨过 1 秒后，每秒行有 `smallN=2`，以及 `f35:…:v0:e0=1@16x16` 和 view 的 `v1` `@64x32`（宽高取自底图）。≥256KB 的 create/destroy 仍带 `src=`。

## 包体增量

本机没有 Cocos Creator，没有打微信包。

Mac 在 `186b34e7` 上量过探针包（`STRIP_PROBES=0`）：TOTAL 23,600,600，release-gates MAIN 1,874,614。`ced9972f` 的 trial 是 TOTAL 23,570,361 / MAIN 1,874,614。

本轮进包的是 `RoomLightingRig.ts`。相对 `606f434e` 的源码（50,822）是 58,419，未压缩 +7,597 字节。相对 `ced9972f`（45,929）是 +12,490 字节。`CamTraceLog.ts` 相对 `606f434e`（42,432）是 44,214，+1,782 字节，在 `QF_PROBE` 里，release strip 后不进包。海岸子包 0。

| 项 | 上界 |
|---|---|
| 相对 `606f434e` 的进包源码 | +7,597 B（未压缩 rig）。探针行 +1,782 B，strip 后不进包 |
| 探针包 TOTAL（`STRIP_PROBES=0`） | ≤ 23,609,995（Mac `606f434e` 已量 23,600,616，加上未压缩 rig 7,597 与探针 1,782） |
| 探针包 MAIN 根 | ≤ 1,883,993（1,874,614 + 7,597 + 1,782，增量若全在主包） |
| 相对 `ced9972f` trial 的 strip 推算 | 总包 ≤ 23,582,851；主包 ≤ 1,887,104（增量若全在主包） |
| 预算 | 总包 ≤ 24,641,536；主包 ≤ 4,000,000；海岸 ≤ 943,718 |

绝对包体仍以 Mac 新构建为准。

## 证据

- `docs/r5/b20-hotfix/evidence/warmup-c-cost.json`
- `docs/r5/b20-hotfix/evidence/skycity-rt.json`（具名管线 pin；落地余量在纹理池，不在这道 pin）
- `docs/r5/b20-hotfix/evidence/skycity-landing-rt.json`（view、2 MB 同族 resize，以及 `ced9972f` / `186b34e7` / `606f434e` 的落地数字）
- `docs/r5/b20-hotfix/evidence/suite-summary.json`

## 已测 / 未测

已测：上面的离线门，以及本轮全套件（369 项，368 PASS，0 FAIL，仅 navigation-guard BLOCKED_BROWSER，跑在 `2179dd99`）。草甸 warm-up C 和 `ced9972f` 包体已在 Mac 上通过。整合头 `ac9a0aeb` 上落地从第 2 个样本起是 0/0/0，棋盘背景 zero 比例 0.964 未过。本轮的 2 MB 标签条还没在 Mac 上复测。

未在本机测：微信开发者工具、真机 GPU 探针、正式包。本轮没有上传。

## Mac 还要复测什么

同一条天空城自动播放（`?camTrace=1`，preTransition meadow→skycity，盖过 `skycity.landing-board` 和后面的 `skycity.board-background`）。构建用本交付头。通过标准：

1. `skycity.landing-board` 从第 2 个样本起：cre 与 des 的中位数 ≤ 2/s，uploads 中位 ≤ 1/s。`ac9a0aeb` 已是 0/0/0，这条不能退。
2. `skycity.board-background`：zero 比例 ≥ 0.98。`ac9a0aeb` 是 0.964（55 秒里两秒非零）。若仍未过，看这两秒的 `small=`。`f35:…:t1:v1:e0` 的宽高范围不该再出现。
3. 若 cre=des 已经是 0 但 uploads 仍高：那是标签像素的 copy，分开记，不挡 zero 比例。
4. 若 cre 仍大于 0：看同一秒的 `smallN=` / `small=`。里面有 format、usage、flags、samples、type、v（view）、e（external）和宽高。不要靠放宽探针阈值过线。
5. 重新打 trial 包。未压缩 rig 相对 `606f434e` +7,597 B，探针行 +1,782 B（strip 后不进包）。总包、主包、海岸子包仍要落在预算内。

磁盘 Avail 建议 ≥ 9 GiB 再开 Creator。第一次 `cli open` 若没有游戏目标，按 HANDOFF R1 关掉再开一次。

通过之前不要上传。上传仍只走 `FORMAL_RELEASE=1 tools/build-guard/build-production-upload.sh`，脚本本身不上传。

waive 条没有放宽，本轮也不是 waive：`skycity.board-background` 的 zero 比例 ≥ 0.98，并且 `skycity.landing-board` 从第 2 个样本起 cre 与 des 的中位数 ≤ 2/s、uploads ≤ 1/s。`ac9a0aeb` 的落地过了，棋盘背景 0.964 没有过。
