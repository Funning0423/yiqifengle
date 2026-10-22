# (c) 弹窗与界面定稿预览：统一木框便签 + 通用按钮 + Blender 宝箱（棋盘UI美术bot）

- 阶段一，只出预览：**没改工程、没提交**（worktree `work/棋盘UI美术bot` 是干净的，基线 int/v1 @ d637356）。
- 画布 750×1624（390×844 逻辑分辨率，1pt = 1.923px），跟 (a)、(b) 一样。
- **风格跟 (b) v2 定稿保持一致**：弹窗框、标题木牌、按钮外圈、开关、图标底座都用 (b) v2 托盘那组浅木色块（`rimL (100,5) #c9b185`、`baseL (60,5) #baa279`、`pegL / pegTopL / lipL`、`tileL1 (85,4)`），低对比、不加深色描边，让框往后退。焦点放在内容上：**宝箱、奖励图标、星星、主按钮**（主按钮面是青色 `(50,9) #3a7876`，白字对比 5.26:1）。
- 建模和渲染跟 T9 / (b) 是同一套做法：`src/build_popups.py` 用 Blender 4.5 建模，只用一张 `env_palette_256.png`，每个面的 UV 都塌缩到某个色块上，**不新增贴图**。倒边用 bevel（按角度限制）加 `shade_smooth_by_angle`，渲染用 Cycles。
  - **木件**（框、木牌、按钮、开关、图标底座）用 T9 的灯光：天光 (0.62,0.80,0.95)×0.55，太阳 2.35，从左上前方打过来，角度 8°。
  - **焦点件**（宝箱闭合 / 打开、星星、地区印记）照搬 (b) v2 的 `build_board.py`：材质 `M_env_palette_piece`（粗糙度 0.36、高光 0.7），太阳 3.5（light linking 只照焦点件），天光 0.22，头顶柔光 0.8 / 26°，冷色轮廓光 1.1；合成时再走 (b) 的 `focus_grade`（饱和度 +22%、对比度 +10%）。
  - 行囊、设置、关于三个图标直接导入 T9 的 `ui_satchel / ui_compass / ui_notebook`（`work/grokbot/ui-props/glb-preview`），跟岛上那几个 3D 按钮是同一个模型。奖励里的星光、风语铃直接用 (b) v2 的道具雕件，**不另出图**。
- 下面那层棋盘画面用的是 (b) **v3.1** 的 `board_final_tools.png`（青叶方案 A，快照在 `src/inputs/`，v2 快照挪到 `src/inputs/_v2/`），设置页下面是岛（`pm-audit/C0` 实机截图）。遮罩：模糊 7px + 压暗 35%（文档 §4）。
- **没有用任何电影截图，也没用 `wind-rises-apron-ref.jpg`**。“现状”栏只放了 pm-audit 里本作自己的截图和预览图。
- 按 PM 的决定：暂停面板里**不留手动提示**；「离开棋盘」（b16 由「回到小岛」改名，行为不变）**不再弹二次确认**，「重来」保留确认；结算和奖励里**没有珍珠**；提示不影响星级。
- **PM 已通过 (c)，十个问题的结论都已落到图里**（见文末「已定决策」）。暂停界面按 Funning 的意见定版，布局不再动。
- **v3.1 已重跑**：`src/inputs/` 换成 (b) v3.1 的 `board_final_tools.png / board_final_notools.png / bg_island_board.jpg` 和 `b-board/src/raw/` 的全部原始渲染（`b_raw/`，奖励里的星光 / 风语铃 / 潮汐瓶图标随之换成 v3 重建版）。重出了 6 张弹窗全屏图、`night/` 全部（含夜间棋盘）、`compare/` 6 张、`kit_sheet / chest_sheet / chest_anim_keys / chest_open_closeup`。宝箱 GLB 不动（40 枚金币，29,536 B）。
- 夜间棋盘顺手修了一处接缝：以前是「背景按 K_SEA、托盘按 K_UI」两张图按遮罩拼，托盘投影外沿会出现一圈硬边；现在直接对成图乘色、两种系数按遮罩混合，投影保留。

## 文件
| 文件 | 说明 |
|---|---|
| `pause.png` | 暂停：标题木牌「暂停一下」、关卡名 + 剩余步数（小字，一行）、三个图标位：重来 / 行囊 / 设置，音乐和音效两个快捷开关，主按钮「继续」，次按钮「离开棋盘」（b16 由「回到小岛」改名，行为不变） |
| `pause_restart_confirm.png` | 重来的二次确认（统一弹窗框，文案沿用现有的「当前这局会丢掉」），按钮「留下」/「重来」 |
| `settings.png` | 设置（岛上和关卡里共用）：**音乐 = 音量滑条**、**音效 = 单独静音开关**、昼夜（晴昼 / 夜色）、减少动态，再加关于和版本「v0.1 · 构建 d637356」；关闭钮；「轻点灯塔，回屋小憩」这一行只在岛上显示。震动这一版不放，全局静音不上界面 |
| `reward_claim.png` | 奖励领取（统一的「获得」弹窗）：俯 40° 看进打开的宝箱（内壁、箱底、金币堆、光从箱口冒出）+ 获得物（星光 ×1、潮汐印记、风语铃 ×1）+ 一句话 + 主按钮「收下」。间距实测见 `reward_layout.json` 和下面「领奖界面间距」 |
| `chest_open_closeup.png` | 宝箱打开特写 1100×1100（612,152 B，< 700 KB） |
| `chest_anim_keys.png` | 开盖动画关键帧示意：6 帧 + 角度曲线 |
| `result_win.png` | 过关结算：3 颗星（中间那颗大）、630 分、用了 18 步 / 剩余 4 步、成绩已保存、本关奖励（闭合宝箱「轻点宝箱打开」+ 星光 ×1），主按钮「下一关」，次按钮「回小岛」 |
| `result_lose.png` | 失败结算：标题「差一点点」，3 颗空星、步数用完了、还差的目标（草莓 ×3、苔藓 ×1）、奖励灰显（过关后可以打开），主按钮「再试一次」，次按钮「回小岛」 |
| `compare/compare_*.jpg` | 6 张三栏对比图：现状 ｜ 新版 ｜ T9 基准（①C0 实机裁切 ②ui-props 原始渲染 ③沙地上同比例摆一起：T9 路牌 + 新版宝箱、按钮、星、图标底座） |
| `kit_sheet.png` | 控件总表：**只用 `slices/` 里的切图拼出来**，用来验证九宫格和三宫格能用。包括 3 种尺寸的弹窗框、3 种宽度的标题木牌、主 / 次按钮的常态 / 按下 / 不可用、关闭钮、开关、星、全部图标、印记、「已领取」印章、6 个标题字 |
| `chest_sheet.png` | 宝箱：现有程序网格（同一机位重渲，示意用）的闭合 / 打开 vs 新版闭合 / 打开 −118° |
| `night/` | 夜间乘色预览（见下面「夜间」一节） |
| `glb/result_chest.glb` | 宝箱 GLB（Draco，不内嵌贴图，带 0.5 s 开盖动作 `chest_open`）；`result_chest_preview.glb` 内嵌了调色板，只给查看器预览用，不进包 |
| `slices/` | 接入用的切图（pngquant `--quality 70-92 --speed 1`），实测字节数在 `slices/sizes.json` |
| `src/` | `build_popups.py`（Blender 建模 + 渲染 + 导出 GLB）、`palette_helpers.py`（从 (b) 的 `build_board.py` 原样抽出来的建模函数）、`ui_kit.py`（九宫格、按钮、开关、夜间系数）、`compose.py`（6 张全屏图）、`slices.py`、`sheets.py`、`night.py`、`popup_props.blend`（全部模型）、`raw/`（Cycles 原始渲染）、`inputs/`（(b) v2 的快照） |

