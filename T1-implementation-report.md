# T1 灯塔点击回屋：baseline 变体实现交付（HOLD，只做隔离验证）

- 任务 ID：T1。作者：GGbot。时间：2026-10-11 06:05 CDT。
- 基线：`baseline` 1ef9f1d1f784293209eff158c15479e04327deaf。本分支 `work/GGbot` **没有改 `creator-build-project/` 下的任何文件**，所以基线不变。按 READ-FIRST 的要求，T1 处于 HOLD，不直接安装。
- 候选包：`candidates/T1-lighthouse-return-baseline/`。另有一份打包：`/workspace/yiqifengle/deliveries/T1/T1-lighthouse-return-baseline.tar.gz`，129,912 B，SHA256 `f061bc69…235af`。
- 使用说明、Mac 命令和真机检查清单：见候选包里的 `README.md`。方案和根因：见 `T1-fix-plan.md`。

## 产物身份
| 项 | SHA256 |
|---|---|
| apply.py（v2，两变体共用） | 86bb0a4e4618ac44dd7754cee848e3b7a5822df8e13dbfb33ef91dc3c07de4c6 |
| baseline-l123 manifest | 0edd023952bc97782bc787e7b106e93170560cd8e4f2aa620f8bb0b78f5db0a5 |
| baseline-l12 manifest | 010836ff4869224841fda5ab51c0d2e5758987cf2234f3b4b3b807b91bad4b01 |
| Boot（after，两变体相同） | 99ee910dfd5e78f537f5ae1c1e6392785bdd161ea025697016fb8c69457aa21a（前置 4b4be7ab…） |
| WorldFlowComponent（after） | d7be489e…（等于冻结 near-hud 的 after；前置 2aba051b… 与 baseline 相同） |
| IslandJourneyOverlay（after） | c83ca5e1…（前置 aae6157c…） |
| IslandHomeInteraction.ts，l123 | a9e7de32d8f8c5857ebcaa82128161137e4db7a83e209c0fd932809378f7cd99（6,012 B） |
| IslandHomeInteraction.ts，l12 | 4a546bb7a55d61e5f6c2613246321d7d9b20422a61087383fb9e97ad4e6bdb80（5,185 B） |
| IslandHomeInteraction.ts.meta | 7bedcae7…（uuid 177535cd-…，在 baseline 中唯一） |

- 依赖钉死 15 项（哈希见 manifest），包括岛屋 GLB 231e2987…，不放宽。
- 候选包可以由 `tools/t1/build_candidate.py` 从 baseline 逐字节重建。`run_box_tests.sh` 会做这项比对，结果一致。
- draco3d 固定为 **1.5.7**：`tools/vendor-node/package.json` 写精确版本，`package-lock.json` 带 integrity sha512。`node_modules` 被 git 忽略，用 `npm ci` 安装。它在 `creator-build-project/` 之外，不进入导入、构建和微信包。

## 已测（共享电脑 Linux CPU，`tools/t1/run_box_tests.sh` 一键复跑，收据在 `tools/t1/results/final-*` 和 `run_box_tests.log`）
- **安装器 23/23 通过**：
  - 两个变体的正常往返（check 零写入 → apply → verify=APPLIED → rollback → verify=BASELINE，整棵树字节一致）
  - 前置 SHA 不符时零写入拒绝：依赖 Core、GLB、WarmButton 各 1 例，目标 Boot 1 例，near 分支整树 1 例
  - 两个变体互斥
  - 路径类拒绝：悬空 .ts/.meta 链接、活链接、备份根指向 assets 的别名、仓库内和仓库外的父目录别名
  - 写入中途失败自动完整回退：注入故障 ×4、回退方向注入故障、真实 OS 权限错误
  - 回退拒绝：文件被手改、新文件被换成链接
  - 包被篡改时 verify 和 apply 都拒绝
- **冻结安装器对照**（frozen-vs-v2-paths.json）：冻结版的链接丢失和别名写入照样复现，v2 全部在写前拒绝。
- **多指派发**（真实 3.8.8 小游戏输入源 → touchManager → UI dispatcher）：
  - l123 加模拟 wx：9/9。
  - l123 不加 wx、l12（加不加 wx 都一样）：8/9。唯一失败项是"同一帧内快点"，这是设计内的已知限制。
- **L3 生命周期**：只注册一次；dispose 用同一个函数注销恰好一次，从不无参调用 off；没有 wx、没有 offTouchStart、onTouchStart 抛错、原始事件格式异常，都能安全处理；l12 不注册任何 wx 监听。
- **作者原 13 项事件测试**：l123 和 l12 都是 13/13。
- **作者原 wiring 测试**：2 个变体 × 3 个视口，6/6。设置页的 ReturnHome 节点不存在，昼夜按钮保留。
- **几何夹具**：用 vendor 里的 draco3d 解码 baseline GLB，身份核对 OK；用 near 的 GLB（77bff8b3）跑负控，正确报 STALE；作者 test_geometry 跑出 4125 次射线、137 次空气拒绝，PASS。
- **TypeScript**：用官方 `@cocos/creator-types@3.8.8` 的 cc.d.ts 做全工程 tsc（非 strict，和工程 tsconfig 一致）。baseline 有 11 个既有错误，l123 和 l12 都是**新增 0 个**。
- `git apply --check` 用变体的 patch 打 baseline：两个都通过。
- 排除检查：vendor-node 和 candidates 都在工程外；工程里没有 node_modules，也没有 draco_decoder。
- 包体估算：生产源码 l123 +8,337 B、l12 +7,510 B；压缩后 JS 估算 +6.75 KB、+6.1 KB；没有新媒体。按 phase0 的 30,762,652 B 推算，余量约 687.9 KB，仍大于 600,000 B。

## 失败 / 已知限制
- l12，以及 L3 不可用时的 l123：第二指在同一帧内按下又松开、第一指再抬起时，仍会回屋 1 次。
- 作者的 `test_hosts.cjs`（room-hud 的 host 测试）**不适用于 baseline**：它要求 RoomLook-responsive 版本的 Component 里有 `createCommandFacade`，baseline 的 2aba 没有，断言直接失败。这不是候选代码的回归，baseline 的 host 生命周期需要另写测试。
- 冻结安装器 268789cb：路径缺陷照样复现（作为对照，本包已替换掉它）。

## 未测
- Cocos Creator 3.8.8 导入和构建，包体实测（main 和 totalBytes）。只能在 Mac 上跑，由 lead 执行。
- 微信开发者工具和真机上 `wx.onTouchStart` 与 Cocos 输入能否共存（L3 关键项）。微信官方文档写着 `offTouchStart`"不传此参数则移除所有监听函数"，说明支持多个监听，但仍以真机为准。
- 真实 OS 多指派发、原生 MeshRenderer 的 CPU geometricInfo（`rayModel` 依赖它）、真实点击回屋的画面和音频解锁。
- Web 预览输入源的 END 语义（L1 写成两种语义都兼容，属推断）。
- baseline Component 的 host 生命周期（见上）。

## 回退
- 本分支：只加了 tools、candidates 和文档，`git revert <本提交>` 即可，assets 零改动。
- 已在 Mac 隔离副本上安装的：`python3 $V/apply.py "$ISO" --rollback`，再用 `verify_t1.py` 确认退出码为 0（BASELINE）。如果回退被拒，按 `.cloud-patch-backups/<run>/STATE.json` 和 `original/` 手动恢复，或者 `git checkout 1ef9f1d -- <5 个路径>` 后删掉新类和 meta。
