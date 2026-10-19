# U3 加载页底图（换成 cand6 sit_hold 坐圆凳版）

只交付图片，**没有覆盖游戏工程里的任何资源，也没有改游戏代码**，由 Cursor 接入。

## 交付文件

| 文件 | 尺寸 / 格式 | 字节 | sha256 |
|---|---|---|---|
| `first_screen_composite.jpg`（合成：底图 + 标志 + 标题 + 空的风车进度轨道） | 750×1624，JPEG q91，渐进式，4:2:0 | **58,016 B** | de0a96d5…a0 |
| `loading_base_u3.jpg`（底图，没有 UI） | 750×1624，JPEG q80，渐进式，4:2:0 | **31,155 B** | cfd0779f…27c43 |
| `compare_before_after.jpg` | 前后对比：①现行线上 ②上一轮被拦下的穿模版 ③新版，下面一排是同机位的放大图 | | |
| `closeup_dress_stool_contact.jpg` + `closeups/` | 裙子和凳子接触处的特写：4 张 EEVEE 成片光照，加 7 个探测角度（Workbench） | | |
| `probe/` | 穿模探测 JSON、曝光统计、post 报告 | | |
| `tools/` | 出图和探测脚本（全部在 box 上跑，路径写死为 /workspace/u3/…） | | |

## 替换路径（三份，内容相同，由 Cursor 替换）

```
creator-build-project/build-templates/wechatgame/startup-art/first_screen_composite.jpg
creator-build-project/build-templates/web-mobile/startup-art/first_screen_composite.jpg
creator-build-project/build-templates/web-desktop/startup-art/first_screen_composite.jpg
```
- 旧文件：58,207 B，sha256 189508bc8a1c9ccce4cf6c106a0709371d9512a94d7852d9dc7fd1565456fb6a（bc81575f 里三份相同）。
- 新文件：58,016 B，比旧的小 191 B，所以主包不会变大，并且低于 60 KB 的上限。
- 同一个文件有两处在用：首屏 first-screen.js（`COMPOSITE='startup-art/first_screen_composite.jpg'`）和场景加载层 StartupLoadingLayer.ts（先接 `__firstScreen.images`，拿不到再用 loadRemote）。文件名不变，所以两处代码都不用改。
- 裁切方式不变：cover，s = max(W/750, H/1624)，居中。标志、标题、轨道的位置和 `art-src/board-ui/a-loading/first-screen/coords.json` 一致：logo 0.78 倍，中心 (389,340)，左上角 (343,292)；title 0.92 倍，中心 (375,452)，左上角 (159,385)；bar_track 左上角 (127,1271)，中心 y 1293。叠加方法和 `first_screen.py` 第 1 步相同（`tools/u3_compose.py`），也是从 q92 往下找，只是上限从 60000 收紧到不超过旧文件的 58,207 B。

## 角色与场景

- 角色：`previews/角色建模bot/r5-sit-drape/chr_b_r5g2_sitdrape_cand6_sithold_sleevetex.glb`，3,128,812 B，sha256 `7604ebc2b4eec23406beef49d495ae452174b72cb549debf2790762e1fdf23a9`（已核对）。
- 姿势：sit_hold 第 0 帧。morph 取 anim_meta clips.sit_hold 在 t=0 的值：DRESS、APRON、BOW 的 sit_drape = 1；DRESS 和 APRON 的 hand_rest_support = 1；BODY 的 corrective_stand_up_0 和 corrective_shoulder_surface_relax = 1；BOW 的 cloth_rise_clearance = 0。
- 场景 bc81575f：
  - 房间 room_no_original_chair.glb；
  - 凳子 reading_chair.glb，放大 1.2 倍，yaw −2，位置 (0.32125, 0.000126, −4.25912)；
  - seatedRoot (0.43273, 0, −4.20761)，yaw −2，角色缩放 1；
  - **根节点没有做任何微调**（droot = 0）。
