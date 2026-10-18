# r5 U1 · UI 准备单：产出汇总

分支 `ui/r5-design`，基于 `gbt/r5-integrated-b07-wip`（`bc81575`）。三项都只是准备：**不定稿、不改游戏代码、不合并**。这个分支只加了 `docs/r5/ui/` 下的文件。

## 1. 结算画面备选稿 → `docs/r5/ui/result/`
- `result_v2.2-{390x844,375x667}.jpg`：v2.2 现状。用 harness 跑真实的 `BoardPanels.openResult()` 导出节点，再配上包内切图画出来。预览工具的 harness 说明字用红框标出：要去掉。
- `result_v3A-*.jpg`：v3-A 焦点收拢，推荐。结构不变，按精简规则重排；星星放大，失败页目标居中，开箱后写出奖励名。
- `result_v3B-*.jpg`：v3-B 星星主角 · 底卡。改动大。
- `compare_{390x844,375x667}.jpg`：三版并排。
- 三个版本的底部按钮（含投影）离面板内沿都是 16 pt（图上有标尺）；v3 图上都没有 harness 字；失败文案改成更友善的说法。
- 详情和决策点见 `result/README.md`。

## 2. 规范 → `docs/r5/ui/UI-GUIDE.md`
- 内容：字号（实际 pt 和三级建议）、颜色（调色板、文字昼夜色、遮罩、光晕、K 系数）、间距（女孩 ≥ 13 pt，出处 `GIRL_STAND.minGapPt` / `UI_GAP_PT`）、安全区（`boardSafeInsets` 的兜底、CSS、微信 safeArea、胶囊规则）、7 种竖屏。
- 7 种竖屏取自 `docs/r5/transitions-DESIGN.md` §4.1：390×844、414×896、360×780、375×667、390×520、320×568、768×1024。每种屏幕的布局数值是 harness 跑真实 TS 算出来的（`result/src/layouts_7screens.json`），分档规则都标了代码出处。

## 3. 解锁提示改红点 → `docs/r5/ui/unlock/`
- `UNLOCK-REDDOT.md`（现状分析 + 两个方案）、`unlock_A_journal.jpg`、`unlock_B_signpost.jpg`、`reddot_spec.png`、`state_A.png`、`state_B.png`。
- 现状：`unlockHint` 还在 `ManagedMobileBoardUI.ts:912` 里计算，但 SPEC v2.2 把结算页上的那一行删了，**现在玩家完全看不到解锁提示**。
- 方案 A（推荐）：所有解锁都汇到旅程册，岛屏只有旅程册一个点，章节牌上再细分。
- 方案 B：新主线关放路牌，新挑战 / 新章节放旅程册。
- 两个方案的“已看”都存在 localStorage `qfl.ui.seenUnlocks`，不写旅程存档；老玩家第一次启动时迁移成已看。

## 需要 PM 决定
1. 结算选 v3-A / v3-B，还是保持 v2.2。
2. 「底部按钮距底边 16 pt」的“底边”指面板内沿（现在代码的做法），还是安全区底。
3. 开箱后要不要写出奖励名；失败文案用哪一句。
4. v3-B 底卡在区域棋盘上可能盖住女孩，能不能接受。
5. 红点选方案 A 还是 B；天空城 3D 入口要不要亮点；localStorage 丢失后重亮能不能接受。
6. 结算页宽度要不要和其他弹窗统一成 680 × scale（现在结算封顶 350 pt，其他弹窗在 414 / 768 上是 375 / 422）。

## 已知问题
- **存档出错的提示现在不显示**：`hostResultError` 和 `unlockHint` 共用一个字段，v2.2 删掉这一行以后，两个都看不到了。这是 v2.2 的副作用，要单独修，和红点方案无关。
- v2.2 失败页：目标图标贴在左边，「×3」离得很远（`ResultGoalCount` 左对齐）。
- 仓库和预览机上都没有 v2.2 的实机截图（`work/rsv2/` 不在这台机器上）。现状图是 harness 复原：3D 宝箱用 2D 兜底图代替，棋盘底图是示意。
- 390×520 和 768×1024 没有真机胶囊样本；测试真机行的下安全都写 34，没有覆盖下安全为 0 的机型。
- 本机自带 Node 20，跑不了这些测试，要 Node ≥ 22.6。这次是临时下载官方 Node 22.23 到 `/tmp/node22`，另外装了 typescript 到 `/tmp/qfts`（`QF_TYPESCRIPT_MODULE` 指向它），只在本机临时目录，没有进仓库。用它跑过 `test_result_screen_style`、`test_result_safe_area`、`test_result_viewports`，都通过。

