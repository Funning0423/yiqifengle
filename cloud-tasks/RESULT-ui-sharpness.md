# RESULT：设置界面、按钮和道具贴图提高清晰度

分支 `cursor/ui-sharpness-b413` → 草稿 Pull Request 到 `int/v1`。没有合并，没有推到 `int/v1`。

玩家近看发糊，是因为这些贴图的像素少于手机屏幕上的物理像素，线性过滤在放大。这次用原来的模型、机位和灯光重渲，没有换画风、配色或布局，也没有把小图放大凑像素。

## 对比

同一张图，左边是原来的小图放大，右边是这次的渲染。近景把旧图像素按最近邻铺开，新图是重新采样的。

- 总览：`cloud-tasks/ui-sharpness/compare-sheet.png`
- 主按钮圆角：`cloud-tasks/ui-sharpness/btn-zoom.png`
- 潮汐网：`cloud-tasks/ui-sharpness/net-zoom.png`
- 星光：`cloud-tasks/ui-sharpness/star-zoom.png`

缩回原来的尺寸后，和定稿图的平均色差都在阈值 12 以内（按钮和木框约 0.4–1.5，三件主线道具约 2，三件地区道具约 2.5–4）。形状用原来的裁切框按整数倍放大，长宽比不变。

## 贴图像素

| 贴图 | 原来 | 现在 | 倍数 |
|---|---|---|---|
| 设置外框 `panel_frame_9s` | 208²，九宫格边 92 | 624²，边 276 | 3 |
| 标题木牌 `title_plank_3s` | 192×105，左右 84 | 576×315，左右 252 | 3 |
| 主 / 次按钮 | 162×104，左右 69 | 486×312，左右 207 | 3 |
| 关闭、设置图标、开关、旋钮 | 原切片 | 同比例 ×3 | 3 |
| 星光、风语铃、潮汐瓶（道具栏） | 192² | 768² | 4 |
| 这三件的介绍大图 | 400² | 1200² | 3 |
| 潮汐网、日光籽、星剪 | 154×146、154×187、154×179 | 616×584、616×748、616×716 | 4 |

九宫格的边存在贴图像素里。运行时把内容尺寸乘 3、节点缩到 1/3，屏幕上的边宽、按钮 136×62、设置框 680×768 都和原来一样。没切片的道具和图标仍放进原来的框，只是纹理更密。过滤仍是线性，小图不再被拉大。

## 改了哪些文件

- 切片和源渲染：`art-src/board-ui/` 里上面这些 png，以及 `c-popups/slices/sizes.json`、`b-board/slices/sizes.json`、`c-popups/r2/slices/sizes.json`
- 进包：`creator-build-project/assets/bundles/board_art/` 里对应的 png（`tools/board_art_sync.py`）
- 布局补偿：`creator-build-project/assets/scripts/ui/BoardArt.ts`（`ART_PX`、九宫格边 ×3、`size()` 除回设计像素）、`PopupKit.ts`（切片节点缩放；音量条填充段跟着乘 3）
- 以后重跑切片不会把大图再缩回小图，也不会把小图放大：`sharpen_slices.py`、`slices.py`、`slices2.py`、`b-board/src/slices.py`。`build_popups.py` 增加 `POPUP_RES_SCALE` / `POPUP_TOOL_SCALE`，默认仍是 1
- 测试：设置里「晴昼」按钮的可见尺寸仍是 136×62，外框仍是 680×768

## 包体

`board_art` 子包从 760,490 字节增到 1,891,280 字节（约 +1.08 MiB）。`creator-build-project/assets` 合计约 12.5 MiB。新增像素在 `board_art` 子包里，主包只多了这几行界面脚本。主包 4,000,000 字节和总包 30 MiB 的上限都还有余量。这次没有在本机打微信包，所以没有跑 `tools/check_wechat_build.py`。

## 没做

- 「设置」两个字的烘焙标题 `popup/title_2`（94×47）没重做。仓库里没有霞鹜文楷，重烘可能对不齐现有字形。
- 暂停页三个方块图标、棋子、路牌、关卡条没动。
- 主页图标和播放图标仍是原来的尺寸。设置页用到的音乐、音效、太阳、月亮、减少动态、关于，都已经是 3 倍。
