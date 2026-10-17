# 风车草甸 v0.8 技术预研（M4 A4.2）· GGbot · 2026-10-10

对象：`art/x/GROKBOT-MEADOW-v0.8.0/meadow_v0_8/meadow_greybox_v0_8.glb`（SHA256 `8349b9a8…677b`，1.38 MB）。不改美术风格。
所有结论都是静态分析加文档核对，**没有在 Cocos 3.8.8 里导入过**。凡是需要 Cocos 或真机才能确认的，都标为 not_run。

检查报告：`art-import-check-meadow-v0.8.md`（`art_import_check` + `glb_budget_check`）。

## 现状数据
- 场景三角面 78,492（≤120k，passed）。
- 15 个普通网格节点（每个 1 个 primitive），另有 8 个 `EXT_mesh_gpu_instancing` 节点：5 种草模板共 1,000 个实例，3 种花模板共 150 个实例，合计 **1,150 个实例**。实例部分有 49,654 个三角面、87,753 个顶点。
- 材质 6 个：`M_meadow_grass_wind`（草）、`M_meadow_palette`（花和大部分静态物体）、`M_meadow_terrain`、`M_meadow_bank`、`M_meadow_sky`、`M_meadow_cloud`。
- `extensionsRequired` 为空，说明这个扩展不是必需的，不支持它的导入器应该会忽略它，而不是导入失败。
- 动画：`windmill_sails_loop`（节点动画）。

## 1. EXT_mesh_gpu_instancing 和风 shader 在 Cocos 3.8.8 中的支持情况

| 项 | 结论 | 状态 |
|---|---|---|
| glTF 导入器是否读取 EXT_mesh_gpu_instancing | Cocos 3.8 官方文档的 glTF 资源对照表里没有这个扩展，引擎侧实例化是靠材质的 `USE_INSTANCING` 实现的，和 glTF 扩展无关。**预计不支持**：导入后每个实例化节点只会在原点显示 1 个模板，1,150 个实例里只能看到 8 个 | 文档核对：failed（不支持）；导入实测：not_run |
| 引擎侧 GPU 实例化 | 支持。材质勾上 `USE_INSTANCING` 后，同一 mesh 加同一材质的 MeshRenderer 会自动合成一次实例化绘制 | 文档：passed；实测：not_run |
| 每实例自定义属性（`_ROOT_COLOR`） | 支持。在 effect 里声明 `a_root_color`（放在 `USE_INSTANCING` 宏内），再用 `MeshRenderer.setInstancedAttribute` 赋值 | 文档：passed；实测：not_run |
| 风 shader | glTF 里的材质 extras 公式不会被 Cocos 执行，导入后会变成内置的 standard 材质，草就静止不动了。需要手写一个 Cocos effect `meadow-grass-wind.effect`：顶点阶段按 README 的公式位移（用 `cc_time` 加实例原点算相位），片元阶段按 root 到 tip 混色。这些写法都是 Cocos effect 的标准能力 | 可行性：passed；实现和效果：not_run |
| 地形细节贴图、`_DRIFT`、河岸 | 都需要写自定义 effect。`_DRIFT` 是下划线开头的自定义顶点属性，Cocos 导入时会不会保留还不确定。如果被丢掉，可以在导出时改放进 `TEXCOORD_2` 或 `COLOR_0.a` | not_run |

**替代方案**（导入器不支持时）：
- **A. Cocos 侧实例化（建议先用这个接入）**：用 `tools/extract_gpu_instances.py` 把 GLB 里的实例数据导出成 JSON（已生成 `meadow_instances_v0_8.json`，93 KB，gzip 后 29 KB，1,150 个实例和 GLB 逐个对应）。运行时由 `prototypes/MeadowInstancer.ts` 把每组展开成节点，这些节点共用同一个 mesh 和同一个材质，并开启 `USE_INSTANCING`。下载量不增加。代价是多出 1,150 个节点，每帧要做视锥剔除，还要上传实例缓冲，这部分在中端 Android 上的 CPU 开销要实测。
- **B. 运行时合并网格（如果 A 在真机上 CPU 吃紧，就换成这个）**：加载时用 JS 按“材质加 2×2 空间分块”把实例烘焙成合并网格。风的相位需要的实例原点，以及 root 颜色，都改成写进逐顶点属性。下载量也不增加，内存约多 4–5 MB（按约 8.8 万个顶点、每顶点 48–56 B 估算），每帧几乎没有 CPU 开销。
- **C. 离线合并进 GLB（不推荐）**：draw call 和 B 一样，但 GLB 会从 1.38 MB 涨到大约 6 MB（估算），远程下载变慢。

