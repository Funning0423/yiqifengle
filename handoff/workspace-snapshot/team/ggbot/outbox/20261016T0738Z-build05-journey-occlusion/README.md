# Build05 journey occlusion fix (04→05 palm, 08→09 sky platform)

Status: **local only, not pushed**. Waiting for Grok Bot acceptance. Native Cocos and Mac recordings are **NOT_RUN** (see below).

## Identity

| | |
|---|---|
| Base | `751905c985e4e0c898f395456c3b2a41ff7a1376` (task21 frozen source, as the handoff specifies) |
| Build05 baseline | Oi `task21-regions-build05-complete.patch`, SHA256 `f67d6652872a97267491c5d1182b1ab34a67875126d0cbafd4032e12f19c2a06` (verified, same bytes on Drive and in inbox-from-oi), `git apply --check` clean. Recorded as commit `3ff5b73` with tree `9c6f3524e6ccaec78d93741663042ae748c521b5`. **We cannot reproduce Oi's commit id `3bda6a93` byte for byte**: its author, date and message aren't in the handoff, and the handoff gives no tree hash to compare against. The content is the verified patch on the specified base. |
| Fix commit | `d28ee16d81e3b413477b6ce04b261043712e8fc7` |
| Fix tree | `cba9ba736f64b4d59251f1cec82934359fe9b955` |
| Local branch | `ggbot/build05-journey-occlusion` in box worktree `/workspace/wechat-game/work/build05-occl` (clone `/workspace/wechat-game/yiqifengle`) |
| Patches | `patches/0001-…baseline…patch` + `patches/0002-…occlusion…patch` (`git am` on 751905c reproduces both trees: checked). `patches/fix-only/0001-…patch` applies on the Build05 baseline tree. |

## Original occlusion moments (Build05)

Distances are measured along the route. Times assume 1.2 m/s after the walk starts.

| Leg | Oi (real WebGL, 1280×720, day) | This harness (real GLB triangles, 0.05 m samples, 5 body points) |
|---|---|---|
| 04→05 (32.366 m) | **3.32 m (≈2.8 s)**: beach palm close-up covers the middle and bottom of the frame. Character and bridge hidden. | 2.90–3.10 m (2.4–2.6 s): `beach_palm_tall` hides her, and the lens is **0.96 m** from the canopy. 6.75–9.05 m (5.6–7.5 s): `beach_palm_tall` hides her again (lens 1.4–2.2 m). 0–1.3 m: hidden from the authored island pose by `env_prop_palm_lean_01` and island props. |
| 08→09 (42.865 m) | 21.56 m (≈18 s): grey geometry blocks the route ahead. **32.22 m (≈26.9 s)**: character fully hidden; the foot is ≈2.27 m below the top of `env_sky_static_palette`. | **25.55–38.55 m (21.3–32.1 s)**: hidden by `env_sky_static_palette` the whole time. The foot is up to **5.98 m** below the palette top. At 32.0 m it is 6.11 m below. Oi's 2.27 m probably uses a different top-surface sample; the diagnosis is the same. |

Machine-readable data is in `evidence/before-build05-occlusion-samples.json`.

## Root causes

1. **04→05 placement.** The straight +Z island approach puts the first metres of the bridge under the canopy of `beach_palm_tall` ([-0.5,-0.3,9.0], spread x −2.3…1.4, z 7.2…10.8). The bridge's left edge also passes **through the trunk of `env_prop_palm_lean_01`** at x −3.4…−2.6, z 12.2…12.5.
2. **04→05 lens.** `journeyCamera` used a fixed world offset of (+3.6,+3.4,−6.2), which keeps the canopy between the lens and her. The 4 m blend from the far island pose (v24-readable, 50 m away) moves the lens in a straight line through the canopy, which causes the close-up at ≈3 m.
3. **08→09 placement.** The rainbow bridge landed on `anchor_cloudbridge_end`. That anchor is the **inner** edge of the city's round terminus platform, which is about 15 m across with a 4.4 m post in the middle. The straight bridge came from the outer side, so its last ~13 m climbed **underneath** the platform. That is the "grey platform", and it is why she disappears. In the Build05 placement the city also overlapped the far half of the meadow, so the windmill passed through the city.
4. A smaller issue: the old 2.4 m arrival walked through a 0.26 m step onto the city's cloud-bridge deck.

