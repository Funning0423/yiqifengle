# 正式角色本地衔接修复：部分完成，整体验收未通过

隔离目录 `/Users/shineanl/Documents/Codex/2026-10-14/task-4/character-fix`，从本机基线 `6df6021f5e58d7ad60c4f352104f72621a4b6cc2` 以 `git clone --no-hardlinks` 建立独立 Git checkout；不是共享 worktree。未修改原目录、棋盘、微信窗口、真实存档或凭证。最终完整 commit 由交接回复提供。

## 已落地

`WorldIntegrationBoot.ts` 加载独立 `region_island/character_support/reading_chair`，与房间一起挂在 `IsolatedWorldComposition`，不是控制器的子节点。home 显示新静坐整壳、隐藏独立旧椅；出门后隐藏整壳、显示独立旧椅和旧骨骼人物；回家恢复原渲染合同。座椅留在固定世界位置，不随人移动。缺少支撑资源会保持启动错误页，允许重试。真实 stand/sit clip、动作 Promise、取消和根坐标算法保持原样。

这是恢复**旧动画所需的原椅支撑**，不是拆出了新凳，也不是把旧人物匹配成新坐姿模型。椅型切换依然可见，不能作为完整衔接成品接受。没有简单增加 rootY，没有让带凳整壳行走。

本机 Blender 5.2.2 LTS 导入原 combined 与去椅 room，以世界三角顶点量化 1e-5m 的精确差分选出被删的完整512三角，820个导入顶点；保留对应UV、材质及顶点位置，导出独立GLB。Creator实际导入512三角，原件未覆盖。新静坐资产仍为一个无rig、50,000三角壳，不能分配旧动作。小支撑GLB约33KB；未下载云端历史腕鞋候选。

## 实测与证据

- `tools/test_startup_ready_gate.cjs`：增加支撑缺失/重试、固定父节点、home/standing显示切换断言；结果见 `output/character-handoff/startup-tests.json`。
- `tools/walk-driver/test_action_transitions.cjs`：当前TS驱动+真实GLB骨骼FK，坐起脚部、取消、开门动作等回归通过；不是GPU或自然度验收。
- `tools/test_character_handoff.cjs`：保存切换前隐藏rig、standing第一帧及0.1/0.3s控制根世界矩阵、臀/双足/双手世界TRS。renderer布尔是启动代码合同，不是观察到的Cocos GPU状态。第一帧root和臀骨没有跳变：root `[.4327299768730942,0,-4.207611558444886]`，hips `[.462737689483481,.4364273828174844,-4.190387253221296]`。0.3s hips Y `.4995062854400511`。支撑缺失是独立于根Y的新增问题。
- Blender CPU12samples480×720几何截图：`home.png`、`before-first.png`、`after-first.png`、`after-0.1.png`、`after-0.3.png`。已实际查看修复前无椅、修复后旧臀下方有原椅及0.3s椅子留场；新旧人物风格和鞋子差异明显。这些是导入GLB的原生stand_up采样及控制根插值，无Cocos跨淡化、风层、正式房间灯光/相机，不能冒充正式游戏逐帧截图。
- 正式WorldR5Integration场景微信包构建：Creator exit36，Finished37s；`check_wechat_build.py` PASS，主包1,861,856B，总包28,758,125B，所需分包完整。支撑GLB导入prefab及bundle path实际存在。BuildInfo仍dev，截图不能独立证明commit身份。
- 独立Web正式入口构建：Creator exit36，Finished2min18s，有`Workers failed to exit gracefully`/SIGTERM日志，但最终index和资产已生成。未获得运行实渲染验收：localhost服务沙箱绑定端口报`PermissionError: [Errno 1] Operation not permitted`；CUA浏览器列表为空、iab不可用，原生Safari获取报`Computer Use server error -10005: timeoutReached`。未操作微信来替代。
- 首次沙箱Blender exit139：Metal设备初始化`supports_barycentric_whitelist`崩溃；自动审批允许本机执行后导入/导出/渲染完成，无剩余权限审批阻塞。

## 未通过

1. 静坐新人物/新凳到旧人物/旧椅仍有显著形状、比例和服装跳变，完整无缝衔接未通过。需要分离新人物/凳、拓扑修补、新风格人物rig/蒙皮和匹配坐起，不能靠坐标位移修好。
2. QF-WRIST-20261013仍未修入动态资源。当前walk_loop手局部旋转采样约L149.48°/R174.37°；这是骨局部数值而非前臂夹角或自然度标准，只用于重现旧数据。针尖腕需要检查蒙皮和姿态，各sit/stand/door/turn/walk全覆盖，不能仅焊接。
3. QF-HEEL-20261013仍未修入动态资源。实际图可见红色旧鞋前掌抬斜、鞋型与参考棕色短靴差异，不能称鞋底或足部接触通过。
4. 没有本轮正式Cocos浏览器GPU帧、微信实跑或真机验收。下一轮应以本提交本地构建，独立测试出门首帧/回家/取消，核renderer世界矩阵、臀/鞋底接触及椅型切换，不操作另一任务的微信窗口。

原用户GLB SHA256 `4771351fb5e200a21cc4c03ab44ff6b9067237ef16b64568d255a47343adb942` 已本机重核。动态GLB SHA256 `1364896733341c1dcc43deb1b6cd6a3bbaa147b7830ec36475404b6664e37c68` 与基线一致。独立支撑GLB SHA256 `09a447e426e644c540f979c2c1016bc088131155fd683c5a38b69d10360e668d`。其余文件hash见 `output/character-handoff/manifest.json`。