- 机位：RegionCameraData sitting-room 的 home 机位，和旧版相同。位置 (−1.32022, 1.38613, −2.11374)，四元数 [−0.02962, −0.26046, −0.00800, 0.96500]，竖直 FOV 75°，shift_y −0.14。

## 光照与材质（沿用运镜bot 旧 loading-base/render_base.py）

- 引擎和色彩：EEVEE（BLENDER_EEVEE_NEXT），32 采样，**AgX**，曝光 0，Look None。
  - 旧版本身不过曝：旧 raw 黄裙 p95 208，削顶 0%。所以按规则保留 AgX，没有降光。
- 光源：
  - 世界光：颜色 (1.0, 0.93, 0.82)，强度 0.9；
  - 平行光：3.0，颜色 (1, 0.90, 0.74)，角度 12°，旋转 (55°, 0, −120°)，不投影；
  - 面光：120 W，颜色 (1, 0.93, 0.84)，尺寸 3，放在机位上方 0.6 m、朝向和镜头一致，不投影。
- 景深：f/1.8，焦点在她身上（root 处高 1.0 m）。
- 材质修正和旧版相同：
  - 去掉 Alpha 连线，全部改为不透明，但 glass、sky、cloud、foam、beam、halo、glow、window_view 保留；
  - M_env_palette 去掉自发光；
  - 隐藏灯塔光束、月亮和 col_*。
- 后期：post.py 的 final 参数（bg_sigma 7、girl_sigma 2.2、cream_mix 0.16、lift 14、veil 0.42、mist 0.88、sat 0.86）。底图用 fs50k 规格（q80）。
- 黄裙亮度：

| | p5 | p50 | p95 | 削顶 |
|---|---|---|---|---|
| raw | 184.9 | 201.9 | 208.4 | 0% |
| 成品 | 194.6 | 207.2 | 213.0 | 0% |

  - 人物整体：p95 216.2，削顶 0%。
  - 整帧 p95 238 来自底部本来就有的奶油色雾带，和旧版一样。

## 穿模数字（cand6，bc81575f 场景）

- 和圆凳（StationaryReferenceRoundStool）的三角相交：APRON 0，BODY 0，BOW 0，DRESS 0。
- 和凳面的最小正距离：DRESS +4.43 mm，BOW +3.44 mm，BODY +9.84 mm，APRON +85.8 mm。凳面以下、凳面圆盘内没有任何顶点。
- 径向启发式标出 BOW 有 5 个顶点距凳子 ≤10.3 mm，但它们到最近表面的距离都是正的。原因是凳子是开放网格（918 条边界边）、凳沿剖面的半径取样不准，不算穿模。
- 和房间：
  - env_interior_props_merged：0 个三角重叠。报告里"在内部 0.30 m"是法线方向判断的假象。
  - env_interior_shell：BODY 有 70 个三角重叠，深 0.13 mm，是鞋底贴着地面（z≈0），可忽略的表面接触。
- 手臂、手和衣服之间：APRON、DRESS、BOW 都是 0 相交，最小距离 2.6 mm。
- 肉眼检查了 7 个放大角度（A、B、C、E、F、G、H，和 blocked_penetration 同一套）以及 4 张 EEVEE 特写：裙子搭在凳面上，前沿自然垂下，蝴蝶结垂带从凳沿外侧垂下。没有穿模，也没有靠遮挡来藏。
- D（右侧）机位在墙里，看不到东西，和上一轮一样不用。

## 没有测试的部分

- 没有放进真机或 Cocos 运行时里看，只在 box 上离线渲染。
- 运行时的风吹、飘动 morph 没有叠加，只用了 sit_hold 第 0 帧。
- 光照是离线近似（沿用旧 loading-base 的设置），游戏里只有 Main Light 和环境光，没有逐像素对比游戏截图。
- 没有在 16:9 和其他机型上重新做裁切检查。cover 方式和元素坐标都没变，所以应该和旧版行为一致。
