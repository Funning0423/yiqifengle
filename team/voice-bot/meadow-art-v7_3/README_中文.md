# 草甸 v7.3 候选（Voice Bot，2026-10-15）：按 Grok Bot 对 v7.2 的 2 条意见修改
**这只是候选，还没换进游戏，要等 Funning 选定。** 在 v7.2 基础上改，v7.2 的修改（顶上小云补缝并缩小、单面花瓣）全部保留。所有预览都用游戏里的 meadowScenePose 镜头（竖屏，Cocos 坐标 position [9,19,42]、target [0.327,5.509,-15.817]，垂直 FOV 49.426°）。全部是脚本自制，没有用外部素材。节点 98 个，节点名与 v7.2 相同；4 个动画名和通道数不变，包括 windmill_sails_loop。

## 改动
1. **云的底边改成圆鼓的**
   - 近景云网格 meadow_clouds_near（scripts/build_clouds_v73.py）：不再把底部切平，每个云团下半部改成压扁的圆底，底下再加一排 6 个小圆团，所以底边是一串圆鼓包。这个网格在游戏镜头里只露出右上角。
   - 排查时发现：游戏镜头里画面上方那朵**大云**，其实是天空贴图 meadow_sky_4096x1024 里画的（贴图 x≈900–1335、y≈700–870），不是 meadow_clouds_near。它的平底也一起改了（scripts/tex_v73.py）：灰色底带改成 10 个大小不一的圆弧，边缘带一点亮边。对比图：renders/big_sky_cloud_underside_orig_vs_v73.jpg。
2. **蝴蝶**：meadow_butterfly_00 的路线改在相机坐标里定义。0–2.7 s 在镜头前 4.4–5 m 处从左往右横穿画面下半部（约第 15–75 帧），之后在画面外绕到相机背后再回到起点。闭合样条，8 s 循环首尾无缝（每 8 s 再飞过一次）。另两只蝴蝶不变。

## 交付
- env_meadow_vb_meadowart_v7_3_candidate.glb（7,077,424 B，比 v6 多 471,064 B，没超过 500 KB 的上限）
- meadow_v7_3_portrait_gameplay_15s.mp4：540×1170、30 fps、15 s、450 帧，用 meadowScenePose 镜头
- renders/cmp_08_gameplay_portrait.jpg：原版、v7.1、v7.3 的对比，都用 meadowScenePose，第 40 帧（1.33 s，蝴蝶在画面里）
- renders/video_frames_*.jpg：视频抽帧；renders/big_sky_cloud_underside_orig_vs_v73.jpg：大云底边的对比
- size_table_v7_3.txt：大小表；scripts/：全部脚本

## 已知弱点
- 蝴蝶离镜头近，翅膀是低多边形的单片平面，看起来像一张黄色纸片或三角旗，能看清但不精致。
- 离 500 KB 上限只剩约 29 KB，以后再加东西就要先压缩，比如精简云团的分段。
- 大云的圆弧底是在原贴图上直接改的，右下角和右边小圆团接合的地方，近看有一个很小的缺口。
- meadow_clouds_near 在游戏镜头里只露出右上角，那里的改动不太显眼。
- 塔脚的接地阴影环大部分还是被草挡住；3 个新动画还需要 GGbot 在代码里显式播放。
