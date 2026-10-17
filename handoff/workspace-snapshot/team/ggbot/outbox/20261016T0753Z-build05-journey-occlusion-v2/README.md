# Build05 journey occlusion fix v2: 08→09 time cut to within 3 s, city centred on arrival

Status: **local only, NOT pushed**, main not touched. This replaces outbox `20261016T0738Z-build05-journey-occlusion` (d28ee16). Native Cocos and Mac recordings are **NOT_RUN**. The Blender offline preview renders were stopped and deleted at the lead's request.

## Identity

| | |
|---|---|
| Base | `751905c985e4e0c898f395456c3b2a41ff7a1376` |
| Build05 baseline | `3ff5b73`, tree `9c6f3524e6ccaec78d93741663042ae748c521b5` (Oi patch SHA256 `f67d6652…19c2a06` applied on the base; we cannot reproduce Oi's commit id `3bda6a93` byte for byte, since its author, date and message are unknown) |
| v1 fix | `d28ee16d81e3b413477b6ce04b261043712e8fc7` |
| **v2 fix (this)** | **`a373227b7aadb9e9af7522d3993e7de5fc0fbc6f`**, tree **`0764549ab10e229f2b9258127b88b9e5cbc0ff34`** |
| Branch | `ggbot/build05-journey-occlusion` (box worktree `/workspace/wechat-game/work/build05-occl`) |
| Patches | `patches/0001-0003`: full series on 751905c. `git am` reproduces tree 0764549a (checked). `patches/fix-only/`: 2 patches on 3ff5b73. `patches/incremental/`: v2 only, on d28ee16. |

## v2 change (lead feedback on d28ee16)

| | Build05 | d28ee16 | **a373227** |
|---|---|---|---|
| 08→09 length | 42.865 m | 59.27 m | **46.03 m** |
| Duration at 1.2 m/s (unchanged) | 35.7 s | 49.4 s | **38.4 s (+2.64 s)** |
| Bridge | to the inner anchor, under the platform | 24 m +X to the far outer rim | **18 m +X, same line**, ends just outside the **side** rim next to the city's cloud bridge |
| Deck walk | 2.4 m (through the platform) | 17.6 m round the centre post | **straight on across the deck (≈8.7 m) to the cloud-bridge step, then the unchanged 2.05 m to the arrival root** |
| City yaw | 215° | −54.97° | 241.17° (the bridge now meets the platform side straight on) |
| Arrival camera | follow lens | follow lens (city off to the side) | over the last 5→3 m the lens swings to **2.5 m behind her on the line to the plaza** (`anchor_starcourt_center`), 1.5 m up, aimed halfway between her chest and the plaza |

How the time was cut: shorter geometry only. There is no cut, no teleport and no speed change. The rainbow bridge is 6 m shorter horizontally on the same line. It lands on the side of the round terminus platform, right beside the city's own cloud bridge, instead of on the far rim. That removes the walk around the 2.5 m centre post. The arrival root (2.4 m into the city's cloud bridge) is unchanged to 1e-6.

Code:
* `RegionJourneyLayout.ts`: `skycityOffset [18,12,0]` (was [24,12,0]), `skyLanding [-3.47,7.78,.06]` in the deck frame, with walk waypoints `[-.29,1.3,.08]`, `[-.05,.8,.3]` and `skyStepOnto`. New `skyApproachDir()`. `skycityYawDeg()` now turns the approach direction to `skyHeadingDeg` (90).
* `RegionJourneyCore.ts`: `JourneyRoute.focus?`. `journeyCamera(path,d,start,focus?)` adds the end-focus blend (`focusStartM 5, focusFullM 3, focusBackM 2.5, focusUpM 1.5, focusAim .5`). Routes without a focus (04→05) give byte-identical camera output.
* `RegionJourneyAdapter.ts`: the skycity route carries `focus = anchor_starcourt_center`.
* `test-journey-occlusion.cjs`: new O5 assertions, and the report now records the placements.

## Lateral shift vs d28ee16 (for Voice Bot's 1 m foliage band)
* **04→05: no change** at all.
* **08→09, walk_path_02→08: no change.**
* **08→09 rainbow bridge: no lateral shift.** It runs on the same line (meadow-local z = 3.203, heading +X) but is **shorter**: it ends at meadow-local x ≈ −18.6 instead of −24.3. It is also steeper, since it climbs the same 12 m over 18 m instead of 24 m. If you cleared foliage along x −18.6…−24.3 for the old bridge, that stretch is now just under the deck walk (see below).
* **08→09 sky deck: completely different from d28ee16** (the city is rotated and moved). The deck walk carries straight on along meadow-local z ≈ 3.20 to x ≈ −25.5, then turns to the arrival at (−27.90, 15.27, 1.41) meadow-local. All of it is on the city platform, 15 m above the meadow ground. Sky-local coordinates are in the CSV.

