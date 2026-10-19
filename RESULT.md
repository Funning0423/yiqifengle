# 场景 BGM / 环境音切换（feat/scene-audio-r1）

从小岛走到草原、再走到天空之城时，BGM 不换，海鸥在草原上还在叫。根因是选曲和环境音门控都没看旅程区域。现在按一张配置表切换：BGM 交叉 2 秒，环境层按场景开关。离开海边后海鸥停。后台回来、重开一局都按当前所在的地方恢复。

冻结文件未改：`CharacterMotion.ts`、`anim_meta.json`，以及 `tools/journey-integration/frozen-production-inputs.json` 里登记的产物。`production-integrity` 通过。

## 根因

行号是改之前的 `bc81575`。

**BGM 几乎只认「天空之城」和「棋盘」。** `creator-build-project/assets/scripts/audio/SceneMusic.ts` 的 `sceneTrackFor`（38–51 行）只有 `state === 'skycity'`（或 `stable === 'skycity'` 且不是加载）才返回天空之城曲；棋盘上草原 / 天空区域才返回对应曲。其余全部落到第 51 行 `return 'island'`。

`travelRegion`（`WorldFlowCore.ts` 458–468 行）的过程是：`region-loading` → `change('region-travel')` → 走完后 `stable = target` 再 `change(target)`。到达草原时状态是 `meadow`，没有棋盘，于是仍选小岛曲。帆船、热气球整段都是 `region-travel`，同样落到小岛曲。`probe()`（82–90 行）只读 `state` / `stable` / 棋盘，不读 `snapshot().journey`，所以目的地和阶段进不了选曲。

`GameAudio.onWorldState`（1011–1019 行）只处理出门运镜和把环境音挂上，不切 BGM。`SceneMusic` 每 0.25 秒轮询，不订阅 `onWorldState`。加载失败、预加载、`AudioSource` 生命周期都不是这次不换曲的原因：曲目请求根本没发出去。

天空之城**到达之后**旧逻辑会切（第 40 行）。飞过去的热气球（`region-travel`，`stable` 仍是草原）不会切。`skycity-loading` 返回 `null`，保持上一首，而上一首还是小岛曲。

**环境音跟着小岛的房间灯，不跟区域。** `AmbienceAudio.outdoorAmount`（281–305 行）用 `getRoomLightWeight()`、`hasRoomLight()`、`isWorldVisible()` 算室外亮度。`update`（437–448 行）里海浪和海鸥都吃这个亮度。`restore()`（`WorldFlowCore.ts` 278–284 行）在旅程有检查点、人不在家里时，仍把小岛层打开，并把房间灯权重设成 0。草原、湖畔、天空之城因此一直被当成室外，海鸥继续排、继续响。只有 `AmbienceAudio.lakeActive`（第 438 行 `const outdoor = AmbienceAudio.lakeActive ? -1 : outdoorRaw`）能压住海浪和海鸥，而且要等湖声文件加载完。

**从后台回来会把草原当成小岛。** `hide()`（650–654 行）把非出门运镜的状态改成 `paused`，`stable` 仍是原来的地方。旧的 `sceneTrackFor` 对 `paused` + `stable === 'meadow'` 也返回小岛曲。取消的行程里 `journey.target` 还指着没走到的地方，不能拿它当当前位置。

## 场景 → 音频

区域以代码为准：`home` / `island` / `meadow` / `lakeside` / `skycity`，加上 `region-travel` 里的帆船（小岛→草原）和热气球（草原→天空之城）。小岛→湖畔仍是虹桥，桥上算小岛，到达那一段算湖畔。

正式 BGM 只有三首。仓库里没有 `NOT_FOR_SHIP` 标记（文件名、`.meta`、音频目录文本都查过）。

