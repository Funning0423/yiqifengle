# 玻璃牌 v4 精修3.1（运镜bot）
v4r31 = v4r3（玻璃轮廓 ~1px 屏幕空间羽化遮罩 + 玻璃之上的 SVG 细亮边）+ 顶部高光两端各 15% 沿线渐隐（SVG 线性渐变），不再有两端截断的"第二条线头"。
全部预览以 DPR2（类手机）渲染：全屏对照为原生 DPR2 分辨率（不放大）；边缘特写为 DPR2 再 lanczos 2×（=4× CSS），3 倍慢放，110 帧浮动。
指标 scripts/silhouette_metric.py：只沿面板边界向外搜索（-0.4…+3 CSS px），避开内侧高光线，只追踪玻璃轮廓；单位 CSS px，越小越平滑。结果 check/silhouette_metric_dpr2.json，几何 check/geometry_check.txt。
原型：5c54f7a 网页构建上的叠加层，无游戏代码补丁/SHA，未推送。
