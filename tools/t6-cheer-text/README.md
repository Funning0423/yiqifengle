# T6 连击飘字（GGbot）

基于 Voice-bot `b200456`。档位只来自 `GameAudio.onCheer((level, visual) => …)`：level 0..3 = Great! / Excellent! / Amazing! / Unbelievable!，
和鼓励音同一个判定点；静音、切后台也照发。位置：`visual.wave.removed[].index` 的格子中心取平均，换到棋盘画布 UI 坐标；没有格子就用棋盘中心。

| 文件 | 作用 |
|---|---|
| `assets/scripts/ui/CheerTextModel.ts` | 不依赖引擎：配色、动画曲线（0.18s 弹出带回弹、0.8s 内上飘 56px、0.5s 后淡出、0.8s 消失）、替换规则、安全区夹取 |
| `assets/scripts/ui/CheerText.ts` | `CheerTextHost` 组件，挂在 GameAudio 的节点上；`onLoad` 订阅、`onDestroy` 取消订阅；每个棋盘画布建一次 4 个 Label 节点（每档一个）；每帧只改缩放、位置、透明度 |

- 字：系统字体 Label，加粗，描边 4、阴影 (0,-3) 模糊 2，字体先找 `Arial Rounded MT Bold`（iOS 有），找不到就用系统默认。不增加任何资源文件。
- 一次只显示一个：同档或更高档还在显示时跳过新的（和 `playCheer` 一样）；更低档在显示时直接换成高档。
- 测试：`tools/t6-cheer-text/test/run.sh`（转译真实源码，cc/GameAudio/棋盘用桩）。预览：`node tools/t6-cheer-text/preview.mjs out.png`（需先跑一次 run.sh）。
- 回退：删掉 `assets/scripts/ui/CheerText.ts`、`CheerTextModel.ts` 和它们的 `.meta`（或 revert 这个提交）。不改任何已有文件。
