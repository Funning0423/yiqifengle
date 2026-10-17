# Result screen v2 (SPEC v2.1): ggbot/result-screen, local only, nothing pushed
Commit f318da4e39cbec3be785c341b75eab0d704817e4 on c87881f; tree 49b17ce7e73d33be609a0abe9fe98939acdd6714 (git am tree check: TREE_CHECK.txt, match).
Follows ui-design/result-screen/SPEC.md v2.1 (not final until Funning confirms; all look numbers are constants at the top of
configureResultLayout in BoardPanels.ts and CHEST_LOOK in ResultChest3D.ts).

## What changed
- Gone: 「全部领取」, region item cards, 成绩已保存 (summary now 用了 N 步 · 剩余 M 步), the per-item claim bars, the stamp.
- Chest: one centred chest, invisible 220×220 hit area (ResultChestTap; one-shot guard + batched claims kept). Glow r120
  (breathing 1.6 s), idle hop after 3 s every 2.4 s, hint 「✦ 点宝箱领取 ✦」 pulsing, floor shadow. wx.vibrateShort('light').
- Tap: everything claimed once (double tap ignored). Next/Home before opening also claim first, no popup (provisional).
- Open: lid open, InnerGlow on, rays 300 slow turn, glow r150; rewards rise from the chest mouth (420 ms backOut 1.4,
  90 ms stagger, scale 0.3→1) then bob ±3 / 2 s on a 68 RewardBadge with the existing icon and its name; unlock hint below.
- Buttons: home plates (artScale 0.6), 141×56 + 6 base on 390, gap 16, 46 from the screen edge; 52 high on compact screens.
- ResultChest3D: CHEST_LOOK = albedoScale (1.12,1.08,1.0), roughness 0.55; Key 3.2, Fill unchanged, RimLight (0,1.8,-2.5)
  #FFD9A0 1.2, InnerGlow 1.4 r2.2 only when open. RenderTexture now shown square (it was squashed into the chest box).
- 2D fallback: popup/chest_closed.png replaced and popup/chest_open.png added (UI设计部 crops, 380 wide, 128 colours).

## Layout (390×844, WeChat insets, screen pt from top-left; tests/test_result_screen_style)
- Chest centre (195, 489.5) closed, 180×156; hit 220×220; buttons 下一关 centre (116.5, 681.5)… see logs/test_result_screen_style.json
  (that JSON is the closed state; open state: chest centre ≈ (195,568), reward badge centre ≈ (195,361), buttons y ≈ 746).
- 375×667: chest 120×104, hit 160, buttons 133.5×52. 320×568: chest 101×88, buttons 128×52. Everything on one page.

## Tests
- Full suite 34/39, same as c87881f; the same 5 known non-passes (production-integrity, legacy-board-ui-pure,
  reward-background-return, cloud-web-contract FAIL; navigation-guard BLOCKED_BROWSER). logs/test-suite_v2.log.
- test_result_safe_area, test_result_viewports, test_board_runtime PASS. Lifecycle checks compare the navigation part of the
  calls (auto-claim before Next/Home is asserted in test_result_screen_style).

## Package estimate (not a device build)
c87881f bound 24,560,718 B; v2 adds +14,599 B TS and −3,741 B PNG → ≤ 24,571,576 B = 23.43 MiB ≤ 23.5 MiB.

## Media (harness node tree + real board_art PNGs, Mac home frame blurred as background; NOT device recordings)
media/result_v2_{day,night}_390x844.mp4 (6.6 s: closed breathing/hop → tap → open, rewards rise and bob);
after_v2_*_{ready,open}.png, before_c87881f_*.png, compare_*_c87881f_vs_v2.png. The chest in the previews is the 2D
fallback art (UI设计部 render); the in-game 3D chest has to be checked on device. The ✦ glyph shows as a box only in the
preview font.
