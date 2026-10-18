# 自由视角（feat/free-camera-r1）

除了消消乐棋盘，玩家可以绕女主角转动镜头看同一套世界。美术穿帮只做了审计，写在 `SCENE_360_AUDIT.md`，这一轮没有改模型。

## 原来的镜头

所有写镜头的地方仍然走 `applyCameraPose` / `fromLookAt`。姿态是位置、看点、垂直 FOV。单位是米，+Y 朝上。

`ExploreCameraCore` 里原来的状态没有改语义：

| 状态 | 原来做什么 |
| --- | --- |
| `FollowWalk` | 人走的时候镜头跟在身后，拖动被忽略。 |
| `MapExplore` | 在一张约 52° 的地图上平移，双指缩放大约 0.7..1.6，不是绕人转。 |
| `Board` | 棋盘机位，探索手势关掉。 |
| `BoardToFollow` / `FollowToBoard` | 进出棋盘的混合。 |
| `Transition` | 区域切换。`transition()` 的测试行为没动。 |

另外还有两套不在这个枚举里的锁：

- 房间：`RoomLook` 固定原点，水平大约 −140°..+14°，俯仰 −12°..+12°。门的提示用同一套角度。常量没改，相机帧测试还在直接 new `RoomLook`。
- 岛：`IslandRail` 沿离开家园的弧推拉（近端约 0.46）。`IslandHomeInteraction` 原来只认竖直拖动和双指，点灯塔回家，点小屋休息。8 像素以内仍算点击。
- 过场：`setCamera` 和 `animateCamera` 独占镜头。`jobs` 还在跑、或这一帧刚打过过场标记时，自由轨道不写。
- 棋盘和混合期间 `ExploreGate.exploreEnabled()` 为假，区域行走的手势直接被丢掉。

区域行走里，`guardLens` 会对整棵网格做射线，太贵，不能每帧绕镜头都打。小游戏包里 QA 的 `frame()` 本来就会被编译掉。

## 现在怎么转

新的数学在 `creator-build-project/assets/scripts/region/FreeOrbit.ts`，不引用 Cocos，节点测试和真机走同一份。

- 绕女主角胸口转。水平角不限，棋盘除外。
- 俯仰和距离按区域读 `ORBIT_LIMITS`。
- 双指：张开靠近（和岛上原来的缩放同向）。缩放倍数不在 0.25..4 里的丢掉。
- 松手有惯性，时间常数 0.16 秒，角速度有上限。`step` 把 dt 卡在 0.1 秒，避免切后台之后镜头飞走。
- 第一下拖动会先对准当前镜头再转，避免「一碰就弹」。
- 手指还按着的那一帧不开始惯性。松手才衰减。
- 过场调用 `pause()`。回到同一区域、而且玩家曾经拖过，才用 0.55 秒 smoothstep 回到原来的角度。没拖过就留在跟拍镜头上，不抢。
- 换区域 `forget()`。棋盘 `armBoard()` 记住进来前的角度，出来 `disarm()` 再还回去。

两套实例，避免房间和岛互相覆盖：

- `WorldFlowComponent`：房间一个，岛一个。探索行走开启时这边不写，免得和区域舞台抢相机。
- `RegionNodeStage`：草地、天空城（以及以后若挂上的湖边）共用一个，跟人走。玩家没抢镜头时，每帧仍写跟拍；抢过之后水平角留在世界上，位置跟着人。

房间离开：若自由轨道已经转过，出门的连续镜头从轨道解算结果起步，而不是从没转过的 `RoomLook` 起步。没转过则和原来一样。

## 各区域限制

表在 `ORBIT_LIMITS`。距离是到胸口看点的米数。

| 区域 | 俯仰（度） | 距离（米） | 水平 | 垂直 FOV |
| --- | --- | --- | --- | --- |
| 房间 home | −14 .. 26 | 1.25 .. 3.35 | 不限 | 60 |
| 灯塔岛 island | −8 .. 58 | 4.2 .. 52 | 不限 | 42 |
| 草地 meadow | −12 .. 48 | 3.2 .. 14 | 不限 | 48 |
| 天空城 skycity | −6 .. 55 | 4 .. 22 | 不限 | 48 |
| 湖边 lakeside | −10 .. 42 | 3.6 .. 16 | 不限 | 48 |
| 棋盘 board | −2 .. 2 | 6.6 .. 7.8 | 锁定时的朝向 ±4° | 48 |

房间另有 `keepInside`：镜头留在大约 x −1.85..1.05、y 0.7..2.2、z −4.72..−1.55，臂长不够就缩短，而不是穿墙。岛的距离上限放到 52 米，是为了接住现有大约 46 米的广角，第一下拖动不会突然拉近。

手感：拖满一屏大约水平 128°、俯仰 72°。手指上移是抬头（俯仰变小），和原来的 `RoomLook` 同向。

