# build05 里程碑：integration/build05-20261016T2048
- **HEAD**：09a1b8e456fd38dadf632f627189883808307cbe
- **tree**：082f1c0ee20c38403d3f3bbb3ff5fb27d2ecf14a
- 从 77b76c3 快进 28 个提交，和 ggbot/audit-fixes-77b76c3 的 HEAD 一致。
- 只在本地操作：没有 push，没有 force，没有动主线。
- bundle：integration-build05.bundle，范围 b0020ed..HEAD，前置提交是 b0020ed。TREE_CHECK 已用 bundle verify 和 fetch 核对过。
- Suite：共 53 项，48 项通过。没通过的只有已知那几项：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract 失败，navigation-guard 是 BLOCKED。详见 suite.txt。

## 在自己的 Mac 上构建并运行测试包（Funning）
前提：
- 本机已经有这个仓库的 clone，并且包含 b0020ed（`git cat-file -t b0020ed` 输出 commit）。
- 已安装 Cocos Creator 3.8.8。
- 磁盘剩余空间至少约 3 GB。
- 构建前关掉所有 Creator 窗口。

1. 取得代码：
   ```bash
   cd ~/path/to/wechat-game            # 你的仓库目录
   git fetch /path/to/integration-build05.bundle integration/build05-20261016T2048:integration/build05-20261016T2048
   git switch integration/build05-20261016T2048
   git rev-parse HEAD                   # 应该是 09a1b8e456fd38dadf632f627189883808307cbe
   git status --porcelain               # 必须为空；不为空先 git stash
   ```
2. 指定 Creator 的路径（zsh 和 bash 都可以）：
   ```bash
   export CREATOR="/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator"   # 按你的实际安装路径改
   ```
3. 运行带保护的构建：
   ```bash
   bash tools/build-guard/build-wechat-guarded.sh both      # 也可以只写 wechat 或 web
   ```
   - 判定通过需要同时满足三条：包体大于 15 MB；日志里没有「当前初始场景不存在」；`git status --porcelain` 为空（没有 .meta 被改写）。
   - 不通过时，脚本会自动恢复被改写的 .meta，删掉 library/temp，然后重试，最多 3 次。3 次都失败会打印 `BUILD GUARD FAILED` 并以退出码 2 结束。
   - 通过时会打印 `TOTAL_BYTES=…`（总包字节数）、主包和各分包的大小，以及 `BUILD GUARD PASSED`。最后会删掉 library/temp 释放磁盘；想保留可以设 `KEEP_CACHE=1`。
   - 每次尝试的日志在 tools/build-guard/logs/，这个目录被 git 忽略。
   - 如果 web 包是唯一因为“小于 15 MB”被拒的，可以用 `MIN_BYTES=… bash tools/build-guard/build-wechat-guarded.sh web` 调低阈值，但先确认日志里没有那条报错。
4. 运行：
   - 微信：打开微信开发者工具，选“导入项目”，目录选 `creator-build-project/build/wechat-release`，AppID 用 wx3bdd911c5c06f591（或测试号），编译后预览或真机调试。
   - Web：
     ```bash
     python3 -m http.server 8790 -d creator-build-project/build/web-test
     ```
     然后在浏览器打开 http://localhost:8790/ ，按 F12 切到 390×844 手机视图。
5. 想先确认保护逻辑本身没问题，可以跑自测（不需要 Creator，用的是假构建器）：
   ```bash
   bash tools/build-guard/test_build_guard.sh
   ```
   应该输出 `SELFTEST PASS (4 cases)`。

## 自 77b76c3 以来的全部改动
大小一列是源码资产的净字节变化，不是实测包体；Merge 提交按第一父提交计算。

实测总包：
| 版本 | 总包 |
|---|---|
| 77b76c3 | 19,015,379 B |
| e2a03ec | 19,097,915 B |
| 6bdbf5b | 19,100,765 B |
| a4a1041 | 19,118,651 B |
| 1bf0bfa | 19,121,346 B |
| 511953e | **19,125,656 B**（最近一次实测） |

511953e 之后又加了两个提交：V1r 约 +111 B，E1 只有 tools，不进包。预计约 19,125,8xx B。

| 提交 | 改动 | 资产 Δ |
|---|---|---|
| c76ba9a | F2：.cconb 只请求实际发布的 .bin，不再 404 | +1,408 |
| 925a1fc | F1：主页渐隐遮罩的 alpha 写进 Graphics 填充色 | +809 |
| 1d9d53a | R1：点宝箱后保留实时 3D 宝箱，跳过 0.22 s 的弹入动画 | +4,063 |
| 8edc7d2 | R2：小屏上奖励浮标上移 14 pt | +368 |
| cae332e | 合并 Voice Bot A1 出门音轨（f57b8d2） | +80,248 |
| e2a03ec | exit-cine-audio 测试接受 A1 音轨 | 0 |
| c6cd037 | M1：52 个 lakeside GLB 的 .meta 补全 subMetas，palette 贴图的 hasAlpha 设为 false | +116,220（.meta 文本，不直接进包） |
| 576b8ab | R1a：领奖批量重绘时保留分数缓动 | +527 |
| b7c5221 | R1b：已领取的结算面板跳过星星掉落动画 | +125 |
| 827cb1f | A1b：出门时挂载风声和海浪 | +3,378 |
| 1fd2661 | N1：草原夜空使用 meadow_sky_dome | +1,433 |
| 6bdbf5b | 合并 Voice Bot A2 削波修正（08bd1ca） | 0 |
| c843ba1 | A1b 补充：防御式注册，mock 测试可以加载 | +548 |
| 24b30d1 | A1c：风浪电平按默认音乐滑杆归一化（户外约比 BGM 高 6 dB） | +1,508 |
| 27acf22 | N2：夜间旅程中草丛和最上面那层云变暗 | +1,639 |
| 0500567 | 运镜bot 玻璃牌 v4r32 第 1 部分 | +17,329 |
| a4a1041 | 玻璃牌第 2 轮 | +156 |
| 6edc86f | M2：提交 GlassSign.ts.meta | +171 |
| e45a9df | N2b：夜间草地地面变暗 | +1,666 |
| 83de245 | V1：出门途中切后台，回来后自动重新出门 | +817 |
| 1bf0bfa | G2：叶子和文字整组居中（Graphics 版叶子） | +2,081 |
| d9f87b2 | G2b：叶子改成 48×48 PNG（2.6 KB） | +5,073（含 .meta） |
| c08dbf3 | N3：夜间小路、彩虹桥、风车 ×0.6 | +826 |
| 511953e | V1 补充：重新出门时风浪立刻停 | +1,613 |
| 455ee48 | V1r：切后台时风浪音量立即归零，去掉约 50 ms 的残余 | +111 |
| 09a1b8e | E1：tools/build-guard 构建保护脚本、配置和自测 | 0（只有 tools） |

## E1 背景
Creator 3.8.8 命令行构建大约一半概率导入失败：asset-db 直接 ready，结果包只有约 2.3 MB，日志报「当前初始场景不存在」，还会把约 400 个 .meta 改写成 importer "*"。这些 .meta 千万不要提交。保护脚本会把这种情况自动拦下来。

## 请界面验收部
- 用 build-wechat-guarded.sh 在 Mac 上实际跑一次 both，确认 TOTAL_BYTES 和结论一致。特别是 web 包是否大于 15 MB，如果不是，需要给 web 单独定阈值。
- 确认切后台时风浪的 50 ms 残余已经没有了。
