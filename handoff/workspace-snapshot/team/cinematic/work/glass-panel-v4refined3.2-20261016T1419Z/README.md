# 玻璃牌 v4 精修3.2（运镜bot）
v4r32 = v4r2 的玻璃轮廓（不加 3/3.1 的外缘羽化遮罩）+ 3.1 的顶部高光两端各 15% 渐隐。其余（角度/位置/尺寸/材质/浮动/点击框）不变。
全部 DPR2 渲染；全屏对照原生 DPR2；特写 lanczos 4×（CSS），3 倍慢放，110 帧浮动。
指标 scripts/silhouette_metric.py（只沿边界向外搜索，忽略内侧高光线）→ check/silhouette_metric_dpr2.json；几何 check/geometry_check.txt。
原型：5c54f7a 网页构建上的叠加层，无游戏代码补丁/SHA，未推送。