重新生成：
```
blender -b --factory-startup -P src/build_popups.py -- /tmp/cpop 64      # → /tmp/cpop/raw/*.png, glb/, popup_props.blend
rm -rf src/raw && cp -r /tmp/cpop/raw src/raw && cp /tmp/cpop/glb/*.glb glb/ && cp /tmp/cpop/popup_props.blend src/
cd src && python3 compose.py .. && python3 slices.py .. && python3 sheets.py .. && SKIP_BOARD=1 python3 night.py ..   # 棋盘定稿后去掉 SKIP_BOARD 重出 board_night
```

## 统一弹窗框和通用按钮
- **弹窗框** `panel_frame_9s.png`（208×208）：做成「木框便签」：浅木底板，外面一圈扫掠成型的圆角木框，四角各一颗圆榫，中间是奶油纸面（`cream15 #f3e5c3`），纸面内圈带一道浅木唇边，有柔和投影。九宫格 **insets 四边都是 92px**，中间 24px 可以拉伸。原始渲染是 640px（顶视、正交），框边沿着长度方向是均匀的，所以拉长也不会变形。弹窗统一宽 640px（333pt）。
- **标题木牌** `title_plank_3s.png`（192×134）：浅木牌、奶油面板、两颗钉子，上面两根麻绳像挂在框上。三宫格，左右各 84px 不拉伸。标题压在弹窗上沿，中心比框的上沿高约 4px。木牌宽度 = 标题图宽 + 150px（最少 300px）。
- **主按钮 / 次按钮** `btn_primary_3s / btn_secondary_3s`（162×104，高 104px = 54pt）：浅木外圈，主按钮是青色面配白字，次按钮是奶油面配深棕字。三宫格，左右各 69px 不拉伸。按下：下沉 3px、变暗 6%（`WarmButton` 现有规则，命中区不动）；不可用：灰化、透明度 55%（kit_sheet 里有）。
- **关闭钮** `btn_close.png`（96×98）：跟 (b) 的暂停钮同一个造型（木圆盘 + 奶油面 + 两根木条交叉成 X），命中区 ≥ 44pt。
- **开关** `toggle_on / toggle_off`（115×56）+ `toggle_knob`（48×48）：浅木凹槽，开 = 青色，关 = 沙色；圆钮在 0.15 s 内左右滑动。
- **图标**：暂停面板用带木底座的 `tile_restart`（回旋的风 + 箭头）、`tile_bag`（T9 行囊）、`tile_settings`（T9 罗盘）；小图标有音乐（木刻音符 + 一片叶）、音效（小手鼓）、晴昼 / 夜色、减少动态（停着的小纸风车）、离开棋盘（小灯塔）、关于（T9 旅程册）、继续（三角）。震动图标已从切图里去掉（模型还留在 blend 里，以后要用可以直接出）。
- **音乐音量滑条**：不新增美术，用 `toggle_off` 当轨道、`toggle_on` 当已填充段（都按三宫格拉，左右各 28px 不拉伸），`toggle_knob` 当拇指。预览里音量是 0.4（`GameAudio` 默认值）。
- **字**：按钮和正文用系统字（预览里用 Noto Sans CJK 代替，0 字节）。**弹窗标题全部用烘好的霞鹜文楷图** `title_0..5.png`（暂停一下 / 重来这一关？/ 设置 / 获得 / 过关啦 / 差一点点，共 16,973 B），做法跟 a-loading 的 `gen.py` 一样：fontTools 取字形轮廓 → SVG → cairosvg 栅格化；因为底是浅色木牌，配色反过来：填充是深棕竖向渐变 #704826 → #4e3016，外面一圈 6px 奶油描边 #FFF6E2（85%）。以后加新标题就在 `slices.py` 的列表里加一行重出。
- **对比度**（WCAG，纸面按渲染实测 (226,222,194)）：深棕字 6.83、次要字 4.90、青字 #266268 5.10、主按钮白字 5.26，都 ≥ 4.5。

## 宝箱（Blender 4.5 重新建模）
- 低多边形木箱：3 条横板（木 / 浅深木交替，看得出板缝），深木箍带，金色包角和铆钉，正面一块金搭扣，盖上一颗青石搭扣舌和一片小叶子（呼应岛）。盖子是 7 段的半圆拱顶，带箍带和前后唇边。
- **按 Funning 的意见改成看得进去的箱子**：
  1. **机位俯角 22° → 40°**（方位 −24°），从斜上方往下看，箱口和箱底都露出来。
  2. **箱体是空心的**：四面墙各有 0.09 的厚度，箱口一圈浅木压边（`acornl`）把墙厚交代出来；四面内壁各贴三段衬板，从上往下 `floor3 → floor → darkwood` 逐段变深，加上内部的遮挡，越往里越暗；箱底是一块 0.10 厚的实心底板（`cap`）。盖子内侧也贴了一层 `floor2` 衬板。
  3. **箱里有东西**：40 枚金币堆成一个小丘（`gold / gold2 / lamp` 三色混排，`lamp` 是 T9 灯笼的发光行，接上原材质在游戏里会自己亮），三颗青石和一颗斜插的金星。渲染时箱里加了一盏暖色点光（只在打开状态和动画帧里开），合成时箱口上方再叠一层柔光，看起来像光从箱口往外冒。游戏里的光由 `lamp` 发光行 + `fx_rays` 承担，GLB 不带灯。
  4. **开盖角度 −105° → −118°**：盖子往后仰过竖直线 28°，不挡箱口。
