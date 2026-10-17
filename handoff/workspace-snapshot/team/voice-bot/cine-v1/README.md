# Voice Bot 交付：开场过场音轨 v0.2（对齐运镜bot M1 v1，2026-10-09）

作者：grokbot-2/voicebot。状态：草稿。对齐的是 M1 v1 的时间点，M1 v1 本身还没验收通过，所以这版音轨也算草稿；运镜bot 出 v2 后，用新的 timing.json 重跑脚本就能自动对齐（见“怎么重做”）。全部用代码合成，原创，没有外部素材。

| 文件 | 对应 clip | 时长 | 格式 | 大小 | 响度 | 真峰值 |
|---|---|---|---|---|---|---|
| mp3/sfx_cine_open_stand_v0.2.mp3 | `cine_open_stand`（91 帧 @30fps） | 3.000 s + 0.35 s 尾音 | 立体声 96k | 40 KB | -24.9 LUFS | -6.4 dBTP |
| mp3/sfx_cine_open_turn_v0.2.mp3 | `cine_open_turn`（46 帧 @30fps） | 1.500 s + 0.35 s 尾音 | 立体声 96k | 22 KB | -25.6 LUFS | -6.6 dBTP |

接入：按 0006 v1.1，clip 开始时同时播同名音轨（去掉版本号），放 `assets/bundles/region_island/audio_cine/`。

**v0.2 改动**：GGbot 确认音轨可以比 clip 长、播放时不会在 clip 结束时掐断，所以每条音轨在 clip 时长后面多留 0.35 秒尾音（WAV 为 3.35 s / 1.85 s），最后一步脚步的尾音不再被切。音轨开头和所有事件的帧位置不变。跳过过场时照常立即停掉。

## 内容和对齐（全部按 timing.json 的帧号放，帧 → 秒 = 帧 / 30）
**stand**
- 第 0 帧起就有极轻的衣料摩擦声，所以音轨开头不是静音。
- `standUpStartFrame` 6 起：衣料声变大，第 8 帧椅子轻轻吱一声（身体前倾）。
- 脚：`lift` 5、12 只有极轻的擦地声；`contact` 20（左）、27（右）是木地板上的软底鞋脚步，左右声像各偏一点。
- `seatOffFrame` 49 前 4 帧：椅子再吱一声（离座）。
- 衣料声在 49 到 83（`standUpEndFrame`）之间淡出，83 到 90 静止。
**turn**
- 第 1 到 44 帧（`turnStartFrame`–`turnEndFrame`）有转身的衣料声。
- `contact` 12、22、33、43 四次脚步；`lift` 2、12、22、33 是极轻的擦地声。
- 两段都加了很短的小木屋反射声。

## 怎么重做
`python3 src/synth_cine.py <新的 cine_open_stand.timing.json> <新的 cine_open_turn.timing.json>`（设 `PYTHONHASHSEED=0` 保证每次结果一样），再用 ffmpeg 转 mp3（`-b:a 96k`）。脚本只读 `fps`、`durationSec`、`events` 这几项，帧号变了声音就跟着走。

## 已知问题
- 我没法亲耳试听，只用工具看过波形、响度和峰值，脚步和椅子的音色需要人来判断。
- mp3 编码器在开头有约 25 ms 的编码延迟；文件里写了无缝信息，但如果微信解码器不处理这个信息，声音会整体晚约 25 ms，不到 1 帧（33 ms）。
- 起身时手压进大腿、转身时两腿互穿这类问题不影响声音；v2 的帧号如果变了，重跑脚本即可。
