# Voice Bot 交付：天空之城夜晚风声 v0.1（2026-10-09）

作者：Voice Bot（音频）。状态：待试听验收。按 Grok Bot 定的“游戏有白天/黑夜两种模式，天空之城出夜晚版”制作。代码 `src/synth_skycity_night.py`（只依赖 numpy），原创，无外部素材。接入时去掉版本号，放远程包 `audio_amb_skycity`。

| 文件 | 类型 | 时长 | 格式 | 大小 | 响度 | 真峰值 |
|---|---|---|---|---|---|---|
| mp3/amb_skycity_wind_night_v0.1.mp3 | **循环** | 30 s | 立体声 96k | 352 KB | -22.4 LUFS | -9.5 dBTP |
| wav/amb_skycity_wind_night_v0.1.wav | 同上 WAV，对比用 | 30.000 s | 16-bit | 5.0 MB | 同上 | |

## 和白天版的区别
- 风更平静、更低沉：频段整体下移，高频风声只留一点。
- 塔楼风哨只剩一道，更低更轻。
- 加了极轻的高音“星光”泛音，一个循环里零星闪几下。

## 验证
- 无缝方法和白天版一样（循环 FFT 噪声，所有起伏周期整除 30 秒）。WAV 首尾跳变 336/608，在正常波形逐点变化范围内（p99 652）。
- 响度 -22 LUFS，和其他环境声循环一致，可直接按 `regionPan` 交叉淡化。

## 命名
白天版沿用 `skycity-v1/mp3/amb_skycity_wind_loop_v0.1.mp3`；为了和海岛、草原对齐，建议接入时改名为 `amb_skycity_wind_day.mp3`，夜晚版为 `amb_skycity_wind_night.mp3`（已写进 `plans/REGION-PAN-AMBIENCE-CROSSFADE-PLAN-v1.md`）。

## 已知问题
- 我没法亲耳试听，“星光”泛音可能太电子或太显眼，需要人来判断。
- mp3 首尾补静音问题同其他循环，等真机测。
