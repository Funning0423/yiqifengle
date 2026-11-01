# 两扇门：GGbot 代码改动清单（scene/b19-basket-door2，场景设计部只改了数据和模型，没动代码）

基线：ggbot/transitions-compress 19db388e（行号按它算）。数据来源：`stances.json`（gen-stances.py），世界坐标见 `tools/transitions-continuous/transition-anchors.json`。

## 模型（已提交在本分支）
- `transport_balloon.glb`：后墙（−z）开了门洞。新节点 `basket_door_b`，铰链在 (−0.4,0,−0.84)，yaw 180 → `basket_door_leaf_b`，复用 `basket_door_leaf` 的网格。往外开，本地 +Y 转 +100°，和 `basket_door` 同号。节点 extras 里 openAxis/openDeg 跟门 A 一样。
- 规则：**门 A（`basket_door`，+z）进，门 B（`basket_door_b`，−z）出。篮内不转身。**

## 1. 篮内常量（TransitionStaging.ts:25 `TRANSITION_STAGING.basket`）
| 字段 | 旧 | 新 |
|---|---|---|
| seat | [0.032,0,−0.099], seatYawDeg 0 | **[−0.032,0,0.099]，seatYawDeg 180**（面向门 B） |
| p0（进篮终点 = 出篮起点） | [0.03,0,0.395] | **[−0.03,0,−0.395]**（= exitStartLocalB） |
| doorHinge | [0.4,0,0.84] | 进篮用门 A [0.4,0,0.84]，出篮另加 doorHingeB [−0.4,0,−0.84] |
| 新增 | — | outsideA [−0.16,0,1.75]、doorOutA [−0.072,0,1.25]、thresholdA [0,0,0.84]、thresholdB [0,0,−0.84]、doorOutB [0,0,−1.25]、stepdownEndB [−0.03,0,−1.552] |
- sit_down 根运动从 p0 往后退 0.494 m 落到 seat；stand_up 从 seat 往前走 0.494 m 回到 p0，起身后朝 180°（篮坐标）。
- test_chain_ggbot.cjs:80 断言 `basket.seat == [0.032,0,-0.099]`，要跟着改。

## 2. 进篮（段 3 BalloonTransit.ts:552 起；段 5a RegionJourneyAdapter.ts:258-264）
- 门外站位 outsideA，朝向篮坐标 170.0°（指向门槛）。door_reach 碰门 A（`basket_door`）。
- 然后 outsideA → doorOutA → thresholdA → p0 一路直走（门槛处拐 11.4°），到 p0 后**直接 sit_down（往后坐）**。去掉 walk_turn_180。
- 时长表 TransitionStaging.ts:50/52：`turn180: 1.5 → 0`（也可以删掉这个字段，同时删掉 :74/:79 里的 `+m.turn180` / `+l.turn180`）。RegionJourneyAdapter.ts:264 的 `stepInS` 同样去掉 D5.turn180。
- 草甸篮 yaw：meadow 局部 **0° → −16°**（世界 164.0°）。位置不变，还是 (3.6,6.6,−23.4)。来路改成 M4 → (3.0,6.322,−20.4) → 院门 (2.6,6.341,−20.8) → **yard_in (2.74,6.37,−21.31)** → 门外。
- 5a 系泊篮 yaw：skycity 局部 **52.65° → 50.65°**（世界 −68.19°）。位置不变，还是 (−14.8,0.09,−38.8)。

## 3. 出篮（段 4 BalloonTransit.ts:622 起；段 5b RegionJourneyAdapter.ts:342-350 + LakesideBalloon.ts:52/360）
- 篮 yaw **加 180°**，让门 B 落在原来门 A 的位置：
  - 天空城着陆：landYawSkyDeg −173.418 → **6.582**（世界 −112.25°）。如果是运镜bot 的飞行末键在给 yaw，就让他把末键 yaw +180；气球是旋转体，篮的四面现在也一样，画面上看不出差别。
  - 湖边：`vehicle.setRotationFromEuler(0, moored.doorYawDeg, 0)`（RegionJourneyAdapter.ts:229/349）→ 改成 `moored.doorYawDeg + 180`。
- exitStartLocal（LakesideBalloon.ts:52）：[.03,0,.395] → **[−.03,0,−.395]**。和上面的 +180 一起改，P0 的世界坐标完全不变：P0 = 停泊点 + rotY(doorYaw+180)·exitStartLocalB，等于原来的 rotY(doorYaw)·[.03,0,.395]。所以 v4 路径、stepMismatch、startYawRad 都不用改。
- 门：`find(vehicle,'basket_door')`（BalloonTransit.ts:525、RegionJourneyAdapter.ts:258/350）在出篮时改成 `find(vehicle,'basket_door_b')`，开门角度 0→100°，0.8 s，同号。进篮还是用 `basket_door`。两扇门在每段开始时都要复位到 0°。
- 出篮顺序：sit_hold → stand_up（停在 p0，朝 180°，**已经面向门 B，不转身**）→ idle 0.5 → door_reach（门 B）→ walk_start_stepdown（往篮 −z 走 1.157 m）→ walk_loop。
- seatYawDeg（LakesideBalloon.ts:383 `girlYawDeg-doorYawDeg`）：坐姿世界 yaw = 篮 yaw + 180 = 原来的 doorYawDeg，数值不变。

## 4. 动画映射
| 时刻 | 片段 | 门 |
|---|---|---|
| 门外 | door_reach（0.333 s 碰到门，1.8 s 可以起步） | basket_door 0→100°（0.8 s） |
| 进篮 | walk_start → walk_loop 0.8 m/s → walk_stop_bodyL | — |
| 坐下 | sit_down → sit_hold（同时门 A 用 0.8 s 关上；点火和这一拍重叠） | basket_door 100→0° |
| 到站 | sit_hold → stand_up | — |
| 开门 | idle_breathing_loop 0.5 → door_reach | basket_door_b 0→100° |
| 出篮 | walk_start_stepdown → walk_loop → walk_stop_bodyL | — |
任何一段都不用 walk_turn_180。

## 5. 上限
- TransitionStaging.ts:44 `caps.skycityToLakeside: 40` → 产品口径是 **50**（起飞算在 8 s 可见飞行里）。meadowToSkycity 是 50，不变。
- 去掉转身以后，草甸→天空城按你的时间线是 49.2 s（原来 50.7 s），天空城→湖边按产品口径是 43.88 s，详见 stances.json `budget`。
