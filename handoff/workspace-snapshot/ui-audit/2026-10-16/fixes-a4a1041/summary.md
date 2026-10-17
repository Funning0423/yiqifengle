# fixes-a4a1041 复验（基线 6bdbf5b）
- HEAD a4a10418…aee71，tree 356e5d26…1b7f，两边一致 ✅。bundle SHA256 8b079825…c5f1e ✅（sha1 5a45b22f…）。b0020ed 底座 bundle 按 2MB 分 4 片传，sha1 一致。
- Mac fresh clone，push=DISABLED。确认没有别人在用 Creator，清掉 library/temp/build 后干净重建 wechat release 和 web-mobile，退出码都是 36。
- 录屏：390×844 白天、夜间各一遍完整流程；390 白天切后台 / 静音测试一遍；320×568 白天、夜间各一遍（看玻璃牌和开箱）。dpr2，__worldFlowLog=true。**出门改成真实点击玻璃牌**（7.4s 点击，8.4s 变为 standing），后面的点击也都是真实触摸。主页停留约 6s，因为这一轮直接点牌出门，不再等 12s。夜间 night=true。
- 时间轴：因为改成点牌出门，比上一轮早了约 5s。出门音轨 19.1s 开始播放，户外段在 24–39s，travel 87.3s，回家 119.4s。

## 结果
| 项 | 结论 | 证据 |
|---|---|---|
| A1c 户外环境声 | ✅ | wind-level 的 s 在 31s 达到 1.0，waves-level 的 vol 稳定在 0.41–0.55。户外 26–33s 总电平 −20.1 dBFS，屋里只有 BGM 时 −27.2，扣掉 BGM 后环境声约 −21 dBFS，**比 BGM 高约 6 dB**；34–39s 高约 4 dB。上一轮比 BGM 低。frames/A1c_levels_before_after_vis.png |
| 切后台 / 静音 | ✅ 声音正常；⚠️ 流程会重置 | 日志 30.60–34.61s hidden，录音 1s 窗口为 −240（全静音），visible 后 34.6s 音乐恢复。37.64–40.64s 静音，录音全静音，日志 gate=gameaudio:muted；取消静音后恢复，gate ok。**但出门途中切后台会让出门取消（exit-cine cancel:left-exit），世界回到屋里坐着，state=paused 且 needsResume=true，要点底部「继续」按钮。** 我点屏幕中间没有恢复，之后的流程卡住了（这一遍只用来测声音） |
| N2 夜间调色 | ⚠️ 一半通过 | 最上面那朵云变暗了 ✅（顶部亮度 70→30）；**草地地面没有变暗** ❌（屏幕中段亮度 85→84、79→77，基本没变）。变暗的只有草丛细条，大片地面还是亮绿色。白天和以前一样 ✅（109/149 → 108/149）。frames/N2_night_travel_before_after.png |
| 玻璃牌边缘 | ✅ | 4 倍放大没有锯齿，圆角边缘平滑，顶部高光两端是渐隐的。frames/glass_sign_4x_{390,320}_{day,night}.png |
| 玻璃牌文字 | ✅ | 粗体白字加阴影，390 下清楚；320 下字高约 10px，也能看清 |
| 玻璃牌叶子 | ✅（按代码） | 代码里 fontSize 是 42（牌面本地 px），390 下实际渲染约 12×17 CSS px，和 42/280 的比例一致 |
| 玻璃牌点击 | ✅ | 390 和 320、白天和夜间都是点一下就进入 standing，出门约 1.1s。桌面包实测也一样 |
| 玻璃牌深度 | ✅ | 牌子在墙面前，茶壶和蒸汽在它前面，牌子没有盖住；点击之后牌子就隐藏了，不会和走动的人物重叠 |
| 连消削波 | ✅ | 白天、夜间都是 0 个削波样本，关卡峰值 −1.53 dBFS。消除音效 p95 比 BGM 高 13.0 dB，听得清 |
| 包体 | ✅ **19,118,651 B** | 上限 24,641,536，余量 5,522,885。比 6bdbf5b 多 17,886 B，低于预估的 19.13–19.15 MB |
| 其他 | ✅ | 5 次录屏 pageerror 0，HTTP≥400 只有 favicon，没有 .cconb。渐变正常。2s 抽帧没有越界或黑屏 |