## What changed (2 code files + 1 new engine-free module + test)

* `region/RegionJourneyLayout.ts` (**new**, no `cc` import): holds every placement number and the pure route maths. The adapter and the test use the same code.
  * `islandApproach: [0.8,0,3.2]` (was [0,0,3.2]). The 2.1 m bridge now passes between both palm trunks.
  * City: `skyHeadingDeg: 90`. The city is turned so its own cloud bridge faces back at the meadow exit, which works out to a yaw of −54.97° on this GLB (was 215°). `skycityOffset: [24,12,0]` now places the platform's **outer rim** (13.6 m beyond `anchor_cloudbridge_end`) at walk_path_08 + (24, 12, 0). The city now sits beside the meadow exit (+X) instead of over the windmill.
  * Deck walk: rim → (−10, 3.4) → (−6.5, 3.8) → (−3, 3.4) → onto the cloud-bridge deck (+0.35 m). This goes around the post. Each waypoint uses the measured deck height (the deck rises 0.21 m in the middle) plus about 3 cm.
  * **Arrival root unchanged:** still 2.4 m from `anchor_cloudbridge_end` toward `anchor_cloudbridge_start`, the same point relative to the city as in Build05. The test asserts this to 1e-6.
* `region/RegionJourneyAdapter.ts`: uses the layout module. It sets the city yaw from the anchors, places it by the rim, and builds the bridge as edge → rim, then the deck walk, then the original arrival. The meadow math is unchanged.
* `world-r1/RegionJourneyCore.ts` → `journeyCamera`: the offset is now in the **path frame**, using the walking heading smoothed over ±3 m: back 6.2, left 3.0, up 5.0, look 1.05, lead 0.8, FOV 48. The 4 m blend-in from the live lens now arcs up to 5.5 m, so it passes over the palm canopies instead of through them. This change was not made on its own: the 04→05 approach and the whole 08→09 placement changed with it.
* Untouched: SkycityBoardBackground, SkycityVisitPose (the 09 board camera, which never writes the world lens), meadow placement and offset, bridge mesh and width, speed, controller, timing, and all art and GLBs.
* Tests: `tools/journey-integration/test-journey-occlusion.cjs` is new and added to `run-suite.cjs`. `test-bridge-render-contract.cjs` now loads `bridgePath` from the new module. `test-journey-types.cjs` adds the new module to the strict type-check.

### 09 arrival composition (Funning's plaza)
The 09 board background uses its own rig and camera (`skycityVisitPose(anchor_spawn_girl, anchor_starcourt_center)`), and that code was not changed. The test pins both source SHA-256 values. It checks that the 390×844 pose is identical to Build05: position [5.273, 11.882, 57.184], target [−0.700, 0.931, 31.300], FOV 55. It also projects the plaza centre and the 4 court corners and confirms they are all in frame. The arrival root relative to the city is unchanged.

## Route height profile (new)

Full tables are in `route-height-04-05.csv` and `route-height-08-09.csv`: one row every 0.5 m with world xyz, **meadow-local xyz** (env_meadow.glb space), and for 08→09 **sky-local xyz** (env_skycity.glb space).

* 04→05 (32.465 m): island beach y=0 for 0–3.2 m. Bridge from (−1.31, 0, 8.48), arcing to a peak of y≈2.0 near 16 m, landing on meadow `player_spawn`. Then walk_path_01/02 (meadow-local y 1.35 → 1.59).
* 08→09 (59.272 m):
  * 0–13.5 m: meadow walk_path_02→08 (world y 0.42 → 1.85, meadow-local y 1.59 → 3.01).
  * 13.5–41.7 m: rainbow bridge heading world +X, at a constant **meadow-local z ≈ 3.20**. Meadow-local x runs from −0.35 to −24.3. World y rises from 1.85 to 13.86, which is meadow-local y 3.01 → 15.03, with a sine arch of 2 m. Grass and terrain under this stretch are the **near ground at mid-leg** (meadow-local x −2…−24, z −5…+11).
  * 41.7–59.3 m: sky terminus platform deck, sky-local y ≈ −5.01 … −4.79. That is the `env_sky_static_palette` deck around `anchor_cloudbridge_end` (−43.62, −5.03, 62.27), with deck radius ≈7.5 m and its centre 6.5 m out from that anchor. The leg ends on the cloud-bridge deck at sky-local y −4.71. **This deck is the late-leg near ground**; Voice Bot's grass and stone detail goes here.

