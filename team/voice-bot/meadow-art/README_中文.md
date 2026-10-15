# 草甸风车 + 小路 美术候选 v1（Voice Bot，2026-10-15）
**只是候选，未换进游戏，需 Funning 选定。** 基于 mac/task21-web-ui @5c54f7a 的 env_meadow.glb。全部几何自制（Blender 脚本生成），无外部素材，无新贴图。

## 改动
1. **风车叶片 windmill_sails**：每片叶加 9 根横档 + 外侧边框，中心加轴帽（192→520 顶点）。只改网格，节点、父子关系、动画 windmill_sails_loop（0–192 帧，绕轴旋转）完全不变，叶片随原动画转动。
2. **小路 meadow_path（小路贴花）**：沿 walk_path_00–22 用 Catmull-Rom 重建贴地路面（176→921 顶点），中间浅色路面 + 两侧窄土边，路面高出地形 3.5–6 cm（原 4.7–7.4 cm），无 z-fighting；两边加 32 块路边石，底部埋入地面 6 cm，不悬空。
3. windmill_static_merged 未改（v1 试加的门口石阶与原木台阶穿插，已撤掉）。
## 不变的（已脚本核对）
67 个节点名/变换/extras 全一致，锚点 player_spawn、walk_path_*、windmill_door_point、region_interaction_point、相机全保留；动画名一致；4 张贴图原样（palette 256² PNG 2.5 KB、ground 1024² JPG 115 KB、sky 4096×1024 JPG 85 KB、ground_detail 512² JPG 224 KB）。材质仍是原 M_meadow_palette（调色板 UV），不加新材质/新贴图，兼容 GGbot 后续 Draco/zlib/ASTC。用 JSON 级拼接只替换 2 个网格的 accessor，其余数据字节不动。
## 大小
原版 6409332 B → 候选 6512296 B（+102964 B，约 +0.10 MiB）。
## 与 GGbot int/v2-slim 的关系
GGbot 在减面草甸（6.41→4.08 MB）。我只动 meadow_path、windmill_sails 两个网格；scripts/build_meadow_art.py + splice_glb.py 可直接在减面后的 glb 上重跑，不冲突。
## 渲染
renders/ 下 before_/after_ 同相机同光（Workbench 预览，非游戏内着色）：01 游戏相机 CAM_spawn_pov、02 风车全景、03 门口近景、04 叶片近景、05/06 路边近景/低角度、07 小路俯视；cmp_*.jpg 为左改前右改后。after_flythrough.mp4 为环绕预览（4 秒）。
## 已知问题
路边石偏方正；叶片横档在部分角度略显稀疏；渲染器是 Workbench，真机效果需 Cocos 内复看。
