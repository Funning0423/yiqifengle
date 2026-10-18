# U2 对话框定稿 · 海风气泡（方案 A）· IMPLEMENT（写给 Cursor）

> 2026-10-18 · 棋盘UI美术bot。Funning 选了方案 A；字体按子集打包，只出简体。**这份文档和 `docs/r5/ui/dialog/final/` 下的切图、字体脚本、图是定稿，不改游戏代码**，接入由 Cursor 按本文做。
> 数字的唯一来源是 `src/dialog_spec.py`（布局规则）和 `assets/slices.json`（切图）；附录表格由 `src/gen_tables.py` 生成。文档和脚本对不上时，以脚本为准，并回报。

> ⚠ **占位名**：「阿芳 / 阿宁 / 老铆」以及长名字示例「灯塔下的旅人」「灯塔下的远方旅人们」都是**占位名**，不是项目设定（README 开头已注明，commit 698ca25）。仓库里没有剧情、台词或说话人名单。定稿继续用这些占位名；名单出来后只改 `DIALOG_SPEAKERS` 一张表（§7），配色规则不变。

## 0. 产出

| 路径 | 内容 |
|---|---|
| `assets/dialog_bubble_9s.png` 等 7 张 | 定稿切图（Blender 阶段一光照 + 色板，3 px/pt，pngquant），`assets/slices.json` 写了尺寸、内边距、锚点 |
| `fonts/QFLDialogName.ttf`、`fonts/QFLDialogBody.ttf` | 用示意台词跑出来的子集（只给定稿图用；正式包由构建脚本按真实台词生成） |
| `fonts/OFL-QFLDialogName.txt`、`fonts/OFL-QFLDialogBody.txt` | OFL 1.1 原文（含原版权行和保留名声明） |
| `fonts/measure_sizes.json`、`fonts/fonts_manifest.json` | 体积实测、子集清单 |
| `tools/build_dialog_fonts.py` | 构建时扫台词收字 → 简体检查 → 子集 → CFF 转 glyf → 改名 → 清单；`--check` 只查缺字 |
| `tools/measure_fonts.py`、`tools/sample_dialog/mock_r5_u2.json` | 体积实测脚本、示意台词（占位名） |
| `dialog_390x844.jpg`、`dialog_375x667.jpg` | 定稿图：单行 / 三行 / 长名字 / 旁白 / 多页 / 换说话人 / 夜间 |
| `dialog_7screens.jpg` | 7 种竖屏汇总（+ 两张“建议对话镜头”） |
| `redline_dialog.jpg` | 红线：390 / 375 底部放大、切图内边距、锚点、名字伸缩和截断 |
| `../compare_final_390x844.jpg` | 旧 IslandToast / 对比稿 A / 定稿 A 三栏 |
| `raw/bg/*.jpg` + `*.json` | 全部底图（Blender 新渲）和机位、女孩投影包围盒 |
| `src/` | `build_dialog_slices.py`（Blender 切图）、`post_slices.py`（调色/投影/裁切/压缩）、`render_scene_bg.py`（Blender 底图）、`dialog_spec.py`（规则）、`render_final_dialog.py`（出图）、`gen_tables.py` |

**底图**：全部在 Blender 里重渲，角色 = `/workspace/yiqifengle/previews/角色动画bot/r5-wrist-footik/final/chr_b_r5g2_r5wrist_v4_final.glb`（A1 最终版，导入正常，没用到备选的 INTERIM GLB），场景 = `bc81575f:creator-project/assets/firstslice/combined_visual_m.glb` + `combined_anchors_m.json`，机位 = 游戏回家跟拍 `TRANSITION_CAMERA.returnFollow.out`（见 §4.1）。旧的 evidence 截图一张都没用。

## 1. 和现有 IslandToast 的关系：保留，不替换

- `ui/IslandToast.ts` 是**系统提示**（一行、无名字、固定在顶部 y=132、2 s 自动消失，比如「湖畔暂时没准备好，先回小岛吧」）。对话框是**角色台词**（有说话人、多行、点了才翻页）。两者用途不同，**IslandToast 保留原样，不改**。
- 同屏规则：对话框打开时不弹吐司。`WorldIntegrationBoot` 里调用 `islandToast.show(text)` 之前，如果 `dialog.visible()`，把 text 存到 `pendingToast`，对话框关闭后再 show（只留最后一条）。
- 视觉家族：对话框沿用吐司的奶油底和棕字，名字胶囊和弹窗按钮同一套倒角。新底图上吐司的 y=132 正好压到女孩帽子（重叠 3 pt，见 compare_final），这是吐司自己的问题，不在本次范围，记在 §13。

## 2. 坐标约定

- 本文单位 **pt** = 岛上 `WorldNavigationCanvas` 的单位（`WorldIntegrationBoot.navLayout()` 给的 `f.width / f.height`，就是 CSS px，和 IslandToast 一样）。
- 文中坐标是**屏幕左上原点、y 向下**。挂到 Canvas 下的节点坐标：`nodeX = x − W/2`，`nodeY = H/2 − y`（Canvas 原点在屏幕中心，y 向上）。
- 安全区：`boardSafeInsets(W, H)`（`ui/BoardLayout.ts:110`）的 `bottom / left / right`。7 种屏的取值和 U1 结算定稿同源（`docs/r5/ui/final/src/spec.py safe_for`）。

## 3. 节点树、尺寸、锚点

