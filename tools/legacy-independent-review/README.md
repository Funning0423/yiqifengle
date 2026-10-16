# 独立复审与接续集成：三项历史失败

## 结论

独立副本与接续后的最终集成树均完成同一 35 套选定检查：34 PASS、0 FAIL、1 BLOCKED_BROWSER。三项指定历史失败已关闭。两项另行发现的历史失败仍保留；正式 Creator 构建和 WebGL 画面仍未验收。

- 修复前基线：`c5b4d6d503eeccf4fb7c9ed8dd9a94b3707b536b`
- 审查候选：`5b84b2b3798e9b886971c7364b07adb3ff445577`
- 实现提交：`dd6a5d0d3ae3d2d666134097d7655c5e20b557fc`
- 原始开发树只读，独立复跑树：`/workspace/shared/legacy-test-audit-20261015`
- 接续集成树：`/workspace/shared/game-integration-20261015`，分支 `oi/journey-integration`

## 三项失败的分类和修复依据

1. `tools/test_character_action_clock.cjs`：存在生产数值完成边界缺陷。原实现允许在距离结束不足既有 1e-6 秒时 resolve，但根位置仍是不完整插值，复现 `0.9999999999999984 !== 1`。补丁先在原容差内归一 elapsed，再计算终点；坐下/站起终点直接复制目标坐标；完成判断使用归一后的严格相等。没有放宽完成容差，没有改 120 Hz 子步，也没有改角色动画或资产。
   旧测试还把 0.1 秒长帧上限放在错误层级。实际适配器完整消费调用方时间；`WorldFlow.advance` 和 `WorldFlowComponent.update` 各自限制到 0.1 秒。新测试保留严格终点断言；中间累计时间仅允许 1e-12 的浮点误差。独立实际组件入口测试又验证了动画任务与流同时限时、暂停待恢复不推进、非法 dt 和销毁后不推进。
2. `tools/board-ui/test_board_ui_pure.cjs`：旧挑战解锁断言过期。已有生产挑战卡按同地区主线 04/08/12 通关解锁；主线区域入口是另一组 0/4/8 门槛。修改仅在测试。独立复跑了真实合法关卡重放、R5 provider、旅途册文案及章节按钮事件，验证三个里程碑前后门槛。
3. `tools/test_startup_ready_gate.cjs`：旧测试期待三实例和静态/动态女孩切换。当前已有 Boot 使用统一动态女孩与独立凳子，共两实例。修改仅在测试，验证不请求静态 actor、实例身份、凳子固定变换、动态渲染绑定、三个时间零初始采样，以及失败/重试/销毁保护。

独立从 `git archive c5b4d6d` 生成新冻结副本，对这三套双跑：基线全部 exit 1，候选全部 exit 0。原始 stdout/stderr 和比较结果保存在 `reports/paired-reproduction.json`。

## 生产范围和防绕过检查

- 与 c5 相比，整个 `creator-build-project` 只改 `assets/scripts/WorldIntegrationBoot.ts` 一个文件，且只有 `FlowReferenceStandin.advanceStep` 三处明确替换。
- 独立反向替换后，整份 Boot 文件与 git 中 c5 原文逐字节相等，不只比较被截取的类。
- 原始冻结 hash 清单没有被替换。311 项资源/规则文件和整个 `CharacterMotion.ts` 字节相同。
- 生产完整性门禁拒绝额外子步或容差修改，也拒绝替换冻结基准 hash。
- 新回归对原 Boot 仍在严格终点断言失败；仅去掉精确目标复制也重新失败。独立保存了这两个负例的源 hash 与真实输出，没有用测试变绿代替生产修复。
- 详见 `reports/scope-and-negatives.json` 和可执行的 `verify-scope-and-negatives.cjs`。

## 独立追加的执行证据

