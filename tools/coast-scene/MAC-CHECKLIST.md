# Coast region: Mac runtime checklist (Creator 3.8.8, WeChat devtools)
Run these on the Mac before the coast gate items are moved into the test suite. Record the results (values and screenshots) in the round report, not in this repo.

1. **Creator build size.** Build region_coast as a WeChat mini-game subpackage. Record the measured size of the region_coast bundle, which must be ≤1.0 MiB. Compare it with the estimate in pkg_estimate.mjs (r4c: see the round REPORT).
2. **Toggle frames 220 and 1044.**
   - Play island→coast and coast→island. At frame 220 (t 3.667 s) and frame 1044, confirm that region_coast_root and SailArt switch only on that frame.
   - Nothing may pop on screen at frames N−1, N or N+1.
   - Check all 7 screen sizes: 390×844, 414×896, 360×780, 375×667, 320×568, 390×520, 768×1024.
   - Expected clean windows (fit-width gate): 210–227 and 1040–1048.
3. **Stubs and visibility.**
   - While the coast is inactive, region_coast_root and its children (coast_board, coast_pieces, coast_rocks, coast_terrain, coast_props) are inactive.
   - SailArt children are inactive while the coast is active.
   - No fallback placeholder planks appear: island_dock, island_dock_ramp and sail_gangway placeholders show up only if a glb is missing.
4. **Wake trail during the coast transition.**
   - Read `__QF_SAIL_WAKE` every frame across the transition (at least frames 196–248 and 1030–1060).
   - It must be `null` or have `shown: false` the whole time, because the boat is still and SailWakeCore.ts:15/:38 emits nothing at speed ≤ 0.35 m/s.
   - Only after this is confirmed: set `conditional.mac_confirmed = true` on wake_trail in coast_aabbs.json, and add the conditional wake gate to the test suite.
