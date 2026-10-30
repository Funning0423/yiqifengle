# clip19: 19bd812a visual acceptance (界面验收部 clipping-19bd812a), camera items

Base: cine/b19-full9c-final-cam 18965329. Apply order: the three final-cam diffs (outbox/20261029-full9c-final-cam: RegionNodeStage-finale-rail, BalloonTransit-b1-ease, BalloonTransit-3b-landing), then:
1. RegionJourneyAdapter-lake-departure.diff (GGbot file, 1 line)
2. test-lakeside-journey-wire.diff and test_lakeside_reach.diff (both pins updated to the new line)
3. run-suite-clip19.diff (suite entry `clip19-regressions`)
`git apply --check` passes in that order on 18965329 (scratch: /workspace/scratch-clip19).

## Root causes
- **P1 lift-off green (finstart 128–137) and 新发现 A (green ceiling over the 5a walk, finstart 62–116).** Same root cause, and it is not the lens path.
  - RegionJourneyAdapter.ts:235 places the lakeside journey copy with `lakesideJourney(start)`. `start` is `pose.controllerRoot` at prepare time (WorldFlowCore.ts:460/473 → RegionJourneyCore.ts:248).
  - The lake is prepared while she is still on the skycity board (state `level`, before the finale). So `start` is the board checkpoint, about (19, 18.85, 100.5), not the ride's departure S6 (83.32, 18.85, 130.80).
  - Placed from there, the lake copy lands about (−64, 0, −30) m off. Its terrain hill (LK_terrain_i, up to y≈27) sits on the skycity mooring:
    - her seat is 2.7 m under the lake terrain;
    - the C1 hold lens is 0.19 m above it;
    - the pre-lift rise (y 20.4→24.9) goes through it and then looks down onto its top face. That is the 61–92 % dark-green frame, with only the envelope poking out.
  - Fit evidence: lakesideJourney([19, 18.85, 100.5]) reproduces the Mac flight (x 118→7 at z≈130) and the touchdown lens x/z (7.07, 132.3). With S6, the model lands at (71, 29, 162).
  - Fix: at mooring C, place the lake from `M5.walkWorld[0]` (the S6 the ride departs from). All existing lake models and gates (test_lake_leg_c, lens-clearance-gate, sky-lake model) already assume S6.
- **P2 flight #159.** Same root cause. The flight route is built from the misplaced lake (L.approach/bridge), so the lens crossed the city west over the star ring.
  - Mac trace t 357.43: 0.10 m from env_sky_static_palette. At 357.89: 0.23 m from env_sky_starring.
  - With the lake from S6, the ride lens keeps ≥2.97 m from skycity and lake meshes on all 7 screens.
- **P2 T-02 #38.** In 19bd812a it is the RegionNodeStage skyFinaleApproach swoop (node-lens 312.2→313.6 s, 20 m in 1.4 s). It goes through env_sky_ruins: enclosed 312.66–312.72 s, min 0.03 m.
  - Already fixed by final-cam RegionNodeStage-finale-rail.diff, which removes skyFinaleApproach.
  - The S4>S6 rail is at ≥0.88 m from the solid mesh on all 7 screens, with 0 enclosed samples.
- **Meadow m 407–431: OPEN.** See SCENE-NOTE-meadow-windmill.md.

## Gate: tools/journey-integration/test-clip19-regressions.cjs (+ fixtures/19bd812a-camtrace-clip19.json, from the Mac camTrace)

| row | 19bd812a (must fail) | clip19 (diffs applied) |
|---|---|---|
| R1 lift-off vs lake copy | caught: lens 0.00 m, lens under lake in 101 samples, her LOS blocked 54, seat under lake | PASS: lake >3 m, 0 under, 0 LOS, seat clear |
| R2 T-02 | caught: 0.03 m env_sky_ruins, 6 enclosed | PASS: rail S4>S6 ×7 screens, min 0.88 m, 0 enclosed |
| R3 flight | caught: 0.10 m env_sky_static_palette | PASS: min 2.97 m (skycity+lake), 7 screens |
| R4 meadow | caught: 0.01 m windmill_static_merged, 61 enclosed | OPEN (not counted) |

