# E8：测试脚本去掉写死路径（GGbot，2026-10-09）

补丁：`patches/e8/0001-E8-tool-paths-from-env-via-tools-qf-env.cjs-GGbot.patch`，工作副本是 `work/ggbot-e8-tools/tools/`（从 5b449fa 包里复制出来，原包没动）。改了 29 个文件，并新增 `tools/qf-env.cjs`。

## 改了什么
原来写死的 Mac 路径一共有四类，全部改为通过 `tools/qf-env.cjs` 读取环境变量：

| 环境变量 | 替代原来的 | 默认 |
|---|---|---|
| `QF_PLAYWRIGHT_MODULE` | `/opt/homebrew/lib/node_modules/playwright`（25 处，另有 1 处 package.json） | 先按 Node 正常方式解析 `playwright`，找不到再去 npm 全局目录找 |
| `QF_CHROMIUM_EXECUTABLE` | `/Users/<mac-user>/Library/Caches/ms-playwright/…/Google Chrome for Testing`（25 处） | 不设置时用 Playwright 自带的浏览器 |
| `QF_TYPESCRIPT_MODULE` | CocosCreator.app 里带的 typescript（2 处） | 先正常解析 `typescript`，再找全局目录 |
| `QF_BABEL_NODE_MODULES` | CocosCreator.app 引擎目录下的 node_modules（`compile_r4_compat.cjs`） | 正常解析 `@babel/core` |
| `QF_LEGACY_PROGRESSION_JS` | `/Users/<mac-user>/Documents/Codex/…/progression.js` | 没有默认值，不设置就报错并说明要设什么 |

Mac 上把这些变量设成原来的路径，行为就和以前一样。要求输出哈希和 Mac 一致的步骤（compile_r4_compat），请指向 Creator 3.8.8 自带的 babel 和 typescript。

端口（127.0.0.1:8765–8773）、`evidence/`、`output/` 这些相对路径都没改，仍然要在包的根目录下运行。

## 在 Linux（这台电脑）上的验证
- 全部 .cjs 都通过了 `node --check`；全部脚本里已经找不到 `/Users/`、`/opt/homebrew` 和 `CocosCreator.app` 路径。
- `qf-env.cjs` 在 Linux 上能加载 playwright 1.64.0，启动 Playwright 自带的 Chromium 156 也正常（已通过）。
- `check_persistence_local.cjs`（纯 Node，不需要构建）在 Linux 上能运行起来，路径相关的报错已经消失。但它停在一条测试自身的断言上：`Unexpected ./MainlineHost`，意思是测试里允许导入的模块清单里没有 `./MainlineHost`，看起来像是测试落后于代码，和平台无关。需要 Oi 确认这条在 Mac 上 5b449fa 能不能过。
- 依赖浏览器的回归测试（E7 主线 190 加 R5 100）需要先有 Cocos 的 web 构建产物，还没跑（not_run）。等这台电脑能构建以后再跑。

## Linux 安装
`npm i playwright typescript`，再执行 `npx playwright install chromium`。系统依赖用 `--with-deps` 安装时，这台电脑的 apt 源报签名错误，没装成，但不影响 headless 运行。
