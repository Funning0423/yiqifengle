# new-regions — Mac steps (Cocos Creator 3.8.8)

Branch `ggbot/fg-new-regions` (on fg-system-panels d680078b). Design: UI设计部 `ui/new-regions` e05a034e `ui-design/new-regions/SPEC.md`.

**Approved:** fg-new-regions and coast `scene/b19-coast-port` 50f5252c (Grok Bot, 2026-10-29) — the coast seal is the
**night** 夜航印记 `reward_seal_coast.png` (keep it; do NOT swap in `reward_seal_coast_day.png`).

1. Open `creator-build-project` in Creator 3.8.8 and let it import. Creator generates the `.meta` files (none are hand-written):
   - `assets/scripts/ui/JourneyCore.ts.meta`
   - `assets/scripts/ui/JourneyUi.ts.meta`
   - `assets/bundles/board_art/journey_ui.meta` (new plain folder inside the existing board_art bundle — do NOT tick Is Bundle; bundles don't nest)
   - `assets/bundles/board_art/journey_ui/JourneyPanels.ts.meta`
   - `assets/bundles/board_art/popup/reward_seal_coast.png.meta` (sprite-frame, same settings as `reward_seal_lake.png.meta`)
   - `assets/bundles/board_art/r2/region_coast.png.meta` (sprite-frame, same settings as `region_lake.png.meta`)
   Commit the three `.meta` files.
2. Lazy journey UI check (board_art = Mini Game Subpackage, already configured): after the WeChat build,
   `subpackages/board_art/game.js` must contain `__qfJourneyUi` and the main package `src/` must not (grep both).
   In DevTools console on island arrival expect `[QF_JOURNEY_UI] ready +Nms` before the first dock tap; opening the journey
   book must never log `[QF_JOURNEY_UI] journal deferred`.
3. Build WeChat (subpackage board_art unchanged; main package gets scripts only), then open on device:
   journey book (小岛 → 旅程册) at 390×844 and a short screen (H < 700): 1 focus card + 5 rows, bar 「旅程 x / 18」 until the
   coast data (50f5252c) is merged into this line, then 27; 33 with snow data; tap a 远方 row → nothing; 未开启 row → region page with flat 「尚未开启」.
4. Ending (L18): 6 seals on a shallow arc, coast / snow drawn as blank seals (α0.85) until claimed.
5. When the coast branch merges: run `node tools/pre-transition/gen_coast_witnesses.cjs` once `tools/coast/win-replays.json`
   exists (format qf-coast-win-replay-1), let Creator make `world-r2/CoastWinWitnesses.ts.meta`, and re-run the suite
   (`test_lakeside_entry` then expects 12 + 6 + 9 and the witness file).

## 9-region redesign (SPEC §13), on-device checks
1. Journey book: focus card + 3×3 grid; panel 514 pt (458 when H<700). Tap anywhere on a cell. Check on the 375×667 device that the 11 pt status line is readable; if not, the fallback is cell height 80 (SPEC §13.1). This is not changed yet.
2. Unlock: railway after coast is fully cleared, cloud-sea after snow is fully cleared, spring after both. Regions with no data show 远方, cannot be tapped and are not counted. Coast data (50f5252c) is not merged on this branch, so coast shows 远方 and the denominator is 18.
3. Rail/cloud/spring have no seal or window art yet, so they show a blank seal.
4. Ending: seals in rows of 5+4 with a soft shadow and no plate. Check that the girl's head clears row 2 on 320×568 and 375×667 (tiny/compact sizes; she is smaller than before).
5. Same .meta list as above. No new script files.

## r2 device checks (界面验收部)
Run these on 390×844 and on one screen under 700 pt tall (375×667 or 320×568).
1. Ending, 5th seal: the 5th seal in the top row sits over the orange house roof. Its outline must be clearly visible against the roof. If it isn't, deepen the soft shadow in `buildEndingSeals` (bundle JourneyPanels.ts: 4 circles of (44,28,14) at α0.42/4, 2.5 pt down).
2. Journey book: the 11 pt status line ("4/4 ✓", "3/6", "· · ·") must be readable. If it isn't, change the cell height from 76 to 80 (SPEC §13.1 fallback).
3. 远方 (regions with no data: 铁路 / 云海 / 温泉): the cell shows only 「远方」 and 「· · ·」, with no seal or blank seal. Tapping it does nothing, and it is not counted in 旅程 n / N.
4. Ending girl size at 390×844: see the r2 report. 135 pt does not fit there without the girl's head running into seal row 2 (the size is still capped by the space).
5. Popup regression pass: open and close every popup once (journey book, every region page, settings/system panels, update, rest, result, ending). Check there is no overlap, clipping or broken motion, in both day and night.
Box preview screenshots: team/ggbot/outbox/20261029-new-regions-r2/. They come from a harness-to-canvas renderer, so the 9-slice panel backgrounds, 3D chime and night tint are not drawn exactly.

## r3 ending layout cascade (UI设计部 c+b)
The layout tries these steps in order on each screen and stops at the first one that lets the girl be full size:
① girl top margin 14 → 8. ② head-to-seal gap 8 → 6 (design value). ③ two rows at Ø32 → 30 → 28 (column pitch 44·d/36, row gap 40·d/36).
④ a single centred row of 9 seals: d = min(28, ⌊(W−40)/11⌋), gap 0.25·d, 20 pt side margins, entry left → right; seal art, shadow and animation step are unchanged.
⑤ only on screens under 700 pt tall: row-1 plank clearance 15 → 10. ⑥ only then shrink the girl (never below 48 pt). The head is ≥6 pt below the seals on every screen.
Expected result: 320×568 → 1 row of Ø25, clearance 10, girl 73.8 pt (67%). 375×667 → 1 row of Ø28, clearance 10, girl 106.6 pt (82%). 360×780 → 1 row of Ø28. 390×844 → 2 rows of Ø28. 393×852 → Ø30. 414×896 and 430×932 → Ø36. On every screen from 780 pt tall the girl is full size.
On device: check the single row on 375×667. The 9 seals must be evenly spaced and centred, and drop in from left to right.

## 远方 for regions with no data
Railway, cloud-sea and hot spring valley (no stage data) show only 「远方」 / 「· · ·」 with no seal and no blank seal. They can't be tapped and aren't counted. UI设计部 confirmed this overrides SPEC §13.1 (淡章).