```
DialogBubble (UI_2D, 全屏 W×H, anchor 0.5/0.5, 挂在 WorldNavigationCanvas 最上层)
├─ TouchCatcher      全屏透明，BlockInputEvents；点一下 = 跳过 / 翻页 / 关闭（§8）
└─ Box               anchor (0, 1)，位置 = 气泡可见左上角 (x0, top)；整体做出现 / 关闭动画
   ├─ Bubble         Sprite SLICED  dialog/dialog_bubble_9s   size (bw + 24, h + 24)，anchor (0,1)，位置 (−12, +12)   ← 四周 12 pt 投影边
   ├─ Tail           Sprite SIMPLE  dialog/dialog_tail_{up|left|right}   anchor 见 §4.3，位置在气泡可见边上
   ├─ NameRim        Sprite SLICED  dialog/dialog_name_rim_3s   size (Wt + 8, 40)，anchor (0.5,0.5)，中心 (20 + Wt/2, 0)
   ├─ NameFill       Sprite SLICED  dialog/dialog_name_fill_3s  size (Wt, 32)，    anchor (0.5,0.5)，中心同上；Sprite.color = 角色色
   ├─ NameLabel      Label  QFL Dialog Name，16 / 14 pt，色 #FFFBF0，居中于胶囊；overflow NONE（宽度已由 §6 算好）
   ├─ Body           Label  QFL Dialog Body，17 / 16 pt，lineHeight 26 / 24，左上对齐（旁白居中），overflow NONE，
   │                        文本是 §5 预先换好行的字符串（带 \n），不要用 Label 自带的 wrap
   └─ NextArrow      Sprite SIMPLE  dialog/dialog_next_arrow  18×14，anchor (0.5,0.5)，中心 (bw − 13, −(h − 12))
```

| 元素 | 尺寸（pt） | 位置（相对气泡可见左上角，y 向下为正） | 备注 |
|---|---|---|---|
| 气泡可见框 | bw × h | (0, 0) | 圆角 30；`bw = min(W − left − right − 28, 480)`，水平居中：`x0 = (W − bw)/2` |
| 气泡节点 | (bw + 24) × (h + 24) | (−12, −12) | 九宫格 insets 144 px（48 pt），见 A4 |
| 文字区 | (bw − 2·padX) × (n·lh) | (padX, padT) | 常规 padX 24 / padT 24 / padB 20；紧凑 20 / 22 / 18 |
| 名字胶囊（外圈） | Wt × 32 | 左沿 x = 20，竖直中心 y = 0（骑在上沿） | Wt 见 §6 |
| 尾巴（上） | 22 × 12（伸出） | 底边中点在 (tx − x0, 0) | 底下 5 pt 平板盖进气泡 |
| 尾巴（左 / 右） | 12 × 22 | 底边中点在 (0, ty − top) / (bw, ty − top) | |
| 翻页箭头 | 14 × 10（可见） | 中心 (bw − 13, h − 12) | 落在右内边距里，不和文字抢位置 |

绘制顺序：Bubble → Tail（盖在气泡上，平板同色）→ NameRim → NameFill → NameLabel → Body → NextArrow。

## 4. 位置、离女孩 ≥13 pt、离安全区 ≥16 pt

### 4.1 底图机位（定稿图怎么来的，也是接入时要对的镜头）

回家路上的近景是 `bc81575f` 的 `TRANSITION_CAMERA.returnFollow`（`world-r1/RegionCameraData.ts:265`，enabled），由 `FirstsliceRoutes.createFollowRig` 生成：镜头跟在她走过的路径后面 `distance 2.3 m`、高 `1.95 m`，看向她当前点、高 `0.86 m`，竖直 fov 60°。定稿图取她在 `toThreshold`（exit_path_17 + return_path_00..07，长 4.933 m）进度 0.60 的位置：

- 女孩 root `(-1.3316, 0, 2.6504)`，朝向 139.9°（沿路径切线），`walk_loop` 第 8 帧；
- 镜头 position `(-2.3019, 1.95, 4.6599)` → target `(-1.3312, 0.86, 2.6507)`，fov 60°（竖直）；
- 光：`WorldR5Integration.scene` 的 Main Light（euler −30, −30, 0，白光）+ 天空环境光；夜间是近似（月光 + 冷环境），不是游戏的夜间着色器。
- 这个镜头里她是**背影**。对话时要不要转身、镜头要不要切到正面，是运镜 / 动画的事，本文的规则对任何镜头都成立（只依赖投影出来的包围盒）。

### 4.2 竖直方向：气泡底固定，往上长

```
bottom   = H − safe.bottom − 16                 // 离底部安全区 16
h        = padT + n·lh + padB                   // n = 本句各页里最多的行数（同一句话翻页时高度不跳）
top      = bottom − h
```

### 4.3 每页最多几行（离女孩 ≥ 13 的约束公式）

女孩投影包围盒 `G = (gl, gt, gr, gb)`（§4.5 怎么算）。气泡整宽，几乎总和她横向重叠，所以约束落在竖直方向：

```
keepTop = gb + 13
if 尾巴朝上 且 尾巴 [tx−11, tx+11] 和 [gl−13, gr+13] 横向重叠:  keepTop = max(keepTop, gb + 13 + 12)   // 尾巴伸出 12
if 名字胶囊 [x0+20, x0+20+Wt] 和 [gl−13, gr+13] 横向重叠:       keepTop = max(keepTop, gb + 13 + 16)   // 胶囊外凸 16
fit       = floor((bottom − keepTop − padT − padB) / lh)
maxLines  = clamp(fit, 1, 3)
cameraNeeded = fit < 1          // 连 1 行都放不下：仍按 1 行显示，并要求对话镜头让位（§4.4），开发版打 warn
```

