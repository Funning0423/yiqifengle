# b15 天空城云海减面：98,840 → 89,989（≤90k）

- 基准：gbt/r5-integrated-b15 @55368056；分支 scene/b15-cloudsea-90k。
- 只改 `region_skycity/env_sky_cloudsea_soft.glb`（13,110 → 4,259 面，38,736 → 29,632 B）。`env_skycity.glb` 没动，哈希和所有 pin 不变。
- 计数口径同 test_sky_cloudsea：env_skycity 去掉隐藏的 env_sky_cloudsea / env_sky_cumulus_far（85,730），加上软云海。

## 做法
1. **镜头可见性**（tools/scene-design/cloudsea-90k/vis2.py）：用 Blender BVH 做射线遮挡，相机采样包括：
   - balloon_flightpath.json 里 world 帧的全部机位（换算到 skycity 局部坐标）；
   - 45 个岛面支点 × 18 个 yaw × pitch −6..72° × 距离 4..60 m，覆盖自由探索和棋盘高机位；
   - 共 16,378 个相机。

   遮挡体不算 MASK 叶片卡、蒙皮网格和 state_*。结果有 2,779 个云海面在任何机位都看不到，全部删掉。
2. **只在远处折叠**（dec2.py）：在 Blender 里做 collapse 减面。以下顶点设保护权重，几乎不动：
   - 边界和轮廓（相邻面夹角大）上的顶点；
   - 离岛 60 m 以内的顶点；保护权重从 60 m 处的满权重线性降到 220 m 处的 0。

   这样减掉的面集中在 220 m 以外的远处云层。原始法线作为点属性随顶点插值，不重新计算。顶点色是 sRGB 字节，原样保留。
3. **重新编码**（rewrite.py）：DracoPy 16 位编码，用新 GLB 替换原图元的 bufferView。材质、节点名和 UV 全部不变。

## 验证
- 对比图在 docs/b15/cloudsea-90k/cloudsea_before_after_sheet.jpg，用 Blender EEVEE 近似，不是 Cocos 着色器，共 5 个机位：
  - 气球进场 t=22 s 和 t=34.9 s；
  - 棋盘高位；
  - 岛缘近景俯看；
  - 岛缘看地平线。

  像素平均差 0.12–1.33/255，差值大于 24 的像素占 0–0.59%。
- test_sky_cloudsea PASS（89,989 / 90,000）；test_manifests PASS；lens-clearance PASS。
- run-suite 结果是 147 项里 142 项通过：
  - BLOCKED：navigation-guard 需要浏览器，另有两项要求 Node ≥22.6；
  - FAIL：region-nodes-data 在本机缺 Blender fixture，属于环境问题，与本次改动无关。
- 需要在 Mac 上用 Creator 3.8.8 重新导入一次。.meta 的 UUID 不变，只把 triangleCount 改成 4259。然后真机看一遍气球进场。
