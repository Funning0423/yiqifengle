# 界面验收 · yiqifengle `mac/task21-web-ui` @ 5c54f7a · 2026-10-15

## 跑法与覆盖
- 代码：box 上 clone 并 checkout 5c54f7a（`/workspace/wechat-game/yiqifengle`）。web-task21-ui 要用 Cocos Creator 3.8.8（Mac 版）构建，Linux box 构建不了。所以用的是 Mac 上 `cursor-worktree`（HEAD = 5c54f7a，源码无改动，只有 evidence 截图有改动）现成的 `creator-build-project/build/web-task21-ui`。这份构建产物的时间晚于该 commit。
- box 上的 Chromium 进入岛屿 3D 场景时会稳定崩溃（SEGV/内存不足：box 被其他 agent 的 Cocos/Blender 占了 13/15 GB），所以截图在 Funning 的 Mac 上用无头 Chrome for Testing 跑，脚本是 `output/ui-audit-transfer/audit_capture_mac.cjs`。加载页在 box 上截。
- 机型（CSS px，DPR 2）：p750 = 375×812（输出 750×1624）、iphone15pro 393×852、iphonese 375×667、android360 360×800、android412 412×915。安全区通过 CSS 变量 `--safe-top/--safe-bottom` 注入（44/34、59/34、20/0、24/0、28/16）。注意：`ManagedMobileBoardUI.safeInsets` 在竖屏时最少取 top 47、bottom 34，并模拟一个胶囊，所以各机型的棋盘布局实际上都是按这个下限算的。
- 进入各界面的方法：`__worldIntegration.leave()` → 岛屿；点小屋 → 海岛小憩（昼夜切换）；Island-bag / settings / journal；“地区流程测试 → 04 最后一步”进入棋盘 → 暂停 → 最后一次交换 → 结算 → Claim-chest → 获得面板 → 回小岛 → 旅程册 → 天空回声 → 前往天空城。
- 昼夜：默认模式跟着本地时间走（Mac 当时是夜间），所以默认那轮是 night，点小屋切换后那轮是 day。文件名已按实际模式标注。
- 没截到：房间主页（box 崩溃，Mac 那轮直接走了 leave）、游戏自己的 startup-art 加载阶段（只截到 Cocos 默认启动页）。
- 验收基准：按钮风格以现在主页（岛屿底部 行囊/旅程册/设置 和木牌“继续旅程”）为准，只评价立体感和布局，不建议换风格。

## 问题清单（坐标都是 CSS px，以 375×812 为准；乘 2 = 截图像素）

