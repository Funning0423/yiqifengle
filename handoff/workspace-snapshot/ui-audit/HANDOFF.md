# 《咦 起风了》界面验收（ui-audit）交接文档

- 撰写：界面验收部，2026-10-17 09:50 EDT
- 范围：/workspace/wechat-game/ui-audit/ 下 2026-10-15 至 2026-10-17 的全部验收资料
- 结论以各轮目录里的 summary.md 为准，本文只做索引
- **r4（2153a65）仍在进行中**，见第 6 节；完成后补充

---

## 1. 验收标准

### 1.1 界面
- 元素不越界、不贴边（含 320×568、375×667 等小屏）
- 图标大、文字小
- 结算宝箱居中
- 按钮有立体感，以主页风格为准
- 夜间可读
- 每轮都给改前/改后对比图

### 1.2 录屏
- 白天和夜间各录一遍整套流程，顺序：加载 → 主页停留至少 10 秒 → 出门 → 岛 → 棋盘 → 结算 → 宝箱 → 返回
- 用真实点击（触屏），打开 `globalThis.__worldFlowLog=true`
- 白天 / 夜间靠浏览器时区切换（当地 12 点 / 23 点），并用日志里的 `props.night` / `nightProp` 确认
- 常用日志标签：[QF_AUDIO]、[QF_SKY]、[QF_LAKE]、[QF_LAKE_DIAG]
- 只用免费工具（Playwright + Chrome for Testing、ffmpeg、Python/numpy/Pillow）

### 1.3 报错统计（A–E 五类）
| 类 | 内容 | 要求 |
|---|---|---|
| A | pageerror | 必须 0 |
| B | console.error，去重后列出 | 「Failed to load resource」回显不单独计 |
| C | HTTP ≥400，按 URL 列出 | |
| D | 网络失败（requestfailed），按 URL 列出，注明之后同 URL 有没有 200 | |
| E | 测试脚本自身的错误 | |

- 白名单只适用于本地 web 构建：
  - `/favicon.ico` 404
  - 开头 2 秒内的 ERR_CONNECTION_RESET / ERR_ABORTED，且同一 URL 后来请求成功
- 测试服务器必须是 ThreadingHTTPServer、HTTP/1.1 keep-alive、request_queue_size 256、只绑定 127.0.0.1（tools/server/srv.py）
- 服务器访问日志和录屏放在一起保存

### 1.4 其他硬指标
- 里程碑构建要记录产物 SHA256：逐文件清单 files-*.sha256，整体值 = 清单文件本身的 sha256
- 音画对齐：以第一次点击或 `[sailboat] sting start` 日志为起点；没有这条日志时，用音轨第一个非静音块对齐，并扣掉 MediaRecorder 的起录延迟
- 切后台再回来的音画偏差 ≤50 ms
- 微信包体门限 **24,641,536 B**（总包，wechat-release）；主包 ≤4 MiB
- 湖畔棋盘整屏 DC **≤60**（合批开），`?lakemerge=off` 的峰值也要报

---

## 2. Mac 验收流程

1. **开工前检查**：确认 Mac 上没有别人在跑 Cocos Creator（`pgrep -fl MacOS/CocosCreator`），记录剩余空间（`df -k ~`）。Mac 磁盘很紧，要求剩余 ≥4 GiB。
2. **传代码**：
   - 在 box 上打 git bundle（必要时连同补丁、脚本打成 tgz）
   - 按 2 MB 分块传到 Mac 的临时目录，每块和整包都做 sha1 校验
   - 再核对交付方给的 bundle SHA256
3. **全新 clone**：
   - 临时目录（例如 `$HOME/qf-audit-tmp`）里全新 clone，或 depth-1 拉取基线后 fetch bundle
   - 所有 remote 的 push 设为 `DISABLED`（`git remote set-url --push <remote> DISABLED`）
   - 核对 HEAD、tree 和交付说明一致，`git status` 为空
   - **不打任何 TEST-ONLY 补丁**，除非交付方明确要求
