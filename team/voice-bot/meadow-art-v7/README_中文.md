# 草甸 v7 候选（Voice Bot，2026-10-15）— 风车配色、生气、光影层次
**只是候选，未换进游戏，需 Funning 选定。** 输入 v6（云、草色、风车造型、小路不动）。全部几何脚本自制，无外部素材。

## 1. 风车配色（调色板 + UV）
在 meadow_palette_256.png 中没有任何网格使用的 8×8 像素块里新画 16 个颜色块（位置/颜色见 v7_cells.json），PNG 仍为 256×256 RGB。只把 windmill_static_merged 和 windmill_sails 的 UV 指到新色块，其他网格的 UV/颜色不受影响。
- 塔身：暖奶白 (0.99,0.90,0.72)，上半/底面略深 (0.95,0.83,0.64)
- 屋顶、小屋屋顶：砖橘红 (0.86,0.40,0.22)，檐下深砖红 (0.66,0.29,0.18)
- 腰带/檐口/台阶：浅木色 (0.84,0.66,0.42)/(0.72,0.53,0.32)
- 门、窗框：青绿 (0.16,0.62,0.64)/(0.10,0.45,0.48)
- 叶片格栅：浅木色；帆布：暖白 (0.99,0.95,0.86)
UV 对应关系明细见 v7_build_report.json 的 windmill_remap / sails_remap。

## 2. 生气（新节点，全部挂在 scene_root 下；现有节点、锚点、windmill_sails_loop 不变）
| 节点 | 说明 | 动画 |
|---|---|---|
| meadow_vb_flowers | 静态合并网格：28 丛、291 朵黄/粉/白小花（花头朝向游戏相机倾斜，带花心），在风车脚和小路两侧；距路中心线 ≥1.45 m（路半宽 1.14 m），避开塔身 3.35 m、小屋和门口台阶；茎底埋入地面 4 cm | 无 |
| meadow_butterfly_00..02 + _wing_L/_wing_R | 3 只蝴蝶（黄/橙/白），在出生点前方草地上绕 8 字飞 | **meadow_butterflies_loop**（8 s，翅膀 6 Hz，首尾帧相同） |
| meadow_birds_root → meadow_bird_00..04 + _wing_L/_wing_R | 5 只鸟的鸟群，远处 y≈150、高 ≈60 m，从 x −90 飞到 +90（两端在画面外） | **meadow_birds_loop**（20 s，扇翅 1.5 Hz；循环时在画面外跳回起点） |
| windmill_flag_pole → windmill_flag_seg_0..2 | 屋顶尖上的小红旗（旗杆埋入屋顶 0.25 m），3 段链式摆动 | **windmill_flag_loop**（2 s） |
全部是节点 TRS 动画（无骨骼、无变形），时间从 0 s 开始。GGbot 接线：在 prefab 的 Animation 组件里加这 3 个 clip，WrapMode=Loop，并在 MeadowBoardBackground 中与 windmill_sails_loop 一样由 MeadowSceneMotion 控制暂停（现代码会把导入的 Animation 关掉：`a.playOnLoad=false;a.enabled=false`，需要显式播放）。

## 3. 光影层次
- 地面贴图 meadow_ground_v0_8_1024（草根颜色也取自它）：在风车塔脚（半径 2.9 m 外 1.5 m 衰减）、小屋四周（1.1 m 衰减）加接触阴影，并沿主光方向在塔后加一块柔和的偏冷长影（乘 (1,0.88,0.55)×强度，最多 −60%），约 1 万像素受影响。分辨率/格式不变（1024² JPEG q80）。
- 预览灯光与 v5 相同（Cocos 对应映射见 v5 README）。预览专用修正：调色板贴图在 Eevee 里用 Linear 过滤会出现大量噪点（Workbench 下没有），所以预览渲染里把它设为 Closest；这只影响预览，不改 glb。前后对比都用同一设置。
- **建议的 Cocos 灯光改动（未改场景文件，仅建议）**：
  - WorldR5Integration.scene 主方向光颜色改为暖白 #FFF1DC（现在纯白），强度不变；
  - MeadowKeyLight（MeadowBoardBackground.ts）颜色可从 #fff3da 稍暖到 #ffe9c8；
  - Ambient skyColor (51,128,204) 偏冷，建议把 groundAlbedo 从 (51,51,51) 提到暖绿 (90,110,60)，让暗面带一点草地反光；
  - 草原背景相机 clearColor #87bfc9 不变。

## 4. 大小（详见 size_table_v7.txt）
| 项 | v6 | v7 |
|---|---|---|
| glb 总计 | 6,606,360 B | 6,968,428 B（+362,068 B，约 +0.35 MiB；相对原版 +559,096 B） |
| 调色板 PNG | 2,511 B | 2,540 B |
| 地面贴图 JPG | 138,578 B | 138,784 B |
| 其余贴图 | 不变 | 不变 |
| 新网格顶点（glTF） | — | 花 6,693；蝴蝶+鸟+旗 187 |
| 动画 | sails 1 通道 | + butterflies 12 通道×193 键（≈35 KB）、birds 16×241（≈57 KB）、flag 3×49（≈2.5 KB） |
花网格是新增的最大头（约 0.25 MB）；若包体紧张可减少花丛数或由 GGbot 改成 GPU instancing。

## 5. 预览
- renders/cmp_08_gameplay_portrait.jpg：原版（左）对 v7（右），750×1624，CAM_spawn_pov，第 210 帧（30 fps）
- meadow_v7_portrait_gameplay_15s.mp4：540×1170、30 fps、15 秒，游戏相机，含叶片、旗、蝴蝶、鸟群
- renders/video_frames_30_180_300_420.jpg：视频抽帧；renders/after_flowers_foreground_crop.jpg：前景花特写

## 已知弱点（诚实）
- 蝴蝶在游戏相机里很小（只有几个像素的彩点），不仔细看不出；鸟群只在视频后半段（约 9–15 s）进入画面，也比较小。
- 前景的花朵偏大偏"平面贴纸"感（五边形花头）。
- 塔脚的接触阴影和长影从游戏相机几乎看不到（被草和塔身挡住），主要在俯视/环绕时可见；本次没有单独出这张近景。
- 塔身在冷色天光下仍略偏灰白，暖色要配合上面建议的 Cocos 灯光改动才更明显。
- 鸟群循环是在画面外"跳回"，不是首尾连续的位置；如果镜头更宽可能看到。
- 动画需要 GGbot 在代码里显式播放；现代码默认关闭导入的 Animation。
