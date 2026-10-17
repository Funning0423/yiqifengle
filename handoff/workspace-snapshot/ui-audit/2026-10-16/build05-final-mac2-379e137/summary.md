# Build05 最终线 final-mac2 验收（379e137 / tree 36519a4a）
## 进度
- 11:10 ET：zip SHA256 5bcbe498…04c8 ✅；三个补丁 sha256 都对。在 box 上预演：bc418c5 + 0001–0003 → tree 36519a4acab373963ad5b4272456a6eade36edd8 ✅；SeaNightTint.ts.meta uuid 7d49796a ✅
- bgm 静态检查（logs/bgm_loop.txt）：三首都是 40 kbps ✅；skycity 接缝 7.4→0.7 dB，meadow 2.0→1.5 dB，main 2.7 dB，都低于曲内 p99 ✅
- Mac 23:03 CST 连上过一次（剩余 7,100,552 KiB），之后又断。开始了 bc418c5 的 returnHome 实测（rec2.cjs，先 exitLevel 再 returnHome），还没取回结果
- 7MB 分块回传 2 次都在 120s 内无响应
- 11:52 ET：bc418c5 录屏已回传，~/qf-la2-tmp 已清掉（删除前 5,952,180 KiB → 删除后 6,704,736 KiB）。镜头项先用 bc418c5 录屏做，结论见 ../build05-landing-A-v2-bc418c5/summary.md
- 12:05 ET：fin.tgz（sha1 6bec62cb…）以 2MB 分块传到 ~/qf-fin-tmp；run.sh 在后台跑完整流程（clone → 删除自动生成的 meta → am p1–p4 → 核对 tree → 两次构建 → 量包体 → 8851 服务 → 四段录屏，rec3 = 先 exitLevel 再 returnHome）。开始时剩余 6,678,652 KiB
## 代码与构建 ✅（Mac 00:01–00:13 CST）
- 先删掉自动生成的 SeaNightTint.ts.meta，再依次 am：p1 bc418c5 → tree b30d3794；p2 ee012f4 → 83292185；p3 87f9ec2 → e5b4a680；p4 379e137 → **36519a4acab373963ad5b4272456a6eade36edd8 ✅**；push=DISABLED；构建前没有其他 Creator 进程
- 微信 release 和 web 都 exit 36；构建后 git status 为空（没有 .meta 被改写，也没有多出文件）；builtin-standard 只在 shared_effects 里有一份
- 剩余空间：开始 4,704,108 KiB → 构建前 2,492,788 → 构建后 **959,056 KiB（一度不足 1 GiB）** → 录完 3,686,436（中间有别的进程在释放和写入空间）
- 包体：**总包 24,538,863 B = 23.40 MiB ≤ 24,641,536 ✅（余量 102,673 B）**；主包 1,861,999；main 1,120,841 / internal 297,535 / resources 433,034 / shared_effects 563,694 / audio_bgm_island 418,907 / board_art 2,112,889 / region_island 8,912,266 / region_meadow 2,934,382 / region_skycity 3,326,944 / static_seat_preview 2,556,372
- 包内三首 bgm 的 sha1 和补丁源文件一致（main 69130949、meadow 6fcecfeb、skycity cab8c2ce），所以 logs/bgm_loop.txt 的静态结论适用于包内文件
## 录屏 ✅（00:14–00:29 CST，四段都 exit 0，8851 服务）
- **returnHome 实测失败（是游戏逻辑问题，不是脚本问题）**：
  - 04→05 到达后：exitLevel {ok:true} → 状态 meadow；travelRegion('island') 返回 journey-region-unavailable；returnHome 返回 finish-region-journey-first
  - 08→09 到达后：exitLevel {ok:true} → skycity；exitSkycity 返回 return-route-not-yet-available；travelRegion 返回 journey-wrong-origin；returnHome 返回 wrong-state
  - 也就是说，走主线旅途到达新地区后，没有任何接口能回到小岛或主页
- out.tar sha1 56fe1e8a…，57 块 2MB，回传中（已收 27 块）
- 回传完成：57 块，sha1 56fe1e8a… 两边一致 ✅。00:58 CST 清理：删除前 9,971,240 KiB → kill 8851、删除 ~/qf-fin-tmp（clone、构建、Creator 缓存、录屏）后 **10,796,948 KiB（约 10.3 GiB）**

