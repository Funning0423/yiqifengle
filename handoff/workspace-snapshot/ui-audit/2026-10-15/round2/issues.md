# 第二轮验收 · 设计/布局/流程/视频 · 5c54f7a · 2026-10-15

不重复第一轮 10 条。测试横幅已确定去掉，不再报。按钮风格以主页为准，只评立体感和布局。
坐标：CSS px，以 375×812 为基准（截图像素 ×2 = 750×1624）。弹窗设计单位：680 设计宽 ≈ 351 CSS，即 1 设计 px ≈ 0.52 CSS。

## 素材
- raw/：游戏加载图（2.5/4.5/7/10 秒），房间主页（p750 / iphonese / iphone15pro），主页节点坐标 json。
- video/flow-night.mp4、flow-day.mp4：750×1624 整套流程，依次是加载 → 主页停留 12s → 出门 → 岛 →（白天那套先切昼夜）→ 回房间 → 棋盘 → 结算 → 宝箱 → 收下 → 回小岛。marks.json 里是各阶段的时间点。
- 抽帧方式：10fps，相邻帧做像素差分（_work/），全程没有纯黑帧。超过 p99 的突变点和静止超过 2.5 秒的段落都逐个人工看过。
- 说明：视频里第二次“回房间 → 棋盘”是验收脚本的入口（地区流程测试只在房间里），不算产品流程。

## 问题清单

