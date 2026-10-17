# audit-fixes 第五轮（基于 1bf0bfa）
- HEAD：511953eebda301e354149faf8e07ddde2031fbd8
- tree：195554041efeba9ab53b0de05c04827b32a8721e
- 补丁打在 1bf0bfa 上；bundle 范围 b0020ed..ggbot/audit-fixes-77b76c3；TREE_CHECK 已用 git am 和 bundle fetch 核对过。
- 只在本地提交，没有 push。被跟踪的 reports 文件没有进入任何提交。

## 提交（字节数为源码资产净变化，基线 19,121,346 B）
| 提交 | 项 | 资产 Δ | 说明 |
|---|---|---|---|
| d9f87b2 | G2b 叶子 PNG | +5,073 B | PNG 2,609 B + .meta 约 2.4 KB（.meta 不进包）。去掉 Graphics 画叶后，代码基本持平。包内预计约 +3 KB |
| c08dbf3 | N3 | +826 B | |
| 511953e | V1 补充 | +1,613 B | |
真实包体以 Mac 重建为准。

## 各项
- **G2b 叶子**
  - 根因：上一轮用 Graphics 画的叶子是单片、浅色、没有描边，和原型的风格不一致。
  - 修复：
    - 改成自己绘制的 48×48 PNG：resources/world/glass-sign-leaf.png，2.6 KB，生成脚本是 mk.py。
    - 画面内容：两片叠在一起的叶子（深 #6DBA3C、浅 #A6DB6A，每片都分成明暗两个面，偏低多边形风格），一根茎，细的深绿描边。先按 8 倍超采样绘制，再用 Lanczos 缩小，边缘抗锯齿。
    - .meta 的 uuid 固定为 848df364-a778-5f96-b167-fce358205792（uuid5 生成）。
    - 导入设置：linear 过滤、不生成 mipmap、不预乘 alpha、clamp，开启 fixAlphaTransparencyArtifacts（边缘颜色外扩，避免黑边）。
    - 显示尺寸 44 px，可见叶高约 37 px，约为 34 px 文字高度的 1.1 倍。叶子可见边缘到文字之间留 6 px，然后“叶子 + 文字”整组居中。
  - 测试：tools/test_glass_sign_layout.cjs 已更新，检查间距 5–6 px、PNG 尺寸和大小、uuid 以及导入设置。
  - 图片：
    - G2b_leaf_8x.png：叶子 8 倍最近邻放大，白天墙面和夜间墙面两种底色。
    - G2b_sign_proto_vs_after_390.png：左边是原型，右边是新牌子的 canvas 示意（s.html），不是引擎实拍，请以真机为准。
- **N3 夜间旅程中小路、彩虹桥、风车太亮**
  - 修复：沿用 N2b 的机制（夜间权重 uiNightWeight，乘在材质 mainColor 上），完全夜间时亮度 ×0.6（sRGB）。
    - meadow_path、windmill_static_merged、windmill_sails：使用材质实例。
    - 彩虹桥：材质本来就归这次旅程所有，直接改。
  - 只在草原旅程中生效。
  - 测试：tools/test_meadow_night_grade.cjs 已扩展。
- **V1 补充：回到前台后风声还拖约 1 s**
  - 修复：GameAudio 新增 ambienceQuieters / quietAmbience。离开 paused 状态时，以及每次进入 standing 时，风声和海浪都会立刻停掉：平滑值、阵风、BGM 避让都归零，音源音量设为 0 并暂停。之后到户外会再从 0 正常渐入。
  - 注册方式是防御式的，Voice Bot 的 mock 测试仍然通过。
  - 测试：tools/test_exit_restart_quiet.cjs。

## Suite
共 52 项，47 项通过。没通过的只有已知那几项：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract 失败，navigation-guard 是 BLOCKED。

## 请 Mac 验收
1. 玻璃牌：叶子在 4 倍和 8 倍放大下要和原型风格接近，边缘干净（没有黑边或白边）；间距约 6 px，整组居中；320 宽下也要看。
2. 夜间旅程中，小路、彩虹桥、风车的亮度约为原来的 0.6 倍；白天不变。
3. 出门途中切后台再回来，风声和海浪要马上停，没有约 1 s 的尾音；出门重新开始后，户外段的风声电平和 A1c 一样。