| 场景 | 何时 | BGM | 开着的环境层 | 缺 |
| --- | --- | --- | --- | --- |
| 家里 | `state=home` | `bundles/audio_bgm_island/audio/bgm_main.mp3` | 无（室内） | 鸟鸣、虫鸣 |
| 小岛 / 出海前 | `state=island`，以及出门、潮汐棋盘等 | 同上 `bgm_main` | 风、海浪、海鸥 | 鸟鸣、虫鸣 |
| 帆船 | `region-travel`，目标草原，阶段还不是 `arrival` | **没有海上曲**。过渡一开始交叉到草原曲 `bundles/region_meadow/audio/bgm_meadow.mp3` | 风、海浪、海鸥（人还在海上） | 帆船/海上 BGM、鸟鸣、虫鸣 |
| 草原 | `state=meadow`，帆船 `arrival`，后台暂停且 `stable=meadow`，草原棋盘 | `bgm_meadow` | 无。海鸥、海浪、风都关 | 鸟鸣、虫鸣、草原风床 |
| 湖畔 | `state=lakeside`，虹桥 `arrival`，湖畔棋盘 | **没有湖畔曲**，继续 `bgm_main` | 湖水循环 `bundles/region_lakeside/audio/amb_lake_loop.mp3`（水 + 微风 + 风铃，不是 BGM） | 湖畔 BGM、鸟鸣、虫鸣、高空风 |
| 热气球 | `region-travel`，目标天空之城 | `bundles/region_skycity/audio/bgm_skycity.mp3` | 无。海鸥关 | 高空风、鸟鸣、虫鸣 |
| 天空之城 | `state=skycity`，后台暂停且 `stable=skycity` | `bgm_skycity` | 无 | 高空风、鸟鸣、虫鸣 |
| 保持 | `region-loading`、`skycity-loading`、`level-loading`、关卡还没挂上棋盘 | 不换曲、不改层 | — | — |

加载页不请求音乐。关卡棋盘：`r05-meadow-*` 或主线 05–08 → 草原；`r05-sky-*` 或主线 09–12 → 天空之城；`r04-lake-*` / `r05-lake-*` → 湖畔层 + 小岛曲；其余（含潮汐）→ 小岛海上层。

已有层和文件：

| 层 | 文件 |
| --- | --- |
| 风（柔） | `resources/audio_amb/amb_wind_soft_loop.mp3` |
| 风（强） | `resources/audio_amb/amb_wind_strong_loop.mp3` |
| 海浪 | `resources/audio_amb/amb_waves_loop.mp3` |
| 海鸥 | `resources/audio_sfx/sfx_amb_gull_1.mp3`、`sfx_amb_gull_2.mp3`、`sfx_amb_gull_3.mp3`，以及 `gull_lr/` 下 6 个 L/R |
| 湖 | `bundles/region_lakeside/audio/amb_lake_loop.mp3` |

鸟鸣、虫鸣、高空风、草原风、湖畔 BGM、海上 BGM：**缺**。没有对应文件，表里标在 `missing`，不会出声。

其余音效（不跟场景床走，共 54 个 mp3 里扣掉上面的 BGM 和环境床）：

- 三消：`resources/audio_sfx/sfx_match_normal.mp3`，`sfx_combo_1.mp3` / `sfx_combo_2.mp3` / `sfx_combo_3.mp3`
- 喝彩：`sfx_cheer_1_great.mp3`、`sfx_cheer_2_excellent.mp3`、`sfx_cheer_3_amazing.mp3`、`sfx_cheer_4_unbelievable.mp3`
- 界面：`sfx_ui_back.mp3`、`sfx_ui_bag.mp3`、`sfx_ui_book.mp3`、`sfx_ui_click.mp3`、`sfx_ui_confirm.mp3`、`sfx_ui_signpost.mp3`
- 关卡：`sfx_chest_open.mp3`、`sfx_level_clear.mp3`、`sfx_apron_flap.mp3`
- 出门运镜：`bundles/region_island/audio_cine/sfx_exit_outbound.mp3`
- 脚步：`bundles/region_island/audio_steps/step_{wood,rug,stone,path,grass}_{1..4}.mp3`（20 个）

## 改了什么

配置表：`creator-build-project/assets/scripts/audio/SceneAudioTable.ts`（及 `.meta`）。`resolveSceneAudio` 把世界快照映射到上面的档案。`SCENE_AUDIO_CROSSFADE_S = 2`（落在 1.5–2.5 秒）。换 BGM 文件只改 `BGM`。某一层开或关只改 `SCENE_PROFILES`。

