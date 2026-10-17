# Build05 落地 A v2 验收（bc418c5 / tree b30d3794）
## 进度
- 21:48 CST（09:48 ET）开始：Mac 上没有 Creator 进程；剩余 8,823,512 KiB ≈ 8.41 GiB
- 临时目录 ~/qf-la2-tmp；传入 la2.tgz（sha1 44e6fa04…；bundle 751905c..bc90315 + 补丁 0001 + 构建配置 + rec.cjs）
- 代码 ✅：独立 clone ~/qf-la2-tmp/repo，origin push=DISABLED；depth-1 fetch 751905c + bundle → bc90315，git am 0001 → tree **b30d3794612fb1ea3415225a962a06b10ac075e2** ✅（等于 bc418c5）
- 21:56 CST 构建前再次确认：没有 Creator 进程。开始构建（微信 release debug=false sourceMaps=false，然后 web debug 用于录屏）

## 构建 ✅（21:56 CST，微信 release 和 web 都 exit 36 / Finished；构建期间没有其他 Creator 进程）
- 构建后 Mac 剩余 9,118,088 KiB（构建前 8,486,608；中间别的进程在释放空间）
- 两个构建日志里都有一行 `Error: Exit process with code:null, signal:SIGTERM in task build-script`，但脚本已经输出：main/game.js 里有 arrivalBackM:11 和 SeaNightTint，所以新代码确实进了包
- git status：没有 tracked 文件被改写（material .meta、env_skycity.glb.meta 都没被改写）；只多出一个未跟踪的 `assets/scripts/world-r2/SeaNightTint.ts.meta`（commit 里缺这个 .ts 的 meta，Creator 自动生成了 uuid c0440362-…，**需要 GGbot 补提交**）
- builtin-standard 仍只在 shared_effects/import/0f/0f7852dde.json 里有一份
- bgm mp3 和源文件 sha1 一致（main 69130949、meadow 59ab3b0c、skycity 6ab86240）

| 分包 | 字节 | v3 764dcd8 |
|---|---|---|
| main 分包 | 1,120,841 | 1,118,103 |
| internal | 297,535 | 297,535 |
| resources | 433,034 | 433,034 |
| shared_effects | 563,694 | 563,694 |
| audio_bgm_island | 418,907 | 502,421 |
| board_art | 2,112,889 | 2,112,889 |
| region_island | 8,912,266 | 8,912,266 |
| region_meadow | 2,934,382 | 3,007,055 |
| region_skycity | 3,326,944 | 3,372,502 |
| static_seat_preview | 2,556,372 | 3,471,832 |
| 主包（根目录非分包） | 1,861,999 = 1.78 MiB ≤ 4 MiB ✅ | 1,861,999 |
| **总包** | **24,538,863 = 23.40 MiB ≤ 23.5 MiB（24,641,536）✅，余量 102,673 B** | 25,653,330 |

## 录屏（Mac 22:01–22:18 CST）
- web-rec 用 python http.server 8841（pid 42805）提供。全局 Playwright 升级后找不到 headless shell 1234，改用 QF_CHROMIUM_EXECUTABLE=~/Library/Caches/ms-playwright/chromium_headless_shell-1228/…
- 四段都录完（exit 0）：25 day（TZ Etc/GMT+2，night=false）、24 day、25 night（TZ Etc/GMT-9 = 当地 23:14，**night=true**）、24 night。rec.cjs 加了：主页停 11s、结算后点宝箱（Claim-chest ok，弹出 RewardPanel）、到达后调 returnHome（**30s 内没回到 home 状态，backHomeFail**）
- 本轮没有 [sailboat] 日志，音画对齐改用第一个非静音块
- Mac 上已打包 out.tar（sha1 822a5e6d…，13 块 7MB，在 ~/qf-la2-tmp/parts）。**22:20 起 Mac 连不上，CopyToBox 超时，正在重试**
- 第 8 项预检：微信 release 包里搜不到「独立测试进度 / 测试包 / 地区流程测试」，regionFlowTestStatus 返回 null；这些文字只在 web debug 构建里（录屏走测试入口，所以画面上会有）
- 10:38 ET 恢复：Mac 仍是 connected=false，10:38–10:46 ET 期间多次重试都失败。录屏分块还没传回，Mac 上也没清理。**接下来要做**：Mac 恢复连接后，逐块传回 parts/p_aa..p_am，核对 sha1 822a5e6d…；记录删除前剩余空间；删掉 ~/qf-la2-tmp 并 kill 8841（pid 42805）；然后在 box 上分析第 3–7 项，并制作 frames/ 和 sbs/

## 回传与清理（任务已转为最终线 build05-final-mac2，本目录只保留 bc418c5 录屏的镜头证据）
- out.tar 改成 2MB 分块回传，共 44 块，sha1 822a5e6d… 两边一致 ✅，已解到 raw/
- returnHome 实测（rec2，bc418c5，在主线 08 棋盘上）：exitLevel 返回 {ok:true}，但状态变成 **meadow**（关卡的来源地），不是 island；随后 returnHome 返回 {ok:false, reason:'wrong-state'}。原因：returnHome 只接受 island 状态。脚本已改（rec3）：先 exitLevel，如果在 meadow/skycity 就 travelRegion('island')，然后再 returnHome
- 23:52 CST 清理：删除前 5,952,180 KiB → 删除 ~/qf-la2-tmp、kill 8841(pid 42805) 后 6,704,736 KiB；SeaNightTint.ts.meta(c0440362) 随目录一起删除

## 镜头项（bc418c5 录屏；时间=视频秒；旅途+=从 travelStart 算）
- 旅途时长：08→09 day 91.27→133.77（42.5s），night 169.45→223.86（54.4s）；04→05 day 71.26→101.64，night 155.84→195.06
- 落地最后一帧 day 133.6 / night 223.7（frames/final_A2_*.png，cmp_final_v3_vs_A2_day.png）：她全身可见，帽顶到脚约 y 465–610，约 145/812 ≈ 18%；头和胸没有被挡 ✅；中间的棕色岩体比 v3 少很多。广场柱廊在画面横向中间、纵向约 36–49% ✅。**她站在画面最右边（x≈335/375，约 89%）**，身体没有出画
- 04→05：从旅途+1s 起就是身后跟拍，看得清她 ✅（frames/sheet_0405_A2_day_start.png）。旅途+0 那一帧上还盖着宝箱奖励面板，这是脚本没关面板导致的，跟镜头无关
- 平涂纯绿（绿色、15px 窗口内标准差<3 的像素占比，y 90–700）：v3 day 旅途+30/32/34 = 21.7/23.0/16.3% → A2 day = 5.3/13.3/12.0% ✅ 明显减少（logs/ana.json）；旅途+6 有 27.6%（草地彩虹桥段，v3 同位置 28.1%）
- 夜海（蓝色像素均值）：04→05 night 旅途+3…+16：Y 0.20–0.24，色相 219° ✅（v3 0.44–0.56）。08→09 night 旅途+10…+32：Y 0.39–0.52，色相 207–212°，RGB≈(64–87,105–140,152–184)；对比 v3 是 Y 0.43–0.50、色相 199–204°。**色相偏蓝了约 8°，但亮度没降**；旅途+34 以后才变深（Y 0.14–0.23）⚠️