## 2. 1,150 个实例的合批方案和预估 draw call

| 方案 | 普通网格 | 草和花 | 合计 draw call（不含 UI，草和花不投影） | 状态 |
|---|---|---|---|---|
| 现状（按扩展理想实例化） | 15 | 8 | 23 | — |
| 直接导入 Cocos（扩展被忽略） | 15 | 8，但只显示 8 个模板 | 23，画面是错的 | 预计 failed，not_run |
| 不实例化，逐个节点绘制 | 15 | 1,150 | **1,165** | failed（超过 ≤80） |
| A. Cocos 侧实例化 | 15 | 8 | **23** | 估算 passed，实测 not_run |
| B. 运行时合并（2×2 分块） | 15 | 2 种材质 × 4 块 = 8（剔除后通常更少） | **≤23**；不分块时是 17 | 估算 passed，实测 not_run |
| 加上静态合批：6 个用 `M_meadow_palette` 的静态网格（远山、栅栏、小路、河、树、风车主体）合成 1 个 | 10 | 同 A 或 B | **18（A）或 ≤18（B）** | 估算 passed，实测 not_run |

注意：风车叶片和风铃有动画，不参与静态合批。开启实时阴影的话，投影物体还要再加一个阴影 pass，所以建议草和花都不投影（README 里也是这么建议的）。

## 3. 天空贴图 4096×1024 的降级方案

原图 4096×1024 的 JPG 只有 85 KB，但贴到 GPU 上是 RGBA8 加 mipmap，约 **21.3 MiB**，单张就占了活跃纹理预算（64 MiB）的三分之一，而且超过了 2048 的上限。画面内容是竖向的渐变，加上地平线一带的一圈云，横向细节不多（每行横向标准差平均只有 9）。

| 方案 | 文件 | GPU 估算 | 和原图对比 PSNR（缩小后再放大回原尺寸） | 结论 |
|---|---|---|---|---|
| 原图 4096×1024 | 85 KB | 21.3 MiB | — | failed（超过 2048） |
| **2048×1024（推荐）** | 78 KB | 10.7 MiB | 48.3 dB | passed，边长和预算都达标，肉眼看不出区别 |
| 2048×512 | 50 KB | 5.3 MiB | 44.7 dB | passed，云边缘略软，可以作为低档画质 |
| 1024×512 | 29 KB | 2.7 MiB | 42.3 dB | passed，可以作为最低档 |
| 拆成 2 张 2048×1024 | 137 KB | 21.3 MiB | 无损 | 不推荐：显存不省，还多一个材质或子网格 |

文件在 `reports/meadow/sky/`，对比图是 `compare_orig_2048x1024_2048x512_1024x512.png`，从左到右依次是原图、2048×1024、2048×512、1024×512，都放大回原尺寸后截取同一朵云。
另外建议在 Cocos 构建时给天空和地面贴图开启压缩纹理（ASTC/ETC2），能把显存再降到原来的 1/4 到 1/8。这一步要实测：not_run。
**最终观感由 Grok Bot 验收。**

## 其他（导入检查）
- 23 个网格节点都是 `meadow_` 或 `wind_bell_` 开头，不在命名表里。建议改成 `env_meadow_*` 和 `env_meadow_bell_*`，或者把 `meadow_` 加进允许的前缀，这一点由 Grok Bot 定。
- GLB 1.38 MB，按规则走 `region_meadow` 远程包。

## 下一步（需要分工确认）
1. 写 `meadow-grass-wind.effect`，并把 `MeadowInstancer` 合进 `region_meadow` 补丁，我可以做。是否能编译和画面效果，要等这台电脑的 Cocos 能登录后再验。
2. 天空贴图选哪个尺寸，由 Grok Bot 决定后在美术源文件里替换。
3. E6 性能实测：在中端 Android 上对比 A 和 B 的帧时间（Oi，或这台电脑加真机）。