- `SceneMusic.ts`：轮询时带上 `journey.target` / `phase` / `region`。不是 `hold` 就 `publishSceneBed`。换曲调用 `setMusic(..., { xfadeS: 2 })`。进房第一次仍 `{ fadeIn: true }`（1.5 秒）。加载失败仍回落小岛曲，每个场景只回落一次。`sceneTrackFor` 只返回曲目 id，函数体不含 `lake`（湖畔继续小岛曲，`tools/test_lake_ambience.cjs` 的约定）。
- `GameAudio.setMusic`：可选 `opts.xfadeS`（夹在 0.2–4 秒）。不传仍是原来的 1.5 秒。只作用于正在播时的等功率交叉；进房淡入仍是 `ROOM_FADE_IN_S`。
- `AmbienceAudio.ts`：读 `__sceneAudioBed`。`waves === false` 时海浪音量立刻为 0 并暂停。`gulls === false` 时正在响的海鸥和已排的海鸥下一帧停掉，`requestGullCall` 也失败。床还没发布时保持旧行为（海浪、海鸥开着），避免没挂 `SceneMusic` 的旧测试被带倒。`lakeActive` 那一行原样保留。
- `WindAudio.ts`：`wind === false` 时强度归零、循环暂停。`quiet()` 没改（`tools/test_exit_restart_quiet.cjs` 会执行它的源码）。
- 湖声仍由 `LakeAmbience` / `lakeAmbienceWanted` 决定，和表里的湖畔档一致。循环时长绑在这条 `amb_lake_loop` 上，换文件还要改 `LakeAmbienceCore.ts` 的 `LAKE_AMB`，不能只改路径。
- 海浪、海鸥、风的**文件名**仍在各自播放器里，和 `LAYER_ASSETS` 相同。表控制开或关。鸟鸣、虫鸣、高空风没有播放器，只写进表也不会响。
- 后台：`paused` 用 `stable`，不用 `journey.target`。重开一局时 `SceneMusic` 按当前快照第一次 `setMusic`（人已经在草原就是草原曲，海鸥关）。
- 测试：`tools/voice-bot/bgm/test_scene_audio_transitions.cjs`，并登记进 `tools/journey-integration/run-suite.cjs`（id `scene-audio-transitions`）。`tools/voice-bot/bgm/test_scene_bgm.cjs` 会加载这张表，并把 `SceneMusic` 驱动的交叉断言从 1.5 秒改为 2 秒。直接 `setMusic()` 仍是 1.5 秒。

## 怎么验收

Node 侧（本机 `QF_TYPESCRIPT_MODULE` 指向 TypeScript 5.4）：

```bash
node tools/voice-bot/bgm/test_scene_audio_transitions.cjs
node tools/voice-bot/bgm/test_scene_bgm.cjs
node tools/test_lake_ambience.cjs
node tools/journey-integration/run-suite.cjs
```

结果：

- `test_scene_audio_transitions.cjs`：28 项通过。覆盖每次过渡后的曲目 id 和环境层、2 秒等功率交叉、帆船到达后海鸥和海浪停、后台停在草原/天空之城不退回小岛、取消的帆船（`paused` + `stable=island` + `target=meadow`）仍是小岛海上层、重开在草原直接是草原曲。并确认没有编造的湖畔/海上 BGM，也没有 `NOT_FOR_SHIP`。
- `test_scene_bgm.cjs`：122 项通过。
- `test_lake_ambience.cjs`：6 项通过。
- `run-suite.cjs`：124 项里 121 通过，含 `scene-audio-transitions`、`wind-audio`、`lake-ambience`、`exit-restart-quiet`、`home-sea-fadein`、`es5-iterator-spread`、`production-integrity`。未通过的三项与这次音频无关：
  - `navigation-guard`：`BLOCKED_BROWSER`（这个 Node 跑器不启动浏览器）
  - `region-nodes-data`：没有 Blender，也没有夹具 `tools/region-nodes/fixtures/room_no_original_chair.glb.walk.gz`
  - `lens-clearance`：找不到 `/r5-region-nodes-r3/maps/topmap.cjs`

`tools/voice-bot/gull/test_gull_events.cjs` 不在 suite 里，而且只认 `VB_TS`、不认 `QF_TYPESCRIPT_MODULE`。设上 `VB_TS` 之后 80 项里 79 项通过。剩下一项是 `AmbienceAudio.ts` 里原有的 `qfAudioLog` 对象展开（`...data`），`bc81575` 上就有，这次没改那一行。

游戏里：小岛→草原，帆船一开始约 2 秒交叉到草原曲，海上仍有海鸥和海浪，靠岸后海鸥停。草原→天空之城，热气球一开始交叉到天空之城曲，没有海鸥。切到后台再回来，曲目和环境层仍是离开时的地方。湖畔继续小岛曲，湖声循环开，海鸥关。


---

# 自由视角（feat/free-camera-r1）

除了消消乐棋盘，玩家可以绕女主角转动镜头看同一套世界。美术穿帮只做了审计，写在 `SCENE_360_AUDIT.md`，这一轮没有改模型。

## 原来的镜头

所有写镜头的地方仍然走 `applyCameraPose` / `fromLookAt`。姿态是位置、看点、垂直 FOV。单位是米，+Y 朝上。

`ExploreCameraCore` 里原来的状态没有改语义：

