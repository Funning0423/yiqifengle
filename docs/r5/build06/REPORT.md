# r5 整合测试包 build06

工作分支 `gbt/r5-integrated`（按 2026-10-18 的覆盖要求，不用 `gbt/r5-build06`）。没有 push，没有 checkout / merge / rebase `main`。桌面文件夹保持 `/Users/shineanl/Desktop/QIFENGLE-test-build05`，没有新建 `QIFENGLE-test-build06`，也没有改名。

## 1. 输入与提交

| 角色 | SHA | tree |
| --- | --- | --- |
| 帆船 SAIL | `a596a8f8df03170484a1ae659c0ba6d0f8dd0b40` | `5dc991ffc5e00bc3fe30d41b22b6d225997f8046` |
| 区域 r3 | `4fa2d1ba22d2a99e1d8c02e79b2138fe8d069cde` | `2aa2dcb84c5485d727ca1012e206308da791bde3` |
| 热气球 v24fix | `c7d023b47cb01c47aaff07ab2c00163ce8b9ecc5` | `f7a777e18d910933987ee86f2e9fa36697d2b7ee` |
| 共同祖先 | `f569ff0d9eeb9f6ab26bdc56276fa234e60c5ac4` | — |

| 提交 | SHA | tree | 说明 |
| --- | --- | --- | --- |
| merge r3 | `9510cd6e943b605402d54a680feb240df6b4fd21` | `10d7fac75b08fa5cc65814547bfd63711487a20f` | 父提交 a596a8f8 + 4fa2d1ba |
| merge v24fix | `9faf6db59ab021cf6aea3816d9953052dddf32b6` | `05bf68b19e7a46c0a375b18e63b68420c9365699` | 父提交 9510cd6e + c7d023b4 |
| 修正 | `d98ad470c98b7a9dc18bbc74874d612e4f7540de` | `6a2578e64d7fd1895ab200c68d5e5867b4cb3367` | TransportLeg 去掉重复的 `REGION_JOURNEY_LAYOUT` 导入。这是构建和桌面包用的 HEAD |

## 2. 冲突怎么合的

顺序固定：先 r3，再 v24fix。各一个 `--no-ff` merge commit，没有 rebase、没有 squash。

- `JourneyTransport.ts`：并集。岛→草原 `sail`，草原→天空之城 `balloon`，岛→湖畔 `bridge`，未知一对回退 `bridge`。保留帆船的 6 秒预加载回退 `noteSailPreloadFallback`、`transportQaOverride`，以及 r3 的 `usesRainbowBridge`。`transportFor` 第三个参数兼容两种旧调用：字符串是 QA 种类（帆船测试），对象是宿主（`__QF_TRANSPORT` / `wx` / `location`，热气球测试）。
- `TransitAudioHooks.ts`：帆船的 hide / `emitTransit` 与 r3 的 pause / `emitTransitCue` 共用听众。补上热气球的 `emitTransitCueGated`。
- `TransitBackdrop.ts`、`TransportLeg.ts`、`TransportVehicle.ts`：两边导出不同，拼在同一个文件里。热气球段里和帆船重名的局部函数改成 `balloonSmoother`、`balloonLerp`、`balloonHeading`。`seatWorld` 做成重载：一个参数是帆船座位节点，两个参数是热气球落点。热气球的 `Pose` 类型直接用已经导入的 `WorldFlowCore` Pose，避免重复声明。
- `WorldNativeComposition.ts`：进关后同时清 `pendingJourneySelection`、`markExplore(false)`，并在 `mainline-04` 预加载草原。
- `RegionJourneyAdapter.ts`：帆船准备路径和热气球 `mountBalloonLease` 都留着。转场 `show` 时，如果这一段不是 bridge，按名字关掉 `RainbowBridge*`。
- `RegionJourneyCore.ts`：租约保留帆船的可选 `onFrame`。`ride` 走热气球那段的到达收尾，随后仍执行原来的到达记账。岛上出发的淡出在有 `ride` 时不套用（帆船自己管镜头）。
- `WorldIntegrationBoot.ts`：import 同时留下 r3 的 `MINIGAME` 和热气球的 `qaTransportEnabled`。
- `run-suite.cjs`：三边登记的测试都跑。同名 id 会互相覆盖报告文件，所以区域与热气球那几条改了 id，文件路径没丢：`region-transport-flag`、`region-transit-background-resume`、`balloon-transport-flag`、`balloon-transit-background-resume`。`frame-background` 只登记一次，文件里三段都跑。
- `test_frame_background.cjs`：帆船 0.1 秒采样、区域走路/地图、热气球 0.1 秒采样接在一起。门限没有放宽。

