# 《咦，起风了》棋盘 / 弹窗 UI 美术 · 阶段一接入文档（INTEGRATION.md）

> 给接入方看的。没有聊天记录也能照着做：所有路径、尺寸、九宫格参数、坐标、产品决定和验收点都写在这一份里。
> 美术基线：int/v1 @ `{{SHA}}`（d637356）。下文所有工程路径都相对仓库里的 `creator-build-project/`；所有美术路径都相对**美术根目录**：预览机上是 `/workspace/yiqifengle/previews/棋盘UI美术bot/`，仓库分支 `art/board-ui-phase1` 里是 `art-src/board-ui/`，两边目录结构一样。
> 本文件由 `_docs_src/gen_integration.py` 生成。切图表直接读各 `sizes.json`，字节数是 pngquant 之后实测的。

---

## 0. 通用约定
- **设计画布**：750×1624 px，竖屏，对应 390×844 逻辑分辨率。**1 pt = 1.923 px**（750/390）。文中的 px 都是 750 宽设计像素，pt 是逻辑点。
- **铺满规则**（全屏图、加载页、弹窗底下的场景都一样）：`s = max(W/750, H/1624)`，`dx = (W − 750·s)/2`，`dy = (H − 1624·s)/2`，屏幕坐标 = `(x·s + dx, y·s + dy)`，元素尺寸也乘 s。
- **安全区**：微信胶囊加左边的系统图标那一块（x ≥ 253 pt，y 51–83 pt）什么都不放。运行时用 `safeInsets()` 和 `wx.getMenuButtonBoundingClientRect()` 动态取。
- **材质**：所有 3D 件都只用一张调色板 `env_palette_256.png`（Closest 采样），UV 塌缩到色块上，不另带贴图。木件用 `M_env_palette`（粗糙度 0.9），焦点件用 `M_env_palette_piece`（粗糙度 0.36，高光 0.7）。草莓是唯一的例外，用 `M_piece_strawberry`（#ce342e）。
- **字**：标题全部是烘焙好的霞鹜文楷 PNG（包里不带字体文件）。正文和按钮用系统字（预览里拿 Noto Sans CJK 代替，0 B）。
- **禁止**：不能用任何电影截图，也不能用 `previews/角色动画bot/refs/wind-rises-apron-ref.jpg`。
- **分包建议**：加载页放主包（`assets/startup/`）；棋盘件和结算件放新分包 `board_art`；弹窗通用件（框、按钮、开关、小图标）放 `ui_common`，或者跟 `region_island` 一起加载；背景按地区放进各自的 `region_*` 分包。

---

## 1. 加载页和首帧（a-loading）
切图（`a-loading/slices/`）：
{{A_TABLE}}

- 底图：正式版是运镜bot 出的 `loading_base_final.jpg`（37,025 B），首帧合成图是 `a-loading/first-screen/first_screen_composite.jpg`（58,207 B，q91）。`loading_bg_PLACEHOLDER.jpg` 只是占位，不进包。
- 标题字：霞鹜文楷 Medium v1.522（SIL OFL 1.1），协议全文在 `a-loading/src/OFL.txt`。
- **坐标**（750×1624 设计像素，首帧和场景加载层完全一致；数据在 `a-loading/first-screen/coords.json`）：

| 元素 | 切图 | 显示缩放 | 左上角 | 中心 | 可见像素范围 |
|---|---|---|---|---|---|
| 标志 | `logo.png` 118×124 | 0.78 | (343, 292) | (389, 340) | (347, 295, 432, 385)，占高度 18.2%–23.7% |
| 标题 | `title.png` 470×146 | 0.92 | (159, 385) | (375, 452) | (166, 392, 590, 518)，占高度 24.1%–31.9% |
| 进度条底轨 | `bar_track.png` 496×44 | 1.0 | (127, 1271) | y = 1293 | (133, 1283, 617, 1306)，中心在 79.6% |
| 填充 | `bar_fill.png` 496×44 | 1.0 | 同底轨 | — | Sprite FILLED，HORIZONTAL |
| 风车 | `pinwheel.png` 60×60 | 1.0 | — | 跟着飘带头走 | 只在加载层出现 |
| 提示字 | 系统字 28 px（14 pt），颜色 #3F5E63 | — | 顶 y = 1341 | 居中 | 约在 85% 高度 |

```json
{{COORDS}}
```

