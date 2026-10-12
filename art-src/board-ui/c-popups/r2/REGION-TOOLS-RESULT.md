# 地区奖励道具精修结果（潮汐网 / 日光籽 / 星剪）

范围：只重做 `tool_tidenet`、`tool_sunseed`、`tool_starshears` 三个模型并重渲。造型保持产品已确认的版本，只加细节。
未改动：运行时、`creator-build-project/tools-original.png`、道具栏代码、角色/动画/坐裙/场景/其他道具/棋子、潮汐锚与棱镜位移。
托盘、相机、聚焦光和调色板（`M_env_palette` / `finish()`）沿用原有设置。

## 改了哪些细节

### 潮汐网 `tool_tidenet`
- 网圈改为圆整的 40 段圆环截面，不再是折线圈。
- 网袋由 18 根经线加两个方向的螺旋纬线编织而成，网眼更细，整体向右后方自然下垂。网线在世界坐标里夹在托盘面之上，不穿托盘。
- 网袋里有扇贝和海螺：扇贝是珊瑚色，带放射状肋纹和贝耳；海螺是青绿色，带螺旋纹和开口。
- 红白浮子改为蛋形，用一根细绳系在网圈上。去掉了会像精灵球的赤道带。
- 短柄是深色木头，带倒角，柄尾有圆形握把。
- 网口朝向镜头，没有做成平面球拍的样子。

### 日光籽 `tool_sunseed`
- 种子是更顺滑的水滴形，白色纵纹贴着表面走向，尖端朝下插在小土堆里。
- 土堆有颗粒起伏。
- 弯曲的嫩芽加两片子叶。子叶有中脉，并略微上翘。
- 身后的金色小太阳，圆盘更圆，三角光芒更细、长度一致。

### 星剪 `tool_starshears`
- 两片长刀刃呈 X 形张开，刀刃有厚度和斜面，亮刃线落在刃面上。
- 两个金色大指环向外撇开，是正圆环。
- 金色星形螺丝坐在枢轴上。
- 一枚小星星挂饰挂在一片刀尖上。
- 通过 `rest()` 让剪刀落在托盘上，没有悬空，也没有穿插。

## 切图路径与字节数

切图宽度仍为 154 px，体积在 10–12 KB 量级。

| 道具 | 旧切图（git HEAD） | 新切图 | 旧 | 新 |
|---|---|---|---|---|
| 潮汐网 | `r2/slices/tool_tidenet.png` | 同路径 | 10595 B (154×133) | 11498 B (154×146) |
| 日光籽 | `r2/slices/tool_sunseed.png` | 同路径 | 11443 B (154×190) | 11314 B (154×187) |
| 星剪 | `r2/slices/tool_starshears.png` | 同路径 | 10203 B (154×170) | 10661 B (154×179) |

`r2/slices/sizes.json`：行囊分组 39637 → 40869 B，总计 196786 → 198018 B。

原始 192×192 渲染图：

| 道具 | 旧 `src/round2/raw_v1/` | 新 `src/round2/raw/` |
|---|---|---|
| 潮汐网 | 42205 B | 48274 B |
| 日光籽 | 49206 B | 48390 B |
| 星剪 | 40367 B | 43209 B |

旧版原图保存在 `src/round2/raw_v1/`，没有被覆盖。

## 对比图

- 三件新道具与星光/风语铃/潮汐瓶并排：`art-src/board-ui/c-popups/r2/region_tools_vs_board.png`
- 每件道具新旧对比，含 1x 与 2.5x 以及灰度：`art-src/board-ui/c-popups/r2/region_tools_compare.png`
- 行囊样图：`r2/bag_island.png`、`r2/bag_level.png`
- 行囊新旧对比：`r2/compare/bag_tools_old_vs_new_island.jpg`、`r2/compare/bag_tools_old_vs_new_level.jpg`

## 备注

- `bag_island` 的背景用 `b-board/slices/bg_island_board.jpg` 代替，因为原 C0 岛屿截图不在仓库里；`bag_level` 用已提交的 `board_final_tools.png`。
- `src/popup_props.blend` 没有重新导出，只改了脚本和渲染图。
- `sheets2.py` 里 T9 基线那几列依赖仓库外的素材，无法复现，所以另做了新旧行囊对比。

## 复现

```
blender -b --factory-startup -P art-src/board-ui/c-popups/src/build_popups.py -- /tmp/cpop 64
```

只渲这三件时，按 HANDOFF §4 传入逗号列表 `tool_tidenet,tool_sunseed,tool_starshears`。
然后依次运行 `src/round2/region_tools.py`（调色、裁切、pngquant、更新 `sizes.json`、行囊样图）和 `src/round2/tools_compare.py`（对比图）。
行囊样图的岛屿背景用环境变量 `ISLAND_IMG` 指定。
