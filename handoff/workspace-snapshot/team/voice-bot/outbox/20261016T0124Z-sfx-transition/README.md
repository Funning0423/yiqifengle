# sfx_transition_island_to_meadow.mp3 — 帆船转场音效（候选，未进包）

LICENSE: 自制原创（numpy 合成，固定随机种子 20261015，无任何外部素材）

- 规格：5.200 s（229,320 样本 @44.1 kHz，解码后精确），单声道 64 kbps mp3，开头无静音
- 响度：-21.1 LUFS 积分，峰值 -3.4 dBFS；对齐 20261015T1852Z-audio-cc0 里的 sfx_chest_metal_open（-20.7）/ sfx_door_open（-20.9）。脚步类太短，ebur128 测不出积分值，不作参考。
- 对齐 timing：team/cinematic/work/sail-transition-20261015T2119/timing/sail_transition.timing.json（30 fps，白天夜间相同）

| 帧 | 时间 | 声音 |
|---|---|---|
| 0–12 | 0–0.4 s | 柔和风底，0.3 s 起轻微木头吱呀 |
| 12 附近 | 0.42/0.58/0.71 s | 三下帆布拍动（启航） |
| 12–66 | 0.4–2.2 s | 海风轻微起伏 |
| 66–78 | 2.2–2.6 s | 风声上扬，高频气流渐强 |
| 78–84 | 2.6–2.8 s | 全遮峰值：穿云 whoosh（最响，RMS 约 -15 dBFS） |
| 84–96 | 2.8–3.2 s | 打开回落，84 帧起一串轻亮的 shimmer（G6–G7 五音，渐隐） |
| 96–156 | 3.2–5.2 s | 平稳草甸微风尾巴，结尾仍是风底（-30 dBFS 左右），便于接 amb_wind 循环 |

## 文件
- `sfx_transition_island_to_meadow.mp3`
- `envelope_frames.png`：波形 + RMS 包络，标注帧 0/66/78/81/84/96/156
- `preview_day_after-side_with_sfx.mp4`：音频叠在 video/ 白天对照视频上（视频帧 0 = 启航；右侧 after 是代理合成，不是 Cocos 实机）
- `synth_sfx_transition.py`、`master.sh`（合成→测 LUFS→增益→限幅→编码）、`plot_envelope.py`
- `SHA256SUMS`

## 注意
- 场景没加载完时 GGbot 会在第 81 帧暂停本音效、接风声循环；第 81 帧附近正好是峰值，暂停/恢复处的跳变请在实机上听一下，必要时暂停时加 50–100 ms 淡出。
- 跳过时 0.3 s 淡出即可，任何位置都没有尖锐瞬态。
- 只是候选，没碰游戏仓库，没推送。
