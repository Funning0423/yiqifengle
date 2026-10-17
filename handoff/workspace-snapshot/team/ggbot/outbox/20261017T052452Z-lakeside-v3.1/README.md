# 湖畔 v3.1：水色 + 三种雾模式（2026-10-17 01:24 EDT）

分支 `integration/build05-next-dirlight-20261017T0452`（本地，未推送，未改 main）。
- 新提交：**6d77c5f**，位于 12c0d4a（v3）之上。
- 补丁：`patches/` 为 f60c8ec..HEAD，共 5 个。
- 使用：`git fetch lakeside-v3.1.bundle integration/build05-next-dirlight-20261017T0452`。

## 改动
1. **水色**改为 sRGB 79/172/176 的线性值 (0.0782, 0.4125, 0.4342)。effect 默认值、参数块、v2 回退路径都用这个值；蓝色交给菲涅尔反射。
   - 注意：着色器里水色仍然**乘顶点色**，实际反照率等于“均值 × 顶点色”，比 r5h3 暗。详见下方评估。
2. **雾模式**：`LAKESIDE_FOG_MODE = 'layered' | 'linear60' | 'off'`，默认 `layered`。两种雾的颜色都是 sRGB 215/170/150。
   - `layered`：Cocos 内置 LAYERED。fogType = 3，按 3.8.8 `render-scene/scene/fog.ts` 的枚举：LINEAR 0、EXP 1、EXP_SQUARED 2、LAYERED 3。
     - 参数：**fogTop 1.5 m，fogRange 30，fogAtten 17**。属性名已对照 3.8.8 `scene-globals.ts` 的 FogInfo setter 核实：fogTop、fogRange、fogAtten、fogDensity、fogStart、fogEnd、type、fogColor。
     - 取值依据：水面 y = 0，远岸 0–0.3 m，远山 LK_far_hills 为 −2 至 40.8 m，远岸树根约 5.7 m。所以只有 1.5 m 以下的薄层有雾。
     - 按 3.8.8 LayeredFog() 公式（相机 y 13.2，在雾顶之上）算得：远岸水面约 77 m 处为 0.36，湖尽头约 100 m 处为 0.44，1.5 m 以上为 0。
     - 代价：棋盘所在的水面（18–24 m）也会有约 0.10–0.13 的雾。这是公式决定的：雾量随水平距离线性增长，无法做到近处为零。
   - `linear60`：LINEAR，起点 60 m，终点 60 + 70/0.4 = 235 m，130 m 处为 0.4。
   - `off`：雾关闭。
   - 水面 effect 使用通用的 `CC_TRANSFER_FOG` / `CC_APPLY_FOG` chunk，所以三种模式都对水面生效。
   - hide/dispose 时恢复原雾的全部字段：enabled、type、color、start、end、top、range、atten。
3. **运行时切换（只限 web）**：在湖畔加载时读一次 URL 参数 `?lakefog=layered|linear60|off`。参数无效或缺失时用常量。
   - 微信里没有 `window.location`，代码已判空并 try/catch，会直接用常量。
   - 诊断信息里有 `fogMode`，可用来确认实际生效的模式。

## Mac 截图：构建一次 web-mobile，拍 3 张
用 Creator 预览（默认 http://localhost:7456/），或把构建出的 `build/web-mobile` 用任意静态服务器打开（下面以 8080 为例）。进入湖畔关卡，在同一机位截图：
- http://localhost:7456/?lakefog=layered　（或 http://localhost:8080/index.html?lakefog=layered）
- http://localhost:7456/?lakefog=linear60　（或 http://localhost:8080/index.html?lakefog=linear60）
- http://localhost:7456/?lakefog=off　（或 http://localhost:8080/index.html?lakefog=off）

如果你们的地址已经带有 `?xxx`，就改用 `&lakefog=...` 追加。改参数后要整页刷新，因为模式只在湖畔加载时读取一次。

## 测试
- `test_lakeside_water_fog.cjs` 已更新，覆盖：
  - 水色换算；
  - 雾模式和 URL 解析：非法值、空值、无 window、location 抛异常；
  - 分层雾公式：远岸、棋盘、2 m 以上；
  - 三种模式的接线和恢复字段。
- 全套件 **53/58**。未通过的都是已知允许项：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract 为 FAIL，navigation-guard 为 BLOCKED。lakeside 5 项全部 PASS。
- box 上没有 Creator，effect **仍未实际编译**。编译风险同 v3 README。

## 对比图 `lakeside_v3.1_compare.png`
- 四栏：r5h3、分层雾、线性 60、无雾。**Blender 代理，不是引擎截图。**分层雾在材质里按 3.8.8 LayeredFog 公式计算。
- 区域中位数与 r5h3 的 L1 差（越小越好）：

  | 版本 | 顶部 | 中部水面 | 近处水面 | 树 | 合计 |
  |---|---|---|---|---|---|
  | v2 | 29 | 47 | 52 | 31 | 166 |
  | v3 | 59 | 40 | 84 | 90 | 289 |
  | v3.1 分层雾 | 35 | 76 | 132 | **15** | 287 |
  | v3.1 线性 60 | 58 | 61 | 145 | 60 | 345 |
  | v3.1 无雾 | 35 | 61 | 145 | 15 | 282 |

- **评估**：
  - 分层雾达到了目的。远山和远树恢复深绿，树区差值从 90 降到 15，是目前最好的；只有水边一条暖色带。
  - 但新水色让水面明显变暗、偏绿：近水约 (32, 129, 86)，r5h3 约 (81, 160, 151)。原因是“顶点色均值”又乘了一遍顶点色。
  - 建议下一步二选一：
    - 在 mtl 里关掉 USE_VERTEX_COLOR；
    - 或者水色恢复接近白色。
  - 可以先看 Mac 实机再定。
