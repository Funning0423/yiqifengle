# 天空城减面洞可见性测试（b19）

b19 减面（9e84571d）删掉了 env_skycity 里 1,800 个"所有镜头都看不到"的面（多在岛底、云桥尽头下方和被包住的内部）。
这条测试保证：**任何镜头都不能从视口里看穿这些面留下的洞**。新增或修改镜头后跑一遍。

## 命令
```bash
export DRACO3D=/tmp/draco3d/node_modules/draco3d     # 没有 vendored draco3d 时需要
node tools/skycity/test_skycity_visibility.cjs          # 快速模式（suite 默认，约 40 秒）
node tools/skycity/test_skycity_visibility.cjs --full   # 全量：所有自由环绕机位（约几分钟）
```
退出码：0 = PASS，1 = 看穿了洞（或自检 canary 没被发现），2 = 运行错误。`--json out.json` 写出完整命中列表。

## 覆盖的机位（每次运行时从仓库代码/数据自动收集，不写死）
`tools/skycity/visibility/cams.cjs`：
- board：`SkycityVisitPose.skycityVisitPose` × route-legs 的全部屏幕比例
- finale：`SkyFinaleShot.ts` 里所有带 position/target 的导出位姿（T-02 终镜及变体）
- arrival：气球草地→天空城运行时镜头（route-legs `balloonLeg`），城市出现后每 0.25 s（快速 0.5 s），全部屏幕
- flightkey：`balloon_flightpath.json` 世界系关键帧
- depart：天空城→湖边连续镜头（`SkyLakeContinuous`），每 0.25 s 直到起飞后 4 s，全部屏幕
- orbit：可走区（`skycity-walkable` fixture）每 3 m 一个支点 + 所有 `anchor_*`，yaw 每 20°、pitch −6…72°、臂长 3…40 m，镜头被墙挡时拉到墙前；按 45° 视锥判断（比任何屏幕对角线都宽）。快速模式：6 m 支点、yaw 40°。
运镜bot 改了这些代码/数据，测试自动覆盖新镜头。

## 加额外机位
```bash
node tools/skycity/test_skycity_visibility.cjs --cam px,py,pz,lx,ly,lz[,fov[,aspect]]     # 天空城本地坐标
node tools/skycity/test_skycity_visibility.cjs --extra my-cams.json [--world]
```
`my-cams.json`：`{"cams":[{"tag":"T-05","at":"t=3.2","pos":[x,y,z],"lookAt":[x,y,z],"fov":48,"aspect":0.462,"frame":"world"}]}`
（`frame:"world"` 或 `--world` 表示旅程世界坐标，会用 CW_JSON 换到天空城本地；也可写 `"cone":45` 代替 fov/aspect。）
`--no-repo` 只跑额外机位。新镜头若会长期存在，应加进对应的运行时代码/数据（会被自动收集），而不是只放在 JSON 里。

## 判定
每个被删面取 7 个采样点（中心、三个内缩角点、三条边中点；fixture `visibility/removed-faces.json.gz`）。
采样点在镜头视口内，且镜头→采样点的线段没有被**当前** env_skycity 的实体挡住（停在 3 cm 前） ⇒ 看穿洞 ⇒ FAIL。
不算遮挡：角色、state_*、云/雾、骨骼绳和小件、alpha 卡片。
自检：`visibility/canary-cams.json` 里的假机位（岛底下 2 m 朝上）必须被判为看穿，否则测试本身坏了也会 FAIL。

## 失败时怎么办
输出里每条命中有：`tag`/`at`（哪个镜头、哪个时刻/屏幕）、`position`/`target`、`seenSamples`、`first.face`（如 `env_sky_static_palette#143`）、
`first.point`、`first.screen`（`x01`/`y01_fromTop` 为屏幕归一化位置；orbit 为视锥正切）。
1. 先确认镜头是否合理（是否钻到岛底/墙里）。不合理就改镜头。
2. 镜头合理：把对应的面补回 env_skycity（从 8557f895 版本取回这些面，或重新减面时把该镜头加入可见性分析，见 tools/scene-design/skycity-facebudget），
   重新生成 fixture：`node tools/skycity/visibility/build-removed-fixture.cjs <减面前rev> <减面后rev>`，并重跑面数预算测试（≤90,000）。
3. 别为了通过而把镜头从收集里删掉。