- **进度**：`fillRange = 8/496 + p·(480/496)`。风车 x = 底轨左边 + 8 + 480·p，y 偏移 `5·sin(2π·(480p)/135)` px（向下为正），一直转，大约 1.2 s 一圈。p 只能按 `StartupReadyGate` 的三个真实阶段推进（海岛 / 角色 / 房间各占 1/3，阶段内缓动），**不许做假进度**。三段的提示文案依次是「风从海上来……」「她在窗前坐下……」「灯塔小屋准备好了」。
- **首帧到加载层的交接**：首帧只有底图、标志、标题和空底轨，没有填充、风车和提示字。场景加载层接手时位置零偏移（实测平均差 0.86/255）。接手后**风车和提示字用 0.2–0.3 s 淡入**，这样看不出交接。
- **ready 以后**：整个加载页用 UIOpacity 在 0.6–0.8 s 内淡到 0（ease-out），淡完再 `active = false`。「向左轻扫」的提示等淡出结束后再出现。
- Cocos 启动画面：能关就关（`useSplashScreen: false`）。关不掉的话，用 `a-loading/splash_option_same_image.jpg` 当 logo，backgroundColor 取底图的主色，`totalTime` 调到最小。
- 包体：底图 37,025 + 切图 29,247 = 66,272 B（预算 120 KB）。可以删掉的旧资源：电影截图（−129,312 B）和临时标题图（−13,167 B）。

---

## 2. 棋盘（b-board，v3.1 定稿）
切图（`b-board/slices/`，`slices/_rejected/` 里是弃用件，不要接入）：
{{B_TABLE}}

**坐标和尺寸**（pt，竖屏；详见 `b-board/board_layout_guides.png`）
- 暂停钮中心 (38, 67)，命中区 44×44。
- 关卡信息牌：x 88–302，y 96–156。第一行是关卡名，**全屏只出现这一次**。第二行是目标雕件 + 剩余数 ｜ 沙漏 + 剩余步数。目标有 3–4 个时向两边加宽，最宽 250 pt。
- 托盘：中心 y = 400 pt，格距 P = 42.6 pt（82 px），托盘外框 353 pt。`tray_frame` 可以做九宫格，四角的圆榫在角区里。
- 道具栏：中心 y = 730 pt，间距 82 pt，单个命中区 64×64。
- 显示尺寸（相对格距 P）：
  - 棋子节点 1.21P，棋子中心比格子中心高约 2 pt。
  - 特殊块 1.80P，跟棋子同中心。炸弹 1.89P，这时棋子缩到 ×0.8。
  - 格子底座和障碍都是 1.16P。
- 绘制顺序：底座 → 苔藓 → 风车 → 棋子影子 → 棋子 → 丝带 → 树根 / 贝壳盖。
- 状态：
  - 选中：抬起 4 pt + 金色柔光框。
  - 自动提示：两格的框呼吸，1.2 s 一个周期。
  - 不可交换：小幅摇头（沿用现有逻辑）。
  - 道具无货：`Sprite.grayscale = true` + UIOpacity 140，角标显示「+」。
- 特殊块动效：炸弹的纸风车大约 3 s 转一圈。

**现有棋盘 28 项的处理清单**（来源：`ManagedMobileBoardUI.ts`、`world-r2/ManagedTools.ts`、`world-r2/RegionalOverlay.ts`、`mainline-r1/adapter/mainline-port.js`、`world-r2/ManagedBoardSession.ts`。⚠ = 会改功能，要同步改测试断言）

