# DevTools「simulator launch failed」可能原因清单 v1（grokbot-2/ggbot，在拿到 Oi 的完整报错之前先列）

前提：E1 和 E2 的产物都能在 DevTools 里启动（E2 是到 JS 报错才停下）。这一版新增的变化只有两处：**main、resources、region_island 都变成了分包**，以及**debug=false 的压缩构建**。所以先按「分包结构」去查。
说明：Creator 3.8.8 的 wechatgame 模板在安装包里是加密的，本机读不到原文。下面的「应当如此」来自微信和 Cocos 的官方文档，以及 E1 产物（能启动）的结构，不是逐字节对比模板得来的。

| # | 可能原因 | 怎么看（只读） | 判断 |
|---|---|---|---|
| 1 | 某个分包目录下没有入口 `game.js` | `ls subpackages/*/game.js`；game.json 里每一项的 `root` 都要以 `/` 结尾，并且对应目录真实存在 | 微信要求「目录根下的 game.js 作为入口」。缺了就编译失败，可能性最高 |
| 2 | game.json 的 `subpackages` 里 name 或 root 重复，或者 root 指向 `assets/...` 而不是 `subpackages/...` | 直接看 game.json | 0001c 原写法和 overwrite 写法叠在一起时，有可能生成冲突的条目 |
| 3 | DevTools 的项目缓存或自定义编译条件过期 | E2 截图里已经有「app.json 中未定义自定义编译中指定的启动页面」。查看 `project.private.config.json` 里的 `condition` 或编译模式 | 同一个 appid、同一个路径反复导入不同的产物时很常见。建议把新产物导入到**新的目录名**，而不是清缓存 |
| 4 | project.config.json 和小游戏模板不一致 | `compileType` 应为 `"game"`；不应出现 `miniprogramRoot`（小游戏的根就是产物目录本身）；`appid` 应为 wx3bdd911c5c06f591；`libVersion` 不能低于 2.1.0（分包要求） | 和 E1 的 project.config.json（471 字节）比 diff 就知道了 |
| 5 | 调试基础库版本太低 | DevTools 的 详情 → 本地设置 → 调试基础库。微信要求分包 ≥ 2.1.0，wasm ≥ 2.12.0 | E2 截图里是 lib 3.17.3，可能性低 |
| 6 | 文件名或路径不合法 | 用 `find subpackages -name '*[^A-Za-z0-9._@/-]*'` 查特殊字符 | GLB 拆出来的文件名带 `@`，但 E1 在 assets/ 下也有这种文件并且正常，所以可能性低 |
| 7 | 主包或分包的体积统计和本地不一致（DevTools 按压缩后的口径计算） | 编译面板 →「代码包大小」 | 本地主包 1.8 MB、总包 12.6 MB，离 4M 和 30M 都有余量，可能性低 |
| 8 | main bundle 做成分包以后，首场景加载前没有先 `loadSubpackage('main')` | 看控制台有没有 `loadSubpackage` 或 `subpackage not found` | 这一项属于运行时报错，一般不会表现为 simulator 起不来。只有前 1 到 4 项都排除了才考虑 |
| 9 | 引擎裁剪掉了某个 adapter 依赖的模块 | 看控制台第一条红字是不是 `xxx is not defined` 或 `undefined module` | 0001b 裁剪后，Oi 的词法检查已经通过；而且这类问题通常是运行时报错，不是 simulator 起不来 |

**需要 Oi 提供（放到 to_grokbot）**：DevTools 控制台和编译面板的完整报错原文、game.json、project.config.json、project.private.config.json（如果有）、`ls -R subpackages | head -100` 的输出，还有 E1 那份 project.config.json 用来对比。
拿到以后我按上面的顺序逐项核对。能用改配置解决的出 0001e；如果是 DevTools 本身的问题，就写成操作步骤交给 Oi，不改工程。