4. **构建**：
   - `CREATOR=<Creator 3.8.8 可执行文件> bash tools/build-guard/build-wechat-guarded.sh both`
   - Creator 3.8.8 装在项目的 tooling 目录里，不在 /Applications；路径一律用 CREATOR 环境变量传入
   - 守护脚本会检查：包 >15 MB、日志里没有「当前初始场景不存在」、构建后 git status 为空
   - 不满足就恢复 .meta、删 library/temp 后重试
   - Creator 3.8.8 命令行构建大约一半概率导入失败，所以要靠守护脚本重试
   - 构建结束后量 wechat 总包、主包、各分包大小，做逐文件 SHA256
5. **录制**：
   - 用 srv.py 起服务，用 record/ 下的脚本录制
   - 录屏、日志、访问日志按 2 MB 分块传回 box，sha1 校验
6. **不要替换桌面包**：
   - `~/Desktop/QIFENGLE-test-build05` 目前是 09a1b8e 验收后复制的副本
   - 逐文件 SHA256 见 2026-10-17/desktop-pkg-sha256-09a1b8e.txt，整体值 2b6919e9…92f2
   - 有退步的构建一律不换
7. **清理**：
   - 停掉服务和 Chrome for Testing
   - 删掉临时目录里的构建、library/temp、录屏、浏览器 profile、bundle 和压缩包
   - 报告清理前后的剩余空间
   - box 上 /tmp 里的临时文件也要删

---

## 3. 脚本清单（tools/）

- 全部是从各轮目录和工作目录**复制**过来的，原文件没动
- 已去掉写死的个人路径和用户名，改成环境变量：
  - `QF_WORK`：Mac 临时目录，默认 `$HOME/qf-audit-tmp`
  - `CREATOR`：Creator 可执行文件
  - `QF_CHROMIUM_EXECUTABLE`：Chrome for Testing
  - `QF_REPO` 或 `QF_ENV_CJS`：仓库里 tools/qf-env.cjs 的位置，用它取 playwright
- 脚本里没有 token 或密钥

