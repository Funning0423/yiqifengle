# A3b 单独复验（fix/a3-home-sea-fadein @ a17395c）—— 已完成，结果保留
- 完整 bundle 2MB×66 片 sha1 全对，SHA256 5d4ed05d…c2e2 ✔；重新 clone HEAD 09a1b8e / tree 082f1c0e ✔；A3b bundle 5f4750f6…4413 ✔，HEAD a17395c ✔，status 干净
- 守护脚本一次过：**wechat 19,126,549 B（+869 B vs 19,125,680，超出预计 300–500 B）**，main 1,176,922；web 19,867,982
- 回家（真实点击，__worldFlowLog）：
  | | tap±200ms 峰值 | ≥0.999 | 点击-背景 RMS 差 |
  |---|---|---|---|
  | A3b 白天 | 0.557 (−5.1 dBFS) | 0 | +9.8 dB |
  | A3b 夜间 | 0.708 (−3.0 dBFS) | 0 | +8.6 dB |
  | A3 白天/夜间 | 0.942 / 1.000 | 0 / 8 | +11.0 / +11.6 dB |
  | 09a1b8e 白天/夜间 | 0.880 / 0.925 | 0 / 0 | +11.3 / +11.8 dB |
- home-duck ✔：`[QF_AUDIO] {"event":"home-duck","t":1792211791448,"gain":0.6,"s":0.08,"outS":0.4}`（白天，夜间同）
- 回家时海浪不再重启：A3/09a1b8e 有 `waves-play vol 0.515`，A3b 回家后没有 waves-play/waves-start，只有衰减中的 `waves-level vol 0.014 outdoor 0`（+1.3s）。所以回家这一次没有 waves-start 可看。
- 其它重启点都是 from:"zero"：`{"event":"waves-start","vol":0.037,"from":"zero"}`（关卡回岛 84.5s）、`{"event":"waves-start","vol":0.002,"from":"zero"}`（首次出门 20s）
- 整流程无退步：报错 0/网络 0；站起 8.4s，海岛 39.1s，关卡 11 步通关，回岛，夜间 nightProp=true，时间线与 09a1b8e ±0.1s
- 波形对比 frames/tap_home_waveform_A3_vs_A3b.png；分析 logs/home_analysis.txt（ana.py）
- 桌面包未替换（仍 09a1b8e）。Mac 清理：12:45 CST 前 10,209,748 KiB → 后 10,796,108 KiB
