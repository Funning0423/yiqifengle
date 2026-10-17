# 《咦 起风了》UI 布局市场调研：只看界面简洁的游戏
日期：2026-10-16　｜　长图：`ui-market-research-longimage.png`　｜　截图：`images/`（共 76 张）　｜　来源清单：`sources.json`　｜　长图生成脚本：`make_longimage.py`

## 0. 方法与诚信说明
- 截图**全部**来自 Apple App Store 美区官方商店页（开发商上传的宣传截图）。用公开的 iTunes Lookup API 取到图片地址后，按 1200px 宽下载。没有花钱，也没有用 AI 生成图片。
- 商店截图以**玩法画面**为主，很少有结算、暂停、弹窗。下表里写「截图中未见」的格子，表示没有找到真实截图，**不做推测**。
- 「按钮大小、留白」是根据截图目测的**相对比例**，不是实测数值。
- 只有 Mini Metro 和 Townscaper 的商店图是官方横屏或带边框的宣传图；Sky、Alto、Mini Metro 是横屏截图，这里只作为风格参考。
- **没找到的**：羊了个羊、跳一跳（微信小游戏不上 App Store；维基百科接口没有返回可用图片）。这两款**没有收录截图，也没有拆解**。Townscaper 的商店图全是带边框的宣传拼图，看不到 UI，只用来参考配色。

## 1. 逐款拆解（只写截图里看得到的内容）
括号里是截图文件简称：mv=monument-valley，mv2=monument-valley-2，mm=mini-metro，td=two-dots，tk=tabikaeru，fl=florence，例如 mv_03 = images/monument-valley_03.jpg。
| 游戏 | 主页 | 关卡内 HUD | 结算 | 暂停 | 弹窗 | 简洁但不单调的手法 |
|---|---|---|---|---|---|---|
| Monument Valley 1/2（竖屏，低多边形等距 3D） | 截图中未见 | 只有左上角 1 个细线圆点（约占屏宽 3%），其余全是关卡（mv_03/05） | 截图中未见 | 截图中未见 | 章节标题卡：居中细体大写标题、副标题和 1 个圆形图标，背景是整屏渐变（mv2_05） | 每关换一套主色和渐变；UI 只用细线和白色 |
| Sky 光遇（横屏） | 截图中未见 | 商店图几乎不露 HUD | 截图中未见 | 截图中未见 | 截图中未见 | 暖色光源（篝火、光球）本身就是焦点；靠天色变化撑起丰富感 |
| Alto's Odyssey（横屏） | 截图中未见 | 商店图没有 UI | 截图中未见 | 截图中未见 | 截图中未见 | 同一场景用昼、夜、黄昏、星空不同的天空渐变来区分 |
| Mini Metro（横屏，扁平） | 选城页：横向一排城市名，选中项放大并带地图预览；右下是「Play / Mode」大字（mm_03） | 四周细圈图标加左侧色点；中间是线路图（mm_01） | 截图中未见 | 截图中未见 | 「Week 3」升级：白底、大标题、一行说明、2 个选项（图标+名字+一行说明），没有卡片边框（mm_04） | 每条线路一种颜色；UI 灰白、无描边 |
| Two Dots（竖屏，消除） | 截图中未见 | 顶部 1 条圆角胶囊（剩余步数+3 个目标色点+计数），右上齿轮，底部两角各 1 个小圆钮；中间是棋盘（td_01/04） | 截图中未见 | 截图中未见 | 截图中未见 | UI 只用灰白，颜色全部交给棋子 |
| 旅行青蛙（竖屏，治愈） | 场景插画占满屏；左上货币条，右上「メニュー」，左下「したく」，右下 2 个小方钮，按钮都缩在四角（tk_01/02） | 不适用（放置类） | 不适用 | 不适用 | 「かばん」：浅蓝圆角面板、3 个空格、1 个主按钮、右上 ×，背景压暗（tk_03）；相册弹窗同样结构（tk_05） | 插画信息量大，UI 统一用米色、木色小块，不抢画面 |
| Alba（ustwo，竖屏，低多边形 3D）· 补充 | 截图中未见 | 左上菜单；底部 4 个线框图标排成一排，中间 1 个罗盘；其余全是世界（alba_02） | 截图中未见 | 截图中未见 | 拍照模式：中间是手机取景器，黄色标签标注物种（alba_04） | 和我们画风最接近：线框白色图标叠在暖色 3D 场景上 |
| Florence（竖屏，叙事）· 补充 | 截图中未见 | 上半屏是叙事画面，下半屏是交互区，唯一的 HUD 是 1 条进度条（fl_02/04） | 截图中未见 | 截图中未见 | 截图中未见 | 颜色少、饱和度高，用粗描边统一风格 |
| Townscaper · 补充 | 截图中未见（宣传拼图） | 截图中未见 | — | — | — | 低多边形加柔和的青绿和砖红，可作为配色参考 |
| 羊了个羊、跳一跳 | **没找到真实截图，未拆解** | | | | | |

## 2. 共性观察
1. **一屏一个焦点**：看得到的 HUD 都在 1–5 个元素之间，并且贴边或贴角。屏幕中间 60% 以上留给场景或玩法（MV、Two Dots、Alba、旅行青蛙）。
2. **UI 是低饱和的中性色，颜色交给内容**：Two Dots、Mini Metro 的 UI 是灰白，MV 用白色细线，旅行青蛙用米色、木色。
3. **弹窗结构固定**：标题、1 块内容、1 个主按钮，加一个关闭（旅行青蛙、Mini Metro）。截图里没有出现 3 个以上并列按钮。
4. **「不单调」来自场景、光和色彩的变化**（MV 每关换色，Alto、Sky 换天色），**不靠多加 UI 元素**。
5. **图标统一**：同一款游戏里图标线宽一致、外框一致（Alba 的线框、Two Dots 的圆钮、旅行青蛙的木牌）。

