# r4 验收（integration/build05-r4-20261017T122042Z @ 2153a65）

- 交付：team/ggbot/outbox/20261017T122042Z-r4/
  - r4.bundle sha256 877d073a…ca97 ✔，与 SHA256SUMS 一致
  - 盒子侧核对：f3d3614..HEAD 共 47 个提交 ✔
- 规范：不打 TEST-ONLY 补丁；推送保持 DISABLED；桌面包不换
- 每完成一项更新本文件

## 进度
- [x] Mac 构建（05:39–05:55 EDT）
  - 开始前确认没有其他 Creator 在运行
  - 推送：原 pushurl 指向 full.bundle 路径，现已改为 DISABLED，git remote -v 显示 push=DISABLED
  - 叠 r4.bundle 后：HEAD 2153a65 / tree 7b22a1db；相对 f3d3614 共 47 个提交；工作区干净
  - **r4 guard both：一次通过**
    - **wechat-release 19,335,755 B**：比 r3 的 19,294,468 B 多 **41,287 B**（GGbot 估计 ≤约 60 KB，符合）；距门限 24,641,536 B 还有 5,305,781 B ✔
    - 分包：main 1,280,264（+41,182）；region_lakeside 541,965（−370）；resources 446,303（+475）；其余不变
    - web-test 20,122,888 B
    - 产物 SHA256：wechat-release 635 个文件，聚合 ed8452593ab1652693306d3173281a7489c0749c2727d83a404d33643db03e4a；web-test 615 个文件，聚合 a7fcba815684044dcc733a908e5a5eda836a0b00d7e96b730a8735315cb5d102
  - r4 调试 web（debug:true，配置在仓库外）：24,801,583 B，615 个文件，聚合 a4b7088e9d352848808b5296f00737c3d6aa7a031dd43c71770f6fc84b32aba9；代码里有 QF_LAKE_DIAG
  - f3d3614 web-test（用于旅途 A/B）：guard 通过，20,079,413 B（与 r3 当时一致）
  - 故障注入目标：region_lakeside 里路径为 water/lakeside-water 的 Material(29ec51ab…) 和 EffectAsset(391765d0…)，两者都只在 pack import/0e/0e32e8040.json 中，这个 pack 不含其他资源，只拦这一个文件
- [x] Mac 跑测完成（05:58–09:38 EDT；runall4：探测、湖畔日夜、mergeoff、切换帧截取 ×5 屏、草甸日夜、天空之城日夜、切后台 3/10 s、水材质故障注入、A/B、诊断、全流程日夜+宝箱）

## 已出结果（逐项，持续补充）
时间均为 EDT。湖畔进入 = 主页→岛屿日志→湖畔章节→继续；进棋盘后先关掉弹出的面板再测。

