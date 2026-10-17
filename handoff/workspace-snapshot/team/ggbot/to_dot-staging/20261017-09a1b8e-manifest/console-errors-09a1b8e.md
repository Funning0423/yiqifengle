# 09a1b8e 游戏日志开头的 console 报错：来源与计数口径

GGbot，2026-10-17 03:20 EDT。只读分析，没有改任何游戏代码。

## 结论
**两类报错都是本地 web 测试环境造成的。对微信玩家没有影响，可以忽略。**

## 1. 报错清单（4 次录制，共 13 条，全是 `console.error`，没有 pageerror）
| 录制 | 404 (File not found) | ERR_CONNECTION_RESET |
|---|---|---|
| 白天 ib_day_390 | 2 次（0.183 s、7.423 s） | 3 次（0.626 s ×2、0.676 s） |
| 夜间 ib_night_390 | 2 次（0.151 s、7.385 s） | 1 次（0.685 s） |
| 切后台 1 vis3000 | 2 次（0.158 s、7.398 s） | 0 次 |
| 切后台 2 vis18000 | 2 次（0.156 s、9.264 s） | 1 次（0.746 s） |

`Failed to load resource` 这条报错是 Chrome 打出来的，**不带 URL**。录制脚本也没有记录请求 URL，所以 URL 是靠下面的证据推出来的。

## 2. 404 = `/favicon.ico`（证据充分）
**是什么**
- 「File not found」是 Python `http.server` 特有的 404 文案，说明请求打到了验收用的本地静态服务器。
- 同一套录制流程的服务器访问日志（`ui-audit/2026-10-16/readme-v2-a3/logs/srv8790.log`，385 个请求）里，**404 只有两条，都是 `GET /favicon.ico`**：
  - 一条在页面刚打开时；
  - 一条在约 6 秒后，正好是第一次点击、音频解锁的时候。
- 09a1b8e 每次录制都是这个节奏：开头一条，第一次手势后约 0.03 s 再一条（7.39 s 点牌子 → 7.42 s 404；vis18000 是 9.23 s → 9.26 s）。两边完全吻合。
- 09a1b8e 这次的服务器日志没有留下来。

**谁请求的**
- 浏览器自己。web-test 用的是 web-mobile 默认模板，产物里没有 favicon.ico，Chrome 默认会去请求 `/favicon.ico`。
- 我们自定义的 web-desktop 模板（`build-templates/web-desktop/index.ejs:21`）也写了 `<link rel="icon" href="favicon.ico">`，但 web-test 构建不用这个模板。
- 第一次手势后 Chrome 为什么又请求一次，我没有查到确切原因，但不是游戏代码发起的。
- 我在 09a1b8e 的 `assets/**/*.ts` 和 build-templates 里搜过：没有 fetch、XMLHttpRequest、sendBeacon、WebSocket、wx.request，也没有改 document.title 或 history。

**影响**
- 微信小游戏没有 HTML 页面，不存在 favicon，所以**对玩家零影响**。
- 本地 web 测试里也无害。

## 3. ERR_CONNECTION_RESET（推断，可信度中等）
**什么时候出现**
- 只在开头 0.6–0.75 s 出现，正好是首场景加载完后第一批并发请求最多的时候。那时有 30 多个 mp3 和分包 config/import 文件同时请求，`wind-loaded`、`waves-loaded` 也在这一刻。
- 每次录制 0–3 次不等，像是随机的竞争，不像是哪个文件固定出问题。

**最可能的原因**
- `python3 -m http.server` 用 HTTP/1.0，每个请求都要新开一条连接，而且 listen 队列只有 5（socketserver 默认 `request_queue_size=5`）。
- macOS 上，瞬间并发连接把队列挤满时，新连接会被直接 RST。
- **这一点没有在 Mac 上复现过**，属于推断。