因整合改过的断言（旧门限没有放宽）：

- `tools/region-nodes/test_transport_flag.cjs`：不再要求三段都是 bridge，也不再要求适配器相对 `f569ff0` 逐字节不变。岛→草原为 sail，草原→天空之城为 balloon。`usesRainbowBridge` 的三态断言保留。
- `tools/transitions/test_transport_flag.cjs`：草原→天空之城由 bridge 改为 balloon。
- `tools/journey-integration/test-transport-balloon.cjs`：岛→草原由 bridge 改为 sail。

### .meta UUID

每个脚本只留帆船（第一父）的 UUID。全仓库搜索被丢掉的 UUID（带横线和不带横线）没有引用。

| 脚本 | 保留 | 丢掉 |
| --- | --- | --- |
| JourneyTransport | `cea2dbc4-6694-41ff-b83e-8565cfcbe582` | r3 `563be154-e71b-4313-a7e9-8dc3e9804cab`；热气球 `836b3b61-2f83-4403-bcf7-e8a64182965e` |
| TransitAudioHooks | `42f60906-560f-4fdc-a24c-151ff89329a4` | r3 `98bb20e3-b1d8-4d68-a238-a97ee318a0b9`；热气球 `c8d6a081-340e-4129-8f3d-3f4a4f421f58` |
| TransitBackdrop | `dfc0b8fa-50ad-4a40-a32c-b5ae31282fac` | 热气球 `ea43e252-9017-400d-b649-4e40a227ce7b` |
| TransportLeg | `07c06352-8a52-41ab-a122-f8f76c49de16` | 热气球 `314530ab-6507-444b-8da9-145110548667` |
| TransportVehicle | `4ae4d4f4-c9de-4c86-9a01-4fe2e89b7eec` | 热气球 `2094a741-1d91-494f-8e6c-59b13eca240f` |

## 3. 交通开关

```text
JOURNEY_TRANSPORT = { 'island-meadow':'sail', 'meadow-skycity':'balloon', 'island-lakeside':'bridge' }
```

彩虹桥代码还在，但不是默认：

- 网页或微信开发版/体验版可用 `?transport=bridge`（也接受 `sail` / `balloon`），或设置 `__QF_TRANSPORT`。正式版微信忽略这个参数。
- 帆船预加载超过 6 秒，下一次岛→草原走彩虹桥（`sailPreloadFallback`）。
- 不认识的地区对回退 `bridge`。
- `usesRainbowBridge(kind)` 只在 `kind==='bridge'` 时为真。
- 默认不是 bridge 时，旅程显示和地区节点舞台会按名字隐藏 `RainbowBridge*`。湖畔那段自己的 rig 仍按岛→湖畔的开关显示。冒烟里海岛和草原到达、草原节点的画面上，活动的 `RainbowBridge*` 节点数是 0。

## 4. 冻结文件

相对 `f569ff0d`：

- `frozen-production-inputs.json` 列出的路径与改动名单求交，无输出。
- `CharacterMotion.ts` 与 `anim_meta.json` 的 diff 无输出。
- `FlowReferenceStandin`：从 `class FlowReferenceStandin` 起按花括号配平取出整个类，与 `a596a8f8` 同路径文件逐字节比较，相等，39794 字节。`mountWorld` 里出现 `FlowReferenceStandin` 或 `FLOW_REFERENCE_PLACEHOLDER_NOT_B` 的行与 `a596a8f8` 一致。`WorldIntegrationBoot.ts` 只改了 import 行等非冻结部分。没有改 .scene / .prefab。

## 5. 测试

Node 22，`QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript`（5.9.3）。最终 HEAD `d98ad470`：

