# 窗口点一下直接出门（原型，等 Funning 选定）— 运镜bot 2026-10-15

基线：`Funning0423/yiqifengle` `mac/task21-web-ui` @ `5c54f7a`。没有改主线，也没有推送任何东西。
本地原型分支：`/tmp/wt-window-tap`，分支名 `cinematic/window-tap-exit-proto`（未提交、未推送）。

## 1. 现在的流程（5c54f7a）
- `RoomExploreOverlay.ts`：屋里覆盖全屏的触摸层。拖动会调用 `worldCommands().lookRoom(dx,dy)`（`world-r1/RoomLook.ts`，可转动范围 yaw -140..+14°，64°/屏宽）。
- 默认视角对着窗口，看不到门，屏幕底部显示「向左轻拖，看看门口 ›」。门把手的投影进入画面后（大约 yaw -112°，`RoomLook.door()`），才出现「推开门，开始冒险」。点它或门把手 28 px 以内的位置，会调用 `leave()`，也就是 `WorldIntegrationBoot.invoke(() => worldCommands().leaveHome())`。
- `WorldFlowComponent.leaveHome`：视角动过时，先用不超过 1.05 s 的时间把镜头转回默认机位，再播原来的出门镜头。视角没动时，直接用 `flow.leaveHome()`。
- 结果：玩家必须先拖 3–4 次才能出门。

## 2. 改动（patch/window-tap-exit-vs-5c54f7a.patch，3 个文件，+40/-7）
- `world-r1/RoomLook.ts`：新增 `WINDOW_GUIDE.point = [0.05, 1.75, -5.125]`。这个点位于后窗玻璃 `env_rear_window_glass` 中心稍偏下，数值是用 Blender 从 room glb 量出来的。另外新增 `window(aspect)`，返回这个点在屏幕上的位置。只有视角在默认位置 ±6° 以内时才显示。
- `world-r1/WorldFlowComponent.ts`：`roomView()` 增加 `window` 字段。
- `RoomExploreOverlay.ts`：
  - 新增 `WindowTapGuide` 节点。图标大：Graphics 光圈半径 38 px 加 🍃 图标，图标 30 px。文字小：13 px。
  - 呼吸效果：周期 1.6 s，ease-in-out（余弦），scale 0.9→1.1，透明度 0.6→1。由每帧的 `sync()` 驱动，没有加计时器。
  - 位置会被限制在安全区里：左右各留 16 px，顶部 64 px，底部 96 px。
  - 引导显示时，隐藏旧的「向左轻拖」提示。
  - 静止点击光圈 44 px 以内时，走原来的 `leave()`，进入原有出门镜头，音频解锁仍记为 `door-tap`。
  - 一开始拖动，或视角离开窗口超过 6°，引导就隐藏。转到门时，原来的门按钮路径完全不变。
  - `diagnostics()` 增加 `windowGuide`。
- 文案候选写在 `WINDOW_CAPTIONS` 里，用 `WINDOW_GUIDE_UI.caption` 选第几条，默认 0。三个候选：
  1. 出发去看海
  2. 点一下，起风了
  3. 去看看风

应用方法（在 5c54f7a 的工作区里）：`git apply /workspace/wechat-game/team/cinematic/work/window-tap-exit/patch/window-tap-exit-vs-5c54f7a.patch`。已在干净的 5c54f7a worktree 上验证 `git apply --check` 通过。改完后的完整文件在 `src/`。

## 3. 视频（video/，竖屏 720x1560 和 1080x1170 左右对照，H.264）
- `before_swipe-to-door_0.46.mp4`：改前。默认看窗口 → 拖 4 次转到门 → 点「推开门」→ 出门镜头。
- `after_window-tap_3captions_0.46.mp4`：改后。默认视角下窗口上有呼吸引导，依次换 3 条文案 → 点光圈 → 直接出门。
- `side-by-side_before_vs_after_0.46.mp4`：左边改前，右边改后。

