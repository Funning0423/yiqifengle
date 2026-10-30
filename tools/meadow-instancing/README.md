# 草花实例化 方案 R 原型（加载时 CPU 展开）— b19

只读 env_meadow.glb，不改任何资源/颜色/贴图；不接入游戏（等草地 B+D+E 合并后在合并后的 glb 上重新 bake）。

- `bake.py <env_meadow.glb> <out.qfi>`：8 个 *_instances 网格 → 模板 + 每实例相似变换（t,q,s）+ 每实例 uv 偏移 + 草逐顶点 COLOR_0 u8。19bd812a 上 raw 299,996 B / deflate-9 117,127 B。
- `verify.cjs <glb> <qfi>`：node 下展开并逐属性对照原 glb：位置 ≤3.8e-6 m，法线 ≤3.2e-7，uv ≤1.9e-6，索引完全一致，COLOR_0 ≤0.5/255（u8 量化）。
- `expand.js`：expandQfi(buf[,meshIndex]) + interleaveQfiMesh(m,gfx) → cc.Mesh.reset({struct,data})。
- `instproto.js` + `run-measure.cjs`：注入 web-mobile 构建（index.js 的 `?inj=` 钩子，见 tools/snowpass-engine-shot），headless Chrome（swiftshader）+ CDP CPU 降速 1×/4×/6×，测展开 + 建网格耗时与 JS 堆峰值。
- 结果：measure_*.txt（见 product/2026-10-29/expansion/PLAN3.md §4）。
