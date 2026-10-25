# 地名开局淡入（Region Arrival Title）· SPEC v1

UI设计部 · 分支 `ui/region-arrival-title`（基于 `ggbot/cand-b18-stage` d9423886）· 基准 390×844 pt · 已获 Grok Bot 批准立项，待审稿

## 0. 一句话
转场过程里**不再出现任何地名牌或 UI 叠层**；她到达新区域、该区域第一关开局（`presentForPlay` 之后）时，在信息牌和棋盘之间淡入一行地名，2.0 s 后自动消失，不挡人、不挡操作、不拦触摸。

## 1. 删除项（转场里的地名牌）
| 位置 | 现状 | 改为 |
|---|---|---|
| `world-r2/WindWipeCore.ts` `wipeContentFor()` | HOLD 时 `sign:'花粉草甸' / '天空之城' / '风铃湖畔' / '回到小岛'` | `sign` 一律 `null`；HOLD 只留 3D 载具（帆船/热气球/风铃），载具位置不变 |
| `ui/WindWipe.ts` `WindWipeSign`（`popup/title_plank_3s` 木板 + RegionName） | 显示 | 不再创建，或永远 `active=false` |
| `ui/LakesideArrivalUI.ts` + `region/LakesideArrivalCore.ts` 落地木牌（T-03，`LAKESIDE_SIGN_SPEC`） | 落地后木牌下落淡入 | 木牌删除；「跳过」角标（`LAKESIDE_SKIP_SPEC`）保留不动 |
| post-island SPEC TR2 / TR4 / TR6 的「到达木牌」 | 推镜后出木牌 | 取消；推镜停下后直接进棋盘，地名改由本 SPEC 在开局显示 |
| 「回到小岛」 | TR8/回岛时木牌 | 删除，回岛不显示地名 |

> 原 TR6 「木牌淡出后 1 s 内进棋盘」改为「落地镜头结束后 1 s 内进棋盘」。T-03 的木牌遮挡气球绳问题随之消失。

## 2. 各区域地名表（取自代码，未自拟）
| 区域 id | 显示文字 | 出处 | 何时显示 |
|---|---|---|---|
| `meadow`（草原） | **花粉草甸** | `WindWipeCore.ts:21`；`IslandPanels.ts` CHAPTERS | 第一次进入草原的第一关（L5）开局 |
| `skycity`（天空城） | **天空之城** | `WindWipeCore.ts:22`；post-island SPEC TR3/TR4 | 第一次进入天空城的第一关（L9）开局 |
| `lakeside`（湖畔） | **风铃湖畔** | `WindWipeCore.ts:23`；`LakesideArrivalCore.ts:10`；CHAPTERS | 第一次进入湖畔的第一关（L13 / r04-lake-01）开局 |
| `tide`（潮汐，小岛起点） | 潮汐小径 | CHAPTERS | **不显示**（起始区域，不是“到达”）；字已在字体子集里，留作备用 |

⚠ 待 Grok Bot 确认：旅程手册 `IslandPanels.ts` CHAPTERS 里 `sky` 章节名是「天空回声」，转场/开局用的是「天空之城」。本 SPEC 沿用转场里已在用的「天空之城」，两处是否统一请定。

建议实现为一张表 `REGION_TITLE = { meadow:'花粉草甸', skycity:'天空之城', lakeside:'风铃湖畔' }`，并让 `wipeContentFor` 删掉 sign 后不再持有地名。

