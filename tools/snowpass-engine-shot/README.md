# 驿站雪坪 最小棋盘 — 引擎出图（Cocos 3.8.8 web-mobile + headless Chrome）

沿用 sail-voyage 抓帧的做法（web 预览 + 查询参数 + 只截 canvas），渲染器是 Cocos 3.8.8 引擎本身，不是 Blender。

内容（全部运行时生成，不改任何资源）：
- region_snowpass 的 SP_snowpass 预制体作为场景；
- 台阶脚下 (x=0, z=6.5) 一块 8.6 m 雪垫 + 7×7 石板（1 m 格，板缝即格子，R3）+ 四边路缘石；
- 6 种棋子用 board_art 的正式贴图，立牌朝向相机，开 alpha test 投真实阴影 + 接触阴影斑；
- 低角度侧光（太阳 euler -38/-62，65000 lux，PCF 软阴影）。
- `aid=blueberry,flower,shell`：给这些棋子加 5 px 深靛描边 + 0.31 m 板岩底座。
- `nopieces=1`：遮棋版（R6），也用于对比度计算的差分掩膜。

## 本机（Linux）复现
1. 解出一个 web-mobile 构建（本次用 /workspace/f8/web-test，内含 region_snowpass、board_art、shared_effects），复制一份；
2. 打上 `index.js.patch`、`application.js.patch`（`?snowshot=1` 时不加载启动场景，启动后注入 snowshot.js），把 snowshot.js 放到根目录；
3. `python3 -m http.server 8765 -d <copy>`；`npm i playwright-core`；
4. `node cap.cjs "http://localhost:8765/index.html?snowshot=1[&aid=...][&nopieces=1]" s_<name>.png 390 844`
5. `python3 contrast.py <name>`（需要同目录有 s_nopieces.png），输出相对亮度和 WCAG 对比度。

## Mac 上（WeChat DevTools / Creator 预览）
用当前分支出 web-mobile 构建后执行同样第 2–5 步即可；或在 Creator 预览 URL 后加 `?snowshot=1`，把 snowshot.js 在控制台执行一次（需要 `window.cc`：在控制台先 `cc = await System.import('cc')`）。DevTools 设备 390×844、DPR 1，只截 canvas。