台词按 §5 换行后，每 `maxLines` 行一页。7 种屏的结果在附录 A1：390×844 / 414×896 放 3 行，360×780 / 375×667 放 2 行（三行台词自动分 2+1 页），768×1024 放 3 行，**390×520 和 320×568 在默认跟拍镜头下 1 行都放不下**。

### 4.4 对话镜头让位（交给运镜bot，本次不改代码）

`cameraNeeded` 的屏上，要求对话时镜头把女孩往上让：定稿图里试了把 `returnFollow` 的 `targetHeight` 降 0.10 m（0.86 → 0.76），390×520 女孩底从 391 → 374，320×568 从 427 → 409，两张都能放下 1 行、离女孩 ≥13（`dialog_7screens.jpg` 后两格，`raw/bg/bg7cam_*`）。数值只是验证可行，具体做法由运镜定（可以只在 `cameraNeeded` 时缓动 0.4 s 过去，关闭对话后回去）。

### 4.5 女孩包围盒怎么算

- 定稿图：Blender 里把角色**全部网格顶点**（当前帧姿势）投影到屏幕取 min/max（`raw/bg/*.json` 的 `girl_bbox_pt`）。
- 游戏里建议：每帧用 `camera.camera.worldToScreen`（写法同 `world-r1/GlassSign.ts:131`，屏幕 px、y 向上，换成 pt 再翻转 y）投影骨骼点 `head`（+0.18 m 帽顶）、`hand.L/R`、`foot.L/R` 的 head/tail，再外扩 6 pt。不要用「root ± 0.3 m × 1.7253 m」的 8 角盒：试算 390×844 底边会到 699（网格实际 635），太保守，会白白少一行。
- 包围盒在屏幕外（z<0 或 z>1）时按「不在镜头里」处理：只保留 `bottom` 约束。
- 每帧算，但**行数只在一句话开始时定**，播放中不重新分页（她走动时不要让页数变化）。

## 5. 字号、行高、换行、分页

| 档 | 条件 | 正文 | 行高 | padT / padB / padX | 最多行 |
|---|---|---|---|---|---|
| 常规 | H ≥ 700 且 W ≥ 360 | QFL Dialog Body **17 pt** | 26 | 24 / 20 / 24 | 3（再按 §4.3 收） |
| 紧凑 | 其他 | **16 pt** | 24 | 22 / 18 / 20 | 3（再按 §4.3 收） |

- **换行自己做，不交给 Label**：`wrapDialog(text, width = bw − 2·padX, fs)`，逐字量宽（`Label` 同字体量，或 `measure()`），放不下就换行；`\n` 强制换行。
- **避头**：下一行行首是 `，。、！？：；”’）》」』…—～·,.!?:;)` 之一时，把本行最后一个字一起带到下一行（`dialog_spec.wrap`）。
- 分页：每 `maxLines` 行一页；一句话所有页高度相同（取最多的那页）。
- 换行结果要和定稿图一致：390×844 常规档每行 18 字，375×667 紧凑档每行 19 字（示意台词实测）。
- 不做省略号截断正文；一句太长就多翻几页。策划写台词时建议一句 ≤ 3 页。

## 6. 名字胶囊伸缩和截断

```
fs = 16; if textWidth(name, 16) > 88: fs = 14
s = name; while textWidth(s + '…', fs) > 88: s = s[:-1]; 截断时 s += '…'
Wt = max(64, ceil(textWidth(s, fs)) + 32)        // 左右各 16
```

- 实测（资源圆体 Bold 子集）：2 字名 → 16 pt、Wt 64；「灯塔下的旅人」6 字 → 14 pt、Wt 116；「灯塔下的远方旅人们」9 字 → 「灯塔下的远…」14 pt、Wt 116（`redline_dialog.jpg` 下方）。
- 胶囊高固定 32（外圈），白底 28；三宫格只横向拉。
- 旁白（没有说话人）：**没有胶囊、没有尾巴**，正文居中，颜色换 `narr`（§9）。

## 7. 名字配色

```ts
// 占位名！名单出来后只换这张表。颜色要求：白字 #FFFBF0 对比度 ≥ 4.5（见附录 A3）。
export const DIALOG_SPEAKERS: Record<string, readonly number[]> = {
  '阿芳': [0xA0, 0x62, 0x0E],   // 赭黄（女主占位）
  '阿宁': [0x2A, 0x7B, 0x80],   // 海青
  '老铆': [0x5A, 0x7A, 0x3C],   // 苔绿
};
export const DIALOG_FALLBACK = [[0x8A, 0x5A, 0x9E], [0xB0, 0x4E, 0x4E], [0x3E, 0x6E, 0x9E]];   // 名单外：按名字 hash (h*31+code) 取
```

- NameFill 是白底图，`Sprite.color = 角色色`（夜间再乘 K_UI，§9）。外圈 NameRim 不着色（奶油）。
- 新加角色颜色必须先过对比度（白天白字 ≥ 4.5；夜间自动 ≥ 7.6，见 A3）。

## 8. 动效参数