| # | 现有元素 | 处理 |
|---|---|---|
| 1 | 返回 `back`（左上 → `requestExit`） | ⚠ 合并：左上只留暂停钮，退出改成暂停面板里的「离开棋盘」（b16 由「回到小岛」改名，行为不变），**不弹确认** |
| 2 | 关卡标题 `LevelTitle` | 合并进信息牌第一行 |
| 3 | 状态行 `status`（常驻显示 `uiStatus`） | ⚠ 去掉常驻显示，改成**临时提示条**：只在道具操作提示和报错时出现在道具栏上方，2 s 后淡出；「已暂停」由暂停面板代替 |
| 3b | 区域关的 `uiStatus` =「潮汐 · phase · kind」（`ManagedBoardSession.ts:51`） | ⚠ 不再展示 |
| 4 | 目标牌 `Goal-0..3` | 合并进信息牌第二行 |
| 5 | 步数 `Moves` | 合并进信息牌（沙漏 + 数字，青色字） |
| 6 | 行囊 `bagBtn` | ⚠ 收进暂停面板的「行囊」 |
| 7 | 底排背景条 `IslandUtilityRail` | 删除 |
| 8 | 重来 `retryBtn`（会弹 `retryPanel`） | ⚠ 收进暂停面板的「重来」，**保留二次确认** |
| 9 | 提示 `hintBtn` | ⚠ 改成**自动提示**：无操作 **5 s** 第一次提示，之后每 **8 s** 一次；不留手动提示按钮；**提示不影响星级**；区域关的 guide 也自动出现 |
| 10 | 暂停 `pause` | ⚠ 移到左上，是顶部唯一的按钮，点开暂停面板 |
| 11 | 道具栏 `CompactToolTray` | ⚠ **最多显示 3 个**：只显示本关可用、开局有货的道具，按 **星光 > 风语铃 > 潮汐瓶 > 地区道具** 取前 3 个。本局用完的留在原位灰掉，位置不跳；开局一个都没有就整栏收起 |
| 12 | 珍珠 `pearl` | ⚠ **删除**（结算、奖励、行囊里也不出现） |
| 13 | 道具名标签 `ToolLabel` | ⚠ **去掉常驻标签**。点选道具时用临时提示条显示「星光 · 点选目标」；首次获得时由「道具介绍」弹窗介绍 |
| 14 | 数量角标 `ToolCount` | 换成奶油圆牌 + 深棕数字，0 显示「+」 |
| 15 | 选中环 `ToolSelection`、拖拽幽灵 `ToolDragGhost` | 保留，换新切图 |
| 16 | 格子 `Tile-0..48` | 换成木托盘 + `tile_a/b` 两色交替的底座 |
| 17 | 棋子 `ProjectPieceArt`（`pieces.png`） | 换成 `piece_*.png`。6 种身份 type0–5 不变：草莓 / 青叶 / 蓝莓 / 白花 / 橡果 / 扇贝 |
| 18 | 苔藓标记 | 换成整格的 `obstacle_moss` |
| 19 | 树根 / 灯塔目标格（2 px 描边） | 树根换成 `obstacle_roots`；灯塔目标格见 §6 |
| 20 | 特殊块标记 | 换成 `special_line_h/v`（风丝带）和 `special_bomb`（纸风车） |
| 21 | 选中框、提示框 | 选中 = 抬起 + 柔光框；提示 = 呼吸光 |
| 22 | 区域关连线 `RegionalFocusCue` | 保留，改配色（本轮没出图） |
| 23 | 区域关格子标签 `RegionalFixedCell` | 保留功能；贝壳层数用 `obstacle_shell_2/1` 表示；其余视觉留到下一轮 |
| 24 | 关卡背景 `OriginalLevelBackground` / `OriginalLevelEnvironment` | ⚠ **换成 `bg_island_board.jpg`**，删除 `painted-cloud.png` 的引用。天空回声（`r05-sky-*`）在 `IslandBoardBackground.ts` 里改读 `bg_skycity_board.jpg`（分包 `region_skycity/board/`，夜间仍 × K_SEA）。花粉草甸没有场景模型，棋盘继续用岛背景 |
| 25 | 连击鼓励字 `CheerText` | 保留（另外排） |
| 26 | `retryPanel` / `bagPanel` / `resultPanel` | 换成统一弹窗（§3、§4） |
| 27 | 微信胶囊（系统画的） | 避让 x ≥ 253 pt、y 51–83 pt |
| 28 | 横屏布局 | 本轮没有设计 |

可以删掉的旧资源（确认以后）：`pieces.png` 776,072 B、`tools-original.png` 66,831 B、`painted-cloud.png` 1,417,468 B，以及 `OriginalLevelEnvironment` 里程序画的平面海浪纹。

---

## 3. 弹窗通用件和 (c) 面板
**精简规则**（PM 已验收，所有面板都按这一套）：
- 外框只有一层浅木，没有角钉；标题木牌不带绳子和钉子。
- 面板宽统一 **680 px**（354 pt），高度按内容。
- 不放副标题、小节标签、虚线和小装饰；内容直接放在底板上，最多垫一层很浅的平底（#ECE0C4，圆角 24）。
- 间距都用 8 的倍数（常用 16 / 24 / 32 / 64 / 104）；面板顶到第一块内容是 104 px，最后一块内容到面板底是 72 px。
- 字号最多三级：标题、正文、数字。

切图（`c-popups/slices/`，宝箱 2D 备选那一组不进包）：
{{C_TABLE}}

**九宫格 / 三宫格参数**
| 切图 | 类型 | border（px） | 用法 |
|---|---|---|---|
| `panel_frame_9s.png` 208×208 | SLICED | 92 / 92 / 92 / 92 | 弹窗外框，宽 680 |
| `title_plank_3s.png` 192×105 | SLICED 横向 | 左右 84 | 标题木牌，宽 = 标题图宽 + 150（最少 300）；木牌中心对齐面板上沿 |
| `btn_primary_3s.png` / `btn_secondary_3s.png` 162×104 | SLICED 横向 | 左右 69 | 按钮高 104 px（54 pt）。按下：下沉 3 px、变暗 6%；不可用：灰化 + 55% 透明 |
| `toggle_on/off.png` | SLICED 横向 | 左右 28 | 开关；也拿来拼音乐音量滑条（off = 轨道，on = 已填充段，`toggle_knob` = 拇指） |
| `r2/slices/sign_plank_3s.png` | SLICED 横向 | 见 sizes 的说明（左右各 16% 宽） | 旅程册的横幅章节牌，显示 544×176 |

**弹窗动效**：打开 200–250 ms（淡入 + 0.92 → 1 缩放，ease-out），关闭 150 ms。遮罩 = 模糊 7 px + 压暗 35%。用 `BlockInputEvents` 挡住下层（第二根手指也不能点到下层）。

