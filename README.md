# Cocos 本机实际运行回执 · 2026-10-09

隔离分支 `cocos/local-integration-preflight-20261009`。实际工程为 `creator-build-project/`；`creator-project/` 是初始静态接入稿，`creator-runtime-project/NewProject/` 是官方生成模板，均保留。旧固定视角/运镜工程1041文件最终哈希检查无变化。未上传、发布或使用用户存档。

Cocos Creator **3.8.8** 在 Mac M4 / macOS27.0.1 实际启动、导入和编译；当前验证补丁版为3.8.8，项目全局锁版仍由主线程决定。Blender未安装。微信开发者工具产品版本2.02.2608080，未用它做运行验收。官方编辑器下载与后续使用授权记录已在主线程；此回执不宣称登录状态已验证。

## 已验证的实际结果

- Web最终编译退出36（官方成功码）。独立Chromium149.0.7827.55页面运行：snapshot正常，49格棋盘，一次swap行动经历action/clear/drop共9阶段；重复done不重复提交。
- 独立内存Map存储：冷恢复run.paused，显式resumeActive到run.ready，棋盘/行动记录严格相同。仅受控内存key forest-challenges-c01-active，未访问localStorage、微信真实存储或forest-v33-journey历史键。
- 首片GLB实际实例化，24启用MeshRenderer。桌面诊断镜头展示灯塔外部；不是房间→椅子→B女孩→开门全流程。诊断棋盘是HTML视图读取实际Cocos snapshot，非最终游戏UI。截图见output/playwright。
- COMPAT运行包SHA256 0930f6113b4a66b06a5f463b91a07c996b32f6c2b8b3d80cea45e5142500279c。manifest全核验，7JS、5相对依赖。只导入compat-runtime子树，无QA故意失败负例。原R4导入树连meta归档到archived-imports/original-r4，薄适配器保留。
- 实际Cocos输出保留Array.from的snapshot/checkpoint，旧concat(Set)代码已不在最终bundle。evidence/compiled-compat-check.json记录bundle哈希。原R4六套Node测试此前通过；本机COMPAT五套行为测试再次全部通过（source-boundary是原源码字节检查，未挪用为兼容代码验收）。云端803动作/309恢复数据属于云端结果，不冒充本机扩大覆盖。
- KHR_materials_specular导入被忽略。SpecularCandidate创建独立材质实例：palette factor0.4→Cocos specularIntensity0.2，sea factor0.7→0.35，19个材质槽匹配。依据本地builtin-standard的F0=0.08*intensity与glTF默认0.04建立标量候选，未完整复现扩展的掠射/Fresnel响应。原GLB哈希保持158f0b42c534234ae46d68fc574cf84810900bb451d22c8b29656bcd6b28cf6c。默认/候选截图均保留，视觉批准待定。
- RuntimeProbe确实运行并导出原始帧间隔。但仅70个短桌面headless帧间隔样本，中位16.8ms、P95约33.9ms，不能推断手机FPS、GPU时间或发热。

## 重跑

官方Creator路径为tooling/creator-3.8.8/CocosCreator.app。执行其Contents/MacOS/CocosCreator --project [本目录绝对路径]/creator-build-project --build configPath=[本目录绝对路径]/tools/web-build-options.json。WeChat编译用tools/wechat-build-options.json，只生成本地产物。AppID只能wx3bdd911c5c06f591，不触碰周年小程序。

本地Web构建后python3 tools/serve_smoke.py绑定127.0.0.1:8765，node tools/run_browser_smoke.cjs生成实际浏览器证据与截图。当前测试脚本引用本机已安装Playwright1.59.1与独立缓存Chromium1228，可按正式环境调整路径；不读取用户浏览器档案。tools/compile_r4_compat.cjs是断线前未采用的本机预编译草稿，本次使用云端COMPAT，未执行该草稿。

## 尚未完成

B完整角色、动画及高度校准仍缺；碰撞/坐姿接触/门轴与避门镜头尚未运行验收。不能把环境倍数套到B。角色controller独占世界位移、动画原地、裙/手接触代理不整体关闭。完整室内外流程、草甸自定义扩展、真机性能、基础库/温度/耗电、交互与材质最终验收仍待后续。旧工程可回滚。

先前关闭Cocos窗口操作被自动审批拒绝，理由是可能关闭活动工程并丢失未保存状态；未执行或绕过。后续全在独立构建工程完成，没有关闭已有窗口。

## 后续短闭环实际验证

完整固定种子tide-c01-001在实际Cocos浏览器中8行动通关，score910、余4步、result.saved。requestExit→resumeActive重进通过；适配器hide/show合成生命周期后维持run.paused，显式resume通过。新controller冷重建恢复result.saved与相同score。HTML诊断棋盘可见逐阶段变化，非最终UI。真实document visibility/系统后台、真正磁盘用户存档恢复仍未测；所有数据仅独立内存Map，旧工程1041文件再次未变。材质中心ROI静态截图对比已保存，非同步权威基准，不能认定材质最终还原。

第一版交接commit7ee6dae已上传私人WIP源码证据ZIP 169SEnIaXRolpCUEoEvXfugS9PbbVZNwj，1144248字节，SHA256 96aaddcf372bb93cdea85ab534383d31495dafd7961810abd9fa8ff4c8d3de67。完整本机ZIP6091774字节SHA2564378a058c1ad388032fd1cf693909bb45a1218e48ceb92e291e95ee142712650，上传传输失败；源码包附场景原包重建说明，不宣称已上传完整ZIP。后续短闭环源码与证据以增量交接包为准。微信本地成功构建对应第一版一次行动源码；后续完整通关诊断仅Web增量验证，未重复微信编译。


Native Cocos UI branch update: see docs/NATIVE-BOARD-20261009.md for the current native board implementation, actual touch validation, scope and replay instructions. The earlier HTML diagnostic description applies to the preserved base commit.

Mobile native board revision: see docs/MOBILE-NATIVE-BOARD-20261009.md. Official Cocos 3.8.8 Web build and three viewport touch/recovery cases passed.

Isolated world/R5 integration: docs/WORLD-R5-INTEGRATION-20261009.md. Original UI/scene/GLB retained; three regional witness replays validated; current-session only, no score registration or rewards.

## reward-background-return 需要 Node ≥22.6
`tools/board-ui/test_reward_background_return.cjs` 用到 `node:module` 的 `stripTypeScriptTypes`，Node 22.6 才有。Node 版本更低时，测试会打印 `BLOCKED_NODE: … requires Node >=22.6 …, found vX` 并以退出码 78 结束，`run-suite.cjs` 把它记成 BLOCKED（`BLOCKED_NODE`）。它**不会**被算作通过。
在 Mac 上用正确的 Node 跑（任选一种，不影响系统里的 Node）：
```bash
cd ~/qfl-milestone            # 仓库根目录
npx -y node@22 --version      # 应 ≥ v22.6
npx -y node@22 tools/board-ui/test_reward_background_return.cjs; echo exit=$?
# 或者用 nvm：nvm install 22 && nvm exec 22 node tools/board-ui/test_reward_background_return.cjs
# 也可以只用 Node 22 跑这一项：nvm exec 22 node tools/journey-integration/run-suite.cjs reward-background-return
```

注意（2026-10-17 在 box 上用 Node v22.23.3 实测，基于 f3d3614）：环境满足以后，这个测试仍然**失败**，位置是 `test_reward_background_return.cjs:38` 的 `assert(reward)`，原因是找不到 `RewardPanel` 弹窗。所以它不只是环境问题，测试或代码还需要单独修。
