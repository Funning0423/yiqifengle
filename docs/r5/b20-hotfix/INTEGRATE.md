# b20 hotfix — 草甸 warm-up C + 天空之城 RT + 转场 shader 预热

## Funning 起身 tip（待 Mac / 真机复测）

- 功能 `2f3fe3172a3196ed9f75c918f6a475c810149222` / tip `a3dc407e341f38053ffb7f378b330f317e5d4461`

首要：坐→起身手机不顿。runtime 预热 `CC_USE_SKINNING1|CC_USE_MORPH1`（MORPH 53/73±PRECOMPUTED）+ `CC_DIR_LIGHT_SHADOW_TYPE1`，`armStandupShaderBurst` 起身前冲刺；仍清 node-lens/enterLevel≥100 与 ready 后 criticalPending；硬保住 setCamera=0 / board-bg=0；勿动 BalloonTransit / K.s1。细节见 `NOTES-SETCAM-BOARD-LONG.md`「Funning 起身 tip」。


- 分支：`ggbot/b20-meadow-c-skycity-rt`
- 基底：`ggbot/release-b20` @ `b339414036cbba6d0b3053b035adb045b2e4b0e4`
- 功能提交：
  - `5e89c252750a18ad0841cff8dc1024d01451c201` 天空之城全管线 RT 不再每帧重建
  - `fd68032656d0d5942a7a99e7609d16dde12578ed` 草甸出航 shader warm-up C、两道门、清单
  - `b45315eae7a0c49763a6afb4f974b88816c1d560` 落地阶段附件纹理池（COLOR / DEPTH，尺寸 ≥ 1）
  - `968ab266c4e401e0cac35c5e3efb9b1aab33def2` 同一池扩到稳定尺寸的小纹理和 0×0 pass dummy
  - `36df21330a478355236b3e4b9deff4dd62fde29d` 纹理 view 入池，sub-256KB 同族可 `resize`；探针每秒行带 small 直方图
  - `6c11ebd0bd7d0cfa387ae2f1cee280a4e9c47981` 底图 `resize` 之后丢掉尺寸已过期的 view
  - `2179dd9953b6db16ef08b861a3c9308ef6a564e6` 棋盘标签条（约 1 MB 以内）同族 `resize`，view 跟着底图改尺寸而不是新建
  - `a2168f383e351276ce794cd23ccd1e424c5f7a10` 转场 `world.animateCamera` 的首次 shader 按草甸 C 的节奏提前编译，镜头不等待
  - `b95d85556fe9bd11208b07ec961f97cf3473f632` 出航阴影宏（`CC_DIR_SHADOW_PCF_TYPE=2`、`CC_SHADOW_TYPE=2`）提前一帧一个编译，meadow 目标仍挂帆船预热
  - `de045cb6ddb4efe5dff021d8502f0e38263d496e` 角色蒙皮/形变和房间顶点色的 PCF2 族提前编，镜头仍不等待
  - `278436b31920119f0021c2bd8d21e4fec81501be` `criticalPending=0` 只在 live program cache 里已经有 Mac createShader 名（PCF2+SHADOW_TYPE2）时成立；`getProgramVariant` 的 Object.assign 被包住，镜头仍不等待
  - `771f99ae2a33197a6581fb79dc923d8a909098bd` 同一份 defines 再写入 spike 上那一整袋管线宏（FOG4 / cascaded / HDR / SHADOWMAP_FORMAT / LINEAR_DEPTH / PCF2 / SHADOW_TYPE2），没 cached 的关键任务继续编，镜头仍不等待（本轮）
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

Mac `ced9972f` 已确认这项。草甸 C 的每帧计划和起航空帧没有改。角色蒙皮/形变不在它的队列里，见第 4 节。

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

没有改落地镜头，没有改走路速度，没有删内容，没有加遮罩。`Bloom0` 仍是 MANAGED。N=600 的 residency 门没有放宽。waive 条没有放宽。RT 池（2 MB 同族 resize、view 原地改尺寸）本轮没有再改。

