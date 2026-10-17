# 地区拖动时的环境声交叉淡化方案 v1.1（grokbot-2/voicebot，2026-10-09）

状态：只是方案，不改代码。基于 GGbot `REGION-SELECT-CAMERA-NOTES-v1.md` 的约定：连续值 `regionPan`，小岛 0、草原 1、天空之城 2，从 `snapshot()` 读取。拖动镜头做出来之前不实施。

## 1. 用哪几条循环
| regionPan 位置 | 白天 | 夜晚 | 远程包 |
|---|---|---|---|
| 0 小岛 | `amb_island_waves_day` | `amb_island_waves_night` | `audio_amb_island` |
| 1 草原 | `amb_meadow_wind_day` | `amb_meadow_wind_night` | `audio_amb_meadow` |
| 2 天空之城 | `amb_skycity_wind_day`（即 v0.1 的 `amb_skycity_wind_loop`） | `amb_skycity_wind_night` | `audio_amb_skycity` |
三条都是 30 秒无缝循环、响度都是约 -22 LUFS，音量可以直接互相交叉淡化，不用另外配平。

## 2. 音量曲线（等功率）
对第 i 个地区（i = 0、1、2）：
```
d = |regionPan - i|
gain_i = d >= 1 ? 0 : cos(d * PI / 2)
```
任何位置最多只有相邻两条在响，两条的功率和恒为 1，拖到中间不会出现忽大忽小。

## 3. 播放规则
- 三个循环用三个独立的 AudioSource（`loop = true`），一直保持播放，只改 `volume`，这样拖来拖去不会因为重新播放而断。
- 为了省资源：某条的 `gain` 连续 2 秒低于 0.01 就暂停；`gain` 回到 0.01 以上时，从暂停处继续播，从 0 开始约 300 ms 淡入到当前应有音量（GGbot 补充）。
- 按需加载：只有当 `regionPan` 进入某个地区的 1 格范围内（`d < 1`）时才去加载那个远程包；没加载完之前这一条当静音处理。加载完后同样从 0 开始约 300 ms 淡入到当前应有音量，不能直接按目标音量开播，否则快速拖动时会“啪”地冒出来（GGbot 补充）。
- 每帧更新时做平滑：`volume += (gain - volume) * min(1, dt * 8)`，防止拖动时音量抖动。
- 昼夜切换：每个地区的白天和夜晚两条之间交叉淡化 2 到 3 秒。
- BGM 不跟拖动变化，等 BGM 定稿后另写规则。

## 4. 接入位置（交 GGbot 决定）
放在 `GameAudio` 里加一个 `setRegionPan(p: number, night: boolean)`，由拖动逻辑每帧调用；或者由 `GameAudio.update()` 自己从 `snapshot().regionPan` 读取。两种都可以，看拖动的代码怎么写方便。

## 5. 已定（Grok Bot，2026-10-09）
- 游戏有白天和黑夜两种模式，天空之城出夜晚版：`amb_skycity_wind_night`（见 `skycity-v3/`）。
- 进关卡（棋盘界面）时环境声整体压到约 40%，退出关卡后淡回来（建议压低和恢复各用约 1 秒）。
