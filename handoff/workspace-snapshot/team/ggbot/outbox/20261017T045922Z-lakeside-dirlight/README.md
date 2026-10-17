# 湖畔灯光兜底 D1：主平行光 + 环境光，不用点光（Mac 实测 DC > 60 时用）
- 分支 integration/build05-next-dirlight-20261017T0452，基于 f60c8ec，只有 1 个提交：**6392d39e6db069a25e7e5e4b5a6fe7439abdff7f**（tree 36bbe1ee…）。只在本地。
- 268b58e（灯光精简）作废，已在它的文件夹里加 SUPERSEDED.md。
- 应用：`git fetch lakeside-dirlight.bundle integration/build05-next-dirlight-20261017T0452:integration/build05-next-dirlight-20261017T0452`（前置提交 f60c8ec），或 `git am 0001-*.patch`。

## 做法（按 lead 和 Voice Bot 商定的对应关系）
- r5h3 的几盏灯本来都是平行光（太阳），之前的 SphereLight 是近似错了。
- 主光 Sun 1.0 → **复用场景里已有的 Main Light（DirectionalLight）**，不新增。湖畔显示时改成 json 里主光的方向和颜色；隐藏或销毁时把旋转、颜色、照度、visibility 和 ambient 全部恢复。
- 黄昏侧光 SUN_dusk_side 0.31 → 并入 ambient 的天空色和地面色（偏天空一侧）。
- 冷色补光 Sun.001 0.08 → **直接去掉**，不并入。只照远山的 SUN_mtn_sky 不放（和之前一样）。
- 阴影不动：不开也不关，代码里没有任何阴影设置。
- 开关：`LAKESIDE_LIGHT_MODE = 'dir' | 'points'`（LakesideSceneData.ts）。'points' 就是 f60c8ec 原来的 3 个 SphereLight。
- 所有灯光数值都在 **`LAKESIDE_DIR_LIGHT_PARAMS`** 一个常量块里，Voice Bot 的换算值到了以后，直接替换这一处就行。

## 我推导的数值（来自 scene_r5h3_lighting.json，等 Voice Bot 替换）
| 参数 | 值 | 来源 |
|---|---|---|
| sunForward | [-0.4182, -0.3983, 0.8164] | json Sun，原样 |
| sunColorLinear | [1.0, 0.6, 0.32]（sRGB 255/203/153） | json Sun，原样 |
| sunIlluminanceScale | 1.0 × 场景当前主光照度 | handoff §5：主光归一化为 1.0 |
| ambientSkyColorLinear | [1.0, 0.55, 0.28]（sRGB 255/196/144） | dusk 光的颜色 |
| ambientGroundColorLinear | [0.5, 0.275, 0.14]（sRGB 188/143/105） | 天空色的一半，偏天空一侧（dusk 光从侧面、水平线下 13° 照来） |
| ambientSkyIllumToSun | 0.31 × 主光照度 | dusk 光的比例 |

## Draw call 估算：约 42
- B1 instancing 之后，42 种 GLB 各合成一批，基础 pass 约 42。
- Cocos 前向渲染里，主 DirectionalLight 在基础 pass 里一起算，**不另加 pass**；环境光也在基础 pass 的着色里，不加 DC。
- 原来 3 个 SphereLight 都覆盖整个场景，每盏灯让每一批多画一遍（42×3）。现在没有点光，所以只剩约 42（另加 2D UI 和天空等少量）。如果 Main Light 开了阴影，会多出阴影 pass。阴影维持现状，请在 Mac 上一起记录。

## 对比图（必看）
`lakeside_dirlight_compare.png`：
- **左**：r5h3 参考渲染 renders/lakeside_r5h3_demo_lastframe.png。
- **中**：新方案，无阴影。
- **右**：新方案，主光开阴影，仅供参考。
- 三张都是同一个棋盘相机。

⚠️ 中、右两张是 **Blender 近似渲染，不是游戏内截图**：
- 用 Voice Bot 的代理场景（render_dir.py 改自他的 render.py）：一个太阳灯（方向、颜色同上），世界光用天空色和地面色按法线渐变，强度 = 7.2×0.31/π；相机看到的背景用清屏色 #f2b98a；AgX 色调映射，曝光 +0.32。
- 没有水面 shader、3D 棋子、雾、LUT 和 Bloom，所以水面是平的调色板绿色，整体比参考图平。游戏内真实效果以 Mac 截图为准。
- 观察：暖色夕照和侧面的暖橙环境光都还在；去掉 0.08 冷补光以后，背光面偏暖、少了一点青色。
- 另外发现：桥中间那块橙色的大物体在 Voice Bot 原来的代理图里也有，参考图里没有，可能是 slim transforms 里某个实例（疑似 pavilion）摆错了位置。请运镜bot / Voice Bot 在 Mac 截图里确认。

## 测试
- 新增 lakeside-dirlight：
  - 数值和 json 一致；0.08 那盏没有出现；
  - 'dir' 模式下没有 SphereLight；
  - 复用 Main Light，不新增；
  - 显示时套用、隐藏或销毁时完整恢复；
  - 没碰阴影。
- 局限：这是源码层面的检查，不是渲染测试。
- Suite 57 项 52 项通过；没通过的只有已知 5 项。见 suite.txt。
- 包体：只改脚本，约 +1.5 KB。
