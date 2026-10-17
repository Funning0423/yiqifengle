# 人物运行时包（INTERIM 临时版）· 20261009T2125Z · grokbot-2

> **INTERIM：这是临时包，用来先把 Cocos 里的占位胶囊换成真正的女孩。** 等 pass2b（正在另一个工作目录里修坐姿裙子/手/下巴发线）验收通过后，会出正式包整体替换本包。请不要在本包的模型上做任何手工修改。
> 规矩不变：不上传、不发布微信。

## 1. 包内文件

| 文件 | 字节 | SHA256 |
|---|---|---|
| `chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb`（**唯一需要导入 Cocos 的文件**，贴图已内嵌） | 1,653,520 | `054da436278dd48f1165e3c4f58be1ce100d85a4f86420725e4d6bbb46e99112` |
| `textures_reference/T_G2_APRON_512.jpg`（512²，仅供查看，GLB 内已内嵌同一份字节） | 19,926 | `2f9b38b7c19179dadea1a1c970f6309426791d1317f8fec5d22550a75e9a11ba` |
| `textures_reference/T_G2_FACE_1024.jpg`（1024²） | 47,244 | `d8d8c5e9c24d66e374af5c0157bcbcc297cf057eff727d1d895e137c397d3f29` |
| `textures_reference/T_G2_HEAD_1024.jpg`（1024²，含草帽/粉色帽带） | 124,068 | `527a408bec90e974b88154f5287e167e14504e220532d06ee6ddbf4ab0cb08c3` |
| `textures_reference/T_G2_BODY_1024.jpg`（1024²） | 158,319 | `ac392fe812ba7a5b9b987bb90fcfe7a06972f644fd30f44b2d236091a6050e74` |
| `textures_reference/T_G2_DRESS_1024.jpg`（1024²） | 57,745 | `4ab469abe9f34c482a128cfb8690430c225386b5383433219e66bba30573162a` |

其余：`reference/`（pass2 报告、坐姿骨骼数据 `p2_poses.py`、坐姿/穿模检查 JSON），`verify/`（缩放烘焙脚本、Blender 复检脚本和结果），`SHA256SUMS.txt`（包内全部文件）。

**`textures_reference/` 不要导入 Cocos**，否则会多出一份重复贴图进包体。

### 和 pass2 原始 GLB 的关系
- 原始文件：`art/character/r5-fix-g2/pass2/export/chr_b_r5g2_lod0_anim_pass2_grokbot2.glb`（1,653,348 B，SHA256 `2272152b…cc34d3`），**未改动**。
- 本包 GLB 只做了一件事：把根节点 `B_SINGLE_WORLD_ROOT_SOURCE_K` 上的缩放 K=1.061164379… **烘焙进**顶点坐标、逆绑定矩阵、骨骼节点平移和动画平移曲线里，根节点缩放变成 1（按 GGbot 的约定：根缩放统一为 1，不叠加 1.061/1.415）。外观尺寸完全不变：Blender 4.5.14 重新导入后，两套动画 5 个帧（1/31/61/91/121）上全部顶点的世界坐标与原始 GLB 最大差 0.00000058 m。贴图字节、网格拓扑、材质、动画关键帧时间都没变。
- **Icosphere 不是模型里的东西**：GLB 里只有 31 个节点（26 骨骼 + 3 网格 + 骨架 + 根），没有 Icosphere。它是 Blender 的 glTF 导入器自己生成的骨骼显示形状（放在 `glTF_not_exported` 集合，作为 26 根骨骼的 custom shape），不会进 Cocos。所以没有需要删的杂物。

## 2. 规格（Blender 4.5.14 重新导入 + 直接解析 glTF 核对）

- 坐标：glTF 标准 **Y 轴向上、单位米、正面朝 +Z**（围裙平均 z=+0.118）。Cocos 也是 Y 向上，导入后不用旋转；Cocos 默认相机看向 -Z，所以放在相机前方时人物正面朝向相机。
- 根节点缩放：**1**（见上）。所有骨骼节点缩放≈1。
- 尺寸（静止姿势）：总高 **1.7253 m（含草帽）**；头发顶 1.644 m；脚底 y=0。包围盒 x −0.289~0.300，z −0.186~0.209。
  - 注意：Funning 定的默认身高 1.626 m（不算帽子）。当前模型不含帽子约 1.644 m，差约 1.8 cm；而去掉 K 之后的含帽总高恰好是 1.626 m。最终按哪个比例由 pass2b/运镜bot 定，**本临时包保持原样不改尺寸**。
- 骨骼：**26 根**（皮肤名 `R5G2_RIG_22P4`），低于 64 根上限：
  `root, hips, spine, chest, neck, head, upper_arm.L, forearm.L, hand.L, upper_arm.R, forearm.R, hand.R, thigh.L, shin.L, foot.L, thigh.R, shin.R, foot.R, skirt.front, skirt.front.low, skirt.left, skirt.left.low, skirt.back, skirt.back.low, skirt.right, skirt.right.low`
  （22 根标准骨 + 4 根 `skirt.*.low` 裙摆下段辅助骨。）
