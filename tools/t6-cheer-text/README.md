# T6 连击飘字（GGbot）

基于 Voice-bot `b200456`。档位只来自 `GameAudio.onCheer((level, visual) => …)`：level 0..3 = Great! / Excellent! / Amazing! / Unbelievable!，
和鼓励音同一个判定点；静音、切后台也照发。位置：`visual.wave.removed[].index` 的格子中心取平均，换到棋盘画布 UI 坐标；没有格子就用棋盘中心。

| 文件 | 作用 |
|---|---|
| `assets/scripts/ui/CheerTextModel.ts` | 不依赖引擎：配色、动画曲线（0.18s 弹出带回弹、0.8s 内上飘 56px、0.5s 后淡出、0.8s 消失）、替换规则、安全区夹取 |
| `assets/scripts/ui/CheerText.ts` | `CheerTextHost` 组件，挂在 GameAudio 的节点上；`onLoad` 订阅、`onDestroy` 取消订阅；每个棋盘画布建一次 4 个 Label 节点（每档一个）；每帧只改缩放、位置、透明度 |

- 字（T6b）：**Fredoka 位图字**，`resources/ui/cheer-font/cheer-fredoka.fnt/.png`，在 `onLoad` 用 `resources.load(..., BitmapFont)` 加载。来源、版本、sha256 和 OFL 许可见 `font/SOURCE.md`、`font/OFL.txt`（只在 tools，不进包）。
  - 一张白色、只含填充的图集（128×100，2118 B），字形恰好是四个词用到的 19 个字符 `!AEGUabcegilmnrtvxz`。配色全部在运行时用 `Label.color` 染色。
  - 描边：同一个词再放 8 个 Label 副本，按半径 4 的圆环偏移（和系统字的 outlineWidth 4 等宽），染描边色；阴影：圆环下方 3 个方向的副本再下移 3 px，染阴影色（不透明，因为副本叠加会把半透明叠深）。子节点顺序 [阴影×3, 描边×8, 填充]，UIOpacity 在槽位节点上，一起淡出。
  - 为什么不烘焙描边：把描边字形也放进图集要 ~7.9 KB（图集和 fnt JSON 都翻倍）；把描边烘成中性深色再染色，描边会变成灰暗的同色系，不是现在饱和的同色描边；每档单独烘一张则 ×4。偏移副本 0 字节，8 方向在 r=4 时最大误差约 0.3 px，看不出来；代价是每档 12 个 Label（只有当前档激活，同一张图集合批）。
  - 回退：字体还没加载完、加载失败、`resources` 不可用或缺任何一个字形时，保持 cb561f3 的系统字体 Label（加粗、描边 4、阴影 (0,-3) 模糊 2，先找 `Arial Rounded MT Bold`）。加载成功后已建好的槽位会就地切换。
- 一次只显示一个：同档或更高档还在显示时跳过新的（和 `playCheer` 一样）；更低档在显示时直接换成高档。
- 测试：`tools/t6-cheer-text/test/run.sh`（转译真实源码，cc/GameAudio/棋盘用桩；T6 15 项 + T6b 位图字 11 项：资源和 meta、字形覆盖、图集一致性、体积、加载成功/失败/缺字/抛错/销毁后回调）。预览：`node tools/t6-cheer-text/preview.mjs out.png`（系统字对比），`node tools/t6-cheer-text/preview-bitmap.mjs out.png`（用真实图集和 .fnt 渲染的出货效果）；都需先跑一次 run.sh。
- 回退：只撤位图字就 revert T6b 提交（回到 cb561f3 的系统字体）；整个飘字则再删掉 `assets/scripts/ui/CheerText.ts`、`CheerTextModel.ts` 和它们的 `.meta`（或 revert cb561f3）。不改任何其他已有文件。