- **GLB** `glb/result_chest.glb`：**29,536 B**（Draco，3,556 个三角面，预算 ≤ 60 KB；比上一版 11,716 B 多 17,820 B，主要是空心墙、内衬和金币）。两个节点：`chest_body`，子节点 `chest_lid`，盖子原点就在铰链上。不内嵌贴图，材质槽叫 `M_env_palette_piece`，在 Cocos 里重新绑到调色板材质上（M_env_palette，或者它粗糙度 0.36 的变体）。
- **开盖动画** `chest_open`（在同一个 GLB 里，已解出来核对过）：0.5 s，30 fps，0–15 帧，只转 `chest_lid` 的 X 轴：0 s 0° → 0.30 s −126°（过冲）→ 0.40 s −114°（回弹）→ **0.50 s −118° 停住**，跟静态打开图同一个角度。glTF 里是逐帧采样的四元数（16 个关键帧，LINEAR），Cocos 直接当 AnimationClip 播。关键帧示意 `chest_anim_keys.png`。
- 2D 方案备选：`chest_closed.png` 39,775 B + `chest_open.png` 50,257 B。只在不用实时 3D 的时候才需要（PM 已定用 3D，不进包）。
- 对比现状：`ResultChestGeometry.ts` 430,541 B（几何数据直接写在脚本里）+ `OriginalResultChestPainter.ts` 6,058 B + `resources/result-chest/chest-lit.effect` 2,469 B = **439,068 B**。

## 领奖界面间距（`reward_claim.png`，实测，px @750 宽）
按 alpha > 12 实测焦点层（光芒 + 柔光 + 宝箱 + 影子 + 三个获得物）的上下边界，然后往下排：
| 段 | px |
|---|---|
| 面板顶 → 焦点层顶（获得物） | 66 |
| 焦点层（含光晕和影子）高度 | 587（y 391 → 978） |
| 宝箱显示尺寸 | 320 × 392 |
| **焦点层底（含影子、光晕）→ 获得物文字顶** | **56**（> 一行字高 44：32px 字的行高） |
| 获得物文字字高 | 32 |
| **获得物文字底 → 说明文字顶** | **30** |
| 说明文字字高 | 29 |
| **说明文字底 →「收下」按钮顶** | **64** |
| 按钮高 | 104 |
| 按钮底 → 面板底 | 66 |
| 面板 | 640 × 1034，顶 y = 325 |
宝箱本体 + 影子（不算光芒）的底边离文字更远，约 80px；56px 是算上最外圈淡光芒之后的最小值。夜间版用同一套布局（`night/reward_layout_night.json`）。

## 现有设置项（从代码里读出来的）
| 设置 | 代码位置 | 现状 | 新版 |
|---|---|---|---|
| 静音（全局） | `audio/GameAudio.ts` `setMuted / isMuted`，key `qfl.audio.muted` | 有 API，**没有界面**；静音时音乐和音效一起关 | **不上界面**（保留 API） |
| 音乐音量 | `GameAudio.setMusicVolume`，key `qfl.audio.musicVolume`（0–1，默认 0.4） | 有 API，没有界面 | **「音乐」= 音量滑条**，直接接 `setMusicVolume` |
| 音效 | — | **没有单独的音效开关**（只有全局静音） | **「音效」= 单独静音开关**：需要 GGbot 在 `GameAudio` 里加 `sfxMuted` |
| 震动 | — | **代码里没有震动**（搜不到 vibrate / haptic） | **这一版不放** |
| 昼夜 | `world-r2/IslandJourneyOverlay.ts` settings 页「看看夜色 / 迎接晴昼」→ `options.toggleDayNight` | 岛上的「海岛小憩」卡片里有一个按钮 | 「晴昼 / 夜色」二选一 |
| 回屋小憩 | 同上，只是一行提示「轻点灯塔，回屋小憩」 | 只是文字 | 保留成一行提示，只在岛上显示 |
| 减少动态 | `OriginalLevelBackground.ts` 读 `forest-v33-reduced-motion`（或系统的 prefers-reduced-motion） | **只读，没有界面** | 「减少动态」开关，写同一个 key |
| 版本 / 关于 | 没有给玩家看的版本号（只有 Creator 3.8.8、`managedViewVersion 'mobile-managed-v1'`、`IslandPropsLayout.version 'T9-2026-10-11'`） | 没有 | 「关于《咦，起风了》」+「**v0.1 · 构建 xxxxxxx**」（构建时自动填 git 短 SHA，预览里是当前 worktree 的 d637356）+ 字体致谢 |
| 关卡里打开设置 | — | 关卡里没有设置入口 | 暂停 → 设置 |

## 夜间（`night/`，乘色，不另渲一套）
系数都直接从 `creator-build-project/assets/scripts/world-r2/IslandPropsLayout.ts` 读的（`src/ui_kit.py` 里写的就是这几个常量）：
- UI 和棋盘道具的 Sprite × **K_UI = `tag.nightFill / tag.fill` = #9a8f7f / #f8f2e2 = (0.621, 0.591, 0.562)**。T9 底排奶油标签夜里就是从 fill 变到 nightFill，换算成乘色就是这个值（相当于乘 #9f978f）。
- 背景（海和天）× **K_SEA = `seaNight.tint` #7f9fb3 = (0.498, 0.624, 0.702)**，跟 `seaColorAt` 的做法一样，按 sRGB 字节相乘。
- 过渡时长 `nightFadeS` 0.5 s，权重读 `propNightWeight()`。
- 文字：**Label 不跟着乘色**，单独换颜色。代码里的 `tag.nightText #2b1b0c` 放在乘过色的纸面上（纸面变成 (140,131,109)）只有 4.41:1，比 T9 标签的底色暗一点，所以夜间深棕字再深一档，用 (30,19,8)：4.85:1；次要字 (34,23,11)：4.67:1；青字 (6,30,34)：4.59:1；主按钮上的字用 (232,226,212)：8.49:1。如果 Label 也一起乘色，就只剩 3.79:1 和 3.57:1，**不达标**（数据在 `night/contrast.json`）。
- **夜间文字单独换色，对比度至少 4.5:1**（PM 决定 10）：Label 不跟着 Sprite 乘色，夜里换成上面这组颜色；以后新增的夜间文字颜色也要过 4.5:1（按乘过色的纸面 (140,131,109) 算）。标题是烘好的图，跟着 Sprite 乘 K_UI，深棕字在夜间木牌上更深、对比反而更高。
- **宝箱和星星只乘一半的夜间色**（PM 决定 6）：**K_HALF = 1 − (1 − K_UI)/2 = (0.811, 0.796, 0.781)**，保留一点暖光；光芒 `fx_rays` 和箱口柔光也乘 K_HALF。获得物（星光、风语铃、印记）和弹窗木件照常乘 K_UI，所以宝箱比周围亮一档，但整体还是偏暖灰、偏暗，不会跟夜景脱节。
- 文件：`board_night.png` 是 (b) 棋盘的夜间版（本轮没重出，见上）；`pause_night.png`、`reward_claim_night.png`、`result_win_night.png`（星星 + 宝箱都是半乘）是弹窗的夜间版；每张都另有一张 `*_day_vs_night.jpg` 并排对比；`contrast.json` 是对比度实测。

