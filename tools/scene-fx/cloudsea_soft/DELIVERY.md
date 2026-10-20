# env_sky_cloudsea_soft.glb — 天空城柔和云海 + 天边远积云（场景特效bot r5 skyground，r3fix）

- 文件：`env_sky_cloudsea_soft.glb`，38,736 B，sha256 `4981c742bbca3416bf803596a2fe7bcce0e59111878f07e2d277dc24ef57bbc5`
- 生成：`DRACO3D=<draco3d> node make_cloudsea_soft.cjs island_hull.json env_sky_cloudsea_soft.glb [extra.json]`。用固定种子，结果可以复现。
- 形状：和 cc53cc58 的三角形逐一相同（审计用的三角形列表逐字节一致），这次只改了材质、UV 和顶点色。
- 基线（只读，不入库）：`/workspace/handoff/skyground-872/env_skycity.glb`，sha1 `f25ae499…`，sha256 `c8558e31…`

## r3 截图发黑的根因
1. 旧版 GLB 没有 COLOR_0，UV 也是按 env_palette 的排布写的。
2. 天空城的 `M_sky_palette` 是 `tex_sky_palette_256`（8×8 个色块，每块 32 px，最近邻采样）乘以顶点色。项目里已有记录：开了 USE_VERTEX_COLOR、但 mesh 没有 a_color 时，颜色按 (0,0,0) 算，见 SailRide.ts:60。
3. 所以接线改成 M_sky_palette 以后，整块云海和远积云就成了黑色或深灰。
4. 另外，旧 UV（v=0.78，u=0.3–0.99）在这张调色板上落在第 6 行的绿色色块里。就算有顶点色，颜色也是错的。
5. r2 这个机位的画面上沿在地平线下 1.6°，所以截图里那片“天空”其实全是云海和远积云，不是天空背景。

## 现在的材质和顶点色约定
跟 env_skycity 里的 env_sky_cloudsea 和 env_sky_cumulus_far 一样：
- 材质名：`M_sky_palette`（GLB 里不带贴图，运行时重绑到 env_skycity 的 M_sky_palette）。
- UV：所有顶点都放在近白色块 (0.0625, 0.5475) 上，贴图颜色是 (247,244,240)。
- COLOR_0：UNSIGNED_BYTE，normalized，VEC4。Draco 里也设了 normalized 标记。颜色从波谷的 (176,196,220) 浅蓝过渡到波峰的 (250,249,241) 柔白，越远越淡。
- 属性一共 4 个：POSITION、NORMAL、TEXCOORD_0、COLOR_0。
- 注意：不要用 M_sky_cloud。它的 emissive 贴图就是调色板本身，夜里会自己发白光，基线里那面白色云墙就是这么来的。M_sky_palette 只受灯光影响，夜间会跟着变暗。

## 天空背景由谁负责
- env_skycity.glb 里**没有**天空穹顶或天空盒节点（查过所有节点名）。
- 天空背景由天空棋盘的相机清屏色负责：`SkycityBoardBackground.ts:25`，`clearFlags=SOLID_COLOR`，`clearColor=#9ccadf`，`far=1000`，`visibility=SKY_BOARD_LAYER`。
- 新 GLB 只负责地平线以下的云海和远积云，不负责天空。
- 云海最远约 830 m（相对岛中心），在 far=1000 以内。镜头靠近岛边的时候，最外圈有可能被远裁剪面切到一点，影响可以忽略。

## 接线
1. 把 GLB 放到 `creator-build-project/assets/bundles/region_skycity/env_sky_cloudsea_soft.glb`。
2. 挂在 env_skycity 实例的同一个父节点下，作为兄弟节点，transform 和 env_skycity 实例完全一样。GLB 坐标就是 env_skycity.glb 的节点空间；按 r2 机位反推，本地→世界是绕 Y 轴 −118.83°、平移约 (58.67, 18.63, 143.83)。
3. 把唯一的材质槽绑到 env_skycity 的 `M_sky_palette`（必须开 USE_VERTEX_COLOR）。layer 用 SKY_BOARD_LAYER，不投射也不接收阴影。
4. 要隐藏的节点：
   - `env_sky_cloudsea`（r4b 的云堤和补洞也在里面，一起藏掉）
   - `env_sky_cumulus_far`
   - 天空棋盘里能看到的海面节点（按 872 的场景实际情况确认名字）
5. 保留：`env_sky_cloud_small`、`env_sky_islets_far`。

## 检查
- 三角形：天空城总数 = 89,863 − 3,097 − 1,036 + 13,110 = **98,840**，上限 100k。
- 岛的水平投影范围内：1,448 个三角形，最高 y=−32.5，**y>−8 的是 0 个**。生成脚本里写了断言。
- Draw call：49（藏掉海面后是 48），上限 64。
- glTF-Validator：0 错误、0 警告。glb_draco_attr_scan：没有发现问题。
- 露底审计：形状和 cc53cc58 完全相同，审计只看几何，所以结果不变。基线真露底 6,487 → 676（其中看到背面 589 → 589，空天 5,927 → 87）；只打到正面的 2,088 → 2,611；和基线比新增和加重都是 0。详见 qa_exposure_result.json。

## 预览
`/workspace/yiqifengle/previews/场景特效bot/r5/skyground/cloudsea/r3fix/`
- `cmp_r2_day.png`：左边是 r3 真机截图，右边是 Blender 预览（M_sky_palette = 调色板 × COLOR_0，背景 #9ccadf，距离雾是估计值）。
- `r2_day.png`：只有右边那张预览。
