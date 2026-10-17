# 真机（Cocos Creator 3.8.8 / 微信小游戏）玻璃牌抗锯齿方案说明（运镜bot）

## 推荐：面板 shader 内 SDF / alpha 斜坡边缘（首选）
- 面板做成一个四边形（quad）网格，片元着色器里算胶囊圆角矩形的 SDF：`d = sdRoundRect(uv*size, halfSize, radius)`，
  `alpha = 1.0 - smoothstep(-w, w, d)`，其中 `w = fwidth(d)*0.75`（屏幕空间约 1px 过渡，和透视、缩放无关）。
- 细亮边同样在 shader 里用 SDF 画：`line = 1.0 - smoothstep(0.0, fwidth(d)*1.0, abs(d + inset) - halfWidth)`，天然抗锯齿、浮动时不爬行。
- 需要 `OES_standard_derivatives`（WebGL1 扩展，微信基本都支持；WebGL2 内置）；不支持时退化为用 uv 尺度估算的固定宽度。
- 材质开启 alpha 混合（Transparent 队列），关闭深度写入。
- 性能：只多几条 ALU 指令，只作用在面板覆盖的像素（约 120×60 pt）上，中端机上可以忽略（<0.1 ms）。这是这个原型 v4r3 的做法在 Cocos 里的对应实现（原型里是 CSS 遮罩羽化 + SVG 描边）。

## MSAA（相机/渲染器设置）
- 3.8 的 Web/小游戏端 MSAA 取决于 WebGL 上下文的 `antialias`（项目设置 → Macro/渲染里的 ENABLE_WEBGL_ANTIALIAS，以及微信端 `wx.createCanvas` 默认上下文）。
  本次查到网页构建 5c54f7a 的 canvas 已经是 `antialias: true`，所以 3D 场景几何边缘本来就有 MSAA；玻璃牌目前是 HTML 叠加层，不吃这个 MSAA。
- 对整屏开 4x MSAA：中端安卓（Adreno 6xx / Mali-G5x）通常增加约 5–15% GPU 时间和更多带宽；在小游戏里还会因为 RenderTexture/后处理链导致 MSAA 失效（需要 resolve）。
- MSAA 只解决几何边，不解决 alpha 测试/贴图内部的边，所以对"透明面板 + 细线"帮助有限。

## FXAA（后处理）
- 3.8 自定义渲染管线可加 FXAA pass：整屏一次全屏 pass，中端机约 0.5–1.5 ms（1080p 级），会让文字和细线略微发糊，而且细亮边在浮动时仍可能闪烁（FXAA 是每帧独立的，不做时域处理）。
- 只为一块面板开整屏 FXAA 不划算。

## 结论
面板用 SDF 边缘 + SDF 细亮边（成本最低、最稳定）；场景保持现有 WebGL antialias 设置；不建议为这块面板专门开 FXAA 或改 MSAA 倍数。
