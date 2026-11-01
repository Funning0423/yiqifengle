# 市场调研：关卡节点地图、走路节奏、交通转场（给《咦 起風了》r5）

2026-10-17。所有链接都是当天用 WebSearch 检索到的公开页面。这里的数字分两类：一类是对外公开的事实，另一类是我们**据此推出来的取值**，后者会标“→ 我们取”。

## §1 结论先看（被 transitions-DESIGN.md 引用）

| # | 模式 | 证据（链接见 §2） | → 我们取的数字 |
|---|---|---|---|
| P1 | **一关一个节点，几关组成一个“区域/章节”，打完整个区域才往下走**。Candy Crush 一个章节多数是 15 关（前两章各 10 关），开心消消乐每 15 关设一道区域锁。Gardenscapes / Homescapes 一个区域要 3–6 个“游戏日”。 | [CC-1][XXL-1][XXL-2][GS-1][HS-1] | 我们每个区域只有 4 关主线（加 1 个挑战入口），比它们小很多。所以**每个区域 6–7 个节点**：到达点 + 4 关主线 + 1 个挑战/观景点 + 出发点。这样节点不会稀，也不会凭空造出关卡。 |
| P2 | **过关 → 拿奖励 → 看到进度往前走**，操作很少。Royal Match 只有两个动作：玩关卡、做任务。 | [RM-1][RM-3][RM-4] | 领完奖励后**最多 0.6 s** 就开始走路（镜头从棋盘切到跟随用 0.6 s），玩家**不用再点一下**。“下一关”按钮也走同一条路线。 |
| P3 | **走路要短**。Pocket Camp 在地图上换场景不花时间。三消地图上的节点之间通常是一段 0.5–1 s 的推进动画。 | [PC-1][PC-2] | 我们有真 3D 场景，女孩要真的走过去，但**每段可见的走路不超过 8 s**。速度沿用 1.2 m/s，所以每段最长 9.6 m 不剪。超过 9.6 m 的段：先走 3.5 s，然后 SETOFF_FADE 0.25 s 淡出、0.35 s 淡入，跳到离终点 4.2 m 的地方，再走 3.5 s。不管多长，总时长都 ≤ 7.6 s。点屏幕可以立刻跳过，只做一次 0.6 s 的淡出淡入。 |
| P4 | **点哪走哪，拖动是移动镜头**。Pocket Camp 点一下就走过去，也能拖出一条路。Township 单指拖动平移、双指捏合缩放。 | [PC-1][TS-1][TS-2] | 在探索模式下：单指点到节点或地面 → 她走过去（沿路网最短路径）。单指拖动 → 平移镜头，带惯性，摩擦系数每秒 0.9。双指 → 缩放。**不提供画路径**，因为它容易和平移冲突。 |
| P5 | **平移和缩放都要有边界，还要有“回到她身边”的按钮**。 | [MAP-1][MAP-2][TS-1] | 平移范围：只能在区域可走区域的 AABB 外扩 6 m 以内（数值见 DESIGN §4.4）。缩放：镜头离她的距离在 0.7–1.6 倍之间（以跟随镜头的 7.4 m 为 1 倍）。超出边界时有 0.25 s 的弹性回弹。右下角放一个“回到她”的按钮，44 pt。 |
| P6 | **点按目标的大小**。Apple 要求至少 44×44 pt，Android 至少 48×48 dp、间距 8 dp。 | [HIG-1][AND-1] | 节点标记的可点区域取 **48 pt**（画出来的图标只有 32 pt）。场景小物件的可点区域也是 ≥ 44 pt。两个节点在屏幕上的距离小于 56 pt 时，取离她近的那个。 |
| P7 | **节点之间的间距**。开心消消乐的藤蔓地图上，关卡在竖屏里大约一屏 5–8 个。 | [XXL-1][XXL-3] | 我们的地图是 3D 斜视角，按每个节点 6–20 m 算（实测见 DESIGN §3），用缩小后的地图镜头（1.6 倍）时**一屏能看到 3–5 个节点**。 |
| P8 | **区域打完后再开放自由探索**。Gardenscapes / Homescapes 的区域都是做完任务才解锁下一个，开放世界里区域本身就是关卡门槛。 | [GS-1][HS-1][SKY-2] | 一个区域 4 关主线**全部通过**，才开放该区域的自由探索：可以拖动镜头、走到任何节点、点场景物件。没打完之前，只能点“下一个解锁的节点”和场景物件（物件点了有反馈，但她不走过去）。 |
| P9 | **飞行和航行要“好上手、开心、轻”**。Sky 把飞行做得人人都能飞。Genshin 里滑翔很轻，Waverider 在手机上惯性重、难操控，玩家抱怨很多。 | [SKY-1][SKY-2][GI-1][GI-2] | 帆船和热气球**全部自动驾驶，没有操控**，只会轻微摇晃。最大转向角速度 ≤ 20 °/s（和 Landing A 一样），没有急加速（≤ 3 m/s²，沿用 JOURNEY_TIMING_LIMITS）。 |
| P10 | **换场景时要无缝**，看不出加载。Alto's Odyssey 的群系过渡就是刻意做得不明显。 | [ALTO-1][ALTO-2] | 每一帧背景都完整，这是硬性要求：天穹、云层、海平线、远景卡片缺一不可，用自动测试来卡（DESIGN §8）。目的地先加载好、藏起来，确认可见之后才出镜。**全程不允许出现加载黑屏**（淡出淡入只允许在“跳过”时出现）。 |
| P11 | **固定的、精心设计的视角**。Monument Valley 的关卡只在一个固定的正交视角下成立，走路靠预设的落点。 | [MV-1][MV-2] | 关卡节点用固定的“棋盘相机”，这个不变。跟随镜头和地图镜头也都用**预设的路网**（节点和连线），不用 NavMesh。 |
| P12 | **转场时长**。Build05 现在的两段：04→05 是 34.2 m / 28.5 s，08→09 是 44.3 m / 36.9 s。海岛→湖畔被评审要求压到大约 17 s。 | 代码 RegionJourneyCore 和 journey-scene，以及 c375304 的评审意见 | **帆船 ≤ 28.5 s + 2 s，热气球 ≤ 36.9 s + 2 s**，这是上限。目标是帆船 24 s、热气球 30 s。 |
| P13 | **微信的硬性限制**：总包 30 MB，主包 4 MB，独立分包 4 MB。iOS 高性能模式下，内存上限是 1 GB（2 GB 内存的机型）或 1.5 GB，建议控制在 1.2–1.3 GB。 | [WX-1][WX-2][WX-3] | 我们自己的门限是总包 ≤ 24,641,536 B。r4 是 19,335,755 B，还剩 5.3 MB 余量。每个新分包 ≤ 1.0 MiB。转场期间最多同时驻留**两个区域**（出发地和目的地），上一个区域在镜头离开后 2 s 内释放。 |

