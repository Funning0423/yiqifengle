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