### 4. 转场镜头上的首次 shader

Mac 整合头 `0421cfff1a30dab83587418471fb31c6b0ad38a1`（本分支 `b8c289ae` + 运镜 + 特效）RT 已过：`skycity.landing-board` 从第 2 个样本起 cre/des/up 中位 0/0/0，`skycity.board-background` zero 比例 1.0（n=55）。同一条控制台里 `world.animateCamera` 还有两帧 LONG：

- frame 1841：606 ms，shaders=70，sync=0。首次 `builtin-standard`：`USE_VERTEX_COLOR` + `CC_USE_SKINNING` + `CC_USE_MORPH`（目标数 53/16/3）+ 接收阴影、forward-add、反射和管线宏，另外还有不含顶点色的反照率变体。镜头已经停在 cameraIsland（-12, 15.5, 48）。
- frame 1938：149 ms，shaders=31。alpha-test、第二套 UV、`builtin-unlit`、shadow-caster、planar-shadow，中间有一条 `meadow-grass-wind`。
- 紧接着 `mount:meadow-warm-rig` 是 `ok=false reason=left-island`。草甸副本没挂上，而且草甸 C 本来也不编译角色的蒙皮和形变。

`TransitionShaderWarm.ts` 在场景存在之后把这些 pass 放进和草甸 C 相同的 4 ms 计划：每帧最多 kick 一个变体，再 `pass.getShaderVariant` 一个已经排上的变体。没有 GLSL 可 kick 时，同一帧直接编译这一个，不会攒成一帧几十个。角色形变/蒙皮插到队列前面。阴影类型或主光 `shadowEnabled` 变了，键就换新，仍然一帧一个。起航帧 `noteTransitionSailFrame` 和草甸 C 一样是空帧（0 kick、0 compile）。

预热不 await，也不把步进器按住整个 `animateCamera`。`leaveHome`、`travelRegion` 和镜头轨道的时长都不变。`WorldFlowComponent` 只在世界租约建好和绑上角色时调用 `armTransitionShaderWarm`（冻结文件上的最小挂钩）。画质、遮罩、内容和走路速度都没动。

落地 122 ms（frame 8748）和棋盘背景 101 ms（frame 9631）当时 shaders=0，不是这批编译。本轮不改 RT 池，也不为了这两帧去拖镜头。

Mac 整合头 `46e2c3ff90022093710e1447c70e3eb50ec397b0`（`0421cfff` + `bdcb4b86` + 运镜/特效）上，这道预热在大约 frame 126 就 `compiled=125 pending=0`。那 125 个是角色蒙皮/形变 53/16/3，但管线宏里没有 `CC_DIR_SHADOW_PCF_TYPE2`。frame 1839 的 `world.animateCamera` 仍是 LONG 613 ms、shaders=70：同一组形变次数，加上房间里的顶点色 `builtin-standard`，第一次带上 `CC_DIR_SHADOW_PCF_TYPE2`（以及 forward-add、反射、`CC_PIPELINE_TYPE`、`CC_SHADOW_TYPE2`）。`getProgramVariant` 会把 `pipeline.macros` 盖到 pass 的 defines 上，所以只在 patch 里写 PCF 盖不住当时的 0。`mount:meadow-warm-rig` 仍是 `ok=false reason=left-island`。

本轮每个 pass 仍是一帧一个。另外在那一次 `getProgramVariant` 之前，把管线上的 `CC_DIR_SHADOW_PCF_TYPE` 和 `CC_SHADOW_TYPE` 临时写成 2，调用结束立刻改回去，不调用 `onGlobalPipelineStateChanged`，也不改主光的 `shadowEnabled` / `shadowPcf`。角色形变/蒙皮的这份出航变体排在队列最前，房间里其余 pass 的同一份紧随其后。镜头轨道没有 await，步进器也没有按住。

