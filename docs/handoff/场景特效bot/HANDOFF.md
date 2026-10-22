# 场景特效bot 交接：fx/r5-b11-balloon-sail

## 本分支
- 分支：`fx/r5-b11-balloon-sail`，交接前头部 `35cc93c06d338dfbc79739bd76b27277dd218506`，基点 `a83e1c2b`
- 内容：b11 热气球帆船：白天气球外皮改为 unlit × albedo × 1.12；K2 帆船尾迹起航残影修复（K2 可见距离 2.6 → 约 16 m，测试断言 ≥ 12 m）。
- 进度：提交已完成，还没合入集成头（基点 a83e1c2b，比 b15 集成头旧）。
- 未测：合入较新的集成头时可能冲突，尚未验证。
- 其他：是否 rebase 到 55368056 由 Grok Bot 定。
- 预览和大文件不进仓库，只写路径。

## 全局待办（场景特效bot，截至 2026-10-22 08:05 EDT）
1. **雪山白模和坐标表**：已在 fx/r5-snowpass-grey（dc0a7323）。COORDS.md 在 previews/场景特效bot/r5/snowpass_grey/COORDS.md，运镜bot 在等。
   - 门后山底的黑线已经清掉：山体下沉 4 m，地面延伸到山下。
   - 还剩：Creator 导入、风铃运行时摆动、夜间灯光接入。
2. **另外三个场景的概念 v3**（未完成，按下面的说明接着做）：
   - **灯塔新布局**，脚本 previews/场景特效bot/r5/scenes_concept/lighthouse/v3/lighthouse3.py，已出一版，但还不是终版参数：
     - 放灯高台和她的站位挪到灯塔脚下；
     - 台面中心在她的根空间 (−0.31, 0.40, 0.33)（glTF：+Z 前，−X 右），台面 0.22×0.22 m，高 0.40 m；
     - 灯放在台面中心，握把中心在台面上方 0.1502 m；
     - 靠她一侧做三条 10 mm、45° 的倒角：近面和内侧面交出的竖直棱、台面近边、台面内侧边（脚本里已写好，用 bmesh bevel，还没渲染）；
     - 梯子靠在灯塔上，在台子右侧，距离 ≥ 0.45 m（现在是 0.55 m）；
     - 守灯人小屋已放大；
     - 已有 lighthouse_v3_day.png / lighthouse_v3_night.png，用的是旧的高台参数，需要用最新脚本重渲。
   - **小镇**，脚本 previews/场景特效bot/r5/scenes_concept/town/v3/ 待建，草稿在 /workspace/fxtools/v3/town3.py。要解决：
     - 房子重复：4 种户型（顺街山墙、面街山墙、石砌底层加阳台、老虎窗），4 种墙色、3 种屋顶色；
     - 近边屋顶挤：房子后移，近处改成矮墙和树篱；
     - 树冠没形状：主冠加 5 个侧瓣加亮色顶冠，再加柏树；
     - 地面缺细节：路边草丛、落叶、木桶和木箱、水洼。
     - 还没渲染。
   - **庭院**，草稿 /workspace/fxtools/v3/courtyard3.py：
     - 风车叶片做成格栅（主梁、7 根横撑、外框、纵条），一半挂帆布；
     - 主屋放大，做双层檐、檐角饰件和风向标；
     - 岛缩小，加岩石岸和浪花，让海看得见；
     - 近景加草丛、碎石、小花。
     - 还没渲染。
   - 三个场景都改用 /workspace/fxtools/v3/lib3.py 的硬分层手绘明暗。
3. **灯芯高度偏差**：预览里约 0.93 m、髋前 33 cm，规格是 0.98 m、29 cm。需要真机确认。
4. 概念图和预览都在 previews/场景特效bot/r5/ 下面（snowpass_concept/v1–v3、scenes_concept/<场景>/v1–v3、lantern_glow/、snowpass_grey/）。

## 待 Grok Bot 定
- 雪山白模 glb.meta 只有 uuid，子资源由 Creator 导入生成。这样是否可以。
- fx/r5-b11-balloon-sail 是否 rebase 到最新的集成头。
- 云海三角面预算超标怎么处理。
- 小屋窗户用 A 还是 B。

## 下一步怎么接
- 同一时间只开一个 Blender：`/workspace/tools/blender-4.5.3-linux-x64/blender -b -P <脚本>`，环境变量 TOD=day|night、RES（百分比）、SPP、OUT。
- 测试：`QF_TYPESCRIPT_MODULE=/workspace/tsmod/node_modules/typescript /workspace/tsmod/node_modules/node/bin/node tools/journey-integration/run-suite.cjs`。基线是 147/148，navigation-guard 因浏览器 BLOCKED。
- glTF-Validator 在 /workspace/fxtools/node_modules/gltf-validator。
