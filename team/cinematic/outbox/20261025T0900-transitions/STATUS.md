# cine/transitions-continuous — round 1 (framework + 30 s flight), base cine/p0drag13 977711f0
Not pushed. Suite on bea8ac7e: 181/184 PASS, 3 BLOCKED (2× Node ≥22.6, navigation-guard browser), 0 FAIL. No gate relaxed.

## TransitionCamera (region/TransitionCamera.ts, pure, no cc)
- beginTransition(id, from: live Source (t)=>Pose | CamState{pose,vel?,yawRateDegS?}, her?) → TransitionRun | null (no data → caller keeps old path).
- run.step(dt) → Pose to write each frame; run.handTo(nextLevelLens) starts the out-blend; run.phase 'in'|'shot'|'out'|'done' (done = blend over AND capped lens caught up).
- Blends mix two LIVE poses with min-jerk weights (pos/vel/acc continuous); blend length grows so lens peak ≤ 5 m/s.
- ViewLimiter on the written view: yaw ≤90°/s ≤200°/s² (stand) / ≤120°/s ≤300°/s² (walk), feed-forward + eased catch-up; pitch ≤40°/s, FOV ≤12°/s.
- Data: setTransitionData({format:'qf-transition-cam/1',segments:{id:ShotSpec}}); ShotSpec keys {t,pos,look,fov}, space 'world' | 'her' (offsets from her feet, rotated by her yaw). Placeholder anchors: tools/transitions-continuous/transition-anchors.placeholder.json (placeholder:true, not loaded by the game).
- T-02 continuation: onShotContinue(fn) / fireShotContinue(CamState). Also globalThis.__qfTransitionCam.
- Not yet wired into RegionJourneyCore (rideFade/WindWipe path untouched) — GGbot integration point.

## 30 s meadow→skycity flight (flight file unchanged; ride clock warp in BalloonFlight.ts, used by BalloonTransit)
rate 1 for τ 0–12 (board, burner 0.4, liftoff 1.8, cloud-enter 4.3, meadow-unload 11.2, seam 11.4, city-on 11.6: exact), smoothstep up 12–14 to ×17/11, cruise, smoothstep down 23–25, rate 1 25–30 (approach end + land 35 → τ 29, exit 36 → τ 30).
Ride-clock cues: cloud-exit 14.29, islets 18.50, approach 22.06, land 29.00.
Camera (60 fps, per side of the seam re-base): yaw max 37.6→41.5 °/s, yaw accel p99 178.5→178.5 °/s², lens step ≤0.52 m/frame, FOV constant.

## Handoff test (synthetic level orbit → shot → next level orbit)
walk 130°: yaw 59.6°/s, p99 47; stand 170°: 87.8°/s, p99 111; moving-in: 113°/s, p99 300 (walk cap); pos step ≤0.15 m/frame; FOV step ≤0.1°.
Comparison image: NOT_ENGINE_flight30_timewarp.png (proxy chart, not engine render).

# Round 2 — merge cand + segment 6 (skycity→lakeside)
- Merged ggbot/cand-b18-stage d9423886 (normal merge 3419d404). Conflicts only in generated suite reports (taken from cand, regenerated). No source conflicts. T-03 b1bb58e7 is in d9423886.
- region/SkyLakeContinuous.ts (+.meta): camera only. Entry = TransitionCamera.onShotContinue (T-02 end CamState → `from`).
  Timeline (segment clock, all screens): C1 walk 0–8.65 (T-03 walk lens + its start blend) · C1 board 8.65–13.85 (door 1.0 + step-in 1.2 + ignition 3.0, PLACEHOLDER; min-jerk blend to the lift-off lens) · lift-off 13.85–19.85 (the 18 s T-03 hid under black, 6 s eased warp, ×~4.3 peak) · T-03 visible flight 19.85–31.85 (12 s, bit-identical) · touchdown 31.85 → C2 = ride time R.T+Δ: sign at +1.8 for 3.0 s, board blend at +5.3 (LAKESIDE_TOUCHDOWN unchanged).
  rideT(τ) maps to T-03 ride time for basket/her/adapter.
- tools/transitions-continuous/test_sky_lake_continuous.cjs (suite: sky-lake-continuous), 7 screens, 60 fps, C1→flight→C2→board:
  yaw max 55.0°/s, yaw accel p99 84°/s², lens step ≤0.192 m/frame, accel p99 12.8 m/s², FOV step ≤0.028°, face/chest hidden ≤0.17 s. T-03 flight exact at 4 probes.
  liftS sweep: 4 s → 85.3°/s / 177°/s² (passes, no margin); 5 s → 66.9 / 122; 6 s chosen.
- test-lakeside-touchdown-timeline PASS (unchanged), t03-arrival 7/7.
- Suite on 9b695930: 196/199 PASS; BLOCKED: legacy-board-ui-pure, reward-background-return (Node ≥22.6), navigation-guard (browser). 0 FAIL.

# Round 3 — b53c8336 (sign removed), lift-off 5 s, ride 29.5 s, data lift-off
- Merged ggbot/region-arrival-title b53c8336 (clean, 7d65d64c).
- Sign audit: no camera pose/aim used the sign (signAtS/signS only time the door hold; blendAimPull pulls toward HER chest). Timing kept: board blend at touchdown+5.3 (lakesideBoardByS), sign constants untouched (GGbot's contract).
- Touchdown lens (lakesideDoorWideLens): new her-size floor LAKESIDE_DOOR_HER_FRAC + face-over-basket-wall check. Tried 0.20/0.15/0.12: route O1 (hard) fails on 390x844/414x896/360x780 for every value ≥ 0.08 (basket wall over her face as she steps out, 1 frame at touchdown+3.1 s); 0.12 also hit F2 (80.2 % right edge, 1 frame). Kept floor 0.07 → same lens as before (image shows no change). Larger framing needs a different step-out composition — not done.
- C2 her+lake gate (new, stricter than before — there was none): she fully in frame, ≥3 lake samples, standing height ≥ 7 % every frame touchdown → +5.3 s. Measured: 7.9 % (390x844/414x896/360x780), 10.6 % (375x667/320x568), 11.8 % (390x520), 11.6 % (768x1024); lake ≥3 all.
- Segment 6: liftS 5 (yaw 66.9°/s, p99 122°/s²), capS 26, skyLakeTotalS / skyLakeOverrunS; data trajectory liftTraj {t,pos,yawDeg} + liftTrajJoinErr; synthetic stand-in: yaw 18.6°/s, p99 55, step 0.27 m.
  Total T-02 handoff→touchdown: placeholder walk 8.65 → 30.85 s (over cap by 4.85); 4 s walk → 26.2 s (over by 0.2 s → trim 0.2 s of visible flight, needs approval since the T-03 flight is kept exact).
- Ride 29.5 s (×1.619 band 14–22.5 s): 0–12 s cues exact; land at 28.5, end 29.5; camera yaw 43.5°/s, p99 178.5°/s², ≤0.55 m/frame.
