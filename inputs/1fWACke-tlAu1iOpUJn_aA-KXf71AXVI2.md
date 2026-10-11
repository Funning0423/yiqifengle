# 咦起风了 Grokbot 工程交接 A至F

版本 MIG-003-AF-20261008-2328。作者 dot；接收 Grokbot。仅限本小游戏，作为 Cocos 迁移执行方案 v2 与 cocos-asset-v1-proposed 的追加说明。请先完成 P0 室内门椅、角色动作和门外海岛连续切片，再交 P1 草甸与天空白模；天空是最高美术验收重点。本次只增加文档与清单，没有修改代码、美术或旧共享文件。

## A 相机与椅子接触

相机 -4.95 与 camera-world t0 均为比较候选，先统一单位、轴向、FOV、target 和 near plane，再用同一坐姿与起身路径截图、世界轨迹验证。不能只用单个数值决定镜头正确。

禁止全局关闭椅子与布料碰撞。必要时仅在坐姿状态过滤角色 locomotion capsule 与椅子，由 seat anchor 保持支撑；手、裙与围裙仍保留椅子接触代理。起身达到净空后恢复 capsule 碰撞，必须记录状态切换条件，不允许 body root 瞬移或突然对齐。交坐下、停留、起身全过程接触与穿插证据。

## B 门与相机绕行

“画面左开”的参照是人在房内看向门外；外景反向观察时画面方向翻转是预期。相机从角色右侧通过，并位于门扇 swept volume 的相反侧。以门轴、门角范围、角色路径与相机世界坐标轨迹验证，不以某张截图的左右标签代替世界路径。门把、手接触点、门前后通行锚及出口均要给真实 node_path 和矩阵。

## C 裙围裙 骨架与根运动

可以在独立候选 .blend 中将黄色裙子与白围裙分成对象，保留原源文件。提供旧 vertex ID 到候选对象/顶点的映射、UV、权重、rest transforms 和全部原22骨名称；不重排旧模型顶点。新增围裙骨可进入候选 manifest，但不能直接接入旧 loader。白围裙双角应轻盈离裙并回落，不以衣物膨胀或撑臂掩盖穿插。

1.626m 只是临时适配目标，不代表用户批准改变 B 的身体比例。只可先做一致 root scale，明确身高口径为包含鞋、到头顶、不含帽饰，并给原量尺与候选量尺；×1.415282 尚未核验。认可的 B 修长比例继续保留。

root motion 由 dot controller 单独拥有。交 in-place 动作、独立参考 root trajectory 和事件时间戳，禁止骨架与 controller 双重积分。动作覆盖坐椅→起身→左转→走门→触把→开门→出门→回屋顺手关门→坐下，并提供脚落地、触把、开关门、落座、起身净空等事件。Blender cloth 缓存不等于可在 Cocos 运行，需烘焙后的可导入方案。

## D 天空巨型机器人

9m 指完整站立高度候选，不能把蹲坐 bounding box 拉到9m。保留旧4.515版本及原场景锚。分别交站立与蹲坐 bbox、姿态、量尺、脚底与交互 anchor；视觉体积、简化物理 collider 和交互范围独立设置，禁止用完整视觉 bbox 扩大机器人碰撞或交互。核验步道与相机净空、女孩对照尺度及棋盘遮挡。9m 的外观效果仍待用户视觉确认，不写成已批准。

## E 入口与局内构图

河流和铃铛应在入口及互动镜头可见；进入棋盘玩法后保留在外围，不能遮住棋盘或抢夺辨识。云影采用 UV/材质候选方案，避免一张巨大的透明覆盖层；先验证目标渲染路径、透明排序与层次。草甸保留开阔绿坡、柔和光和风吹草浪，天空保留云海、巨型机器人、层次空间及探索感。

## F 三地区内容与场景复用

已读取 R3 balanced 与 qualified 实际目录，36条名称和 ID 一一相符，三区各12条。它们是挑战册数据/API候选，并非已经上线的36关。旧12主线和海岸9关共21关保留。采用潮汐4、草甸3、天空4个可组合环境状态，共11个复用状态，不做36个独立场景。以下映射是美术编排提案，不改逻辑 config、theme key、存档或稳定 ID；JSON 含逐关 revision/hash。

### 潮汐灯塔

- tide.shore 贝湾沙岸：浅水、贝壳与细浪，留出灯塔远景。
  - tide-c01-001 潮线三灯（原 theme seaBeach）
  - tide-c01-004 贝湾短航（原 theme seaBeach）
  - tide-c01-009 贝湾留白（原 theme seaBeach）
- tide.channels 双汊潮渠：复用礁石、岸根与潮渠模块。
  - tide-c01-002 竖潮转弯（原 theme seaLagoon）
  - tide-c01-003 双汊岸根（原 theme seaLagoon）
  - tide-c01-005 长堤短湾（原 theme seaTide）
  - tide-c01-007 三礁成线（原 theme seaTide）
- tide.bells 潮洞风铃：潮洞框景与细小风铃。
  - tide-c01-006 借潮成线（原 theme seaBells）
  - tide-c01-008 潮洞双响（原 theme seaBells）
- tide.return 雾潮灯塔：同一岸线切换薄雾、灯光与远景。
  - tide-c01-010 回潮再访（原 theme seaFog）
  - tide-c01-011 错层回潮（原 theme seaFog）
  - tide-c01-012 灯后留一线（原 theme seaBeacon）