- `run-suite`：**120 / 121 PASS**。唯一非 PASS 是 `navigation-guard: BLOCKED_BROWSER`。跑完已丢掉 reports/output，没有提交。
- 相对帆船基线 104/105，多出来并跑过的有：`region-nodes-data`、`region-nodes-progress`、`region-nodes-walk`、`explore-camera`、`explore-input`、`node-board-pose`、`region-transport-flag`、`region-transit-background-resume`、`region-nodes-scene-wiring`、`node-markers`、`explore-props`、`advance-walk-timeout`、`lens-clearance`、`transport-balloon`、`balloon-transport-flag`、`balloon-transit-background-resume`。
- `test_frame_background.cjs` PASS。帆船段 3458 帧，最紧 clearM **2.441**（390×844，白天，`meadow_terrain`）。区域段 follow 56、map 126。热气球段 5054 帧，**seamLeak=0**，minClear 12.37，minClearCam 11.05，seam 11.4（meadowOff 11.2，cityOn 11.6）。

## 6. 构建

构建前可用空间 7.2Gi。持 `~/cursor-tasks/.build.lock`，当时没有别的 `CocosCreator` 进程。第一次 wechat 构建因 `TransportLeg.ts` 重复声明 `REGION_JOURNEY_LAYOUT` 失败（产物只有 16713 B）。修正提交后再跑 guard。

- GUARD HEAD `d98ad470c98b7a9dc18bbc74874d612e4f7540de`
- tree `6a2578e64d7fd1895ab200c68d5e5867b4cb3367`
- wechat-release **20,266,535** B（上限 24,641,536）
- 相对 r4 19,335,755：**+930,780** B
- 相对 sail-k2k7 19,641,386：**+625,149** B
- web-test **21,065,273** B

分包字节：

| 分包 | 字节 |
| --- | --- |
| ROOT | 1,871,183 |
| audio_bgm_island | 418,907 |
| board_art | 2,131,356 |
| internal | 297,535 |
| main | 1,441,669 |
| region_island | 2,998,394 |
| region_lakeside | 541,965 |
| region_meadow | 2,934,449 |
| region_skycity | 3,326,944 |
| region_transit_balloon | 531,126 |
| resources | 446,303 |
| shared_effects | 563,694 |
| static_seat_preview | 2,556,372 |
| transport_sail | 206,638 |

## 7. 截图

来源是 stage 里的 web-test，视口 390×844，触控，DPR 2，长边收到 900 像素以内。单张都小于 400 KB，md5 各不相同，洋红像素（R>200,G<80,B>200）占比为 0。pageerror **0**。console.error 两条：一条 404（与 build05 白名单里的 favicon 同类），一条 `ERR_CONNECTION_RESET`。HTTP 状态 ≥400 的响应列表是空的。网络失败 7 次，都是 `ERR_CONNECTION_RESET`，发生在开页后约 36 秒和 111 秒，不在「前 2 秒且随后同一 URL 返回 200」的白名单里。单线程 `python3 -m http.server` 在并行拉资源时会断开连接；海岛、草原、天空之城都进到了。

| 文件 | 画面 |
| --- | --- |
| `01_island_nodes.png` | 海岛、人物站在路上，没有彩虹桥 |
| `02_sail_jetty.png` | 栈桥边，女孩站在码头上，船靠在旁边 |
| `03_sail_cruise.png` | 海上，船完整，女孩坐在船上 |
| `04_meadow_arrival.png` | 到达草原，人在小路朝风车走，没有彩虹桥 |
| `05_meadow_nodes.png` | 草原关卡旗子和人物 |
| `06_balloon_board.png` | 草原上气球离地，人在吊篮里 |
| `07_balloon_cruise.png` | 云海上巡航，球是红黄条纹，人在篮里 |
| `08_balloon_skycity.png` | 看见天空之城浮岛，气球在画面右侧 |
| `09_skycity_nodes.png` | 天空之城广场、柱子和机器人 |
| `10_skycity_walk.png` | 人物在天空之城节点之间 |
| `11_night_sail.png` | 夜帆，女孩坐在船上 |
| `pkg_web_check.png` | 桌面 `web/` 开门到小岛，木牌「继续旅程」 |

## 8. 桌面包

路径：`/Users/shineanl/Desktop/QIFENGLE-test-build05`（原名，没有第二个测试包文件夹）。