`WorldNativeComposition.warmMeadowIfIsland` 的稳定回调：目标已经是 meadow（或人已经在 meadow）时返回 true，照常 `preloadMeadowForSail`。其它旅程目标，或地区既不是 island 也不是 meadow，仍然 `gone` → `left-island`。`mount:meadow-warm-rig` 那行等待字符串没改。这是冻结文件上的一处回调，只为了不再跳过帆船副本。

Mac 整合头 `8571f6d100b714ee2d55e8df9eca1dd8f0384ea9`（`46e2c3ff` + `15887835`/`b95d8555`）上，`mount:meadow-warm-rig` 已经 `ok:true`，但挂上发生在 spike 之后。`[QF_SHADER_WARM] compiled=131→132 pending=0` 出现在 frame 132–486，这是假的做完：那 132 个要么是启动时的宏，要么 `getProgramVariant` 把 `programLib.pipeline.macros` 里当时的 0 盖回去了。frame 1826 的 `world.animateCamera` 仍是 LONG 611 ms、shaders=70，全是 `CC_DIR_SHADOW_PCF_TYPE2` + `CC_SHADOW_TYPE2`：房间顶点色 standard / forward-add / reflect / pipeline，以及角色蒙皮+形变 53/16/3。spike 之后预热才爬到 376…1213。

本轮不再把「pending=0」当成出航族已经进缓存。`getShaderVariant` 和 `getProgramVariant` 之前，把 PCF=2、`CC_SHADOW_TYPE=2` 写到能找到的每一份 pipeline.macros 上（`director.root.pipeline`、`pass._root.pipeline`、`cc.rendering.programLib.pipeline`），也写到 pass 的 defines 上，并用 `setMacroInt`；调用结束立刻改回去。角色和房间顶点色的 `builtin-standard` 另外再编 spike 里那三组：`CC_FORWARD_ADD`+透明、`CC_PIPELINE_TYPE`、以及 `standard-fs`→`reflect-map-fs`。关键任务从场景加载就开始，每帧最多 3 个，不 kick 已经编过的 live GLSL。镜头轨道没有 await，步进器也没有按住。`WorldFlowComponent` 绑角色时多 watch 一次 `herAdapter.node`。

Mac 整合头 `8e93c02b`（`66937792`/`de045cb6` 合入）上，预热在 spike 之前到了 `compiled=764 pending=0 criticalPending=0`，然后 frame 1803 的 `world.animateCamera` 仍是 LONG 772 ms、shaders=70，同一组 PCF2 名。`mount:meadow-warm-rig` 仍在 spike 之后才 `ok:true`。`criticalPending=0` 只说明队列空了：`Pass.getShaderVariant` 走的是 `cclegacy.rendering.programLib.getProgramVariant`，它先 `Object.assign(defines, pipeline.macros)` 再按 key 进 live cache。写到另一份 macros、或换 program 名却用错 phase，都不会生成镜头那一帧要的 GPU shader。

本轮在编译期间包住 `Object.assign`：源对象像管线宏时，把同一份 defines 写成 spike 上那一整袋（`CC_USE_FOG=4`、`CC_SUPPORT_CASCADED_SHADOW_MAP=1`、`CC_USE_HDR=1`、`CC_SHADOWMAP_FORMAT=1`、`CC_SHADOWMAP_USE_LINEAR_DEPTH=1`、`CC_DIR_SHADOW_PCF_TYPE=2`、`CC_SHADOW_TYPE=2`），这就是库用来算 key 的那份。编完读返回的 shader 名，必须带 PCF2、SHADOW_TYPE2、SHADOWMAP_FORMAT1、LINEAR_DEPTH 和 cascaded 才算 cached。`criticalPending` 是还没 cached 的关键任务，加上 Mac createShader 名里那些 needle 还没出现的个数；队列走完之后仍会重试没 cached 的关键任务。镜头轨道没有 await，步进器也没有按住。meadow-warm-rig 仍是草甸网格，不挡家园角色和房间的这份 cache。短说明见 `docs/r5/b20-hotfix/LIVE-CACHE.md`。

