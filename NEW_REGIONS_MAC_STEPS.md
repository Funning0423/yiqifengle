# new-regions — Mac steps (Cocos Creator 3.8.8)

Branch `ggbot/fg-new-regions` (on fg-system-panels d680078b). Design: UI设计部 `ui/new-regions` e05a034e `ui-design/new-regions/SPEC.md`.

1. Open `creator-build-project` in Creator 3.8.8 and let it import. Creator generates the `.meta` files (none are hand-written):
   - `assets/scripts/ui/JourneyCore.ts.meta`
   - `assets/bundles/board_art/popup/reward_seal_coast.png.meta` (sprite-frame, same settings as `reward_seal_lake.png.meta`)
   - `assets/bundles/board_art/r2/region_coast.png.meta` (sprite-frame, same settings as `region_lake.png.meta`)
   Commit the three `.meta` files.
2. If coast 50f5252c (夜航奖励规则) is **rejected**: replace `board_art/popup/reward_seal_coast.png` with
   `ui-design/new-regions/art/reward_seal_coast_day.png` (same size, keep the file name and its `.meta`). No code change.
3. Build WeChat (subpackage board_art unchanged; main package gets scripts only), then open on device:
   journey book (小岛 → 旅程册) at 390×844 and a short screen (H < 700): 1 focus card + 5 rows, bar 「旅程 x / 18」 in this build
   (27 after the coast data merges, 33 with snow data); tap a 远方 row → nothing; 未开启 row → region page with flat 「尚未开启」.
4. Ending (L18): 6 seals on a shallow arc, coast / snow drawn as blank seals (α0.85) until claimed.
5. When the coast branch merges: run `node tools/pre-transition/gen_coast_witnesses.cjs` once `tools/coast/win-replays.json`
   exists (format qf-coast-win-replay-1), let Creator make `world-r2/CoastWinWitnesses.ts.meta`, and re-run the suite
   (`test_lakeside_entry` then expects 12 + 6 + 9 and the witness file).
