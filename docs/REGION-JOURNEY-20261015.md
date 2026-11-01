# 《咦，起风了》连续区域旅程 · 可集成候选

状态：代码与纯 Node/静态检查完成；未做 Cocos 3.8.8 正式构建、WebGL 真实画面、手机性能或最终人物接地验收。不能称为可发布版本。

## 基线与边界

- 独立副本：task21 最终完整冻结源码。以 `source-after-final-manifest.json` 核验 2244/2244 文件 SHA256 一致；旧 text/assets manifests 属于早期快照。
- 原角色 FlowReferenceStandin 类及动画、GLB、图片、音频字节未改。整个角色类哈希/字节一致性可复查。
- 依赖 levels 工作的 `region-campaign.js` 与声明文件（commit b121fae27b505fefc2d9e283f334c68b29e5a0cd）。本提交不重复携带该 worker 文件。
- 不写主线成绩、区域解锁或奖励。关卡内容、种子、奖励归原主线/地区控制器所有。
- 仅云端本地提交；没有推送、发布、操作 Mac/微信工具、改权限或凭证。

## 产品流程

1. 第 4 关或第 8 关必须是已登记的 `result.saved + completionRecorded`。用户选择下一关。
2. 当前结果页保留；加载真实目标 bundle、Prefab、必需锚点和材质/动画。20 秒真实资源请求超时视为失败，不能由进度条/计时器转为成功。
3. 准备失败：保留原结果页和已登记奖励，下一次明确点击重试。
4. 准备成功：退出棋盘回当前地区，人物沿 approach → rainbow bridge → arrival 的一个连续 walk action 行走，镜头每帧读取该 action 的真实 `walkProgress`。
5. 小岛到草原停在 `player_spawn → walk_path_02`；草原到天空停在真实 `anchor_cloudbridge_end` 后 2.4 米处，即天空入口。随后显示下一关。
6. 当前地区进入/退出棋盘时保留地区身份和人物位置。天空主线 09–12/天空挑战使用真实天空城 GLB 背景；草原仍用真实草原背景。
7. 暂停、后台中断先采样当前距离再取消，保留同一位置/镜头；明确继续后从剩余路径接着走。迟到资源和旧 action 回调不准覆盖新状态。
8. 冷启动依旧读取原合法成绩，从岛依次走向已解锁地区。本版行走 checkpoint 仅当前会话，不新增存档 schema。

## 接口

- `WorldFlowComponent.commands().prepareRegion('meadow'|'skycity')`：真实预备，允许覆盖已保存结果；失败不销毁结果。
- `travelRegion(target)`：只允许 island → meadow → skycity。重复调用由 flow/controller busy gate 拒绝。
- `journeySnapshot()` / world snapshot.journey：phase、region、target、loadProgress、distance、total、error、canRetry、canResume。
- `WorldNativeComposition.resumeJourney()`：恢复后续行走与待进入关卡。
- `RegionJourneyController`：独立状态机，场景适配、角色行走、镜头写入通过原接口注入。不复制角色、不写 root-motion。
- `levelOrigin`：退出/恢复棋盘回相同地区，不调用返岛或未实现的逆向路径。
- 主动选择已离开的旧地区返回 `return-route-not-yet-available`，不瞬移；本范围是前向主线旅程，未实现倒行回岛。

## 首版可调参数与资源检查

所有地形/角色比例仍为 1。配置集中在 `RegionJourneyAdapter.REGION_JOURNEY_LAYOUT`。

- 行走速度：1.2 米/秒。
- 桥宽：2.1 米；中心线 32 段；拱高 2 米。
- 岛→草原：桥头后偏移 [0,0,24] 米；路径约 32.37 米，预计 26.97 秒。
- 草原→天空入口：草原 authored path_02→08，桥偏移 [0,12,24] 米，天空入口行走 2.4 米；总长约 42.87 米，预计 35.72 秒。
- 27/36 秒只是候选，轻量关卡转场可能仍偏长。不得为压缩时间拉伸人物或地形，须根据真实画面再判断节奏。
- 桥面与角色共享同一条中心线。桥为轻量七带运行时网格，尚未美术验收。
- 多区域共存时仅关闭草原副本的 sky dome/far hills，复用原世界背景，避免该局部背景包住原岛；原 GLB 不改。
- 5395 个原网格采样：草原地形/河流/河岸在原岛足迹范围最高 y=-1.1782，低于原海面 y=-0.9185 约 0.26 米。
- 513 个桥中心线采样没有穿入草原地形；端点误差约 1e-10 米。属于采样检查，不是连续三角形证明，更不是 Cocos 导入/视觉接触证明。
- 天空岩体与草原的遮挡/相交未完成图形审查。云桥入口的真实表面、脚部接触与灯光都仍待实看。

## 已运行验证

设置 `QF_TYPESCRIPT_MODULE` 为可用 TypeScript 包路径后：

- `node tools/test_region_journey.cjs`：8 组通过。资源超时、真实预备、原地暂停、续走、双加载/迟到释放、失败重试、双 walk/销毁、实际 WorldFlow 保存结果预备与地区恢复。
- `node tools/test_region_journey_host.cjs`：8 组实际组合类方法通过。04/08 边界、失败留结果、暂停接续、只读/未登记禁止、冷启动两跳、逆向不瞬移；没有奖励写入。
- 独立 QA 生命周期 12 组通过，含错误区域 lease 验证、NaN/速度/桥范围/路径断点和迟到销毁。
- 对 RegionJourneyCore + WorldFlowCore 的 TypeScript `--noEmit --strict --target ES2020 --lib ES2020,DOM` 通过。
- 本次 11 个 TypeScript 文件转译无语法诊断；`git diff --check` 通过。
- 原有 es5_safety、turn_targets、wind_api 通过。
- 12 个主线关卡的地区身份/精确正则/天空 3D 背景绑定专项通过。
- `python3 tools/region-journey/audit_route_assets.py`：依赖 numpy；只读源 GLB，输出上述采样和路径时长。

## 非通过项，已区分基线

- `test_character_action_clock.cjs`：1 与 0.9999999999999984 严格相等失败；冻结源同样失败，角色实现字节未改。
- `board-ui/test_board_ui_pure.cjs`：第 115 行既有布尔断言 true != false；冻结源同样失败。本提交更新其后过期的地区背景断言，未跳过/放宽前面的失败。
- `test_startup_ready_gate.cjs`：2 != 3；冻结源同样失败。
- mainline_campaign 旧测试依赖缺失的旧浏览器结果文件；mainline_readonly_compat 需要可用浏览器环境。未把这些当作通过。
- 没有正式 Creator 构建和真实 WebGL 像素验收。所有源码/静态测试不能替代导入、运行画面、角色动画接触、输入实触及手机帧率验收。
