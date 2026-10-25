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
