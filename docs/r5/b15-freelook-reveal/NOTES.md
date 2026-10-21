# b15 free-look reveal of the moored balloon (base cine/r5-b15-balloon e020254e + cherry-picks d0e5f003, 96afe8bd)
How free look works here: during match-3 the orbit is the 'board' row (yaw ±4°, pitch ±2°), so no reveal while the board plays.
Lakeside free look is FreeOrbit 'lakeside' around HER (look point = feet + 1.15 m), not an in-place turn of the board lens.
So the reveal is an orbit: on portrait the balloon + her fit at the seeded arm (7.13 m) by orbiting ~76–103° (finger left,
orbit yaw −). The earlier in-place "58° right" numbers do not apply to the game camera.
Change (FreeOrbit.ts):
- revealWiden {fovAddDeg 8, fullDeg 70} on lakeside: fov = seeded fov + 8·smootherstep(|yaw − seedYaw|/70). Pure function of yaw, 0 at
  the seeded yaw (exact board/follow lens), no state, so turning back restores it. No pull-back needed (arm unchanged).
- lakeside pitchMax 42 → 54, distMax 16 → 16.5: the landscape board lens (pitch 53.3°, 16.16 m) used to be clamped on seed.
Known, not fixed: seeding from the board lens re-aims at her on the first drag (view jump 6.5° 390x844, 9.0° 320x568, 8.0° 390x520,
50° landscape) — pre-existing orbit seed behaviour (position matched, target = her).
