# world-r1 · 灯塔室内 → 岛外 → 关卡 → 回屋

独立新增实现。基线：`2a320f93b86625e7d59ebbd32a52e2868f993ce6` 的 `creator-build-project`；本目录不修改原工程、GLB、`.meta`、`FirstsliceBoot`、`RuntimeProbe` 或原生棋盘文件。

## 当前可交付与边界

- 7 个可接入 Cocos 的 TypeScript 文件，工程无关状态机和真实 Cocos Component 分层。
- 固定视角/运镜两种模式；门开启完成后镜头与角色才过门；回程先完全进入门内，再关门，再走到椅前，再坐下。
- 49 个精确资产锚点、24 个真实渲染节点白名单；包括 `scene_root` 之外的 skinned mesh siblings，不能只隐藏 `scene_root`。
- 单独的世界相机，不转世界根节点；校验 imported root 和 `scene_root` 始终 identity；坐点位置与 yaw 必须匹配实际椅子。
- 取消/隐藏/销毁使旧异步任务失效，迟到世界/关卡资源释放。Show 不自动继续，必须显式 Resume。
- `R4LevelBridge` 只调用原控制器命令，不复写棋盘规则、奖励或存档。退出保存失败保留关卡，允许 UI 重试。
- 人物仅是严格 adapter 接口，没有创建假人物、代理人物或“最终动画”。缺失/未校准/坐标不匹配时可以查看室内场景，但不允许开始人物流程。

这是新增源码与云端验证交付，不是最终可玩关卡包。官方 Cocos 导入、官方类型检查/编译、Web 运行、微信构建和真机均未执行；`cc` 边界测试是明确的测试替身，不能冒充引擎实跑。历史基线的 Cocos 实跑结果不覆盖本次新增代码。

## 单命令复跑（当前云端）

```sh
bash /workspace/shared/grok-takeover/parallel-development/world-r1/run_checks.sh
```

需要当前已安装的 Node 24.19.0、Python/numpy 和已有 Babel parser/core/CommonJS 插件。没有在本任务安装软件。`WORLD_BABEL_MODULES` 可改为本机 `node_modules`；实际 R4 测试用 `WORLD_BASELINE_ASSETS` 指定含末尾 `/` 的基线 `assets/`。几何/源完整性脚本默认读取本次云端冻结源，路径在脚本顶部清楚列出；迁移后应由集成者显式调整，而非偷偷回退到新资产。

运行产生：`evidence/node-tests.txt`、`syntax.json`、`geometry.json`、`static-proxy-geometry.json`、`source-integrity.json` 和 `DELTA-MANIFEST.json`。后者列出每个新增文件的 SHA256、字节数、Cocos 目标路径和未运行的验证阶段。语法解析不是 TypeScript 语义类型检查。

## 源码入口

- `components/WorldFlowCore.ts`：异步状态机、取消代次、共享时钟、adapter 类型和命令结果。
- `components/WorldFlowComponent.ts`：实际 Cocos API 绑定、renderer 分类、独立相机、门轴动画、生命周期、局部资源清理。
- `components/FirstsliceFacts.ts`：只读 GLB/sidecar 导出的完整锚点、真实 24 个 renderer 路径与门 OBB。
- `components/FirstsliceRoutes.ts`：显式路径与时序，角色右侧轨迹和统一进度相机 key。
- `components/CharacterReference.ts`：人物线提供的真实下肢参考坐标及源哈希，仅作为接口参考，不批准完整人物。
- `components/R4LevelBridge.ts`：和已有 R4 host/原生棋盘的窄接口。
- `components/WorldGeometry.ts`：点到真实门 OBB 距离及连续轨迹保守界。

## Mac/Cocos 精确接入步骤

1. 在独立集成副本操作，保留旧工程。本目录安装器默认 dry-run：
   `python3 integration/install_into_cocos.py --project /path/to/creator-build-project`
   核验输出后加 `--apply`。它只在不存在的 `assets/scripts/world-r1/` 新增 7 个 TS 文件，检查 3.8.8 和全部三个环境源哈希，不碰任何现有文件。
2. 由唯一 Cocos 集成者打开 Creator 生成新 `.meta`，不拷贝/伪造 UUID。先官方类型检查/导入；若 GLB importer 增加了节点包装层，应根据实际 prefab 修正唯一 `resolvePath`，不能静默按名称模糊匹配。
3. 创建一个新的验证场景。不能让旧 `FirstsliceBoot` 同时启动，因为它会另行实例化 combined GLB 并移动相机。无需改它的源码，只在新场景不用该诊断 boot。
4. 新建 identity `WorldFlowOwner` 与独立 `WorldCamera` 为 scene 的兄弟节点。`WorldFlowComponent` 挂 Owner，绑定已有 combined GLB prefab 与这台相机。不要再加载 interior-only GLB；不要把世界挂到 Camera 或 Canvas。
5. 原生棋盘保持自己的 Canvas/UI 根节点。棋盘 factory 返回 `NativeBoardHandle`（见接口文件），只给世界代码 host 命令、snapshot 和 UI 自身的显示/销毁函数。创建 R4 host 时不要再注册另一套平台 hide/show，由本组件统一转发。
6. 在 composition root 调用：`component.initialize(createR4LevelAdapter(boardFactory), realCharacterAdapterOrUndefined, 'fixed', onStatus)`。首次可不给人物，验证环境加载、锚点/层、相机和销毁；没有人物不会伪称可走完整流程。
7. UI 只拿 `component.commands()`：snapshot、leaveHome、returnHome、enterLevel(stageId)、exitLevel、resume、cancelTransition、setMode。不要把世界 root、相机或门节点交给棋盘 UI。
8. 在官方 Cocos 中逐步验收清单 `integration/ACCEPTANCE.md`。固定/运镜和实际设备都要分别验证，再认定接入完成。

