# r5-skyground

分支 `fx/r5-skyground`，基于 build10 `8fe16bfa51263186eab52d1b8049b8e3bc94cae2`。未 push，未打包。

## 亮青从哪来

同一机位（S6 本地 [0.2, 0.032, -27.8]，yaw 90，pitch 8，距 10 m，强制 14:00）：build09 下半是草地 (99,190,84)，cloudsea 关着；build10 下半是 `env_sea_surface` 亮青 (56,184,213)。关掉 cloudsea 只差约 1155 像素，关掉 palette 只差约 620 像素。云海和远积云在岛投影内、y>-8 的三角形为 0，没有穿进岛面。palette 和 build09 面匹配后 UV 与绕序一致，顶点色误差 ≤0.5/255。

build10 把 COLOR_0 收成 VEC3 UINT8。Cocos 导入成 RGB8，步长 35。WebGL 要求 FLOAT 属性步长是 4 的倍数，草地和云海都没画出来，海面和背后的云透出来。

## 修改

`env_skycity.glb` 里 41 个 VEC3 COLOR_0 补成 VEC4 UINT8（alpha 255），原来已是 VEC4 的 9 个不动。palette 面 24695/24696 对上，位置误差 ≤5.7 mm，颜色 ≤1/255。文件 1,569,136 B，sha256 `c8558e31ab312a9c0dd94c82e859e34de4cb929407cd0faa893dd64d29657aaa`。

远云仍开。`env_sky_cloudsea` 水平半径 >100 且高于 -28 的顶点收到本地 y=-28（44 个，远点最高 -28.005），云海落在岛的下方和远处。`env_sky_cumulus_far` 最高仍是 -10.37，没有改、没有关。

区域节点按新网格重烤。天空城路径长度不变（16.085、14.017、18.971、16.817、20.72、10.8、31.52），高度大约差 1 mm。遮挡夹具只重写了 skycity 和 skycity_frame，岛和棕榈树的三角形沿用原来的。

## 镜头

南边不再用贴着云的 yaw 90 机位。镜头在 [75.91, 22.06, 157.26]，看向脚点上方 1.25 m，fov 48。画面从上到下是天、远处白云带、一条海、草地。x=200 取样：y=280 为 (236,237,237)，y=320 为海 (55,184,212)，y=360 起为草 (92,188,76)。下半 45% 绿色 92.3%，青色 0%。右上角仍有一块岩石，和 build09 同一机位一样。

植被镜头本地 [12, 0.2, 2]，yaw 220，pitch 42，距 6.2 m。全画面绿色 95.4%，青色 0%，灰 0.2%。

两张都是无头 390×844，白天，光照倍率 1。`docs/r5/skyground/shots/02_skycity_south.png`、`03_skycity_foliage.png`。任务夹 `shots/` 同名。现有 web-test 仍是旧导入，截图时在页内把步长 35 补成 36，并把云海收到同一高度；源 GLB 已是 RGBA 和压低后的云海。

## 测试

`run-suite` 139 项，138 PASS。唯一非通过是 navigation-guard `BLOCKED_BROWSER`。`test_manifests` PASS（资源 282，文本 890）。没有打包。
