# Build05 旅途修复验收（a373227 → 4c30cf7）
## 进度
- 04:21 开始前检查：Mac 上没有其他 Creator 构建或录屏进程（可用 7.5 GiB）
- 录屏方法修正已写进 rec.cjs 和 audio-init.js：音画对齐改用 sting start 日志或音轨第一个非静音块，并额外记录 AudioContext 开始运行的时刻和第一块有声音的时刻
- Mac 上 --depth 1 拉取 751905c；补丁包（2.0 MB，sha1 63d7a8de）切成 700 KB 一块传过去

## 代码准备（Mac ~/qf-b05-tmp，push=DISABLED）
- base 751905c depth-1 fetch 完成（BASE_OK）；patches.tgz sha1 63d7a8de… 校验一致。
- git am 0001–0003 → tree **0764549ab10e…** ✅（与 a373227 一致；本地 commit 号 6ad0e4f，因 committer 不同）
- git am voice 0001 → tree **8aa76382b41f…** ✅（与 4c30cf7 一致；本地 98a765c）

## 构建（Creator 3.8.8，fix=4c30cf7 等价树 / base=751905c；开构建前无其他 Creator 进程）
- web(fix)、wechat release(fix, debug=false, sourceMaps=false)、web(base) 均 exit 36 成功。
- RegionJourneyLayout.ts.meta：构建日志无相关报错/警告，`git status` 未显示该 .meta 改动 → uuid e13c46d4-… 未被改写 ✅
- 注意：导入后 `env_skycity.glb.meta` 被 Creator 改写（triangleCount: foliage_cards 5790→8790，palette 20028→22686）—voice 补丁换了 glb 但没同步 .meta，合入时建议一起提交该 .meta。
- 微信 release 包体（字节）：region_skycity **7,829,515**；总包 **31,792,659**；主包(总−分包) 1,861,856。
  其它分包：internal 297,535 / resources 433,034 / main 1,114,395 / audio_bgm_island 502,421 / board_art 2,675,272 / region_island 9,474,651 / region_meadow 3,569,608 / static_seat_preview 4,034,372

## 录屏
- 05:07 恢复：上次 day 录屏被中断（raw 只剩空 tmp，删掉重录）；8821(fix)/8822(base) 两个 http.server 仍在跑。rec.cjs 新增 item 24（04→05 + 08→09 + 09 落地）/25（只录 08→09），finalSwap 兼容本分支用 composition.regionFlowTestStatus()。录屏改成 nohup 后台跑。
- 05:40 五段录屏完成并传回（out.tar sha1 fce5a0a6… 一致，7MB 分块）：24 day/night、25 day/night、25 orig day；night 两段 props().night=true（TZ Etc/GMT+10=本地23点）。fix 08→09 travelStart→End=38.32s；base 没有 region-travel 状态标记，时长改从视频测。
- 05:42 Mac 清理：停掉 8821/8822 http.server，删掉 ~/qf-b05-tmp（clone、两个 worktree、构建产物、Creator library 缓存、录屏），Mac 剩余 5.8 GiB（开始时 7.5 GiB，差额不是这个任务占的：任务目录已经全部删掉）。

## 分析（录屏时间 = 视频秒数；"旅途内"= 减去 travelStart）
动作量：逐帧相位相关位移 + 平均帧差（logs/motion_*.json）。全段帧差中位数约 2，突变点见下表。

| 项 | 结果 | 时间点 | 证据 |
|---|---|---|---|
| 角色不被遮挡 | ⚠️ 没发现被几何体挡住；但有两段她**整个人不在画面里** | 08→09 day 94.04–94.92（旅途内 34.6–35.5s），night 94.0–94.9 同样；04→05 day 35.6–38.3（旅途开始头约 2.7s，镜头先往彩虹桥前方飞，人在画面下方以外），night 32.6–35.3 同样 | frames/k_0809_arrive_burst_day.png、k_0809_char_offframe_day_94.4.png、k_0405_36.4-40_day.png |
| 镜头无突然加速/跳变 | ❌ 08→09 落地前快速甩镜头 | day 94.0–95.0：位移 40–70 px/帧，帧差 30–50（中位数的 15–20 倍），night 一样（94.0–95.0，帧差 25–35）；04→05 开头 35.7–36.1 平移 20–34 px/帧（偏快，没有跳切）| sbs/0809_arrival_swing_0.25x.mp4 |
| 08→09 比原版多 ≤3s | ⚠️ 没法和 751905c 比 | 修复版 travelStart→End = **38.32s**（day 59.45→97.77；night 59.30→97.63 = 38.33s）。751905c 点了"下一关"以后直接进 09 棋盘，**根本没有旅途**（不存在 region-travel 状态），所以要求的"原版"对照无效。拿 README 里 Build05 的 35.7s 来比是 +2.62s ≤3s ✅（35.7 是 README 给的数，不是我测的） | sbs/0809_fix_vs_751905c.mp4 |
| 落地镜头不低不近、广场居中 | ❌ | 最后一帧 day 97.6 / night 97.5：镜头低而且贴在她背后，她的身体占了右下约半屏，广场被人和草挡住，看不出居中 | frames/k_0809_final_day_97.6.png、k_0809_final_night_97.5.png |
| 前段浮岛灰色底面压屏 | ❌ 偏重 | day 约 73–84（旅途内 14–25s）：浮岛灰色底面占画面左上 1/3 以上，78s 最明显；night 一样 | frames/k_0809_underside_day_74/78/82.png |
| 平台表面不再大块平涂 | ⚠️ 部分通过 | 86–92 出现草、花、石头细节，比原来好，但 90–92 还有大块平涂的绿色多边形面 | frames/k_0809_ground_day_86/90/92.png |
| 包体 | 已记录 | region_skycity 7,829,515 B；总包 31,792,659 B；主包 1,861,856 B | 见上文构建一节 |

其他：
- night 两段 props().night=true，但旅途里（草地/彩虹桥）天空还是白天的浅蓝，到天空城才变成夜色（24/25 night 全段都这样），建议确认是不是设计如此。
- 98.2–98.5 的大帧差是 09 棋盘 UI 弹出，不算镜头问题。
- 04→05 旅途 27.04s（day 35.55→62.59），night 27.06s。

## 收尾
- Mac 复查：~/qf-b05-tmp 已不存在，没有我开的 http.server/rec/Creator 进程；剩余 6,546,680 KiB ≈ 6.2 GiB。没有 merge，没有 push。
- 已知情况：Mac 上另有 hermes-agent 的 playwright driver（16:46 CST 起，不是我开的），一直没碰它。
