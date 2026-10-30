# 系统界面设计稿：健康游戏忠告 / 设置 / 版本更新（v1）
UI设计部 · 2026-10-29 · 分支 `ui/system-panels`，基于 `ggbot/full9c-final` 19bd812a（目前最新的 ggbot 候选链；没有改游戏代码）
基准尺寸 390×844 pt，单位都是 pt。全部参数在 `src/params.json`，图片由 `src/build.py` 和 `src/annot.py` 生成。

## 0. 为什么这么简洁
- **每屏只有一个焦点**：忠告页的焦点是四行原文；设置面板的焦点是一列开关；更新弹窗的焦点是「重启更新」按钮。其他元素都退成背景或细字。
- **不单调的办法是光和材质，不是加元素**：忠告页用暖色竖向渐变、顶部柔光，底部两层低多边形远山，呼应游戏的低多边形世界。面板沿用主页 3D 暖木框：5pt 厚底、投影、奶油面和顶部高光。更新弹窗只放一枚低多边形四叶风车，配一团暖光，跟「起风了」的题目对上。
- **控件只用一种**：设置里原来有滑杆、开关和两段式按钮三种控件，现在统一成开关。用户只需要学一种操作，画面也更整齐。
- 文字压到最少：更新弹窗是一句标题加一句说明；忠告页只有法定原文，外加占位的信息标识。

## 1. 健康游戏忠告页（合规 C1 / Blocker）
### 1.1 文案（已核对）
标题「健康游戏忠告」，正文四句，**一字不改**：
> 抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。

- 出处：新闻出版总署《关于在游戏出版物中登载〈健康游戏忠告〉的通知》（新出音〔2003〕861号）。要求是「游戏开始前……在画面的显著位置全文登载」。
- 核对来源：维基文库通知全文 https://zh.wikisource.org/wiki/关于在游戏出版物中登载《健康游戏忠告》的通知 、央视转载 https://www.cctv.com/health/20030924/100690.shtml 、中新网 https://www.chinanews.com.cn/n/2003-09-24/26/350056.html ，三处一致。
- 仓库现状：`git grep 健康游戏` 没有找到文案或资源，FEATURE_GAP 第 2 项也标为 ❌。
- **信息标识（著作权人、出版单位、批准文号、出版物号）全部是【占位】**，需要 Funning 提供。规则：没有版号时这一块**整块不显示**，不要显示「占位」二字；有版号时按标注位置显示。

### 1.2 版式（见 `annot_advisory_390.png`）
| 元素 | 规格 |
|---|---|
| 背景 | 竖向渐变 #FBF4E4→#F2E1C0；顶部 30% 处有暖光 #FFF6DA（半径 0.9W，模糊 70）；底部两层低多边形远山 #E8D2A6、#E1C797（面片）、#DCC08E，占屏高约 22% |
| 标题 | Noto Serif SC Bold 22pt，字距 6，#5A3A1E，中心 y=300（按屏高比例：0.355H） |
| 分隔线 | 64×1.5pt #D9BF8C，中间 Ø6 圆点 #C39A5E，在标题中心下方 24pt |
| 正文 | Noto Serif SC Regular 17pt，字距 2，行距 40pt，#6B4A2E，四行居中，首行在标题下 72pt。对比度 7.3:1 |
| 信息标识 | Regular 11pt，行距 17，#6B4A2E（压在远山 #DCC08E 上为 4.5:1），首行距底 104pt |
| 跳过提示 | 「轻点继续」Regular 12pt #6B4A2E α0.8，距底 56pt，1.5 s 后用 300 ms 淡入 |

字体：项目里的 `QFLRegionTitle.ttf` 只是地名子集。建议 GGbot 用 Noto Serif SC（OFL）给这 40 来个字另外做一个子集 `font/QFLAdvisory.ttf`，Bold 和 Regular 各一份，同时把授权写进 LICENSES。

