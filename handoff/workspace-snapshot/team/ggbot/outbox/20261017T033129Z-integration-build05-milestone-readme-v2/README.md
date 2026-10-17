# 咦 起风了 · build05 里程碑（09a1b8e）

**只想玩：双击桌面包 `~/Desktop/QIFENGLE-test-build05/web/start.command`，浏览器会自动打开游戏，不用构建，下面都不用看。**
（第一次双击如果 macOS 提示"无法打开"，就右键 → 打开 → 打开。）

- 版本：HEAD `09a1b8e456fd38dadf632f627189883808307cbe`，tree `082f1c0ee20c38403d3f3bbb3ff5fb27d2ecf14a`，分支 `integration/build05-20261016T2048`
- 实测包体（Mac，守护脚本）：微信包 **19,125,680 B**；web 包 19,867,113 B。安全线 24,641,536 B。
- 界面验收部已在 Mac 上验收通过，白天/夜间整流程没有退步。Suite 53 项 48 项通过（已知 5 项除外），见 suite.txt。
- 本次只改 README 和 bundle，代码和上一版完全一样。

---

## 给开发者看：自己在 Mac 上构建

需要：磁盘剩余 ≥ 3 GB；先关掉所有 Cocos Creator 窗口。

### 1. 拿到 bundle 文件
文件名 `qfl-build05-09a1b8e-full.bundle`（约 132 MB），是**完整仓库**，不需要你本机已有任何提交。
把它下载或拷到 **`~/Downloads/`**（例如从 Google Drive 下载，浏览器默认就放这里）。确认一下：
```bash
ls -l ~/Downloads/qfl-build05-09a1b8e-full.bundle
shasum -a 256 ~/Downloads/qfl-build05-09a1b8e-full.bundle   # 应与 SHA256SUMS 里这一行一致
```

### 2. 克隆到一个新目录（不碰你正在用的仓库）
```bash
git clone -b integration/build05-20261016T2048 ~/Downloads/qfl-build05-09a1b8e-full.bundle ~/qfl-milestone
cd ~/qfl-milestone
git rev-parse HEAD          # 应输出 09a1b8e456fd38dadf632f627189883808307cbe
git status --porcelain      # 应该什么都不输出
```
`~/qfl-milestone` 是全新的目录，你原来的 `~/Documents/Codex/2026-10-15/task-21/cursor-worktree` 不受影响。如果 `~/qfl-milestone` 已存在，先换个名字或删掉旧的。

### 3. 指定 Creator 并构建
这台 Mac 上的 Creator 不在 /Applications，而在下面这个位置（直接复制）：
```bash
export CREATOR="$HOME/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator"
bash tools/build-guard/build-wechat-guarded.sh both
```
- 约 1–3 分钟。看到 `BUILD GUARD PASSED` 和 `TOTAL_BYTES=…` 就成功了。
- Creator CLI 偶尔会出一次坏包，脚本会自动恢复并重试（最多 3 次），不用管。3 次都失败才会打印 `BUILD GUARD FAILED`。
- 如果报 `CREATOR is not executable`：说明路径不对，用 `mdfind -name CocosCreator.app` 找到它，再把 `…/CocosCreator.app/Contents/MacOS/CocosCreator` 填进上面的 export。
- 产物：`creator-build-project/build/wechat-release`（微信）和 `creator-build-project/build/web-test`（浏览器）。

### 4a. 在浏览器里跑
```bash
python3 -m http.server 8790 --bind 127.0.0.1 -d creator-build-project/build/web-test
```
用 Chrome 打开 http://127.0.0.1:8790/ ，然后：
- 按 **⌥⌘I**（Option+Command+I）打开开发者工具；
- 按 **⇧⌘M**（Shift+Command+M）切到手机视图，在顶部尺寸里填 **390 × 844**。

不切手机视图的话，关卡页棋盘的右侧会被裁掉。玩完回终端按 Ctrl+C 停服务。

### 4b. 在微信开发者工具里跑（⚠️ 这一步验收部点不了界面，没有在真机上实测）
1. 打开"微信开发者工具"，扫码登录。
2. 选"导入项目"，目录选 `~/qfl-milestone/creator-build-project/build/wechat-release`。
3. AppID 一栏：
   - **测试号**是微信给开发者的免费临时 AppID，只能自己在开发者工具和自己手机上预览，不能发布。没有正式 AppID 的权限时就用它。
   - 选法：点 AppID 输入框旁边的"测试号"（或下拉里的"使用测试号"），工具会自动填一个 AppID。
   - 如果你的微信号是正式 AppID `wx3bdd911c5c06f591` 的成员，也可以填它。
4. 点"确定"→ 编译。右上角"预览"会出二维码，用手机微信扫就能在手机上玩。

### 5. 用完清理（磁盘紧张）
```bash
rm -rf ~/qfl-milestone/creator-build-project/build
```
不再需要就整个删掉 `~/qfl-milestone` 和 `~/Downloads/qfl-build05-09a1b8e-full.bundle`。

---
校验：bundle 已在空目录里 `git bundle verify`（"complete history"）并 clone 测试，HEAD/tree 与上面一致，共 462 个提交。只在本地：没有 push，没有 force，没有动主线。改动清单和各版包体见上一版文件夹 `20261017T025522Z-integration-build05-milestone/README.md`。