| # | 界面 | 位置 | 严重 | 问题 | 改法 |
|---|---|---|---|---|---|
| 1 | 结算 ResultPanel | `chest_closed` 72×65 @ (32,458)，所在行 `Claim-chest` 335×96 @ (20,443) | 高 | 宝箱被挤在奖励行最左边的 96px 图标栏里，“打开宝箱”文字居中在 124–347，宝箱不显眼，也不居中 | `ui/BoardPanels.ts` L145 `rewardIconLane=96`、L346/L363/L370 的行布局：宝箱奖励（iconKind==='chest'）单独排成主视觉块，宝箱图标水平居中（x = 面板中心），尺寸 ≥120×108，下面加一个居中的 220×56 按钮“打开宝箱”，图标后面可以复用 RewardPanel 的 `fx_rays` 光晕（缩到 180×180）。地区道具保留为次级的一行，放在宝箱下面 |
| 2 | 结算 | 奖励行 x 20–355，面板 x 12–363；底部按钮 y 645–693，面板底 701 | 高 | 内容左右只留 8px 内边距，压住了木框描边（描边视觉宽约 14px）；底部按钮离面板下沿也只有 8px | L221 和 L251 的 `inner = w - 16` 改成 `w - 48`（左右各留 24）；按钮行到面板底至少留 20px（布局策略 L241 的高度 +12，或者按钮 y 上移 12） |
| 3 | 结算 · iPhone SE（375×667） | PopupPanel 顶在 y95，标题牌 `TitlePlank` @ (125,96) | 高 | 标题“过关啦”和翻页 ‹ › 1/2 被测试横幅（y95–135）盖住；“领取地区道具”被分到第 2 页，玩家看不到 | 紧凑视口（`compactViewport`，L251）下：星星行从 155×57 缩到 120×44，分数字号 41→32，去掉“成绩已保存”这一行，让两条奖励一页放下；面板顶部至少放在 `capsule.bottom + 12`（模拟值约 y95），测试横幅另见 #4 |
| 4 | 棋盘 / 结算 / 暂停（测试包） | `LabelPlate` 351×40 @ (12,95)，会挡住 `InfoPlate` 224×67 @ (71,95) | 中 | 测试横幅“独立测试进度…”整个压在关卡信息牌上半部分（关卡名、目标），看不到标题。只影响测试包，但验收时 HUD 看不全 | `WorldIntegrationBoot.ts` L490 `label()` / L589 `flowTestMark`：棋盘状态下把横幅挪到屏幕底部安全区上方（y = H − safe.bottom − 48），或者高度缩到 24、放到 InfoPlate 上沿以上（y ≤ 60 并避开胶囊） |
| 5 | 岛屿 | 木牌“继续旅程”右缘 ≈ x349（360 宽机型）/ ≈ x360（375 宽机型） | 低 | 右侧只剩 11–15px，贴近屏幕边，晃动/入场动画时有出屏风险 | `world-r2/IslandPropsLayout.ts` L249 `signpostRectUi`，按投影出来的 rect 加一个约束：right ≤ width − 24，不满足就把木牌世界坐标往左挪，或者让镜头 x 偏移 |
| 6 | 结算 · 360 宽 | `ResultUnlockHint` 320×22 @ (20,395) | 中 | “主线 05 与潮汐挑战已开放；前往风车草甸”折行，第二行只剩一个“旬”字 | 文案缩短成“主线05、潮汐挑战已开放”，或者 wrap（L187）改成均衡折行（两行字数差 ≤ 2）；最低字号保持 16 |
| 7 | 设置 SettingsPanel | 昼夜分段钮“晴昼/夜色” @ (194–340, 376–412) | 中 | 图标小、文字大：`iconScale 0.5` 让图标只有约 15px，而文字是 24 设计 px；右边“夜色”钮贴着木框内沿 | `ui/CommonPanels.ts` L50–51：`iconScale` 0.5→0.72（约 22px），两个按钮 x 从 80/222 改成 64/204，宽 136 不变，右侧和木框留 ≥ 24 设计 px。风格和主页按钮保持一致 |
| 8 | 棋盘道具栏 | `slot-0` 64×64 @ (156,666)；托盘下沿约 y560 | 低 | 只有 1 个道具时孤零零在底部，离棋盘约 100px，视觉上和棋盘没关系 | `ui/BoardLayout.ts` L24 `toolsY`：竖屏时取 `min(height − safe.bottom − toolsAboveSafe, trayY + trayH/2 + 56)`，让道具栏贴着托盘下方 |
| 9 | 结算底部按钮 | Next/Home 164×48 @ y645 | 低 | 和主页按钮同一套风格，但 `layoutButton` 把底板缩到 0.45（L165 `artScale`），厚度/投影变薄，立体感比主页按钮弱 | 不换风格：按钮高 48→56，`artScale` 0.45→0.6，保证底部投影厚度 ≥ 4px，和主页 行囊/旅程册 按钮的厚度一致 |
| 10 | 加载页 | 屏幕中心 | 低 | 是 Cocos 默认启动页（debug 构建），“Created with Cocos” 小字叠在 LOGO 文字上 | 正式包在构建选项里关掉默认 splash 或换成游戏自己的启动图（`startup-art`）；微信包不受影响也要确认一下 |

## 其他观察（无需改）
- 获得面板（宝箱开启后）在各机型都居中，3D 宝箱 138×138 居中，没问题。
- 暂停面板、行囊、旅程册、天空回声章节、天空城在 5 个机型 × 昼夜下都没有越界；天空城“返回小岛”按钮离底部安全区足够远。
- 夜间各面板经过 NightTint 后可读性正常。

## 产出
- raw/：130 个文件（5 机型 × 昼夜 × 11 屏 + 加载页 + 夜间小憩面板 + 每轮的节点坐标 log.json）
- annotated/：31 张标注图（结算、棋盘、岛屿、设置、加载页、天空城、获得面板、行囊、iPhone 15 Pro）
- 脚本：audit_capture.cjs / audit_capture_mac.cjs / audit_loading.cjs / annotate.py / annotate_extra.py