## Original Build05 occlusion moments and the ~6 m figure (unchanged from v1)
* 04→05: palm close-up at 3.32 m (Oi), measured here at 2.9–3.1 m with the lens 0.96 m from the canopy. The palm also hides her at 6.75–9.05 m.
* 08→09: hidden under `env_sky_static_palette` from 25.55 to 38.55 m. **Voice Bot's ~6 m is confirmed at the worst point:** the foot was 5.98–6.11 m below the platform top at d≈32. It varies from about 0.7 to 6.1 m over d 28–38. Oi's 2.27 m is one point on that underside.
* Orange block and low floating islands (Voice Bot's cmp_day.png): these are the near face and underside of the same platform, seen from under it. Before the fix, 24 samples had geometry less than 8 m above her head, down to 0.04 m. **v2: 0 samples. The sky above her head is open along the whole leg** (`evidence/overhead-and-overlap.txt`).

## Tests (box, Node 20, TS 5.9.3): all PASS
`test-journey-occlusion.cjs` **8/8**, sampled every 0.05 m. It started at 6/6 and gained 2 O5 checks:
* O1/O2 04→05: unchanged, 32.4645 m, lens at least 2.83 m away. Same 16 exempt samples at the island pose and 6 low grazes.
* O1/O2 08→09: 921 samples, never occluded. The lens stays at least **1.45 m** from all geometry; it was 3.0 m in v1, and the threshold is 1 m. The closest point is during the low arrival framing beside the platform's centre post.
* O3: worst foot clearance is +0.026 m, on the deck. Both bridge corridors are free.
* **O5 duration:** 46.028 m, **+2.64 s** vs Build05 (assertion: ≤3 s, speed must stay 1.2).
* **O5 city centred:** over the final 3 m (every 0.1 m, 390×844), the plaza centre is at ndc **(0.00, −0.27)** (assertion |x|≤0.15, |y|≤0.35) and her chest is at (0.00, +0.40), in frame. Horizontally she stands right in front of the plaza; the plaza is in the upper middle.
* O4: the 09 board-background pose is byte-identical to Build05, the plaza corners are in frame, and the arrival root is unchanged.
* Regressions PASS: journey-lifecycle, bridge-render-contract, journey-types (strict, 0 diagnostics), composition-boundaries, production-integrity, world-region-exit, test_region_journey, test_region_journey_host.
* Windmill vs city solid meshes: no bounding-box overlap.
* Limits: geometry, not pixels. The character is approximated as 5 points on the root axis.

## Route height profile 08→09 (v2, every ~3 m; full 0.5 m table in `route-height-08-09.csv`)
Bridge from d 13.34 to 35.29 m, deck from 35.29 to 46.03 m. World y is the root (foot) height. The last column is the open sky above her head.

| d (m) | phase | world y | meadow-local x, y, z | sky-local x, y, z | overhead |
|---|---|---|---|---|---|
| 0.00 | approach | 0.424 | 2.329, 1.587, 15.907 | -40.397, -18.394, 93.823 | open |
| 3.00 | approach | 0.799 | 2.636, 1.962, 12.959 | -37.667, -18.019, 92.670 | open |
| 6.00 | approach | 1.176 | 2.242, 2.339, 10.018 | -35.280, -17.642, 90.906 | open |
| 9.00 | approach | 1.505 | 1.355, 2.668, 7.175 | -33.218, -17.313, 88.758 | open |
| 12.00 | approach | 1.755 | 0.195, 2.918, 4.421 | -31.365, -17.063, 86.414 | open |
| 15.00 | bridge | 3.031 | -1.521, 4.194, 3.203 | -31.125, -15.787, 84.323 | open |
| 18.00 | bridge | 5.139 | -3.655, 6.302, 3.203 | -32.155, -13.679, 82.454 | open |
| 21.00 | bridge | 7.165 | -5.868, 8.328, 3.203 | -33.222, -11.653, 80.515 | open |
| 24.00 | bridge | 9.043 | -8.206, 10.206, 3.203 | -34.349, -9.775, 78.467 | open |
| 27.00 | bridge | 10.694 | -10.709, 11.857, 3.203 | -35.557, -8.124, 76.274 | open |
| 30.00 | bridge | 12.058 | -13.379, 13.221, 3.203 | -36.844, -6.760, 73.935 | open |
| 33.00 | bridge | 13.139 | -16.177, 14.302, 3.203 | -38.194, -5.679, 71.484 | open |
| 36.00 | sky-deck/arrival | 13.851 | -19.064, 15.014, 3.203 | -39.586, -4.967, 68.955 | open |
| 39.00 | sky-deck/arrival | 13.859 | -22.064, 15.022, 3.203 | -41.033, -4.959, 66.327 | open |
| 42.00 | sky-deck/arrival | 13.867 | -25.064, 15.030, 3.203 | -42.480, -4.951, 63.699 | open |
| 45.00 | sky-deck/arrival | 14.104 | -27.462, 15.267, 2.303 | -42.848, -4.714, 61.164 | open |
| 46.00 | sky-deck/arrival | 14.109 | -27.902, 15.272, 1.405 | -42.273, -4.709, 60.346 | open |

04→05 is unchanged from v1 (`route-height-04-05.csv`). Near ground for grass and stone: on 04→05 it is the meadow under the bridge and walk_path_01/02. On 08→09 it is the meadow under the bridge, meadow-local x −0.5…−18.6 at z≈3.2, and the sky platform deck (sky-local y ≈ −4.96) for the last ~11 m.

## Risks / not done
* The arrival lens is low (1.5 m) and close (2.5 m). It frames the plaza with her in front, but it is a different look from the follow lens. If art wants it wider, `focusBackM` is limited by the platform's centre post.
* 08→09 lens clearance dropped from 3.0 to 1.45 m. It still passes the 1 m rule; watch for near-plane clipping on device.
* Native Cocos and Mac recordings: NOT_RUN. These need a Creator 3.8.8 build on Funning's Mac.