**哪些是真的、哪些是模拟：**
- 场景、拖动转向、门按钮和整段出门镜头，都是真实的 5c54f7a 网页构建（`web-task21-ui-5c54f7a.tgz`），在无头 Chromium 里录制。改前那段是真实的触摸流程。
- 改后的「呼吸引导」是 **模拟**：它是录制时注入页面的 HTML 层，尺寸、动画参数和位置都和 patch 一致，位置就是 patch 里那个窗口点的投影。点光圈后调用的是真实的 `__worldIntegration.leave()`，和 patch 里 `leave()` 走同一个 `leaveHome`。这个 box 上不能重新编译 Cocos 构建，所以 **patch 本身还没有在 Cocos 里跑过**。
- 共享电脑负载很高，软件渲染只有几 fps。所以拖动和出门两段都 **按比例加速过**，画面上标了「已加速」，节奏不代表真机。
- 画面顶部的「测试包 · 地区流程入口 / 地区流程测试」是这个测试构建自带的调试条，不是这次的改动。改后视频开头约 1 秒还有加载淡出的残影。
- 改前第 1 段「默认看窗口」用的是真实构建截图（出门前转回默认机位那一帧），定格 3 秒。录制时默认视角还在加载淡出，只能这样。

## 4. 安全区截图（shots/）
- `after_guide_aspect0.46_caption{1,2,3}.png`（360x780）和 `after_guide_aspect0.75_caption{1,2,3}.png`（390x520），每张都附 `_box.json`，记录光圈加文字在 scale 1.1 时的外框。
- `safe_area_check.txt`：6 组全部在安全区内（左右 ≥16 px，顶 ≥64 px，底 ≤ vh-96 px）。
- 0.75 的 caption1 截图还带一点加载淡出，caption2 和 caption3 是干净的。在 0.75 下，光圈上沿会碰到调试按钮「地区流程测试」，正式包里没有这个按钮。
- 另附 `before_door-prompt_0.46.png`、`before_default-window_0.46.png` 和 `after_exit-reached-island_0.46.png`。

## 5. 风险和待办
- 🍃 用的是 Label 里的 emoji，微信真机的字体可能显示不一致。正式版建议换成贴图图标（要美术出一张）。
- patch 需要在 Mac 的 Cocos Creator 3.8.8 里编译，跑网页构建和微信构建，确认 Graphics 和 UIOpacity 的效果，以及真实的点击区域。
- 脚本在 `scripts/`：`run.cjs` 是 Playwright 录制脚本，`window_bounds_blender.py` 用来量窗口的世界坐标。

---
# 第二轮（15:50 ET）：出门镜头加「跳过」，第二次起自动变短

patch 已更新为 `patch/window-tap-exit-vs-5c54f7a.patch`，共 6 个文件，+107/−14，包含第一轮的窗口引导。已在干净的 5c54f7a 上验证 `git apply --check` 通过。完整文件在 `src/`。

## 改动
- `world-r1/WorldFlowCore.ts`
  - `leaveHome()` 外面包了一层，用来记录 `leaving` 状态。原来的流程挪到 `leaveHomeRun()` 里，内容没有改。
  - 新增 `skipLeave()`：先取消当前出门流程的 token，让镜头、门、风和角色的任务都停下，然后执行和看完整段时 **同样的最后几行**：`stable='island'`，`restore()`，`change('island')`，再发出 `settled` 事件。`restore()` 会把风设成 0，门设为海岛角度，镜头设为 `cameraIsland`，图层设为 ISLAND，室内光设为 0，角色设为海岛站姿。被跳过的 `leaveHome()` 仍然返回 `{ok:true}`，所以 `WorldNativeComposition` 里依赖结果的流程（比如继续主线）不会被打断。
  - 新增 `leaveHome({quick:true})`：先播起身动作（约 1 s），再把图层设为 BOTH，打开门，然后用一段 `QUICK_EXIT_CAMERA_S = 3.6 s` 的镜头，按 `[当前/默认机位 → cameraCrossOut → cameraIsland]` 移过去，结束状态同上。设计总时长约 4.6 s，满足 ≤6 s。
- `world-r1/WorldFlowComponent.ts`
  - 新增本地标记 `yqfl:exit-cutscene-seen:v1`，存在 `sys.localStorage` 里，微信上对应微信本地存储。正常看完或跳过、出门成功后写入。第一次出门播完整版，之后都走快速版。
  - `worldCommands()` 增加 `skipLeave` 和 `leavingHome` 两个命令。
- 新文件 `ExitSkipButton.ts`：「跳过 ›」按钮，88×44 px，在右上角，右边距 16 px，上边距 64 px。只在出门过程中显示。
- `WorldIntegrationBoot.ts`：创建这个按钮，每帧调用 `sync`，退出时 `dispose`。
- **和 exit-cam v2 的关系：** 我没有改 `RegionCameraData` 里的 distanceRate、settleSeconds 和终帧，也没有改原来的完整出门镜头。跳过和快速版都直接用 `config.cameraIsland`，所以 v2 换了新终帧以后会自动对齐。两边可能冲突的只有 `WorldFlowCore.leaveHome` 的开头几行：我在外面包了一层，原来的内容整段移进了 `leaveHomeRun`。合并时，v2 对原来流程的修改改到 `leaveHomeRun` 里即可。