替换前把 `web/`、`wechat/`、`README.txt`、`project.config.json`、`project.private.config.json` 复制到 `~/cursor-tasks/r5-build06/build05-backup/`（约 41 MB）。替换后只动了 `web/`、`wechat/`、`README.txt`。`HANDOFF/` 的文件哈希与替换前一致。根目录两个 `project*.json` 与替换前一致。

顶层：`HANDOFF`、`README.txt`、`project.config.json`、`project.private.config.json`、`web`、`wechat`。

`web/` 与 `wechat/` 的第一层名字与替换前那份相同。微信分包多了 `region_transit_balloon`、`transport_sail`。包内大量 json/bin 的哈希相对旧包有增有减，是这次构建的资源指纹，不是缺了顶层条目。

- 桌面合计 **41,429,922** B（1521 个文件，不含 `.DS_Store`）
- `web/` **21,065,706** B（含从旧包逐字节复制的 `start.command`，433 字节，可执行）
- `wechat/` **20,267,899** B（guard 的 20,266,535 加上换回旧包里的 `project.config.json` / `project.private.config.json`）
- `wechat/project.config.json` 的 appid 是 `wx3bdd911c5c06f591`
- 哈希表：`/Users/shineanl/cursor-tasks/r5-build06/hashes.txt`（`sha256<TAB>bytes<TAB>相对路径`）

替换前桌面包 1252 个文件、41488 KB。那一份完整留在 `build05-backup/`。

## 9. README.txt 全文

```text
咦 起风了 · 测试包 build06 整合版（版本 d98ad47，r5）

1. 网页版：双击 web/start.command，浏览器会自动打开游戏；关掉弹出的终端窗口即停止。
2. 微信版：打开「微信开发者工具」→ 导入 → 选 wechat 文件夹（AppID wx3bdd911c5c06f591，只做本地预览，不要上传）。
3. 进入后：点屋里墙上的玻璃牌「出发去看海」直接出门（也可以向左轻推看门口）→ 小岛 → 点「继续旅程」木牌进第一关。

这一版新增（r5）：
- 海岛到草原：坐帆船。从栈桥沿小路走上船，再出海。
- 草原到天空之城：坐热气球。
- 每个地区里有五六个关卡点，人物会在点与点之间走过去。
- 可以点按或滑动来选关卡点。
- 场景里有些物件可以点，点了会晃一晃或弹一下。
- 这一带的关卡都过了之后，可以在地区里随便走走看看。

已知问题：
- 坐着时裙摆和蝴蝶结会穿进凳子。
- 坐着时切到后台再回来，要点底部「继续」（出门途中不用）。
- 湖畔地区已经打进包里，但游戏里还走不到。
- 天空之城通关后的最后一镜，大树会挡住星环，人物也只剩一小点。这一镜还没过验收，下一版再修。
- 在天空之城自由走动时，镜头有时会钻到台阶底下。
- 点天空之城的机器人时，镜头会贴到它背面。
- 热气球飞在云海上时，球囊有时比效果图暗一点。
- 帆船有一镜在远海上，风车不在画面里；船尾的白沫也比效果图那条拖痕短。
```

## 10. 已知问题与未完成

照原样带上 r3，没有在本包里修终幕和天空镜头：

- 天空之城终幕被树干挡住，星环和人物看不清。
- 天空之城自由探索镜头会到台阶底下。
- `sky-prop` 机器人背面贴脸。
- 热气球巡航球囊偏暗（`PENDING_DEFECTS_FOR_NEXT.md`）。白天冒烟里球是红黄条纹；这条仍记在已知问题里，留给下一轮对效果图。
- 帆船 K7 远海看不到风车；K2 尾迹比效果图短。
- build05 里仍然成立的：坐姿裙摆穿凳、坐着回前台要点「继续」、湖畔进了包但还走不到。

## 11. 磁盘与清理

- 开工 `df -h ~`：Avail **7.3Gi**。
- 构建前：**7.2Gi**。结束：**7.1Gi**。
- 已删：仓库 `creator-build-project/library`、`temp`、`build`，`tools/build-guard/logs`，任务包 `stage/`，临时截图帧和浏览器目录。本地预览的 python 只结束了本任务自己的 PID。
- 留下：仓库分支 `gbt/r5-integrated`、`shots/`、`hashes.txt`、`STATUS.md`、`REPORT.md`、`build05-backup/`。
