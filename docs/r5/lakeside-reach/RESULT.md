# 湖畔可达：调查与方案 A 候选

2026-10-18 15:06 EDT。分支 `cursor/r5-lakeside-reach-66d3`，基线 `gbt/r5-integrated` @ `a83e1c2`。实现 `d4fcbf2e1a09f6ab56faf23ef0bf26647740331f`。这是候选，等选定方案后再合。没有合入 `int/v1` 或 `main`。

## 为什么走不到

合法转场只有海岛→草原（帆船）、草原→天空之城（热气球）、海岛→湖畔（表内仍是 bridge，岛上支线会铺彩虹条）。没有草原↔湖畔，也没有从天空之城出发的路。`travelRegion` 原点只允许海岛或草原；往回走得到 `return-route-not-yet-available`。

地区节点只有 island / meadow / skycity。离开点是海岛 I6→草原、草原 M6→天空之城。湖畔关卡在旅途记录 11（主线 12）之后才开，手账章节只在海岛界面同步。开到的时候人已经在天空之城。

`88ed387`（2026-10-17 03:04 EDT）接过海岛→湖畔。`6f47e47`（2026-10-17 13:05 EDT）的地区走路图没有湖畔节点，主线离开点也不通向湖畔。build06 已写湖畔打进包但走不到。`region_lakeside` 541,965 B 已在 wechat 包内（当时总包 20,266,535 / 24,641,536）。

## 方案 A（本分支，默认关）

草原平走到已进包的湖畔，再平走回草原。开关 `?lakeside=1` 或 `__QF_LAKESIDE=1`，只在网页、开发版、体验版。微信正式版忽略。没有屏幕横幅。

路长 26 m（接近 4、跨越 16、到达 6），等高，1.2 m/s，`startBlendM` 4。湖景用现有挂载，南岸落在路的终点，不铺彩虹条，不预加载棋盘。返回时把这一段湖景租约收起。`ensureRegion` 在原顺序判断前插入支线；关掉时顺序字符串与基线相同。world-r1 的开关判断内联，单独转译该目录的测试不用加载 region 目录。

包体：没有新美术，未重打 wechat 包，相对 build06 的构建包差值 0。transport 子包不变。支线不挂彩虹条，湖畔绘制沿用现有实例化与静态合并，这次没有单测 DC。

转场：关掉时帆船、热气球、海岛→湖畔与基线相同。打开时只多草原↔湖畔平路；回到草原后热气球仍可出发。天空之城→湖畔仍拒绝。

## 方案 B（只写，未做）

天空之城之后再进湖畔，仍用已进包的 `region_lakeside`（541,965 B），不加新美术。现在 `travelRegion` 拒绝天空之城原点，`validateJourneyRoute` 拒绝天空之城→湖畔，人已在天空之城时 `exitSkycity` 也不放行。做成前进段要另定一种非彩虹交通，帆船和热气球可以不动。

## 测试

2026-10-18 14:59 EDT，Node v22.23.3，`QF_TYPESCRIPT_MODULE=/usr/local/lib/nodejs/lib/node_modules/typescript npx -y node@22 tools/journey-integration/run-suite.cjs`，工作区 `d4fcbf2`。122 项里 121 PASS。唯一非 PASS：`navigation-guard: BLOCKED_BROWSER`。套件状态 BLOCKED，退出码 1。`lakeside-reach` PASS：默认关时草原进不了湖畔；打开后草原→湖畔→草原，地区回到草原，没有 `[QF_LAKE]`；天空之城仍进不去；海岛→湖畔仍是原来的一次 travel。跑完已丢掉 reports 与 output。截图/视频：无。

## 遗留

平路没有贴地形。镜头用现有跟随。返回靠租约收起。水面缺失仍走共用的 `[QF_LAKE]` 回退。手账进湖畔棋盘仍是原来的海岛路径。产品还没选定湖畔放在哪一段。