- 蒙皮权重：每个顶点 **≤4 个**，只有 JOINTS_0/WEIGHTS_0（无 JOINTS_1），权重和全部为 1。
- 网格：3 个网格 6 个图元（6 个 draw call），共 24,542 三角面：BODY 18,044（材质 FACE/HEAD/BODY/HAIR 4 个图元）、DRESS 5,399、APRON 1,099。BODY 带 COLOR_0/COLOR_1 顶点色属性（可忽略）。
- 材质：6 个。`M_G2_APRON`、`M_G2_DRESS`、`M_G2_HAIR` 是**双面**；`M_G2_HAIR` 没有贴图，只有底色（深海军蓝）。导入后请确认这三个材质的剔除是 None（双面），否则裙子、围裙内侧和发壳会穿透看到背面。
- 贴图：5 张，全部 **JPEG 内嵌**在 GLB 里（1×512² + 4×1024²），采样器线性 + mipmap。

## 3. 动画片段

GLB 里只有两个片段，都是**原地**循环（root 不位移，无动画事件），**120 帧 @30fps = 4.0 s**，首尾关键帧相同：

| 片段名 | 内容 |
|---|---|
| `idle_breathing_loop` | 站立呼吸：胸/脊柱微动、颈和头反向微动、手臂和裙摆轻微摆动 |
| `wind_sway_loop` | 风吹裙摆：只动 8 根裙骨，风向人物左侧（+X）略偏前，下摆左右约 ±5~8 cm |

glTF 里关键帧时间是 0.0333~4.0333 s（Blender 第 1 帧起）。如果 Cocos 里循环接缝有 1 帧停顿，在导入设置的动画分段里把起止设为 0.0333~4.0333 s 即可。

**目前没有坐下/起身/走路/开门的片段。** 这些会由运镜bot 在 Blender 里做好、把位移烘焙在根骨上（root motion）后单独交付，命名为 `cine_open_*`（出门：如 `cine_open_stand`、`cine_open_walk`、`cine_open_door`）和 `cine_home_*`（回家），并附 `*.timing.json`。在那之前，房间里不要自己做坐/走的动画。

**坐姿**目前只是骨骼数据，在 `reference/p2_poses.py` 的 `POSES['sit']` 里（Blender 坐标，Z 向上；root 下移 0.555 m、大腿 -88°、小腿 86°、裙骨张开等），**不是 GLB 里的片段**。Cocos 里暂时无法直接让她坐下；开场先用站立 + `idle_breathing_loop` 代替，坐姿等 pass2b 和运镜bot 的 `cine_open_stand` 片段。

## 4. 放进 Cocos 3.8.8 工程的建议做法

1. 把 GLB 放到 `assets/bundles/region_island/character/`（跟开场场景同一个分包，不进主包；本 GLB 约 1.65 MB）。
2. 在 GLB 的导入设置里：动画片段 `idle_breathing_loop`、`wind_sway_loop` 的循环模式设为 **Loop**；材质如需调整，用导入器的「提取材质」后再改，不要改 GLB 本身。
3. 新建预制体（建议 `assets/bundles/region_island/character/chr_girl_interim.prefab`）：把 GLB 拖进场景，得到的根节点下挂 **SkeletalAnimation** 组件（导入的模型通常已自带）：
   - `clips`：上面两个片段；
   - `defaultClip`：**`idle_breathing_loop`**，勾选 `playOnLoad`；
   - **`useBakedAnimation = true`**（预烘焙，微信上性能更好）。
4. 用这个预制体替换原来的占位胶囊，挂在原来胶囊的位置（`seat_anchor` / `door_stand_point` 等锚点不变）。预制体根节点缩放保持 1，不要再乘 1.061 或 1.415。
5. 想看风吹效果，可以临时把 defaultClip 换成 `wind_sway_loop`；两者都是原地动画，切换不会挪动人物。
6. 以后 pass2b 正式包到了，直接替换同一路径的 GLB（文件名会变），预制体里重新指定即可。

## 5. 测过什么 / 没测什么

| 项目 | 状态 |
|---|---|
| Blender 4.5.14 重新导入：26 骨、≤4 权重、根缩放 1、+Z 朝向、高度、2 个片段 | **通过** |
| 烘焙缩放前后逐顶点对比（2 片段 × 5 帧，最大差 5.8e-7 m） | **通过** |
| 直接解析 glTF：权重和=1、无 JOINTS_1、贴图 JPEG 内嵌 | **通过** |
| pass2 时的穿模检查（站立/走路姿势、风吹循环每 10 帧：0 处腿穿出裙子、0 处手臂进衣服） | 通过（pass2 原始数据，见 `reference/`） |
| Cocos 3.8.8 导入、预制体、播放动画 | **not_run** |
| 微信开发者工具 / 真机 | **not_run** |

## 6. 已知问题（都会在 pass2b 修）

1. **坐姿裙子太鼓**：坐下时裙子在椅子上撑成臃肿的钟形（坐姿只在骨骼数据里，本包不受影响，但别拿它做开场坐姿）。
2. **坐姿时手陷进围裙**：手和前臂最多陷进围裙/裙子约 17 mm。
3. **下巴附近发线有锯齿**：减面后发壳下沿在下巴/脸颊处有轻微台阶，近景能看到一条细暗线，游戏距离下基本看不出。
4. 风吹摆幅偏小；脸部红晕偏淡（都是可调参数，不影响接入）。
5. 坐姿时大腿底部离 0.38 m 椅面约 7 cm（继承自 R5 坐姿偏移），等 Oi 那边的座位锚点核对。