### 1.3 时序（冷启动每次都显示，参照常见小游戏做法）
| 阶段 | 时长 | 曲线 |
|---|---|---|
| 淡入，文字上浮 6pt | 400 ms | easeOutCubic |
| 停留 | 到 2.7 s | — |
| 淡出 | 300 ms（比进入短） | easeInQuad |
| 总计 | **3.0 s**，然后交给主页 | |
- **前 1.5 s 不能跳过**，保证显著展示。1.5 s 后点屏幕任意位置会立即开始 300 ms 淡出，触摸按下后 1 帧内开始变化（U3）。
- **和加载并行**：最好画在 `build-templates/wechatgame/first-screen.js` 的首屏 canvas 上，这样引擎加载期间就能显示，不额外增加启动时间（P5）。如果 3.0 s 到了引擎还没就绪，就停在最后一帧，不显示 loading。
- 「减少动态」开着时：不上浮，只淡入淡出。
- 关键帧 `keyframes_advisory.png`（0 / 150 / 400 / 1600 / 2700 / 2850 / 3000 ms）。

## 2. 设置面板
### 2.1 结构（见 `annot_settings_390.png`）
音乐 · 音效 · 震动 ┆ 虚线 ┆ 夜色 · 减少动态 ┆ 关于 · 版本

- **新增「震动」**。音乐由滑杆改成开关；「昼夜」两段式按钮改成「夜色」开关，因为切换昼夜只有这一个入口，必须保留。「减少动态」保留，它对应无障碍 X1。
- 面板 320×404，r26。左右边距 35pt；窄屏取 `w=min(320, W−40)`，320 宽时为 280。垂直居中偏上 8pt。
- 材质沿用 PopupKit 木框：框 #D9BF8C，底厚 5pt #B8966A，内描边 #E9D6AE，面 #F8EDD3。投影 #281A0E α35%，下移 10、模糊 14。顶部 30% 有高光 #FFFCF0 α18%。
- 标题「设置」Bold 22pt，字距 6，#5A3A1E，y=+38。这次不再加单独的标题木牌，以减少层级。
- 行：高 54；图标 30pt，在 x+46；文字 Bold 18pt #5A3A1E，在 x+74；开关右缘距面板 28pt。**整行都是触控区**（280×54），点文字也能切换。两组之间距离 14pt，中间是 1.5pt 虚线 #D9BF8C（6/6）。
- 关闭按钮：Ø34 奶油圆，底厚 2.5pt #624B32，× 线宽 2.6 #5A3A1E；触控区 44×44；圆心离框角 24pt。点遮罩也会关闭。
- 底行「关于《咦，起风了》 · v0.1 ›」Regular 13pt #7A5A3A（4.5:1 以上），整行 44pt 可点，进入现有 openAbout。
- 图标：音乐、音效、夜色（icon_moon）、减少动态沿用 `board_art/popup/*`。**震动图标是占位**（设计稿里是手绘的手机加波纹），需要美术按 icon_sfx 的风格补一张 `popup/icon_vibrate.png`。

### 2.2 开关（`toggle_states.png`）
| 状态 | 轨道 52×30 r15 | 旋钮 Ø24 |
|---|---|---|
| 关 | 面 #DCCBA8，下沿 2pt #CDB990 | 左，#FFF8E6，下沿 #E7D3AC，投影 α43% 模糊 1.6 |
| 开 | 面 #377F6C（主按钮青绿），下沿 #24443C | 右 |
| 按下（开或关） | 轨道压暗 8% | 横向拉宽到 30（往将去的方向挤），所在行底色变成 #E9D6AE α60% |
| 切换 | 旋钮位移和轨道颜色一起插值 **180 ms，easeOutCubic** | |
- 按下态在 touchstart 的当帧出现（≤1 帧，满足 U3 的 100 ms）。抬手时提交状态，同时播 `button` 音效（音效关闭时不播）。打开「震动」那一刻额外调一次 `vibrateShort({type:'light'})`，作为预览。