| 动作 | 参数 |
|---|---|
| 出现 | Box：y +12 → 0、scale 0.92 → 1，0.18 s `backOut`（overshoot 1.4）；UIOpacity 0 → 255 前 0.10 s。名字胶囊和尾巴晚 0.04 s：scale 0.6 → 1，0.14 s `backOut`。 |
| 逐字 | 30 字 / 秒（33 ms / 字）；`，、` 后停 +80 ms，`。！？…` 后停 +160 ms。逐字用 `Label.string = page.slice(0, k)`（每次加一字；换行已预先算好，不会跳行）。 |
| 跳过 | 打字中点一下：本页立刻打完（0 s）；箭头 0.10 s 后出现。 |
| 翻页提示 | 本页打完 0.20 s 后箭头淡入 0.12 s；上下轻跳：y = −3·(0.5 − 0.5·cos(2π t / 0.9 s))（只往上 3 pt）。最后一页不显示箭头。 |
| 翻页 | 点一下：正文 UIOpacity 255 → 0，0.08 s；换下一页文字后从第 1 个字开始逐字。气泡高度不变。 |
| 换说话人 | 名字：旧胶囊 0.10 s 淡出 + scale 1 → 0.9，新胶囊 0.14 s 淡入 + scale 0.9 → 1（`backOut`）。尾巴：同方向 → 0.16 s `cubicOut` 滑到新位置；换方向（上 ↔ 左/右）→ 0.08 s 淡出、换图、0.08 s 淡入。气泡高度变化 0.12 s `cubicOut`（底不动）。 |
| 关闭 | 最后一页打完后点一下：Box UIOpacity → 0、scale 1 → 0.96，0.14 s `quadIn`；然后 `active=false`，回调 `done()`。 |
| 减少动态 | `reducedMotion()`（`ui/UiPrefs.ts:17`）为真：不缩放、不位移、箭头不跳、尾巴不滑；出现 / 关闭 / 换人只做 0.10 s 透明度；**不逐字**，整页直接出现。 |

## 9. 夜间

- 切图（Bubble / Tail / NameRim / NextArrow）`Sprite.color = tintRgb('ui', w)`；NameFill `Sprite.color = 角色色 × tintFactor('ui', w)`（`ui/NightTint.ts`，K_UI = 0.621 / 0.591 / 0.562，权重 `uiNightWeight()`，0.5 s 线性过渡）。
- 文字**不乘色，单独取色**（按 w 线性插值）：

| 角色 | 白天 | 夜间 | 夜间对比度（底 = 奶油 × K_UI = (158,146,128) 或 角色色 × K_UI） |
|---|---|---|---|
| 正文 `body` | (90,70,54) #5A4636 | (30,19,8) = NightTint brown 夜间 | 5.97 |
| 旁白 `narr` | (118,86,55) = brown2 白天 | (34,23,11) = brown2 夜间 | 5.75 |
| 名字 `name` | (255,251,240) #FFFBF0 | (232,226,212) = white 夜间 | ≥ 7.60 |

- 正文白天色 #5A4636 是 NightTint 里没有的新色：建议加一个 `TextRole 'dialog'`（day [90,70,54] / night [30,19,8]），或者直接在 DialogBubble 里插值。

## 10. 尾巴：3D 说话人投影后怎么定位

1. 说话人锚点 P：说话人节点的头顶（女孩用 `head` 骨骼 + 0.18 m；NPC 用其头顶挂点），每帧 `worldToScreen` → 屏幕 pt `(sx, sy)`。旁白、或说话人不在场景里 → **不画尾巴**。
2. 选方向（一句话开始时选定，播放中只改位置不改方向，除非换人）：
   - `sx < 0` → **左**；`sx > W` → **右**（说话人在画面外）；投影 z 不在 [0,1]（在镜头后面）→ 用 `sx` 相对屏幕中心的符号选左/右。
   - 其余（说话人在画面里）→ **上**。
3. 钳制位置：
   - 上：`tx = clamp(sx, lo, hi)`，`lo = max(x0 + 30 + 11, x0 + 20 + Wt + 8 + 11)`（不压圆角、离名字胶囊 ≥ 8），`hi = x1 − 30 − 11`。锚点 (0.5, 0.25) 放在 `(tx, top)`。
   - 左 / 右：`ty = clamp(sy, top + 30 + 11, bottom − 30 − 11)`。左：锚点 (0.75, 0.5) 放在 `(x0, ty)`；右：锚点 (0.25, 0.5) 放在 `(x1, ty)`。
4. 跟随：说话人走动时 tx / ty 每帧跟，`lerp` 系数 `1 − exp(−dt / 0.08)`，避免抖。
5. 尾巴朝上并压在女孩上方时，§4.3 已把它的 12 pt 算进 keepTop，所以尾巴尖离女孩也 ≥ 13。

## 11. 切图接入（目标路径和方式）

| 源（本目录） | 游戏目标路径 | 接入 |
|---|---|---|
| `assets/dialog_bubble_9s.png` | `creator-build-project/assets/bundles/board_art/dialog/dialog_bubble_9s.png` | BoardArt `SLICES['dialog/dialog_bubble_9s'] = [144,144,144,144]`，`ART_PX[...] = 3` |
| `assets/dialog_tail_up.png` / `_left` / `_right` | `.../board_art/dialog/dialog_tail_{up,left,right}.png` | SIMPLE；锚点见 A4 |
| `assets/dialog_name_rim_3s.png` | `.../board_art/dialog/dialog_name_rim_3s.png` | `SLICES = [60,0,60,0]`，`ART_PX = 3` |
| `assets/dialog_name_fill_3s.png` | `.../board_art/dialog/dialog_name_fill_3s.png` | `SLICES = [48,0,48,0]`，`ART_PX = 3`；Sprite.color 着色 |
| `assets/dialog_next_arrow.png` | `.../board_art/dialog/dialog_next_arrow.png` | SIMPLE |
| 构建产物 `QFLDialogName.ttf` / `QFLDialogBody.ttf` | `.../board_art/fonts/QFLDialog{Name,Body}.ttf` | Cocos 导入成 `TTFFont`；`bundle.load('fonts/QFLDialogName', TTFFont)`；`Label.font = f; useSystemFont = false` |
| `fonts/OFL-QFLDialog{Name,Body}.txt` | `.../board_art/licenses/qfl-dialog-{name,body}-ofl.txt` | 同时在「关于」页的授权列表（`ui/CommonPanels.ts:14` 那张表）加两行 |