**各面板**（全屏图：`c-popups/*.png`、`c-popups/r2/*.png`、`c-popups/r3/*.png`；「旧版 vs 精简版」对比在 `compare/old_vs_lite_*.jpg` 和 `r2/compare/old_vs_lite_*.jpg`）
- **暂停** `pause.png`（定稿，布局不要动）：
  - 一行小字「关卡名 · 还剩 N 步」。
  - 三个图标位：重来（→ 二次确认 `pause_restart_confirm.png`）/ 行囊 / 设置。
  - 音乐、音效两个快捷开关。
  - 主按钮「继续」；次按钮「离开棋盘」（b16 由「回到小岛」改名，行为不变）= 直接 `requestExit`，**不弹确认**。
  - 不放手动提示。
- **重来确认** `pause_restart_confirm.png`：图标 + 一句「这一局会从头再来」+「留下」/「重来」（复用 `retryPanel` 的逻辑）。
- **设置** `settings.png`（岛上和关卡里共用一个节点）：
  - **音乐 = 音量滑条** → `GameAudio.setMusicVolume(v)`（key `qfl.audio.musicVolume`，默认 0.4）。
  - **音效 = 单独的静音开关**：在 `GameAudio` 里新增 `setSfxMuted / isSfxMuted`，key `qfl.audio.sfxMuted`；音效播放入口（`GameAudio.ts` 里判断 `this.muted` 的两处，约第 285 行和第 631 行）加上 `|| this.sfxMuted`。
  - 全局静音不上界面（API 保留）。
  - **不做震动**。
  - 昼夜（晴昼 / 夜色）→ `options.toggleDayNight`。
  - 减少动态 → 写 `forest-v33-reduced-motion`。
  - 「关于」一行点进关于页。
  - 所有开关点击走 `GameAudio.onButton()`，关闭走 `onUiBack()`。
- **关于** `r3/about.png`（夜间版 `r3/about_night.png`）：
  - 游戏名（`r3/slices/about_gamename.png`，霞鹜文楷 56 px）。
  - 版本行「v0.1 · 构建 <短 SHA>」。
  - 开源许可（一层浅底，三行）：霞鹜文楷 LXGW WenKai · SIL OFL 1.1；Fredoka（连击鼓励字的位图字）· SIL OFL 1.1；Babel 辅助代码 · MIT。
  - 「查看许可全文 ›」打开一个滚动文本，内容 = `a-loading/src/OFL.txt` + `tools/t6-cheer-text/font/OFL.txt` + `docs/MAINLINE-BABEL-HELPERS-LICENSE.txt`。
  - Cocos Creator 引擎按 Cocos 自己的授权条款，不算开源许可，不列在这里。
- **领奖（「获得」弹窗）** `reward_claim.png`：
  - 地区印记、地区工具、主线奖励、本关宝箱都用这一个弹窗（替换 `WorldIntegrationBoot.ts:327-328` 只改按钮文字的做法）。
  - 播放顺序：宝箱出现 → 播 GLB 里的 `chest_open`（§5）→ `fx_rays` 慢转（12 s 一圈）→ 获得物从箱口沿弧线升起 →「收下」→ 获得物飞向暂停钮（行囊），数量 +1。
  - 已领过的显示 `stamp_claimed`。
  - 宝箱 RenderTexture 的相机俯角 40°，否则看不到箱子里面。
  - 间距（px）：焦点层底 → 获得物文字 56（> 一行字高 44）；获得物文字 → 说明文字 32；说明文字 →「收下」按钮 64；按钮底 → 面板底 56。实测值：
```json
{{REWARD}}
```
- **结算**：
  - 过关 `result_win.png`：3 星（中间那颗大）、分数、步数、「成绩已保存」、宝箱 + 道具；「下一关」/「回小岛」。
  - 失败 `result_lose.png`：标题「**差一点点**」（替换代码里的「再走一次」）、空星、一句话、还差的目标、宝箱灰显；「再试一次」/「回小岛」。
  - 星星一颗一颗落下（每颗 0.18 s），分数滚动。
- **还没存上** `r2/result_unsaved.png`：出现条件是 `result.unsaved`（结算时存档失败）或 `run.unsaved`（对局中存档失败）。星星 + 分数 + 一行「! 成绩还没存进旅程册」；**宝箱灰显，文字「存好后就能打开」**；「重试保存」（retrySave）/「返回海岛」（requestExit）。
- **旅途回顾（只读）** `r2/result_readonly.png`：出现条件是 `error.readonly`（存储只读 / 记录保护，provider 拒绝写入）。标题「**旅途回顾**」，用 `r2/slices/title_旅途回顾.png`（主线现在会落到「再走一次」，要统一改掉）。星星 + 分数 + 一行带锁的「记录暂时不能写入，这局只看不存」；只有「返回海岛」。
- **道具介绍（首次获得）** `r2/item_intro_starlight.png`：3D 大图（`r2/slices/hero_*.png`）+ 道具名（霞鹜文楷标题）+ 两行用途 +「知道了」。需要存档字段 `seenTools`（见 §7）。文案：
  - 星光：「轻点任意一格，星光会清掉它和四周一圈（3×3）。」
  - 风语铃：「轻点一格，风铃声沿着这一行和这一列吹开。」
  - 潮汐瓶：「轻点一格，潮水漫过以它为中心的 5×5。」