### 1. 10 个重标定采样点 —— 白天通过；夜间按色相判，通过
- 参考：Voice Bot r4 的 reference/targets.json（引擎背景镜头 r5h3 调色后目标，360x640@2x 框）。合格线：每通道 ±12，中段条纹 std ≤10
- 图：仅背景层（关闭 Main/导航/UI 相机）360x640@2x → zones/*_vb10.png；数据 zones/vb10.txt
- 白天：**10/10 通过**，最大通道差 +11（bridge_stone_deck R），ΔE76 1.4–7.5；**条纹 std 2.4**（参考 1.8，r3 为 14.4/30.0）
  - 例：far_water 115/131/106 vs 110/128/99；mid_water 88/123/124 vs 84/128/126；near_water_bottom 117/171/153 vs 114/172/153
- 夜间：没有 r5h3 夜间参考，按 REFERENCE.md 用色相判（湖应 B ≥ G > R，深蓝青）。10 个点全部 B ≥ G > R，例 mid_water 11/32/55，near_water_bottom 13/47/76；条纹 std 1.3
- **夜间湖心颜色（r3 ⚠ 复查）：已修**。r3 是橙褐 91/51/43，r4 是深蓝青 11/32/55 ✔
- 棋盘内切换昼夜后再测：白天→夜间、夜间→白天的结果与直接进入一致（10/10；条纹 2.5）

### 5. 湖畔真实 DC —— 通过
- 白天合批开：DC 中位 45，最大 **53**，60 fps；仅背景层 19；360x640 视口 49
- 夜间合批开：中位 44，最大 **52**；仅背景层 18
- 棋盘内白天切夜：最大 53
- `?lakemerge=off`：白天/夜间中位 72，**峰值 80**
- Voice Bot 估算 49→53，实测最大 52–53，符合 ≤60

### 6. 湖首次出现的最差帧 —— 有数据，偏高 ⚠
- 湖在点「继续」后进入 approach 段第一帧时首次出现
- 这一帧耗时（合批开）：白天 140.4 ms、夜间 142.1 ms，其他视口 135.8–153.4 ms
- 合批关：173–178 ms；冷启动第一次跑（probe）219.3 ms
- 之后 bridge 段最差 27–35 ms，arrival 段最差 29–38 ms

### 7. 太阳方向 —— 不通过 ✘（新问题）
- 旅途太阳在 bridge→arrival 段从海岛方向 (0.433,−0.5,−0.75) 渐变到 **(0.418,−0.398,−0.816)**
- 进入 level-loading 的第一帧，太阳突变为棋盘方向 **(−0.418,−0.398,0.816)**：x、z 取反，方位角差 180°
- 切到棋盘那一帧前后太阳不变（都是棋盘方向），所以问题不在切换帧，而在**切换前约 0.78 s 的 level-loading 起始帧**
- 画面上是一帧内的明显光照跳变（截图 swap/lk4_lake_*_cap_sunflip.jpg：前两帧、跳变帧、后一帧、差异 ×3）
  - 白天：c187→c188，px>24 共 120,233 个（占 36.5%），平均亮度 117.6→130.3；女孩、桥、山从背光变为正面受光；「继续旅程/主页」按钮同帧消失
  - 夜间：c191→c192，px>24 共 111,809 个，平均亮度 34.9→43.8；场景从暗夜突然变亮
  - 5 次湖畔跑（日/夜/各视口）都一样
- 棋盘太阳：白天 255/153/82，照度 118750；夜间 92/117/199，51318.75

### 10/11. 切换帧耗时 / 棋盘 UI 首帧 —— 不通过 ✘（标红）
- 棋盘 UI 和背景相机在同一帧出现，这一帧耗时：390x844 白天 29.1 ms、夜间 32.0 ms；带截帧时 36.7–36.9 ms；合批关 35.4–36.8 ms。全部 >16.7 ms，**标红**
- level-loading 起始帧：32.6–41.9 ms
- 首次进入最差帧：见第 6 项（approach 第一帧 135.8–153.4 ms）

### 复查：落地切换帧跳变（390x844、360x780、375x667、390x520）—— 通过
- 两个相机 FOV 相同（57.35）。对切换前一帧和切换帧，比较顶部天空/山区（HUD 以上）的边缘图，求最佳对齐位移：
  - 390x844、360x780、375x667：位移 0,0
  - 390x520：dx=−4 px（约 1%，肉眼看不出）
- 构图连续，r3 的镜头跳已消除
- 切换帧的整屏差异来自同帧出现的棋盘 UI 和新手引导遮罩（RuleGuidePanel），不是背景跳
  - prev→swap px>24：390x844 白天 200,265 / 夜间 192,277；360x780 211,298；375x667 167,944；390x520 80,409
- 条带图：swap/*_cap.jpg

### 12. 落地后没有暂停面板 —— 通过（湖畔、草甸、天空之城日夜）
- **pause panel（r3 复查）：已修**
- 湖畔：落地只弹新手规则面板 RuleGuidePanel（「明白了」），点掉后没有任何弹窗，没有 PausePanel
- 草甸（主线 05）、天空之城（主线 09）日夜：落地只弹道具介绍 ToolIntroPanel（「知道了」），点掉后没有任何弹窗，没有 PausePanel

### 15. 旅途水印 —— 通过
- 旅途中的文字只有一行「开发预览画面，不代表最终效果」；没有「暂停旅程」，没有字幕条
- 截图 *_journey_ui.jpg（待拷到 shots/）

### 8. 天空 —— 通过
- 实际取到的 w：0.600 / 0.808 / 0.953；对应岛屿天穹淡出系数 1.0 / 0.36 / 0
- 6 张图：shots/lk4_lake_{day,night}_sky_w{0.6,0.8,0.95}.jpg，合成图 sky_sheet.jpg
  - w0.6：岛屿天穹（山上方的蓝色穹顶）、海鸥、彩虹路都可见
  - w0.8：天穹半透明，海鸥已消失
  - w0.95：天穹完全消失，只剩湖畔天空和山
- 不跳变：截帧从 arrival 开始，逐帧比较画面上部 45%（px>24）
  - 旅途段最大 593 px（白天 390x844）、31 px（夜间）、528–684 px（其他视口）
  - 远小于真正的跳变帧（level-loading 起始帧约 9 万 px，见第 7 项）
- **天穹（r3 ⚠ 复查）：已修**
- 光照：清屏色白天 28/143/184、夜间 28/39/64
- 离开湖畔后海岛灯光恢复：白天 125000 白光，夜间 180/198/232、43750

### 16. 切后台 3 s / 10 s（湖畔抵达过程中）—— 通过
- 方法：headless 无法真的切标签页，改用覆盖 document.hidden + visibilitychange（游戏收到 EVENT_HIDE/SHOW）
- 音轨对齐：r4 代码里没有 `[sailboat] sting start` 日志（只在测试里出现），所以按音轨第一个非静音块对齐，不用页面加载时间
  - 实时分析器记录的 firstSoundEpoch 比音轨按录音起点推算的时间晚 491 ms（3 s 跑）/ 481 ms（10 s 跑），即 MediaRecorder 起录延迟。已按此校正
- 3 s（隐藏 3005 ms，arrival 段 d≈28）
  - 音频在隐藏后 +86 ms 静音，静音 2970 ms
  - 画面：恢复可见后 +48 ms 旅途距离开始前进；音频恢复比画面恢复晚 **+3 ms** ✔
- 10 s（隐藏 10007 ms）
  - 音频在隐藏后 +113 ms 静音，静音 9930 ms
  - 画面：恢复可见后 +55 ms 前进；音频恢复比画面恢复早 **−19 ms** ✔
- 两次都 ≤50 ms
- 旅途自动恢复 ✔：arrival→lakeside 用时 8.0 s，正常为 5.0 s，多出约 3 s，正是暂停的时长；之后正常进棋盘
- 湖声循环：恢复后约 1 s 淡入（−36→−25 dB），之后电平与隐藏前接近（−24 dB vs −22 dB），没有叠音（不变响），恢复后 6 s 内没有掉音块（无 <−50 dB 块）
- 带声录屏：videos/lk4_lake_day_bg3_with_audio.mp4、lk4_lake_day_bg10_with_audio.mp4（360 宽，按首个非静音块对齐混流）
  - 注意：隐藏期间录屏画面停在最后一帧，不是黑屏

### 2. `?lakediag=1` —— 通过（调试包）
- 正式 web-test 包里，诊断被 DEBUG 宏关掉。所以用 r4 调试 web 包（debug:true，24,801,583 B）+ `?lakediag=1` 跑湖畔
- 只输出一次（整份日志里 `[QF_LAKE_DIAG]` 只有 1 行），原样保存在 diag/QF_LAKE_DIAG_r4dbg.txt，完整控制台日志 diag/lk4_lake_day_diag_worldFlowLog.txt：
```
63.417	log	[QF_LAKE_DIAG] {"isHDR":true,"toneMappingType":0,"pipeline":"WebPipeline","usePostProcess":false,"exposure":0.00002604165625,"aperture":19,"shutter":7,"iso":0,"mainLightIlluminance":118750,"skyIllum":29500,"missing":[]}
```

### 3. 正常运行不出现 [QF_LAKE] —— 不通过 ✘（严格按条目）
- 所有不带参数的湖畔跑（白天、夜间、mergeoff、各视口、A/B）都有 1 行：`info [QF_LAKE] {"event":"journey-water-prewarm","ok":true,"frames":2,"ms":137}`（白天 137 ms，夜间 143 ms）
- 是 info 级，不算 B 类错误；但条目要求「控制台无 [QF_LAKE] 行」
- 另外，切后台时会打出一条 **error 级** `[QF_LAKE] lakeside journey not reached: cancelled`（3 s、10 s 两次都有），使 B 类 +1，但旅途能正常恢复。这是正常用户操作就会触发的 B 类错误

### 4. 故障注入（只拦 water/lakeside-water）—— 不通过 ✘
- 只拦 region_lakeside/import/0e/0e32e8040.json：这个 pack 只含 lakeside-water 的 Material 和 Effect
- 旅途走完并进入棋盘 ✔：level，r04-lake-01，DC 最大 53；水面回退为 r4 之前的导入水
- B 类错误不是恰好 +1（基线 0）：
  - `[QF_LAKE] journey-water-fallback`：1 条 ✔
  - 引擎 assetManager 的 `download failed: assets/region_lakeside/import/0e/0e32e8040.json, status: 0(error)` 5 条（旅途 3、棋盘 2；去重后 1 种）
  - 合计：原始 +6，去重 +2
- 进棋盘时又加载了一次这个 pack，同样失败 4 次，但没有对应的 [QF_LAKE] 提示
- D 类：同一 URL 失败 8 次（ERR_FAILED，注入所致，之后都没有 200）
- 「Failed to load resource」回显 8 条，按口径不计入 B

### 错误五类汇总（不含草甸/天空 mainline 跑和全流程录像跑，这些另记）—— 见 errs_r4.txt
- A pageerror：全部 0 ✔
- B：正常跑全部 0；切后台跑 +1（cancelled，见第 3 项）；故障注入跑见第 4 项
- C：只有 favicon 404（白名单）
- D：只有故障注入跑的 8 条，其他 0
- E：0

### 17. 宝箱 —— 通过
- 主线 01 通关后，在结算界面点宝箱。截图 rec/r4rec_{day,night}_390_result_closed/result_open/chest_return_*.jpg；合成图 chest/chest_{day,night}.jpg（关闭 → 打开 120/250/400/600/900/1300 ms → 打开后 → 切后台 3 s 返回 100/500/1200/2500 ms）
- 打开前：屏幕上只有星星和「630 分」，**没有奖励**（下一关、回小岛按钮除外）✔
- 徽章从箱口升起（录屏 20 fps 逐帧，chest/chest_*_video_80.6-81.8s_20fps.jpg）
  - 夜间清楚看到：盖子刚掀开时，徽章出现在箱口上方，2–3 帧（约 100–150 ms）升到分数下方
  - 白天同样过程，但更快，抽帧时已接近终点
  - 只升一次 ✔
- 切后台 3 s 再返回：100 ms 到 2500 ms 四张图都是静止的终态，徽章没有重播 ✔

### 18. 夜间「出发去看海」玻璃牌实拍 —— 无法完成，需要人工
- 要求真机拍照或真机画面，Mac 上的 headless 截图不符合，需要人拿真机拍
- 参考游戏内截图 rec/r4rec_night_390_home_sign.jpg：玻璃牌能透出后面的石墙，「出发去看海」清晰可读；glassDiag effect=ready，night=1

### 全流程录屏（日、夜，带声）
- videos/lk4_lake_{day,night}_fullflow.mp4：主页 → 岛屿 → 湖畔旅途 → 棋盘 → 切昼夜 → 退出 → 主页 → 岛屿
- videos/r4rec_{day,night}_390_fullflow.mp4：主页玻璃牌 → 岛屿 → 主线 01 通关 → 宝箱 → 切后台 → 回岛 → 草甸旅途 → 主页
- 音轨都按第一个非静音块对齐后混流
- 录像跑的错误：A 0；B 1（`Ignored attempt to cancel a touchstart event with cancelable=false…`，Chrome 对测试注入的触摸的干预提示，日夜各 1）；C 只有 favicon；D 0；E 0

### 草甸 / 天空之城跑法
- 章节「继续」会被「请先继续当前挑战」拦住，所以改用全新存档：SEED=4 走主线 04→05（草甸），SEED=8 走 08→09（经草甸到天空之城），点岛上的主线按钮进入
- 截取切换帧：swap/lk4_{meadow,sky}_{day,night}_ml.jpg

### 9. 女孩切换前后像素 diff —— 不通过 ✘
- 图：swap/girl_boxes_prev_swap_diff.jpg（女孩框：前一帧、切换帧、差异 ×3）；整帧条带图 swap/*_cap.jpg、*_ml.jpg
- 6 组数据，单位 px，阈值 >24：

| 组 | 女孩框 px>24 | 女孩框 px>48 | 整帧 prev→swap px>24 | 说明 |
|---|---|---|---|---|
| 湖畔 白天 | 12,415 / 14,000 | 10,395 | 200,265 / 329,160 | 切换帧女孩被棋盘托盘完全挡住，diff 主要是托盘 |
| 湖畔 夜间 | 10,852 / 14,000 | 9,788 | 192,277 | 同上 |
| 草甸 白天 | **598 / 2,720** | 386 | 222,159 | 女孩位置、姿态连续，只有亮度/边缘差 ✔ |
| 草甸 夜间 | 2,703 / 2,720 | 2,640 | 322,739 | **切换后棋盘背景变成白天**，女孩突然被照亮 ✘ |
| 天空之城 白天 | — | — | 212,302 | 两帧画面里都看不到女孩 |
| 天空之城 夜间 | — | — | 207,850 | 同上；**切换后背景变成白天** ✘ |

- **新问题（夜间）**：草甸和天空之城夜间旅途是夜景，但切到棋盘那一帧，背景变成白天的天空和亮草地；棋盘停稳后也一样（swap/meadow_sky_boards_night_day.jpg）
  - lightBoard 记录的主光已是夜间值 180/198/232、43750，但天空和地面看起来是白天
  - 湖畔夜间没有这个问题
- 背景构图对齐（顶部边缘对齐）：草甸白天、天空之城日夜位移都是 0,0；草甸夜间因昼夜不同无法对齐（相关系数只有 0.11）

### 13. 天空之城园丁 —— 无法目视确认（不判不通过）
- 落地切换帧里，园丁被棋盘托盘完全挡住（swap/girl_gardener_zoom_meadow_sky.jpg 下两行），切换后看不到，无法判断动画是否接续
- 切换前园丁正常播放；位置按已接受处理，不判不通过

### 14. 草甸卡顿复查 —— 仍在 ✘
- 找不到「之前记录的两个卡顿帧」的原始记录（team/cinematic/HANDOFF.md 第 5 条只写了「在 r4 上复查草地卡顿」），所以按 r4 草甸旅途里最长的帧报告
- 草甸 arrival 段有两处固定位置的长帧，日夜、两条路线（主线 05；去天空之城时先经过草甸）都出现：
  - d≈30.2–30.3：白天 50.5 ms；夜间 33.2 ms；天空之城路线经过草甸时 51.8 ms
  - d≈36.2–36.3：白天 67.6 ms；夜间 49.8 ms；天空之城路线 51.5 ms
- 其他长帧：
  - approach 第一帧 65–67 ms（草甸首次出现）
  - 切换帧 36–39 ms
  - bridge 段最长约 34 ms
- 天空之城旅途本身（第二段）帧耗时偏高：
  - 白天 353 帧 >33.4 ms，夜间 202 帧
  - bridge 段大量 ~34–35 ms 帧，即部分时间降到 30 fps
  - 板面 perfBoard 59.8–60 fps，DC 最大 63

### 19. 旅途 A/B（r4 vs f3d3614）—— 通过
- 方法：湖畔白天，QUICK、全新 profile 各 3 次，交替跑：f3d、r4、f3d、r4。第一对是 runall4 里顺序跑的
- rAF 帧时（raf-init，比采样器更可靠）：

| | p50 | p95 | p99 | 最大 | >16.7 ms 帧数 | >33 ms 帧数 |
|---|---|---|---|---|---|---|
| r4 | 16.7 | 18.6 / 17.6 / 17.6 | 18.7 / 17.7 / 17.7 | 133.3（Continue 那一帧） | 164 / 68 / 109 | 2 / 2 / 2 |
| f3d3614 | 16.7 | 17.6 / 17.6 / 17.7 | 18.6 / 17.7 / 17.7 | 132–133.3 | 67 / 86 / 111 | 3 / 3 / 2 |

- 两者都是整体 60 FPS，分布基本一致
- 内存峰值（JS heap）：r4 144.0 / 145.5 / 177.5 MB；f3d 187.7 / 178.1 / 165.2 MB。r4 不高于 f3d
- 棋盘：r4 DC 中位 45、最大 53，f3d 中位 30、最大 38；棋盘 fps 两边都在 52–60 波动（Mac 负载影响，第一次 r4 是 52.4）
- 采样器口径（每帧采样时间戳）噪声较大：r4 47.5–59.4 fps，f3d 53.9–57.2 fps，不作结论依据

### 20. Node 22 跑 suite —— 通过（reward-background-return、legacy-board-ui-pure PASS）；navigation-guard 不通过 ✘
- 命令：`QF_TYPESCRIPT_MODULE=<ts> npx -y node@22 tools/journey-integration/run-suite.cjs`，在 ~/qfl-a3b/repo（2153a65，工作区干净）
- 表头：`HEAD=2153a65… tree=7b22a1db… node=v22.23.3` ✔
- TypeScript 5.9.3：**91/92 PASS**，与盒子上一致。`reward-background-return` PASS，`legacy-board-ui-pure` PASS，唯一非 PASS 是 navigation-guard BLOCKED_BROWSER（runner 不启浏览器）。见 suite/suite_r4_ts59.out、suite_ts59.json
- 先用 Mac 上默认找到的 TypeScript 6.0.3 跑过一次：90/92，多了 `legacy-startup-ready` FAIL（`cocos_port_js_1.default.createSynchronousStorage is not a function`，TS 6 的默认模块互操作不同导致），其余同上。见 suite/suite_r4.out。这是测试环境问题，不算产品问题
- **navigation-guard（单独用浏览器跑）：FAIL**
  - 用 web-r4 在 127.0.0.1:8770 起服务，`node tools/test_world_navigation_guard.cjs`
  - 进主页这步过了，已写出 final-home.png
  - 在等主页「leave」按钮时 30 s 超时：`TimeoutError: page.waitForFunction: Timeout 30000ms exceeded`
  - 参考：r4 主页开场动画要约 35 s 才能离开（lk4 各跑里 leave 都在 36 s 左右）
  - 控制台只有 favicon 404
  - 测试写进仓库的文件已全部还原，git status 干净