| 状态 | 原来做什么 |
| --- | --- |
| `FollowWalk` | 人走的时候镜头跟在身后，拖动被忽略。 |
| `MapExplore` | 在一张约 52° 的地图上平移，双指缩放大约 0.7..1.6，不是绕人转。 |
| `Board` | 棋盘机位，探索手势关掉。 |
| `BoardToFollow` / `FollowToBoard` | 进出棋盘的混合。 |
| `Transition` | 区域切换。`transition()` 的测试行为没动。 |

另外还有两套不在这个枚举里的锁：

- 房间：`RoomLook` 固定原点，水平大约 −140°..+14°，俯仰 −12°..+12°。门的提示用同一套角度。常量没改，相机帧测试还在直接 new `RoomLook`。
- 岛：`IslandRail` 沿离开家园的弧推拉（近端约 0.46）。`IslandHomeInteraction` 原来只认竖直拖动和双指，点灯塔回家，点小屋休息。8 像素以内仍算点击。
- 过场：`setCamera` 和 `animateCamera` 独占镜头。`jobs` 还在跑、或这一帧刚打过过场标记时，自由轨道不写。
- 棋盘和混合期间 `ExploreGate.exploreEnabled()` 为假，区域行走的手势直接被丢掉。

区域行走里，`guardLens` 会对整棵网格做射线，太贵，不能每帧绕镜头都打。小游戏包里 QA 的 `frame()` 本来就会被编译掉。

## 现在怎么转

新的数学在 `creator-build-project/assets/scripts/region/FreeOrbit.ts`，不引用 Cocos，节点测试和真机走同一份。

- 绕女主角胸口转。水平角不限，棋盘除外。
- 俯仰和距离按区域读 `ORBIT_LIMITS`。
- 双指：张开靠近（和岛上原来的缩放同向）。缩放倍数不在 0.25..4 里的丢掉。
- 松手有惯性，时间常数 0.16 秒，角速度有上限。`step` 把 dt 卡在 0.1 秒，避免切后台之后镜头飞走。
- 第一下拖动会先对准当前镜头再转，避免「一碰就弹」。
- 手指还按着的那一帧不开始惯性。松手才衰减。
- 过场调用 `pause()`。回到同一区域、而且玩家曾经拖过，才用 0.55 秒 smoothstep 回到原来的角度。没拖过就留在跟拍镜头上，不抢。
- 换区域 `forget()`。棋盘 `armBoard()` 记住进来前的角度，出来 `disarm()` 再还回去。

两套实例，避免房间和岛互相覆盖：

- `WorldFlowComponent`：房间一个，岛一个。探索行走开启时这边不写，免得和区域舞台抢相机。
- `RegionNodeStage`：草地、天空城（以及以后若挂上的湖边）共用一个，跟人走。玩家没抢镜头时，每帧仍写跟拍；抢过之后水平角留在世界上，位置跟着人。

房间离开：若自由轨道已经转过，出门的连续镜头从轨道解算结果起步，而不是从没转过的 `RoomLook` 起步。没转过则和原来一样。

## 各区域限制

表在 `ORBIT_LIMITS`。距离是到胸口看点的米数。

| 区域 | 俯仰（度） | 距离（米） | 水平 | 垂直 FOV |
| --- | --- | --- | --- | --- |
| 房间 home | −14 .. 26 | 1.25 .. 3.35 | 不限 | 60 |
| 灯塔岛 island | −8 .. 58 | 4.2 .. 52 | 不限 | 42 |
| 草地 meadow | −12 .. 48 | 3.2 .. 14 | 不限 | 48 |
| 天空城 skycity | −6 .. 55 | 4 .. 22 | 不限 | 48 |
| 湖边 lakeside | −10 .. 42 | 3.6 .. 16 | 不限 | 48 |
| 棋盘 board | −2 .. 2 | 6.6 .. 7.8 | 锁定时的朝向 ±4° | 48 |

房间另有 `keepInside`：镜头留在大约 x −1.85..1.05、y 0.7..2.2、z −4.72..−1.55，臂长不够就缩短，而不是穿墙。岛的距离上限放到 52 米，是为了接住现有大约 46 米的广角，第一下拖动不会突然拉近。

手感：拖满一屏大约水平 128°、俯仰 72°。手指上移是抬头（俯仰变小），和原来的 `RoomLook` 同向。

湖边的数字在表里，但湖边不在 `REGION_NODES`，现在没有行走手势，镜头仍是棋盘远景。没有为它新做一套触摸。

## 手势怎么分

