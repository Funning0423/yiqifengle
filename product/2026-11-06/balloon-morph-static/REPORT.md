# 同拓扑瘪气端点：一次静态试验（未通过）

非引擎。Python 光栅，不是 Cocos 画面，不是 `liveWorldPose`，不是真机。只抽样权重 0、0.5、1。这三帧不能证明中间整段插值；样本之间仍可能再穿插。这一次端点没有通过，停在这里，不再改高度或折幅。正式 `transport_balloon.glb` / `.meta` / 子资源 uuid、运行时代码和 PR72 的 A/B 都没有改。

## 结论

权重 0 与气囊文件的位置、法线、UV 一致（最大绝对差 0）。168 组共位 UV 缝在 0、0.5、1 的缝隙都是 0，没有把缝拉开。

权重 1 在登艇画面里是一条从嘴部垂进吊篮的扭带：大红、大黄平面，上面还剩一块圆顶。不是松垮、局部搭覆的布。非邻接三角互穿：权重 0 为 0 对，0.5 为 68 对，1 为 2633 对。重叠没有脱离明显互穿。按这次试验的停机条件，端点不成立，不能进入下一阶段。

这只否定这一条预先写好的折法。24×12 的经纬网格、子午边大约 0.4–1.0 m，不能据此写成「任何同拓扑形变都做不到」。要再试必须另批端点，不能在这次结果上改参数。

## 相机（篮子坐标系）

| 项 | 值 |
|---|---|
| eye | (4.858393277797973, 1.55, 5.895614309156518) |
| lookAt | (−0.072, 0.95, 1.25) |
| 垂直 FOV | 46° |
| 画幅 | 390×844，宽高比 390/844 |
| up | +Y |

出处：`BasketCloseShot.basketCloseSpot(TRANSITION_STAGING.basket.doorOut, [0,0,0], 无遮挡盒, 不传 prefer)`。`sideDeg` 的第一项 50 胜出。`basketClosePose` 看向门外站位脚 + `lookUpM` 0.95，`fovDeg` 46，`upM` 1.55。390×844 是 `BalloonTransit.ts` 在 `view.getFrameSize` 缺失时的回退（`fw||390, fh||844`）。

没有套上的运行时：`liveWorldPose`、从 `plan.camera(0)` 的混合、草地遮挡盒、`lensClearStep`。光栅近裁剪是 `render_balloon_inflate.py` 里的 0.08 m；游戏相机近裁剪是 `CAMERA_FIXED.near` 0.05。投影不是同一个。

近景三张是这三帧里吊篮+吊架的同一块像素，没有第二台相机，也没有放大。裁切框 (169, 92)–(390, 583)。

## 这一次端点怎么放的

气囊焊接后是闭合的 24 瓣 × 12 环，另加嘴盖（y=3.9，只连 y=3.05）和冠点（y=10.4，只连 y=10.3）。共 290 个位置、490 个顶点（168 组 UV 分裂）、576 三角。子午链从嘴环出发，每一步保持原来的边长，折进篮子；同一位置的 UV 副本用同一位移。嘴环和嘴盖不动，所以满气嘴与吊架的距离被原样留下。冠点放到 y=10.3 环的重心，避免留在 10.4 m 高处拉出长钉。

## 0 / 0.5 / 1 抽样

顶点到顶点，不是连续接触证明。互穿只计不共享顶点的三角，边刺进对面三角，并且不把端点贴边算进去。

| 权重 | 与文件位置/法线 | 缝隙 | 非邻接互穿 | 嘴环到吊架 | 气囊到篮沿顶点 | 气囊到杆顶点 | 低于地板 y=0.10 |
|---|---|---|---|---|---|---|---|
| 0 | 0 / 0 | 0 | 0 | 最近 0.0198 m，48 里 16 个 ≤5 cm | 最近 1.94 m | 最近 0.0198 m（就是嘴环） | 0 |
| 0.5 | — | 0 | 68 | 同上（嘴没动） | 最近 1.76 m | 最近 0.0198 m，中位 1.06 m | 0 |
| 1 | — | 0 | 2633 | 同上 | 最近 0.058 m，≤5 cm 为 0，≤15 cm 为 27 | 最近 0.0198 m，中位 0.48 m | 0 |

权重 0 的篮沿距离大，是因为满气嘴在 y=3.05，篮沿大约 y=1.12，布本来就不挨篮沿。权重 1 的嘴距是原网格，不是新的瘪气接触。杆的最近距离同样来自没动的嘴环。

## 图和数据

- `product/2026-11-06/balloon-morph-static/board-wide-w0.png`
- `product/2026-11-06/balloon-morph-static/board-wide-w0.5.png`
- `product/2026-11-06/balloon-morph-static/board-wide-w1.png`
- `product/2026-11-06/balloon-morph-static/board-wide-0-05-1.png`
- `product/2026-11-06/balloon-morph-static/board-close-w0.png`
- `product/2026-11-06/balloon-morph-static/board-close-w0.5.png`
- `product/2026-11-06/balloon-morph-static/board-close-w1.png`
- `product/2026-11-06/balloon-morph-static/board-close-0-05-1.png`
- `product/2026-11-06/balloon-morph-static/diagnostics.json`
- `product/2026-11-06/balloon-morph-static/envelope-endpoint.npz`（研究副本，不是替换用的 glb）
- 脚本 `tools/scene-fx/render_balloon_morph_static.py`
- 网格 `creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb`（只读）

旧的折扇、蓝板、方向碗记录仍在 `product/2026-11-06/balloon-deflated-cloth-study/` 和 `balloon-direction-study/`。
