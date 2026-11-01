# r5 S1-1 帆船船尾白沫加长（fx/r5-sail-wake）

基线 `gbt/r5-integrated-b07-wip` = `bc81575f`（含 sail-qa4）。镜头一行没动（`TransportLeg.sailCamera` / `SailShot` / `SailRide` 未改）。

## 改了什么
- 新文件 `creator-build-project/assets/scripts/region/SailWakeCore.ts`（纯数学，不 import cc）：记录船尾 `wake_root` 的世界坐标轨迹（每 0.6 m 一个点，最多 44 个 ≈ 26 m），沿轨迹生成 3 条带：
  - 中间一条螺旋桨乱流白沫（半宽 0.42 m 起，16 m 内淡出）；
  - 两条开角 17° 的开尔文尾浪（24 m 内淡出，最大外张 5.2 m）。
  - 透明度 = 放出时的船速（0.35–3.2 m/s 渐入）× 沿程淡出 × 时间淡出（停船后 7.5 s 内消失）。所以船慢下来尾迹自然变短变淡，靠岸时新白沫几乎为 0。
  - 白沫贴图 v 方向按走过的路程铺（每 7 m 重复一次），贴图钉在水面上，不跟船游动；没有随机数，尾端点 alpha 恒为 0，不会闪、不会断头。
  - 夜间：用 `sync()` 拿到的同一个 night 标志，0.5 s 渐变到蓝灰白沫（160,186,218），透明度 ×0.78。
- `SailArt.ts`：
  - 关掉原来 9 m、锁死在船身上的 `wake_strips`，换成一个 `wake_trail` 节点（`builtin-unlit` alpha-blend 第 3 号 technique + 顶点色，复用 `foam_strip_512x128.png`，和 ShoreBreak 白沫同一条已在真机验证的路径）。动态网格用 `utils.MeshUtils.createDynamicMesh` / `updateSubMesh`，没有时退回 `utils.createMesh`。
  - 一个 renderer 换一个 renderer：DC 不变；尾迹为空（停船）时节点隐藏，反而少 1 个 DC。
  - `hull_foam_ring` 白天不变；夜间跟随同一个昼夜权重染成同样的蓝灰（原来夜里是纯白发亮）。
- 另一个独立提交：`clearLandingGrass` 里 `for (const [r,info] of rootAt)`（对 Map 用 for-of）改成 `rootAt.forEach`。微信小游戏是 loose ES5 编译，这句在真机上不会迭代，靠岸草地实际上没被清掉。网页预览不受影响。可以单独丢掉。
- 不加新贴图、新模型、新材质资源；没有雾、没有体积光。

## 实测（box，离线）
`node tools/scene-fx/test_sail_wake.cjs`（ES2020 和 `QF_TS_TARGET=ES5` 各跑一遍，都 PASS），用真实 `TransportLeg.sailVehicle` 时间线 60 Hz 驱动：
| 项 | 结果 |
|---|---|
| 巡航可见长度（S-d 开始 3 s 后 → 稳定） | 12.8 → 19.5 m（原 `wake_strips` 9.03 m 定长） |
| 靠岸最后 0.4 s 新白沫强度 | 0 |
| 停船 7.5 s 后 | 完全消失（peak 0） |
| 同一个点逐帧 alpha 最大变化（60 Hz，过船尾渐入区） | 0.0051 |
| 白沫 UV 漂移 | 0（钉在水面） |
| 最大顶点 alpha | 0.70（白天）/ 0.546（夜间） |
| 中间白沫和两侧尾浪重叠 | 0 行（不叠成白块） |
| 顶点 / 索引 | 264 / 774（Uint16） |
| DC | 由构造：−1（wake_strips）+1（wake_trail）= 0；停船时 −1。**没在运行时实测** |
| transport_sail 子包 | 资源没变：qa4 构建实测 206,639 B（≤1.0 MiB）；源文件合计 482,250 B |
| 主包增量 | SailWakeCore ES5 输出约 6.8 KB（去空白），SailArt +约 3 KB |

其他回归（都在本分支上跑，PASS）：`test_sail_art`、`test_sail_k2k7`、`test_transport_sail`、`asset-budget`、`test_sail_continuity`、`test_sail_clearance`、`test_sail_dock_path`、`test_rider_parenting`、`test_transit_background`。`test_shore_break` 1/28 失败是基线就缺 `region_island/combined_visual_m.glb`，和本改动无关（stash 后同样失败）。
类型检查：用 `@cocos/creator-types@3.8.8` 的 cc.d.ts、strict、target ES5 检查 SailArt.ts + SailWakeCore.ts，新增 0 个错误（剩下 2 个是基线就有的类型告警，ES5 的 Map 迭代告警已随第二个提交消除）。

## 看过的渲染图（离线代理，不是 Cocos 画面）
Blender 4.5 Cycles 代理：船、海面来自 transport_sail 的 GLB，相机用 `sailCamera`，尾迹网格 / UV / 顶点 alpha 逐帧取自真实 SailWakeCore。白沫按 unlit 画法还原；海面和船的光照是近似。
- `/workspace/yiqifengle/previews/场景特效bot/r5/wake/final_cmp_K4.png`、`final_cmp_K5.png`：白天旧 | 白天新 | 夜间旧 | 夜间新。
- `/workspace/yiqifengle/previews/场景特效bot/r5/wake/cmp_wide_v2.png`：QA 俯视（不是游戏镜头）旧 | 新 ×2 个时刻，能看到整条尾迹长度。
- `/workspace/yiqifengle/previews/场景特效bot/r5/wake/final_day_new/K2–K7.png`、`final_night_new/`：游戏 K 镜头单帧。
- 视频：`wake_day.mp4`、`wake_night.mp4`（10 fps，S-c 前 0.5 s 到停船后约 2 s）。
- 改前（qa4 真机录屏抽帧）：`before_strip.png`。

## 没测
- Cocos 正式构建、浏览器 `?sailqa=1` 真实采集、真机；DC 运行时数字。box 上没有 Cocos Creator，也没有 web-test 构建。
- 夜间 unlit 白沫和真机夜景的实际亮度对比（代理里夜景海面亮度是估的）。
- 运镜bot 改过的远海镜头下的样子（那条镜头不在本分支）。
