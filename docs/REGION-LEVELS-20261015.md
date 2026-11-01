# 草原与天空之城：正式关卡目录与通关衔接

## 本次实际交付

- 把现有主线 05–08 正式归入「风车草原」、09–12 归入「天空之城」，区域名、关卡名、教学节奏与策略说明已接入生产 Session → Controller → MainlinePort → ManagedMobileBoardUI 的显示链路。
- 目标数、步数、障碍布局来自现有冻结三消引擎；不复制一套能漂移的规则，也不修改旧存档的回放签名。
- 补齐原 verified-seeds.js 注释指向但快照中缺失的 36 种子可解证据，新增可重跑的生成/核对命令。
- 提供统一、只读、失败关闭的区域进入/顺序推进接口，供连续步行旅程使用。
- 主线 snapshot 新增 campaign / regions / rewardHandoff。只有真实已登记胜利且 result.saved 才有领奖衔接，失败、未保存或坏档不显示可领取状态。奖励仍走既有真实存储事务。

实际玩法是 7×7 相邻交换三消。草原/天空已有各 4 个 R5 机制挑战，本次完整复验它们的 24 个发行种子并纳入验收，没有宣称这些既有关卡是新造内容。

## 主线内容节奏（生产读取）

| 关卡 | 区域/名称 | 目标与步数 | 节奏 |
| --- | --- | --- | --- |
| 05 | 草原 · 风车下的花环 | 苔藓12、蓝莓14；31步 | 进入草原，环形开路 |
| 06 | 草原 · 草桥双结 | 根须8、草莓14；31步 | 双层根须，练习分波命中 |
| 07 | 草原 · 风铃合奏 | 青叶14、花朵12、特殊果实2；34步 | 离开固定障碍，练习制造特殊果实 |
| 08 | 草原 · 长风的约定 | 苔藓9、根须5、青叶12；34步 | 中心三层根结与周边目标收束 |
| 09 | 天空 · 云阶初见 | 苔藓13、根须6、花朵12；35步 | 阶梯布局与双层根须 |
| 10 | 天空 · 星门前的根结 | 根须9、橡果16；36步 | 三层根须，范围特殊果实 |
| 11 | 天空 · 云庭花园 | 苔藓12、根须4、蓝莓16、type5目标16；38步 | 四角与四类目标管理 |
| 12 | 天空 · 天空之城的回声 | 苔藓13、根须9、草莓18、花朵18；42步 | 三地区综合收束 |

目标键和数量直接取冻结配置。上表 type5 保留真实键，不擅自改造当前棋子资产语义。具体指导不是实测的人类难度结论；可解证据仅证明发行开局存在合法获胜路线。

## 区域进入、挑战、奖励三个门槛

- 草原进入：主线 01–04 均已登记完成。天空进入：01–08 均已登记完成。
- 草原 R5 挑战：01–08 完成；天空 R5 挑战：01–12 完成。地区内挑战继续沿用前一挑战的持久化回执门槛。
- 主线宝箱：各关首次通关取得领取资格，显式领取；重复点击、重进或重复 finish 不再发放。
- 地区工具：保留已有「本区首关完成后显式领取一次」规则。太阳种子/星剪不改成进入区域就赠送，也不新增货币。
- R5 地区印记：本地区 4 个挑战全部有真实回执，显式领取一次。

## 连续旅程接口

文件：creator-build-project/assets/scripts/mainline-r1/runtime/region-campaign.js（附声明与 Cocos meta）。

CommonJS 导出，TypeScript 使用 default import：

- Campaign.stage(stageId)：返回只读关卡目录项或 null。
- Campaign.inspect(journey)：返回 regions、完成情况、nextStageId。records 必须为完整12条，readOnly 必须明确为 false。
- Campaign.canEnterRegion(journey, regionId)：返回 {ok, reason?}；区域名 island/meadow/skycity，也接受 tide/sky 旧别名。
- Campaign.transition(journey, fromStageId, toStageId)：返回 {ok, reason?, fromRegion, toRegion, requiresTravel, nextStageId}。只接受紧邻的下一关，并检查此前所有记录。成功的04→05与08→09 requiresTravel=true；失败结果不请求移动。
- Campaign.rewardHandoff(journey, stageId, ready)：纯读领奖状态，生产 Controller 仅在 result.saved 且存在完成回执时传 ready=true。

调用者仍须先检查当前活动关局的 result.saved / completionRecorded / nextStageId；接口不代替当前关局回执检查，不负责运镜、加载或移动。没有新增存储 key，也没有新的写权限。

journey 必须来自已验证的 JourneyBridge snapshot/view。接口不会从屏幕数字、completed计数、unlocked计数或者外部原始JSON猜测解锁。缺失、readOnly、残缺记录、非整数星数、星数与通关次数不一致全部关闭进入。没有提供 regionClaims 的只读视图，礼物 claimed 返回 null，pending=false，不捏造未领取状态。

## 存档兼容与证据

- 2244份输入文件与当前 source-after-final-manifest.json 全匹配；身份与固定引擎SHA256记录在 tools/region-levels/input-identity.json。
- vendor/engine.js、vendor/progression.js、R5目录、R5回执与写入实现原字节未变。
- 新名称与区域说明只进 snapshot，不进 checkpoint.expectedState/contentSignature。旧存档可继续回放。
- 36个主线种子：613次合法交换/激活，613次每步冷恢复，全部获胜，不消耗炸弹/库存道具。
- 24个草原/天空挑战种子：227次合法动作，每步冷恢复并核对目标归零与完整终态。
- 新增10套逻辑矩阵：真实12关进度、4/8关未保存阻断、62次关中冷重建、领奖前后写入异常、重复领取、挑战印记、坏档与并发旧写者。
- 新增18个生产入口案例：8关×横竖屏的真实 MainlineHost + ManagedMobileBoardUI（Cocos内存替身）标题/目标/步数/布局；草原05与天空09经真实 ManagedMainlineBinding 输入路径完成、领奖、重复领取、冷重建。
- 旧 retry-protection 与受影响 UI 套件结果见 tools/region-levels/*results.json。

所有运行证据均为云端 Node / 实际规则与控制器 / 隔离Map存储 / Cocos内存替身。未跑完整Creator构建、WebGL像素、真实浏览器存储、Mac、微信或真机视觉验收；不将这些逻辑证据称为画面验收。

## 文件所有权与集成

本提交只拥有 mainline-r1/runtime 的目录、snapshot适配、声明和 tools/region-levels、本文档。未修改 WorldFlowCore、WorldFlowComponent、WorldNativeComposition、区域加载/背景、角色资产、权限或凭证。连续跨区路径及天空真实背景由连续旅程分支集成；独立验收需在合并树再次跑入口与背景矩阵。