## 验收结果（时间 = 视频秒；旅途+ = 从 travelStart 算起）
录屏：25 day TZ Etc/GMT+4（night=false）、25 night Etc/GMT-7（当地约 23:20，**night=true**）、24 day / 24 night 同上。
旅途区间：08→09 day 130.49→194.15（63.7s）、night 188.69→246.01（57.3s）；04→05 day 112.33→148.93、night 196.58→239.01。Mac 当时磁盘紧张、负载高，所以旅途比 v3 的 38.3s 慢。
音画对齐用第一个非静音块（day 13.86s / night 19.92s）；本轮没有 [sailboat] 日志。

| # | 项 | 结果 | 证据 |
|---|---|---|---|
| 1 | idle 动画 | ✅ 正常 | 主页加载完成后（25 day 10–15s），她所在区域每秒帧差 0.1–1.2，背景是 0.0：有轻微动作，没有冻结、闪烁或消失；frames/sheet_home_idle_fin_day.png、logs/idle.txt。注意：rec 的 home 状态比画面早出现，加载页要到 day ≈10s、night ≈22s 才淡出，所以画面上主页实际只停了约 5–6s，**没达到 ≥10s**（脚本问题，下次要从淡出后再计时） |
| 2 | 夜海不是亮青色 | ✅ | 08→09 night 旅途+37/+43：海和天 RGB(5–7,23–26,77–81)，Y 0.09–0.10，色相 225°；后段 Y 0.19–0.22。v3 同段是 Y 0.43–0.50、色相 198–202°。04→05 night 旅途+3…+16：Y 0.17–0.24，色相 219–221°（v3 0.44–0.56）。旅途+14…+26 测得 Y≈0.47、色相 204°，但看帧确认那是彩虹桥的蓝色条纹，不是海（frames/k_0809_fin_night_t20.png，logs/sea_nopastel.txt） |
| 3 | 08→09 落地最后一帧 | ✅（有提醒） | day 194.0 / night 245.9（frames/final_fin_*.png、cmp_final_v3_vs_fin_day_night.png、cmp_final_night_v3_vs_fin.png）：广场柱廊在画面横向正中、纵向约 36–49%；她全身可见，帽到脚约 145px ≈ 18% 屏高；头和胸没被挡，中间的棕色岩体比 v3 少很多。提醒：她站在画面右侧约 89% 处，离右边缘只有约 30px |
| 4 | 04→05 一开始就跟拍 | ✅ | day 旅途+2s（前 2s 被宝箱奖励面板盖着，是脚本没关面板）之后一直是身后跟拍，她约 70px 高、居中；night 一样（frames/sheet_0405_fin_*_start.png、sbs/0405_start14s_day_v3_vs_fin.mp4）。v3 有约 9s 远景 |
| 5 | 93–95s 没有大片纯绿 | ✅ | 平涂纯绿占比（15px 窗口标准差<3）：v3 day 浮岛段 21.7/23.0/16.3% → fin day 同段（旅途+40…+44）8.9/13.1/11.8%。草地彩虹桥段（旅途+10）仍有约 20%，夜间约 25%（logs/ana.txt）|
| 6 | 总包 ≤23.5 MiB | ✅ | 24,538,863 B，余量 102,673 B |
| 7 | bgm 40 kbps，循环点不卡 | ✅ | 三首都是 40,000 bps；接缝 RMS：skycity 7.4→0.7 dB，meadow 2.0→1.5 dB，main 2.7 dB，都低于曲内 p99；接缝处没有静音。实机音轨（25 day 共 264s，bgm_main 83.5s 至少循环了 2 次）开始之后没有 ≥100ms 的静音（logs/audio_runtime.txt）|
| 8 | 没有测试横幅 | ✅ release / ⚠️ 录屏 | 微信 release 包里搜不到「独立测试进度 / 测试包 / 地区流程测试」，regionFlowTestStatus 返回 null。录屏用的是 web debug 测试入口，所以画面上有这些横幅，这是测试入口自带的 |
| 9 | returnHome 实机成功 | ❌ | 见上方「录屏」一节：到达 05（meadow）或 09（skycity）后，exitLevel 都返回 ok，但 travelRegion('island')、exitSkycity、returnHome 全部被拒（journey-region-unavailable / return-route-not-yet-available / journey-wrong-origin / wrong-state / finish-region-journey-first），60s 内都没回到主页。需要 GGbot 提供到达新地区后回小岛或主页的路径（或者告诉我们正确的调用顺序） |

其他：黑屏只出现在页面刚打开的前 1s（加载前）。25 day 120.2s：暂停面板关掉后、「星光」教程弹窗出现前，棋盘露出了约 0.2s（frames/k_spike_25day_120.2.png），低优先级。

## 结论：**不通过**（只有第 9 项 returnHome 不通过；其余 8 项通过，第 3 项有提醒）