## 日志摘录（白天 ib_day_390）
```
7.365  [GameAudio] music started {"path":"audio/bgm_main","first":true,"fadeIn":true}
19.093 [GameAudio] exit-cine {"event":"play","offsetS":0}
19.224 [QF_AUDIO] {"event":"wind-level","s":0.001,"soft":0.004,"strong":0,"bed":1}
23.041 [QF_AUDIO] {"event":"waves-level","vol":0.208,"outdoor":0.454,"wind":0.196}
25.058 [QF_AUDIO] {"event":"waves-level","vol":0.527,"outdoor":1,"wind":0.47}
27.357 [QF_AUDIO] {"event":"wind-level","s":0.811,"soft":0.674,"strong":0.821,"bed":1}
31.424 [QF_AUDIO] {"event":"wind-level","s":1,"soft":0.75,"strong":1,"bed":1}
31.14  [QF_AUDIO] {"event":"waves-level","vol":0.413,"outdoor":1,"wind":1}
36.507 [QF_AUDIO] {"event":"wind-level","s":0.239,"soft":0.446,"strong":0,"bed":1}
38.54  [QF_AUDIO] {"event":"wind-level","s":0.006,"soft":0.028,"strong":0,"bed":1}
39.257 [QF_AUDIO] {"event":"waves-level","vol":0.55,"outdoor":1,"wind":0}
40.107 [QF_AUDIO] {"event":"wind-pause"} ×2
87.395 [QF_SKY] {"event":"meadow-night-sky","night":true}   （夜间；白天 87.498 为 night:false）
```
切后台测试（ib_day_390_vis）：
```
30.39  [QF_AUDIO] {"event":"wind-level","s":0.998,"soft":0.749,"strong":1,"bed":1}
30.608 [GameAudio] exit-cine {"event":"cancel:left-exit"}        ← 30.60 hidden
34.613 [GameAudio] music started {"first":false,"fadeIn":false}   ← 34.61 visible
35.422 [QF_AUDIO] {"event":"wind-level","s":0.04,"soft":0.181,"strong":0,"bed":1}
37.64  [QF_AUDIO] {"event":"wind-gate","gate":"gameaudio:muted","wind":0,"clips":3}
40.64  [QF_AUDIO] {"event":"wind-gate","gate":"ok","wind":0,"clips":3}
40.639 snapshot {"state":"paused","stable":"home","needsResume":true}
```
完整原文：raw/ib_*_worldFlowLog.txt。

## 问题清单
| # | 时间点 | 严重程度 | 改法 |
|---|---|---|---|
| N2b | 夜间旅程 88–115s，草地地面 | 中 | 草地地面也要接夜间光照（和草丛同一个 windParams.w=1 / lightScale），或者给地面材质加 nightBlend |
| V1 | 切后台测试，日志 30.6s | 中 | 出门途中切后台再回来，出门流程被取消，人物回到屋里坐着，state=paused / needsResume=true，要点底部「继续」才行；点屏幕中间没反应。建议回到前台后直接接着播出门，或者至少保留出门进度。请 GGbot 确认这是不是设计如此 |
| M2 | 构建后 git status | 低 | Creator 生成了 `GlassSign.ts.meta`，但它没有提交（untracked）。文件在 logs/GlassSign.ts.meta，请提交，否则每次构建 uuid 都会变 |
| G2 | 玻璃牌排版 | 低 | 叶子和文字之间空了一大段，叶子贴在左边、文字偏右，整体看起来不居中。建议把 leaf+12+caption 作为一组按实际字宽居中。叶子用的是系统 emoji 🍃，在微信或安卓上样子会不一样，建议换成图片 |
| G3 | 玻璃牌 320 下 | 低 | 字高约 10px，偏小但看得清，可以接受 |

## 桌面包
08:28 CST（20:28 ET）已换成 a4a1041，README 已更新（写了新增的玻璃牌和剩余问题）。8790 端口实测 9.3s 进主页，点玻璃牌后变为 standing，没有 404。

## 清理
已删掉 ~/qf-fx3-tmp，停掉服务和 headless Chrome，没有残留的 Creator。Mac 剩余空间：开工时 10,393,688 KiB；清理前 9,572,692 KiB；**清理后 10,126,576 KiB（约 9.66 GiB）**。
