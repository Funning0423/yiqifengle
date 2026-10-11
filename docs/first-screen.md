# 启动首屏（first-screen）+ 场景加载层接手（GGbot）

Funning 已定：启动时**完全不出现 Cocos 标志**，只出我们的加载页；Cocos 授权问题由 Funning 自己处理。

## 1. 文件
| 文件 | 字节 | 进主包 | 说明 |
|---|---|---|---|
| `creator-build-project/build-templates/wechatgame/first-screen.js` | 10302 | 是（覆盖构建生成的同名文件） | 自定义首屏，纯 ES5 |
| `creator-build-project/build-templates/wechatgame/startup-art/first_screen_composite.jpg` | 58,207 | 是 | 棋盘UI美术bot 首帧合成图（运镜bot `loading_base_final_fs50k.jpg` + 标志 + 标题 + **空**进度条底轨），750×1624，sha256 `189508bc…fb6a` |
| `…/startup-art/bar_fill.png` | 2,870 | 是 | 进度飘带填充（场景加载层用） |
| `…/startup-art/pinwheel.png` | 1,563 | 是 | 风车（场景加载层用） |
| `creator-build-project/build-templates/web-desktop/startup-art/*` | 同上 | 否（只在 web 预览构建） | web 预览没有 first-screen，加载层用 loadRemote 读同一组文件 |
| `assets/scripts/ui/StartupLoadingLayout.ts` | — | 脚本 | 纯逻辑：铺满变换、元素坐标、进度跟随、淡入/淡出时间线 |
| `assets/scripts/ui/StartupLoadingLayer.ts` | — | 脚本 | 场景加载层节点（cc） |
| `assets/scripts/WorldIntegrationBoot.ts` | — | 脚本 | 改用上面的加载层；ready 后淡出 |

为什么首屏和加载层用**同一张合成图**：交接帧逐像素一致（同文件、同变换、同 LINEAR/CLAMP 采样），而且主包只多一份图。原方案（加载层用 `loading_base_final.jpg` + 标志/标题/底轨切图）会让主包再多约 62 KB（37,025 + 18,640 + 4,313 + 1,861 B），交接帧也只能做到“压缩噪声级”一致。代价：加载层底图是 q80 的 fs50k 版，比 q85 的 final 稍软；要换回切图方案只改 `StartupLoadingLayer`。

## 2. Cocos 3.8.8 微信模板怎么画首屏、game.js 怎么交接
- 模板 `templates/wechatgame/first-screen.ejs`（引擎仓库 v3.8.8）：自己 `canvas.getContext('webgl'|'webgl2')`，每个 rAF 画背景 / logo / slogan / 进度条；`useLogo/useDefaultLogo/logoName` 由构建设置渲染进去，默认 logo = Cocos 标志 + slogan。
- 生成的 `game.js`（`game.ejs`）：`firstScreen.start(alpha, antialias, useWebgl2)` → `System.import(application)` → `setProgress(0.2/0.4/0.6)` → `application.init(cc)` → `firstScreen.end().then(() => application.start())`。
- 微信上引擎**不跑**自己的 SplashScreen：`cocos/game/game.ts` 里 `if (WECHAT) return Promise.resolve([])`、`_updateCallback` 里 `!WECHAT && SplashScreen.instance`。所以微信上“启动画面” = first-screen.js 画的东西，别处不会再出 Cocos 标志。
- 构建模板：`build-templates/wechatgame/` 下的文件在构建**最后**一步拷到输出目录（官方文档“自定义构建模版”），所以我们的 `first-screen.js` 覆盖生成的那份；`first-screen.ejs` 不是微信的特殊模板文件，不要用。