**为什么判断无害**
- 4 次录制里，所有游戏资源都加载成功了：每次都有 4 条 `*-loaded`，没有 `waves-load-failed`、`gull L/R load failed`，也没有 Cocos 的 download failed。整流程也全部通过。
- 说明被重置的请求都被重试成功了，Cocos 的 downloader 本身带重试。
- 这个现象在很多版本里都出现过，和 09a1b8e 的改动无关。例如：
  - build05-v3-764dcd8 有 5 次；
  - final-mac2-379e137、a3b-a17395c、readme-v2-a3 也都有。

**谁请求的**：Cocos 引擎的资源下载器（我们只调用了 `resources.load`），由本地测试服务器的连接上限触发。

**影响**：微信上资源从本地包或分包读取（`mainBundleIsRemote:false`），不走这个 HTTP 服务器，所以**对玩家零影响**。

**怎么验证**（可选，要在 Mac 上做）：
- 录制时加上 `page.on('requestfailed')`，记下 URL 和 errorText；
- 或者换一个 listen 队列更大、支持 keep-alive 的静态服务器重录一遍，看重置是否消失。

## 4. 界面验收部原来是怎么计数的（rec10.cjs 第 14 行）
脚本来自 `ui-audit/2026-10-16/fixes-511953e/logs/rec10.cjs`。09a1b8e 报错栈里的 `rec10.cjs:16`、`:20` 两个行号和它吻合。
- `pageerror`：`p.on('pageerror')`，只统计未捕获的 JS 异常 → 0。
- `HTTP≥400`：`p.on('response')` 里 status≥400 的响应 → 0。
  - favicon 是浏览器层面发起的请求，Playwright 的 page 事件收不到，所以那两条 404 根本没被统计。
  - RESET 没有响应，`response` 事件不会触发，也没统计。
- `console.error`：写进了 worldFlowLog，**但没有计数**。
- 所以「pageerror 0、HTTP≥400 0」本身没错，只是口径不完整：有 13 条 console.error 没有统计到。
- 另外，每次录制结束都有 `Target page … has been closed`。这是脚本自己的问题：监视循环在关闭页面后还在 sleep。这不是游戏错误，也不该算进 pageerror。

## 5. 以后统一的计数口径（提议）
每次录制分 5 个桶报告，**每个桶都列出 URL 或消息，并单独写明命中豁免的条数**：

| 桶 | 怎么采集 | 记录内容 |
|---|---|---|
| A. pageerror | `page.on('pageerror')` | 消息，必须为 0 |
| B. console.error | `page.on('console')` 中 type=error | 按消息去重计数。其中 "Failed to load resource" 只是网络错误在控制台的回显，归到 C/D，不重复计 |
| C. HTTP≥400 | `page.on('response')` **加上** 服务器访问日志（这样能补上 favicon 这类浏览器发起的请求） | 按 URL 列出，带状态码 |
| D. 网络失败 | `page.on('requestfailed')` | URL 和 errorText（RESET/ABORTED…），并注明同一 URL 后来有没有 200 |
| E. 测试脚本错误 | 脚本自己的异常 | 单独列出，不算游戏问题 |

**已知无害豁免名单**（只适用于本地 web-test 和 Python http.server，微信构建不适用）：
1. `GET /favicon.ico` 404；
2. 前 2 s 内的 `ERR_CONNECTION_RESET` 或 `ERR_ABORTED`：要求同一 URL 之后返回 200，或者游戏日志里没有任何 load-failed 或 download failed。

不在名单上的一律算问题。

**报告写法示例**：`pageerror 0 | console.error 13（豁免 13）| HTTP≥400 2（/favicon.ico×2，豁免）| requestfailed 3（RESET，豁免）| 脚本错误 1（页面关闭后循环未退出）`

**可选的环境改进**（不动游戏代码，由验收部决定）：
- 测试服务器加大 listen 队列，或者换成支持 keep-alive 的静态服务器；
- 服务器访问日志随录制一起保存。