### 2.3 对接点（代码现状，19bd812a）
| 功能 | 现有 API / 存储键 | 位置 | 建议 |
|---|---|---|---|
| 音乐 | `GameAudio.setMusicVolume(v)` / `getMusicVolume()`；键 `qfl.audio.musicVolume` | audio/GameAudio.ts:723、97 | 开关关时设为 0，并把原值存到新键 **`qfl.audio.musicLast`**；开时恢复，没有记录则用 0.4。暂停面板 BoardPanels.ts:26 已经这样做，但用的是内存变量 `lastMusic`，改成存这个键。不要用 `setMuted`（:507），它会同时停掉音效 |
| 音效 | `setSfxMuted(m)` / `isSfxMuted()`；键 `qfl.audio.sfxMuted` | GameAudio.ts:515、98；播放入口 `play()` :419 | 不变 |
| 全局静音 | `setMuted`；键 `qfl.audio.muted` | :507、99 | 设置里不露出，保持现状 |
| 震动 | **目前没有开关**；唯一的调用是 `wx.vibrateShort({type:'light'})` | ui/BoardPanels.ts:116（开宝箱） | 新键 **`qfl.ui.vibrate`**（'1'/'0'，默认 '1'）。在 `ui/UiPrefs.ts` 加 `vibrateEnabled()` 和 `vibrate(type='light')`，所有震动都走它：关闭时直接 return，**不调用 wx.vibrateShort**。BoardPanels.ts:116 改成用它。以后新增震动（消除、过关等）也只能走它 |
| 夜色 | `globalThis.__worldDayNight.snapshot()/toggle()` | world-r1/WorldFlowComponent.ts:514；ui/CommonPanels.ts:30 | 开关 on=night。`__worldDayNight` 不存在时把开关置灰（α0.45，不可点） |
| 减少动态 | `reducedMotion()` / `setReducedMotion()`；键 `forest-v33-reduced-motion` | ui/UiPrefs.ts:6 | 不变 |
| 面板入口 | `openSettings(stack)` | ui/CommonPanels.ts:41；被 IslandJourneyOverlay.ts:84 和 ManagedMobileBoardUI.ts:971 调用 | 原地改布局。暂停面板 BoardPanels.ts:26–31 里的音乐、音效开关改用同一个开关组件；那里暂时不加震动，以免暂停面板变挤 |

## 3. 版本更新弹窗
- **触发**：`wx.getUpdateManager()` 的 `onUpdateReady` 先只记一个标记 `pendingUpdate`，**不立刻弹窗**，等到安全时机再弹：回到小岛主页且没有其他弹窗、不在棋盘中、不在转场或演出中。如果冷启动时就已经就绪，在忠告页结束、进入主页后的第 600 ms 弹出。`onUpdateFailed` 静默处理，只写日志。
- **按钮（我拍板）**：主按钮「重启更新」调用 `applyUpdate()`；次按钮只用一行细字「稍后」，不做第二个 3D 按钮，焦点只留一个。点「稍后」后，下次回到主页再提示一次，**每个会话最多提示 2 次**；之后不再打扰，下次冷启动微信会自动用上新版本。不提供强制更新模式（目前不需要）。
- 版式（`annot_update_390.png`）：卡片 300×300，材质同设置面板，没有关闭 ×，点遮罩不关闭（避免误触后消失）。
  - 风车 R28：叶色 #E88034、#377F6C、#F2B544、#C9773A，中心 Ø8 #FFF0CB；后面有暖光 #FFDC8C α59%，R46 模糊 12。打开后风车缓慢转动，0.5 圈/秒（「减少动态」开着时不转）。
  - 标题「新版本已准备好」Bold 20pt #5A3A1E，y=+134；说明「重启后即可体验新版本。」Regular 15pt #6B4A2E，y=+170。
  - 主按钮 WarmButton primary 220×52：cap #377F6C，side #2E6A5A，base #24443C，文字 Bold 18pt #FFF0CB，y=+226。
  - 「稍后」Regular 14pt #7A5A3A，y=+272，触控区 120×44。
- 状态图 `update_states.png`：按下时面下沉 3pt、投影变浅，touchstart 当帧出现；抬手 120 ms easeOutBack(1.4) 回弹后再执行 applyUpdate。

