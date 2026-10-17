# Build05 回主页 + 落地 X 补验（2607de6 / tree 9a5e289b）
## 进度
- 13:12 ET（Mac 01:12 CST）开始：剩余 8,871,448 KiB ≈ 8.46 GiB（≥4 GiB ✅）；没有 Creator 进程；~/qf-* 目录只有 qf-handoff
- 补丁 sha256 和 SHA256SUMS 一致。box 预演：bc418c5 + ee012f4 + 87f9ec2 + 379e137 + 2607de6 → tree **9a5e289be2101f9f78351a3c11c63e91f5bb7d0e ✅**
- 新增按钮是 controls key 'home'，放在 navigation.back 位置，显示条件是 meadow 或旅途 skycity
- 录屏脚本 rec4：到达后 exitLevel → 等 2.5s → 记录按钮矩形并截图 → await returnHome（30s 超时）→ 等待 home 状态 → 停 10s → 截图；不调用 travelRegion 和 exitSkycity
- 13:20 ET：h.tgz（sha1 63a55c29…）以 2MB 分块传到 Mac 的 ~/qf-h-tmp，run.sh 已在后台启动（clone → am → 核对 tree → 构建 → 量包体 → 删除 library 缓存 → 8861 服务 → 四段录屏）
## 代码与构建 ✅（Mac 01:17–01:27 CST）
- 依次 am p1–p5：b30d3794 → 83292185 → e5b4a680 → 36519a4a → **9a5e289be2101f9f78351a3c11c63e91f5bb7d0e ✅**；push=DISABLED；构建前没有其他 Creator 进程
- 微信 release 和 web 都 exit 36。剩余：开始 9,649,732 KiB → 构建前 9,317,740 → 构建后 9,139,132 → 删除 library 后 9,243,820
- **总包 24,539,994 B = 23.40 MiB ≤ 24,641,536 ✅（余量 101,542 B）**；主包 1,861,999；main 1,121,972（+1,131）；其余分包和 379e137 相同
## 录屏中（day 两段已完成）
- 04→05 day：exitLevel {ok:true} → meadow ✅；returnHome 30s 内没返回（30s 时状态是 walking-to-seat），约 48s 后状态变成 home
- 08→09 day：exitLevel {ok:true} → skycity ✅；returnHome 同样 30s 超时（walking-to-seat），约 48s 后变成 home
- 准备了 rec5（把超时改成 90s），四段录完后补跑一次，拿到 returnHome 的实际返回值和用时
- 回传完成：57 块 2MB，sha1 db9422e3… 两边一致 ✅；release 包里搜不到测试横幅字符串（run.log 没有 STR 行）✅；git status 为空 ✅

## 验收结果（录屏 01:28–01:37 CST；day 用 Etc/GMT+5，night 用 Etc/GMT-6，night=true）
| # | 项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 回主页 | ❌ | 四段录屏 exitLevel 都返回 {ok:true}，到达 05 后状态是 meadow，到达 09 后是 skycity ✅；全程没有调用 travelRegion 和 exitSkycity。**但 await returnHome() 在 30s 内都没有返回**：day 两段 30s 时状态是 walking-to-seat，约 44–48s 后才变成 home（24 day 163.8s、25 day 204.3s）。night 两段 30s 时是 walking-home，60s 时还是 crossing-in，没到 home。补跑一次 24 night，超时放宽到 90s：90s 时仍没返回（walking-to-seat），127s 时状态是 sitting，仍不是 home。可以确认的是：returnHome 确实能把她从旅途地区送回屋里（day 画面回到主页，homeAfter 截图在 raw/），但走回家的动画太长，录屏时 Mac 负载高，旅途也比基准慢约 1.5 倍；promise 在 30s 内不返回，没满足「30s 内返回 {ok:true} 且状态 home」。建议：旅途地区点「主页」后直接淡出到主页（不走回家），或者先返回 {ok:true} 再播放回家动画 |
| 2 | UI「主页」按钮 | ✅ 可以接受，有 1 个中等问题 | 见下方 |
| 3 | 落地最后一帧 | ✅ | day 142.05 / night 224.55（frames/final_25_h_*.png、cmp_final_379e137_vs_2607de6_day_night.png）：她的中心约在 76–80% 宽度处（黄裙像素中心 298/374 = 79.8%，目测约 76%），上轮 89.9%；全身可见，头和胸没被挡；广场柱廊左右居中 |
| 4 | 总包 / 横幅 | ✅ | 24,539,994 B ≤ 24,641,536（余量 101,542 B）；release 包里搜不到「独立测试进度 / 测试包 / 地区流程测试」 |

### 第 2 项：主页按钮 UI（frames/annot_regionUI_*.png，青框 = 继续旅程，黄框 = 主页，红框 = 底部安全区）
- 位置：继续旅程 x62.5 y620 250×52；主页 x67.5 y714 240×48（单位 pt，视口 375×812）。两者间距 42pt；主页底边离屏幕底 50pt，比 iPhone 底部安全区 34pt 多 16pt，没有越界或贴边 ✅
- 3D 立体感：主页按钮和继续旅程是同一套绿色板加深色底边，有立体感 ✅；比继续旅程窄 10pt、矮 4pt，也没有麦穗装饰，作为次级按钮层级清楚 ✅
- 点击区：48pt ≥ 44pt，两个按钮不重叠 ✅
- 夜间：白字配深绿板，在夜色草甸和天空城上都清楚可读 ✅
- 问题 ①（中，草甸 day/night）：继续旅程按钮压在她腰和腿上（y620–672，她的脚在 y≈690）。改法：到达草甸后镜头把她往上抬约 60pt（让她的脚在 y≤600），或者把两个按钮整体下移，紧贴安全区排在底部
- 问题 ②（低）：两个按钮宽度不一样（250 / 240），左边缘错开 5pt，看起来不齐。改法：主页按钮也用 250 宽，或者左右都对齐到 x=62.5

## 测试包（379e137，tree 36519a4a，本地 HEAD 52810f43）— ~/Desktop/QIFENGLE-test-build05/
- wechat/ 24,539,070 B；appid 改为项目规定的 wx3bdd911c5c06f591（touristappid 被 DevTools 拒：「不存在此 AppID」code 10）。DevTools 2.02.2608080 已登录，cli open 成功，模拟器进入主页（testpkg/devtools_home.png）。模拟器内打关未自动化（需操作用户桌面 GUI）。DevTools 已 cli quit。
- web/ 25,212,203 B；start.command 实测 8790 返回 200 并调用 open。headless 实测：主页 ~10s，leave→小岛，触摸点「继续旅程」进第一关「露珠问候」，11 步通关 3 星 630 分，status won / result.saved（testpkg/web_*.png）。
- 清理：前 7,890,392 KiB 可用 → 后 8,383,196 KiB；8899 服务已停，~/qf-h-tmp 已删，DevTools 已退出，无 Creator 进程。box /tmp/wtH 已移除。
