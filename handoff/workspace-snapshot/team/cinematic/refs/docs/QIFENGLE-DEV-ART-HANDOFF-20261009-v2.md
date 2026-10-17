# 咦 起风了 开发状态与美术接手说明

日期：2026-10-09 UTC
版本：v2 完整逻辑包与实际资产接口补充
作者：dot
用途：给用户和 Grokbot 接手美术时使用。最新游戏运行源码为 5b449fa，已经整理成一个完整工程包；美术源资产另列为 WIP，不等同于已经进入游戏或通过视觉验收。

## 先拿哪些文件

- [完整 Creator 源码与输入资产 ZIP](https://drive.google.com/file/d/1W_LZObgS85wPdC3eA-fFdk7jkV9t8fLg/view?usp=drivesdk)
- [整包 SHA256 与上传回验回执](https://drive.google.com/file/d/10DtQxpFkgZFp16UWK4_irAJx36ir6DJW/view?usp=drivesdk)
- [逐文件 SHA256 清单](https://drive.google.com/file/d/15i6rwPSw28JzQKINwHK4tXP8ap0yetAr/view?usp=drivesdk)
- [最新核心美术包](https://drive.google.com/file/d/176l2eek6lgDJmElRY5bCNgk9DeeqwNMM/view?usp=drivesdk)：R5静态查看、22骨可编辑绑定、认可裙角参考与核心重建输入。
- [动作和场景参考包](https://drive.google.com/file/d/1PyaTLIjv6pqGZUVrknugV686AfTpzjTE/view?usp=drivesdk)：旧33秒全链/3秒起身参考、室内场景和未通过的A字上片静态实验。

两个普通ZIP解压到同一个父目录即可，原222项无重叠、逐字节保留；不是二进制分片。CORE中的R5和认可裙角缓存可独立冷打开，核心重建不依赖参考包。完整源码包中保留的是当前已接入视觉，未覆盖为未验收角色。

源码 ZIP 为 4,740,350 字节，SHA256 为 1e7b6a0e540c5bd2f3a38101c5902b5000e02f26acedfc3bbe53d3846898a766。上传后从 Drive 下载回验，ZIP 完整性及 267 个清单项均通过。150 个实际工程文件与累计恢复基线逐字节相同。

## 开发进度

### 已接通的运行基线

当前完整工程包含原引擎主线、原生 Cocos 棋盘、保存和恢复，以及 R5 地区入口和挑战。最新补丁修复了两条奖励规则：一星通关也能显示并领取本关宝箱；每个地区首关完成后即可按原规则领取地区工具。领取后显示已拥有，重复领取不重复奖励，冷恢复保留状态。

工具奖励进入库存，不代表棋盘中已经能消耗库存工具。R4/R5 挑战门槛仍按主线 4/8/12 关解锁，不能因地区首关工具提前可领而一起提前解锁。

当前工程仍使用灰底诊断棋盘、旧场景视觉与占位角色。核心流程可继续开发，美术还没有达到最终交付状态。没有充分依据给出整个游戏的统一完成百分比。

### 已有实际运行证据

1. 98337c7 主线基线：Mac 官方 Cocos Creator 3.8.8 编译后的 Web 实测，12 关、190 个真实操作；包含空存档首关到冷重启第二关。四目标布局、奖励去重、保存边界等证据保存在源码包 prior-98337c7-mac-mainline 目录。
2. 603810c R5 基线：Mac Web 原生入口覆盖 12 关、100 个真实操作，另有三个地区代表回放 30 个操作、奖励去重、冷进程恢复和退出后迟到回调保护。其主线解锁前提使用明确标记的隔离测试 fixture；R5 关卡本身的前置完成通过真实回放取得，不能说它是一份真实用户完整旅程。最终交付相对全流程构建只改两条呈现文字，原报告保留了这个区别。
3. 5b449fa 最新补丁：新构建实测 48 个定向操作。其中 37 个来自此前真实打出的一星主线测试档案副本，11 个来自新的空测试档案；原档案哈希保持。宝箱和地区工具两条路径均经过新浏览器进程冷恢复，运行错误数组为空。
4. 本次云端再校验：完整源码恢复与清单通过；48 个 TypeScript/native UI handler 定向输入和 6 个奖励保护用例通过。使用显式 cc/node/timer/storage doubles；另有 131 个原引擎前置重放输入用于设置测试前提，不计为新增原生 UI 验收。

这些证据来自不同构建、不同测试范围，不能相加成一次覆盖。最新补丁没有重新跑整套主线 190 或 R5 100。云端契约测试不等于官方编辑器、浏览器或手机运行。

最新应用提交为 098d9ff3aa1028b8e2dd2d4068979cfb2e2001ae；交付提交为 5b449faece59e07a01b06897290921c1c5f44b17；Mac 构建指纹为 b3cb7000c241d9f586afd015bba7f2b399f2372f6a873d65b7b3eced5d0b52eb。最新原始日志保留短暂启动失败和后续完整构建结果，不能把它描述为没有任何错误文本的日志。

### 仍未完成

- 物理手机测试、移动系统前后台、真机帧率/内存/温度与耗电
- 本版本微信运行与上传发布。旧阶段本地微信编译不代表本版本已经通过
- 最新 B 角色与完整室内外动作接入后的视觉、碰撞和接触验收
- 头发与肩部连接、手裙接触、坐起时衣裙表现
- 鱼、海洋事件、鱼/珍珠续步与库存工具消费
- R4 材质候选的最终审看与正式接入
- R6 额外关卡和鱼托盘候选的正式整合

## 美术接手重点

### 必须保留的方向

- 保留修长 B 的比例与原色，不通过整体放宽胸腰来掩盖接缝。
- 手臂从肩下自然下垂，不向外撑；手掌、手腕的解剖和粗细应自然。
- 胸腰侧面不要鼓厚，肩和上衣侧面不能变成凸起的大块体积。
- 裙角飘动方向已获用户认可，可以稍加幅度。这不等于整套角色或坐起动作已获批准。
- 黄色裙与白色围裙继续独立，黄色裙应比围裙更有重量感。

### 当前静态起点与已知问题

当前推荐的静态接手起点是 B_VERTICAL_SLENDER_STAGE_R5.blend，放在另交的美术安全快照中。该阶段身体自身交叉检查为 0，领口 185 边和腰部 63 边保持完整，父级 K 缩放已修正。它仍有手/下袖与旧裙侧面穿插，不能称为全角度、完整动作或最终角色验收通过。

此前某些展示图遗漏了父级约 1.061164379 的缩放，导致衣裙与身体世界空间不一致。接手必须以冷打开后的实际 matrix_world 和评估后几何为准，不能只看对象局部坐标，也不能用那批图当正确基线。快照中的说明和检查回执应明确哪些展示版本受影响、哪个文件才是当前推荐源。

尤其需要检查：头发与肩部的连续性；颈肩和衣服接缝；手掌/手腕/袖口；手裙接触；坐下、起身和转身的布料避让。不能整体关闭接触代理，也不能用删隐藏面或错位缩放把问题藏到单一机位之外。

### 建议接手顺序

1. 先在独立副本冷打开最新安全快照，核对可编辑源、缓存相对路径、帧范围、父级世界矩阵和参考图片是否来自同一份文件。
2. 锁定修长 B、原色、自然下垂手臂的静态基准，分别给出正面、侧面、背面和三分之四视角，集中修复肩/头发、手腕/袖口和胸腰侧面的体积问题。
3. 在相同源上修复手裙与上下身接缝，避免用一次大幅缩放同时改变已认可部位。
4. 用原速完整动作验证坐下、起身、转身和行走；关键帧检查之外，还需连续回放，保留失败帧与已知问题清单。
5. 提交 Blender 可编辑源、依赖、冻结导出、变更说明和哈希，交给 Cocos 集成侧在隔离工程中接入。未验证的布料缓存不要假定 Cocos 会原样支持。
6. 在真实 Cocos 材质与灯光下复查，再做手机和微信验收。Blender 渲染好看不能替代游戏内通过。

以上是接手顺序和验收建议，不表示这些步骤已经完成。

## 技术接入边界

- 真实 Creator 项目根是 creator-build-project；入口为 assets/scenes/WorldR5Integration.scene，编辑器版本 3.8.8。源码包含所有当前导入资产及其 .meta。
- 不改旧包、不覆盖别人的文件，按版本追加；候选进入 WIP，集成前保留基线与回滚路径。
- 美术源和冻结导出由美术接手方维护；运行代码、存档逻辑、关卡规则及 Cocos 场景/Prefab/.meta 由集成侧统一处理，避免两端同时改同一资源身份。
- 保留 .meta 和 UUID；不能直接删除再导入以“修好”引用。世界坐标和比例校验必须同时覆盖角色、衣裙、锚点和碰撞代理。
- 角色 controller 独占世界位移，动画按原地动作接入；不要叠加第二套 root motion。
- 切换场景或退出关卡后，旧动画回调不得继续提交奖励、写存档或残留棋盘节点。
- 资料中旧的资产接口契约有 proposed 和未实测项，不能把预算、参考身高或未绑定锚点误读为完成状态；本次明确验证过的编辑器是 3.8.8。

每次美术交付建议包含：文件名与版本；源和导出 SHA256；Blender/导出器精确版本；渲染器与色彩管理；单位/轴向/父级矩阵；材质和纹理；三角面/骨骼/权重数量；动作列表与帧率；碰撞与接触代理；已通过和未通过的检查；参考截图对应的源文件和帧号。


## 最新美术包与旧协作基底的区别

旧的“咦起风了_Blender可编辑角色与回环工具_协作基底.zip”仅作为原始来源和回滚参考，不是这次最新可见角色。此次 R5 核心包在新手、连续袖、脸颈接口、较薄胸腰和父级世界矩阵方面更新了静态起点；22 骨可编辑派生件恢复的是同一冻结几何和权重，没有新增动画通过。

查看：character/VERTICAL_SLENDER_STAGE_R5/B_VERTICAL_SLENDER_STAGE_R5.blend
编辑绑定：character/VERTICAL_SLENDER_STAGE_R5/B_R5_WEIGHTED_AUTHORING_REFERENCE.blend
入口：START_HERE_GROK_美术交接.md

原件使用 Blender 4.5.14 LTS。若使用 5.2.2 或其他版本，先另存副本，保留 4.5.14 原件；冷打开后重新检查骨架、世界矩阵、缓存、材质和动作，不直接把升级视为兼容性通过。

## 实际场景资产接口与交付格式

优先沿用 GLB/glTF 2.0。当前工程没有 FBX 导入通过证据；若改交 FBX，须单独做导出到导入的往返检查，不把格式支持等同于同一资产已经正确恢复。

下面是当前已接入环境 GLB 的实测文件事实，不是给新美术批准的性能预算：

- combined_visual_m.glb：6,225,724 字节；SHA256 158f0b42c534234ae46d68fc574cf84810900bb451d22c8b29656bcd6b28cf6c。
- 184 个节点、39 个 mesh 资源、8 个材质、12 个 skins。场景实际挂载 24 个 mesh，共 74,799 三角；所有资源合计 76,050，包含不渲染代理。
- 三张贴图：256×256 两张、1024×512 一张。LOD 当前关闭。
- idle_loop 为 12 秒、30fps。
- 24 个 MeshRenderer 不等于 24 个 draw call。没有真机测试给出的硬预算；旧契约的角色 25,000 三角、60 骨等数值仍是 proposed。

环境坐标依据 combined_anchors_m.json：米为单位，+Y 向上、室外 +Z 方向。scene_root 保持 identity，skinned sibling 根、锚点语义、Socket 路径和资源 .meta/UUID 不随意重建。GLB Prefab 子 UUID 为 498b3fa5-2dd3-4e86-93b8-637ae51438fe@87291。

最新角色 R5 是另一份美术候选，22 骨与 K=1.061164379119873 的源坐标换算以该包自身合同为准。K 来自暂定身高参考，不代表用户绝对身高已校准；不要把环境比例再次乘到角色上。当前 R5 可见角色与两衣共 70,081 三角，仍需后续 LOD、Cocos 导入和移动端预算验证。

官方格式说明：[模型资源](https://docs.cocos.com/creator/3.8/manual/en/asset/model/mesh.html)；[glTF 说明](https://docs.cocos.com/creator/3.8/manual/en/asset/model/glTF.html)。资产数量来自这次工程文件检查，不是上述文档对性能的保证。

## 新角色导出与接入契约

这节专指最新 R5 角色候选，与上面的环境 GLB 基线分开。交付以原生 .blend 和 glTF 2.0/GLB 为主，FBX 可作备用。当前美术包没有已经验收的角色 GLB/FBX；必须在 Cocos 3.8.8 实际导入后检查骨、材质和 clip。官方说明支持 glTF 2.0 与 FBX 2020 及以前，不等于这个候选已通过。Blender 5.2.2 工作应另存新分支，保留 4.5.14 原件、来源与哈希。

坐标统一：游戏为米、+Y 上、+Z 前。源到 Blender 的映射是 (x,y,z) → (x,−z,y)。K=1.061164379119873 只能统一应用一次，覆盖身体、衣、骨与绑定、曲线和碰撞。可统一烘成米制并让根缩放为 1，或保留一个明确的 K 父级，但实际导入的世界点必须一致。不允许场景再次乘 K，或只缩身体。1.626m 只是原 rest 参考，非用户已校准的硬身高。角色面向 +Z 时物理右侧是 −X，旧 hand.L 对应物理右手。

22 个主骨精确名单：root, hips, spine, chest, neck, head, upper_arm.L, forearm.L, hand.L, upper_arm.R, forearm.R, hand.R, thigh.L, shin.L, foot.L, thigh.R, shin.R, foot.R, skirt.front, skirt.left, skirt.back, skirt.right。

保持主骨名字和层级，权重归一且每点最多 4 项。可以在新候选中追加衣或手指辅骨，但需列明命名、映射、权重、clip 和预算，不能悄悄替换主骨。当前肩附件和 rest 已有候选变更，不能因为骨名相同就直接套旧动画。Cocos 的 glTF 导入对权重取前 4 项，不能把截掉的额外权重当作仍被保留。

动画由 controller 独占世界位移。交原地 clip、root 参考曲线、足支撑/手接触/门事件的秒数；起身、左转、走路可以分段衔接。文件、mesh 与 clip 使用稳定 ASCII 命名并给映射，当前没有强制一套尚不存在的 clip 名字。预览用真实 30fps 或 60fps 原速。MDD 是 Blender 参考，不证明 Cocos 能直接播放。完成显式 calibrated 及坐/站 controller 坐标一致验证前，不用旧 foot 锚或猜测比例自动贴合。

黄裙和白围裙保持独立可变形，腰接真实身体边，保留自由角、暖灰内侧和层间阴影。可改拓扑，但记录旧到新节点、材料、骨与 clip 映射，并保留已认可头身、腿长和色调。正面自然垂臂；侧面允许正常轻微前屈，不能前伸或扩肩来躲裙。自然遮挡可接受，真实穿插仍须修。

当前角色的资源状态是 3 个可见 mesh，共 70,081 三角：body 40,457、黄裙 26,712、白围裙 2,912；材料段为 6＋2＋2，不等于最终 draw call。包内图像级别有 1024×512、512×512、128×512、1024×1024、32×1024，另有重复 atlas。新脸和胸兜仍部分使用程序材质，需要烘成标准贴图并目检。建议先不扩大资源规模、减少材料段并给低 LOD；没有“12 万面”或“80 draw”之类已经成立的性能保证，最终需要测目标设备帧时、显存和包体。

场景硬语义保持 scene_root、seat_anchor、seat_back、seated_foot_anchor、stand_up_foot_anchor、door_hinge、door_handle、exit_path_*。door_handle 跟随门叶；seat_anchor 是 0.38m 座面而不是 pelvis/root，foot 锚也不是 root。椅、桌和书、门叶与环、18mm 门槛、6mm 地毯要纳入碰撞，不改椅高避碰。R5 目前只是完整身体静态几何清楚，衣裙接触、新动作与移动端导入均未通过。

官方格式依据：[Cocos 3.8 模型资源](https://docs.cocos.com/creator/3.8/manual/zh/asset/model/mesh.html)及[glTF 资源](https://docs.cocos.com/creator/3.8/manual/en/asset/model/glTF.html)。

## Web与微信入口不能混用

当前正式验过的 Web 入口是 assets/scenes/WorldR5Integration.scene，UUID 260c2ebc-0660-4be6-8c4b-7885436222ea，挂 WorldIntegrationBoot。tools/world-r5-build-options.json 指向该入口。

tools/wechat-build-options.json 仍是旧 FirstsliceImport smoke 配置，UUID e0114b68-a4b0-4f45-ae5e-2d8b221a4d00，输出 wechat-firstslice-smoke，不能直接当当前微信主线。

后续工程建议另建 wechat-world-r5-build-options.json，保留旧配置与 .scene.meta；沿用 wechatgame 和已授权 AppID wx3bdd911c5c06f591，把 startScene、scenes[].url/uuid 改为当前 WorldR5Integration 入口，独立输出 wechat-world-r5。本次没有改该配置、重新微信构建或上传发布，5b449fa 源码 ZIP 哈希保持不动。需之后验证微信开发者工具、真实存储冷启和手机，不能用 Web 190/48 的结果替代。

## 美术传输核验范围

核心包 93,078,039 字节，本地 SHA256 bbe6b534ff7b46925f52c9fddf1f4ae1bbee55acb0c20b54f6d1961367719014。
参考包 49,289,783 字节，本地 SHA256 12817f116b2c3aa6dd0d877a908389c38f810f766f38eff22db21df0edb7a3a1。

两包本地 ZIP CRC、清单与原文件字节已检查，原完整包的 222 项全部保留，另各加一份传输说明。制作侧已经在新的真实解压路径冷开 R5、22 骨绑定和认可风缓存，检查 11 个 Blender 文件依赖，核心重建与冻结输入一致。这些检查没有把既知接触问题变成通过。

Drive 文件大小、父目录和 owner-only 权限已回读匹配，raw fetch 返回完整文件引用。大包尚未完成远端二进制 SHA256 回验：元数据不返回 checksum，认证文件下载返回 403，下载助手大小限制为 32MiB。以上 SHA 是供接收方下载后核对的本地 SHA，不冒充远端哈希已经验证。

## 独立候选与参考

这些文件可用于后续研究和接入，尚未变成上述运行基线的一部分。

- [R6 额外 12 关开发候选](https://drive.google.com/file/d/1DvBgzLcUqyVrQwilaDfih89NkeR7PPkk/view?usp=drivesdk)
- [鱼托盘开发候选](https://drive.google.com/file/d/1Gb7Ajmb0AmDNV64x3jHlKltsmfCBdJ3Y/view?usp=drivesdk)
- [R4 海面涟漪与材质候选](https://drive.google.com/file/d/1JgsYJ6xeW9NVkC6hr-U651cjQCDnmFIX/view?usp=drivesdk)，默认关闭
- [既有资产接口契约](https://drive.google.com/file/d/1rg_upXNHEPv6iYfCjcE6cy7S2YHsnMIb/view?usp=drivesdk)，保留其 proposed/待验证标记
- [本次奖励补丁原始追溯小包](https://drive.google.com/file/d/104v9r4Mo3CC8HGv0v7aO5u30cWDz0cwV/view?usp=drivesdk)，已有完整源码时无需再应用这个差量

本批文件只追加到现有私有游戏协作中枢，未修改权限。用户可以直接用自己的账号下载；给外部协作者使用时，应使用既有授权账号或自行转交，不要误把私有链接当成任何人可打开的公开链接。
