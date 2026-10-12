# 坐稳以后不要再晃（sit_hold）

任务：`cloud-tasks/RESULT-sit-still.md`。上一轮垂坠（`art-src/animation/sit-drape`）只保证了 `sit_hold` 第 0 秒不穿模；这一轮把整个 2 秒循环定在那一帧。

```bash
python3 art-src/animation/sit-still/scripts/freeze_hold.py \
  <坐姿垂坠之后的 glb> <out.glb>
```

只改 `sit_hold`：每根已经有通道的骨头写成 t=0 和 t=2 两个相同的 LINEAR 关键帧，取值是第 0 秒的局部姿态（含坐稳帧的 10 根裙骨）。形状键、骨头数量和名字、其他片段都不动。

`--lift 0.015` 会把两只手腕沿世界 +Y 抬高 1.5 cm（两段 IK，手掌朝向不变），并检查黄裙、围裙、蝴蝶结网格有没有跟着动。这一轮量过 15 / 18 / 20 / 30 / 40 mm，手掌和围裙的三角形穿插都没有消掉，所以运行时 glb 没有用这个参数。

检查（Blender 4.5，`blender -b -P`）：

| 脚本 | 做什么 |
|---|---|
| `scripts/measure_hands.py` | 坐稳帧手掌 / 袖子和围裙、黄裙的三角形穿插 |
| `../sit-drape/scripts/verify.py` | 按驱动摆 `sit_hold` / `sit_down` / `stand_up`，数穿插 |
| `scripts/render_strip.py` | 同一导入里渲连续时刻；侧面、正面、四分之三 |
| `scripts/compose_sheet.py` | 拼 `previews/keyframes_sit_hold_2s.jpg` |
