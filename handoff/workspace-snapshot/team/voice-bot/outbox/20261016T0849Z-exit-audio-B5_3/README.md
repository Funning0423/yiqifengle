# Voice Bot 交付：出门过场音轨，对齐运镜bot B5.3（2026-10-16）
状态：草稿，只在本地，没推送。分支 `voice-bot/exit-audio-B5_3`，基于 00fea63。
- commit `2fba62f68c90291476b87d10e482e509c1e2d5e5`，tree `42ff9ed5b3857e3af8955db647d1f73ca042a949`
- 补丁：`0001-*.patch`（SHA256 见 SHA256SUMS）

| 文件 | clip | 时长 | 格式 | 响度 | 峰值 |
|---|---|---|---|---|---|
| `sfx_exit_outbound.mp3` → `creator-build-project/assets/bundles/region_island/audio_cine/` | `exit_outbound_B5.3`（600 帧 @30fps） | 19.967 s（解码后，含无缝信息） | 立体声 96k | -24.8 LUFS（和开场 stand 音轨一致） | -6.9 dBFS |

## 对齐（帧 / 30 = 秒，全部由 timing.json 和 exit_B5.3_cur.csv 驱动）
- 第 0 帧起就有轻风底噪，开头不是静音；第 4 帧（windBase）底风到位。
- 第 76 帧：木门闷响，前 0.33 s 有一声短的铰链吱声。
- 脚步 11 步，0.43–8.30 s，按人物位移约每 0.55 m 一步，左右交替；强度跟镜头速度走，248 帧最响，260 帧走路结束前收轻。
- 风：走路段跟镜头速度起伏，约 11.2 s 开始起风，448–503 帧满风（高频也最亮）；455 帧镜头起升时有一道上扫的呼啸重音。
- 503 帧后风逐渐降到约 18%，最后 0.35 s（588.5–599 帧）余弦淡到 0，599 帧交给 `sfx_transition_island_to_meadow.mp3`，不叠加、不硬切。

## 文件
`envelope_markers.png`：包络图，标了所有关键帧和脚步位置。`preview_envelope_with_audio.mp4`：运镜bot 的目录里还没有 B5.3 的视频（README 写着视频待做），所以先用包络图加时间码配音频；等有了渲染，用同一个 mp3 替换音轨就行。`events.json`：实际放置的时间点。

## 怎么重做
`PYTHONHASHSEED=0 python3 synth_exit_outbound.py <timing.json> <exit_cur.csv> raw.wav`，再按 -24.8 LUFS 增益、`alimiter=limit=0.6`、`libmp3lame -b:a 96k` 转 mp3。脚本在仓库 `tools/voice-bot/exit/`。

## 已知问题 / 需要确认
- 我没法亲耳试听，只看了波形、响度和峰值，音色要人判断。
- 游戏里出门时 WindAudio 本身还在实时放风声循环。这条音轨也有风，两层同时放可能会叠得太响。需要 GGbot 决定：出门段把 WindAudio 压低，还是把这条音轨里的风去掉、只留门和脚步。
- `region_island/audio_cine/` 这个目录在 00fea63 里还不存在，我新建了，没写 .meta；要在 Creator 里导入生成 .meta，并确认它属于哪个 bundle。