- **行囊**：
  - 岛上 `r2/bag_island.png`：5 件道具做成 160×192 的格子（3D 图标 136 px，22 px 的数量胶囊，0 件整格灰掉）；装扮为空时只放半透明蝴蝶结 + 「还没有装扮」。
  - 关卡内 `r2/bag_level.png`：盖在棋盘上；道具格同岛上版；宝箱每条（528×96 的浅底）只放宝箱图标、关卡名和「打开」；关闭只用右上角 ×；**没有珍珠**。
  - 宝箱超过 2 个时沿用代码里的分页。
- **旅程册** `r2/journey_book.png`：
  - 三章（潮汐小径 / 花粉草甸 / 天空回声）各一张横幅路牌：左边 200×128 的地区小图（`r2/slices/region_*.png`），印记缩到 64 px 压在图的左上角，右边是章节名（`chapter_*.png`）。
  - **只算主线星**：x/12（每章 4 关 × 3 星）。
  - **地区挑战单独用一个小标记「⚑ 挑战 x/4」**（r05 每个地区 4 关）。
  - 未解锁：去色 + 加雾 + 金锁 + 一行很淡的「主线解锁后开启」。
  - **潮汐小径的新描述**：「听潮声，捡起海浪送来的贝壳。」（代码 CHAPTERS 里的旧句子提到珍珠，要替换。路牌上不显示描述，留给章节详情页用）。
  - 花粉草甸和天空回声的小图是**占位**，场景建好后用 `c-popups/src/round2/render_regions.py` 重渲。
- **海岛小憩** `r2/island_rest_day.png` / `r2/island_rest_night.png`：
  - **改成点小屋时弹出**（不是点灯塔）。
  - 两扇昼夜小窗（当前那扇金边）+ 主按钮：夜里是「迎接晴昼」，白天是「看看夜色」（`IslandJourneyOverlay.ts:93`）。
  - 弹窗里不放「轻点灯塔」之类的提示。
  - **岛上的「设置」按钮改成打开完整的 (c) 设置面板**（现在打开的是海岛小憩）。
  - 小屋的点击区域：现在 `IslandHomeInteraction` 用 `worldCommands().hitLighthouse(x, y)` 判断，命中就 `returnHome`（`WorldIntegrationBoot.ts:256`），而 `env_lighthouse_ext` 这个网格把小屋也包在里面。要新增一个 `hitCabin`（取小屋部分的包围盒；在 750 宽的岛画面上，小屋大约在 (385, 610)–(525, 815)），命中就打开海岛小憩，灯塔塔身保持原来的行为。

---

## 4. 夜间
- 系数取自 `world-r2/IslandPropsLayout.ts`：
  - UI / 棋盘 Sprite × **K_UI = tag.nightFill / tag.fill = #9a8f7f / #f8f2e2 = (0.621, 0.591, 0.562)**。
  - 背景（海、天）× **K_SEA = seaNight.tint #7f9fb3 = (0.498, 0.624, 0.702)**。
  - **宝箱、星星、`fx_rays`、箱口柔光 × K_HALF = 1 − (1 − K_UI)/2 = (0.811, 0.796, 0.781)**，保留一点暖光。
- 权重读 `propNightWeight()`，过渡 `nightFadeS` = 0.5 s：`tint = lerp(1, K, weight)`。夜间不另出一套图。
- **文字不跟着乘色，单独换颜色，对比度 ≥ 4.5:1**（按乘过色的纸面 (140,131,109) 算）：深棕 (30,19,8) 4.85；次要 (34,23,11) 4.67；青 (6,30,34) 4.59；主按钮上的字 (232,226,212) 8.49。烘焙的标题图跟着 Sprite 乘 K_UI。
- 实测数据在 `c-popups/night/contrast.json`；预览图在 `c-popups/night/` 和 `b-board` 的夜间棋盘 `c-popups/night/board_night.png`。

---

## 5. 宝箱 3D：`c-popups/glb/result_chest.glb`
- 29,536 B（Draco），3,556 个三角面。节点 `chest_body`，子节点 `chest_lid`（原点就在铰链上）。不内嵌贴图，材质槽 `M_env_palette_piece`，进 Cocos 后重新绑到调色板材质上。
- 动画 `chest_open`：0.5 s，30 fps，只转 `chest_lid` 的 X 轴：0° → 0.30 s −126°（过冲）→ 0.40 s −114°（回弹）→ **0.50 s 停在 −118°**。示意图 `c-popups/chest_anim_keys.png`。
- 箱子里有 40 枚金币（其中用到 `lamp` 发光色块）。GLB 不带灯，光由 `fx_rays` 和发光色块负责。
- 用 `ResultChest3D` 现有的 RenderTexture 方式渲染，把 mesh 换成这个 GLB，然后**删掉** `ResultChestGeometry.ts`（430,541 B，在主包里）、`OriginalResultChestPainter.ts`（6,058 B）、`resources/result-chest/chest-lit.effect`（2,469 B），一共 −439,068 B。`test_result_*` 里写死的几何断言要按新模型改。
- `result_chest_preview.glb` 只给查看器用，**不进包**。

