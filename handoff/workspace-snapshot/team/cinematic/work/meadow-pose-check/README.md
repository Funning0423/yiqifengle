# 草甸位姿交叉验收（运镜bot）· 2026-10-09 CT

**输入（只读，SHA 已核）**
- `team/cinematic/inbox/meadow_camera_pose.json` SHA256 `7ab9d956368f143542b35d98f5f3ddb15f6ccd09fb3336e86b23609e079d0f0d`（和 zip 里的 `camera/meadow_camera_pose.json` 逐字节相同）
- `team/art/outbox-to-dot/20261010T0122Z-grokbot2-MEADOW-v0.8.1-BAKE-GROUNDTEX-CAMPOSE.zip` SHA256 `0bbe1d68a1040bff0f6e04c26047f9c2c997c4bbd0ba70e5579685310c6d76bd`，内层 SHA256SUMS 全部 OK
- 场景：`art/x/GROKBOT-MEADOW-v0.8.0/meadow_v0_8/meadow_greybox_v0_8.blend`（Blender 无头打开，不保存）；锚点 `data/anchors_v0_8.json`
- 小岛那套取景脚本在 `team/cinematic/` 下没有落盘，这次按同一套判据（vFOV 45、0.46/0.75、|x|≤0.7、角色在 NDC y=-0.5 以上、遮挡检查）重写：`scripts/meadow_pose_check.py`

**方法**：位姿按 Cocos→Blender `(x,−z,y)` 换算；lookAt(up=+Y) 自己算基向量；按引擎 `SkyFollowCamera` 把天空球 XZ 移到相机处；near 按 1 m 判（位姿 metadata 写的是 0007 的 0.05 m，两种都判）；
每个比例逐格打射线（0.46：92×200，0.75：150×200）统计画面里各类物体占比、空洞、地形边缘；锚点、小路网格、草/花实例投影到 NDC；角色 = player_spawn 处 0.6×0.6×1.73 m（1.626 m+帽子）盒。

## 结论（原位姿 position (-8,24,62) target (0.3151,3.4577,-0.6059) FOV 45）

| 检查 | 结果 | 数值 |
|---|---|---|
| 1 格式/roll/俯仰 | PASS | pose 只有 3 个键，全有限；right=(0.99129, 0, 0.13166)，right.y=0；pitch −18.02°，yaw 7.57°，距 target 66.41 m |
| 2 相机不在几何体内/近裁面/遮挡 | PASS | 向下首击 terrain，离地 24.82 m；最近几何 24.74 m（terrain）≫1 m；光轴首击 terrain，和 target 差 0.04 mm；小路 00–22、spawn、门、交互点、钟都无遮挡（帆毂被帆挡属正常）；角色盒 9 个采样点 0 遮挡 |
| 3 草甸/天空占比、边缘 | **0.46 PASS；0.75 严格判 FAIL（很小）** | 草甸 73.3% / 天空 26.7%（0.46），70.4% / 29.6%（0.75）；空洞 0；真地平线 NDC y=0.785，可见天际线（地形山脊）y=0.29–0.66；最远命中 283 m < far 1000。0.75 右缘 NDC x 0.90–0.99、y≈0.29–0.30 能看到地形北边界（Cocos z=−80，x≈53–57）切在天空前，约 9 个射线格（≈0.05% 画面），渲染里看着像一条平的地平线，不是黑洞 |
| 4 底部 25% 留给按钮 | PASS（余量偏小） | 小路网格 y_min −0.446，walk_path_00–22 y_min −0.431，target y=0；底部带 = 地形 91%/89%、草、少量河岸。角色盒 0.46：x 0.226–0.306，y −0.439…−0.344；0.75：x 0.139–0.188，同 y；离 −0.5 只有 0.061（≈30 px/1000 px），高约 47 px |
| 5 渲染 | 已出 | 见下 |

其他观察（不判 FAIL）：
- `meadow_far_hills` 在两个比例下都 0% 可见（太低，被地形山脊挡住），山脊后面是天空球下半部；天空球下半部颜色要保持地平线色，否则会露馅。
- 底部 UI 带右下角有一块河岸 `meadow_river_bank` 的近景（5%/8%），在按钮区内，可接受。
- 角色在区域镜头里只有约 47 px 高（0.46 下 4.7% 画高），是远景能认出来、看不清表情的程度；这是区域总览镜头，属预期。
- 角色占位 `ref_girl_height_placeholder_1p626m`（Cocos z=18.8）也测了：y_min −0.404，同样 PASS。
- Grok Bot metadata 里的 NDC 数值和我这边独立算的一致（小路 bbox、spawn、门、帆毂逐位相同）。

## 建议调整（可选，由美术定）
只把 position 改成 **(-4, 24, 62)**，target 不变 (0.3151, 3.4577, -0.6059)，FOV 45：
- yaw 7.57°→3.94°，pitch −18.13°，right.y=0
- 0.75 地形边界：0 格可见（北/西/东边界采样 0/101）；0.46 也是 0
- 角色盒 0.46：x 0.087–0.161，0.75：x 0.053–0.099（更居中），y_min −0.447（余量 0.053）
- 小路网格 y_min −0.455；草甸/天空 73.3%/26.7%（0.46），70.9%/29.1%（0.75）；空洞 0；无遮挡
- 风车整体靠中间一些（门 x −0.12 / −0.07）
数值见 `check_alt_x-4.json`，渲染 `renders/alt_x-4_*`。

## 文件
- `check_original_pose.json`、`check_alt_x-4.json`：全部数值
- `grids/`：逐格射线分类
- `renders/meadow_pose_0.46_overlay.png`（460×1000）、`renders/meadow_pose_0.75_overlay.png`（750×1000），以及 `_raw`；`renders/alt_x-4_*`
  叠加：黄线 = NDC y=−0.5（下方阴影为按钮区），白竖线 = |x|=0.7，白横线 = y=0.75，蓝线 = 真地平线，品红十字 = target，橙圈 = walk_path_00–22，红框 = 角色盒，红圈 = 0.75 露出的地形边界
- `scripts/`：`meadow_pose_check.py`（数值）、`render_pose.py`（Cycles 渲染）、`overlay.py`、`inspect.py`

**not_run**：Cocos/DevTools 真机渲染、草甸在区域世界里的实际偏移（GGbot 接入时平移）、HUD 实际按钮位置、引擎天空 shader 的实际颜色（渲染用的是 Blender 材质）、动态遮挡（风车帆转动扫过角色/小路——帆在小路上方，没测逐帧）。