## Tests (box, Node 20, TypeScript 5.9.3, no browser or engine)

* `test-journey-occlusion.cjs`: **PASS, 6/6**
  * O1/O2 04→05: 650 samples. Chest and head always visible. Lens is at least **2.83 m** from all geometry after the blend-in. 16 samples at d<1.25 m are exempt and listed: the lens there is still ≥80% the authored island pose, which is unchanged and out of scope. 6 single-point feet grazes at 0.75–2.35 m are listed, not hidden.
  * O1/O2 08→09: 1186 samples, no occlusion, lens is at least **3.0 m** away.
  * O3 foot vs palette top along bridge and deck: worst is **−0.012 m** at 40.14 m, inside the 3 cm tolerance; the bridge strips draw 1.5 cm below the centre line anyway. Before the fix it was −5.98 m.
  * O3 bridge corridors (2.1 m wide, 0.35–2.0 m above the deck) are free on both legs. The old 04→05 bridge went through the lean palm trunk.
  * O4 09 board-background pose and plaza: unchanged and in frame.
* Regressions all PASS: `test-journey-lifecycle`, `test-bridge-render-contract`, `test-journey-types` (strict, 0 diagnostics), `test_region_journey`, `test_region_journey_host`, `test-composition-boundaries`, `test-world-region-exit`, `test-production-integrity`.
* Geometry source: meadow is read straight from `env_meadow.glb`. Draco GLBs (island room, beach palms, skycity) come from `occlusion/fixture-occluders.bin.gz` (510 KB), built with Blender decode plus `build-fixture.cjs`. Their source GLB SHA-256 values are pinned, so the test refuses to run if the art changes.
* Limits: this is geometry, not pixels. The animated character, skinning, and the robot (excluded) are not modelled. The character is approximated by 5 points on the root axis. Grass and flowers are ignored in the corridor check.

## Recordings

* `recordings/`: **NOT DELIVERED in this drop.** Blender 5.2 EEVEE offline preview renders (real GLBs, placements and camera maths, 390×844, 5 fps, not Cocos) are still running in the box at `/workspace/wechat-game/work/b05rec/seq/{before,after}_{0405,0809}`. About 12 s per frame, so they will take hours. Not composed or marked yet.
* **Real Cocos recordings need the Mac** (a Creator 3.8.8 build plus Playwright or Simulator capture). NOT_RUN. Nothing was run on Funning's Mac.

## Notes and risks for acceptance

* 08→09 is longer: 42.87 m → 59.27 m (about **+13.7 s** at 1.2 m/s) because of the deck walk around the post. If that's too slow, the options are a faster `speedMps` on the deck, a shorter `skycityOffset` (24 m), or landing closer to the post with a sidestep. Each would need the test re-run.
* During 08→09 the city now appears to the +X side of the meadow, not ahead over the windmill. The meadow and city still share one world. Their overlap below the city (its rocky underside reaches y −62 local) is not visible on this camera path, according to the test.
* The new `RegionJourneyLayout.ts.meta` uuid (`uuid5`) was hand-written. Creator will keep it, but check that it imports cleanly.

## Notes for Voice Bot (ground foliage on base 3ff5b73)

### Route shift: more than 1 m laterally, so the foliage exclusion band must be rebuilt
* **04→05: the shift is under 1 m.** The island approach and bridge start moved **0.8 m** in world +X. The bridge then converges on the unchanged meadow `player_spawn` landing, and walk_path_01/02 are unchanged. Your 1 m band still covers it, but only just at the island end.
* **08→09: the route moved much more than 1 m.** walk_path_02→08 is unchanged, but everything after walk_path_08 is new: the city yaw changed from 215° to −54.97°, it now sits to the +X side, and the bridge, landing and deck walk are all new. **Rebuild the exclusion band from `route-height-08-09.csv`**, which has a row every 0.5 m with meadow-local and sky-local xyz. Grass placed along the Build05 bridge line can go back in. The new bridge runs at meadow-local z ≈ 3.20, x from −0.35 to −24.3.

