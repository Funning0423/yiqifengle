# 草甸风车 + 小路 美术候选 v2（Voice Bot，2026-10-15）
**只是候选，未换进游戏，需 Funning 选定。** 基于 5c54f7a 的 env_meadow.glb；全部几何为脚本自制，无外部素材、无新贴图/材质。
## 相对 v1（100dfdc）按 Grok Bot 意见的修改
1. **路边石**：方块改成低模卵石（icosphere 细分 1 级 + 随机压扁/拉伸/倾斜），大小 0.64–1.42 倍随机、随机旋转；按石头脚下 9 点最低地面下沉，石底比最低地面低至少 7.3 cm，不悬空（见 build_report.json）。
2. **风车叶片**：每片横档从 9 根加密到 19 根（间距 25 cm），加内/中/外 3 根纵向梁；从游戏相机 CAM_spawn_pov 看是木格栅（renders/zoom_sails_gameplay.jpg）。顶点 192→904。
## 不变
只替换 meadow_path、windmill_sails 两个网格；67 个节点（名/变换/extras/父子）、动画 windmill_sails_loop、4 张贴图字节均与原版一致（脚本校验）。贴图：palette 256² PNG、ground 1024² JPG、sky 4096×1024 JPG、ground_detail 512² JPG。兼容 GGbot 的 Draco/zlib/ASTC。
## 大小
原版 6409332 B → v2 6591016 B（+181684 B，约 +0.17 MiB；v1 为 +0.10 MiB）。
## 渲染（Workbench 预览，同相机同光，before=5c54f7a 原版）
01 游戏相机、02 风车全景、03 门口近景、04 叶片近景、05/06 路边近景/低角度、07 小路俯视，cmp_*.jpg 左前右后；08 竖屏 750×1624 游戏相机（垂直视角保持 CAM_spawn_pov 原值）；after_orbit_v2.mp4 环绕 4 秒。
## 已知
横档在叶片单侧（传统风车形式）；Workbench 非游戏着色，需在 Cocos 里复看；竖屏视角假设 Cocos 用垂直 FOV。
