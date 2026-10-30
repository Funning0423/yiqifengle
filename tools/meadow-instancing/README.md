# 草花实例化 方案 R 原型（加载时 CPU 展开）— b19

只读 env_meadow.glb，不改任何资源/颜色/贴图；不接入游戏（等草地 B+D+E 合并后在合并后的 glb 上重新 bake）。

- `bake.py <env_meadow.glb> <out.qfi>`：8 个 *_instances 网格 → 模板 + 每实例相似变换（t,q,s）+ 每实例 uv 偏移 + 草逐顶点 COLOR_0 u8。19bd812a 上 raw 299,996 B / deflate-9 117,127 B。
- `verify.cjs <glb> <qfi>`：node 下展开并逐属性对照原 glb：位置 ≤3.8e-6 m，法线 ≤3.2e-7，uv ≤1.9e-6，索引完全一致，COLOR_0 ≤0.5/255（u8 量化）。
- `expand.js`：expandQfi(buf[,meshIndex]) + interleaveQfiMesh(m,gfx) → cc.Mesh.reset({struct,data})。
- `instproto.js` + `run-measure.cjs`：注入 web-mobile 构建（index.js 的 `?inj=` 钩子，见 tools/snowpass-engine-shot），headless Chrome（swiftshader）+ CDP CPU 降速 1×/4×/6×，测展开 + 建网格耗时与 JS 堆峰值。
- 结果：measure_*.txt（见 product/2026-10-29/expansion/PLAN3.md §4）。

## v2：分块存储 + 分块展开（b19 硬要求：每帧 解压+展开 ≤4 ms 手机）
- `bake2.py <glb> <out.qfi2> [CHUNK_V=1024]`：每个网格 = 模板段 + 若干实例块，每块 ≤CHUNK_V 个展开顶点（按整实例切）。
  数据**不压缩**存进分包（出货 zip / http gzip 负责压缩），运行时 0 解压；每块是独立的连续段。
- `expand2.js`：qfi2Open(buf).begin(mesh, layout) → 每帧 chunk(i) → finish() 得到与原网格同布局的交错缓冲，一次 Mesh.reset。没有中间数组；最终缓冲 = 今天解压后的网格数据大小。
- `chunktime.cjs <glb> <qfi2> [手机系数]`：逐属性校验 + 每块中位耗时 × 手机系数。
- `inst2shot.js` + `run2.cjs`：web 构建里同一页面先渲原 glb 网格（A），再换成 qfi2 展开结果（B），game.pause + dt=0 同帧截图；也记录浏览器内逐块耗时。
- 布局目前在运行时取自原网格 struct；正式版删掉原网格后，布局要在 bake 时从 Cocos 导入结果写进 qfi2 头。

## v3 (qfi3)
Per mesh: template zlib + chunks each zlib9 (ramp CV/8,CV/4,CV/2 then 1024 verts); zlib JSON header.
Inflate via cc.utils.MeshUtils.inflateMesh. 133,456 B (build bytes). DC delta 0.
Tools: bake3.py expand3.js chunktime3.cjs gate3.js run3.cjs.

### expand3 v2
Per-attribute monomorphic passes, numeric attr kinds, no per-vertex string compares; node steady-state ~35% faster (grass.2 total 4.98→3.18 ms box). Output identical (verify maxErr unchanged).
