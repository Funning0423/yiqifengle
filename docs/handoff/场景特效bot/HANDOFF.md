# 场景特效bot 交接：fx/r5-snowpass-grey

## 本分支
- 分支：`fx/r5-snowpass-grey`，交接前头部 `dc0a73234eeeec43ed589518f2d710f4fecfc6e0`，基点 `55368056`
- 内容：雪山风铃山口白模：creator-build-project/assets/bundles/region_snowpass/models/SP_snowpass.glb，共 34,604 面（预算 55k），共享 M_LK_palette / T_LK_palette_256（内嵌）。包含：风铃门（雕柱、瓦垄飞檐屋顶加厚雪、5 根可摆的铃管节点）；近、中、远山（风蚀沟加雪线面，山脚埋进地面，门后黑线已清掉）；地面（热气球雪台、半埋石阶、碎石）；17–20 关石灯笼节点；松树。新分包 region_snowpass，目录 meta 已建；glb.meta 只写了 uuid，子资源要等 Mac 上的 Creator 导入时生成。glTF-Validator 0 错误 0 警告。新增 test_snowpass_grey，测试套件 147/148，和基线一样。
- 进度：白模完成；预览和坐标表已出。
- 未测：Creator 导入（子资源 meta）、真机 draw call 数（目前 18 个 primitive）、运行时风铃摆动和夜间灯光都还没接。
- 其他：预览：previews/场景特效bot/r5/snowpass_grey/snowpass_grey_day.png、snowpass_grey_night.png；坐标表：previews/场景特效bot/r5/snowpass_grey/COORDS.md 和 SP_snowpass_coords.json；构建脚本 build.py、预览脚本 prev.py 在同一目录。
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