步骤：
1. 先把 7 张 png 拷到 `art-src/board-ui/c-popups/dialog/slices/`（art-src 是切图的源头）。
2. `tools/board_art_sync.py` 加一张 `DIALOG = [...]` 表，`pairs()` 里 `(D + n + '.png', 'bundles/board_art/dialog/' + n + '.png')`；字体和授权同样加进 `pairs()`（`meta_for` 要加 `.ttf` → `{"importer": "ttf-font", ...}`，用 Creator 生成一次 meta 抄过来）。
3. `ui/BoardArt.ts:26` `ArtDir` 加 `'dialog'`；`SLICES` / `ART_PX` 加上表的项。`BoardArt.shared().load('dialog')` 在第一次打开对话框前调用（失败要能重试，`load()` 已支持）。
4. 切图缺失时的降级：Graphics 画圆角矩形（同 IslandToast 的画法），保证不崩。

## 12. 字体子集（只收简体）

- 两款字：名字 **资源圆体 Resource Han Rounded CN Bold 0.990**，正文 **思源黑体 Noto Sans CJK SC Bold 2.004**，都是 SIL OFL 1.1。
- 构建流程（`tools/build_dialog_fonts.py`，放在 docs，不进 creator-build-project）：
  1. 扫台词：`--lines 'creator-build-project/assets/.../dialog/**/*.json'`（json 递归取字符串，`speaker/name/who` 字段进名字字体，其余进正文；也吃 txt / ts）；
  2. **只收简体**：每个汉字必须能编码进 GB2312，否则查 `--allow` 白名单，再不在就**报错退出**（多半是繁体或错别字；不静默补字）；
  3. 固定附带 ASCII、全角标点、全角数字、`…`；
  4. `fontTools.subset`：去 hinting、去布局特性、去字形名；
  5. 思源黑体 CFF → TrueType glyf（cu2qu，误差 1 unit）——小游戏代码包白名单只有 `.ttf`，不收 `.otf`；
  6. 改名：family `QFL Dialog Name` / `QFL Dialog Body`，name ID 1/3/4/6 重写，保留 0（版权）/13/14（授权），ID 10 写明来源；**字体名记录里出现 “Source” / “Noto” / “Resource Han” 就失败**（OFL 第 3 条：修改版不得用保留名 “Source”；Noto 是 Google 商标，一并避开）；
  7. 输出两个 ttf + `fonts_manifest.json`；CI 跑 `--check`：台词里有、子集里没有就 exit 1。
- 实测体积（附录 A5）：只有名字 **6.1 KB**；示意台词 126 个汉字时正文 **39.5 KB**；估一章（800 字）正文 **221.9 KB**（名字字体如果也收 800 字是 312 KB，所以名字字体只收名字）；GB2312 一级全收是正文 993 KB 的上限。CFF 转 glyf 大 27–30 %（对照列）。
- 放进 `board_art` 分包，不进主包（主包 4 MB 限制）。

## 13. 建议接入的文件和接口（已在代码里查过）

| 文件 | 改什么 |
|---|---|
| 新 `assets/scripts/ui/DialogLayout.ts` | 纯函数：`dialogMetrics(W,H)`、`wrapDialog(text,width,fs,measure)`、`nameTag(name,measure)`、`layoutDialog(W,H,safe,girlBox,speakerPt,name,text)`、`tailPlacement(...)`；数值照 `src/dialog_spec.py` 一比一搬，写单测对齐附录 A1 |
| 新 `assets/scripts/ui/DialogBubble.ts` | 组件类，形状同 `IslandToast`：`constructor(parent: Node)`、`play(lines: DialogLine[], done?: () => void)`、`update(dt, width, height)`、`visible()`、`dispose()`；`DialogLine = { speaker?: string; speakerNode?: Node; speakerHeadOffset?: number; text: string }` |
| `WorldIntegrationBoot.ts` | `:552` 旁边 `this.dialog = new DialogBubble(this.canvas)`；`:657` 每帧 `this.dialog?.update(dt, f.width, f.height)`；`:717` `onDestroy` 里 `dispose()`；`:548 invoke()` 的拦截条件加 `this.dialog?.visible()`（对话中不响应岛上按钮）；`islandToast.show` 之前按 §1 暂存 |
| `world-r1/GlassSign.ts:131` | 只参考它的 `worldToScreen` 写法（屏幕 px、y 向上），不改 |
| `ui/BoardArt.ts:26 / :30 / :38` | `ArtDir` 加 `'dialog'`，`ART_PX`、`SLICES` 加项（§11） |
| `ui/NightTint.ts` | 可选：加 `TextRole 'dialog'`（§9） |
| `ui/UiPrefs.ts:17` | 用 `reducedMotion()`，不改 |
| `ui/BoardLayout.ts:110` | 用 `boardSafeInsets(W,H)` 取安全区，不改 |
| `tools/board_art_sync.py` | 加 `DIALOG` 表、字体和授权（§11） |
| `ui/CommonPanels.ts:14` | 关于页授权表加两行（QFL Dialog Name / Body，SIL OFL 1.1） |

