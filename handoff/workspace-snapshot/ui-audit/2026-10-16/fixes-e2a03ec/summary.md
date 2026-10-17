# fixes-e2a03ec 复验（基线 77b76c3）
- HEAD e2a03ec3ca7866570a0e04ae46564bec783163f3，tree 7fb667fe…bbc93，Mac 和盒子两边一致 ✅。bundle SHA256 08bfd11e…08bc4 ✅（sha1 11ee96bb…，721 KB，一片传完）。Mac 上还缺 b0020ed，所以另打了 751905c..b0020ed 的 bundle（sha1 4a4cc1c0…），按 2MB 分成 4 片传过去，每片 sha1 都对上了。
- Mac 上 fresh clone（--shared，借用 cursor-worktree 的对象库），push=DISABLED。开工时（06:35 CST，即 18:35 ET）另一个 Creator 正在构建（glass-v4r32），等它结束后才开始。删掉 library/temp/build 后干净重建，wechat release 和 web-mobile 都出了，退出码都是 36，和以往一样。
- 录屏：headless Chromium 1228，__worldFlowLog=true，390×844 白天、夜间各录一遍完整流程，另外录了 390 白天、320 白天、320 夜间三遍开箱。录屏脚本 rec10/rec11 的 finally 里引用不到 `mon` 变量，导致第一次跑完结果没存下来；改脚本后重录，第二次的结果有效。

## 结果
| 项 | 结论 | 证据 |
|---|---|---|
| F1 渐变 | ✅ 通过 | frames/F1_luma_curves_e2a03ec.png、F1_travelfade_day_25fps_new.png、F1_homefade_day_25fps_new.png；旧版（硬切）见 ../integration-build05-77b76c3/frames/sheet_day_travelfade_8fps.png |
| R1 开箱 | ⚠️ 一半通过 | 没有小箱子闪现，3D 宝箱是连续开盖的 ✅；但 390 下分数还是一帧跳 66pt ❌。frames/R1_open_framebyframe_*.png |
| R2 浮标 | ✅ 通过 | 浮标 y 从 263.9 变成 248.8，上移 15.1pt。frames/R2_float_320_{day,night}_before_after.png |
| F2 .cconb 404 | ✅ 没有复现 | 一共 7 次加载（8899 端口 5 次，桌面包 8790 端口首次 + 第二次），.cconb 404 为 0，**没有任何 [QF_CCONB] 日志**。只有 favicon 的 404 |
| A1 出门音轨 | ✅ 音质通过 / ⚠️ 风声是 0 层 | 32 kHz、56k、单声道，140,660 B，构建产物和源文件逐字节一致；高频一直到约 14–16 kHz 都还在（frames/A1_spectrum_before_after.png）。但风声不是 1 层，而是 0 层，见 A1b |
| M1 meta | ✅ 已导出 | M1-lakeside-glb-meta-52.diff（52 个 GLB，sha1 38f97867…）；另外有 M1-lakeside-png-meta-2.diff（2 个 png 的 hasAlpha 从 true 变成 false） |
| 包体 | ✅ 19,097,915 B | 上限 24,641,536，余量 5,543,621。比 77b76c3 多 82,536 B（region_island +80,245，来自音频；main +2,291，来自代码） |
| 完整流程 | ✅ | 白天、夜间都跑通，pageerror 0，HTTP≥400 只有 favicon。夜间 night=true ✅ |

### 时间点（日志秒；视频时间 ≈ 日志时间）
- 白天：加载页约 1.5s 结束；主页停留到 13.36s 点出门，停留约 12s ✅。出门音轨开始播放在 24.15s，岛 44.1s，进关 46.8s，通关 83.0s，点宝箱 85.6s，回小岛 89.3s，travelRegion 92.3s，草地 119.8s，点「主页」123.9s，回到主页 124.4s。
- F1 白天：去草地，从 92.32s 开始淡出，0.24–0.36s 降到全黑（92.56–92.64s），再用约 0.32s 淡入，过渡中有 8 帧中间亮度。回主页：123.76s 开始，淡出 0.40s，全黑 0.08s，淡入 0.48s，淡出 9 帧中间亮度，淡入 12 帧。夜间的曲线一样（淡出 0.40s，淡入 0.44–0.64s）。
- 音画对齐：音轨里第一个非静音块，白天 23.635s 对应 play 24.145s，offset +0.51s；夜间 23.651s 对应 24.17s，offset +0.52s。

## 问题清单
| # | 位置 / 时间点 | 严重程度 | 改法 |
|---|---|---|---|
| R1a | 390×844 开箱，85.66s 到 85.70s 那一帧，Score 顶边从 y325 跳到 y259 | 低到中 | scoreEase 没有生效。可能是宝箱交接（adopt）之后，Score 的世界坐标没有差值，或者被后面的 reflow 覆盖了。建议在 web 构建里打日志，查 adoptedScoreY 和 y；320 下分数本来就不动，不受影响 |
| R1b | 同一时刻，85.72s 星星消失，86.0–86.9s 重新逐个弹出 | 低 | 面板重画时星星的入场动画又播了一次。交接时应该跳过星星的入场动画（像 settleOpen 那样） |
| A1b | 出门户外段（音轨的 10–20s，即日志 34–44s）| 中 | 音轨去掉风声和海浪后，这一段源文件只剩 −63 dB。日志里没有 WindAudio 或 ambience 的任何事件，录到的声音几乎是静音，所以 web 上风声是 0 层。要在 crossing-out 时启动 WindAudio 和海浪环境音循环，并且打 [GameAudio] 日志，方便验证。微信端待真机确认 |
| A2 | 关卡里 55–81s（白天），388 个样本到 0 dBFS；77b76c3 里也有 352 个 | 低到中（之前就有） | 关卡 bgm 和消除音效叠加后削波。给 SFX 总线加 limiter，或者把 bgm 降 3 dB |
| N1 | 夜间去草地的路上（1:34–2:02）天空仍然是白天 | 低（之前就有） | 地区旅程场景要接 night 参数 |
| M1 | 2 个 png 的 .meta（T_LK_palette_256、T_LK_grade_lut_32）hasAlpha 从 true 被改成 false | 低 | 和 52 个 GLB meta 一起提交 |
| 录屏 | 进关 47.52s 有一帧亮度从 160 跳到 181，0.2s 内回落 | 低 | 应该是 enter-level cover 的闪白，属于有意设计，可以忽略 |

## 桌面测试包
- 06:54 CST（18:54 ET）已把 ~/Desktop/QIFENGLE-test-build05 换成 e2a03ec：wechat/ 是 wechat-release（appid wx3bdd911c5c06f591），web/ 是 web-test 加原来的 start.command。README 已更新，写上了已修好的项和剩余问题。总大小 40M。
- 实测：在 8790 端口用全新浏览器配置打开两次，都在 9.3s 进到主页，没有 404，也没有 QF_CCONB 日志。

## 清理
- 已停掉 8899 和 8790 两个服务和 headless Chrome，删掉 ~/qf-fx-tmp（538M，里面有 clone、构建、缓存、录屏和脚本）。确认没有残留的 Creator 进程。
- Mac 剩余空间：开工时 11,112,384 KiB；清理前 9,502,744 KiB；**清理后 10,059,196 KiB（约 9.6 GiB）**。比开工时少约 1 GB，不是这一轮造成的：桌面包前后都是 40M，我自己的临时文件也都删了。差额应该来自同一时间在跑的其他任务（例如 glass-v4r32 的 Creator），没有动它们。
- 盒子上的临时 bundle、分片和压缩包都已删除。
