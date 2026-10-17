# 里程碑包验收 09a1b8e（integration/build05-20261016T2048）

**结论：通过，没有退步。桌面包已换成这一版。**
README 按外行人的视角走不通，有 3 处会卡住、4 处含糊（见第 3 节）。

## 0. 准备
- Mac 上 fresh clone，HEAD 09a1b8e4…，tree 082f1c0e… 一致 ✅。
- bundle SHA256 1f1f33df…eca08 一致 ✅。
- push=DISABLED；构建前确认没有别的 Creator 在跑。

## 1. 守护脚本构建：✅ 通过，没有发现 bug
- 验收用的 clone 运行 `CREATOR=… bash tools/build-guard/build-wechat-guarded.sh both`（logs/guard.out）：
  - wechat 和 web 都是第 1 次就通过，**0 次重试**。
  - **TOTAL_BYTES=19,125,680**（wechat-release），比 511953e 多 24 B。README 预计约 19,125,8xx，实测略小。
  - 主包 1,862,250，main 分包 1,176,053，resources 445,828，其余分包和上一轮一样。
  - web-test 19,867,113 B，大于 15MB，**不需要调低 MIN_BYTES**。
  - 构建后 git status 为空，library/temp 已删除，用时约 1 分钟。
- 按 README 走的那个 clone 也跑了一次 both（layman/guard2.out），**正好碰上一次真实失败**：
  - web 第 1 次：size=2,309,217，日志里有「当前初始场景不存在」，git status 有 400 个改动 → 被拒。
  - 脚本恢复 .meta、删掉缓存后，第 2 次通过，19,867,113 B，git status 为空。
  - 这说明重试路径在真机上也有效。
- 自测 `test_build_guard.sh`：box 和 Mac 上都是 SELFTEST PASS (4 cases)。
- CREATOR 路径不对时，脚本会大声报错：`CREATOR is not executable`，退出码 2。
- 没有用到 b.sh 兜底。

## 2. 完整流程回归：✅ 没有退步
- 录了 390 白天、390 夜间（nightProp=true），以及出门途中切后台 2 次（walking-out 时、crossing-out 时）。全部用真实点击，开 `__worldFlowLog`。
- pageerror 0，HTTP≥400 0。
- 点玻璃牌后约 1.05s 进入 standing；正常出门 30.8s 到小岛。
- 切后台回来后自动重新出门：两次分别是 16.561→47.549 和 33.431→64.423，都是 31.0s。
- 和 511953e 相比，玻璃牌区域的截图逐像素平均差只有 0.05；夜间草地、小路、彩虹桥的变暗都还在（frames/sheet_*_2s.png）。
- **V1r：50ms 残余已经消除。**
  - 现在切后台时就会静音：`29.399 [QF_AUDIO] {"event":"ambience-quiet","reason":"hide","quieters":2}`，同时 wind-pause×2。
  - 回到前台时：`33.432 {"event":"ambience-quiet","reason":"resume:standing"}`，之后直到重新到户外（44.355 wind-play，vol 0.004）都没有风浪。
  - 录音：以回前台声音恢复为 0，统计 8–16kHz，每格 10ms（dB）。

    | 版本 | 前几格 | 说明 |
    |---|---|---|
    | 511953e | −50 −91 −82 −110… | |
    | 09a1b8e | −79 −91 −109… | |
    | 从没播过风声的对照（vis3000） | −70 −109… | 背景音乐恢复本身的起音 |

    现在剩下的只有和对照相当的约 10–20ms 起音，已经不是风浪尾音（frames/V1r_show_spectrogram.png）。
- 户外音量和 A1c 一致：

  | 场景 | 环境声 | 比 BGM 高 |
  |---|---|---|
  | 正常出门，白天 | −20.8 dBFS | +6.3 dB |
  | 正常出门，夜间 | −20.8 dBFS | +6.3 dB |
  | 切后台后重新出门（2 次） | −21.0 / −20.9 dBFS | +5.3 / +5.7 dB |

## 3. 按外行人视角走 README（全新目录、全新浏览器配置）
做法：在新目录 clone Funning 本机现有的仓库，用两个全新的 Chrome 配置（1280×800 桌面窗口、390×844），用鼠标点击。