谁来调 `play()`：仓库里目前**没有剧情 / 台词系统**，也没有说话人数据。先只做组件和一个开发入口（比如 `globalThis.__dialogDemo()` 播 `tools/sample_dialog/mock_r5_u2.json`），剧情接入等策划。

## 14. 验收清单

- [ ] 7 种竖屏上，三行示意台词的每页行数、气泡顶、尾巴 x 和附录 A1 一致（±1 pt）；`cameraNeeded` 的屏有 warn。
- [ ] 任意一帧：气泡、名字胶囊、尾巴离女孩投影包围盒 ≥ 13 pt；气泡底离底部安全区 = 16 pt。
- [ ] 390×844 常规档每行 18 字，375×667 紧凑档每行 19 字；避头标点不出现在行首。
- [ ] 一句话翻页时气泡高度不跳；最后一页没有箭头；点击顺序：打字中 → 打完 → 下一页 → 关闭。
- [ ] 6 字名缩到 14 pt，9 字名截断成「灯塔下的远…」，胶囊宽 116；2 字名 64。
- [ ] 旁白：无胶囊、无尾巴、居中、旁白色。
- [ ] 说话人在画面外左 / 右时用左 / 右尾巴；画面内用上尾巴，不压名字胶囊、不压圆角。
- [ ] 夜间：切图乘 K_UI，文字按 §9 取色；对比度表 A3 全部 ≥ 4.5。
- [ ] 减少动态开：无缩放 / 位移 / 跳动 / 逐字。
- [ ] 对话框打开时 IslandToast 不出现，关闭后补出最后一条。
- [ ] 包里只有 `QFLDialogName.ttf` / `QFLDialogBody.ttf`，字体名里没有 Source / Noto / Resource Han；`--check` 通过；关于页有两条 OFL。
- [ ] 切图缺失时降级成 Graphics 圆角矩形，不报错。
- [ ] 占位名在名单出来后替换（只改 `DIALOG_SPEAKERS`）。

## 15. 没测 / 待定

- 没在真机上看过：子集 TTF 在 iOS / Android 微信里的渲染（粗细、清晰度）、`TTFFont` 在小游戏里的加载耗时。
- 女孩包围盒：定稿图用网格顶点投影；游戏里建议的骨骼点投影没在引擎里验证（Blender 里骨骼矩阵读出来不对，没来得及排查），接入后要对一下数。
- 夜间底图是近似光照；游戏夜间的实际底色可能更暗，文字对比度只依赖气泡本身，不受影响。
- 体积 B / C 用的是随机 GB2312 一级字和全集，不是真实台词。
- 对话镜头让位（§4.4）只验证了可行性，参数由运镜定。
- 女孩在跟拍镜头里是背影；对话时是否转身 / 换镜头没定。
- IslandToast 的 y=132 在新镜头里压到帽子（重叠 3 pt），不在本次范围。
- 胶囊 3 宫格的中段有一条很淡的横向明暗（Blender 面三角化的阴影），2× 下几乎看不出，真机上要看一眼。

---

## 附录

### A1 七种竖屏（三行台词「阿芳」，尾巴指女孩头，默认跟拍镜头）

| 屏 | 档 | 字/行高 | 安全区下 | 气泡 x0 / 宽 | 气泡底 | 女孩底 | keepTop | 可用高 | 算出行数 | 每页行数 | 分页 | 气泡顶 / 高 | 尾巴 x | 离女孩 | 离安全区 | 要镜头让位 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 390x844 | 常规 | 17/26 | 34 | 14 / 362 | 794 | 635.0 | 664.0 | 130.0 | 3 | 3 | 3 | 672 / 122 | 194.9 | 22.1 | 16 | 否 |
| 414x896 | 常规 | 17/26 | 34 | 14 / 386 | 846 | 674.1 | 699.1 | 146.9 | 3 | 3 | 3 | 724 / 122 | 206.8 | 36.4 | 16 | 否 |
| 360x780 | 常规 | 17/26 | 34 | 14 / 332 | 730 | 586.8 | 615.8 | 114.2 | 2 | 2 | 2+1 | 634 / 96 | 179.9 | 31.2 | 16 | 否 |
| 375x667 | 紧凑 | 16/24 | 34 | 14 / 347 | 617 | 501.8 | 526.8 | 90.2 | 2 | 2 | 2+1 | 529 / 88 | 187.4 | 15.2 | 16 | 否 |
| 390x520 | 紧凑 | 16/24 | 34 | 14 / 362 | 470 | 391.2 | 416.2 | 53.8 | 0 | 1 | 1+1+1 | 406 / 64 | 194.9 | 2.8 | 16 | **是** |
| 320x568 | 紧凑 | 16/24 | 34 | 14 / 292 | 518 | 427.3 | 456.3 | 61.7 | 0 | 1 | 1+1+1 | 454 / 64 | 159.9 | 10.8 | 16 | **是** |
| 768x1024 | 常规 | 17/26 | 34 | 144 / 480 | 974 | 770.4 | 795.4 | 178.6 | 5 | 3 | 2 | 878 / 96 | 383.8 | 95.6 | 16 | 否 |

### A2 底图来源和机位（每张底图一行）

