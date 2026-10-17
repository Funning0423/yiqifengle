# 湖畔 v3.2：保留顶点色的水面（2026-10-17 01:42 EDT）

分支 `integration/build05-next-dirlight-20261017T0452`（本地，未推送，未改 main）。
- 新提交 **21c187d**，位于 6d77c5f（v3.1）之上。
- 补丁：`patches/` 为 f60c8ec..HEAD，共 6 个。
- 使用：`git fetch lakeside-v3.2.bundle integration/build05-next-dirlight-20261017T0452`。

## 改动（按 Voice Bot 的方案：保留顶点色）
- **保留 r5h3 水面顶点色**（岸边浅、湖心深），USE_VERTEX_COLOR 仍为开。
- 水色从 79/172/176 改为**近白 (0.9, 1, 1)**，是 VB 允许的最大冷色；effect 默认值和参数块一致。
  - 纯白时，代理图近水约 (145, 173, 130)，r5h3 为 (81, 160, 151)：暖主光把近水推向黄绿。
  - 0.9 的冷色几乎没有效果。
- 因此在着色器侧补偿：天空反射混合加一个**下限 0.25**（`specParams.w` / `waterSkyReflectFloor`）。
  - 正对视角时也至少混入 25% 的天顶蓝。太阳高光条仍乘原始菲涅尔，不受影响。
  - VB 的 F0 0.02 / 幂 5 保持不变；下限是额外的一项，属于偏差，特此说明。
- **v2 回退路径**（内置材质 + mainColor）：mainColor 用同一个参数，换算后为 243/255/255，接近白色，所以水色主要来自顶点色。内置材质没有反射下限。
- 雾和 URL 参数沿用 v3.1：默认分层雾，fogTop 1.5 / fogRange 30 / fogAtten 17；linear60 为 60→235 m；off 为关闭。颜色 215/170/150。

## Mac 截图：构建一次 web-test，拍 3 张
构建配置 `tools/build-guard/web-test.json`：platform web-mobile，outputName web-test，产物在 `creator-build-project/build/web-test/index.html`。

```bash
python3 -m http.server 8790 --bind 127.0.0.1 -d creator-build-project/build/web-test
```

用 Chrome 打开下面三个地址（手机视图 390×844），分别进入湖畔，在同一机位截图。每换一个地址都要整页刷新，因为模式只在湖畔加载时读一次：
- http://127.0.0.1:8790/index.html?lakefog=layered
- http://127.0.0.1:8790/index.html?lakefog=linear60
- http://127.0.0.1:8790/index.html?lakefog=off

## 测试
- `test_lakeside_water_fog.cjs` 已更新：近白水色、顶点色仍相乘、USE_VERTEX_COLOR 开、下限 0.25 只作用于天空混合、回退色 243/255/255。
- 全套件 **53/58**。未通过的都是已知允许项：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract 为 FAIL，navigation-guard 为 BLOCKED。lakeside 5 项全部 PASS。
- box 上没有 Creator，effect **仍未实际编译**。

## 对比图 `lakeside_v3.2_compare.png`
- 四栏：r5h3、分层雾、线性 60、无雾。**Blender 代理，不是引擎截图**；同一机位。
- 区域中位数与 r5h3 的 L1 差（越小越好）：

  | 版本 | 顶部 | 中部水面 | 近处水面 | 树 | 合计 |
  |---|---|---|---|---|---|
  | v2 | 29 | 47 | 52 | 31 | 166 |
  | v3.1 无雾（79/172/176 × 顶点色） | 35 | 61 | 145 | 15 | 282 |
  | v3.2 无雾，纯白，无下限（中间尝试） | 35 | 67 | 98 | 15 | 280 |
  | **v3.2 分层雾（默认）** | 35 | 66 | **66** | 15 | **242** |
  | v3.2 线性 60 | 58 | 69 | 67 | 60 | 324 |
  | v3.2 无雾 | 35 | 69 | 67 | 15 | 249 |

  另试过下限 0.4：近水降到 51，但中部水面升到 82，所以选 0.25。

- **评估**：
  - v3.2 分层雾是 v3 以来分数最好的，近水从 145 降到 66。
  - 但近水仍比 r5h3 偏红、偏白：约 (132, 167, 143)，r5h3 为 (81, 160, 151)。整体观感偏奶青色，没有 r5h3 的深蓝。
  - v2 在中部水面上仍然最接近。剩下的差距主要来自暖色主光照在水面上的漫反射。如果 Mac 实机也偏白，下一步可以考虑给水面单独降低主光漫反射，这需要新增一个参数。
- 注：box 重启后 /tmp 被清空，本轮代理渲染改用重新下载的 Blender 5.2.2。v3.1 无雾配置的重渲结果与原来逐项一致（282），可以对比。