`72310725`（功能 `72310725fa18bd4fa66b55c15259fe157900368d`）：Mac `81c841d4` 仍有 setCamera 446ms/12（全 unlit+morph）与 board-bg 490ms/0。本 tip 暖 unlit live FOG/HDR、耗尽 Invalid reflect/fwd/pipe、`CRITICAL_CACHE_NEEDLES` 不再把 reflect 算进 criticalPending，B1/board reveal/`presentForPlay` 调用 `noteTransitionHeavyFrames`。短说明见 `SETCAM-BOARD-LONG.md`。`test_transition_shader_warm.cjs` PASS；不上传微信。

## 怎么验证

```
QF_TYPESCRIPT_MODULE=/workspace/wt/ts5/node_modules/typescript \
DRACO3D=/workspace/wt/draco3d/node_modules/draco3d \
node tools/journey-integration/run-suite.cjs
```

本机这两条路径是指向已安装 TypeScript 5.4.5 和 draco3d 1.5.7 的符号链接。部分门会 `git show` 历史提交；那些对象已从 origin 按完整 SHA 取到本地。`glb-skin-bounds` 和 `dev-wording-selftest` 把临时目录放在仓库的父目录。本机仓库在 `/workspace`，父目录不可写，所以套件是在 bind mount `/tmp/qf-parent/repo` 里跑的。Mac 上仓库父目录可写，直接在仓库根跑即可。另外 `t02-dock` 读取 `/tmp/draco3d/node_modules/draco3d/draco3d.js`，本机把同一份 draco3d 链了过去。

套件跑在 `2179dd9953b6db16ef08b861a3c9308ef6a564e6`：369 项，368 PASS，0 FAIL，仅 navigation-guard BLOCKED_BROWSER。

`a2168f383e351276ce794cd23ccd1e424c5f7a10` 再跑了一次（多了 `transition-shader-warm`）：370 项，369 PASS，0 FAIL。唯一的 BLOCKED 仍是 `navigation-guard`（BLOCKED_BROWSER）。运行器因此退出码为 1。没有放宽任何阈值。启动 2026-11-02T12:58:33Z。

`b95d85556fe9bd11208b07ec961f97cf3473f632` 再跑了一次：仍是 370 项，369 PASS，0 FAIL，唯一 BLOCKED 是 `navigation-guard`（BLOCKED_BROWSER），退出码 1。启动 2026-11-02T14:08:36Z。

`de045cb6ddb4efe5dff021d8502f0e38263d496e` 再跑了一次：仍是 370 项，369 PASS，0 FAIL，唯一 BLOCKED 是 `navigation-guard`（BLOCKED_BROWSER），退出码 1。启动 2026-11-02T15:44:58Z。`transition-shader-warm` 过了。

`04d62636a54c81f05a1afc2376d07dec97947ac2`（功能 `771f99ae`）再跑了一次：仍是 370 项，369 PASS，0 FAIL，唯一 BLOCKED 是 `navigation-guard`（BLOCKED_BROWSER），退出码 1。启动 2026-11-02T18:22:20Z。`transition-shader-warm` 和 `manifests-fresh` 过了。

单门：

