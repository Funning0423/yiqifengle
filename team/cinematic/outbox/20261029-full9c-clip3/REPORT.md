# full9c clip3 — the three 9ec5323c lens penetrations, checked on the post-skyframe code (f6cf3af9)
运镜bot, branch `cine/b19-full9c-clip3` (from f6cf3af9). Offline, NOT_ENGINE: real env_skycity.glb (Draco), lakeside instances and transport_balloon.glb meshes; flat raster for the images. Evidence: `/workspace/r9c/key-try2/key/state.jsonl` (9ec5323c Mac camera every ~2 s), extracted to `tools/journey-integration/fixtures/9ec5323c-key-try2-sky-cam.json`.

| Case | Still on f6cf3af9? | Root cause | Evidence |
|---|---|---|---|
| 1 P1 skycity→lakeside opening (keys 121–132) | **No** | Sail-chain city offset. In 9ec5323c she ended the finale in the visible city (Cw+Δ, 26.6 m off). `skyLakePreWalk` then walked her 26.95 m in a straight chord to S6 in the skyMooring5a frame (`[QF_LEG_TIME] skycity-S6-prewalk lengthM 26.95`, ≈ Δ), through the city. The follow lens (`skyPreFollowPose`, no collision) dragged along at y≈21 (Mac z 160→137 at 1.2 m/s). On f6cf3af9 the city is at Cw and the finale ends on S6 (cdf61cc5), so `d3(start,S6) ≤ 0.6` returns null and there is no prewalk. | Mac samples in the 9ec placement: down to 0.25–0.34 m from env_sky_ruins/foliage. Current ride lens ≥ 1.41 m from solid mesh on 7 screens. case1-before-after-7screens.png |
| 2 P1 balloon lift-off (keys 187–191) | **No** | Same offset. The ride lens path is identical: the Mac samples match the model within 0.3 m, e.g. (99.50,34.78,118.67) vs (99.35,34.76,118.41). It never comes within 3.04 m of the basket or envelope. The dark green/brown plane was **env_sky_floatingrocks_2 of the displaced city** (lens 0.45 m from it at +58.8 s) and the city underside, not the balloon. The 20 m "teleport" is the existing eased swing (≈1.5 s, ≤0.408 m per 60 Hz frame, yaw ≤80.8°/s) sampled at 2 s. | Current: lift-off/flight clear > 3 m of the mesh, ground ≥ 6.05 m, balloon ≥ 3.04 m. case2-before-after-7screens.png |
| 3 P2 T-02 last shot into the steps (key-try2 #42) | **Yes** | `skyFinaleApproach` scores only the lens boxes, and the box generator drops floors and steps below 2.2 m. The orbit's height profile drops to her height early, so a far starting lens sweeps through env_sky_ruins (the S4 stairs). In 9ec5323c the lens was held at the S4 follow pose (+0.9…+6.8 s) and then approached from there. Not frame-related: the finale lens and the city were both in the offset frame. | Reconstruction matches the Mac lens at +8.81 s within 0.15 m and the end within 2 mm (fixtures/9ec5323c-t02-approach.json). Current code from the same S4 follow lens: 0.39 m from env_sky_ruins. From the F4 follow pose at S6: 0.17 m and enclosed (the known approach-start issue; the approved "start the approach 1.05 m before S6" diff is not in f6cf3af9). case3-before-current-7screens.png |

## Why the 1.1 m collision gate missed them
- `collision-gate.cjs` checks only `BalloonTransit:prewalk|B1` writes against the meadow proxy. Every other writer (RegionJourneyCore:onFrame, SkyWalkShot, world.setCamera) is only counted as UNCHECKED. Skycity, lakeside and the T-02 shot were never traced against geometry, and the gate has no skycity frame at all.
- `test_lake_leg_c` W4 checks the lens only against the transition occluder **boxes**, only before flight. It has no mesh, no balloon, no ground, and no prewalk (it starts at S6, so the 26.95 m offset walk could not appear).
- `test_t02_sky_final` F4 uses boxes plus a **relative** mesh rule (≥ min(1.1, start clearance)) from **one** ideal follow pose at S6. A start at 0.17 m therefore passes, and a far starting lens is never tested.
- None of the offline models used the sail-chain placement (city + Δ), so the frame mismatch was invisible offline.

## New hard gates (run-suite)
- `lens-trajectory-clearance`: `tools/journey-integration/lens-clearance-gate.cjs`. Checks every lens sample of the sky→lake ride (walk, board, lift-off, flight; 7 screens) and the T-02 approach (from the F4 pose and from the S4 follow lens) against the real meshes live at that moment. Rules:
  - not enclosed;
  - ≥ 0.5 m from solid mesh, from the basket/envelope, and from her;
  - ground below ≥ 1.5 m on travel shots and ≥ 1.1 m on standing shots;
  - step ≤ 0.6 m per frame.
  
  Soft (reported only): foliage/flower cards and the gardener robot.
- `lens-trajectory-9ec-must-fail`: all three 9ec5323c failures must be caught. **PASS**: case 1 at +34.8 s (0.34 m ruins), case 2 at +58.8 s (0.45 m floating rock), case 3 at +8.51 s (ground 0.67 m over the steps).

Current result: the ride is **PASS** on 7 screens. T-02 is **FAIL** (case 3 still present, plus the 0.17 m start). The fix is open, see below. lens-gate-current.txt/json and lens-gate-9ec-must-fail.txt/json.