## 测试（真实代码，Node）
`tests/skip.test.cjs` 接在仓库已归档的 world-flow 测试框架后面，用 `tests/tsreg.cjs` 加载 TS。日志在 `tests/world-flow+skip.test.log`。
- 新增的 7 项全部通过：
  - 在 standing、turning-out、walking-out、opening-door、crossing-out 五个阶段跳过，结束状态都和看完整段 **完全一致**：状态、门、图层、镜头、角色站姿和可见性都相同，没有遗留任务，风最后是 0，有 `settled` 事件，再按一次跳过不起作用，跳过后还能正常回家。
  - 快速版的结束状态和完整版一致。
  - 不在出门过程中时，跳过不起作用。
- 剩下 7 项失败在 5c54f7a 原版上也一样失败（是归档测试和当前回家流程不匹配），不是这次改动造成的。

## 视频（video/，竖屏，0.46）
- `after_1st-exit_skip_0.46.mp4`（17 s）：第一次出门，窗口引导 → 点击 → 完整出门镜头，右上角显示「跳过」→ 在 walking-out 阶段点跳过 → 直接到海岛终帧。
- `after_2nd-exit_quick_0.46.mp4`（9.6 s）：回家后第二次出门，窗口引导 → 快速版 → 海岛终帧。
- `side-by-side_before_vs_after-skip-quick_0.46.mp4`：左边是改前（滑屏、点门、完整出门，没有跳过），右边是改后第一次（跳过）接第二次（快速版）。
- 第一轮的 3 个视频保留不动。

**哪些是真的、哪些是模拟：** 场景和出门镜头都是真实的 5c54f7a 网页构建。「跳过」按钮和窗口引导是 HTML 模拟层，尺寸和位置都和 patch 一致。点跳过后执行的是 **构建里真实的 WorldFlowCore 私有方法**，顺序就是 patch 里 `skipLeave()` 的那几步。快速版也是在运行时用真实方法（action、setLayers、setDoor、animateCamera、restore）按 `leaveHomeRun(quick)` 的步骤组合出来的。patch 本身仍然没有经过 Cocos 编译。

## 测得的时长
- 这台共享电脑负载很高（load 20–40），软件渲染非常慢，测出来的时长不能代表真机：
  - 完整出门镜头：146.2 s（引擎累计 dt 是 146.2 s，墙钟时间也差不多）。UI QA 实测是约 24 s，大约慢了 6.1 倍。
  - 快速版：21.6 s。按同样的倍数折算约 3.6 s。
  - 设计预算：起身约 1 s + 镜头 3.6 s ≈ 4.6 s。
  - 跳过：点击后同一帧切到海岛状态（引擎 dt < 0.1 s）。
- 视频里的快速版按 24 s 基准折算成了 3.6 s，并标了「按24s基准换算」。**真实时长要在 Mac 或真机上测。**
- 结束画面对比：`shots/end_state_compare_skip_full_quick.png`。跳过后和看完整段的截图平均像素差只有 1.1/255，差别只来自海鸟和风车的动画。快速版是 2.8/255，因为飞机的动画相位不同。

## 截图（shots/）
- `skip_button_aspect0.46.png` 和 `skip_button_aspect0.75.png`，各附 `_box.json`。按钮 88×44，在安全区内：右边距 16 px，上边距 64 px，见 `safe_area_check.txt`。
- 在测试包里，按钮的下沿会压到调试条「测试包 · 地区流程入口」，正式包里没有这个调试条。
- `end_after-skip_0.46.png`、`end_watched-through_0.46.png` 和 `end_quick-2nd-exit_0.46.png`。

## 风险和待办
1. 快速版的镜头从室内经过门口直接飞到海岛，速度很快。路径上的穿墙检查还没做（要等房间复查一起做），在 Mac 上要看一下是否有一帧穿模。
2. 跳过时如果出门音效或风声是另外起的计时，需要在 Mac 上听一下有没有残留的声音。核心的风强度会回到 0，这一点测试已经验证。
3. 「已看过」的标记目前用 `sys.localStorage`，没有接正式存档系统。如果 GGbot 的存档需要统一，请告诉我接哪个接口。
4. 需要在 Mac 上编译 Cocos，跑网页构建和微信构建，实测完整版和快速版的时长。