- `tools/meadow/test_meadow_sail_warm.cjs`：69 个变体，未修复出航帧 1601 ms；修复后每帧至多 1 kick + 1 compile，模型时间 ≤ 0.75 ms；第 5 帧提前起航的那一帧 0 kick、0 compile；全部编译次数仍是 69。
- `tools/shadow-churn/test_skycity_rt_residency.cjs`：N=600，每帧把 residency 打回 MANAGED。修复后 steady creates = 0（DepthStencil0 与 SceneDepth_0 都是 0）。`b3394140` 的 RoomLightingRig 是 6000 次（10 个目标 × 600 帧）。没有放宽 N。
- `tools/shadow-churn/test_skycity_landing_rt_pool.cjs`：1170×2532 的 depth + color 连续销毁/创建 40 帧，原生 create 停在 2，原生 destroy 为 0。探针先包在池外，再被 BEFORE_DRAW 把池装回最外层；探针 cre=2、des=0、uploads=2。同一张 64×64 采样贴图连续 10 帧，原生 create 停在 1。16×16 的 usage-none 贴图加一个空描述，40 帧原生 create 停在 2、destroy 为 0。同一张 view 连续 40 帧，原生 create 停在 1，探针 des=0；两张同时活着的 view 不是同一个对象。底图从 32 改到 40 且 view 有 `resize` 时，交回同一张 view，探针 cre 不增加。view 没有 `resize` 时，旧 view 销毁，新尺寸是一次原生 create。usage 22 的 1×1 与 1187×170 来回 40 帧，图像加 view 只各创建一次。300×158 再要 1367×175 也不再分配。16×8 的采样图宽在 16–20 之间变，有 `resize` 时原生 create 停在 1。1024×512 换成 1024×256 仍是两次原生 create（2 MB 不进 loose）。没有 `resize` 的 12×12 换成 13×12 也是两次。external 不进池。超过 48 MB 的附件真销毁。`Bloom0` 仍是 MANAGED，未具名的 MANAGED 顶点会被 pin。`find` 返回 null 的 device texture 会释放。
- `tools/sync-probe/test_gpu_probe_src.cjs`：16×16 不产生 TEX 明细行。跨过 1 秒后，每秒行有 `smallN=2`，以及 `f35:…:v0:e0=1@16x16` 和 view 的 `v1` `@64x32`（宽高取自底图）。≥256KB 的 create/destroy 仍带 `src=`。
- `tools/meadow/test_transition_shader_warm.cjs`：Mac 的形变 53/16/3、蒙皮、接收阴影、alpha-test、第二套 UV、unlit、`meadow-grass-wind` 都在键里。离线 40 个变体每帧至多 1 kick + 1 compile。`Object.assign` 被包住之后，管线宏仍是 0 时编出的 shader 名带 FOG4 / cascaded / HDR / SHADOWMAP_FORMAT / LINEAR_DEPTH / PCF2 / SHADOW_TYPE2。`criticalPending` 要等这些名字进 cached 才到 0。隐藏的 `pass._root.pipeline.macros` 经 Object.assign 也会变成这袋宏。起航帧仍是 0。`animateCamera` 里没有 await。

## 包体增量

本机没有 Cocos Creator，没有打微信包。

Mac 在 `186b34e7` 上量过探针包（`STRIP_PROBES=0`）：TOTAL 23,600,600，release-gates MAIN 1,874,614。`ced9972f` 的 trial 是 TOTAL 23,570,361 / MAIN 1,874,614。

`2179dd99` 进包的是 `RoomLightingRig.ts`（相对 `606f434e` 的 50,822 为 58,419，未压缩 +7,597）。`CamTraceLog.ts` 的 +1,782 在 `QF_PROBE` 里，strip 后不进包。

进包的是 `TransitionShaderWarm.ts`（本轮 25,979 字节；`de045cb6` 时是 21,235）和 `MeadowSailWarm.ts` 的 kick 导出。挂钩没再改。海岸子包 0。相对 Mac `0421cfff` 探针包（TOTAL 23,604,997 / ROOT 1,874,614），未压缩脚本大约 +26,850 字节。`8e93c02b` 的包大约仍是 23.6M 量级。

