# 场景 BGM（Voice bot）

| 场景 | 文件 | 分包 | 时长 | 规格 | 响度 |
|---|---|---|---|---|---|
| 小岛（家里 / 小岛 / 潮汐 / 主线 / R4） | `bundles/audio_bgm_island/audio/bgm_main.mp3`（uuid 不变 24969762-…，字节不变 sha256 21ca21ac…） | audio_bgm_island（新，v0.5） | 83.5 s | 48 kbps 立体声 44.1 kHz，501,333 B | -16.4 LUFS |
| 草原（region = meadow） | `bundles/region_meadow/audio/bgm_meadow.mp3` | region_meadow（新） | 72.63 s | 48 kbps 立体声，436,288 B | -16.6 LUFS |
| 天空之城（天空城参观 + region = sky） | `bundles/region_skycity/audio/bgm_skycity.mp3` | region_skycity | 72.00 s | 48 kbps 立体声，432,526 B | -16.5 LUFS |

- 三首都是首尾相接的循环（尾音折回开头），旋律原创。源工程在共享电脑 /workspace/bgm/（不进仓库）。
- `region_meadow.meta` 复制自 `region_skycity.meta`，只改 uuid 和 bundleName（wx_subpackage、priority 1、wechatgame subpackage、非远程）。
- `audio_bgm_island.meta`（v0.5）同样复制自 `region_skycity.meta`，只改 uuid 和 bundleName；`resources/audio_bgm/` 整个删掉，resources 少 501,333 B。

## 小岛 BGM 什么时候加载（v0.5，包体）
- 启动、加载页期间**不请求任何音乐**：`GameAudio.onLoad` 不再自己加载默认曲目（只在实例交接时沿用旧曲目）。
- 触发点：`SceneMusic.roomInteractive()`。场景里有 `WorldIntegrationBoot` 时，等 `globalThis.__worldLoading.snapshot().phase === 'ready'`——即 `WorldIntegrationBoot.loadWorld()` 把 `loadPhase` 置为 `'ready'`、隐藏加载页、`RoomExploreOverlay` 开始接受滑动 / 点门的那一刻（overlay 的 allowed() 就是 `loadPhase==='ready'&&ready&&!busy`）。场景里没有 `WorldIntegrationBoot`（没有加载页）就直接算可操作。只读轮询（0.25 s），不改 WorldIntegrationBoot / RoomExploreOverlay（T0 strict 文件）。
- 之后第一次 `setMusic('audio/bgm_main', 'audio_bgm_island', { fadeIn: true })`：分包下载在后台进行，加载页不等它；下载 / 加载失败只记 `console.warn` 和 `musicDiagnostics().status='error'`，不重试、不抛异常、不阻塞。
- 淡入：这一曲第一次真正起播（loopSource 确认 playing）时，从 0 等功率淡入 1.5 s（`ROOM_FADE_IN_S`）。首次起播前被静音 / 切后台挡住，淡入保留到真正起播。切场景仍是原来的 1.5 s 交叉。
- 解锁顺序：先摸后下完 → 手势状态 `gestureSeen` 一直记着，分包到了 `loaded` 回调里直接起播，不用再摸；先下完后摸 → 摸的那一下起播（原行为）。加载页期间摸屏也算解锁，但不会提前加载。
- “音乐真正开始”：`GameAudio.onMusicStart(cb)`，或 `globalThis.__gameAudioMusic.onMusicStart(cb)` / `.lastStart()`；`musicDiagnostics().lastStart` 同内容。每次 setMusic 第一次确认 playing 发 `first: true`（字段 path / bundle / at / first / fadeIn / requestedAt / loadedAt，时间是 `GameAudio.now()` 毫秒）；切后台、静音后恢复也发，`first: false`。同时打一行 `[GameAudio] music started {...}`。只说明播放器在播，不代表设备上听得到。
- 测试：`test_scene_bgm.cjs` 的 v0.5 部分（加载页不加载、room ready 才加载、无 Boot 场景立即加载、先解锁后下载 / 先下载后解锁 / 加载页期间解锁三种顺序、淡入曲线、失败静默、bundle meta 与 region_skycity 一致）。

## 播放
- `GameAudio.setMusic(path, bundle?)`：bundle 为空走 resources；否则 `assetManager.loadBundle` 后 `bundle.load`。
- 循环：不靠平台 loop（MP3 编码延迟 + 填充约 41–46 ms，每圈会空一下）。播到 `时长 - 0.045 - 0.15 - 0.03` 秒时第二个声源从头起播，确认在播后 150 ms 等功率交叉，接任 `loopSource`。主声源 loop 仍为 true，第二个声源起不来时平台循环兜底。
- 切场景：正在播时旧曲继续，新曲确认在播后 1.5 s 等功率交叉；新曲加载失败 / 10 s 没起播则旧曲淡出。未解锁 / 静音 / 挂起时切换是立即的（原行为）。
- 静音 / 切后台 / 来电 / 音量 0 / `setMusic(null)` / 销毁：额外声源立即停掉，只留 `loopSource`。
- `audio/SceneMusic.ts` 每 0.25 s 只读轮询 WorldFlow 快照和棋盘 `hostPresentation()`，映射见 `sceneTrackFor()`；场景曲加载失败时这次回落到小岛 BGM。
- 测试：`node tools/voice-bot/bgm/test_scene_bgm.cjs`。
- 风力让路：WindAudio 每帧调用 `GameAudio.setWindDuck(s)`，BGM 降 -4 dB × smoothstep(0.2, 1, s)，0.5 s 平滑；乘在 musicVolume 上。数字见 docs/audio-events.md 的“峰值余量”一节。
