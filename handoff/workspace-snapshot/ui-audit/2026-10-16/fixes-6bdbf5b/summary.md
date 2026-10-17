# fixes-6bdbf5b 复验（基线 e2a03ec）
- HEAD 6bdbf5bc…0c903，tree fb3f6718…fddba5d，两边一致 ✅。bundle SHA256 ccf3dda4…2d389 ✅（sha1 8ba5fa2b…）。b0020ed 底座 bundle（sha1 6efeaecd…）按 2MB 分 4 片传，sha1 都对上了。
- Mac fresh clone，push=DISABLED。确认没有别人在用 Creator 后，清掉 library/temp/build 干净重建，wechat release 和 web-mobile 都出了，退出码都是 36。
- 录屏：390×844 白天、夜间各一遍完整流程，加 390 白天、夜间各一遍开箱。headless Chromium 1228，__worldFlowLog=true。**主页 6s 时有一次真实触摸点击 (195,160)**，日志 realTapHome 7.3s。后面进关、宝箱、按钮也都是真实触摸。夜间 night=true。

## 结果
| 项 | 结论 | 证据 |
|---|---|---|
| A1b 风声和海浪 | ✅ 通过（偏轻） | 户外 34–44s 的 >2kHz 能量是 −38 dBFS，只有 BGM 时是 −54，44.96s wind-pause 之后降到 −43 dBFS / 高频 −103。e2a03ec 时这一段是 −63 dB 的静音。WindAudio 是一个声源，soft 和 strong 两条交叉混合；出门音轨里已经没有烘焙的风声，没有叠加。frames/A1b_A2_audio_before_after.png |
| R1a 分数 | ✅ | 390 白天，85.54→85.74s 分数顶边 325→293→279→266→261→259，5 帧减速上移，不再一帧跳 66pt。夜间同样（310→283→271→261） |
| R1b 星星 | ✅ | 星星一直在，不再消失重弹。frames/R1_before_after_390.png |
| N1 夜空 | ✅（有更正） | [QF_SKY] 夜间 night=true、白天 night=false。从岛到桥那一段没有遮挡和接缝。**更正：** 上一轮说夜里天空是白天，是我看错了。e2a03ec 的夜空本来就是暗的，这次画面几乎一样（110s 顶部亮度 36.3 vs 36.4）。真正偏亮的是草地和最上面那朵云。frames/N1_*.png |
| A2 削波 | ✅ | 关卡 54–84s 削波样本 **0**（上轮 388），峰值 −1.45 dBFS。消除音效 100ms RMS p95 比 BGM 高 12.8 dB（上轮 19.0），仍然清楚，不需要改回 −5dB |
| M1 | ✅ | 干净构建后 git status 为空，没有任何 .meta 被改写 |
| 包体 | ✅ **19,100,765 B** | 上限 24,641,536，余量 5,540,771。比 e2a03ec 多 2,850 B（main） |
| 其他 | ✅ | pageerror 0，HTTP≥400 只有 favicon，没有 .cconb 和 QF_CCONB。F1 渐变仍然正常（白天回家 124.24→124.72 有 9 帧中间亮度）。2s 抽帧没发现越界、闪烁、黑屏或按钮没反应 |

## 日志摘录（白天，日志秒）
```
0.58   [QF_AUDIO] {"event":"waves-gate","gate":"gameaudio:no-gesture","outdoor":-1,"wind":0}
0.58   [QF_AUDIO] {"event":"wind-gate","gate":"gameaudio:no-gesture","wind":0,"clips":0}
7.313  [QF_AUDIO] {"event":"wind-gate","gate":"ok","wind":0,"clips":3}        ← 真实点击之后
24.163 [QF_AUDIO] {"event":"ensure-ambience","state":"crossing-out","mounters":2,"gate":"ok"}
24.328 [QF_AUDIO] {"event":"wind-play","which":"soft","vol":0.004,"s":0.002}
25.296 [QF_AUDIO] {"event":"waves-play","vol":0.002,"outdoor":0,"wind":0.144}
29.296 [QF_AUDIO] {"event":"wind-play","which":"strong","vol":0.003,"s":0.338}
44.963 [QF_AUDIO] {"event":"wind-pause"} ×2
89.746 [QF_AUDIO] {"event":"waves-play","vol":0.015,"outdoor":1,"wind":0}
92.851 [QF_SKY] {"event":"meadow-night-sky","night":false}   （夜间 92.386 为 night:true）
124.785 [QF_AUDIO] {"event":"waves-play","vol":0.2,"outdoor":0,"wind":0}
```
夜间日志的顺序和数值一样。完整原文见 raw/ib_{day,night}_390_worldFlowLog.txt。

## 问题清单
| # | 时间点 | 严重程度 | 改法 |
|---|---|---|---|
| A1c | 户外 24–44s，wind-play 的 vol 只有 0.003–0.004，waves 0.002 | 低到中 | 能听到，但压在 BGM 下面大约 12 dB。建议风声在户外抬到 0.05–0.1，或者出门时把 BGM 压低 |
| N2 | 夜间旅程 93–120s，最上面的云和草地仍然像白天一样亮 | 低 | 云和地面材质也要接 night 调色 |
| G1 | 不点屏幕就出门时，风声和海浪被 no-gesture 挡住（0.58s 的 gate 日志） | 低（有意为之） | 微信端首触就会解锁，可以接受 |

## 桌面包
07:22 CST（19:22 ET）已换成 6bdbf5b，README 已更新。8790 端口实测 7.3s 进主页，没有 404。

## 清理
已删掉 ~/qf-fx2-tmp，停掉服务和 headless Chrome，没有残留的 Creator。Mac 剩余空间：开工时 9,189,932 KiB；清理前 9,761,656 KiB；**清理后 10,233,048 KiB（约 9.76 GiB）**。