## 3. 交接顺序（没有闪）
1. 微信启动页消失 → `start()`：清屏为合成图平均色 `rgb(217,210,196)`，合成图（主包本地文件，几毫秒）解码后每帧画一张铺满的四边形。`start()` 等合成图和两张小图都到（失败也 resolve，模板原版会 reject 导致游戏起不来）。
2. `setProgress()` 只等下一帧，**进度条保持空**（加载层接手时飘带从起点开始，不会倒退）。
3. `end()`：再画一帧 → 停 rAF → 删 program/buffer/texture、关 attrib、解绑（给引擎的 GL 状态缓存留默认状态）。画面停在最后一帧（headless Chrome WebGL 实测 end() 后截图与 end() 前完全一样）。
4. 引擎加载启动场景期间 director 还没 startAnimation，不渲染 → 屏幕一直是首屏最后一帧。
5. 场景第一帧：`WorldIntegrationBoot.start()` → `StartupLoadingLayer` 直接用 `globalThis.__firstScreen.images` 里**已解码**的图建 SpriteFrame（同步，无异步加载缺口），按同一 `s = max(W/750, H/1624)` 居中铺满；填充/风车/提示字所在的 `LoadingDynamic` 透明度 0 → 第一帧与首屏相同。
6. 之后 0.25 s 内 `LoadingDynamic` smoothstep 淡入（每帧最多 +25/255）。进度只跟真实阶段走：海岛预制体到 → 1/3，角色+动画元数据到 → 2/3，房间挂好 → 1；显示值指数跟随（τ 0.18 s），不会倒退。提示字：风从海上来…… / 她在窗前坐下…… / 灯塔小屋准备好了；失败时显示“世界加载失败，点这里重试”，点提示字重试。
7. ready：加载层移到画布最上层；startOutro 后第一帧保持不透明（房间第一次绘制、着色器预热的长帧落在完整加载层下面，不吃掉淡出时间），之后 0.7 s ease-out 淡出（房间已在后面渲染）。插画用 UIOpacity，奶油色遮罩是 Graphics——Graphics 用顶点色、2D 合批不乘 UIOpacity（第 5 轮实测：遮罩一直不透明，先平涂奶油色约 0.4 s 再硬切），所以遮罩每帧用同一透明度的 fillColor 重画，与插画同曲线降到 0；遮罩节点上没有 UIOpacity。淡出期间房间的“向左轻拖”提示和滑动、岛上点灯塔都不可用（`!loadingLayer.fading`）；淡完 `active=false`，释放首屏交接的图片引用。
8. 没有交接（web 预览 / 首屏失败）：加载层用 `assetManager.loadRemote` 读同一组 `startup-art/*`，读到之前显示奶油色（合成图平均色），不再是原来的深青 #123233。
9. 进度飘带是 FILLED Sprite：引擎 `bar-filled.ts` 的 `updateUVs` 直接读 `spriteFrame.width` 不判空，而 FILLED 状态下设 `fillStart/fillRange` 就会调它（第 5 轮实测：构造函数里先设填充参数再赋图 → TypeError，`WorldIntegrationBoot.start()` 中断，卡在首屏）。所以飘带只有在拿到 spriteFrame 之后才切成 FILLED、才设填充参数（`StartupLoadingLayer.syncFill`）；图没到（loadRemote 中或失败）时保持 SIMPLE、不画。

## 4. 已知限制
- 4:3（iPad 竖屏）按铺满规则会把设计图上下各裁 312 px：标志（295–385）、提示字（1341–1381）、风车下沿会被裁；标题和进度底轨在。16:9、18:9、19.5:9、20:9 全部在画面内。要不要给宽屏改规则，需要美术/PM 决定。
- 构建输出里可能仍有构建设置生成的 `logo.png`（现在是 `tools/branding/game-title-temporary.png`，自定义标题图，不是 Cocos 标志），首屏不再引用它；`tools/verify_native_loading.py` 会列出这类残留文件。`builder.json` / `tools/wechat-*-build-options.json` 的 splash 设置没改。
- `resources/ui/loading-reference.jpg`（电影截图）不再被加载，但文件还在 resources 分包里，删除涉及多个 scope JSON，另开一项。

## 5. 测试
- `node tools/first-screen/test_first_screen.cjs`：vm 里按 game.js 顺序跑真 first-screen.js（假 WebGL 记录），布局一致性（16:9/19.5:9/20:9/18:9/4:3），加载层交接/淡入/淡出（cc 桩），Boot 集成，ES5 语法，无 Cocos 标志引用。桩里的 Sprite 按引擎 sprite.ts + bar-filled.ts 的调用顺序写（FILLED + 无图时设 fillStart 抛同样的 TypeError）：G 节验证交接/晚到/加载失败三种情况都不会在无图时设填充参数；H 节验证出场时遮罩 alpha 首帧保持 255、之后单调降到 0 并与插画同曲线。
- `node tools/first-screen/render_first_screen.cjs <dir>` + `python3 tools/first-screen/compare_renders.py <dir>`：headless Chrome（SwiftShader WebGL）跑真 first-screen.js 截图，和按同一布局用 2D canvas 画的加载层接手帧比（不是 Cocos 渲染）。
- 构建后：`python3 tools/verify_native_loading.py <微信构建目录>`：first-screen.js 必须与模板逐字节一致，startup-art 在主包。