### "~6 m terrain above route" near the end of 08→09: confirmed for the old route, gone in the fix
Measured on the Build05 route, at palette top minus foot, sampled from real GLB triangles. Note the numbers vary a lot:
d 28 → −3.98 m, 30.5 → −3.03, **31.75 → −5.84**, 32.0 → −6.11, 33 → −2.0, 35.5 → −5.51, 38 → −0.68. The worst value is **−5.98 to −6.11 m** (d≈32). So your ~6 m estimate is right at its peak, and Oi's 2.27 m is one point on a varying underside. **After the fix:** foot vs palette top is at worst −0.012 m (on the deck), and nowhere is the route below the terrain.

### Orange object blocking the view and floating islands hanging low (your cmp_day.png): both route clearance issues, both cleared
Your sheet shows Build05 frames, with the camera *under* the `env_sky_static_palette` terminus platform. The orange block is the near side of that platform mesh. The rocky islands overhead are its underside and the strata.
* Overhead clearance (a ray straight up from her head, d step 0.5 m, sky plus meadow meshes; `evidence/overhead-clearance.txt`):
  * **Before:** 24 samples have geometry less than 8 m overhead, d 23–34.5. It reaches **0.04 m** at d 32 and is under 1.3 m from d 28.5 to 32.
  * **After:** **0 samples** below 8 m.
* Lens to nearest mesh in the late leg: **before** 1.45–2.4 m from the palette (d 30.5–38), which is the near-camera orange fill. **After**, at least **3.0 m** from every mesh along the whole leg (enforced in `test-journey-occlusion`).
* This is a geometry check, not a pixel check. Confirm it with a re-render on the fix tree.

### Route height profile 08→09 (after the fix, every ~4 m; full 0.5 m table in the CSV)
| d (m) | phase | world y | meadow-local (x,y,z) | sky-local (x,y,z) |
|---|---|---|---|---|
| 0.00 | approach | 0.424 | 2.329, 1.588, 15.908 | -77.146, -18.434, 87.966 |
| 4.00 | approach | 0.928 | 2.594, 2.091, 11.969 | -74.073, -17.930, 90.444 |
| 8.00 | approach | 1.401 | 1.680, 2.565, 8.115 | -70.393, -17.457, 91.907 |
| 12.00 | approach | 1.755 | 0.196, 2.919, 4.421 | -66.515, -17.103, 92.812 |
| 16.00 | bridge | 3.457 | -2.474, 4.620, 3.204 | -63.986, -15.402, 91.324 |
| 20.00 | bridge | 5.813 | -5.706, 6.977, 3.204 | -62.131, -13.045, 88.678 |
| 24.00 | bridge | 8.010 | -9.048, 9.173, 3.204 | -60.213, -10.849, 85.941 |
| 28.00 | bridge | 9.943 | -12.548, 11.107, 3.204 | -58.204, -8.915, 83.075 |
| 32.00 | bridge | 11.529 | -16.218, 12.693, 3.204 | -56.098, -7.329, 80.069 |
| 36.00 | bridge | 12.757 | -20.024, 13.920, 3.204 | -53.914, -6.102, 76.953 |
| 40.00 | bridge | 13.741 | -23.901, 14.904, 3.204 | -51.689, -5.118, 73.778 |
| 44.00 | sky-deck/arrival | 13.977 | -26.921, 15.141, 0.778 | -47.969, -4.881, 72.697 |
| 48.00 | sky-deck/arrival | 14.058 | -30.516, 15.221, -0.489 | -44.868, -4.800, 70.480 |
| 52.00 | sky-deck/arrival | 13.982 | -34.489, 15.145, -0.250 | -42.784, -4.876, 67.089 |
| 56.00 | sky-deck/arrival | 14.094 | -37.431, 15.258, 2.318 | -43.198, -4.764, 63.207 |
| 59.27 | sky-deck/arrival | 14.149 | -40.332, 15.313, 3.204 | -42.258, -4.709, 60.323 |

