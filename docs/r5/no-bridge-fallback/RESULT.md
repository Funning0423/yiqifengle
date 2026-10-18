# 去掉彩虹桥回退

时间：2026-10-18 15:01 EDT。分支 `cloud/r5-no-bridge-fallback`，起点 `bc81575`（`gbt/r5-integrated-b07-wip`）。代码提交 `63f3963d8f8a3bb65beae951544de93995bf9d13`。未改 `BalloonFlight.ts`。未开 PR，未推 `main` / `int/v1` / `gbt/r5-integrated*`。

## 做了什么

岛→草原固定帆船，草原→天空之城固定热气球。慢加载和失败都留在对应交通工具上。

- 去掉 `sailPreloadFallback`。预加载超过 6 秒或失败不再把下一次岛→草原改成桥；`SailPreload` 改为等待并重试。
- 热气球准备不再 `Promise.race` 6 秒超时后落入彩虹桥。`awaitVehicle` 保持当前遮罩透明度，不淡到全黑，不写镜头；失败重试，取消或场景销毁则退出。
- 帆船预制体和热气球资源等待改为 120 秒，20 秒加载能在同一次请求里完成。
- `?transport=bridge`、`__QF_TRANSPORT=bridge`、第三个参数 `'bridge'` 无效，并 `console.warn` `bridge-ignored`。错配的 sail/balloon 覆盖也改不了这两段。

## 测试

`QF_TYPESCRIPT_MODULE` 指向 TypeScript 5.4.5，Node v22.23.3，`node tools/journey-integration/run-suite.cjs`。124 项里 123 项 PASS，只有 `navigation-guard` 为 `BLOCKED_BROWSER`。`no-bridge-fallback`、`sail-continuity`、`frame-background`、`sky-arrival` 均为 PASS。新测试用虚拟时钟模拟帆船和热气球加载 7 秒、20 秒、失败一次再成功：不选 bridge，最终进入对应工具，等待期间遮罩采样连续且不为 0 或 1。

## 包体、画面

未重打微信包。无新贴图或模型。新增 `TransportWait.ts` 4183 字节源码。对照 sail-qa4 的 wechat 包 20,286,150 字节（上限 24,641,536），资源差值为 0。无新截图或视频。

## grep

脚本里已无 `balloon-timeout`、`timeout-6s`、`sailPreloadFallback` 状态位、`preload-fallback`。

仍会碰到 bridge 字样、但不是这两段的回退：

- `JourneyTransport.ts` 未知地区对 `return 'bridge'`；岛→湖畔表项仍是 bridge。
- `RegionJourneyAdapter.ts` 第 182 行：非岛→草原时的 else 仍调用 `rainbowBridge`。第 238 行：湖畔旅程仍铺彩虹条带。
- `RegionNodePlay.ts` 非出发走路和天空终章把 `transport` 标成 `'bridge'`，不创建条带。

## 可删清单（未删）

- `noteSailPreloadFallback` / `sailPreloadFellBack`：生产已无调用，只打警告。
- 没有独立彩虹桥模型或贴图。`rainbowBridge()` 仍被湖畔和非常规 else 使用，不能删。
- `LK_bridge.glb`、`LK_bridge_steps.glb` 是湖畔景物桥，不能删。

## 遗留

湖畔岛→湖畔仍是彩虹桥。非常规地区对仍会走桥体。热气球美术合并时不要改 `BalloonFlight.ts` 里 `SKY_LAWN`、`skyNodeAfterArrival`、`arrived=true` 与 `fadeCover(0,0)` 的顺序。