| 文件 | 角色 GLB | 场景源 | 机位 position → target（Cocos 世界坐标，m） | fov（竖直） | 女孩 root / 朝向 | 女孩投影包围盒 pt | 头 pt |
|---|---|---|---|---|---|---|---|
| `raw/bg/bg7_320x568.jpg` | `chr_b_r5g2_r5wrist_v4_final.glb` | `bc81575f:creator-project/assets/firstslice/combined_visual_m.glb` | [-2.3019, 1.95, 4.6599] → [-1.3312, 0.86, 2.6507] | 60° | [-1.3316, 0, 2.6504] / 139.9° | [99.3, 97.6, 211.4, 427.3] | [159.9, 166.8] |
| `raw/bg/bg7_360x780.jpg` | `chr_b_r5g2_r5wrist_v4_final.glb` | `bc81575f:creator-project/assets/firstslice/combined_visual_m.glb` | [-2.3019, 1.95, 4.6599] → [-1.3312, 0.86, 2.6507] | 60° | [-1.3316, 0, 2.6504] / 139.9° | [96.6, 134.0, 250.5, 586.8] | [179.9, 229.0] |
| `raw/bg/bg7_375x667.jpg` | `chr_b_r5g2_r5wrist_v4_final.glb` | `bc81575f:creator-project/assets/firstslice/combined_visual_m.glb` | [-2.3019, 1.95, 4.6599] → [-1.3312, 0.86, 2.6507] | 60° | [-1.3316, 0, 2.6504] / 139.9° | [116.2, 114.6, 247.8, 501.8] | [187.4, 195.8] |
| `raw/bg/bg7_390x520.jpg` | `chr_b_r5g2_r5wrist_v4_final.glb` | `bc81575f:creator-project/assets/firstslice/combined_visual_m.glb` | [-2.3019, 1.95, 4.6599] → [-1.3312, 0.86, 2.6507] | 60° | [-1.3316, 0, 2.6504] / 139.9° | [139.4, 89.3, 242.0, 391.2] | [194.9, 152.7] |
| `raw/bg/bg7_390x844.jpg` | `chr_b_r5g2_r5wrist_v4_final.glb` | `bc81575f:creator-project/assets/firstslice/combined_visual_m.glb` | [-2.3019, 1.95, 4.6599] → [-1.3312, 0.86, 2.6507] | 60° | [-1.3316, 0, 2.6504] / 139.9° | [104.8, 145.0, 271.3, 635.0] | [194.9, 247.8] |
| `raw/bg/bg7_414x896.jpg` | `chr_b_r5g2_r5wrist_v4_final.glb` | `bc81575f:creator-project/assets/firstslice/combined_visual_m.glb` | [-2.3019, 1.95, 4.6599] → [-1.3312, 0.86, 2.6507] | 60° | [-1.3316, 0, 2.6504] / 139.9° | [111.2, 153.9, 288.0, 674.1] | [206.8, 263.1] |
| `raw/bg/bg7_768x1024.jpg` | `chr_b_r5g2_r5wrist_v4_final.glb` | `bc81575f:creator-project/assets/firstslice/combined_visual_m.glb` | [-2.3019, 1.95, 4.6599] → [-1.3312, 0.86, 2.6507] | 60° | [-1.3316, 0, 2.6504] / 139.9° | [274.5, 175.9, 476.6, 770.4] | [383.8, 300.6] |
| `raw/bg/bg7cam_320x568.jpg` | `chr_b_r5g2_r5wrist_v4_final.glb` | `bc81575f:creator-project/assets/firstslice/combined_visual_m.glb` | [-2.3019, 1.95, 4.6599] → [-1.3312, 0.76, 2.6507]（targetHeight -0.10 m (对话镜头建议)） | 60° | [-1.3316, 0, 2.6504] / 139.9° | [99.1, 77.3, 211.3, 408.6] | [159.9, 148.1] |
| `raw/bg/bg7cam_390x520.jpg` | `chr_b_r5g2_r5wrist_v4_final.glb` | `bc81575f:creator-project/assets/firstslice/combined_visual_m.glb` | [-2.3019, 1.95, 4.6599] → [-1.3312, 0.76, 2.6507]（targetHeight -0.10 m (对话镜头建议)） | 60° | [-1.3316, 0, 2.6504] / 139.9° | [139.3, 70.8, 242.0, 374.0] | [194.9, 135.6] |
| `raw/bg/bg_375x667_day.jpg` | `chr_b_r5g2_r5wrist_v4_final.glb` | `bc81575f:creator-project/assets/firstslice/combined_visual_m.glb` | [-2.3019, 1.95, 4.6599] → [-1.3312, 0.86, 2.6507] | 60° | [-1.3316, 0, 2.6504] / 139.9° | [116.2, 114.6, 247.8, 501.8] | [187.4, 195.8] |
| `raw/bg/bg_375x667_night.jpg` | `chr_b_r5g2_r5wrist_v4_final.glb` | `bc81575f:creator-project/assets/firstslice/combined_visual_m.glb` | [-2.3019, 1.95, 4.6599] → [-1.3312, 0.86, 2.6507] | 60° | [-1.3316, 0, 2.6504] / 139.9° | [116.2, 114.6, 247.8, 501.8] | [187.4, 195.8] |
| `raw/bg/bg_390x844_day.jpg` | `chr_b_r5g2_r5wrist_v4_final.glb` | `bc81575f:creator-project/assets/firstslice/combined_visual_m.glb` | [-2.3019, 1.95, 4.6599] → [-1.3312, 0.86, 2.6507] | 60° | [-1.3316, 0, 2.6504] / 139.9° | [104.8, 145.0, 271.3, 635.0] | [194.9, 247.8] |
| `raw/bg/bg_390x844_night.jpg` | `chr_b_r5g2_r5wrist_v4_final.glb` | `bc81575f:creator-project/assets/firstslice/combined_visual_m.glb` | [-2.3019, 1.95, 4.6599] → [-1.3312, 0.86, 2.6507] | 60° | [-1.3316, 0, 2.6504] / 139.9° | [104.8, 145.0, 271.3, 635.0] | [194.9, 247.8] |

