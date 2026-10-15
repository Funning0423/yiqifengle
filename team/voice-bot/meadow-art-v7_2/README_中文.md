# 草甸 v7.2 候选（Voice Bot，2026-10-15）：按 Grok Bot 对 v7.1 的 3 条意见修改
**这只是候选，还没换进游戏，要等 Funning 选定。** 在 v7.1 基础上改，脚本见 scripts/（build_v72.py、tex_v72.py、merge_v72.sh、render_v72.py）。全部是脚本自制，没有用外部素材。节点 98 个，节点名和变换都与 v7.1 完全一致（原有 67 个节点、锚点也不变）。动画名不变：windmill_sails_loop、meadow_butterflies_loop、meadow_birds_loop、windmill_flag_loop。

## 改动
1. **顶上的云**（天空贴图 meadow_sky_4096x1024）：补上了中间那条蓝缝。做法是加 3 个核心填充椭圆，透明度改成各团块软遮罩取最大值。整朵云再缩到 v7.1 的 85%（包围盒约 127×56 px）。对比图：renders/top_cloud_sky_texture_orig_v71_v72.jpg。
2. **花瓣**：改成单面杯形花瓣，去掉背面和侧边（调色板材质本来就是 doubleSided），花边从 15 个顶点减到 10 个。花的位置、大小和朝向与 v7.1 相同（326 朵）。花网格顶点从 13,692 减到 6,846，三角形从 17,930 减到 4,890。
3. **预览镜头**：改用游戏里的 meadowScenePose（竖屏），数值取自 creator-build-project/assets/scripts/region/MeadowSceneData.ts。Cocos 坐标 position [9,19,42]、target [0.327,5.509,-15.817]，垂直 FOV 49.426°。换算到 Blender 是 (9,-42,19) 看向 (0.327,15.817,5.509)，竖直 sensor fit。

## 交付
- env_meadow_vb_meadowart_v7_2_candidate.glb（6,997,492 B，比 v6 多 391,132 B，在 500 KB 以内）
- meadow_v7_2_portrait_gameplay_15s.mp4：540×1170、30 fps、15 s，用 meadowScenePose 镜头渲染
- renders/cmp_08_gameplay_portrait.jpg：原版、v7.1、v7.2 的对比，都用 meadowScenePose，第 120 帧；单张原图是 *_08_gameplay_portrait_750x1624.png
- renders/video_frames_*.jpg：视频抽帧
- size_table_v7_2.txt：大小表
- 预览灯光与 v5 到 v7.1 相同（按 Cocos 场景匹配的 Eevee）

## 已知弱点
- 在 meadowScenePose 下，画面上方大部分被近处的 meadow_clouds_near 网格云挡住，它的底边看起来比较平。天空贴图里改的那朵小云在这个镜头里基本看不到，修改效果只能看贴图对比图。
- 蝴蝶 00 那段贴近镜头的飞行是按 CAM_spawn_pov 设计的。换成游戏镜头后，它离镜头约 22 m，前 3 秒看不出“从镜头前飞过”。要的话需要按新镜头重排路径。
- 鸟群约 0.5 s 就入画，约 10–13 s 时飞出画面上方。
- 单面花瓣从背面看颜色和正面一样，没有明暗差，游戏距离下看不出来。
- 塔脚的接地阴影环大部分还是被草挡住。
- 3 个新动画还需要 GGbot 在代码里显式播放。
