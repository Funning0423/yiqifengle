# 草甸 v7.7：鸟航线改到可见带 + 近云顶点色修正（候选，未推送）

- 分支 voice/meadow-birds-v7_7，基于 aabd8a2（PR #58 头），commit 1d9d485d961b372c0ab36aab8da4d0e003674f60，tree 6bc8579639d5de71bdbff0e90a1ede696b2ce2dd
- patch：outbox/patches/meadow-birds-v7_7/0001-*.patch（--binary，已在干净的 aabd8a2 上 git am 验证，tree 一致）
- 只改了一个文件：creator-build-project/assets/bundles/region_meadow/env_meadow.glb，7,076,792 → 7,076,868 B（+76 B，只是 JSON 里的 min/max 和 scale）。数据都是原地覆盖，没有新增 accessor。
- glTF Validator：0 error / 0 warning（gltf_validator_v7_7.txt）。节点名、节点数、动画名都没变。素材全部自制。

## 镜头和 UI 区域（都从 aabd8a2 的代码里读）
- 镜头：MeadowSceneData.ts PORTRAIT [0,24,45]→[0,4,4]，竖直 FOV 49.426°（render_v77.py 用 git show aabd8a2 读取）
- UI：ui/BoardLayout.ts。参考机 390×844（胶囊 y51–83）：暂停键 (38,67)，标题牌 y96–156，棋盘 tray y212–588（pitch 42.6），道具栏 y730。375×812 时标题牌和棋盘的 y 一样，道具栏在 y698。
- 可见带：标题牌下沿 156 到棋盘上沿 212。

## 鸟
- 只改 meadow_birds_loop 里 meadow_birds_root 的平移关键帧，加上节点静态 scale：
  - 根节点 scale 0.5，鸟群更紧凑也更小
  - meadow_bird_03/04 的 scale 设为 0，只留 3 只鸟
- 航线：距镜头约 45m（在风车前面，不会被风车挡住），从左往右慢慢飞，上下轻微起伏 ±3pt。
  - 速度约 34pt/s。20s 循环里约 3.1–16.1s 在画面里
  - 18–20s 从镜头后方绕回左边，绕回时不会穿过画面
- 逐顶点投影检查了整个循环（每 0.05s 一次）：
  - 390×844：可见部分 y 176–205，始终在 156–212 之内
  - 375×812：y 170–197
  - 不会碰到标题牌、暂停键、胶囊和棋盘
- 改前：鸟在 y≈40–70，在标题牌上面那条天空里，很小，而且被暂停键和右上的云挡住，所以 Mac 录屏里看不到。

## 近云 COLOR_0（顺便查的，同一个 commit 里修了）
- v7.6 里 meadow_clouds_near（M_meadow_cloud，unlit）的 COLOR_0 是 FLOAT VEC3，不是 normalized，存的是 glTF 规范要求的线性值：
  - min (0.102, 0.165, 0.220)，max (0.831, 0.888, 0.863)，平均 0.58–0.65
  - 至少 5% 的顶点是最暗的底色
- Cocos 3.8 builtin-unlit 的片元着色器是 `o.rgb *= SRGBToLinear(v_color.rgb)`，也就是把顶点色当 sRGB 处理。结果线性值又被压暗一次：
  - 顶部显示成约 212 的灰
  - 底部约 26，接近黑
  - 这和录屏里“深灰到黑色”的云对得上
- 修正：把顶点色原地转成 sRGB 编码，现在 min (0.353, 0.443, 0.506)、max (0.922, 0.949, 0.937)。在 Cocos 里会显示成原本设计的颜色：白顶，灰蓝底约 #5A7181。
- 材质本身没动。GGbot 的夜色权重（白天要归零）还是要照常检查。
- 注意：Blender 按规范把顶点色当线性处理，所以预览图里改后的云看起来偏亮偏白，最终要看 Cocos 里的效果。

## 预览（Blender Cycles，真实镜头）
- renders/before_after_t04s/t08s/t12s/t15s.png：全屏 750×1624，左边改前，右边改后。紫框是 UI，黄框是可见带。
- renders/meadow_birds_v7_7_noui_truecam_20s_loop.mp4：不带 UI，20s 一整个循环，390×844，10fps，按真实时长。
- 单帧原图：renders/{before,after}_fXXXX.png
- 还没在 Creator 或真机上导入过，需要 Mac 重录确认。