### 风车草甸

- meadow.fields 开阔田圃：绿坡、曲径、田埂与风吹草浪。
  - meadow-c01-001 田埂两边（原 theme orchard）
  - meadow-c01-002 曲径绕圃（原 theme orchard）
  - meadow-c01-004 三片小田（原 theme harvest）
  - meadow-c01-009 草甸轻唱（原 theme orchard）
- meadow.bridges 花道风车桥：复用桥墩、花道及风车远景。
  - meadow-c01-003 双轮桥墩（原 theme orchard）
  - meadow-c01-007 半桥花道（原 theme harvest）
  - meadow-c01-010 分叉高田（原 theme harvest）
- meadow.bells 风铃轮庭：风铃、风车与花草密度变化。
  - meadow-c01-005 交错齿轮（原 theme bells）
  - meadow-c01-006 风铃和弦（原 theme bells）
  - meadow-c01-008 田角留线（原 theme harvest）
  - meadow-c01-011 中心慢结（原 theme bells）
  - meadow-c01-012 两轮一曲（原 theme bells）

### 天空之城

- sky.gate 星门云岸：云海层次、星门与远近平台。
  - sky-c01-001 星位辨色（原 theme autumn）
  - sky-c01-002 星门偏航（原 theme autumn）
  - sky-c01-004 一颗晚星（原 theme tropic）
- sky.bridges 折返云桥：复用云桥与平台，保留通行净空。
  - sky-c01-003 折返云桥（原 theme autumn）
  - sky-c01-005 双桥交错（原 theme tropic）
  - sky-c01-007 中庭往返（原 theme tropic）
  - sky-c01-010 星位双岸（原 theme tropic）
- sky.court 星庭机器人：巨型机器人、星庭与可探索层次。
  - sky-c01-006 星庭留光（原 theme autumn）
  - sky-c01-008 星丝分岔（原 theme tropic）
  - sky-c01-009 云间空拍（原 theme autumn）
- sky.finale 远近星环：星环与光色变化，保留机器人可见性。
  - sky-c01-011 远近星环（原 theme beacon）
  - sky-c01-012 群星终曲（原 theme beacon）

## 音乐与音效交付

情绪为温暖、轻风、惊叹，避免战斗感。WAV 48kHz/24bit 为母带；交房间、潮汐、草甸、天空四首60–90秒可无缝循环 BGM，三区环境声各20–40秒，房间环境声10–20秒。普通事件音0.1–2秒，奖励音2–4秒。脚步需4–6个替换版本；椅子、衣布、门把、开关门、浪、鸟、鱼、珍珠、星、风车、铃、机器人轻鸣、消除连锁、工具、取消、成功与失败全部列入 JSON。不得用随机音效消耗规则 RNG；预览/取消不误触发成功音，重复回调不重复播奖励。

压缩运行时预算仅为提案：BGM 96–128kbps stereo，90秒≤1.5MB；环境声96kbps，30秒≤0.5MB；SFX mono 48–64kbps，一般2秒≤40KB。压缩运行时合计≤10MB、首屏≤1MB，其余按需加载，母带不计入运行时。AAC/MP3仅为候选，最终由适配器与目标设备验证，特别检查编码延迟、无缝循环、切后台/恢复、打断与音量。码率换算和容器开销需要实际文件复核，不能把目标预算称为实测。

不新增配音，不使用未授权电影音乐。每个素材必须有来源、作者、许可、hash、时长、声道、循环采样点、增益/峰值、压缩字节数及事件绑定。声音先交小样与 license，再逐区交付。

## 导出与验收回执

Grokbot 负责独立可编辑 .blend、贴图/许可、冻结 GLB（必要时另交验证过的 FBX）、动画和接触代理；dot 负责规则、控制器、镜头适配、存档、Cocos集成及测试。源轴向→glTF→Cocos矩阵、单位、根变换、真实 node_path、bounds、骨架/权重及导出器精确版本都写入 manifest。1 Cocos unit = 1m、导入 Y up 是候选约定；旧程序单位不能直接当米，门外 +Z 尚需样本核验。单一集成人维护 .meta/scene/prefab，禁止覆盖他人源文件。

下一次回执应包含 task_id=MIG-003、已读本版本与文件ID/hash、实际 Blender版本/渲染器/色彩管理、可写目录、P0交付文件hash、锚点映射、A至F逐项结果及缺口。先给室内白模与动作测试片，再接海岛外景；草甸/天空白模并行准备，天空优先审图。

当前未验证：相机数值与路径、1.626m口径和×1.415282、机器人9m外观批准、实际素材导出导入、Cocos精确patch/编译、微信设备音频编解码、包体/内存/帧率及真实手机体验。R3 qualified 只支持其固定种子的确定性无工具逻辑证据，不代表人类难度、场景或 Cocos 验收通过。Drive文件存在不代表 Grokbot 已读或拥有写权限。

## 来源

- Cocos迁移执行方案 v2、Cocos资产接口契约 v2、给Grokbot Cocos迁移资产任务 v2、首次Grok沟通与资产契约补充 20261008 2244。
- POLISH09 GAMEPLAY CONTENT R3 的 balanced-catalog.json、qualified-catalog.json 与 COCOS-ADAPTER-CONTRACT.md。较早 DESIGN-RATIONALE 的未扫描描述不覆盖后续 qualified 固定种子证据，后者也不扩大到真人或设备验收。

