# audit-fixes-77b76c3（界面验收部 77b76c3 问题清单修复）

HEAD **e2a03ec3ca7866570a0e04ae46564bec783163f3**，tree **7fb667fe34ed56e3e776b9ab4f706cac1dbbbc93**，分支 `ggbot/audit-fixes-77b76c3`（基于 77b76c3，只在本地，没有推送）。
- `patches/`：基于 77b76c3 的 format-patch 序列（6 个，合并提交被线性化；git am 后 tree 一致）。
- `yiqifengle-e2a03ec-base-b0020ed.bundle`：范围 b0020ed..HEAD。核对见 TREE_CHECK.txt，文件校验见 SHA256SUMS。
- 全量测试（QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript）：46 项，41 通过；未通过的只有已知 5 项：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract（FAIL），navigation-guard（BLOCKED）。
- 人物压缩 260c3d5 保留（验收没有发现变形）。

## 各项
| 项 | 提交 | 根因 | 修法 | 包体变化 |
|---|---|---|---|---|
| F2 | c76ba9a | **不是 meshCompress。** 这 14 个是动画子资源（AnimationClip，不是 mesh），3.8.8 把它们序列化为 CCON 二进制：config 写 `.cconb`、文件输出 `.bin` 是官方布局。web 的 downloadCCONB 先请求 `.bin`，只有 `.bin` 请求失败时才回退请求 `.cconb`（必然 404）；微信适配层直接把 URL 改成 `.bin`。所以 8 个 .cconb 404 是“首次加载时 `.bin` 请求偶发失败”的表现。b0020ed（不含 260c3d5）的结算验收里也出现过 `@b043a.cconb` 404，证明与 260c3d5 无关。 | SharedBundles.ts 包装 `.cconb` 下载器：只请求 `.bin`，引擎的回退变成第二次请求 `.bin`，不再请求不存在的 `.cconb`，与微信行为一致；`__worldFlowLog` 打开时记录 `.bin` 失败的真实原因（`[QF_CCONB]`）。压缩收益不变。新测试 cconb-bin-only | 源码 +1.4 KB（JS，未实测） |
| F1 | 925a1fc | 黑色遮罩用 UIOpacity 做淡变，但 Graphics 的颜色烘在填充顶点里，UIOpacity 改不了它：节点一激活就是全黑，结束时直接消失 → 两头都是硬切（黑场 = 淡出 + 加载 + 淡入时长）。流程本身已经是“先淡到全黑再加载”。 | 每帧把 alpha 直接写进 Graphics 填充色（coverAlphaByte），出发 0.25/0.35 s、「主页」0.4/0.5 s 都能渲染出中间亮度。新测试 fade-cover-alpha | 源码 +0.8 KB |
| R1 | 1d9d53a | 点宝箱后宿主重画结算页（closeResult → openResult）：新面板重播 0.22 s 弹出动画（92% 缩放 + 透明度从 0、遮罩从透明开始 → “变小、发白”），新面板的 3D 宝箱要重新加载，这几帧显示 2D 备用图；开箱布局让分数行上移约 66pt，一帧跳过去。 | 把正在开盖的 3D 宝箱交接给新面板（3 s 内），新面板跳过弹出动画（PopupPanel.settleOpen），分数用 0.25 s cubicOut 缓动到新位置。新测试 result-chest-handoff（harness 里 390 下分数 83→149.5，正好约 66） | 源码 +4.1 KB |
| R2 | 8edc7d2 | 小屏奖励浮标压在箱盖上 | 高度 ≤700 时浮标上移 14pt。新测试 result-float-lift | 源码 +0.4 KB |
| A1 | f57b8d2（Voice Bot）+ 合并 cae332e + e2a03ec | 22.05 kHz 24k 编码低通约 5.5 kHz | Voice Bot 重编码为 32 kHz 56k CBR 单声道；e2a03ec 把 exit-cine-audio 测试的 64 KB 上限改为 150 KB，并检查 MPEG-1 32 kHz 单声道帧头 | **+80,248 B**（60,412 → 140,660） |
| M1 | 无提交 | Creator 导入时会自动补全 subMetas（验收已看到），不影响运行，只会让工作区每次构建后出现未提交改动。子资源 id 由 Creator 导入器生成，盒子上没有 Creator，无法可靠地手写出完全一致的 meta（不能伪造）。 | 需要 Mac 上导入后的 52 个 .meta：请界面验收部下次构建后把 `git diff` 补全的 meta 打包回传，我再单独提交。 | 0 |

**重要（A1）：出门音轨里不再烘焙风声和海浪声**，这两层改由游戏里的 WindAudio 和 ambience 循环提供。**界面验收部必须在真机上确认出门时只听到一层风声。**

## 包体
77b76c3 实测总包 19,015,379 B。本次估算：A1 +80,248 B；代码四项合计约 +6.7 KB 源码（构建压缩后更小，未实测）。估算总包约 19,102,000 B，远低于 23.5 MiB 闸门（24,641,536 B）。需要 Mac 实测。

## 需要真机/Mac 复查
F1 中间亮度帧；R1 开箱逐帧（不再缩小、分数缓动）；R2 320×568；F2 首次启动 404 不再出现（如有 `[QF_CCONB]` 日志请回传）；A1 只有一层风声。以上都是代码 + 模拟测试，没有在设备上看过。