| # | 界面 | 问题 | 严重 | 重新设计方案（尺寸/位置/源码） | 示意图 / 切片 |
|---|---|---|---|---|---|
| R1 | 房间主页 → 出门 | 出门要先“向左轻拖，看看门口”，再点门把手“推开门，开始冒险”，然后是约 24s 不能跳过的走出过场（视频 night 14.9s→38.9s：起身、走到门口、开门、走在草地上、上岛）。每次进出都要再走一遍 | 高 | ①房间底部中央加主页风格的木牌按钮“出门”，CSS 176×56（设计 352×112），中心 x=W/2，y=H−safe.bottom−72；点一下直接开始过场，原来的拖动看门保留为可选玩法。②过场右上角加“跳过 ›”，可点区域 CSS 64×44，位置 x=W−16−64，y=capsule.bottom+12；第二次及以后出门默认缩成 ≤6s（起身 → 开门淡出 → 岛）。源码：`RoomExploreOverlay.ts` L15/L25（prompt/guide），`WorldIntegrationBoot.ts` L477（roomExplore → leaveHome） | mockups/R1-home-exit-before-after.png；video/clip-V2-leave-24s.mp4/.gif |
| R2 | 结算 → 宝箱领取 | 领奖要点 3 次，有 2 个分开的入口：“打开宝箱” → 获得面板 → “收下”，然后还要再点“领取地区道具” → 再收下。结算页的信息层级也有 7 层（星、分、步数、已保存、解锁提示、2 条奖励、2 个按钮），宝箱不是视觉重点 | 高 | 结算页改成三段：①星+分数（分数字号 41→34 CSS）②宝箱主视觉，居中 120×108 + 光晕，下面一个“全部领取”按钮，CSS 220×56，居中③“下一关 / 回小岛”。步数、已保存、解锁合成一行次要文字（14px，brown2）：“6 步 · 剩 22 步 · 已保存 · 主线05已开放”。点“全部领取”后在同一个获得面板里依次展示宝箱和地区道具（两项并排或翻页），只要点一次“收下”。源码：`ui/BoardPanels.ts` openResult L52–87、configureResultLayout L137+，`ui/CommonPanels.ts` RewardPanel | mockups/R2-result-before-after.png；video/clip-V5-result-chest.mp4 |
| R3 | 加载 | 先是 0–2.0s 黑底 Cocos 默认启动页，再是 2.0–3.2s 游戏自己的启动图（标题+插画+波浪进度条+“她在窗前坐下……”），3.2s 硬切到房间（差分 10.6）。游戏启动图只露了约 1.2 秒，提示文字 12px 白字压在米色上，对比度约 1.6:1，看不清 | 中 | ①构建选项关掉 Cocos 默认 splash，让第一帧就是启动图（`tools/web-task21-ui-build-options.json` / 微信构建同理）。②启动图 → 房间做 400ms 交叉淡化，不要硬切。③进度文字改为 15px、#6B4E2E 棕色，放到进度条下方 12px 处；进度条宽度从约 0.36W 加到 0.6W，高 6px | mockups/R3-loading-before-after.png；video/clip-V1-loading-splash-cut.mp4；video/key-night-t1.9/2.0/3.1/3.2.png |
| R4 | 昼夜切换（海岛小憩） | 点“看看夜色 / 迎接晴昼”后，天空、海水、UI 在一帧里全部跳变（视频 day 44.4s→44.5s，差分 17.0，是全片最大的非转场突变），没有过渡 | 中 | 用已有的 night weight（`IslandProps` nightW、`uiNightWeight`）做 0.8s ease-in-out 渐变，天空 / 海水 / UI tint 用同一条曲线；面板关闭动画（约 0.25s）结束后再开始渐变。源码：`ui/IslandPanels.ts` openRest L64 的 toggle 回调、world-r2 dayNight 命令 | mockups/R4-daynight-before-after.png；video/clip-V3-daynight-hardcut.mp4；video/key-day-t44.4/44.5.png |
| R5 | 进岛时 UI 出现方式 | 镜头落定后，UI 分三批蹦出来：38.5s 只有岛；39.0s 底栏（行囊/旅程册/设置）和顶部按钮突然出现；40.0s 木牌“继续旅程”才出现。画面是跳的 | 低 | 镜头稳定后统一延迟 150ms，底栏和木牌一起淡入，0.3s，底栏同时从 y+12 上移到原位。源码：`world-r2/IslandJourneyOverlay.ts` sync()（dock.active 直接置 true，L36 附近）、`IslandProps` 的木牌入场 | video/clip-V4-island-ui-popin.mp4；video/key-night-t38.5/39.0/40.0.png |
| R6 | 设置 → 昼夜分段钮 | “晴昼 / 夜色”两个按钮高 62 设计 px，约 32 CSS，低于 88 设计 px / 44pt 的底线（第一轮 #7 只报了图标大小） | 中 | 视觉高度 62 不变，可点区域扩到 136×88 设计 px（把按钮 node 的 UITransform 设成 88 高，面板跟着调到 Face 居中）。两个按钮中心距 ≥ 148，避免误触。源码：`ui/CommonPanels.ts` L50–51 | mockups/R6-settings-hit-before-after.png |
| R7 | 暂停面板 | 重复元素：面板里已经有“设置”入口，下面又放了一行“音乐 / 音效”开关，和设置面板里的开关重复，面板因此多高出约 120 设计 px | 低 | 去掉音乐/音效那一行（`ui/BoardPanels.ts` openPause L24–25 那一组），“继续”按钮上移到 y=460、“回到小岛”上移到 y=580，面板高度减 120。如果想保留快捷静音，改成一个放在面板标题右侧的 88×88 喇叭图标 | mockups/R7-pause-before-after.png |
| R8 | 房间主页停留 | 主页停 12 秒，其中 5.3–10.0s、10.4–14.8s 画面完全静止（相邻帧差分 < 0.15），角色是 sit_hold 定格，也没有灯光、窗外云、蒸汽这类环境动效，看起来像卡住了 | 低 | 加一个 4–6s 循环的呼吸/翻书 idle，或者让窗外云慢慢漂、茶杯冒蒸汽（房间里已经有烟囱/蒸汽素材）。拖动引导“向左轻拖 ›”每 4s 做一次 8px 的轻推动画 | video/clip-home-idle-10s.mp4 |
| R9 | 进棋盘 | 每次进关先弹出道具教学面板（视频 night 91s），要关掉才能开始；第一轮截图里同一关反复进入也会出现 | 低 | 用本地存储记录已看过（`F.dismissTutorials` 对应的 ToolIntroPanel / RuleGuidePanel），只在第一次获得道具时弹出；之后改成道具栏上一个 2s 的小气泡提示 | （视频 night 91s） |
| K1 | 主页白天 · 已知 | 木牌“继续旅程”的阴影在海水波动时消失。已交 GGbot 修，这里只做记录 | 记录 | — | — |

## 视频检查结论（没有问题的项）
- 两套视频都没有黑屏帧（最低平均亮度 95/255）。
- 每一次点击都有响应：结算的打开宝箱 → 获得面板 → 收下 → 回小岛，各步骤之间间隔 ≤1s。
- 没有发现元素被顶掉或层级错乱。结算星星入场动画和获得面板光晕播放平滑。

## 清理
- Funning 的 Mac 上：`python3 -m http.server 8791` 已停（端口 8791 没有监听）。`cursor-worktree/output/ui-audit-transfer/` 已删除。cursor-worktree 的 git status 里没有残留。
- Mac 上原来就有的 8781 服务器（`~/qf-handoff/.cloud-launch`，不是本次启动的）没有动。

## 文件
- mockups/：R1-home-exit、R2-result、R3-loading、R4-daynight、R6-settings-hit、R7-pause（都是 修改前/修改后 并排图）
- video/：flow-night.mp4、flow-day.mp4 + marks.json；切片 clip-V1…V5、clip-home-idle-10s（mp4+gif）；关键帧 key-*.png；_work/ 里是抽帧拼图
- raw/：加载图 ×12、房间主页 ×3 + 节点/布局 json
- 生成 mockup 的脚本：mk.py、m1–m4.py