## 包体估算（pngquant 之后实测，`slices/sizes.json`）
| 组 | 切图 | 字节 |
|---|---|---|
| 弹窗框（精简版：无钉 / 无绳） | panel_frame_9s 9,621 + title_plank_3s 6,558 | **16,179** |
| 通用按钮 | btn_primary_3s 5,328 + btn_secondary_3s 5,668 + btn_close 6,128 | **17,124** |
| 暂停图标 | tile_restart 9,612 + tile_bag 9,238 + tile_settings 9,932 | **28,782** |
| 小图标 ×8 | music 2,484 / sfx 5,570 / sun 3,754 / moon 3,753 / motion 3,394 / home 3,012 / about 3,235 / play 1,204（去掉了 vibe 6,261） | **26,406** |
| 开关（也是音量滑条） | toggle_on 3,225 + toggle_off 2,986 + toggle_knob 1,956 | **8,167** |
| 结算 | star_full 10,485 + star_empty 8,738 | **19,223** |
| 奖励 | reward_seal_tide 8,223 + reward_seal_meadow 8,129 + reward_seal_sky 8,257 + fx_rays 16,796 + stamp_claimed 6,368 | **47,773** |
| 标题字（烘焙） | title_0 2,801 / title_1 4,460 / title_2 2,089 / title_3 2,322 / title_4 3,017 / title_5 2,284 | **16,973** |
| 宝箱 GLB | result_chest.glb（Draco，含开盖动画） | **29,536** |
| **合计（按 PM 的决定：3D 宝箱 + 烘焙标题，进包）** | 32 个文件 | **210,163 B ≈ 205.2 KB**（精简前 212,663，−2,500） |
| *(不进包)* 2D 宝箱备选 | chest_closed 39,775 + chest_open 50,257 | *90,032* |
| 最省组合 | 再去掉 fx_rays（改成程序光）和 star_empty（用 star_full 灰化） | 187,129 B ≈ 182.7 KB |

- **跟上一版比**：166,863 → 212,663，**+45,800 B**：标题图 +16,973、草甸 / 天空城印记和潮汐印记重出 +17,268、宝箱 GLB（空心箱 + 内衬 + 金币 + 动画）+17,820、去掉震动图标 −6,261。
- **跟现有资源比**：现在的弹窗、按钮、结算全是代码画的（Graphics + Label，0 B 贴图），所以这些切图都是新增的。宝箱换掉以后，删 `ResultChestGeometry.ts` 430,541 B + `OriginalResultChestPainter.ts` 6,058 B + `chest-lit.effect` 2,469 B = −439,068 B。
  - 合计：+212,663 − 439,068 = **净减 226,405 B（约 −221 KB）**。
  - 注意：`ResultChestGeometry.ts` 是脚本，**在主包里**，删了主包会小约 430 KB；新的切图建议放分包（见下），所以主包变小，分包变大。
- 奖励里的星光、风语铃、潮汐瓶直接用 (b) 的 `tool_*.png`，0 B。
- 打成图集以后大小会浮动 ±10% 左右。

## 接入建议（给 GGbot，等 Funning 确认以后）
1. **分包**：设置在岛上也要打开，所以弹窗框、按钮、开关、小图标、`tile_*`（约 105 KB）建议放一个 `ui_common` 分包，岛加载的时候一起加载（或者放进 `region_island`）；星星、印记、宝箱、光、印章跟结算走，放 (b) 建议的 `board_art` 分包。都不进主包。
2. **九宫格**：`panel_frame_9s` 用 Sprite SLICED，border 92/92/92/92；`title_plank_3s` border 左右 84；按钮 border 左右 69。弹窗宽 640px（333pt），高按内容来；四角的圆榫在九宫格的角区里，不会被拉伸。
3. **弹窗动效**（文档 §4）：打开 200–250 ms（淡入 + 0.92 → 1 缩放，ease-out），关闭 150 ms；遮罩模糊 + 压暗 35%；`BlockInputEvents` 挡住下层，第二根手指也不能点到下层。
4. **暂停**：左上暂停钮（(b) 的 `hud_pause`）→ 暂停面板。「继续」= 关面板；「离开棋盘」（b16 由「回到小岛」改名，行为不变）= 直接 `requestExit`（不再确认）；「重来」→ `pause_restart_confirm`（复用现有 `retryPanel` 的逻辑）；「行囊」→ 行囊面板（套统一外框，下一轮出图）；「设置」→ 设置面板（跟岛上共用一个节点）。面板打开时 `game` 计时暂停（现有的暂停逻辑）。
5. **设置**：音乐滑条 → `GameAudio.setMusicVolume(v)`（拖动时实时设，松手时存；0 时它自己会停 loop）；音效开关 → 新增 `GameAudio.setSfxMuted(b)` / `isSfxMuted()`，key 建议 `qfl.audio.sfxMuted`，音效播放入口（现在判断 `this.muted` 的两处，`GameAudio.ts:285` 和 `:631`）再加一个 `|| this.sfxMuted`；全局 `setMuted` 不上界面；减少动态 → 写 `forest-v33-reduced-motion`；昼夜 → `options.toggleDayNight`；所有开关点击走 `GameAudio.onButton()`，关闭走 `onUiBack()`。
5b. **版本号（给 GGbot 的接入点）**：关于页显示 `v0.1 · 构建 ${BUILD_SHA}`。
   - 构建时生成一个文件 `creator-build-project/assets/scripts/BuildInfo.ts`：`export const BUILD_VERSION = 'v0.1'; export const BUILD_SHA = '<git rev-parse --short=7 HEAD>';`。在现有的构建脚本（打包微信小游戏之前那一步）里加一行生成它，例如 `echo "export const BUILD_VERSION='v0.1'; export const BUILD_SHA='$(git rev-parse --short=7 HEAD)';" > assets/scripts/BuildInfo.ts`；仓库里提交一份 `BUILD_SHA='dev'` 的占位版，并在生成后不要再提交（或加进 `.gitignore` + 构建前生成）。
   - 工作区有未提交改动时可以在后面加 `-dirty`（`git describe --always --dirty --abbrev=7`），方便 QA 分辨。
   - 设置面板的「关于」Label 读 `BUILD_VERSION + ' · 构建 ' + BUILD_SHA`。版本号 `v0.1` 由 PM 改这一个常量。
