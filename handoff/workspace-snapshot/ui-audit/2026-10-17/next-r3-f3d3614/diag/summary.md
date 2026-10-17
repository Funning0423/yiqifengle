# r3 湖畔诊断（调试构建，?lakediag=1）

- 运行时间：2026-10-17 05:06–05:08 EDT。r3 正式构建和 runall（含 rec10 全流程）全部跑完后才执行，没有打断。
- 提交：10a78208412ca31b0903c7865feccefe9136f4bd（Voice Bot 分支 voice/build05-lakeside-water-fix-r3 的提交 D）
  - 父提交 f3d3614 ✔，tree 832770215b5e ✔
  - 只改了 3 个文件：LakesideBoardBackground.ts +14、run-suite.cjs、test_lakeside_diag.cjs
  - 只检出了 D，**没有**叠 f492dc1，也**没有**叠 803b59c
- bundle：team/voice-bot/outbox/20261017T084601Z-lakeside-water-fix-r3/lakeside-water-fix-r3.bundle
  - sha256 d5555d64…54ae2 ✔，与 SHA256SUMS 一致
  - 头指向 f492dc1，是取了 10a7820 单独检出
  - 另注：ggbot 的 outbox/20261017T084522Z-r3-diag 里是 385a934（a47c8fe 叠在 f3d3614 上），内容与 D 相同，没有用它
- 调试构建：web-mobile，debug:true，配置 web-debug.json 放在仓库外；一次构建通过，git 状态干净
  - 产物 24,666,348 B，615 个文件，聚合 SHA256 aa23ab3d815936c52593928b1363e74f63a8f8eb5b56d4472b9f2475efaa4212（files-web-debug.sha256）
  - 门控代码实际为 `DEBUG && ?lakediag=1`（Voice Bot README 写的是 `?qfLakeDiag=1`，与代码不一致，以代码为准）
- 跑法：390x844，白天；真实点击进入湖畔棋盘，点掉教程 GotIt；URL 为 /?lakediag=1；服务器 127.0.0.1:8898（ThreadingHTTPServer）

## [QF_LAKE_DIAG] 原文（只打印 1 次，t=67.087 s，在进入棋盘、应用主光时）
```
[QF_LAKE_DIAG] {"isHDR":true,"toneMappingType":0,"pipeline":"WebPipeline","usePostProcess":false,"aperture":19,"shutter":7,"iso":0,"mainLightIlluminance":87500,"skyIllum":61250,"missing":["exposure"]}
```
- isHDR=true；toneMappingType=0（Cocos 的 DEFAULT，即 ACES）；管线 WebPipeline；usePostProcess=false
- 曝光相关：aperture=19、shutter=7、iso=0 是 Cocos 的枚举下标，对应 F16、1/125、ISO100；exposure 字段未定义
- 主光照度 87500；skyIllum 61250
- 未定义字段：exposure（camera.camera.exposure 返回 undefined，所以 JSON 里没有这个键）
- 没有 [QF_LAKE_DIAG] 的 console.error（没有 diag-failed）

## 五类错误
- A pageerror：0
- B console.error：0
- C HTTP≥400：/favicon.ico 404 ×2，在白名单内
- D 网络失败：0（ERR_CONNECTION_RESET 0）
- E 脚本错误：0
- 共 495 个请求

## 棋盘性能（调试包，仅供参考）
- DC 中位 34、峰值 42；FPS 48.9（调试包加上录屏）

## 清理
- 已删除 Mac 上的 web-debug 产物（25.7 MB）、录屏和 PNG。仓库已切回 r3 分支