## §2 来源

**Royal Match**
- [RM-1] Pranay Sarepaka, ROYAL MATCH BREAKDOWN: PART 1. https://pranaysarepaka.substack.com/p/royal-match-breakdown-part-1
- [RM-2] NOVASMC, Royal Match decision pattern map. https://decision.novasmc.com/en/decision-patterns/games/royal-match
- [RM-3] Funovus, Royal Match Dominates Match-3. https://www.funovus.com/blogs/royal-match-dominates-match-3-what-can-all-designers-learn/
- [RM-4] Naavik, Royal Match: Success Through Iteration. https://naavik.co/digest/royal-match-finding-success-through-iteration/

**Gardenscapes / Homescapes**
- [GS-1] Playrix 帮助中心，How do I unlock new areas in the garden? https://playrix.helpshift.com/hc/en/5-gardenscapes/faq/15992-how-do-i-unlock-new-areas-in-the-garden/?l=en&p=web
- [GS-2] Gardenscapes Wiki，Maze Garden（5 天，162 颗星）。https://gardenscapes.fandom.com/wiki/Maze_Garden
- [HS-1] Playrix 帮助中心，Homescapes 的 Unlocking new areas in the mansion。https://playrix.helpshift.com/hc/en/14-homescapes/faq/1101-unlocking-new-areas-in-the-mansion/
- [HS-2] Homescapes Wiki，Living Room（6 天，232 颗星）。https://homescapes.fandom.com/wiki/Living_Room

**Township**
- [TS-1] Playrix 帮助中心，Township 的 Scroll。https://playrix.helpshift.com/hc/en/3-township/faq/16484-scroll/
- [TS-2] Township Wiki 论坛，VIEW SIZE OF GAME。https://township.fandom.com/f/p/4400000000000051554

**Candy Crush（Saga 地图）**
- [CC-1] Candy Crush Wiki，Episode：多数章节 15 关，前两章各 10 关。https://candycrush.fandom.com/wiki/Episode
- [CC-2] Mobilegamer.biz，How King defines a good level。https://mobilegamer.biz/how-king-defines-a-good-candy-crush-saga-level-and-why-it-constantly-prunes-the-bad-ones/

