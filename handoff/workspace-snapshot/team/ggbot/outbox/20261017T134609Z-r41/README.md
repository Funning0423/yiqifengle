# r4.1 交付（GGbot，Cursor Agent 提交）

- **分支**：`integration/build05-r41-20261017T125738Z`（worktree `/tmp/wt-r41`，仅本地，未 push）
- **HEAD**：`e4a05b982aaa5b98053ef71eeacff91f37cb8f56`
- **基线**：r4 `2153a65cd4c97208a202746d251e3a458d4bb98f`

## 提交栈（2153a65..HEAD，见 PATCH-LIST.txt / patches/）
1. `74c696e` 棋盘提示条挪到托盘上方（GGbot，原 260ea02）
2. `fd1a39d` 草甸 r4.1 落点（运镜bot）
3. `b1e41b2` 出门实时脚步（Voice Bot，原 cfe6429）
4. `77883aa` **世界流程修复**：出门/回家途中切后台，回来后从原位置继续（本次）
5. `e4a05b9` 户外脚步响度（Voice Bot `f125cd2` cherry-pick -x，仅代码）

## 修复说明（77883aa）
**根因**：`WorldFlowCore.hide()` 在任何状态都会 `invalidate()` 取消当前过场、`restore()` 把女孩放回椅子并进入 `paused`；回到前台后再重新 `leaveHome()`，所以出门从头再走一遍。BGM 本身是 pause/resume（用 C_gating 录音互相关核对，续播偏差 0 ms），听上去"从头开始"的是出门过场音轨 `sfx_exit_outbound` 被重新从 0 播放、加上风浪环境声被停掉再淡入。
**修复**：
- `WorldFlowCore.ts`：出门状态（standing…crossing-out）和回家状态（walking-home…sitting）切后台时"冻结"：不取消、不复位，位置/动画时间/镜头/门角度原样保留，`show()` 时直接继续；若后台期间最后一步已结束，则落到稳定姿态。其它状态行为不变。
- `WorldFlowComponent.ts`：`show()` 后重新同步环境声/室内灯光的宿主暂停（`syncHostPause`）。
- `GameAudio.ts`：crossing-out 期间切后台，记录出门音轨偏移（墙钟），回前台从该偏移续播（超出时长则不再播）；BGM 仍是 pause/resume。
- 脚步（cfe6429/f125cd2）：冻结期间动画时钟不走，脚步不重发、不漏发（测试覆盖）。
- 新测试 `tools/journey-integration/test-world-background-freeze.cjs`（已加入 run-suite）。

## 测试（HEAD e4a05b9）
- Node 22（v22.23.3）：**94/95**，仅 navigation-guard BLOCKED_BROWSER（本机无浏览器）。`suite/suite-node22.txt`
- Node 20（v20.19.2）：**92/95**，legacy-board-ui-pure、reward-background-return BLOCKED_NODE + navigation-guard BLOCKED_BROWSER；**无 FAIL**。`suite/suite-node20.txt`
- exit-footsteps 单测：19/19 PASS。world-background-freeze、exit-background-resume：PASS。
- 与 fd1a39d（92/93、90/93）相比无新增失败；新增 2 项测试（exit-footsteps、world-background-freeze）。

## 包体估算（vs r4 2153a65，见 size-delta.txt）
- 脚本：改动的 12 个 .ts 经 TS→ES2020 + terser 压缩，合计 **+15,183 B**（其中本次修复 +1,746 B，f125cd2 +1,015 B，其余为提示条/草甸/脚步）。
- 资源：脚步 mp3 + 出门音轨 + meta 合计 **+32,605 B**（mp3 +27,504 B）。
- 合计约 **+47.8 KB**，为估算；真实数字以 Mac 构建为准。r4 距上限约 5 MB。

## 文件
- `r41-build05.bundle`：需先有 2153a65；`git bundle verify` 已通过（`bundle-verify.txt`），含分支 ref。
- `patches/`、`PATCH-LIST.txt`、`suite/`、`size-delta.txt`、`MAC_CHECKLIST.md`、`SHA256SUMS`

## 未结
- 没有真机截图/录屏（本机无 Cocos Creator），需界面验收部按 MAC_CHECKLIST 验。
- `WorldIntegrationBoot.runHomeTransition` 的等待用墙钟：后台停留很长（超过过场超时）时理论上可能超时；3 s/10 s 不受影响，录屏时留意。
- 08→09 比 Build05 慢 1.19 s（最小屏到 2.98 s），待 Grok Bot 接受。
