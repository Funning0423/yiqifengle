# 场景 BGM（Voice bot）

| 场景 | 文件 | 分包 | 时长 | 规格 | 响度 |
|---|---|---|---|---|---|
| 小岛（家里 / 小岛 / 潮汐 / 主线 / R4） | `resources/audio_bgm/bgm_main.mp3`（uuid 不变 24969762-…） | resources | 83.5 s | 48 kbps 立体声 44.1 kHz，501,333 B | -16.4 LUFS |
| 草原（region = meadow） | `bundles/region_meadow/audio/bgm_meadow.mp3` | region_meadow（新） | 72.63 s | 48 kbps 立体声，436,288 B | -16.6 LUFS |
| 天空之城（天空城参观 + region = sky） | `bundles/region_skycity/audio/bgm_skycity.mp3` | region_skycity | 72.00 s | 48 kbps 立体声，432,526 B | -16.5 LUFS |

- 三首都是首尾相接的循环（尾音折回开头），旋律原创。源工程在共享电脑 /workspace/bgm/（不进仓库）。
- `region_meadow.meta` 复制自 `region_skycity.meta`，只改 uuid 和 bundleName（wx_subpackage、priority 1、wechatgame subpackage、非远程）。

## 播放
- `GameAudio.setMusic(path, bundle?)`：bundle 为空走 resources；否则 `assetManager.loadBundle` 后 `bundle.load`。
- 循环：不靠平台 loop（MP3 编码延迟 + 填充约 41–46 ms，每圈会空一下）。播到 `时长 - 0.045 - 0.15 - 0.03` 秒时第二个声源从头起播，确认在播后 150 ms 等功率交叉，接任 `loopSource`。主声源 loop 仍为 true，第二个声源起不来时平台循环兜底。
- 切场景：正在播时旧曲继续，新曲确认在播后 1.5 s 等功率交叉；新曲加载失败 / 10 s 没起播则旧曲淡出。未解锁 / 静音 / 挂起时切换是立即的（原行为）。
- 静音 / 切后台 / 来电 / 音量 0 / `setMusic(null)` / 销毁：额外声源立即停掉，只留 `loopSource`。
- `audio/SceneMusic.ts` 每 0.25 s 只读轮询 WorldFlow 快照和棋盘 `hostPresentation()`，映射见 `sceneTrackFor()`；场景曲加载失败时这次回落到小岛 BGM。
- 测试：`node tools/voice-bot/bgm/test_scene_bgm.cjs`。
- 风力让路：WindAudio 每帧调用 `GameAudio.setWindDuck(s)`，BGM 降 -4 dB × smoothstep(0.2, 1, s)，0.5 s 平滑；乘在 musicVolume 上。数字见 docs/audio-events.md 的“峰值余量”一节。