## 人物接头：根、骨盆、脚不能混用

已和人物线核对 `ACTUAL_SCENE_AXES_AND_SCALE.json` 与 `coherent_lower_runtime_contract.json`：游戏 Y-up、米，角色静止正面 +Z，角色右侧为 −X，源 `hand.L` 是真实右手。Controller 单独拥有世界位置/yaw，rig root 保持原地。不得施加环境倍率 1.415282…。

- 环境 `seat_anchor` 为 `(0.4203000069, .3799999952, -4.2133002281)`，yaw `-2`。这是座面参考，不是 pelvis 或 controller root。
- 下肢参考坐姿 controller：`(.4327299769, 0, -4.2076115584)`。
- 参考站起 controller：`(-.0161627580, 0, -4.4130507097)`，不是 `stand_up_foot_anchor`。
- 原有 stand foot / seated foot 锚点仍完整保留为几何参考，绝不直接写给根或骨盆。
- 起身保留 yaw -2，独立左转到 `-.0493756157`，首段直线末端 `(-.0916767581, 0, -2.8849153636)`。该下肢参考 0–3s 起身、3–4.5s 转身、4.5–7.3s 步行；完整服装/上肢/往返尚未验收。

`CharacterAdapter.coordinates` 必须显式给出轴、单位、root 所有者、坐起参考点、椅子 yaw 和门区 clearance radius（当前审计上限 .18m）。不匹配时阻断。该接口不能替代真实身高/完整接触验收；完整人物通过前不要把 `calibrated` 置 true。

`perform(stand|turn|walk|sit, token)` 返回 Promise。stand 结束于参考站起根并保留椅朝向；turn 只改 yaw；walk 的 path 是 controller-ground-root 米坐标，不是骨盆、脚踝或 glTF 原始单位；sit 负责安全对齐椅朝向及已校准的坐下动作，完成后仍使用 seat 与 seated controller 两个独立语义。`cancelAndReset` 必须同步停止本 adapter 的 tween/动画/回调后恢复稳定姿态，不得只忽略 Promise。手/裙/围裙接触不能整体关闭。

所有位移、动作与相机通过 `advance(seconds)` 的同一个 Cocos update 时钟推进（每次最多 .1s）。人物 adapter 不得额外开一个独立的 Update/计时器驱动同一轨迹。walk duration 是流程候选速度所算的值，原地步行动画必须匹配，不得把上面的参考 clip 时长当作已经适配的整段动画。

## 几何结果的准确含义

- 门扫掠用真实 GLB 叶片碰撞 OBB：pivot +X，+Y 旋转使门向 +Z 外开；运动角 86.4°，静止安全点额外覆盖 0–105°。
- 相机候选包络是半径 .12m 球；全行程针对门的连续保守余量 > .55m（过门时门固定全开）；等待开/关门的角色候选 .18m 半径余量 > .146m。
- 室内 12 组静态代理使用每个真实三角面，不把断开的组压成一个 convex hull。所有相机 rail 的连续保守最小余量约 .050m；门框通行 rail 约 .122m。
- 出门靠近门的镜头全段在角色右侧，以两端半平面测试证明线段连续性；回程反向通过同一避门走廊，不能把“室外朝向的右侧”偷换成返回人物的右侧再穿过门叶。
- 不可能在门口穿过所有角度的扫掠体并同时避开闭门叶片。因此采用时序互锁：门完全打开后才过门，镜头回到室内安全点后才关门。

这里未证明外部碰撞 GLB 的完整地形/悬崖安全、完整人物/衣服接触、取景美观、遮挡/近裁面、手机性能。Cocos 中须让相机 near/FOV/画幅对应的近裁面包络落入 .12m 球，或重新按更大半径审计，不能直接把几何通过当作视觉通过。

## 参考 API

使用 [Cocos 3.8 Node 官方 API](https://docs.cocos.com/creator/3.8/api/en/class/Node) 的 setWorldPosition/lookAt/世界变换接口；真实引擎执行仍由 Mac 集成验收。本地基线已有 MeshRenderer/Prefab/instantiate 用法也已读取核对。