| # | 步骤 | 程度 | 现象 / 建议 |
|---|---|---|---|
| L1 | 第 1 步 git fetch | **卡住** | Funning 本机的仓库（cursor-worktree，cursor/task21-web-ui 分支）里**没有 b0020ed，也没有 77b76c3**，按原文执行报错：`Repository lacks these prerequisite commits: b0020ed4…`。README 只写了“前提是包含 b0020ed”，没说缺了怎么办。我是先 fetch 一个 751905c..b0020ed 的底座 bundle 才继续下去的。建议：发一个完整 bundle（`git bundle create … --all` 或从仓库根开始），或者附上底座 bundle 和两行命令 |
| L2 | 第 1 步 `/path/to/integration-build05.bundle` | **卡住** | bundle 在 box 的 GGbot outbox 里，Funning 的 Mac 上没有。README 没写怎么拿到这个文件（下载到哪里、文件名是什么）。建议直接写成“放到 ~/Downloads/”，命令也按这个路径写全 |
| L3 | 第 2 步 CREATOR 示例路径 | **卡住** | 示例的 `/Applications/Cocos/Creator/3.8.8/…` 在这台 Mac 上不存在。只装了 CocosDashboard，没有通过它安装 Creator。实际能用的 Creator 在 `~/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator`。照抄示例，脚本会报 `CREATOR is not executable`，外行看不懂。建议把这台 Mac 上的真实路径写进去，或者加一句“用 `mdfind -name CocosCreator.app` 查找” |
| L4 | 第 1 步 `cd ~/path/to/wechat-game` | 含糊 | 没说是哪个目录。Funning 的仓库在 `~/Documents/Codex/2026-10-15/task-21/cursor-worktree`，而且它当前在别的分支上。直接在这个仓库里 `git switch` 会改动他正在用的工作目录，建议改成新 clone 一份到单独的目录 |
| L5 | 第 4 步“按 F12 切到 390×844 手机视图” | 含糊 | Mac 上 F12 默认是调音量；Chrome 打开开发者工具要按 ⌥⌘I，切换手机视图要按 ⇧⌘M，然后在 Dimensions 里填 390×844。如果不切，1280×800 横屏下主页能玩，但关卡页的棋盘右侧会被裁掉（frames/layman_desktop_home_level.png）。另外，鼠标点击在桌面和 390 两种视图下都能点玻璃牌出门、点「继续旅程」进关 ✅ |
| L6 | 第 4 步 http.server | 低 | 没加 `--bind 127.0.0.1`，会监听所有网卡，macOS 第一次可能弹出“是否允许传入网络连接”。建议加上 `--bind 127.0.0.1`，或者直接让 Funning 用桌面包里的 start.command |
| L7 | 第 4 步 微信开发者工具 | 未验证 | 这台 Mac 装了 wechatwebdevtools，但我这边点不了 GUI，没法实测导入。README 写的“AppID 用 wx3bdd911c5c06f591（或测试号）”，外行不知道测试号是什么、在哪里选 |
| — | 第 3 步、第 5 步 | ✅ | 守护脚本和自测照着写的命令能直接运行，输出和 README 描述一致 |

建议：README 第一句先告诉 Funning“只想玩的话，直接双击桌面包里的 web/start.command，不用构建”，构建那部分标成“给开发者看”。

## 4. 其他问题
| # | 时间点 | 程度 | 说明 |
|---|---|---|---|
| A3 | vis3000 录制 127.5s（草原点「回家」切回屋里的瞬间） | 低 | 有一个采样到了满幅 1.000（≥0.98 的有 11 个）。当时海浪 vol 0.441→回家时 waves-play 0.506，和背景音乐淡入叠在一起。511953e 在同一位置的峰值是 0.997，所以不是这次改出来的新问题。建议回家时海浪从 0 开始渐入，或者整体降 1dB |
| 旧问题 | — | — | 裙摆和蝴蝶结穿模凳子；湖畔地区走不到；坐着时切后台要点「继续」 |

## 5. 桌面包与清理
- **桌面包**：~/Desktop/QIFENGLE-test-build05 已换成 09a1b8e（用守护脚本构建的 wechat-release 和 web-test，加上 start.command），README 第一行改成“版本 09a1b8e，里程碑”，并补了“切后台时风浪立刻停”。
  - 在 8790 端口测试：主页 → 切后台 → 点「继续」→ 点牌子 → standing ✅。
- **清理 Mac**：已删除 ~/qf-ms-tmp（包括按 README 走的那份 clone 和两个浏览器配置），停掉服务和 Chrome，没有 Creator 在运行。
  - 剩余空间：开工时（10:56 CST）11,095,096 KiB；清理前（11:21 CST）10,153,804 KiB；**清理后 10,878,624 KiB（约 10.4 GiB）**。
- box 上的临时 kit、分片、临时分支和引用都已删除。