6. **领取**：地区印记（潮汐 / 草甸 / 天空城三枚）、地区工具、主线奖励、本关宝箱都用同一个「获得」弹窗（替换 `WorldIntegrationBoot.ts:327-328` 只改按钮文字的做法）。顺序：宝箱出现 → 播 GLB 里的 `chest_open`（0.5 s，停在 −118°，配 `sfx_chest_open`）→ 光 `fx_rays` 慢转（1 圈 / 12 s）→ 获得物从箱口沿弧线升起 → 点「收下」后飞向行囊（暂停钮），数量 +1。已经领过的显示 `stamp_claimed`。宝箱 RenderTexture 的相机俯角用 40°（跟预览一致），否则看不到箱里。布局按上面「领奖界面间距」的数值排。
7. **结算**：星星一颗一颗落下（每颗 0.18 s，配音由 Voice bot 补），分数滚动，然后宝箱出现；失败页标题「差一点点」对应现在代码里的「再走一次」（lost 状态）。「还没存上」/ 只读这两种状态用同一个弹窗框：标题「还没存上」、橙色小标签「成绩还没保存」+ 主按钮「再保存一次」（本轮没出图）。
8. **夜间**：所有弹窗 Sprite 乘 K_UI；宝箱、星星、`fx_rays` 乘 K_HALF（`lerp(1, K_UI, 0.5 × propNightWeight())`）；Label 换成上面的夜间颜色（不要乘色，对比度 ≥ 4.5），0.5 s 跟着 `propNightWeight()` 过渡。
9. **宝箱 3D**：用 `ResultChest3D` 现有的 RenderTexture 方式渲染，把 mesh 换成 GLB，删掉 `ResultChestGeometry.ts`。测试 `test_result_*` 里写死的几何断言要按新模型改。

## 已定决策（PM 已通过，本轮已改进图里）
1. 设置：音乐和音效分开。音乐 = 音乐音量滑条，音效 = 单独静音；全局静音不上界面。
2. 震动这一版不放（图和切图里都去掉了）。
3. 弹窗标题全部用烘好的霞鹜文楷图（`title_0..5.png`，16,973 B），跟加载页同一套流程。
4. 宝箱用 3D 模型，GLB 里带 0.5 s 开盖动画（过冲 + 回弹），示意图 `chest_anim_keys.png`。
5. 关于页写「v0.1 · 构建 xxxxxxx」，构建时自动填 git 短 SHA（接入点见接入建议 5b）。
6. 夜间宝箱和星星只乘一半夜间色（K_HALF）。
7. 失败页标题「差一点点」。
8. 暂停里保留「设置」。
9. 草甸、天空城的地区印记各出一枚：同一枚木圆章 + 奶油章面 + 地区色细圈 + 地区图案（潮汐：两道浪 + 小星光；草甸：小山坡 + 三片草叶 + 一朵小白花；天空城：一朵云 + 一颗小星），顶上一个麻绳小环。
10. 夜间文字单独换色，对比度至少 4.5（见「夜间」）。

## 下一轮界面（r2，全部在 `r2/`）
Funning 的意见：现状都是代码画的空奶油板、大片留白、纯文字列表，没有图标也没有木质感。r2 每一张都用 (c) 的弹窗框 / 文楷标题木牌 / 通用按钮，新加的卡片框、道具格、章节路牌也是 Blender 里同一套浅木色块渲出来的。

**先读了代码，面板的真实数据和状态：**
| 面板 | 代码位置 | 数据 / 状态 |
|---|---|---|
| 首次获得道具 | 无 | **现在没有**「第一次见到某道具」的记录，需要 GGbot 在 journey 存档里加 `seenTools`。道具名只在道具栏下方小字里（`TOOL_NAMES`，ManagedTools.ts）。星光 = engine 的 `bomb`：清 3×3，**不花步数**（`bomb()` 不减 moves），每关 `bombs = 2`。风语铃 = cross（十字），潮汐瓶 = bigBomb（5×5），都不花步数。 |
| 岛上行囊 | IslandJourneyOverlay.ts `page==='bag'` | `mainlineStatus().journey.inventory.tools`：windBell / tideBottle / tideNet / sunSeed / starShears 五个计数；标题「旅人的行囊」，副标题「随身物品 · 只读查看」，底部「在关卡中使用道具」。岛上版**不显示**装扮和宝箱。 |
| 关卡内行囊 | ManagedMobileBoardUI.ts `paintBag()` | 同样五个道具计数 + `inventory.charms`（装扮，空时「还没有装扮」）+ 已获得宝箱列表（`journey.chests` 里 earned 的，未开 =「打开第 N 关宝箱」→ `openChest`，已开 = 灰）+ 分页 +「关上」。道具栏另有 `bomb`（星光，每关送）和 `pearl`（珍珠，已删）。 |
| 旅程册 | IslandJourneyOverlay.ts `page==='journal'` | 三章 CHAPTERS（潮汐小径 / 花粉草甸 / 天空回声 + 一句描述）；每章 `gates().r5` 的 `ok / reason`：`stage-locked`→「主线解锁后开启」、`completion-unsaved`→「先保存当前成绩」、进行中→「请先继续当前挑战」。按钮小字 ok =「翻开这一章」否则「查看这一章」。进度：主线 12 关，`region = floor(level/4)`，每章 4 关，`journey.records[i].bestStars`；印记 = `journey.regionRewards[region].claimed`。 |
| 海岛小憩 | IslandJourneyOverlay.ts `page==='settings'` | 岛上「设置」按钮打开的就是它。副标题「让旅程慢一点」；主按钮 **夜间「迎接晴昼」、白天「看看夜色」**（`night ? '迎接晴昼' : '看看夜色'`，点了调 `toggleDayNight`）；下面一行「轻点灯塔，回屋小憩」。 |
| 还没存上 | ManagedMobileBoardUI.ts `paintResult()` | `state === 'result.unsaved'`（结算时存档失败）或 `'run.unsaved'`（对局中存档失败）。标题「还没存上」，按钮「返回海岛」（requestExit）+「重试保存」（retrySave）；regional 的说明是「保留当前记录，不开启新局」「保存暂未完成 · 请重试」。 |
| 只读结算 | 同上 + ManagedBoardSession.ts | `state === 'error.readonly'`（存储只读 / 记录保护，provider 拒绝写入；`readOnly=true` 时棋盘不响应）。regional 标题「只读保护」、说明「保留当前记录，不开启新局」「记录保护 · 请返回检查」；主线界面标题会落到「再走一次」。只有「返回海岛」。 |
| 灯塔目标格 | engine.js `beaconTarget()` + ManagedMobileBoardUI.ts:262 | 关卡目标 `beacons: N`，路线 `beaconRoute` 上**每次只亮当前一格**（cursor / total）；`typed` 时必须在这一格消除指定图案。现在只画一圈 2px `#ffe59c` 圆角描边，HUD 用代码画的 lamp 小图标。 |