## 3. 给《咦 起风了》的布局原则（7 条）
对照现状：`ui-audit/2026-10-16/result-screen-trace/`。现在的结算界面有 3 个区块、2 条长按钮、2 个底部按钮，大约 9 个可交互或信息元素，焦点分散。
1. **每屏只有 1 个主焦点，其余降级**：结算页 = 宝箱（居中、最大、有高光），星星和分数是次要信息，底部最多 2 个按钮。这和 Funning 新定的「只留一个宝箱」方向一致。
2. **HUD 贴边、贴角，总数 ≤5**：关卡内中间 60% 屏高不放 UI；功能入口收到四角的小圆钮或木牌（参考 Two Dots、Alba、旅行青蛙）。
3. **弹窗统一一个模板**：标题、1 块内容、1 个主按钮（必要时加 1 个次按钮），右上 ×，背景压暗。暂停、设置、获得奖励都套这个模板（参考旅行青蛙 かばん、Mini Metro Week 弹窗）。
4. **UI 用低饱和暖中性色（米、木、奶白），高饱和色只给奖励和主按钮**：让宝箱和奖励「亮」起来，其余 UI 退后（参考 Two Dots、MV）。
5. **用昼夜和天色做变化，不用堆元素**：同一套布局在白天、夜间只换色板和光效（参考 Alto、Sky）。夜间 UI 也只调明度，不换版式。
6. **按钮只有一套造型，主次靠颜色区分**：同高、同圆角、同投影；主按钮用主色实心，次按钮用浅色。热区 ≥44pt，离屏幕边缘 ≥24pt（我们的 2026-10-15 issues #2、#9 就是这类问题）。
7. **大留白加少量动效来维持「温暖但不空」**：静态界面极简，用呼吸高光、漂浮奖励、风吹粒子这类动效补足生气（MV、Sky 的光和粒子思路）。

## 4. 截图来源（逐款链接）
- **Alto's Odyssey**：https://apps.apple.com/us/app/altos-odyssey/id1182456409  
  文件：altos-odyssey_01.jpg, altos-odyssey_02.jpg, altos-odyssey_03.jpg, altos-odyssey_04.jpg, altos-odyssey_05.jpg, altos-odyssey_06.jpg, altos-odyssey_07.jpg
- **Monument Valley**：https://apps.apple.com/us/app/monument-valley/id728293409  
  文件：monument-valley_01.jpg, monument-valley_02.jpg, monument-valley_03.jpg, monument-valley_04.jpg, monument-valley_05.jpg, monument-valley_06.jpg, monument-valley_07.jpg
- **Monument Valley 2**：https://apps.apple.com/us/app/monument-valley-2/id1187265767  
  文件：monument-valley-2_01.jpg, monument-valley-2_02.jpg, monument-valley-2_03.jpg, monument-valley-2_04.jpg, monument-valley-2_05.jpg, monument-valley-2_06.jpg, monument-valley-2_07.jpg
- **Sky: Children of the Light**：https://apps.apple.com/us/app/sky-children-of-the-light/id1462117269  
  文件：sky_01.jpg, sky_02.jpg, sky_03.jpg, sky_04.jpg, sky_05.jpg, sky_06.jpg, sky_07.jpg, sky_08.jpg, sky_09.jpg, sky_10.jpg, sky_11.jpg, sky_12.jpg
- **Townscaper**：https://apps.apple.com/us/app/townscaper/id1549531491  
  文件：townscaper_01.jpg, townscaper_02.jpg, townscaper_03.jpg, townscaper_04.jpg, townscaper_05.jpg, townscaper_06.jpg
- **Mini Metro**：https://apps.apple.com/us/app/mini-metro/id837860959  
  文件：mini-metro_01.jpg, mini-metro_02.jpg, mini-metro_03.jpg, mini-metro_04.jpg, mini-metro_05.jpg, mini-metro_06.jpg, mini-metro_07.jpg, mini-metro_08.jpg
- **Two Dots - Connect the Colors**：https://apps.apple.com/us/app/two-dots-connect-the-colors/id880178264  
  文件：two-dots_01.jpg, two-dots_02.jpg, two-dots_03.jpg, two-dots_04.jpg, two-dots_05.jpg, two-dots_06.jpg, two-dots_07.jpg, two-dots_08.jpg
- **旅かえる**：https://apps.apple.com/us/app/%E6%97%85%E3%81%8B%E3%81%88%E3%82%8B/id1255032913  
  文件：tabikaeru_01.jpg, tabikaeru_02.jpg, tabikaeru_03.jpg, tabikaeru_04.jpg, tabikaeru_05.jpg, tabikaeru_06.jpg, tabikaeru_07.jpg
- **Alba: A Wildlife Adventure**：https://apps.apple.com/us/app/alba-a-wildlife-adventure/id1528014682  
  文件：alba_01.jpg, alba_02.jpg, alba_03.jpg, alba_04.jpg, alba_05.jpg, alba_06.jpg, alba_07.jpg
- **Florence**：https://apps.apple.com/us/app/florence/id1297430468  
  文件：florence_01.jpg, florence_02.jpg, florence_03.jpg, florence_04.jpg, florence_05.jpg, florence_06.jpg, florence_07.jpg
