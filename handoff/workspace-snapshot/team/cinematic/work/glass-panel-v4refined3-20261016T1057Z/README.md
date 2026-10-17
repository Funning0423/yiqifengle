# 玻璃牌 v4 精修3（运镜bot）— 只做抗锯齿
v4r3 = v4r2（玻璃之上的 SVG 细亮边 + 顶部高光，亮度已对齐 v4）+ 玻璃本体轮廓屏幕空间 ~1px 羽化：card 加 SVG 遮罩（圆角矩形内缩 0.9 屏幕 px、高斯 σ=0.45 屏幕 px，按面板投影尺度换算到本地坐标），backdrop 模糊也一起被遮罩。角度/位置/尺寸/材质/浮动/点击框不变。
Cocos 网页构建 canvas：getContextAttributes().antialias = true（3D 场景已开 MSAA；HTML 叠加层不吃 MSAA，DOM 也没有 MSAA/FXAA 开关）。
真机方案见 COCOS_AA_NOTE.md。原型：5c54f7a 网页构建上的叠加层，无游戏代码补丁、无 SHA、未推送。
## 文件
- video/side-by-side_v4refined2_vs_v4refined3_{0.46,0.75}.mp4（DPR1，2× 最近邻放大）
- video/edge_zoom4x_float_top+bottom_v4_v4r2_v4r3_{0.46,0.75}_3xslow.mp4（DPR1，4×）；*_dpr2_3xslow.mp4（DPR2 渲染，再 2× = 同等 4× CSS 放大）
- shots/edge_zoom4x_*、sbs_*；check/jaggy_metric_dpr{1,2}.json、geometry_check.txt；scripts/run9.cjs、jaggy_metric.py
## 指标：轮廓台阶 RMS（px，越小越平滑；沿射线找最大梯度边缘、减去 4 次平滑拟合的残差）
见 check/。注意：v4r2/v4r3 有两道轮廓（玻璃边 + 细亮边/顶部高光），梯度最大点会在两道之间跳，指标偏高，不能单独当作锯齿证据。
