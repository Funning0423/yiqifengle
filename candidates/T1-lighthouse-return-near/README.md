# T1 灯塔点击回屋 · near 候选包（HOLD：只做隔离验证，不装进生产工程）

- 任务 ID：T1。作者：GGbot。基线：`repo` 分支 near，提交 **41fabe75fbc652a1ecdb48bcc9f8dea982c714a2**。
- 与 baseline 包的 after 文件**逐字节相同**（near 没改 Boot/WorldFlowComponent/IslandJourneyOverlay，前置 SHA 也相同）；不同的只有依赖门禁：WorldFlowCore `c5cd721f…`、FirstsliceRoutes `8272f925…`、FirstsliceFacts `290bbd42…`、岛屋 GLB `77bff8b3…`（near 自己的值，独立的一套，没有和 baseline 合并或放宽）。
- 来源：冻结候选 `island-lighthouse-return.zip`（52a35faa…）的 near-hud 变更集，移植到 baseline 上。修了两处：
  1. **安装器 v2**：所有路径不跟随链接，父目录必须是真实目录，备份根不能是链接，有问题一律在写入前拒绝；写入中途失败会自动完整回退。
  2. **多指三层判定**：
     - L1：抬起时除本指外不能还有手指按着
     - L2：按住期间每帧检查 `input.getTouchCount()`
     - L3：微信平台层 `wx.onTouchStart` 原始监听
- 本包状态：**HOLD**。不能装进生产工程或原工程目录；不能放宽哈希门禁；不上传微信。

## 两个互斥变体（只能选一个）

| 变体 | IslandHomeInteraction.ts | 用途 |
|---|---|---|
| `variants/near-l123` | 三层（L1+L2+L3） | **首选** |
| `variants/near-l12` | 两层（L1+L2，不注册 wx 监听） | L3 在真机上和 Cocos 输入冲突时的回退版。已知限制：第二指在**同一帧内**按下又松开的快点，第一指抬起仍可能回屋 |

- 两个变体前置相同（全是 near 41fabe7），after 只有 `IslandHomeInteraction.ts` 不同。装了一个以后，另一个的 check 会因哈希不符被拒绝。要换变体，先 `--rollback` 再装。
- 改动文件共 5 个：`WorldIntegrationBoot.ts`、`world-r1/WorldFlowComponent.ts`、`world-r2/IslandJourneyOverlay.ts` 三个改，`world-r2/IslandHomeInteraction.ts` 和 `.meta` 两个新增。
- 依赖钉死 15 个（WorldFlowCore c5cd…、FirstsliceRoutes 8272…、FirstsliceFacts、RegionCameraData、CameraPose、RoomLook、RoomExploreOverlay、WarmButton、WorldNativeComposition、GameAudio、3 个 meta、world-r2.meta、岛屋 GLB 77bff8b3…）。完整 SHA 见各变体的 `manifest.json`。
- 设置页的"回屋小憩"按钮去掉了，换成一行不可点的提示"轻点灯塔，回屋小憩"。没有新媒体，也没有新的常驻按钮。

## Mac 上的命令（在隔离副本里跑，不要在原工程目录里跑）

```sh
ORIG=<near 41fabe7 的工程副本（例如 git worktree 检出的 near）>
C=/Users/shineanl/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app
ISO=~/grokbot-tests/t1-near-$(date +%Y%m%d-%H%M)
PKG=/path/to/T1-lighthouse-return-near        # 本包解压位置
V=$PKG/variants/near-l123                      # 回退版换成 near-l12

# 0. 隔离副本（library 可以一起复制当缓存，加快导入；build/temp 不要）
rsync -a --exclude build --exclude temp --exclude local "$ORIG/" "$ISO/"

# 1. 只读校验：包完整性、当前状态、依赖。退出码 0 = BASELINE 且依赖全对
python3 $PKG/verify_t1.py $V "$ISO"

# 2. 预检（零写入）。任何前置 SHA 不符都会列出并退出 1
python3 $V/apply.py "$ISO" --check

# 3. 应用。中途失败会自动完整回退，并打印 "Automatic restoration verified."
python3 $V/apply.py "$ISO"
python3 $PKG/verify_t1.py $V "$ISO"      # 期望退出码 10 = APPLIED

# 4. 构建（沿用 phase0 的参数，只改 outputName）
#    build-options-t1.json = phase0-build-options.json，把 outputName 改成 grokbot-t1-l123-wechat
"$C/Contents/MacOS/CocosCreator" --project "$ISO/creator-build-project" --build configPath=$HOME/grokbot-tests/t1/build-options-t1.json
#    期望 exit=36（Cocos 成功）。然后用和 phase0 相同的 check_wechat_build 统计 totalBytes 和 main

# 5. 回退（严格逆序；回退前会检查每个文件都是普通文件且哈希吻合，否则零写入拒绝）
python3 $V/apply.py "$ISO" --rollback
python3 $PKG/verify_t1.py $V "$ISO"      # 期望退出码 0 = BASELINE
```