---

## 6. 灯塔目标格
**美术**：`c-popups/r2/slices/beacon_ring.png`（金色灯座框，1 格大小）+ `beacon_lighthouse.png`（格子右上角的小灯塔，HUD 目标图标用同一张缩小）。暖光用程序画（0 B）。预览图：`r2/board_beacon.png`、`r2/beacon_closeup.png`、`r2/beacon_acorn_closeup.png`。
- 当前目标格的画法：
  - 格子底下一层暖光（外溢约 1.25P，橙黄 (255,190,80)）。
  - 格子里一块浅暖金 (255,222,140)，中心一个白亮点 (255,252,232)，约 0.74P。
  - 金色灯座框。
  - 格子外沿一圈压在棋子上的暖光晕（12 px，模糊 9）。
  - 右上角的小灯塔，带灯室光晕和两道短光束。
- 指定了图案（typed）时，灯塔脚下加一枚小圆牌，画出要消除的棋子。
- 后面几格的路线：每格下沿一个很淡的暖点（直径 10 px，透明度约 65%），格间 2–3 个更淡的过渡点（直径 6 px，约 50%）。只表示方向，不能抢当前目标。
- 和「提示」的区分：提示是格子外沿的金色描边在呼吸；灯塔是格内的实心暖光加一座灯塔。

**数据（已在代码和关卡数据里查实）**
- **关卡配置字段**：`config.beacons: number[]`，是**有序**的格子索引，按行优先排在 7×7 棋盘上：`index = row·7 + col`，`row = Math.floor(index/7)`，`col = index % 7`（`engine.js` 里 `SIZE = 7`）。可选字段 `config.beaconTypes: number[]`，和 `beacons` 一样长，取值是逻辑类型 0..5，表示每一盏灯必须用哪种棋子点亮。另外 `config.goals.beacons` 必须等于 `beacons.length`（`r4-cloud-compat/runtime/challenge-validation.js:151-155` 会校验）。
- 关卡数据样例（`r4-cloud-compat/runtime/challenge-catalog.js`，关卡 `tide-c01-001`，第 40–54 行）：
```json
{ "goals": { "beacons": 3, "moss": 6, "type5": 10 },
  "moss": [15, 16, 17, 31, 32, 33],
  "starters": [{ "index": 21, "special": "row" }, { "index": 3, "special": "column" }],
  "beacons": [22, 24, 26] }
```
  带 typed 的样例（同一文件第 1536–1537 行）：`"beacons": [24], "beaconTypes": [3]`。旧的内置关卡「灯塔引路」（`regional-r05/runtime/vendor/engine.js:89` 和 `r4-cloud-compat/runtime/engine.js:89`）：`beacons: [8, 24, 40]`，`goals.beacons: 3`。
- **引擎字段**（`r4-cloud-compat/runtime/engine.js`、`regional-r05/runtime/vendor/engine.js`、`mainline-r1/runtime/vendor/engine.js`）：`engine.beaconRoute`（`config.beacons` 的副本，约第 325–331 行）、`engine.beaconCursor`（已经点亮了几盏，从 0 开始；某一波命中当前格以后 +1，在 `engine.js` 约第 1060 行）、`engine.beaconTypes`。
- **现在给 UI 的只有当前这一格**：`ForestEngine.prototype.beaconTarget()`（`r4-cloud-compat/runtime/engine.js:369`）返回 `{ index, type, cursor, total, typed }`。`r4-cloud-compat/runtime/challenge-controller.js:474` 把它放进快照 `active.beaconTarget`（类型声明在 `challenge-controller.d.ts:18`），UI 在 `ManagedMobileBoardUI.ts:262` 只画 `beaconTarget.index` 这一格的 2 px 框。主线 `mainline-r1/runtime/mainline-session.js:86` 写死了 `beaconTarget: null`（主线引擎支持路线，但现在的主线关卡里没有 `beacons`）。
- **快照里没有后面几格，需要新增一个字段**（数据本身已经在 `engine.beaconRoute` 里）：
  - `challenge-controller.js:474` 旁边加 `beaconRoute: Array.from(e.beaconRoute)`；`challenge-controller.d.ts` 的 active 类型加 `readonly beaconRoute: ReadonlyArray<number>`。
  - 主线以后要用的话，`mainline-session.js` 的 snapshot 里同样加 `beaconRoute: Array.from(e.beaconRoute)`，`beaconTarget` 按引擎的 `beaconTarget()` 逻辑算（主线 vendor 引擎里没有这个方法，要照着 r4 的实现补一个）。
  - UI：`const next = active.beaconRoute.slice(active.beaconTarget.cursor + 1)`；每个 index 用 `(Math.floor(i/7), i%7)` 换成格子坐标，画淡点。快照样例：