| 项 | 上界 |
|---|---|
| 相对 `0421cfff` 的进包源码 | 大约 +26,850 B（`TransitionShaderWarm.ts` 25,979 + 草甸 kick + 挂钩）。探针脚本没改 |
| 探针包 TOTAL（`STRIP_PROBES=0`） | ≤ 23,633,000（Mac `0421cfff` 已量 23,604,997，加上未压缩脚本约 26,850） |
| 探针包 MAIN 根 | ≤ 1,901,500（1,874,614 + 26,850，增量若全在主包） |
| 预算 | 总包 ≤ 24,641,536；主包 ≤ 4,000,000；海岸 ≤ 943,718 |

绝对包体仍以 Mac 新构建为准。

## 证据

- `docs/r5/b20-hotfix/evidence/warmup-c-cost.json`
- `docs/r5/b20-hotfix/evidence/skycity-rt.json`（具名管线 pin；落地余量在纹理池，不在这道 pin）
- `docs/r5/b20-hotfix/evidence/skycity-landing-rt.json`（view、2 MB 同族 resize，以及 `ced9972f` / `186b34e7` / `606f434e` 的落地数字）
- `docs/r5/b20-hotfix/evidence/suite-summary.json`
- `docs/r5/b20-hotfix/evidence/transition-shader-warm.json`
- `docs/r5/b20-hotfix/LIVE-CACHE.md`（critical-done = live program cache，不是队列空）

## 已测 / 未测

已测：上面的离线门。`2179dd99` 的全套件是 369 项、368 PASS、0 FAIL，仅 navigation-guard BLOCKED_BROWSER。`a2168f38`、`b95d8555`、`de045cb6` 和 `04d62636` 的全套件都是 370 项、369 PASS、0 FAIL，仍然只有 navigation-guard BLOCKED_BROWSER。草甸 warm-up C 和 `ced9972f` 包体已在 Mac 上通过。整合头 `0421cfff` / `8e93c02b` 落地从第 2 个样本起是 0/0/0，棋盘背景 zero 比例 1.0。`8e93c02b` 的 `world.animateCamera` frame 1803 是 772 ms / shaders=70，且 `criticalPending=0` 出现在 spike 之前。本轮的 live-cache 预热还没在 Mac 上复测。

未在本机测：微信开发者工具、真机 GPU 探针、正式包。本轮没有上传。

## Mac 还要复测什么

同一条天空城自动播放（`?camTrace=1`，preTransition meadow→skycity，盖过 `skycity.landing-board` 和后面的 `skycity.board-background`）。构建用本交付头。通过标准：

1. meadow→skycity `world.animateCamera`：没有 ≥100 ms 的 LONG。`8e93c02b` 的 frame 1803（772 ms、70 个 `CC_DIR_SHADOW_PCF_TYPE2` 首次 createShader）不应再出现；那一帧上角色蒙皮/形变 53/16/3 和房间顶点色 standard/forward-add/reflect/pipeline 的 createShader 应是 0。不要为了躲编译去加长或按住镜头。`[QF_SHADER_WARM] pending=0 criticalPending=0` 不算数，除非 `cached` 已经对上这些 createShader 名，并且镜头那一帧不再出现它们。
2. `skycity.landing-board` 从第 2 个样本起：cre 与 des 的中位数 ≤ 2/s，uploads 中位 ≤ 1/s。`0421cfff` 已是 0/0/0，这条不能退。
3. `skycity.board-background`：zero 比例 ≥ 0.98。`0421cfff` 已是 1.0（n=55）。不能退。
4. 落地 122 ms 和棋盘背景 101 ms（shaders=0，各一次）尽量接近 0。本轮没有改 RT 池，这两帧不是 shader 编译。
5. 若 cre=des 已经是 0 但 uploads 仍高：那是标签像素的 copy，分开记，不挡 zero 比例。
6. 重新打 trial 包。未压缩脚本相对 `0421cfff` 大约 +26,850 B。`8e93c02b` 的包大约仍是 23.6M，仍在预算内。总包、主包、海岸子包仍要落在预算内。

磁盘 Avail 建议 ≥ 9 GiB 再开 Creator。第一次 `cli open` 若没有游戏目标，按 HANDOFF R1 关掉再开一次。