## 包体
- 生产源码增量：l123 是 +8,337 B，l12 是 +7,510 B（TS 源码）。没有新媒体。
- 估算压缩后 JS 增量：l123 约 +6.75 KB，l12 约 +6.1 KB（TS → System 模块 → terser，CPU 估算）。
- phase0 基线总包 30,762,652 B，余量 694,628 B。装 l123 后预计余量约 687.9 KB，仍大于给人物留的 600,000 B。**以 Mac 构建实测为准。**
- `tools/vendor-node`（draco3d）和本 `candidates/` 目录都在 `creator-build-project/` 之外，不参与导入和构建。构建后可以确认：`grep -rl "draco_decoder" <build输出>` 应该没有 draco3d npm 包的文件。

## 真机 / 开发者工具检查清单（Oi 原生验收前，Grok Bot 先在 Mac 上跑）

**A. L3 与 Cocos 输入能否共存（最先查）**
1. 装 l123 后进岛屏，确认这些操作都正常：
   - 所有 HUD 按钮（继续旅程、菜单、设置、昼夜）点了都有反应
   - 室内拖转、棋盘关卡里的点击和拖动正常
   - 灯塔单击能回屋一次
2. 在室内、关卡、天空城之间来回切换后（`IslandHomeInteraction` 会随岛屏 sync 启停，但监听在 Boot 生命周期内常驻），按钮和拖动仍然正常。
3. 判定为冲突的现象（满足任一就算）：
   - 触摸整体失灵
   - 只有第一次触摸有效
   - 按钮要点两次
   - 控制台报 onTouchStart 相关错误
   - **Boot 销毁或重进后**触摸失灵（`dispose` 只用同一个函数调用 `wx.offTouchStart(listener)`，从不无参调用，无参会把 Cocos 的监听一起清掉）
4. 如果冲突：`--rollback` 掉 l123，改装 `near-l12`，把"同帧快点"写进已知限制。

**B. 多指（真机）**
- 第一指按住灯塔，第二指按住任一 HUD 按钮，第一指先抬：不回屋，按钮也不触发。
- 第一指按住灯塔，第二指在按钮上快点一下，第一指再抬：不回屋。l12 只有在第二指极快、同一帧内完成时可能误触，属于已知限制。
- 第一指按住灯塔，第二指按在海面，第一指先抬：不回屋。
- 双指操作之后，再单指点灯塔：正常回屋一次。

**C. 原有验收项（来自冻结 README）**
- 点塔顶、墙、侧屋、门：各自自然回屋一次。
- 点海面、天空，或拖动超过 8px：不回屋。
- 连点只触发一次。菜单或弹层打开时不能触发。
- 切后台再恢复、竖屏和横屏的安全区、胶囊按钮及相邻的系统图标区域。
- 设置页没有"回屋小憩"按钮，只有提示文字。昼夜按钮正常。
- 13 秒帽顶、22.8 秒照明跳变属于 T2/T3a，不在本包范围内。

## 共享电脑上已跑的测试（复跑：`tools/t1/run_box_tests.sh`）
安装器 23 个场景、多指派发 9 个场景 × 2 个变体（加或不加模拟 wx）、L3 生命周期、作者原 13 项事件测试、作者原 wiring（2 个变体 × 3 个视口）、几何夹具（4125/137）加 GLB 不一致必须失败的负控、全工程 tsc 对比（基线 11 个既有错误，候选新增 0 个）。收据在 `tools/t1/results/final-*.json`。

## 注意
- 本包只对**纯 near 41fabe7** 生效。int/v1（near+T5+A2+T6+df09ce8）里 WorldFlowComponent/WorldFlowCore 已被其他任务改过，前置门禁会拒绝（按设计，不放宽）；int/v1 请用 git 分支 `work/GGbot-t1-near` 合并。
- 几何夹具：near GLB（77bff8b3）登记身份见 `tools/t1/results/pick-geometry-near.identity.json`。
