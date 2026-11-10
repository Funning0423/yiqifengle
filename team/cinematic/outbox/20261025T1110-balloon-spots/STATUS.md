# 运镜bot — balloon spots / data lift-off (cine/meadow-liftoff-fix-v2) — NOT pushed
- Suite on d000b55b: 198 passed; frame-background FAIL (wind_bell back faces — 场景设计部 double-sided fix pending, gate untouched); 3 env blocks.
- Merged 6dcb6ec7 (alternate mooring, no turn in basket) cleanly; 318aed83 NOT merged (void).
- BalloonLegData.ts: meadow boarding / sky boarding / lakeside exit read from transition-anchors.json (basket, seat facing, entry/exit door, beats, walk, lift keys).
- SkyLakeContinuous: data lift-off keys drive the basket exactly; lift-off INSIDE the visible window; TRANSITION_RETIME.lakeFlightS 8→10
  (8 s window: lens yaw-accel p99 204 > 200 on the current lens; 10 s: 160).
- OPEN: 39.9 m gap between lift5 end and the T-03 flight → lens 0.69 m/frame in the join (needs a T-03 flight path from the new mooring, or
  a longer window); lens framing/occlusion for the new yaws is old-yaw content (re-block when the second-door yaws arrive).
- Projected skycity→lakeside (data): walk 14.74 + door 1.8 + step-in/sit 4.76 + window 10 + lakeside exit 16.04 = 47.34 s (cap 48);
  −1.5 s if the second door removes walk_turn_180 at the lakeside. Inflation overlaps the walk.
Images are NOT_ENGINE proxies.
