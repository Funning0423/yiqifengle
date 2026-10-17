# audit-fixes 第四轮（基于 a4a1041）
HEAD 1bf0bfae96cc2e30727f6f3c256a2c10231ae189，tree 77fc62bab56aa514512329d10e48ca179c500d7c。
补丁打在 a4a1041 上；bundle 范围 b0020ed..ggbot/audit-fixes-77b76c3；TREE_CHECK 已用 git am 和 bundle fetch 核对过。
仍然只在本地提交，没有 push。被跟踪的 reports 文件没有进入任何提交。

## 提交（字节数为源码资产净变化，基线 19,118,651 B）
| 提交 | 项 | 资产 Δ | 累计预估 |
|---|---|---|---|
| 6edc86f | M2 | +171 B | 19,118,822 |
| e45a9df | N2b | +1,666 B | 19,120,488 |
| 83de245 | V1 | +817 B | 19,121,305 |
| 1bf0bfa | G2 | +2,081 B | 19,123,386 |
真实包体以 Mac 重建为准（TS 编译后通常比源码小）。

## 各项
- **N2b 草地地面夜间不变暗**
  - 根因：meadow_terrain / meadow_river_bank 用的是 builtin-standard，主要靠环境光照亮。夜间主光降到 0.35，对它们几乎没有影响；N2 只给草丛 shader 和云加了夜色。
  - 修复：旅程中给这两块地面的 albedo（mainColor，材质实例）乘上和 N2 草丛相同的夜间系数。线性值为 0.16/0.20/0.28，即 lightScale 0.35 × 月光色；写入时转成 sRGB。系数跟随 uiNightWeight，带 0.5 s 过渡。棋盘背景和白天不受影响。
  - 测试：tools/test_meadow_night_grade.cjs 已扩展。
- **V1 出门途中切后台，出门被取消**
  - 根因：WorldFlowCore.hide() 按设计会取消正在进行的过渡，并恢复到稳定姿势（坐在家里），然后进入 paused / needsResume。这是为了“切后台不留半截动画”。所以 exit-cine cancel:left-exit 是这个设计的连带结果，不是 0006 那条取消规则。回到前台后只有「继续」能恢复，点画面中间没有反应（屋内触控面板在 needsResume 时不接收点击）。
  - 修复：hide() 记下当时是不是正在出门（EXIT_STATES：standing → crossing-out）。如果是，show() 回到前台时会直接解除暂停，从座位重新干净地开始出门，不用点「继续」，出门音轨也会随状态重新开始。坐着时切后台、在岛上切后台，行为都和以前一样。
  - 测试：tools/journey-integration/test-exit-background-resume.cjs。在 walking-out 和 crossing-out 两个阶段切后台，回来后都能自动走到 island。去掉修复后这个测试会失败。
- **M2**
  - 提交了界面验收部生成的 GlassSign.ts.meta（uuid 1e879505-4df7-4703-b323-555cef1a7fa5）。
  - GlassSign 是普通 class，不是 Component，没有任何 scene / prefab / json 引用这个 uuid（包括压缩形式 1e879…），没有不一致的问题。
- **G2 玻璃牌排版和叶子**
  - 根因：文字放在固定 198 px 宽、居中对齐的框里。系统字体下 spacingX 不起作用，实际字宽更窄，所以文字偏右，和叶子之间空出一段。叶子用的是系统 emoji，不同平台样子不一样。
  - 修复：
    - 叶子改用 Graphics 绘制：42 px，浅叶绿 (178,226,142)，白色叶脉，淡阴影。资源 0 B。
    - 文字先测出实际宽度，“叶子 + 12 px + 文字”整组在牌面上居中。
  - 测试：tools/test_glass_sign_layout.cjs。
  - 对比图：G2_glass_sign_before_after.png 是 Chrome canvas 排版示意（m.html），不是引擎实拍，请以真机为准。

## Suite
共 51 项，46 项通过。没通过的只有已知那几项：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract 失败，navigation-guard 是 BLOCKED。详见 suite.txt。

## 请 Mac 验收
1. 夜间旅程中，草地地面要和草丛、云一样暗；白天和棋盘背景应该没有变化。
2. 出门途中（走向门口时、户外段时）切后台再回来，应该从座位重新出门，不用点「继续」。出门音轨重新播放。
3. 坐着时切后台，行为和以前一样。
4. 玻璃牌：叶子和文字整组居中，叶子是画出来的绿叶，不是 emoji，320 宽下也要看清。点牌出门大约 1.1 s 不变。