## 4. 动效统一规范（U1–U3）
| 动作 | 时长 | 曲线 |
|---|---|---|
| 弹窗进入：缩放 0.92→1，遮罩 0→α0.35 #101C22 | **320 ms**；透明度在前 190 ms 内到 1 | cubic-bezier(0.05, 0.7, 0.1, 1.0)（M3 emphasized decelerate） |
| 弹窗退出：缩放 1→0.96，透明度 →0 | **180 ms** | cubic-bezier(0.3, 0.0, 0.8, 0.15)（M3 emphasized accelerate） |
| 按下 | 0 ms（当帧）：缩放 0.96，下沉 3pt | — |
| 抬手回弹 | 120 ms | easeOutBack(1.4) |
| 开关滑动 | 180 ms | easeOutCubic |
| 忠告页 | 进 400 / 出 300 ms | easeOutCubic / easeInQuad |
- **注意**：现在 `PopupKit.ts:13–14` 是 `OPEN_S=0.22`、`CLOSE_S=0.15`，进入的 220 ms 低于验收要求的 250–400 ms，而且缩放用 easeOutCubic，退出用 alpha 线性。建议改成 `OPEN_S=0.32`、`CLOSE_S=0.18`，用上面两条贝塞尔曲线，透明度也用同一组曲线。这会影响所有弹窗，属于全局改动，GGbot 实现时一并改，界面验收部做一次全弹窗回归。
- 「减少动态」开着时：不缩放、不上浮，只淡入淡出，时长不变。
- 关键帧 `keyframes_settings.png`、`keyframes_update.png`；动效演示 `system_panels_anim.mp4`（390×844，30 fps，约 9 s：忠告页 → 设置进入 → 震动关闭 → 退出 → 更新弹窗进入 → 按下 → 退出）。

## 5. 七种尺寸（`sizes_7_*.png`）
320×568、360×780、375×667、390×844、402×874、414×896、430×932。
- 面板和卡片宽度 `min(设计宽, W−40)`，在 320 宽下左右边距 20pt，不会贴边；高度固定，320×568 上设置面板上下各留约 80pt。
- 忠告页正文行宽约 252pt，320 宽下左右各剩 34pt。标题位置按 0.355H 计算，远山按比例。
- 平板、PC 窗口（W>500）：面板不放大，宽度最大到设计宽；忠告页文字块最大缩放 1.2。

## 6. 文件
| 文件 | 内容 |
|---|---|
| `advisory_390.png` / `settings_390.png` / `update_390.png` | 390×844 全屏效果（@2x）。设置和更新的底图是真机流程截图 b17r12 i2_day_02_island，只用于示意 |
| `compare_advisory.png` / `compare_settings.png` / `compare_update.png` | 前后对比。设置面板的「现状」是 10-15 的截图，当时测试包带测试横幅，新稿里没有 |
| `annot_advisory_390.png` / `annot_settings_390.png` / `annot_update_390.png` | 标注图（即任务里的 annot_390，每个界面一张） |
| `sizes_7_advisory.png` / `sizes_7_settings.png` / `sizes_7_update.png` | 7 尺寸拼图（即 sizes_7，每个界面一张） |
| `toggle_states.png`、`settings_states.png`、`update_states.png` | 开关各状态、面板混合状态和按下态、更新按钮按下态 |
| `keyframes_*.png`、`system_panels_anim.mp4` | 动效 |
| `src/` | render.py、build.py、annot.py、params.json，以及从 board_art 复制来的图标 |

## 7. 不确定项
1. 版号和信息标识：内容需要 Funning 提供；纯广告游戏是否必须显示，以资质审核为准（FEATURE_GAP 第 5 项）。
2. 震动图标需要美术补正式图（现为占位）。
3. 忠告页「每次冷启动都显示」是按常见做法和「游戏开始前」的字面要求定的；热启动（onShow）不显示。
4. 把 PopupKit 的全局时长改成 320/180 ms 会影响所有弹窗的手感，需要 Grok Bot 确认后再改。
5. 「昼夜」改成「夜色」开关：功能不变，只改了交互形式。
