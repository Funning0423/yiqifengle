# 夜间玻璃 UI（运镜bot）：只改夜间，白天 refine 3.2 不变

- 分支 `cine/night-glass-r4`（只在本地，没有 push），基于 GGbot r4-prep 97b761d11f14f8d24e3b690e370cb0da04ff9127
- 提交 **9c8fb36656abb4aae4a6db81176df8969535f02e**（1 个）：`0001-*.patch`，`night-glass-r4.bundle`（97b761d..cine/night-glass-r4）
- 改动文件：`resources/world/glass-sign.effect`、`scripts/world-r1/GlassSign.ts`、`scripts/RoomExploreOverlay.ts`，新测试 `tools/test_glass_sign_night.cjs`（已加进 run-suite）

## 做法
夜间权重用的是 `uiNightWeight()`，和其它夜间 UI 一样，0.5 s 过渡。shader 的 `params2.y`（之前没用）放 w；新加的 `params3/4/5` 是乘子，在 CPU 上按 w 混好再传进去。默认值都是 1，w=0 时 lerp 两端精确，所以白天和原来的 shader 逐项相同。
夜间参数 `GLASS_SIGN_NIGHT`：
| 项 | 白天（不变） | 夜间 |
|---|---|---|
| 白色底层（渐变 + 内发光）不透明度 | ×1 | ×0.45 |
| 底层颜色 | 白 | 暗暖色 0.22/0.15/0.09（屋里木头和石墙的颜色） |
| 边缘反光 rim | 0.43·r^0.6 | ×0.45，颜色带一点吊灯暖色 1/0.86/0.66 |
| 顶部高光 | 0.8 | 0（只留一条细的 rim） |
| 文字 | 白 255，阴影 0,40,60,115 blur6 | 暖白 232/226/212（TEXT_NIGHT.white），描边 38,24,12,230 宽 1.5，阴影 20,12,5,200 blur3，没有白底 |
| 叶子图标 | 不变 | 不变 |
「向左轻拖，看看门口」和「推开门，开始冒险」：本来就没有玻璃底，也没有高光，只剩文字规则可以套。白天描边 33,45,45,170 不变，夜间改成暗暖色 38,24,12,230。全项目搜过，夜间带玻璃效果的 UI 只有这块牌子（其它 glass 都是 3D 窗户和灯罩）。

## 对比度（WCAG）
- 规格值：夜间字色和描边的对比度 **13.35:1**；提示字 #fff2cf 和夜间描边 **15.47:1**。测试锁住 ≥4.5。
- 合成图上量的（离线复现，见下面说明），玻璃牌夜间：

| 指标 | 改前（夜间） | 改后（夜间） |
|---|---|---|
| 字和紧挨着的 1px 像素，中位数 | 3.92 | **12.46** |
| 字和紧挨着的 1px 像素，p5 | 2.25 | 4.26 |
| 字和玻璃本身（不算描边和阴影），中位数 | 3.10 | 3.78 |
| 牌面亮度（相对亮度）。墙本身 0.169 | 0.298（发白，抬高 76%） | 0.149（略暗、偏暖，墙能透出来） |
  白天的数字前后完全相同（字和玻璃本身中位数 2.07），白天本来就不在这次范围里。
- 提示字，夜间：字和紧挨着的 1px，中位数 6.84→10.76，p5 2.69→3.25；字直接对地板（不算描边）中位数 4.44。
- 没达标的项：只有一项按「最差 5% 像素」量没过 4.5，是玻璃牌 p5 4.26。那 5% 是抗锯齿过渡边。字直接对透明玻璃（不靠描边）是 3.78，不到 4.5。要靠玻璃本身达到 4.5，牌面得压到很暗，就不透明了，和「大幅降低白底、透出墙」冲突，所以对比度靠描边和阴影来保证。

## 截图（screenshots/）
**这些不是引擎截图。**按规定不用 Funning 的 Mac，盒子上也没有 Creator，所以没法真机渲染。做法：
1. 底图用 a4a1041 的 Mac 原始帧 `ui-audit/2026-10-16/fixes-a4a1041/raw/ib_{day,night}_390_home_sign.png`，390×844，dpr2。
2. 用 numpy 把 glass-sign.effect 逐行移植一遍，从原始帧里反算出玻璃后面的墙。在原帧上重画白天，平均误差 6.8/255。
3. 再按改前、改后两套参数各合成一次。字用 Noto Sans CJK 重画，叶子用仓库里的 PNG。
文件：
- `{day,night}_glass_sign_before_after_4x.png`：左边改前，右边改后。另有 `*_4x_before.png`、`*_4x_after.png`、`*_context_390_{before,after}.png`。
- `{day,night}_glass_sign_4x_MAC_a4a1041_reference.png`：Mac 实拍，作参照。
- `{day,night}_room_hint_before_after_3x.png`：上面改前，下面改后。
- 白天：改前和改后最大像素差 0（`glass_sign_metrics.json`）。
- 数字都在 `glass_sign_metrics.json` 和 `room_hint_metrics.json`。复现脚本在 `tools-offline-repro/`。
**需要 r4 合进来后在 Mac 上实拍一次夜间确认。**

## 测试
`node tools/journey-integration/run-suite.cjs`（QF_TYPESCRIPT_MODULE=typescript 5.9.3）：**77/82**。只有已知的 5 条：production-integrity（bgm_main.mp3 冻结哈希）、legacy-board-ui-pure、reward-background-return、cloud-web-contract、navigation-guard BLOCKED_BROWSER。glass-sign-layout 和 glass-sign-night 都 PASS。日志在 `tests/`。
新测试锁住：白天常量和白天 Label 原样；w=0 时所有乘子都是 1，没有描边；夜间参数逐项锁定（底层 ≤0.5、rim ≤0.5、顶部 ≤0.5、底色暗暖）；shader 接线，默认值是 1；描边对比度 ≥4.5；提示字白天描边不变。