- 最终集成树 35 套原始证据：`reports/final-integrated-suite.json` 与 `../journey-integration/reports/`，34 PASS、1 BLOCKED。
- 候选 35 套原始证据：`reports/independent-35-suite/suite.json`；34 PASS、1 BLOCKED，浏览器测试在启动前被排除。
- 实际发行 GLB、anim_meta 和生产控制器的 30/60/120 fps 站起/坐下六组端点测试全部通过，完成一次且终点严格相等。
- `test-terminal-boundaries.cjs` 另强制绑定仓库发行 GLB，验证原容差外仍 pending、容差内完成、临界前取消无迟到根位置写入、不规则帧及尾部小时间片，并覆盖共享该归一逻辑的 walk/turn 临界完成；八组通过。
- `test-component-frame-cap.cjs` 执行真实 `WorldFlowComponent.update`；真实 `WorldFlow` 和真实动作适配器的长帧/暂停/显式恢复由修复后的动作套件验证。组件测试的初次探索中 2D harness 缺少 `worldRotation`，明确补齐该 Cocos 边界为单位旋转后才执行这些断言，未改生产代码。
- 最终集成树又通过 turn_targets、es5_safety、wind_api 三套辅助回归；各自范围按原脚本限定。
- 当前 36 个原发行主线种子的资格复验通过。此项不代表新增规则或人类难度验收。

上述 GLB 测试使用 JavaScript 骨骼求值和结构化 Cocos 节点替身，不能证明正式 Cocos 导入、形变、脚接触或画面合格。

## 仍存在的历史失败与未执行项

下面两套不计入通过。独立在全新 c5 冻结副本及候选双跑，完整输出只替换树路径后逐字一致：

- `tools/walk-driver/test_action_transitions.cjs:23`：坐下足部移动 `2.006046579344563 / 2.9713408754964563 mm`，超过原 2 mm 断言。属于既有真实资产接触质量失败；后续 fail-fast 检查没有执行。本轮没有修改阈值或修复该问题。
- `tools/walk-driver/test_walk_driver.cjs:144`：既有结构化 fixture 缺少 hips，使 bindVisual 中 supportPose 读取不存在的位置；套件未完成。
- `tools/walk-driver/test_locomotion.cjs` 只导出 install/run；测试由失败的 host 在第 235 行调用。单独 node 退出零不执行测试，记为 `NOT_EXECUTED_HELPER`，不计 PASS。
- `test_anim_eval_order.cjs` 在基线与候选均通过，完整输出相同。

因此“34 套通过”只描述明确选定的 35 套，不表示仓库所有测试通过。

## 原证据保留与构建边界

- c5 提交完整保留，原先交付的补丁和 delivery JSON 不覆盖。
- `preserved-c5b4d6d/tools/journey-integration/` 保存 c5 的全部 99 个验收脚本、报告与原始证据文件，已逐字节核对 git 内容。当前目录下的旧报告只代表 c5 当时结果。
- 当前有效 Creator 源码指纹：`7264d8503207721c827525aa84c605fbb74fc1817c804a5fbf8a6c1ca0e9db04`；619 个有效输入。
- 构建工具只运行 `--plan`，未启动编辑器或浏览器。缺已核实的官方 Creator 3.8.8 安装，当前云 WebGL 验收仍阻塞。
- 草原/天空退出棋盘和暂停恢复保留当前地区；前进旅程 04→05、08→09 继续受已有回归覆盖。未实现三地区自由返程，未声称新增存档迁移或冷启动位置 checkpoint。
- 源码与文档 diff 检查通过。原始 wind_api stdout 自带行尾填充空格，按证据原样保留；只对该日志排除 whitespace 检查，未修改测试输出。
- 无 push，无用户 Mac、用户真实存档或凭证操作。

## 复现

```sh
export QF_TYPESCRIPT_MODULE=/workspace/shared/region-levels-20261015/tools/region-levels/deps/node_modules/typescript
node tools/journey-integration/run-suite.cjs
node tools/legacy-independent-review/verify-scope-and-negatives.cjs
node tools/legacy-independent-review/test-terminal-boundaries.cjs
node tools/legacy-independent-review/test-component-frame-cap.cjs
node tools/region-levels/qualify-mainline.cjs --check
node tools/cloud-web/build.cjs --plan
```

第一条完整套件命令因浏览器项阻塞而有意 exit 1；需阅读每项结果，不能只看退出码。两套已知额外历史失败可按上面路径直接运行重现。
