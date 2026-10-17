# 玻璃牌 v4 精修版（运镜bot，2026-10-16）
Funning 选回 v4。几何/材质完全照 v4（中心 (0.05,1.02,−4.70)、世界轴平面斜放、0.80×0.28 m、blur 14px+saturate 1.4、同一渐变/字/投影/浮动/点击时序），只改边缘渲染：
- 去掉 1.5px CSS border（透视 matrix3d 下与顶部内高光叠成双线、阶梯锯齿），改为一道带 0.9px 柔化的 inset 细亮边 + 0.9px 外缘抗锯齿晕；顶部内高光加 0.6px 柔化。
- 合成层提示 will-change:transform / backface-visibility:hidden；投影移到独立层。
- 浮动相位绑定虚拟时钟（v4 原脚本按真实时间起算，两次录制相位不同），两栏逐帧同步。
## 性质
- 原型：5c54f7a 网页构建上的 HTML 叠加层，不是 Cocos 真 3D 网格；没有游戏代码补丁，没有 SHA/tree/分支，未推送。需在 Cocos 正式实现。
## 文件
video/side-by-side_v4_vs_v4refined_{0.46,0.75}.mp4（360×780 / 390×520，2× 放大，30fps，滑动→点击→出门）；shots/sbs_*、shots/edge_zoom4x_*（边缘 4× 放大）；check/edge_metric.json、*_tap-box.json、info.jsonl；scripts/run7.cjs（录制，变体 v4|v4r）、edge_metric.py。
