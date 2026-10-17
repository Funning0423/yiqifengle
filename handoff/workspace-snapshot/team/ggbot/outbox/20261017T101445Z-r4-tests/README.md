# r4-tests：测试和溯源修正（GGbot）
- 分支 `ggbot/build05-r4-tests`，基于 r3 `f3d3614`。只在本地，没有 push。HEAD `7c1047bd4d7f3424ff766d33d3746e578057919c`，tree `d15477f730de…`
- 4 个提交，每项一个：
  1. `c9bc9cf` cloud-web-contract：在契约 `tools/cloud-web/lib.cjs` 的 `REQUIRED_BUNDLES` 里声明 `region_lakeside` 和 `shared_effects`。源码里这两个都是真实的分包目录（`isBundle:true`）；只加 region_lakeside 的话，测试会接着报缺 shared_effects。
  2. `7619db5` 溯源：守护脚本和 run-suite 第一行打印 HEAD、tree 和 UTC 时间；守护脚本的日志名改为 `<out>.<短SHA>.tryN.log`，旧名 `<out>.tryN.log` 保留为指向它的软链接。suite.json 新增 gitTree、gitShort、startedAtUTC，另外再写一份 `suite.<短SHA>.json`（已加进 gitignore）。守护脚本自测新增用例 1b，覆盖这些改动。
  3. `f9baed9` reward-background-return：Node 低于 22.6 时打印 `BLOCKED_NODE: … requires Node >=22.6 …, found vX`，退出码 78，run-suite 记为 BLOCKED，不会算通过。仓库 README 里补了 Mac 上的运行方法。
  4. `7c1047b` production-integrity：先检查所有冻结文件，再一次性列出全部不匹配项（路径、期望值、实际值）后失败。退出码、通过/失败的判定和冻结清单都不变。在当前清单上报告 311 个文件中 20 个不匹配（见 production-integrity-20-mismatches.txt）。
- 按指示从本分支**去掉**的两项：production-integrity 冻结清单的更新、legacy-board-ui-pure 的 SFX 门数量，这两项归 Voice Bot。

## 套件结果（box，Node v20.19.2，QF_TYPESCRIPT_MODULE=/tmp/ts5/…，在 7c1047b 上）
74 项中 70 项 PASS，退出码 1。没通过的：production-integrity FAIL、legacy-board-ui-pure FAIL（都等 Voice Bot 的提交）；reward-background-return BLOCKED_NODE；navigation-guard BLOCKED_BROWSER。cloud-web-contract 现在 PASS。原始输出见 suite.txt、suite.json。

## 叠到其他基线
- cherry-pick 到 a8ba19a（运镜bot hook v3）：干净
- cherry-pick 到 ggbot/build05-r4-prep（989b5fe）：干净
- Voice Bot 的 `expectation-fix-09a1b8e.diff` 在本分支上仍然能干净应用。应用后 production-integrity 通过（exit 0）。

## 包体
所有改动都在 tools/、README.md 和 .gitignore 里，没有动 creator-build-project/，所以**包体变化为 0 B**。这是按改动范围推出来的，没有重新构建。

## 需要 Voice Bot 确认的事实
1. bgm_main.mp3 的字节到底是哪个提交改的？`git log --follow` 的结果是 **3e0bdc3**（2026-10-16 11:48Z，「v3.2 size: bgm 48 -> 40 kbps CBR (main, meadow, skycity)」，501,333 → 417,819 B），更早是 53f5999、aa48f1f 和 d32920c。4c30cf7 确实没碰 mp3：它是 bisect 找到的「production-integrity 第一次失败」的提交，当时不匹配的文件是 env_skycity.glb，不是 mp3。仓库里没有构建时重新编码 mp3 的步骤，这一点请确认。
2. 你的 diff 应用以后，legacy-board-ui-pure 在 Node 20 上**仍然失败**：第 38 行 `stripTypeScriptTypes is not a function`，第 36 行的计数已经通过。它和 reward-background-return 一样需要 Node ≥22.6，要不要也报成 BLOCKED_NODE，请你定。
3. reward-background-return 用 Node 22.23.3（`npx node@22`）实测，**仍然失败**：`test_reward_background_return.cjs:38 assert(reward)`，找不到 RewardPanel，可能和结果页 v2 有关。所以它不只是环境问题。

## Mac 上用 Node ≥22.6 跑 reward-background-return
```bash
cd ~/qfl-milestone
npx -y node@22 --version            # 确认 ≥ v22.6
npx -y node@22 tools/board-ui/test_reward_background_return.cjs; echo exit=$?
# 或：nvm install 22 && nvm exec 22 node tools/journey-integration/run-suite.cjs reward-background-return
```
目前预期结果是 exit=1，失败在第 38 行（见上面第 3 条）。修好以后应为 0。

## 文件
patches/（4 个，从 f3d3614 起）、r4-tests.bundle（前置是 f3d3614，已 verify）、suite.txt、suite.json、production-integrity-20-mismatches.txt、SHA256SUMS