通过之前不要上传。上传仍只走 `FORMAL_RELEASE=1 tools/build-guard/build-production-upload.sh`，脚本本身不上传。

waive 条没有放宽，本轮也不是 waive：`world.animateCamera` 没有 ≥100 ms 的 LONG；`skycity.board-background` 的 zero 比例 ≥ 0.98；`skycity.landing-board` 从第 2 个样本起 cre 与 des 的中位数 ≤ 2/s、uploads ≤ 1/s。`0421cfff` 的两道 RT 门已过（落地 0/0/0，棋盘背景 zero 比例 1.0），不能退。

## setCamera dual-bag tip (post-2672b080)

Experience `1.0.202611021436` felt slow-mo. Residual `world.setCamera` B1 lacked `CC_SHADOW_TYPE2` in createShader names while warm forced TYPE=2. Tip warms both bags and narrows critical so pending no longer eats every frame. Mac: animateCamera LONG still 0; setCamera should not spike ≥100ms with 100+ first-time shaders; landing/board-bg RT hold. No upload until PASS.

## main-thread hold / primeScene tip (post-e32f04bf)

Mac `e32f04bf`（源 tip `3be0a1c0`）setCamera 177ms/0、board-bg 105ms/0：已非 first-compile。功能 `eaa5d83fb6bd8e3daf88ba6b4d312e5949d9e5e3`：flight/B5 `holdTransitionShaders`（引用计数）、`primeScene` 提前激活 skycity GLB、扩大 reveal/board heavy 窗口。详见 `SETCAM-BOARD-LONG.md`。`test_transition_shader_warm.cjs` PASS；不上传微信。

## tip（本轮）

- feature `508b5a18703af3b9b8f11c1d72b300434d9ac11c`：paint/setCamera 拆帧 + armTransitionHold B5→board + primeScene board-cam warm draw + reveal≠present 同帧。验收：过渡窗口 setCamera/board-bg LONG 均 <100ms；不上传微信。

## board-bg keep-alive tip (post-25faaecf)

Mac `25faaecf`（源 tip `bb8c1fa3`）setCamera PASS max=0；board-bg FAIL max=102/0 @ f9200。根因：prime 2 帧 warm 后关相机，reveal 再开冷启用。本 tip：board-cam `priority=-20` 保活暖画（`skycity.board-prime`）+ reveal 三帧拆分 root→setVisible→present。详见 `NOTES-SETCAM-BOARD-LONG.md`。`test_transition_shader_warm.cjs` PASS；不上传微信。

- tip `07db498b` / feature `fbcb67cc` 合入后 Mac `d84fe519` FAIL：setCamera 223、board-bg 101（-20 warmBeforeReveal 双摄回退）。
- tip `29815864` / feature `adf343b6` 合入后 Mac `4992e3b1` FAIL：setCamera 163、board-bg 118。
- tip（pending）：完整恢复 bb8c1fa3/25faaecf reveal+setVisible；撤 warmBeforeReveal/touchBoardGpu/cam-defer/3-phase；prime 暖画 2→4 后关。详见 `NOTES-SETCAM-BOARD-LONG.md`。

## tip（Mac e987bf7a → setCamera&lt;100 保住 board=0）
功能 tip 见本轮 tip SHA。根因：prime 内 `armTransitionHold` 生效 + `SkycityBoardLive.keepActive` 飞行常驻 board GLB。修复：prime 暖 4 后关 cam+rig、去掉 prime 内 armTransitionHold、Live 仅 shown keepActive。`test_transition_shader_warm.cjs` PASS；不上传微信。

## Mac 230df8f6 → 中间态 tip（本轮）

飞行期关 board rig（59b18785）把 board-bg 从 e987 的 0 打回 138，setCamera 仅 164→141。本 tip 恢复 Live keepActive + prime 4 帧只关 cam、prime 不 `armTransitionHold`，目标两门同时 &lt;100ms。不上传。
