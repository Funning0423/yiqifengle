# 云端任务通用规则（《咦，起风了》，Cocos Creator 3.8.8 微信小游戏 + Blender 4.5）
- 先在云端装无界面 Blender 4.5 LTS（官方 Linux tarball），用脚本跑 `blender -b -P`。
- 角色骨骼：现有 28 根身体骨 + 2 根头发骨，骨骼名和层级不许改（现有动画、驱动、T0 依赖）。
- 角色运行时 glb 总大小 ≤ 1.5 MB（头部重做也算在内）；新增材质和贴图要尽量少；导出 GLB 时 tangents 保持现有设置。
- 风格：低多边形、柔和干净的二次元治愈感，参照 V12 原画（`art-src/character/` 里有压缩版参考图）。不要卡通过头，不要写实。
- 电影《起风了》截图不许提交进仓库。
- 产出：在自己的分支上提交，写 `cloud-tasks/RESULT-<任务名>.md`，内容包括改了什么、对比图路径（正面、侧面、四分之三侧、背面，以及关键动作帧的拼图）、glb 大小、穿模检查数据、遗留问题。不要改 `creator-build-project/` 以外的运行时代码；改了 `creator-build-project/` 下的资源要跑 `node tools/test_manifests.cjs --write`。
- 同一个报错最多重试 2 次，然后写清卡在哪。