**文件**（750×1624，都在 700 KB 以内）：
- `r2/item_intro_starlight.png` 首次获得道具（星光样张）
- `r2/bag_island.png` 行囊 · 岛上版；`r2/bag_level.png` 行囊 · 关卡内版（盖在 v3.1 棋盘上，**没有珍珠**）
- `r2/journey_book.png` 旅程册
- `r2/island_rest_night.png`（主按钮「迎接晴昼」）/ `r2/island_rest_day.png`（「看看夜色」）海岛小憩
- `r2/result_unsaved.png` 还没存上；`r2/result_readonly.png` 只读保护结算
- `r2/board_beacon.png` 灯塔目标格（v3.1 棋盘，目标在第 3 行第 4 列的青叶上）；`r2/beacon_closeup.png` 近看 + 眯眼测试（现状 / 任意图案 / 指定青叶 / 和提示同时出现）
- `r2/compare/compare_*.jpg` 8 张：现状 | 新版 | T9 基准列。现状用的是 Funning 给的 4 张截图；首次获得没有现状，标「新增」；还没存上 / 只读没有截图，写了代码里的样子；灯塔按代码描边模拟。
- `r2/slices/` 切图 + `sizes.json`
- 源码：`src/round2/`（`compose2.py` 全屏图、`beacon.py` 灯塔棋盘（原样读入 (b) v3.1 的 compose.py，只插两个钩子）、`sheets2.py` 对比图、`slices2.py` 切图、`render_hero.py` 道具大图）；新模型加在 `src/build_popups.py` 的「round 2」一节，原始渲染在 `src/round2/raw/`。

**各张做了什么：**
1. **首次获得道具**：(b) v3.1 的星光模型原样打开 `board_props.blend`，用 (b) 的焦点灯光和道具机位，分辨率从 192 提到 720 重渲（`render_hero.py`，不保存 blend），面板里显示 400 px；后面放 (c) 领奖的放射光。标题木牌是道具名（文楷烘焙），「新道具」小牌，两行用途 + 一行条件，主按钮「知道了」。风语铃、潮汐瓶的大图和文案也备好了（`hero_windbell / hero_tidebottle`，同一个函数可出）。
2. **行囊**：每件道具一个木框格子（`slot_frame`），(b) 的 3D 道具图标 + 名字 + 右上角数量徽章；**数量 0 整格灰化**（去色、半透明、灰徽章）。(b) 里只有星光 / 风语铃 / 潮汐瓶，**潮汐网、日光籽、星剪三件是本轮按 (b) 道具的做法补的 3D 模型**（同款木托、同机位、同焦点灯光，192 px，道具栏也能直接用）。「装扮」空状态做成插画卡：一根挂衣杆、三个虚线空位、一枚半透明的青色蝴蝶结（3D）+「还没有装扮 / 旅途里收到的小装扮，会挂在这里。」关卡内版多一组宝箱条目（3D 宝箱 + 第 N 关 +「打开」/「已打开」）和「关上」；星光不在行囊里（每关送的），用一行字说明。
3. **旅程册**：三章做成 **T9 路牌形的章节木牌**（新模型 `sign_plank`，右端箭头，三宫格），左边是三枚地区印记；已开章节显示 ★ x / 12 和 4 关进度点 +「翻开 ›」，未解锁的整牌去色 + 金锁 +「主线解锁后开启」。底部是册子合计（★ 13 / 36、三枚印记收集状态），右上角一条青色书签丝带，读起来像一本册子。
4. **海岛小憩**：两扇小窗做昼夜示意（同一座小岛，夜色按 seaNight 乘色），当前那扇金框高亮 +「· 现在」，配太阳 / 月亮图标；主按钮夜间「迎接晴昼」（太阳图标）、白天「看看夜色」（月亮图标）；「轻点灯塔，回屋小憩」做成一张提示卡，左边是 3D 小灯塔。夜间版面板按 K_UI 乘色，文字单独换色（同 (c) 规则）。
5. **还没存上**：保留星星和分数；一张提示卡（旅程册图标 + 橙色「!」）写「成绩还没存进旅程册 / 这局的记录都还留着，再存一次就好。」；奖励宝箱灰显「存好后才能打开」；主「重试保存」、次「返回海岛」。
6. **只读保护**：3D 金锁 + 柔光，说明「这台设备上的记录暂时不能写入 / 为了不弄丢已有的进度，这局不会保存，也不会开始新的一局。」；成绩卡（星星 + 分数）加「只看 · 不登记」；只有「返回海岛」。
7. **灯塔目标格**：目标格底下一整块暖金光（溢到四周一圈）+ 3D 金色灯座框（四角四颗灯珠，和格子同机位）+ 格子右上角一座亮着的小灯塔（3D，红白塔身，灯室光晕和两道短光束）；HUD 目标换成同一座灯塔。指定图案时，灯塔脚下多一枚小圆牌画出要消除的棋子。**和「提示」区分**：提示是格子外沿的金色描边脉冲，灯塔是格内的实心暖光 + 灯塔，形态不同（`beacon_closeup.png` 第 4 格是两者同时出现）。

