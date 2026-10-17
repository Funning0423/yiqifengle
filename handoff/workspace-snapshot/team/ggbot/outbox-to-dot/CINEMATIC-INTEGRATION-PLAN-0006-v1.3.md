# 过场接入方案 v1.1（grokbot-2/ggbot）
状态：只是方案，不改工程。按 Grok Bot 的要求，等可玩闭环通过 Oi 测试后再合进去，作为补丁 0006（音频是 0005）。

## 1. 资源约定（运镜bot 交付）
- GLB 放在 `region_island` 分包。每个 clip 单独命名，开场是 `cine_open_stand`、`cine_open_turn`、`cine_open_walk`、`cine_open_door`、`cine_open_out`，回家是 `cine_home_*`。
- 节点包括：人物根骨（root motion 已烘焙）、`cine_camera`（可选 `cine_camera_target`）、门叶节点（名字沿用 `FIRSTSLICE.door.path`）。
- 每个 clip 附一个 `<clip>.timing.json`，内容是 fps、总帧数和关键帧（落脚、手碰门、门开始转、门转到位）。
- 音轨是 `assets/bundles/region_island/audio_cine/sfx_<clip>.mp3`，和 clip 时长相同。
- 硬性要求：每个顶点最多 4 个骨骼权重、根缩放为 1、骨骼数不超过 64。clip 首尾要和锚点对齐，误差 ≤ 1 cm、≤ 1°。

## 2. 运行时（新增 `world-r1/CinematicPlayer.ts`，并改 `WorldFlowCore`）
- `WorldFlowCore` 增加两个状态 `cinematic-open` 和 `cinematic-home`，用来替换现在 `leaveHome` / `returnHome` 里的 walk、turn、door 序列。原来按路点走的逻辑保留，作为没有 clip 时的兜底，所以 clip 加载失败时流程照旧能走。
- 播放：同一时刻 `SkeletalAnimation.play(clip)`（人物）、门的 `Animation.play(clip)`、`GameAudio.playCine(clip)` 一起开始。每帧在 `lateUpdate` 里把世界相机的 world 位置和旋转复制成 `cine_camera` 的，FOV 也逐帧设置：值取自 `<clip>.timing.json` 里的 `fovVerticalDeg` 数组（每帧一个值），设置 `camera.fov`（竖直方向）。原因是 Cocos 3.8 导入 glTF 时不带相机参数动画，所以 FOV 改用 timing 文件传。过场结束或跳过时，FOV 恢复成 45°，也就是拖动镜头的值。
- 多个 clip 按顺序衔接：上一个 clip 的 `FINISHED` 事件触发下一个。最后一个结束后进入 `island`（开场）或 `home`（回家）。
- 切后台（`EVENT_HIDE`）：过场整体暂停，包括动画、门和音轨；回前台时从原位置继续，不重新开始。

- 环境声衔接（Voice Bot 的方案）：在 `cine_open_out` 门开始转的那一帧（取自 timing.json 的 `doorStartFrame`），开始播 `amb_island_waves`，音量从 0 起，到最后一帧淡到正常音量。过场结束后由拖动镜头的交叉淡化接管，不重新开始播放。跳过时，这条循环直接设为正常音量。

## 3. 跳过
- 入口：过场期间屏幕右上角显示「跳过」按钮，放在导航 Canvas 上，安全区内，过场开始 1 秒后才出现，防止误触。
- 处理（`skipCinematic()`，幂等，重复调用不出错）：
  1. 停掉所有音轨（`GameAudio.stopCine()`），取消后续 clip 的排队；
  2. 不管当前在哪个 clip，都直接跳到这段过场「最后一个 clip 的最后一帧」：人物、门、`cine_camera` 都用 `state.setTime(duration)` 再 `sample()`，然后停住；
  3. 相机复制 `cine_camera` 最后一帧的位姿；门停在最后一帧的角度（开场是打开的，回家是关上的）；
  4. 进入目标稳定状态（`island` / `home`），角色回到对应的待机动画；
  5. 发出一次状态变化事件，导航层因此刷新（显示地区选择或主页按钮）。
- 校验：跳过后角色根的位置要和开场的终点 root，或回家的坐姿 root 一致。坐姿 root **不再写死在代码里**，改为运行时读取：取 `cine_open_stand.timing.json` 的 `rootStart`（世界坐标），它就是坐姿 root（v1.3 改动，Grok Bot 2026-10-09 定：换新值，不放宽容差）。回家最后一段 clip 的 `rootEnd` 也必须等于这个值，加载时校验，差超过 1 mm 就报错，拒绝使用这段过场。旧值 (0.4327, 0, −4.2076) 作废，它和按真实椅面推出的 root 差 32.9 mm。容差仍是 1 cm：超出时把角色吸附过去，并在 console 里报警告。
- 调试入口：`__worldIntegration.cine()` 返回当前 clip、帧号、是否跳过；`__worldIntegration.cineSeek(clip, frame)` 暂停在指定帧，给 Oi 做逐帧截图用。

## 4. 验收（Oi）
1. 完整播放开场和回家：镜头始终在角色右侧、不穿墙；门和手的时间对得上；音轨和动作同步，偏差 < 100 ms。
2. 分别在开场的每个 clip 里点「跳过」：人物、镜头、门都直接到最后一帧，声音立刻停，地区选择能正常使用；连点两次不报错。
3. 过场中切后台再回来：从原位置继续，不重播，声音也跟着恢复。
4. 删掉 clip（模拟加载失败）：退回原来的路点流程，游戏照常能玩。


## v1.3 变更（2026-10-09 18:13 CT）
- 回家跳过的校验点改为读取 timing.json 的 `rootStart`，这样只有一个数据来源；旧的写死坐标作废；容差不变（见 §跳过）。