## 3. 外观
| 项 | 值 |
|---|---|
| 内容 | 仅区域名一行；下方一条细线装饰。无副标题、无英文、无底板 |
| 字体 | `font/QFLRegionTitle.ttf`（Noto Serif SC Bold 子集，宋体系，比系统黑体更暖；11.6 KB，OFL 1.1）。项目现有 `QFLDialogName/Body.ttf` 都是子集，不含这些字；项目里没有圆体，故选宋体 |
| 字号 | 24 pt（Label.fontSize 24，lineHeight 32） |
| 字间距 | 0.15 em = 3.6 pt（Label.spacingX 3.6；Cocos 下取 4 也可） |
| 细线 | 44×1 pt，居中，字形底部下方 7 pt，两端渐隐（sin^1.5），不透明度 = 文字的 0.5 倍 |
| 墨迹块 | 约 107×31 pt（四字），左右余量 ≥ 32 pt（390 下 142 pt）。>9 个字时缩字号保证 32 pt，最小 20 pt |
| 抗锯齿 | 文字用 TTF 矢量渲染；细线和阴影用 Graphics/9 宫格软边图，不用硬边矩形 |

### 白天
- 填色 `#FFF8EC`（不透明度 1）
- 投影：`#5A3A1E` α0.50，模糊 4.5 pt，向下 1 pt
- 贴边描影：`#5A3A1E` α0.40，模糊 1 pt，向下 0.5 pt（保证在白云/风车叶这类亮底上读得清）
- Cocos 实现：Label `enableShadow`（shadowColor #5A3A1E·α128，offset (0,-1)，blur 4）+ 叠一层同字 Label 作贴边描影（outline 不建议，会变硬）

### 夜间（NightTint 体系）
- 填色 `#E8EEFF`，最高不透明度 0.9
- 外发光：`#9CB4F0` α0.38，模糊 7 pt（用 shadow，offset 0）
- 贴边描影：`#141C34` α0.22，模糊 1 pt
- 颜色按 `uiNightWeight()` 在白天/夜间两套之间逐通道线性插值（与 `NightTint.textRgb` 同法），最高不透明度 `1 → 0.9` 同步插值；**文字是重新着色，不做乘色**（NightTint 规则）

## 4. 位置
- 水平：屏幕中心 `x = w/2`。
- 纵向：墨迹块中心 = `boardLayout(...).toast.y`（`ui/BoardLayout.ts`），即信息牌下沿与棋盘托盘上沿之间的提示牌槽位。
  这条带子本来就是给提示牌留的：不压 HUD（暂停、信息牌、胶囊），不压棋盘；她在棋盘下方，脸和胸口都远离这里。
- 实算（pt，`src/layout_7sizes.json`，由 `src/dump_layout.cjs` 从 BoardLayout.ts 导出）：

| 尺寸 | 信息牌下沿 | 托盘上沿 | 中心 y | 占屏高 | 上/下余隙（墨迹） |
|---|---|---|---|---|---|
| 320×568 | 156 | 200 | 178 | 31% | 6.4 / 6.4 |
| 360×780 | 156 | 210.1 | 183.1 | 23% | 11.4 / 11.4 |
| 375×667 | 156 | 200 | 178 | 27% | 6.4 / 6.4 |
| 390×844 | 156 | 212.0 | 184 | 21.8% | 12.4 / 12.4 |
| 402×874 | 156 | 213.7 | 184.9 | 21.2% | 13.2 / 13.2 |
| 414×896 | 156 | 215.4 | 185.7 | 20.7% | 14.1 / 14.1 |
| 430×932 | 156 | 217.7 | 186.9 | 20.1% | 15.2 / 15.2 |

  短屏（320、375）占屏高超过 18–22%，这是有意的：位置跟 HUD 走，而不是跟百分比走，否则会压到信息牌。
- 带子 < 40 pt 时（目前无此尺寸）去掉细线，只留字。上浮 6 pt 的起点会略进托盘边，但那时不透明度 < 0.3，可接受。

## 5. 动画（总 2.0 s）
| 段 | 时长 | 不透明度 | 位移 | 曲线 |
|---|---|---|---|---|
| 淡入 | 0–0.4 s | 0 → 1（夜间 → 0.9） | +6 pt → 0（向上浮） | ease-out cubic：`1-(1-t)^3`，不透明度和位移同一曲线 |
| 停留 | 0.4–1.6 s | 1 | 0 | — |
| 淡出 | 1.6–2.0 s | 1 → 0 | 不动 | ease-in quad：`t²` |