```json
"beaconTarget": { "index": 24, "type": null, "cursor": 1, "total": 3, "typed": false },
"beaconRoute": [22, 24, 26]
```
  （cursor = 1：22 已经点亮，当前是 24，后面画淡点的是 [26]。）
  - 快照会参与测试快照比对和存档签名吗？`regionState()` 已经包含 `beacons` 和 `cursor`，所以加一个只读字段不影响签名；但 `test_*` 里如果对 active 做了深比较，要把预期值补上。

---

## 7. 存档标记（新增）
两项都是纯 UI 的偏好，**建议不要写进 journey 事务存档**（journey 有只读保护和事务校验），而是像 `forest-v33-reduced-motion` 一样直接用 `sys.localStorage`。如果 GGbot 更想放进 journey，字段名照下面的来：
| key | 类型 | 写入时机 | 读取方 |
|---|---|---|---|
| `qfl.ui.seenTools` | JSON 字符串数组，例如 `["starlight","windbell"]` | 「道具介绍」点了「知道了」，或者关掉弹窗时 | 拿到一件道具时：不在数组里 → 弹「道具介绍」 |
| `qfl.ui.cabinHintSeen` | `'1'` / 不存在 | 玩家**第一次点小屋**（不管是不是在提示期间） | 岛首页：不存在且满足触发条件 → 播小屋提示 |

---

## 8. 小屋提示（不带字）
- 预览：`c-popups/r3/cabin_hint.png`（峰值那一帧），关键帧 `c-popups/r3/cabin_hint_keys.png`。
- 切图：`r3/slices/cabin_bubble.png`（月亮图标气泡，1:1 显示，尾巴朝左下指向小屋）、`r3/slices/cabin_glow.png`（叠加用的柔光斑）。参数在 `r3/slices/cabin_hint.json`。
- **触发条件**：`qfl.ui.cabinHintSeen` 不存在，**并且**是第一次从关卡回到岛上（`returnHome` 或者结算后「返回海岛 / 回小岛」以后，岛首页 ready，没有弹窗打开，加载页已经淡出）。第一次进游戏、还没玩过关卡时不播。
- **表现**：
  - 小屋窗户（屋顶的老虎窗、正面的窗）的玻璃像素用 screen 混合提亮，门口加一团暖色柔光。
  - 亮度曲线：0.4 s 升到 0.25 → 呼吸 3 次（每次上升 0.7 s + 回落 0.9 s，easeInOutSine，峰值 1.0）→ 到 5.2 s 停在 0.25 常亮，直到玩家点小屋。
  - 气泡 0.4 s 淡入，然后常驻，上下浮动 ±4 px（2.4 s 一个周期）。
- 点小屋以后：暖光 0.3 s 淡到 0，气泡 0.25 s 先放大到 1.15 再缩到 0，写入 `qfl.ui.cabinHintSeen = '1'`，同时打开海岛小憩。以后**永远不再出现**。
- 夜间：暖光不乘夜色（本来就是灯），气泡乘 K_UI。减少动态打开时：不做呼吸，固定亮度 0.6，气泡不浮动。
- 设计坐标（750 宽的岛画面）：
```json
{{CABIN}}
```
  运行时窗户的位置要跟着岛相机走：取小屋模型上窗户位置的世界坐标，投影到屏幕上；上面这些只是预览里对应的位置。

---

## 9. 版本号：BuildInfo.ts
- 构建时生成 `assets/scripts/BuildInfo.ts`：`export const BUILD_VERSION = 'v0.1'; export const BUILD_SHA = '<git rev-parse --short=7 HEAD>';`。
- 在打包微信小游戏之前的那一步加一行，例如：`echo "export const BUILD_VERSION='v0.1'; export const BUILD_SHA='$(git rev-parse --short=7 HEAD)';" > creator-build-project/assets/scripts/BuildInfo.ts`。
- 仓库里提交一份 `BUILD_SHA = 'dev'` 的占位版，生成的版本不要提交。工作区有未提交改动时可以用 `git describe --always --dirty --abbrev=7`，带上 `-dirty` 后缀。
- 关于页的 Label 显示 `BUILD_VERSION + ' · 构建 ' + BUILD_SHA`，例如「v0.1 · 构建 d637356」。

---

## 10. r2 / r3 切图
`c-popups/r2/slices/`（hero_windbell / hero_tidebottle 可以先不放）：
{{R2_TABLE}}

`c-popups/r3/slices/`：
{{R3_TABLE}}

三件地区道具（`tool_tidenet` 短柄小抄网、`tool_sunseed` 发芽的葵花籽 + 小太阳、`tool_starshears` 金环剪刀）**还没并进 (b)**，等 Funning 确认。对比图在 `c-popups/r2/region_tools_compare.png`。

---