### A3 对比度（WCAG，≥ 4.5）

| 模式 | 文字 | 前景 | 背景 | 对比度 |
|---|---|---|---|---|
| 白天 | 正文 | (90, 70, 54) | (255, 247, 228) | 8.32 |
| 白天 | 旁白 | (118, 86, 55) | (255, 247, 228) | 6.23 |
| 白天 | 名字·阿芳 | (255, 251, 240) | (160, 98, 14) | 4.78 |
| 白天 | 名字·阿宁 | (255, 251, 240) | (42, 123, 128) | 4.79 |
| 白天 | 名字·老铆 | (255, 251, 240) | (90, 122, 60) | 4.74 |
| 白天 | 名字·备用色 | (255, 251, 240) | (138, 90, 158) | 5.03 |
| 白天 | 名字·备用色 | (255, 251, 240) | (176, 78, 78) | 5.02 |
| 白天 | 名字·备用色 | (255, 251, 240) | (62, 110, 158) | 5.17 |
| 夜间 | 正文 | (30, 19, 8) | (158, 146, 128) | 5.97 |
| 夜间 | 旁白 | (34, 23, 11) | (158, 146, 128) | 5.75 |
| 夜间 | 名字·阿芳 | (232, 226, 212) | (99, 58, 8) | 7.60 |
| 夜间 | 名字·阿宁 | (232, 226, 212) | (26, 73, 72) | 7.78 |
| 夜间 | 名字·老铆 | (232, 226, 212) | (56, 72, 34) | 7.68 |
| 夜间 | 名字·备用色 | (232, 226, 212) | (86, 53, 89) | 7.94 |
| 夜间 | 名字·备用色 | (232, 226, 212) | (109, 46, 44) | 7.83 |
| 夜间 | 名字·备用色 | (232, 226, 212) | (39, 65, 89) | 8.18 |

### A4 切图

| 文件 | px（@3x） | pt | 字节 | 内边距 px [l,t,r,b] | 锚点 | 说明 |
|---|---|---|---|---|---|---|
| `assets/dialog_bubble_9s.png` | 396×396 | 132×132 | 30032 | [144, 144, 144, 144] | — | 节点尺寸 = 可见气泡 + 四周各 12 pt；insetLeft/Top/Right/Bottom = 144 px（=48 pt：12 投影 + 30 圆角 + 6 余量） |
| `assets/dialog_tail_up.png` | 84×60 | 28×20 | 2185 | — | [0.5, 0.25] | 锚点 = 底边中点（离图下沿 5 pt）；放在气泡可见上沿上；尖朝上，高出上沿 12 pt，底宽 22 pt |
| `assets/dialog_tail_left.png` | 60×84 | 20×28 | 2186 | — | [0.75, 0.5] | 锚点 = 底边中点（离图右沿 5 pt）；放在气泡可见左沿上；尖朝左，伸出 12 pt |
| `assets/dialog_tail_right.png` | 60×84 | 20×28 | 2160 | — | [0.25, 0.5] | 锚点 = 底边中点（离图左沿 5 pt）；放在气泡可见右沿上；尖朝右，伸出 12 pt |
| `assets/dialog_name_rim_3s.png` | 144×120 | 48×40 | 6121 | [60, 0, 60, 0] | — | 节点 = (胶囊外宽 Wt + 8, 40) pt；可见外圈 Wt×32，四周 4 pt 投影边；左右三宫格 |
| `assets/dialog_name_fill_3s.png` | 120×96 | 40×32 | 2132 | [48, 0, 48, 0] | — | 节点 = (Wt, 32) pt；可见白底 (Wt−4)×28（四周 2 pt 透明边）；Sprite.color = 角色色（夜间再乘 K_UI） |
| `assets/dialog_next_arrow.png` | 54×42 | 18×14 | 1283 | — | [0.5, 0.5] | 18×14 pt 节点，可见三角 14×10；上下轻跳见 IMPLEMENT §8 |

### A5 字体子集实测（fontTools 4.65.0，本机）

| 字表 | 汉字 / 总字数 | 正文 QFL Dialog Body（glyf .ttf） | gzip | 对照：保留 CFF（.otf，小游戏不收） | 名字 QFL Dialog Name（glyf .ttf） |
|---|---|---|---|---|---|
| A 本次定稿图台词（sample_dialog） | 126 / 254 | **39.5 KB** | 28.2 KB | 31.0 KB | 52.6 KB |
| B 随机 800 个 GB2312 一级字（估一章） | 800 / 931 | **221.9 KB** | 154.7 KB | 172.1 KB | 312.4 KB |
| C GB2312 一级字全部（上限） | 3755 / 3886 | **993.0 KB** | 672.6 KB | 766.8 KB | 1409.1 KB |
| 只有名字（占位名 + …·） | 16 | — | — | — | **6.1 KB**（gzip 3.9 KB） |

仓库里的 `fonts/QFLDialogName.ttf`（6252 B）/ `fonts/QFLDialogBody.ttf`（40512 B）是用 sample_dialog 跑出来的，只给定稿图用。
