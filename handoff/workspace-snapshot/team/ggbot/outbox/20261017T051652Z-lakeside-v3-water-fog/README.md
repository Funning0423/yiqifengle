# 湖畔 v3：水面着色器 + 线性雾（2026-10-17 01:16 EDT）

分支 `integration/build05-next-dirlight-20261017T0452`（本地，未推送，未改 main）。基于 f60c8ec。
- 6392d39 D1 v1；209d4e8 D1 v2；fec63e9 Voice Bot 凉亭修复 L5（cherry-pick 0932b6b，跳过 34 个模板实例，465→431）；**12c0d4a v3**。
- 使用：`git fetch lakeside-v3.bundle integration/build05-next-dirlight-20261017T0452`，或用 `git am patches/*.patch` 打在 f60c8ec 上。

## 水面着色器（`bundles/region_lakeside/water/lakeside-water.effect` + `.mtl`）
- 只用于 LK_lake 网格。运行时拷贝一份材质，随 lease 一起销毁；加载失败时退回 v2 的 mainColor 水色乘。
- 支持 instancing（legacy/local-batch，`CCGetWorldMatrixFull`）。顶点色相乘（USE_VERTEX_COLOR）。可选 `cc_time` 正弦法线（USE_WAVES）。不用贴图，不用 bloom。
- 光照公式：
  - 漫反射与标准材质一致，环境光取 sky/ground 半球。
  - Schlick 菲涅尔：F0 0.02，幂 5，上限 0.85。
  - 反射向量按仰角取三段天空色：地平线 (1,0.5457,0.1441) →（仰角 0.16）低空 (0.9216,0.5776,0.2705) →（仰角 0.38）天顶 (0.0116,0.2747,0.4793)，再乘环境光强度。
  - 太阳高光条：Blinn，指数 300，噪声 ±40%（落在 200–500 内），颜色取主光颜色。
  - 最后 `CC_APPLY_FOG`。
- 包体：源文件约 5.6 KB（effect 4.7 KB）。估计编译后的 effect 资产（GLSL1/3 × 宏变体）约 8–20 KB，未压缩；材质小于 1 KB。没有新增贴图。

## 雾（引擎内置 LINEAR）
- 湖畔显示时开启；hide/dispose 时恢复原来的 enabled/type/color/start/end。
- 颜色 #FFCEA6，起点 45 m。
- **与 Voice Bot 数值的偏差**：Cocos 的 LINEAR 雾没有“最大浓度”参数，所以把终点拉到 45 + 85/0.4 = **257.5 m**，这样 130 m 处正好是 0.4。代价是 257.5 m 以外会继续变浓，最远的云在约 163 m，那里大约 0.55。
- 棋盘距相机 16–24 m，近岸从 29.6 m 起，都完全没有雾。
- 绘制调用：基础 pass 约 38（L5 之后 38 个 GLB，431 实例）。雾和方向光都不增加 pass。
- 首次切换雾类型时，CC_USE_FOG 宏变化会触发全场景 shader 变体重编，可能有一次卡顿，需要在 Mac 和真机上观察。

## 编译风险（box 上没有 Creator，**未实际编译**）
- 只用了 3.8.8 中确认存在的 chunk：legacy/input-standard、local-batch、fog-vs/fs、output-standard、builtin/uniforms/cc-global。结构仿照 builtin-unlit。
- 自定义 uniform 块 `LakesideWater` 全部是 vec4，std140 安全；块名不和内置的冲突。
- FS 用 highp。WebGL1 / 微信可用（只依赖导数无关的运算，没有 dFdx）。
- 风险点：
  - 假定 `cc_mainLitColor.w` 是曝光后的强度（HDR 关闭时就是光照度比例），如果偏亮或偏暗，调 specParams.y。
  - `.effect.meta` 的 ver 1.7.1 是手写的，Creator 首次导入会重写，属于正常现象。
  - 如果 Mac 报 effect 错误，请把 Creator 控制台的原文发回来。
- `FogType.LINEAR` 用数值 0 写入，避免依赖 'cc' 导出名。

## 测试
- 新增 `tools/lakeside/test_lakeside_water_fog.cjs`，并接入套件。它检查：
  - Voice Bot 数值；
  - 雾终点 257.5，130 m 处 0.4，棋盘角无雾；
  - effect 结构、chunk 白名单、vec4 块；
  - mtl 引用 effect 的 uuid；
  - lease 接线和雾的恢复。
- instancing 测试的正则窗口从 1200 放宽到 4000。
- 全套件 53/58。未通过的都是已知允许项：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract 为 FAIL，navigation-guard 为 BLOCKED。lakeside 的 5 项全部 PASS。

## 对比图 `lakeside_v3_compare.png`（左 r5h3，中 v3，右 v2）
- **Blender 代理渲染，不是引擎内截图。**脚本是 `render_v3.py`，两边都已跳过模板实例。
- 迭代 3 轮。最终用环境光 0.6，雾自发光 0.45，反射 1.2。代码默认环境光仍是 0.75，是否下调以 Mac 实机为准。
- 区域中位数与 r5h3 的 L1 差（越小越好）：

  | 版本 | 顶部 | 中部水面 | 近处水面 | 树 | 总均值 | 合计 |
  |---|---|---|---|---|---|---|
  | v2 | 29 | 47 | 52 | 31 | 7 | 166 |
  | v3 | 59 | 40 | 84 | 90 | 16 | 289 |

- **诚实评估**：
  - v3 的水终于是蓝的，有菲涅尔和天空反射，远岸也有暖色空气感，观感比 v2 更接近“通透的黄昏湖”。
  - 但按数值，只有中部水面变好。远处树林和山被 #FFCEA6 雾洗成灰暖色，r5h3 的同一区域是深绿、没有雾。近水偏青、偏饱和，R 通道偏低。
  - 建议在 Mac 上先看实机。如果远景太灰，把起点推到 60 m 或把最大浓度降到 0.25（只改 LAKESIDE_DIR_LIGHT_PARAMS）。
