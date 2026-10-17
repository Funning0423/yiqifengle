# integration build05 62382c4 — 验收进度
- 2026-10-16 17:05 ET 开始。Mac 剩余空间（开始）：10,521,652 KiB ≈ 10.03 GiB；没有别人的 Creator 在跑。
- bundle SHA256 8c803ec415acb007465acee2e344ba506a1258e390631e9bd428e3605f7886f9 ✅（开头 8c803ec4、结尾 f9）。它的前置 commit 是 b0020ed；为了让 Mac 能从 751905c 浅克隆接上，从 worktree 另打了 751905c..62382c4 的 bundle（sha1 17b1188f…），用 2MB 分块传了 4 片。
- Mac clone：~/qf-ib-tmp/repo，push=DISABLED。
- 17:10 ET 收到调整：改用新 HEAD **6b1334f994380c6cea55a3def3642692bd10133a**（tree f3e904072a7e2ddf151df37e0c2e9cba989d0ba2，= 62382c4 + 结算最终版 d6a0019 合并）。增量 bundle 62382c4..6b1334f（sha1 4451cf89…）传到 Mac；两侧 tree 一致；62382c4 的 tree 009297f4 也已核对。Mac clone 是全新的，没有 library/temp/build，属于干净构建。
- 17:12 ET 开始构建（微信 release、web-mobile，之后做 LK_terrain 关 meshCompress 的对比构建）。

## 1) 包体（6b1334f，干净构建，2026-10-17 05:10 CST = 17:10 ET）
| 分包 | 字节 |
|---|---|
| **总包** | **19,013,276**（≤ 24,641,536 ✅，比 b0020ed 的 24,553,771 少 5,540,495） |
| 根目录（非分包） | 1,862,250 |
| audio_bgm_island | 418,907 |
| board_art | 2,112,160 |
| internal | 297,535 |
| main | 1,158,694 |
| region_island | 2,886,856（b0020ed 是 8,912,286，少 6,025,430，原因是人物 GLB 开了 meshCompress；GGbot 原来估计只省 0.9–1.3 MB，所以要重点看人物有没有变形） |
| region_lakeside | 462,448 |
| region_meadow | 2,934,382 |
| region_skycity | 3,326,944 |
| resources | 433,034 |
| shared_effects | 563,694 |
| static_seat_preview | 2,556,372 |
- release 和 web 包都扫过横幅字符串，没有找到「独立测试进度 / 测试包 / 地区流程测试 / 流程参考占位」。
- 发现：构建时 Creator 改写了 52 个 lakeside GLB 的 .meta。提交的 meta 里 `subMetas:{}` 是空的，导入后被补上了 mesh 和 texture 的子 meta。补全后的 .meta 应该提交进去，否则每次构建都会出现未提交的改动，子资源的 uuid 也要靠导入时重新生成（中等）。
- 构建警告：有 11 个「未支持的 GLTF 扩展 KHR_materials_specular / emissive_strength」，49 个「a_color quantization may not work」（与 lakeside 的 quantize 有关），另外还有一批 TS1005 之类的 rollup 警告。两个构建的退出码都是 36，和以往相同。

## 2) LK_terrain meshCompress 对比（uuid cf4e4fee…）
| | LK_terrain 产物 | region_lakeside | 总包 |
|---|---|---|---|
| 开（compress+quantize+encode，现状） | 36,568 B | 462,448 | 19,013,276 |
| 关 | 112,320 B | 538,158 | 19,088,986 |
| 差值 | −75,752 B（−67.4%） | −75,710 | −75,710 |
- 测完已经 `git checkout` 恢复了 .meta，没有提交。

## 3) 完整流程 run1（390×844，web-mobile，headless Chromium 1228，录了声音）
- 白天 TZ Etc/GMT+9（当地 12 点），night=false；夜间 TZ Etc/GMT-2（当地 23 点），**night=true** ✅。
- 两次都跑通了：主页 → 出门（B5.5 镜头 + exit-cine 音轨）→ 小岛 → mainline-01 通关（用 11 步）→ 结算 → 点宝箱 → 「回小岛」→ travelRegion('meadow') 旅程 → 草地点「主页」→ 回家。pageerror 为 0，HTTP ≥400 为 0（没有 404）。
- 时间点（白天，log 秒 ≈ 视频秒）：standing 14.54 / walking-out 18.04 / opening-door 26.01 / crossing-out 29.26（exit-cine play 29.40）/ island 51.16 / level 55.86 / 结算 ~98.7 / 回小岛 106.6 / region-loading 109.75 / meadow 139.32 / home 144.60。
- 夜间各段明显变慢：walking-out 18.2s（白天 8.0s），crossing-out → island 41.3s（白天 21.9s）。原因看起来是 headless 夜间帧率低，动画随帧推进；需要真机确认（低）。
- **run1 的问题**：视频里加载页一直到约 6–7s 才淡出，而 `state:home` 在 1.4s 就触发了，所以主页实际只停了约 8s，不到 10s。已用 18s 停留重录（run2）。
- 黑屏和淡变：04→05 那段，在视频 110.36→110.40，亮度从 147 一帧跳到 16，黑场保持 1.24s，111.60→111.64 又一帧跳回 122。草地回主页：144.08→144.12 一帧跳黑，黑 1.08s，145.16→145.20 一帧跳回。按 25fps 逐帧取 YAVG 看，**两处都没有中间帧，看起来是硬切黑而不是渐变**。黑场期间画面完全不动，说明主线程在加载、没在渲染，淡变的帧没画出来。见 frames/sheet_day_travelfade_8fps.png、sheet_day_homefade_8fps.png。
- freezedetect 检出的静止段都在主页静坐、关卡等待或结算页，属于正常；没有发现闪烁或元素消失（sheet_{day,night}_2s.png）。