**开心消消乐**
- [XXL-1] designmag.cn，《“开心消消乐”游戏体验分析》：藤蔓树地图，果实代表关卡。http://designmag.cn/%E5%BC%80%E5%BF%83%E6%B6%88%E6%B6%88%E4%B9%90%E6%B8%B8%E6%88%8F%E4%BD%93%E9%AA%8C%E5%88%86%E6%9E%90/
- [XXL-2] 腾讯游戏学堂，《开心消消乐》极高用户忠诚度与极难关卡：每 15 关一道区域封锁。https://gwb.tencent.com/community/detail/109680
- [XXL-3] 4399，开心消消乐游戏界面。https://news.4399.com/gonglue/xiaoxiaole/xinshou/323864.html

**Sky: Children of the Light**
- [SKY-1] Apple Developer，Behind the Design: Sky。https://developer.apple.com/news/?id=zm47it7t （中文版：https://developer.apple.com/cn/news/?id=zm47it7t ）
- [SKY-2] Game Developer，Crafting the mobile-friendly atmospheric storytelling of Sky。https://www.gamedeveloper.com/design/crafting-the-mobile-friendly-atmospheric-storytelling-of-i-sky-children-of-the-light-i-

**Alto's**
- [ALTO-1] MobileSyrup，Alto's Odyssey aims to add variety（群系之间做成无缝过渡）。https://mobilesyrup.com/2017/06/13/canadian-made-altos-odyssey-aims-to-add-variety-to-the-series-calming-formula/
- [ALTO-2] Alto's Odyssey Wiki，Biomes。https://altosodyssey.fandom.com/wiki/Biomes
- [ALTO-3] Game Developer，Road to the IGF: Alto's Odyssey。https://www.gamedeveloper.com/business/road-to-the-igf-team-alto-s-i-alto-s-odyssey-i-

**Monument Valley**
- [MV-1] GDC Vault，Designing Monument Valley: Less Game, More Experience。https://www.gdcvault.com/play/1020878/Designing-Monument-Valley-Less-Game
- [MV-2] MCV，Unity Focus: Monument Valley（固定正交视角、预设落点）。https://mcvuk.com/development-news/unity-focus-monument-valley/
- [MV-3] Game Developer，Making the impossible possible in Monument Valley。https://www.gamedeveloper.com/design/making-the-impossible-possible-in-i-monument-valley-i-

**Animal Crossing: Pocket Camp**
- [PC-1] Nintendo 支持，FAQ（点按移动，拖动让角色跟随）。https://support.ac-pocketcamp.com/en-US/faq
- [PC-2] Pocket Camp Complete 支持，How do you move the player? https://faq.complete.ac-pocketcamp.com/hc/en-us/articles/37571573161881-How-do-you-move-the-player

**Genshin 的帆船和滑翔手感**
- [GI-1] r/Genshin_Impact，I'm getting frustrated with Waverider on mobile。https://www.reddit.com/r/Genshin_Impact/comments/nxb45o/im_getting_frustrated_with_waverider_on_mobile/
- [GI-2] r/Genshin_Impact，Where is the Gliding Physics? https://www.reddit.com/r/Genshin_Impact/comments/sm2qau/where_is_the_gliding_physics/
- [GI-3] Game8，Waverider Controls。https://game8.co/games/Genshin-Impact/archives/333642

**地图平移和缩放的通用做法**
- [MAP-1] Levi，Implementing multi-touch camera controls (with inertia!)。https://devlog.levi.dev/2022/04/implementing-multi-touch-camera.html
- [MAP-2] Pixi-Viewport 的 clamp / clampZoom 做法。https://salivity.github.io/pixi.js/article/smooth-pan-zoom-and-bounds-with-pixi-viewport-in-pixi-js

**点按目标大小**
- [HIG-1] Apple 的 UI Design Dos and Don'ts（44×44 pt）。https://developer.apple.com/design/tips/
- [AND-1] Android 无障碍帮助，Touch target size（48 dp，间距 8 dp）。https://support.google.com/accessibility/android/answer/7101858?hl=en

**微信小游戏**
- [WX-1] 微信开放文档，分包加载（总包 30M、主包 4M、独立分包 4M）。https://developers.weixin.qq.com/minigame/dev/guide/base-ability/subPackage/useSubPackage.html
- [WX-2] 微信开放文档，代码包。https://developers.weixin.qq.com/minigame/dev/guide/base-ability/code-package.html
- [WX-3] 微信开放文档，高性能模式（iOS 内存 1 GB / 1.5 GB，建议 1.2–1.3 GB）。https://developers.weixin.qq.com/minigame/dev/guide/performance/perf-high-performance.html

## §3 局限
- Royal Match、Township、Pocket Camp 的具体参数（节点在屏幕上的像素间距、平移阻尼、转场秒数）**都没有公开**。§1 里这几项是我们根据公开描述，再结合我们自己的实测场景几何（DESIGN §3）推出来的，上线前要用真机录屏再核一遍。
- 关于 Genshin 手感的证据来自玩家社区（Reddit），只能当定性参考。