湖边的数字在表里，但湖边不在 `REGION_NODES`，现在没有行走手势，镜头仍是棋盘远景。没有为它新做一套触摸。

## 手势怎么分

`ExploreInput` 的拖动改成每一帧的像素增量，不再从按下点累加。双指把缩放倍数放在 x。拖动或缩放结束发送 `release`，不再把按下时的屏幕坐标当成一次拖动（旧地图会在松手时跳一下）。点击仍然送屏幕坐标。`classifyPointers` 没改，原来的测试继续有效。

判定仍是：移动超过 10 点才算拖，按住 0.25 秒以内、没拖开，算点击走路或交互。棋盘和混合期间探索关闭，这些手势不会进轨道。

岛上的 `IslandHomeInteraction`：调用方若提供了 `orbit`，拖动和缩放走轨道，不再同时 `pull`。没提供时，竖直拖动和缩放保持原样。灯塔、小屋的点击阈值没放宽。

## 碰撞

不每帧对网格打射线。最多每 400 毫秒收一次包围盒，最多 32 个，只要跨度大约 0.25..16 米、离人 28 米内的。名字像天空、云、海、浪、鸥、烟、光束、百叶、精灵、粒子、彩虹的跳过，避免被远景壳把镜头推飞。

解算顺序：室内先留在 `keepInside`；行走区域用探索盒在水平方向内收 2 米（岛的广角不用这个盒子，否则 48 米处的镜头会跳回来）；离地至少 0.45 米；再按包围盒沿看点方向把镜头拉出墙和屋子；臂长最短大约 0.8 米。大壳（跨度大于 16 米）人已经在里面就不算撞上。

## 棋盘和过场

进棋盘：轨道记一笔快照，限制换成表里的 board 行。漏进来的拖动也只有大约 ±4° 和很小的俯仰。区域舞台在 `restoreBoard` 里 `armBoard()`，混合一开始就 `pause()`。

过场：`setCamera`、进关卡镜头、`animateCamera` 的每一拍都 `noteCinematic()`，两套房间/岛轨道暂停。这一帧和还有任务在跑的时候，`settleOrbit` 不写。过场结束、人回到房间或岛、而且曾经拖过，才平滑回到那个角度。区域行走在奖励和终章之后走 `handOrbitBack`，同样只在玩家抢过镜头时才回。

## 性能

微信小游戏上少做的事：

- 自由轨道不调用 `guardLens` 的全网格射线。
- 包围盒缓存 2.5 Hz，上限 32。
- 只有 `shouldWrite()` 为真才 `applyCameraPose`。跟拍没被抢走时，区域舞台仍按原来的频率写跟拍，不额外多算一套碰撞。
- 惯性用指数衰减，没有弹簧迭代。
- dt 上限 0.1 秒。

`guardLens` 还在，场景接线测试仍然要求这段代码留在 `RegionNodeStage` 里。

## 没动的东西

- 没改 `CharacterMotion.ts`、`anim_meta.json`。冻结清单仍是 `tools/journey-integration/frozen-production-inputs.json`。
- 没改 `RoomLook` 的角度常量，也没改 `IslandRail` 的弧。
- 彩虹桥没有加回来。岛到草地仍是帆船，草地到天空城仍是热气球。不是 bridge 的腿上，`RainbowBridge*` 继续隐藏。岛到湖边、以及帆船预载超时的回退，代码里还是 bridge，这一轮没改交通选择。审计里记了这条遗留。

## 测试

`tools/region-nodes/test_free_orbit.cjs` 已挂进 `run-suite`（id `free-orbit`，紧跟 `explore-camera`）。覆盖：水平可转多圈、俯仰和距离夹紧、松手后惯性再停住、双指近远、棋盘锁、过场暂停后平滑回来、室内不穿出盒子、大壳不把镜头推飞。

`node tools/journey-integration/run-suite.cjs`：124 项里 123 项 PASS。唯一不是 PASS 的是 `navigation-guard`，跑套件的脚本自己把会启动浏览器的旧测试标成 `BLOCKED_BROWSER`，这一轮没有改它。逻辑项，包括 `free-orbit`、`explore-camera`、`explore-input`、`region-nodes-scene-wiring`、`lens-clearance`、`lakeside-landing-hook`、`production-integrity`、`es5-iterator-spread`，都过了。

镜头净空测试原来读仓库外面的 `r5-region-nodes-r3/maps/topmap.cjs`。旁边那份不在时，改为读仓库里的 `docs/r5/maps/topmap.cjs`，断言还是同一条地面规则（`up>.72`、`STEP=.36`）。进关卡的湖边「按住棋盘机位」回调仍是空函数，不在按住期间写镜头；过场标记打在这条分支前面。
