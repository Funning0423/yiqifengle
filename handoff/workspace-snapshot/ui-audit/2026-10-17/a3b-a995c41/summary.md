# a995c41 验收（integration/build05-a3b-20261017T063646Z）—— 通过

## 来源核对
- 完整 bundle（readme-v2.1）sha256 5d4ed05d…c2e2 ✔（2MB×66 片 sha1 全对）；clone 09a1b8e / tree 082f1c0e ✔
- A3b bundle ccd0e88f…0303 ✔（与 SHA256SUMS 一致）；HEAD a995c4158ff4… / tree f359fb23… ✔；status 干净

## 包体（守护脚本 both，一次过，未改写 .meta）
- **wechat-release 19,126,549 B**：比 09a1b8e（19,125,680）+869 B，和 a17395c 单独实测完全相同（预估 300–500 B 偏低）；距安全线 24,641,536 还有 5,514,987 B
- main 1,176,922；其余分包与 09a1b8e 相同。web-test 19,867,982 B
- **产物 SHA256**（逐文件清单 files-*.sha256，整体 = 清单文件的 sha256）：
  - wechat-release 630 个文件：1a0bc327635d42268cfba61cf96abf3493aab39d86c1daf716fc5c40767c357a
  - web-test 610 个文件：f9cce21b5d15bf5dec300f8cd21bf66d90eaad8e45fb3fab89511fee2e7ceaf2

## 草地点「回家」（真实点击，__worldFlowLog）
| | 点下 ±200 ms 峰值 | 满幅样本（≥0.999） | 点击声 − 背景（RMS） | home-duck |
|---|---|---|---|---|
| 白天 | 0.717（−2.9 dBFS） | 0 | +10.1 dB | gain 0.6 ✔ |
| 夜间 | 0.584（−4.7 dBFS） | 0 | +8.9 dB | gain 0.6 ✔ |
- 与 f60c8ec（0.783/0.728，+9.8/+9.6 dB）一致。
- 日志：`{"event":"home-duck","gain":0.6,"s":0.08,"outS":0.4}`。回家时背景声不重启，所以这一刻没有 waves-start，只有 `waves-level vol 0.249 → 0.021 outdoor 0`。
- 其它起播点都是 from:"zero"：`{"event":"waves-start","vol":0.002,"from":"zero"}`（首次出门）、`{"event":"waves-start","vol":0.037,"from":"zero"}`（关卡回岛）。白天、夜间相同。
- 详见 logs/home_analysis.txt。

## 整流程（白天 / 夜间）
- 站起 → 海岛 → 主线 01 用 11 步通关 → 回岛 → 草地 → 回家，全部走通。夜间 nightProp=true。时间线和 f60c8ec 相同。
- 录屏：raw/ib_{day,night}_390.webm；音频：.audio.webm / audio/*.wav

## 错误（五类口径）——白天 / 夜间相同
| 类 | 数量 | 说明 |
|---|---|---|
| A pageerror | 0 | |
| B console.error（去重） | 0 | 另有 2 条 "Failed to load resource" 回显，对应下面 C 的 favicon |
| C HTTP≥400 | 1 个 URL：`/favicon.ico` 404 ×2 | 全部命中白名单（服务器访问日志） |
| D 网络失败 | 0 | **ERR_CONNECTION_RESET 0**（换用 keep-alive 服务器后消失） |
| E 脚本错误 | 0 | 已修复 "Target page … has been closed"：监视循环先停止再关闭页面，两次录制都没再出现 |
- 404 / ERR_CONNECTION_RESET 单列：404 只有 favicon 2 次（白名单），RESET 0。
- 服务器：ThreadingHTTPServer，HTTP/1.1，request_queue_size 256，只绑定 127.0.0.1（logs/srv.py）。访问日志在 logs/srv8899_{day,night}.log，每次 422 个请求。
- 录制脚本 logs/rec10.cjs 新增 requestfailed、2xx 响应和 scriptErr 的记录；统计脚本 errs.py。

桌面包未替换（仍为 09a1b8e）。