## 11. 包体总表（pngquant 之后实测，字节）
| 部分 | 内容 | 字节 |
|---|---|---|
| a 加载页 | 切图（不含底图） | {{TOT_A}}（+ 正式底图 37,025） |
| b 棋盘 | 切图 + 背景 | {{TOT_B}} |
| c 弹窗 | 切图 + 宝箱 GLB（不含 2D 宝箱备选） | {{TOT_C}} |
| r2 | 面板件、地区小图、标题（只放星光大图） | {{TOT_R2}} |
| r3 | 小屋提示 + 关于页 | {{TOT_R3}} |
| **新增合计** | | **{{TOT_ALL}}**（+ 加载底图 37,025） |
| 可以删的旧资源 | 电影截图 129,312 + 临时标题图 13,167 + `pieces.png` 776,072 + `tools-original.png` 66,831 + `painted-cloud.png` 1,417,468 + 宝箱脚本和 effect 439,068 | **−2,841,918** |

- 预算：图集 ≤ 600 KB，单张背景 ≤ 150 KB，加载页 ≤ 120 KB，宝箱 GLB ≤ 60 KB，单张预览图 ≤ 700 KB。全部达标。
- 主包：删掉 `ResultChestGeometry.ts` 主包会小约 430 KB；新切图都放分包。
- 打成图集以后大小会浮动 ±10% 左右。

---

## 12. GGbot 待办汇总（原来私信里的内容，整合在这里）
**b-board README「⚠」项（需要同步改测试断言）**：#1 退出改两步（暂停 → 离开棋盘，不确认）；#3 status 改成临时提示条；#3b 删除区域关的调试状态串；#6 行囊收进暂停面板；#8 重来收进暂停面板（保留确认）；#9 自动提示（5 s / 8 s，需要新增 idle 计时，不影响星级）；#10 暂停移到左上；#11 道具栏最多 3 个和优先级规则；#12 删除珍珠；#13 去掉常驻道具名；#24 换背景，删掉 `painted-cloud.png` 的引用（`LevelBackground` 的测试要改）。

**c-popups**：
- 统一弹窗框和按钮（§3）；宽 680 + 精简规则。
- 设置：音乐音量 / `sfxMuted` / 不做震动 / 减少动态 / 关于。
- `BuildInfo.ts`（§9）。
- 「获得」弹窗替换 `WorldIntegrationBoot.ts:327-328`。
- 结算失败页标题改「差一点点」。
- 宝箱 GLB 和开盖动画，删除 `ResultChestGeometry.ts`（§5）。
- 夜间乘色和文字换色（§4）。

**r2 / r3**：
- `seenTools`、`cabinHintSeen`（§7）。
- 海岛小憩改成点小屋打开（`hitCabin`）；岛上的设置按钮打开完整设置。
- 潮汐小径的新文案。
- 旅程册只算主线星 + 挑战标记 x/4。
- 只读结算改「旅途回顾」；还没存上时宝箱灰显「存好后就能打开」。
- 灯塔快照新增 `beaconRoute`（§6）。
- 小屋提示（§8）。

---

## 13. 验收要点
1. 750×1624 和 16:9 两种屏幕下，加载页的标志、标题、进度条都在画面里；首帧到加载层交接没有位移，风车和提示字淡入。
2. 进度只跟着三个真实阶段走；ready 后 0.6–0.8 s 淡出。
3. 棋盘顶部只有暂停钮和信息牌；胶囊区域（x ≥ 253 pt，y 51–83 pt）什么都没有；关卡名全屏只出现一次。
4. 道具栏最多 3 个，按优先级排；用完的灰掉、位置不动；没有道具时整栏收起；没有珍珠；没有常驻道具名。
5. 无操作 5 s 第一次出现自动提示，之后每 8 s 一次；提示不影响星级。
6. status 只作为临时提示条出现，2 s 后淡出。
7. 暂停面板：继续 / 重来（有确认）/ 行囊 / 设置 / 离开棋盘（不确认）/ 音乐和音效开关。
8. 所有弹窗宽 680 px（354 pt），无钉木框；标题是烘焙的文楷图；下层点不到。
9. 设置：音乐滑条实时生效；音效静音只关音效、不关音乐；没有震动；版本号显示「v0.1 · 构建 <7 位 SHA>」。
10. 夜间：Sprite 乘色，过渡 0.5 s；宝箱和星星只乘一半；所有文字对比度 ≥ 4.5（按 `contrast.json` 的方法抽查）。
11. 宝箱 GLB 播 0.5 s，最后停在 −118°，能看到箱子里面；删掉 `ResultChestGeometry.ts` 以后主包变小约 430 KB。
12. 灯塔目标格：当前格有暖光 + 灯座框 + 小灯塔；后面几格的淡点和 `beaconRoute` 一致；typed 关卡显示小圆牌；跟提示能区分开。
13. 还没存上：宝箱灰显 +「存好后就能打开」；只读时标题「旅途回顾」，只有返回按钮。
14. 第一次拿到每件道具弹一次介绍，之后不再弹（`qfl.ui.seenTools`）。
15. 第一次回岛时小屋呼吸 3 次 + 月亮气泡，点过一次以后再也不出现（`qfl.ui.cabinHintSeen`）；点小屋打开海岛小憩；岛上的设置按钮打开完整设置。
16. 包体在 §11 的预算内；包里没有任何电影截图，也没有 `wind-rises-apron-ref.jpg`。