| 文件 | 用途 | 用法 |
|---|---|---|
| server/srv.py | keep-alive 测试服务器（ThreadingHTTPServer，HTTP/1.1，队列 256，仅 127.0.0.1），访问日志写 stderr | `python3 srv.py 8899 <web-test 目录> 2> srv.log` |
| record/rec10.cjs | 整流程录屏（主页 → 玻璃牌出门 → 岛 → 主线 01 → 结算 → 宝箱 → 回岛 → 草地回家）。记 pageerror、console、requestfailed、≥400、脚本错误；已修 "Target page … has been closed" | `node rec10.cjs day\|night` |
| record/rec11.cjs | r4 版整流程，加了宝箱逐帧和切后台 3 s | `node rec11.cjs day\|night` |
| record/lk4.cjs | 湖畔 / 草甸 / 天空之城的旅途和棋盘测量：每帧 DC、内存、相机 FOV、太阳方向；切换帧截取；切后台；故障注入；诊断 | `MODE=day node lk4.cjs day`；环境变量 REGION=lake\|meadow\|sky、URLQ='?lakemerge=off'、VW/VH、CAP=1、BG=3\|10、FAILPAT、QUICK=1、TAG、PORT、PROF |
| record/lk2_r3.cjs | r3 版：关掉弹窗后复测棋盘 DC | `node lk2_r3.cjs day\|night` |
| record/audio-init.js | 初始化脚本：把页面 WebAudio 输出并联到 MediaRecorder（opus 48 kHz）录音 | lk4/rec 自动注入 |
| record/raf-init.js | 初始化脚本：记录每帧 rAF 时间，用来算帧耗时和掉帧 | 同上 |
| record/findwater.cjs | 从 web 包里找 lakeside-water 材质所在的 pack，生成故障注入用的正则 | `node findwater.cjs <web目录> > failpat.txt` |
| build/br4.sh | r4 的 Mac 侧完整流程：检查 Creator 进程 → push=DISABLED → fetch bundle → 守护构建 → 逐文件 SHA256 → 量分包 → 调试构建 → A/B 构建 → 找水材质 | `QF_WORK=… CREATOR=… bash br4.sh` |
| build/b_guard_fallback.sh | 守护构建 + 逐文件 SHA256 + 复制 web 包（a995c41 版） | 同上 |
| build/bdiag.sh | 调试构建（debug:true，配置放在仓库外）+ `?lakediag=1` 诊断跑 | 同上 |
| build/runall4.sh、runall4b.sh | r4 全部跑测编排：每项单独起停 8899 服务，日志按项保存 | `QF_WORK=… QF_CHROMIUM_EXECUTABLE=… bash runall4.sh` |
| build/run.sh | a995c41 白天和夜间整流程编排 | 同上 |
| analysis/errs.py | A–E 五类统计，含白名单判断 | `python3 errs.py <tag>.json <worldFlowLog>.txt <srv.log>` |
| analysis/ana_journey.py、jseg.py | 旅途分段（海岛 / 过桥 / 抵达 / 湖畔）DC 中位和峰值、内存峰值 | `python3 ana_journey.py *_journey_samples.json` |
| analysis/zones_r3.py | r3 的 10 个采样点和条纹 std（参考 r5h3 调色前中位值，data/r5h3_pre_tmed.npy，可用 QF_R5H3_NPY 覆盖） | 见脚本 |
| analysis/vb10.py、zones4.py | r4 重标定的 10 个采样点（Voice Bot targets.json，用 QF_VB_REF 指向 reference 目录），每通道 ±12、ΔE76、条纹 std ≤10 | `python3 vb10.py <bgonly.png>…` |
| analysis/lakecmp.py | 同机位和 r5h3 的分区 RGB 对比（QF_LAKE_REF 指向参考图） | 见脚本 |
| analysis/swap.py、align.py | 落地切换帧：前一帧 / 切换帧 / 后一帧条带图、px>24 差异、顶部边缘对齐位移 | `python3 swap.py <cap_dir> <out>` |
| analysis/ana_home_audio.py、aud.py | 「回家」点击 ±200 ms 峰值、满幅样本、点击 − 背景 RMS；音轨首个非静音块 | 见脚本 |
| analysis/lum.py、motion.py、score.py、measure.py | ffmpeg 抽帧算亮度曲线、运动量、分数位移；截图量尺寸 | 读 raw/*.webm |
| media/flick.sh | A-B-A 闪帧检测 | `flick.sh <视频> <裁切高>` |
| media/sheet.sh、compose.sh | 抽帧拼图；webm 转 mp4，做改前/改后并排视频 | 见脚本 |

---

## 4. 各版本验收结论

### 2026-10-17
| 目录 | 版本 | 结论 | 要点 |
|---|---|---|---|
| r4-2153a65 | integration/build05-r4 @2153a65 | **进行中** | 见第 6 节 |
| next-r3-f3d3614 | r3 @f3d3614 | ❌ 不通过 | `?lakemerge=off` 时 DC 峰值 71（合批开时峰值 38 ✔）；10 个采样点超差（原因是构图和 r5h3 不同），条纹 std 30；落地切场景 FOV 跳约 6°，机位跳变；进棋盘先弹 PausePanel；旅途天空球盖住混合天空色；夜间湖心偏橙褐。包体 19,294,468 B ✔，白天 clear colour 28/143/184 ✔，A0 |
| next-r3-f3d3614/diag | 调试构建 10a7820（父 f3d3614） | 已完成，原样回报 | `[QF_LAKE_DIAG]` isHDR=true、toneMappingType=0、WebPipeline、usePostProcess=false、mainLightIlluminance 87500、skyIllum 61250、missing ["exposure"]；五类 A0 B0 C=favicon D0 E0 |
| next-r2-228df2f | r2 @228df2f | 已停（被 r3 取代），数据仅作参考 | 包体 19,287,942 B；棋盘 DC 70，mergeoff 103（>60）；旅途 DC 约 295；湖畔可进，失败提示正确 |
| next-be1cd5a | be1cd5a | 未测（被 r2 取代），目录不存在 | — |
| next-f60c8ec | f60c8ec | ✅ 除湖畔外通过 | 包体 19,154,482 B；湖畔进不去（meshopt 被关导致 decodeVertexBuffer，`[...new Set]` 被编译成 `[].concat`）；v3.2 加 TEST-ONLY 补丁后 DC 79、近水过亮、中湖条纹 |
| a3b-a995c41 | integration/build05-a3b @a995c41 | ✅ 通过 | wechat 19,126,549 B；回家点击峰值 0.717 / 0.584，没有满幅；A0 B0 C=favicon D0 E0；产物 SHA256 已记录 |
| desktop-pkg-sha256-09a1b8e.txt | 桌面包（09a1b8e 验收后复制的副本） | 已完成 | 1241 个文件，整体 2b6919e926145edf7d9e31e43517883e774820fa64abfbe7ce10033adc8492f2 |

### 2026-10-16
| 目录 | 版本 | 结论 | 要点 |
|---|---|---|---|
| milestone-09a1b8e | integration/build05-20261016T2048 @09a1b8e | ✅ 通过，没有退步；**桌面包就是这一版** | wechat 19,125,680 B；守护脚本 0 次重试；README 外行走查有 3 处卡住、4 处含糊 |
| a3b-a17395c | fix/a3-home-sea-fadein @a17395c | ✅ 通过（并入 f60c8ec 一轮） | 19,126,549 B；回家不再重启海浪，点击不再削波 |
| readme-v2-a3 | README v2 + A3 @c49801b | README 通过（1 处含糊）；**A3 不通过** | 海浪没有从 0 渐入；夜间满幅样本 8 个，来自点击音效 |
| fixes-511953e | 511953e | ✅ 通过 | 叶子 PNG 版好看；夜间小路压暗；切后台停风浪；构建有不稳定（E1） |
| fixes-1bf0bfa | 1bf0bfa | ❌ 叶子不通过 | 叶子边缘没有抗锯齿，造型和原型不符；其余（N2b、V1）通过 |
| fixes-a4a1041 | a4a1041 | ✅ 通过（有遗留） | 户外环境声通过；N2 草地地面夜间没变暗（下一轮修）；出门途中切后台流程会重置 |
| fixes-6bdbf5b | 6bdbf5b | ✅ 通过 | 风声海浪、分数、星星、夜空、削波都通过 |
| fixes-e2a03ec | e2a03ec | ✅ 通过（有遗留） | 渐变、浮标通过；开箱分数一帧跳 66pt，下一轮已修 |
| integration-build05-77b76c3 / -62382c4 | 77b76c3 / 6b1334f | 参考 | 包体 19,015,379 / 19,013,276 B；lakeside 52 个 GLB .meta 被改写 |
| build05-* | 764dcd8、bc418c5、379e137、2607de6、7ecd289、a373227→4c30cf7 | 见各自 summary.md | 旅途、落地、回主页、角色等专项 |
| result-screen-* | c87881f（中止）、b0020ed、trace | 见各自 summary.md | 结算界面 |

### 2026-10-15
- PR55、PR56、PR58 各轮录屏验收：pr55-recordings、-r2、-r3、-r3b、pr56-recordings-r3、-r4、pr58-meadow、pr58-aabd8a2
- 问题清单：issues.md、round2/issues.md
- 结论见各自的 summary.md

---

## 5. 资料状态

- 每一轮都有 summary.md。例外：result-screen-c87881f 中止，next-be1cd5a 没测
- **体积**：
  - 2026-10-15：3.5 GB
  - 2026-10-16：1.8 GB
  - 2026-10-17：222 MB
  - tools：2.9 MB
  - 合计约 5.8 GB，其中媒体文件约 5.2 GB（webm 1.96 GB、mp4 2.74 GB、wav 0.48 GB）
- **>50 MB 的文件**只有 2 个：
  - 2026-10-16/fixes-a4a1041/audio/ib_day_390_vis.wav（60.8 MB）
  - 2026-10-15/pr55-recordings-r2/sbs/15_before-vs-after_day_p750.mp4（59.0 MB）
- 建议推送时排除 *.webm、*.mp4、*.wav（或者用 LFS）。已写好 .gitignore 草案。排除媒体后约 0.64 GB，其中 PNG 约 0.58 GB，也可以考虑用 LFS
- `._*` 是 macOS 传文件带过来的 AppleDouble 垃圾文件（163 B，共 1572 个），建议排除
- **个人信息处理**：
  - 已完成各轮（不含正在写入的 r4-2153a65）的 144 个文本日志里，Mac 用户名路径已替换成 `/Users/<mac-user>`
  - 没有发现 token、密钥、私钥或邮箱
  - 微信 AppID wx3bdd911c5c06f591 出现在构建日志里，属于项目配置，不是密钥
  - 「Funning」作为称呼出现在 8 个 summary、issues 和日志里，保留未改

---

## 6. r4（2153a65）进度 —— **仍在进行中**

> 来源：2026-10-17/r4-2153a65/summary.md，摘自 09:50 EDT 的内容。该目录还在写入，最终以它为准。

- **交付**：team/ggbot/outbox/20261017T122042Z-r4/
  - r4.bundle sha256 877d073a…ca97 ✔
  - f3d3614..HEAD 共 47 个提交 ✔
- **构建 ✔**：
  - HEAD 2153a65 / tree 7b22a1db；push=DISABLED；guard 一次通过
  - **wechat-release 19,335,755 B**：比 r3 多 41,287 B，距门限 24,641,536 B 还有 5,305,781 B ✔
  - main 1,280,264；web-test 20,122,888 B
  - 产物 SHA256：wechat-release ed845259…3e4a，web-test a7fcba81…5102
  - 调试 web 24,801,583 B
- **Mac 跑测**：runall4 进行中
- **已出结果**：

| # | 项 | 结论 | 说明 |
|---|---|---|---|
| 1 | 10 个重标定采样点 | ✔ | 白天 10/10，最大差 +11，条纹 std 2.4；夜间按色相判 10/10；夜间湖心已修（11/32/55） |
| 2 | `?lakediag=1`（调试包） | ✔ | 只打印一次：exposure 2.6e-5、mainLightIlluminance 118750、skyIllum 29500、missing [] |
| 3 | 正常运行不出现 [QF_LAKE] | ✘ | 有 info 级 journey-water-prewarm；切后台时有 error 级 `lakeside journey not reached: cancelled`（B+1） |
| 4 | 水材质故障注入 | ✘ | 能进棋盘并回退到旧水面，但 B 类不是恰好 +1（原始 +6，去重 +2） |
| 5 | 湖畔真实 DC | ✔ | 合批开最大 53/52；mergeoff 峰值 80 |
| 6 | 首次出现最差帧 | ⚠ | 140–153 ms；冷启动 219 ms |
| 7 | 太阳方向 | ✘ 新问题 | level-loading 起始帧太阳方位突变 180°，一帧内明显光照跳变 |
| 8 | 天空 | ✔ | 天穹已能淡出；离开湖畔后灯光恢复 |
| 9 | 女孩切换前后 diff | ✘ | 草甸、天空之城夜间切到棋盘后背景变成白天（新问题） |
| 10/11 | 切换帧耗时 / UI 首帧 | ✘ | 29–37 ms，>16.7 ms |
| — | 落地切换帧跳变复查 | ✔ | 四种视口位移 0 或 −4 px |
| 12 | 落地后没有暂停面板 | ✔ | — |
| 13 | 天空之城园丁 | 无法目视确认 | 不判不通过 |
| 14 | 草甸卡顿 | ✘ 仍在 | d≈30.2、36.2 处 50–68 ms |
| 15 | 旅途水印 | ✔ | — |
| 16 | 切后台 3 s / 10 s 音画偏差 | ✔ | +3 / −19 ms |
| 17 | 宝箱 | ✔ | — |
| 18 | 夜间玻璃牌真机拍摄 | 需要人工 | — |

- **五类错误**：A 全 0；C 只有 favicon；D 只有故障注入；E 0
- **待完成**：剩余跑测、最终结论、Mac 清理