## 结算最终版（d6a0019，包含在 6b1334f）
- 点宝箱一次就全部领完 ✅：localStorage 的 forest-v33-journey 里 charms 从 [] 变成 ["seaRibbon"]，tools.tideNet 从 0 变成 1，openedChests 记为 [0]，regionClaims[0] 变成 true。第二次点击后存档 diff 为空，没有反应 ✅（390 白天/夜间、375×812、320×568 都测了）。
- 没开箱直接点「下一关」，坐标 (116.5,719) ✅：写入的内容和上面完全一样，**重新加载页面后仍然保留**，随后进入下一关（state=level）。全程没有弹窗（每 300ms 查一次，连续 3.6s 都没有 Reward*）。
- 没开箱直接点「回小岛」，坐标 (273.5,719) ✅：写入相同的内容，重新加载后仍然保留，随后回到小岛，没有弹窗。之前已知的回小岛存档问题**已经修好**。
- 不再弹 RewardPanel ✅：点宝箱后 popups 一直只有 ["ResultPanel"]。
- 布局（390×844）：两个按钮各 141×56，x=46 和 x=203，左右离屏幕边缘各 46 ✅，等宽。宝箱居中（中心 x=195，点击区 220×220），开箱后奖励浮在宝箱上方（ResultFloat 中心 x=195，y 311–413），和分数之间没有重叠。按钮投影 ActionShadow 只比按钮偏 1–2px（低）。
- 320×568：按钮 128×52，离面板内边缘只有 12px，底部也只留 12px，偏紧（低）。奖励浮标的底部压在箱盖上（已知，可以接受）。夜间面板偏暗，但文字可读。
- 3–4 倍放大边缘（frames/result_edges4x_{day,night}.png）：宝箱描边和按钮圆角平滑，没有明显锯齿 ✅。
- 前后对比：frames/before_after_result.png（旧版 379e137 / 白天开箱前 / 白天开箱后 / 夜间开箱前 / 夜间开箱后）。小屏和 750×1624（375×812@2x）见 frames/result_smallscreen_750_and_buttons.png。

## 4) 人物 mesh 压缩
- 坐姿 4 倍放大对比 7ecd289：frames/cmp_seat4x_{day,night}.png，几乎看不出差别，没有尖刺、碎面或法线异常 ✅。
- 起身、走路（白天视频 t=15.5/16.5/18.5/20.5/22.5/24.5s）3 倍放大：frames/char3x_day_t*.png、char3x_day_standup_walk_sheet.png，没有变形 ✅。
- 户外风吹裙摆 t=31/34/37s（3–4 倍）：frames/char3x_day_wind_t31.png、t34、char4x_day_wind_t37.png，裙摆轮廓平滑 ✅。
- 限制：这个流程里**没有出现「坐下」动画**（回家时直接是坐着的状态），sit_down 没有覆盖到。视频分辨率只有 390 宽，像素级的细小法线问题看不出来，建议真机再看一眼。

## 5) 出门音轨 sfx_exit_outbound.mp3（60,412 B）
- ffprobe 结果：mp3，**24 kb/s，单声道，采样率 22,050 Hz**，时长 20.06s。也就是说「24k」指的是码率，采样率是 22.05k，不是 24 kHz。
- astats：峰值 −2.06 dBFS（最大值 0.789），RMS −29.2 dB，Flat factor 0，样本没有超过 0.99，**没有削波爆音** ✅。
- 频谱：audio/spec_exit_track_src.png，以及录到的白天、夜间音频 spec_rec_{day,night}_exit.png。能量分布：0–2k 是 79 dB，2–6k 是 75 dB，**6–8k 只剩 5 dB，8k 以上基本没有**。可见编码器在约 **5.5–6 kHz 处做了低通**，比 README 写的 8–10k 还低。这会让风声和海声发闷，没有齿音和空气感（中，属于已知问题 1 的加重版，建议回到 32k 或 48k，或者用 44.1k 采样）。另外没有看到明显的编码伪影，比如金属声或预回声条纹。
- 断音：源文件 0–3s 有规律的 0.38–0.39s 静音间隔，这是脚步之间的停顿，属于设计内容。10ms 帧电平最大跳变 +39 dB（t=1.2s），是脚步起音。录音里音轨从开始到结束都是连续的，没有断掉 ✅。
- 风声有没有叠成两层：worldFlowLog 里只有 GameAudio exit-cine 的事件（loaded 15.27 / play 29.40 / cancel:left-exit 55.07），**没有 WindAudio 或 AmbienceAudio 的任何事件**；bgm_main 要等首次手势（55.06s）才开始。录到的音频里，exit 前一直是静音（白天 0–28.8s），exit 后（46.75–54.38s）也是静音，频谱上只有一层音轨。**判断：在 web-mobile 里没有叠成两层** ✅。依据是日志加上静音检测和频谱，没有用耳朵听。微信端的场景风声是否会单独播放，这里测不到。
- 音画对齐：白天音频文件里第一个非静音块在 28.787s，对应日志 exit-cine play 29.396，所以 offset 是 +0.609s（音频时间 + 0.609 = 日志或视频时间）。夜间第一块在 47.843s，对应 play 48.44，offset 是 +0.597s。