**r2 包体**（pngquant 之后实测，`r2/slices/sizes.json`）：
| 组 | 切图 | 字节 |
|---|---|---|
| ~~卡片~~ | 精简后不再用 card_frame / slot_frame（道具格、宝箱条目改成程序画的浅平底，0 B） | **0**（−5,017） |
| 旅程册 | sign_plank_3s 9,098（无钉横幅，高 176）+ region_tide 13,021 + region_meadow 7,930 + region_sky 4,821 + region_sky_locked 2,922 | **37,792** |
| 首次获得 | hero_starlight 27,628（+ 可选 hero_windbell 25,359、hero_tidebottle 26,253） | **27,628**（全三张 79,240） |
| 行囊 | tool_tidenet 10,595 + tool_sunseed 11,443 + tool_starshears 10,203 + icon_charm 7,396（三件地区道具已换 v2） | **39,637** |
| 结算 | icon_lock 3,652（改成 72 px，显示 36–64 px） | **3,652** |
| 灯塔目标格 | beacon_lighthouse 3,557 + beacon_ring 2,135（暖光池程序画，0 B） | **5,692** |
| 标题字（烘焙） | 星光 / 旅人的行囊 / 旅程册 / 海岛小憩 / 还没存上 / **旅途回顾** + 章节名 潮汐小径 / 花粉草甸 / 天空回声（40 px） | **30,773** |
| **r2 合计（只放星光大图）** | 22 个文件 | **145,174 B ≈ 141.8 KB**（精简前 126,006，+19,168：四张地区之窗 +28,694，去卡片框 −5,017，锁缩小 −4,578，路牌 −699，标题 +768） |
| r2 合计（三张道具大图都放） | 24 个文件 | 196,786 B ≈ 192.2 KB |

- 复用、0 B：弹窗框、按钮、关闭钮、星星、三枚地区印记、宝箱、放射光、太阳 / 月亮 / 灯塔 / 旅程册小图标（都在 (c) 里），星光 / 风语铃 / 潮汐瓶道具图标（(b)）。
- 跟现有资源比：这几个面板现在全是代码画的（0 B），所以 r2 全部是新增。**(c) + r2 合计 210,163 + 145,174 = 355,337 B ≈ 347.0 KB**（精简前 338,669，+16,668）；算上删掉旧宝箱脚本（−439,068 B）仍净减约 100 KB（主包减、分包增）。
- 道具大图如果改成直接在弹窗里用 (b) 的 192 px 道具图放大，可以省 27,628 B，但放大到 400 px 会糊，不建议。

## r2 修订 · 第一批（三件地区道具 + 精简样张）

### 三件地区道具 v2（`r2/region_tools_compare.png`，旧 ↔ 新，各 1x / 2.5x / 灰度）
- **潮汐网**：做成短柄小抄网，侧躺在木托上。网口朝镜头，网兜是真镂空网眼（bmesh wireframe），往右后方垂下去；兜里有一枚珊瑚色扇贝和一枚青色海螺，网圈上系一只红白浮漂，深木短柄末端有一颗圆把手。不再是正面平网，所以不会再像球拍。
- **日光籽**：一颗深色葵花籽，带白色纵纹，尖头朝下插在小土堆里，顶上冒出一根弯芽和两片子叶，背后立一枚金色小太阳（圆盘加 12 道三角光芒）。种子加太阳，一眼就能看懂。
- **星剪**：一把剪刀，两片长刃张开成 X，刃口有亮线；指环往外撇开，变成两只大金指环，彼此不再挤在一起。轴心是一颗金星螺丝，一片刃尖上挂着一颗小星光。
- 建模和灯光跟 (b) 一样：Blender 4.5，M_env_palette，焦点灯光。按要求**没有并进 (b)**，只替换 `c-popups/src/round2/raw/` 和 `r2/slices/` 里的三张图标。旧版留在 `src/round2/raw_v1/`。行囊两版（`r2/bag_island.png`、`r2/bag_level.png`）已经换成新图标，compare 也重出了。
- 包体：行囊组 39,496 → 39,637 B（+141 B），r2 合计 125,865 → 126,006 B。

### 精简样张（Funning 精简原则；只做行囊·岛上版和旅程册两张，`r2/lite/`）
- `r2/lite/bag_island_lite.png`、`r2/lite/journey_book_lite.png`：750×1624 全屏
- `r2/lite/compare_bag_island_r2_vs_lite.jpg`、`r2/lite/compare_journey_book_r2_vs_lite.jpg`：r2 现版和精简版并排
- 结构：外框只留一层浅木，用新渲的**无角钉**版 `panel_frame_clean`。标题木牌去掉了绳和钉（`title_plank_clean`），章节路牌也去掉了钉（`sign_plank_clean`）。内容直接放在底板上，行囊的道具格只垫一层很浅的平底，不加描边。外框宽度从 640 改成 680，这样格子和路牌两边能留出 24 px 以上的空。
- 行囊：去掉副标题、「道具 / 装扮」小节标签、虚线、底部说明、格子木框，以及挂衣杆、挂钩、星点。道具格 160×192，图标 136 px，按 3 + 2 居中排；数量角标改成 22 px 的小胶囊，数量为 0 的整格灰掉。「还没有装扮」只留一枚半透明的 3D 蝴蝶结、一圈落影和一句话。
- 旅程册：每张章节牌只放印记、章节名（文楷 40）和主线星数（每章 12 星）。地区挑战单独用一枚小标记「⚑ 挑战 x/4」（r05 每区 4 关）。未解锁的章节去色，加金锁，再配一行极淡的「主线解锁后开启」。描述、进度圆点、「翻开 ›」、底部合计、书签丝带和底部提示都去掉了。潮汐小径的新描述「听潮声，捡起海浪送来的贝壳。」挪到章节详情里用，不放在牌上。
- 间距全部是 8 的倍数（16 / 24 / 32 / 64 / 104）。每张最多三级字号：行囊是 46 / 26 / 22，旅程册是 46 / 40 / 24。
- 替换件切图（`r2/slices/` 里的「精简样张（替换件）」组，**不计入 r2 合计**）：panel_frame_clean_9s 10,871 + title_plank_clean_3s 6,558 + sign_plank_clean_3s 8,820 = 26,249 B。确认后这三张直接替换同名旧件，所以包体基本持平（旧件 panel_frame_9s、title_plank_3s、sign_plank_3s 一起删掉）。
- 其他面板（关卡内行囊、海岛小憩、还没存上、只读结算、道具介绍）和 PM 第 2、5、6、7 条（海岛小憩改成点小屋、旅途回顾标题、宝箱灰显文案、灯塔路线点和橡果特写）**还没做**，等 Funning 确认这两张样张后，再按同一套精简规则一起推。

## 精简规则推到全部面板（Funning 确认；本轮）
**三个决定**：面板宽统一 680；去掉角钉、挂绳和钉子的木框推到所有弹窗；「⚑ 挑战 x/4」标记沿用。