`ExploreInput` 的拖动改成每一帧的像素增量，不再从按下点累加。双指把缩放倍数放在 x。拖动或缩放结束发送 `release`，不再把按下时的屏幕坐标当成一次拖动（旧地图会在松手时跳一下）。点击仍然送屏幕坐标。`classifyPointers` 没改，原来的测试继续有效。

判定仍是：移动超过 10 点才算拖，按住 0.25 秒以内、没拖开，算点击走路或交互。棋盘和混合期间探索关闭，这些手势不会进轨道。

岛上的 `IslandHomeInteraction`：调用方若提供了 `orbit`，拖动和缩放走轨道，不再同时 `pull`。没提供时，竖直拖动和缩放保持原样。灯塔、小屋的点击阈值没放宽。

## 碰撞

不每帧对网格打射线。最多每 400 毫秒收一次包围盒，最多 32 个，只要跨度大约 0.25..16 米、离人 28 米内的。名字像天空、云、海、浪、鸥、烟、光束、百叶、精灵、粒子、彩虹的跳过，避免被远景壳把镜头推飞。

解算顺序：室内先留在 `keepInside`；行走区域用探索盒在水平方向内收 2 米（岛的广角不用这个盒子，否则 48 米处的镜头会跳回来）；离地至少 0.45 米；再按包围盒沿看点方向把镜头拉出墙和屋子；臂长最短大约 0.8 米。大壳（跨度大于 16 米）人已经在里面就不算撞上。

## 棋盘和过场

进棋盘：轨道记一笔快照，限制换成表里的 board 行。漏进来的拖动也只有大约 ±4° 和很小的俯仰。区域舞台在 `restoreBoard` 里 `armBoard()`，混合一开始就 `pause()`。

过场：`setCamera`、进关卡镜头、`animateCamera` 的每一拍都 `noteCinematic()`，两套房间/岛轨道暂停。这一帧和还有任务在跑的时候，`settleOrbit` 不写。过场结束、人回到房间或岛、而且曾经拖过，才平滑回到那个角度。区域行走在奖励和终章之后走 `handOrbitBack`，同样只在玩家抢过镜头时才回。

## 性能

微信小游戏上少做的事：

- 自由轨道不调用 `guardLens` 的全网格射线。
- 包围盒缓存 2.5 Hz，上限 32。
- 只有 `shouldWrite()` 为真才 `applyCameraPose`。跟拍没被抢走时，区域舞台仍按原来的频率写跟拍，不额外多算一套碰撞。
- 惯性用指数衰减，没有弹簧迭代。
- dt 上限 0.1 秒。

`guardLens` 还在，场景接线测试仍然要求这段代码留在 `RegionNodeStage` 里。

## 没动的东西

- 没改 `CharacterMotion.ts`、`anim_meta.json`。冻结清单仍是 `tools/journey-integration/frozen-production-inputs.json`。
- 没改 `RoomLook` 的角度常量，也没改 `IslandRail` 的弧。
- 彩虹桥没有加回来。岛到草地仍是帆船，草地到天空城仍是热气球。不是 bridge 的腿上，`RainbowBridge*` 继续隐藏。岛到湖边、以及帆船预载超时的回退，代码里还是 bridge，这一轮没改交通选择。审计里记了这条遗留。

## 测试

`tools/region-nodes/test_free_orbit.cjs` 已挂进 `run-suite`（id `free-orbit`，紧跟 `explore-camera`）。覆盖：水平可转多圈、俯仰和距离夹紧、松手后惯性再停住、双指近远、棋盘锁、过场暂停后平滑回来、室内不穿出盒子、大壳不把镜头推飞。

`node tools/journey-integration/run-suite.cjs`：124 项里 123 项 PASS。唯一不是 PASS 的是 `navigation-guard`，跑套件的脚本自己把会启动浏览器的旧测试标成 `BLOCKED_BROWSER`，这一轮没有改它。逻辑项，包括 `free-orbit`、`explore-camera`、`explore-input`、`region-nodes-scene-wiring`、`lens-clearance`、`lakeside-landing-hook`、`production-integrity`、`es5-iterator-spread`，都过了。

镜头净空测试原来读仓库外面的 `r5-region-nodes-r3/maps/topmap.cjs`。旁边那份不在时，改为读仓库里的 `docs/r5/maps/topmap.cjs`，断言还是同一条地面规则（`up>.72`、`STEP=.36`）。进关卡的湖边「按住棋盘机位」回调仍是空函数，不在按住期间写镜头；过场标记打在这条分支前面。
