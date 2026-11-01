# r5-sail-qa4 帆船转场（岛 → 草原）

时间：2026-10-19 01:30 CST。分支 `gbt/r5-sail-qa4`，起点 `d5f35d74`。白天 / 夜间都用真实旅程 `?sailqa=1` 逐帧采集（15 fps，上船前到地图机位稳住后再留约 2 秒）。

## 上身发黑

qa3 在开船后把坐姿蒙皮烘焙成静态网格，但只读了每个蒙皮的第 0 个子网格，而且没写法线和顶点色。角色围裙、身体、头发这些材质开了 `USE_VERTEX_COLOR`：静态网格没有 `a_color` 时，着色器把它当成黑色，所以上身、背部在烘焙期间是纯黑。裙子那张网格没有顶点色，贴图还在，所以裙摆仍是黄绿色。交回骨骼后实时蒙皮恢复。

qa3 片子上用头脚屏幕框量上身近黑比例：烘焙前约 0.06，16 s 约 0.36，20 s 约 0.90。本轮断言先在这条片子上判失败，再改烘焙。

修法在 `SailRide.ts` 的 `freezeDrawnPose`：每个子网格单独烘焙，带上自己的材质；位置和法线按骨骼蒙皮（法线用逆转置）；顶点色扩成 RGBA；形变权重在蒙皮前加进顶点。站立身高的烘焙仍丢弃。白天烘焙期间上身近黑最高 0.082（烘焙前 0），夜间最高 0.087。对照条带 `compare_11s_girl_day.jpg`、`compare_16s_girl_day.jpg`、`compare_20s_girl_day.jpg` 以及夜间同名条带：左是 qa3，右是 qa4，女孩放大后上身是黄绿色。

## 烘焙交接不跳色

`compare_bake_start_day.jpg` / `compare_bake_start_night.jpg` 是 9.93–10.13 s。qa3 在 10.07 s 上身变黑；qa4 这四帧颜色和坐姿连续。`compare_bake_end_day.jpg` / `compare_bake_end_night.jpg` 是 24.13–24.33 s 交回骨骼：qa3 从黑上身跳回黄绿，qa4 没有这下突变。相邻帧上身黑像素比例的最大跳变，白天和夜间都是 0.1。

## 保留的 qa1–qa3

坐稳才开船；航行中挂在 `seated_root_anchor`；舱内海水 0；flicker 0；步速约 1.2 m/s；夜间分级；音频顺序未改（node-walk-start、sail-board、sail-unfurl、cruise-loop、sail-dock、node-arrive）；10.6–11.2 s 转镜头仍是原来的弧线；矩形木板断言仍在；岛远景画面上是坐姿（白天这条镜头 78 帧 sit）；靠岸 `terrainL` / `terrainR` 为 0；走到地图机位全程 `cameraCut` 0，并再停约 2 秒。白天像素：waterMax 0，clearMax 0.0003。夜间 waterMax 0，clearMax 0.0025。

自查看了 10 s、11.3 s、16 s、20 s、交接点的放大画面（白天和夜间）。上身颜色、坐姿、白围裙和蓝蝴蝶结都在；没有新的穿模、闪烁或镜头跳。

## 断言、套件和包体

`tools/transitions/test_sail_continuity.cjs` 保留 qa1–qa3，并要求白天和夜间的 `docs/r5/sail-qa4/metrics_after.csv`、`metrics_after-night.csv` 在烘焙期间上身近黑不明显高于烘焙前，裙摆有黄绿色，相邻帧黑像素比例不突变。

短片 `sail_day.mp4`（1,237,425 字节）、`sail_night.mp4`（1,011,093 字节），各 703 帧、15 fps、390×844，时长 46.87 s。

正式套件 122 项里 121 项 PASS，只有 `navigation-guard` 是 `BLOCKED_BROWSER`。带守卫的 wechat 包 20,286,150 字节（上限 24,641,536）。`transport_sail` 子包 206,639 字节。构建后已删掉 `library`、`temp`、`build`，锁已释放。