**全局改动**（`src/ui_kit.py`）：`panel()` 改用 `panel_frame_clean`（无角钉），`title_plank()` 改用 `title_plank_clean`（无绳无钉，标题字垂直居中 0.52）；`PW=680`。旧的有钉渲染留在 `src/raw/panel_frame_pegs.png`、`title_plank_ropes.png`。精简前的全屏图快照放在 `src/_old_snap/`，用来出「旧版 vs 精简版」。

| 面板 | 文件 | 精简内容 |
|---|---|---|
| 暂停（定稿） | `pause.png` | 只换无钉外框、宽 680，布局不动 |
| 重来确认 | `pause_restart_confirm.png` | 重来图标 + 一句「这一局会从头再来」+ 留下 / 重来 |
| 设置 | `settings.png` | 去掉分隔线、字体署名行（移到「关于」二级页）和「轻点灯塔」提示行；行距 112，「关于」一行 32 / 26 |
| 领奖 | `reward_claim.png` | 去掉四颗星点；间距 56 / 32 / 64 / 56（宝箱层底到文字 56 px，大于一行 44 px） |
| 过关 | `result_win.png` | 去掉分隔线、「本关奖励」标签和说明小字；字号：正文 28、数字 64 |
| 差一点点 | `result_lose.png` | 合成一句「步数用完了，换个顺序试试？」；去掉「还差 / 奖励」标签；还差目标 ×n（40）；宝箱灰显 |
| 道具介绍 | `r2/item_intro_starlight.png` | 3D 大图 + 道具名 + 两行用途 +「知道了」；去掉「新道具」胶囊、条件小字和星点 |
| 行囊 · 岛上 | `r2/bag_island.png` | 同已确认的样张 |
| 行囊 · 关卡内 | `r2/bag_level.png` | 盖在 v3.1 棋盘上；道具格同岛上版；宝箱每条只放宝箱图标、关卡名、「打开」（528×96 浅平底）；关闭只用 × |
| 旅程册 | `r2/journey_book.png`（= `r2/lite/journey_book_lite.png`） | 每章一张横幅路牌（544×176），左边一扇「地区之窗」200×128：潮汐小径用本作 `combined_visual_m.glb` 实渲（Cycles，去掉天穹 / 云层 / 夜间件 / 室内件），花粉草甸和天空回声是低多边形占位（图上标「占位」）。印记缩到 64 px 压在窗角，然后是章节名、主线星数 x/12、「⚑ 挑战 x/4」（r05 每区 4 关）。天空回声未解锁：去色 + 加雾 + 金锁 + 一行极淡说明。小图柔焦（模糊 1.1 px、饱和度 0.82、罩 16% 纸色），不抢标题 |
| 海岛小憩 · 昼 / 夜 | `r2/island_rest_day.png` / `r2/island_rest_night.png` | **改成点小屋时弹出**。两扇昼夜小窗（当前那扇金边）+ 主按钮（夜「迎接晴昼」/ 昼「看看夜色」）；去掉副标题、「天色会慢慢转过去」和提示卡（已经是点小屋打开的，不用再提示） |
| 还没存上 | `r2/result_unsaved.png` | 星星 + 分数 + 一行「! 成绩还没存进旅程册」；宝箱灰显「**存好后就能打开**」；重试保存 / 返回海岛 |
| 旅途回顾（只读） | `r2/result_readonly.png` | 标题「**旅途回顾**」（文楷切图 `r2/slices/title_旅途回顾.png`）；星星 + 分数 + 一行带锁的「记录暂时不能写入，这局只看不存」；只有「返回海岛」 |
| 灯塔目标格 | `r2/board_beacon.png`、`r2/beacon_closeup.png`、**`r2/beacon_acorn_closeup.png`** | 目标放在橡果格 (2,4)。暖光提亮一档：外溢更大更亮、格内暖金更浅、中心亮点更白，再加格子外沿一圈压在棋子上的暖光晕，并轻轻滤色提亮橡果本身。后面几格路线（示意 (4,5)→(5,3)）用很淡的暖点标出：每格下沿一颗，格间两到三颗更淡的过渡点 |

**对比图**
- 每个面板一张「旧版 vs 精简版」：`compare/old_vs_lite_*.jpg`（6 张）、`r2/compare/old_vs_lite_*.jpg`（9 张）、`night/old_vs_lite_*_night.jpg`（3 张）。
- 原来的「现状 + T9 基准」对比图（`compare/compare_*.jpg`、`r2/compare/compare_*.jpg`）全部用新图重出了。
- 夜间图（`night/pause_night.png`、`reward_claim_night.png`、`result_win_night.png`、`r2/island_rest_night.png`）也已重出。夜间棋盘沿用 v3.1 的 `night/board_night.png`。
- 总览：`overview_all_panels.jpg`（18 张缩略图，574 KB）。

**包体变化**
- (c)：212,663 → 210,163 B（−2,500，无钉外框和木牌更小）。
- r2（只放星光大图）：126,006 → 145,174 B（+19,168，主要是四张地区之窗）。
- 合计：338,669 → 355,337 B（+16,668）。花粉草甸、天空回声的场景建好后，要用正式风景替换占位，体积相近。

## 还需要决策 / 待办
1. **宝箱 GLB**：29.5 KB（预算 60 KB 内），保持 40 枚金币；想省可以减到 20 枚（约 −6 KB）。
2. **三件地区道具 v2**（短柄小抄网 / 插在土里冒芽的葵花籽 + 小太阳 / 张开的金环剪刀）还没并进 (b)，等 Funning 确认。
3. **海岛小憩改成点小屋弹出以后，岛上的「设置」按钮打开 (c) 的完整设置**：昼夜同时也在设置里。设置里不再写「轻点灯塔 / 小屋」提示；第一次怎么让玩家知道可以点小屋，建议用小屋上的一次性气泡，不放进面板。
4. **首次获得弹窗需要新存档字段**（例如 `seenTools`），GGbot 接入时要加。
5. **旅程册的地区之窗**：花粉草甸、天空回声是占位风景，等场景建好后用同一个脚本（`src/round2/render_regions.py`）重渲。地区之窗要不要做夜间版（现在按 K_UI 乘色）？
6. **灯塔路线**：图里的后续格 (4,5)→(5,3) 是示意。真实顺序要由关卡数据提供；运行时 `beaconTarget` 只有 cursor 和 total，没有后续格的坐标，GGbot 需要从 provider 读出后续格位置。
7. 关卡内行囊第一屏放 2 个宝箱条目，更多时沿用代码分页（图里没画）。
8. 设置里的字体署名移到「关于」二级页，那一页还没出图。