## 怎么重出图
```sh
python3 docs/r5/ui/result/src/render_result.py     # 结算 8 张
python3 docs/r5/ui/unlock/src/render_unlock.py     # 红点 5 张
# 需要重新导出节点 / 布局时（Node ≥ 22.6）：
QF_TYPESCRIPT_MODULE=<typescript 路径> node docs/r5/ui/result/src/dump_v22_nodes.cjs   # 输出 /tmp/r5ui/dump.json → 复制成 v22_nodes.json
QF_TYPESCRIPT_MODULE=<typescript 路径> node docs/r5/ui/result/src/dump_layouts.cjs
```

## 定稿（2026-10-18）· v3-A + 红点方案 A

- 用户拍板：结算用 **v3-A**，红点用 **方案 A**。PM 三条：开箱后写奖励名；按钮离面板内沿 16，面板离安全区 ≥ 16，矮屏按 N/C/M/X 降档；面板宽 = round(680 × popupScale)。
- 实现说明（给 Cursor）：[`final/IMPLEMENT.md`](final/IMPLEMENT.md)
- 定稿图：`final/result_390x844.jpg`、`final/result_375x667.jpg`、`final/redline_*.jpg`、`final/reddot_A_*.jpg`、`final/result_night_390x844.jpg`、`final/result_7screens.jpg`
- 新增切图只有 `final/assets/reddot.png`；其余都复用 `bundles/board_art`，见 `final/assets/kit_preview.png`。
- 另记录了一个 bug：「存档出错提示行被删」（d6a0019f），见 IMPLEMENT §9。

## U2 · 对话框重做（对比稿，2026-10-18）

- 只出对比图，不写代码，不出定稿：[`dialog/README.md`](dialog/README.md)
- 对比图：`dialog/compare_390x844.jpg`、`dialog/compare_375x667.jpg`（2026-10-18 已用 Blender 新渲底图重出覆盖，见下一节；原来的 evidence 旧模型截图停用）
  - 三栏：现有（IslandToast 吐司，仓库里没有角色对话框）· 方案 A 海风气泡 · 方案 B 折角纸牌。
- 推荐 **A**：框外的水平名字胶囊加指向说话人的尾巴，和现有的吐司、弹窗同一家族；离女孩 20 / 17.8 pt。
- 字体：名字用资源圆体 Bold，正文用思源黑体 Bold，都是 SIL OFL 1.1。只打包用到的字：名字约 4 KB，正文约 0.3–0.4 MB。
- 要用户来定：A 还是 B；正文用思源子集还是系统字体；简繁。矮屏的对话镜头由运镜来定。

## U2 · 对话框定稿 · 海风气泡（2026-10-18）→ `dialog/final/`

