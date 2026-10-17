# PR #56 @d317b2f Mac r4：帆船音效硬切 / 跳过听不到 —— 查证结果

## 结论
1. **素材文件本身没有跌落。** 源文件和仓库 d317b2f 里的 mp3 sha256 一致（9556476e…）。10ms RMS：2.6–3.1s 是整段的峰（−15~−16 dB），之后平滑衰减到 5.2s；全片最大 80ms 跌落只有 7.7dB（在 0.43s 起音处）。
2. **硬切是代码造成的：云中 hold 的 80ms 淡出。** 用互相关把录音对齐到 `[sailboat] sting start` 日志：两段正常录屏里，音效在 sting 后 **+2.85s** 离开素材包络，`hold enter` 在 **+2.807s**（白天 30.527、夜间 30.750，视频时间），加上 80ms 淡出正好对上。hold 虽然 9–10ms 后就 leave 了，音效**不会恢复**（cineTo('fading') 之后只能 stopped）。
3. **summary 里的 28.59/28.76s 是对齐偏移算错了。** 页面音轨对视频的实际偏移是 **+2.05~+2.08s**（四段一致），不是 +0.13~0.19s。原因很可能是 audio-init.js 在 DOMContentLoaded 就记 startEpoch，但 AudioContext 要等用户手势 resume 才开始出数据。按正确偏移，跌落在视频 ≈30.50/30.72s，就是 hold enter 的时刻。r3 结论“音效比启航早 1.78s”大概率也是同一个偏移造成的，建议复核。
4. **跳过时听不到：是预期行为，不是 bug。** 点跳过在 sting +1.35s，0.3s 淡出到 +1.65s 结束。素材 0–2.2s 本来就轻（约 −30 dB，比 BGM 低约 5 dB），响的部分在 2.3–3.2s，跳过时已经淡掉。录音里 0–1.35s 的电平和素材吻合（增益差约 0 dB），说明 play 和音量都正常。

## 代码位置（d317b2f）
- `cine/SailboatTransitionModel.ts:17` `SAILBOAT_HOLD_CINE_FADE_SEC = 0.08`
- `cine/SailboatTransitionModel.ts:380-385` `enterHold()` → `cineTo('fading', …, 0.08)`；`:386-389` `leaveHold()` 不恢复音效；`:369-379` `cineTo` 一旦 fading 就回不去
- `cine/SailboatTransitionModel.ts:442` 进 hold 的条件：到 tf81 时 `!ready`
- ready = 驱动里的 `this.warmed`：`cine/SailboatTransitionDriver.ts:147,164`；`mountUnderCloud` `:206-221` 要等云完全盖住才实例化，`noteWarmth` `:223-228` 还要 `SAILBOAT_WARM_FRAMES = 2`（Model `:232`）帧。实例化那一帧卡 183ms，到 tf81 还差 warm 帧 → 进 hold 9ms。
- 音频端：`audio/GameAudio.ts:1008-1016` fadeCineSlot，`:1099-1104` tickCineFade 降到 0.001 以下就 stopCineSlot。
- 作者：git log 是 "Cursor Agent"（8158708 启航门、af03d32 日志、d317b2f 预载），按分工属 运镜bot 的启航门和预载代码。

## 建议修法
- 根因（运镜bot，r4 第 2 项）：提前实例化 / 拆开草甸挂载，让 tf81 之前就 warmed，就不会进 hold，音效会自然播完。
- 兜底（同一文件）：hold 时音效不要马上 80ms 淡掉。改成进 hold 时先不动；hold 超过约 250ms 才淡出（例如淡 0.4s），或者 leaveHold 在音效还没淡完时恢复。不要再用 80ms。
- 跳过：可以保持现状（0.3s 淡出接风声）。如果希望跳过时也能听到“启航”，我可以出一个短的跳过版尾音，但需要 Funning 先确认。
- 录屏脚本（Grok Bot）：音频偏移改成以第一块非静音数据 / AudioContext resume 的时刻为准，或者直接用日志里的 sting start 对齐。

## 文件
- envelopes_aligned.png：素材包络 + 4 段录音（按 sting 日志对齐），红线是 hold enter / 点跳过，绿线是 tf81
- envelopes_raw_wavtime.png：wav 原始时间轴
- findings.json、aligned.json、scripts/a.py、scripts/b.py
