# 《咦，起风了》人物与凳子模型快照

版本：2026-10-16，BODY09 + v44-cold5 最新站立静态候选，凳子 actual-stool-v2。

## 直接查看

- `character-body09-v44-cold5-static-candidate.glb`：完整人物静态 GLB，原材质、嵌入贴图、原拓扑保留。
- `stool-actual-v2.glb`：完整凳子 GLB，保持原内部节点变换。
- `preview/export-front-side-back.png`：直接读取本次导出的两个 GLB 渲染的正/侧/背面。
- `placement.json`：两件资产共同坐标系内的准确摆放矩阵。人物使用单位矩阵；凳子须额外应用文件中列主序 outer matrix。单位米、Y 向上。

这是站立静态参考，不是新坐姿或动画成品。凳子处于原静态参考中的位置；正面投影重叠不表示人物正在坐下。不要把凳子再次下移 0.0549 米。

## 版本与验证边界

人物 BODY09：`14acc74e49a22b51bc8bbeaba43bf29f574d26fadf7bd0959fb8645f3d8a3ec4`。服装 v44-cold5：`839bc8fc42e518720059f550e96366ad53ce666f23739f29cdc8d82db1aa4aae`，来自 complete-diagnostic-01；complete-endpoint-01 是其精确静态端点审计。DRESS/APRON 共 6,411 渲染顶点、11,800 面。

身体采用冻结 BODY09；其余几何沿用 candidate08 姿态。无重拓扑、无手部压平、无未经批准的 238 扩范围腕部实验。源骨架节点和 skin 定义仅保留为脱离场景的参考；静态网格没有 skin 绑定。旧动画已从展示 GLB 移除，不能直接套用。

原始浮点64静态衣物接触审计通过，不代表本次浮点32 GLB 自动获得同样的精确认证。最大坐标舍入误差约 0.000060 毫米。手腕动作、BOW、动态服装、坐下/保持/起身/行走、原生引擎与完整人物最终验收均未通过或未验证。失败动态数据未打包。

凳子 actual-stool-v2 SHA256：`cadb9b3f16cb9079504d999e31b40c91106e75323ca1e14e2474bd394365630b`，73,156 字节；不能据此宣称完整人物与凳子联合验收通过。

## 复现

需要 Python 3 和 NumPy。在本目录运行：

    python export/export_static.py --output-dir reproduced

输出目录不得已有同名 GLB。`sources/` 仅含复现必需的原始人物 GLB、BODY09、v44 衣物和 candidate08 姿态。`sources/original-character.glb` 是旧版基线与材质来源，不是最新人物；其原动画不得用作本静态候选的完成证明。导出器先验证输入完整 SHA256，保留材质、贴图、UV/颜色和原面索引，更新静态顶点与法线。

`export-verification.json` 列出源哈希、逐 primitive 数量、舍入误差及视觉检查。`SHA256SUMS` 用于校验所有公开交付文件。