- Funning 选了方案 A。定稿说明写给 Cursor：[`dialog/final/IMPLEMENT.md`](dialog/final/IMPLEMENT.md)（节点树、7 屏坐标、离女孩 ≥13 / 离安全区 ≥16 的公式、尾巴投影规则、字号行高分页、名字配色、动效、夜间、接入文件、验收清单）。不改游戏代码。
- 角色名「阿芳 / 阿宁 / 老铆 / 灯塔下的旅人」继续是**占位名**。
- **底图全部 Blender 重渲**：角色 `/workspace/yiqifengle/previews/角色动画bot/r5-wrist-footik/final/chr_b_r5g2_r5wrist_v4_final.glb`，场景源 SHA `bc81575f`（`creator-project/assets/firstslice/combined_visual_m.glb` + `combined_anchors_m.json`），机位 = 游戏回家跟拍 `TRANSITION_CAMERA.returnFollow.out`（position (-2.3019, 1.95, 4.6599) → target (-1.3312, 0.86, 2.6507)，fov 60° 竖直，女孩在 toThreshold 进度 0.60，背影）。每张底图的机位在 `dialog/final/raw/bg/*.json`。旧 evidence 截图（r4 旧模型）不再使用；`dialog/compare_*.jpg` 已用新底图重出。
- 切图（`dialog/final/assets/`，Blender 阶段一光照 + 色板，pngquant）：气泡九宫格（insets 144 px = 48 pt）、尾巴上 / 左 / 右、名字胶囊外圈 + 白底（代码着色）、翻页箭头；共 7 张，合计约 46 KB。
- 字体：名字 QFL Dialog Name（资源圆体 Bold 子集）、正文 QFL Dialog Body（思源黑体 SC Bold 子集，转 glyf 的 .ttf），只收 GB2312 简体，改名避开保留名 “Source”，附 OFL 原文。脚本草案 `dialog/final/tools/build_dialog_fonts.py`。实测：名字 6.1 KB；正文 39.5 KB（示意台词 126 字）/ 221.9 KB（800 字）/ 993 KB（GB2312 一级 3755 字上限）。
- 定稿图：`dialog/final/dialog_390x844.jpg`、`dialog/final/dialog_375x667.jpg`（单行 / 三行 / 长名字 / 旁白 / 多页 / 换说话人 / 夜间），`dialog/final/dialog_7screens.jpg`，`dialog/final/redline_dialog.jpg`；对比 `dialog/compare_final_390x844.jpg`（旧 IslandToast / 对比稿 A / 定稿 A）。
- 规则变化（相对对比稿）：每页行数按「气泡底到女孩底 +13」之间放得下几行算，上限 3。390×844 放 3 行；375×667 放 2 行（三行台词自动分页，离女孩 14.2 pt）。新底图下对比稿 A 在 375 上只离女孩 6.2 pt，定稿已解决。
- IslandToast **保留**（系统提示），对话框是新组件；对话时吐司暂存，关闭后补出。
- 要别人定 / 做：390×520、320×568 在默认跟拍镜头下 1 行都放不下，需要运镜在对话时让位（试过 targetHeight −0.10 m 可行）；对话时女孩是背影，是否转身 / 换镜头待定；真机字体渲染和加载没测。

## U2 定稿 · 小修：尾巴 + 白天光照（2026-10-18）

- **尾巴**：定稿 A 的尾巴几乎看不见。原因是切图本身：底宽 22 × 高 12，又套了气泡同款 3 pt 倒角和 2.6 pt 圆尖，尖被磨成约 7 pt 高的小鼓包；尾巴也没有投影，奶油色贴在米黄小路上分不出来。钳制规则没有把它藏掉（tx = 194.9，在允许范围内）。修正：常规档 **30 × 15 pt**（390×844 等），紧凑档节点缩 0.867 → **26 × 13 pt**（375×667 仍放 2 行，离女孩 14.2 pt）；倒角 2 pt、圆尖 1.6 pt，伸出部分加投影（1.5 / 3 / 0.30），同色同材质，5 pt 平板盖进气泡。规则见 `dialog/final/IMPLEMENT.md` §10.1，验收清单加了一条。
- **白天光照**：黄裙子太亮、太平。原因是 `render_scene_bg.py` 白天用 sun 3.2 / 天空 0.9 + Standard（没有色调映射），裙子 88% 像素削顶。先试 AgX（光照不变）：不削顶，但整体发灰（饱和度 104 → 75），裙子成了米黄；按退路改为 **Standard + sun 1.9 / 天空 0.6**（削顶 0%，饱和度 107，裙子亮面 / 暗面 / 褶皱能分开）。夜间设置不动。白天底图全部重渲（`dialog/final/raw/bg/` 的 11 张白天图），重出 `dialog/final/` 全部定稿图、`dialog/compare_final_390x844.jpg`、`dialog/compare_390x844.jpg`、`dialog/compare_375x667.jpg`。
- 对照：仓库里没有新模型的游戏截图；Cocos 预览图（`repo/output/playwright/cocos-*.png`）只有岛景，没有女孩。唯一带女孩的游戏截图是 r4 旧模型（`evidence-cloud/.../11-return-7s.jpg`，只拿来对照明暗，不进图）：它的黄色部分亮度 p5/p50/p95 = 137/181/204、不削顶；新底图 163/203/214、不削顶；改前 201/233/234、88% 削顶。

