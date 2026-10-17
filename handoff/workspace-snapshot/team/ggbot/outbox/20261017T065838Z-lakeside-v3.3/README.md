# lakeside v3.3（GGbot，中间产物，已被 20261017T071930Z-integration-build05-next 取代）
- 分支 `integration/build05-next-scenefix-20261017T0636`，HEAD `888daeb803e09d59528c84207b6957c14f8d3535`（基线 21c187d，仅本地）。全量测试 58/63，只有已知的 5 项失败。
- 包含 scenefix、meshopt、Array.from、加载失败提示、水色、静态合并、预热。
- 计划调整后，水色和 DC 交给 Voice Bot；对应的两个提交以可选补丁的形式放在 build05-next 的 `optional-water-dc/`。
- `near_water_swatch_proxy.png` 是近水颜色代理示意图（v3.2 实测 / v3.3 预测 / r5h3 目标），不是渲染截图。
