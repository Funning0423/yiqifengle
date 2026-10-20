# env_sky_cloudsea_soft.glb — 天空城柔和云海 + 天边远积云（场景特效bot r5 skyground）

> **⚠ 未达标，先不要接线：三角形超预算。** 天空城总数 = 基线 89,863 − 3,097（env_sky_cloudsea）− 1,036（env_sky_cumulus_far）+ 13,110（本 GLB）= **98,840**，上限是 90k，超了 8,840。
> 按要求已经把 300 m 以外的云海降了密度（144 段改为 48 段，9 圈改为 5 圈，省了 2,016 个），但还不够：新 GLB 最多只能有 4,270 个三角形。要达标，就得同时降低 300 m 以内的云海和远积云，这会改变已经验收的观感，需要先拍板。


- 文件：`env_sky_cloudsea_soft.glb`，38,988 B，sha256 `bed3ed546423a27fa3592695506822a08b44311f30904242834d3bb039238674`（final）
- 生成：`DRACO3D=<draco3d> node make_cloudsea_soft.cjs island_hull.json env_sky_cloudsea_soft.glb [extra.json]`（固定种子，结果可复现）
- 基线（只读，不入库）：`/workspace/handoff/skyground-872/env_skycity.glb`，1,569,136 B，sha1 `f25ae49908cd…`，sha256 `c8558e31ab31…`
  （注：交接里给的 "sha 开头 f25ae499" 是 **SHA-1**，sha256 是 c8558e31。）

## 内容
- 1 个节点 `env_sky_cloudsea_soft`，1 个 mesh，1 个 primitive，材质名 `M_env_palette`（GLB 内不带贴图，运行时按名字重绑到共享的 M_env_palette，与 island ui-props 的做法一样）。
- 属性：POSITION / NORMAL / TEXCOORD_0（Draco，14/8/10 bit）。UV 全部落在 env_palette_256 第 12 行（v=200/256，从长春花蓝到淡薰衣草白），没有跨行插值；亮青色的第 9 行完全没用到。emissive 贴图那一行是黑的，所以夜间完全跟着灯光走，不会自己发亮。
- 7,078 个顶点，13,110 个三角形（final）：
  - 云海 7,632 个：极坐标网格；半径 300 m 以内 144 段、每 12 m 一圈；300 m 以外 48 段，在 360/430/520/640/820 m 各一圈。起伏是 5 组波长 45–90 m 的波叠加，振幅约 3.4–5 m，远处逐渐减弱，避免锯齿。离岛越远越抬向天际线。
  - 远积云 5,478 个，共 21 团：18 团在 380–550 m 的环上；另有 3 团放在 r2 镜头视野里，final 版缩到 0.8 倍、沿视线往外推了 50 m，位置 (2,−275)、(52,−300)、(28,−350)。iter3 把远积云压低、放大了，顶部最高 y=18.0，底部压平埋进云海。
- 雾化/透视做在 UV 里：离岛越远，u 越往淡的一端靠，起伏的明暗差也越小。

## 接线（Mac 那边的 Cursor 来做）
1. 把 GLB 放到 `creator-build-project/assets/bundles/region_skycity/env_sky_cloudsea_soft.glb`（meta 由 Creator 生成）。
2. 挂载：在 env_skycity 实例的**同一个父节点**下，作为它的兄弟节点，**transform 和 env_skycity 实例完全相同**（GLB 坐标就是 env_skycity.glb 的节点空间，和 `env_sky_cloudsea` 节点一样：场景根，单位变换）。不要挂到 skycity_float_root 下面。
   - 参考：按 r2 镜头的两组坐标反推，本地→世界是绕 Y 轴 −118.83°，平移约 (58.67, 18.63, 143.83)，缩放 1。
3. 材质：把它唯一的材质重绑到共享的 `M_env_palette`（palette 贴图 env_palette_256 + emissive 贴图 env_palette_emissive_256），layer / visibility 用天空棋盘的那一层（SKY_BOARD_LAYER）。不投射也不接收阴影。
4. 天空场景里要隐藏的：
   - env_skycity 里的 `env_sky_cloudsea`（r4b 的云堤和补洞也在这个 mesh 里，会一起被藏掉）
   - env_skycity 里的 `env_sky_cumulus_far`
   - 天空棋盘里能看到的海面节点（亮青色的那块）。872 的仓库我这边没有，所以节点名请 Mac 那边按场景实际情况确认（room/island 那套里叫 `env_sea_surface`）。
   - `env_sky_cloud_small`、`env_sky_islets_far` 保留不动。
5. 相机 far clip 要不小于 1,200 m（云海最远约 830 m）。

## 检查
- 岛的水平投影（skycity_float_root 下所有几何体的 XZ 凸包）范围内：有 1,448 个云海三角形，最高 y=−32.5；**y>−8 的三角形是 0 个**。生成脚本里写了断言，违反就直接报错。
- glTF-Validator 2.0：0 错误，0 警告。glb_draco_attr_scan：accessor 和 Draco 数据一致（数量、类型都对）。
- Draw call：env_skycity 场景里一共 50 个 primitive（state_* 的前后两种状态全算上，是上限），藏掉 2 个、加 1 个，变成 **49**（藏海面的话再少 1 个）。棋盘上限 64，满足。
- 露底审计（exposure_audit.cjs，skycity，35,280 个镜头位置；远积云按审计的规则算作 IGNORE，不当遮挡，这是更严的口径）：见 qa_exposure_result.json。

| skycity 35,280 个镜头位置 | 基线（旧云海，872） | 新（藏旧云海和远积云，加 soft） |
|---|---|---|
| 真露底：看到背面或空天（任一项 >2%） | 6,487 | **676** |
|   其中看到背面（地面的底面，和云无关，两边完全一样） | 589 | 589 |
|   其中空天（void） | 5,927 | **87** |
| 只是打到正面（不算露底） | 2,088 | 2,611（原来的空天没了，只剩正面命中） |
| 和基线比：新出现的 / 更严重的真露底 | — | **0 / 0** |

只藏掉旧云海、不加新 GLB 时：void 有 8,518 个。审计时把超过 4 m 的大三角形细分（表面不变），并去掉离岛 470 m 以外的三角形（射线只有 400 m），见 qa_split_extra.cjs。

## 预览
`/workspace/yiqifengle/previews/场景特效bot/r5/skyground/cloudsea/`
- **final**：`final/cmp_r2_day.png`（带雾）。
- **iter3**：`iter3/cmp_{r2,S6}_{day,night}.png`，左边是基线，右边是 iter3。加了距离雾，是估计值：项目里没有天空城的雾参数，所有场景的 cc.FogInfo 都没启用。用的是线性 120–900 m、最大 0.6、颜色同背景。
- 早期版本：`cmp_*.png`（iter2，没有雾）。
- `iter1_*`、`iter2_*`：白天的两轮迭代。iter2 的几何就是终版，只是顶点顺序不同。
