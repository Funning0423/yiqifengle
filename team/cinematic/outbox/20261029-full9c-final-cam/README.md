# full9c final-cam — S4>S6 planSkip k join (运镜bot, 2026-10-30 EDT)

## Fix (root cause, no gate change)
- SkyRunLens.skyRailFollow: the planSkip `k` join now ends ON the S6 stand shot (SKY_FINALE_POSE_LOCAL) and holds it until the rail meets it at the end of the walk (the old version ended on the live rail tail). One continuous eased move, no cut; first frame = live lens.
- Measured: the S6 stand shot itself had only 1.37 m of ground below it (env_sky_static_palette), so a join ending on it still failed the 1.5 m travel rule. It is NOT ≥2.0 m. The stand shot was raised 0.16 m (position and target both, so the aim offset and fov 45 stay the same). Ground is now 1.53 m. The S4>S6 rail was rebaked onto it (gen-sky-finale-rail.cjs, only the S4>S6 entry changed).
- lens-trajectory-clearance: PASS, 0 violations (from S6 rows groundMin 1.53 m, step ≤0.494 m). finale-stand, t02-sky-final, sky-finale-rail, sky-walk-whole, sky-walk-endshots and walk5a-in-frame all PASS.
- BalloonTransit-b1-ease.diff and -3b-landing.diff are byte-identical to c2529aea.

## Final set on cd0893ea (apply order)
00-camera-owned-files.diff (our files, d3b8e5e4→final-cam) → RegionNodeStage-finale-rail → BalloonTransit-b1-ease → BalloonTransit-3b-landing → clip19 RegionJourneyAdapter-lake-departure → test-lakeside-journey-wire → test_lakeside_reach → test-b1-yard-balloon-b1ease → 10-run-suite-clip19-after00.diff (residual of clip19 run-suite-clip19-cd0893ea.diff: its lens-scene / sky-lake-model / sky-rail-model already ship in 00, and its sky-rail-model is older) → BalloonTransit-prewalk-cloud-paint → onewriter 04–09.

## Images
- skipjoin-k-S4toS6-before-after.png: 390x844, top = 11767f5b (ends on the rail tail), bottom = new (ends on the stand shot). Frames: before the join, join start, +20, +40, +60 fr, end−60, end.
- skipjoin-k-S4toS6-7screens.png: the new join on the 7 screens (rows 390x844, 414x896, 360x780, 375x667, 320x568, 390x520, 768x1024).

## Every >12 m span and T6
| walk | case | part | screens | start s | duration s | max chest-hidden fr | max face-hidden fr | out-of-frame / frames (7 screens) | in-frame % |
|---|---|---|---|---|---|---|---|---|---|
| S1>S2 | board entry → exit | in | 7 | 0.00 | 1.63–3.65 | 0 | 0 | 0 / 1173 | 100.0 |
| S1>S2 | board entry → exit | skip | 7 | 6.78–9.35 | 0.83 | 10 | 0 | 0 / 350 | 100.0 |
| S1>S2 | board entry → exit | out | 7 | 12.58–15.67 | 4.33–6.38 | 0 | 0 | 0 / 2314 | 100.0 |
| S2>S3 | board entry → exit | in | 7 | 0.00 | 4.38–6.43 | 0 | 0 | 0 / 2339 | 100.0 |
| S2>S3 | board entry → exit | skip | 7 | 10.48–13.05 | 1.10 | 0 | 0 | 0 / 462 | 100.0 |
| S2>S3 | board entry → exit | out | 7 | 16.88–19.95 | 5.42–7.48 | 154 | 141 | 137 / 2776 | 95.1 |
| S3>S4 | board entry → exit | in | 7 | 0.00 | 5.38–7.43 | 155 | 142 | 134 / 2759 | 95.1 |
| S3>S4 | board entry → exit | out | 7 | 19.10–22.12 | 8.28–10.40 | 0 | 306 | 128 / 3994 | 96.8 |
| S4>S5 | board entry → exit | in | 7 | 0.00 | 8.17–10.32 | 0 | 315 | 125 / 3950 | 96.8 |
| S4>S5 | board entry → exit | skip | 7 | 14.23–16.80 | 1.23 | 0 | 0 | 0 / 518 | 100.0 |
| S4>S5 | board entry → exit | out | 7 | 22.22–25.18 | 11.15–13.32 | 306 | 306 | 136 / 5207 | 97.4 |
| S4>S6 | board entry → exit | in | 7 | 0.00 | 8.18–10.33 | 0 | 311 | 125 / 3959 | 96.8 |
| S4>S6 | board entry → exit | skip | 7 | 14.15–16.72 | 2.02 | 0 | 2 | 0 / 847 | 100.0 |
| S4>S6 | from S6 (planSkip) | in | 7 | 0.00 | 8.18–10.33 | 0 | 311 | 125 / 3959 | 96.8 |
| S4>S6 | from S6 (planSkip) | skip | 7 | 11.35–13.92 | 1.05 | 24 | 24 | 0 / 441 | 100.0 |

T6 overall: 97.40% of >12 m frames in frame (34138/35048), requirement ≥95%.