- 起点：`presentForPlay()` 之后的第一帧（棋盘已可见、可操作）。不等任何点击。
- 中途切日夜：颜色按 `uiNightWeight()` 每帧更新，时间线不重置。
- 暂停面板打开时：继续走完（不冻结），被面板盖住也无妨。

## 6. 交互与显示规则
- **不拦截触摸**：节点上不挂 Button / BlockInputEvents，也不挂可点 UITransform 监听；棋盘从第 0 帧就能操作。
- **每个区域只显示一次**：存档键 `seenRegionTitle: { meadow?:1, skycity?:1, lakeside?:1 }`（写进正常存档；开始显示时就写，避免中途退出再进又播）。重开本关、读档回到同一区域、回岛再回来，都不再显示。
- 判定“到达”：本次进入的棋盘所属区域 ≠ 上一个棋盘区域，且该区域未见过；第一关以外的关卡也满足时（例如跳关）同样显示一次。
- 只读棋盘、教程演示、结局不显示。

## 7. 优先级（与其他提示同屏时）
地名占用提示牌槽位，**地名先显示，其余排在它后面**：
1. 地名（2.0 s）
2. 「关卡已调整，从头开始」（`staleNotice`，0.3+2+0.3 s）
3. 道具提示 / 引导提示（`say()`、`autoHint` 文案）、新道具教学弹窗（如天空城「星光」）

- 实现：在 `ManagedMobileBoardUI` 的 toast 队列前加一个 `regionTitleUntil` 时间戳；`say()` 和 `staleNotice()` 在其之前到来的，全部入队，地名淡出完成（2.0 s）后再按原顺序出；排队中的道具提示若对应道具已被取消，丢弃（同 b18 规则）。
- 新道具教学弹窗（模态）同样延后到地名结束；自动提示计时器（5 s）从地名结束开始计。

## 8. 实现要点（给 GGbot）
1. 新文件 `ui/RegionArrivalTitle.ts`：纯函数 `regionTitleState(t)` → `{alpha, dy, done}`（时间线见 §5），以及 `RegionArrivalTitle` 组件（一个 Node：主 Label + 描影 Label + 细线 Graphics；`UIOpacity` 控透明度）。参数常量直接用 `spec_params.json` 的值。
2. 挂在棋盘 UI 根（与 Toast 同层，层级在 Toast 之上），位置每次 layout 时取 `geo.toast.y`。
3. 触发：`presentForPlay()` 末尾调用 `maybeShowRegionTitle(regionId)`；判定和存档见 §6。
4. 删除 §1 列出的所有转场地名牌；载具保留。
5. 测试建议：7 尺寸下墨迹矩形与 `plateRect`、`tray` 不相交；左右余量 ≥ 32；时间线 0/0.4/1.6/2.0 s 的 alpha；第二次进入同区域不显示；地名期间触摸能落子；队列顺序。

## 9. 交付文件
| 文件 | 内容 |
|---|---|
| `compare_meadow.png` / `compare_skycity.png` / `compare_lakeside.png` | 旧（转场木牌）→ 新（开局淡入），各含白天+夜间。新方案底图：真机/网页构建截图（草原、天空城 390×844；湖畔 L13 只有 375×667 截图），地名按本 SPEC 合成，属示意。旧图为 post-island 关键帧；草原、湖畔的旧版夜间是白天帧压暗的示意 |
| `annot_390.png` | 390×844 标注：尺寸、间距、颜色 |
| `sizes_7.png` | 7 尺寸位置示意（按 BoardLayout 实算几何画的示意图，非截图） |
| `keyframes.png` | 动画关键帧（白天/夜间） |
| `region_title_anim.mp4` | 2.6 s 动画演示（左白天、右夜间，390×844） |
| `font/QFLRegionTitle.ttf` | 字体子集（含授权说明） |
| `spec_params.json` | 全部参数 |
| `src/` | 生成脚本：`render_region_title.py`、`dump_layout.cjs`、`layout_7sizes.json` |