On the branch without the diffs, R1 and R3 FAIL by design. The rows are source-tied: the R1 rule reads which start the adapter uses.

## onewriter trace mode (lens-clearance-gate.cjs --trace, 1fd7851d; copied read-only into the scratch tree, not edited)
- **19bd812a finstart trace:** FAIL, as expected.
  - region.node-lens at t 312.62: 0.03 m from env_sky_ruins (ground rule G). This is the T-02 swoop.
  - world.setCamera at t 337.93: 0.23 m from env_sky_static_palette (S). This is the C1 board close-up pan to the door spot.
- **Code after the fix, as a model trace (model-trace-make.cjs: S4>S6 rail + the whole sky→lake ride in camTrace format):** PASS.
  - node-lens: 0 violations, solid ≥0.88 m.
  - SkyWalkShot: 0 violations, solid 1.41 m, ground 1.37 m.
  - world.setCamera (board, lift-off, flight): 0 violations, solid 1.39 m, ground 1.51 m.
- **t 312.6:** cleared, because the final-cam rail replaces skyFinaleApproach.
- **t 337.9: not proven on the Mac.** The model C1 pan stays ≥1.39 m on all 7 screens (closest at flight−5.48 s, (94.02, 21.59, 120.99)). The Mac pose at that moment, (96.74, 20.67, 120.73), sits off the model path, and the trace does not say why. It could be a different pan start: in the runtime her walk/board timing is compressed. **Mac rerun needed**, then run --trace on it.

## Item 4 (final)
- Cause: the transit clouds (clouds_floor, clouds_city_sea) were unpainted at the origin during the pre-walk. The windmill is not involved: the earlier replay used the wrong frame (bridge mOff vs runtime sailMeadowRoot, 26.6 m in z).
- Fix: GGbot is fixing the cloud paint in BalloonTransit himself. No camera code change; the paint(0) diff and the windmill lens fix were dropped.
- Gate: R4-mustfail (19bd812a origin clouds, 0.00 m @t 265.50) and R4 (counted; paint(0) placement, sail frame, every start, 7 screens).
- collision-gate: defaults to the sail frame when the trace has no B1 write.
- Image: 4_meadow_m407-431_before-after.png
- UPDATE: we now write the cloud paint fix ourselves: BalloonTransit-prewalk-cloud-paint.diff adds paint(0) after the clouds are attached (BalloonTransit.ts:386) and before the pre-walk (~:603). It hides/places clouds_city_sea and clouds_floor. Applied last in the ordered set, in a separate hunk from b1-ease/3b-landing. paint(0) is the B1 t=0 state, so opacity is continuous at B1 entry. Size: BalloonTransit 72432→72553 B raw (+121), 24424→24488 B gzip (+64).

## GGbot rebase (cd0893ea)
- BalloonTransit-prewalk-cloud-paint.diff now targets cd0893ea (after the yard-balloon latch). The old base version is kept as -on18965329.diff.
- Applies on: cd0893ea alone; cd0893ea + rail/b1-ease/3b-landing in either order; and 6b78cccc + rail/b1-ease/3b + RJA lake + paint. b1-ease md5 is cb67d58a, read from wt-final-cam.
- test-c-prewalk-clouds: PASS with paint, FAIL without it (jump at frame 122).
- RJA lake-departure + 6b78cccc compose: the lake is placed from S6 and still hidden until openLake() at the door.
- test-b1-yard-balloon-b1ease.diff pins the exact b1-ease B1 line and the exact b1Hold latch. With b1-ease: PASS. Without it: FAIL.

## cd0893ea chain
- run-suite-clip19-cd0893ea.diff adds the clip19-regressions row (after finale-stand) with a 600 s timeout. cd0893ea lacks the clip3 gate files, so the diff also adds them as new files: test-clip19-regressions, clip19-prewalk-model, the fixture, clip3/lens-scene, clip3/sky-lake-model, region-nodes/sky-rail-model.
- On a base without the final-cam S4>S6 rail (SkyRunLens.ts), R2 fails explicitly instead of crashing.
- Order: final-cam 3 → lake-departure → lakeside-journey-wire → lakeside_reach → b1-yard b1ease → run-suite-cd0893ea → cloud-paint → onewriter 04–09. All apply clean on cd0893ea.
