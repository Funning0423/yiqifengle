# 候选：沿原射线收半径（未达到松垮堆叠）

分支 `cursor/balloon-mound-cloth-e018`，从 `95dc672d` 拉出。没有带上 PR73，也没有改 `transport_balloon.glb`。这不是合并许可。

## 方法

气囊每个顶点留在它相对巡航内部点 `(0, 6.55, 0)` 的原射线上，只改半径，再把射线原点放到篮子里的 `(0, 0.62, 0)`。半径 `0.34+0.18*(elev+1)+0.08*L*(1-elev²)`。`0.08` 是这套连线上测到的、内部互穿仍为 0 的最大瓣增益；`0.12` 起出现内部互穿。时间用 `(t/3)³`，所以记录里的 B1 特写刚稳住时（约 1.2 s）形状仍接近瘪态，2.25 s 和 3 s 才拉开。满气时顶点回到文件位置，渲染器换回原来的 mesh。节点缩放保持创作时的 1，不再把泪滴缩小。

两级细分的中点若抬离面，会把缝或邻面算成交叉。中点留在面上时，画面与 490 顶点相同。运行时因此只用 490 顶点、576 三角。细分测量见 `geometry.json`（5362 顶点、9216 三角，位置缓冲各 64344 字节）。

## 几何抽样（不是整段证明）

| 时钟 t | shape | 缝隙 | 内部互穿 |
|---|---|---|---|
| 0 | 0 | 0 | 0 |
| 0.75 | 0.016 | 0 | 0 |
| 1.5 | 0.125 | 0 | 0 |
| 2.25 | 0.422 | 0 | 0 |
| 3 | 1 | 0 | 0 |

负例：两片故意穿过的三角，计数为 1。互穿要求刺点落在边的内段（两端各留 2%）并且在三角形内部，所以贴缝的 T 形接缝不算。

瘪态：杆面距离 0.315 m，篮沿 0.220 m。满气杆面距离 0.190 m。嘴部 8 个缆端（y≈3.072 的八个位置）不计入。蓝带 48 个顶点的高度只有 0.579–0.748 m。

## 记录镜头里的画面

镜头来自 `tools/transitions-continuous/fixtures/m2-camtrace-full.txt` 里 `BalloonTransit:B1`，再用 `vehicle(0)` 和 `basketToWorld` 的同一套偏航变回篮子坐标。画幅 390×844。这是离线光栅，不是 Cocos，也不是 `liveWorldPose`。`lensClearStep` 已经做在这条轨迹的世界坐标里；本环境不能重放草地遮挡和她的实时脚点。

稳住的特写大约在 B1 开始后 1.01 s，fov 46.04，篮子在画面右缘。这个眼里：

- t=0 的壳在篮沿下面，画面里看不到布。
- t=1.5、t=2.25 是一颗圆球顶进画面，蓝带是水平色环，不是顺着褶皱走。
- 这不是低位松垮、互相搭着的布堆。

图在同目录：`close-shell-t0.png`、`close-shell-t1.5.png`、`close-shell-t2.25.png`、`close-shell-t3.png`、`close-scale-before.png`、`trace-dt*.png`、`cameras.json`。

## 阻塞

要在这套射线上做出能被这块特写看见的不规则搭覆，瓣增益就要大过 0.08，内部互穿不再是 0。再改增益就是被停掉的盲调。本候选停在测到的嵌入边界上，不能当成已批准的瘪气形态。

## A

`chainMark` 第一次调用时，若还没有 `__QF_TRANSITION_FALLBACK`，写成 `{count:0,events:[]}`，不擦掉已有事件。`test_chain_ggbot.cjs` 对过运行时对象和转储形 `{count, last:events.slice(-3)}`。

`node tools/journey-integration/test-b1-yard-balloon.cjs` 仍失败在原来的那句：`C3: B1 writer changed beyond the hold branch + the b1-ease b1Hold latch`。断言没有放宽，`b1Draw` 正文没有改。
