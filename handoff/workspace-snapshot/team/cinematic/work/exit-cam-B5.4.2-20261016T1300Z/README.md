# Exit camera B5.4.2: B5.4 + ≥1.1 m prop clearance + shorter settle (local only, NOT pushed)
The B5.4.1 folder was renamed to this one (scope change to B5.4.2).

## Changes on top of B5.4 (10009b7)
- `b5.nudge = { at: 4.8, width: 4.5, up: 0.35 }`
  - a C2 bell (s5 up, then s5 down) adding up to +0.35 m of height during tau 2.55–7.05 s after the door key (t ≈ 5.1–9.6 s)
  - outside that window the path is unchanged
- `cruiseRamp` (ramp-out) 0.25 → 0.12, `crane.settleSeconds` 32 → 29. Total 40.68 → **37.68 s**.
- New test `exit-prop-clearance`: point clearance ≥ 1.1 m to every non-exempt mesh (lens_rays ARCH plus door leaves exempt) on every frame from the door key to the settle.
- `EXIT_LIMITS.peakMps` 2.2 → 2.0.

## Progress
- [x] params, timing, curve + clearance plots



- [x] all done: see STATUS. Commit 911a954e57e8e4943538a8f5f68caaf11521c8b6, tree 72a8be59eb241a0a19585ec59f66e730efd78682.
- Pose: v24-readable kept. Landmark NCC offsets vs screenshot: lighthouse top 0/0, cottage roof 0/0, door arch 0/0 px; horizon -1 px; island bbox within 1.5 px (471x1024 px). Solving the pose from the screenshot landmarks gives v24-readable back.
- 20 s is not possible at 2 m/s: the home pose is 52 m from the door (55 m of path). 20 s needs a 4.56 m/s peak and 3.8 m/s² accel. Shortest at ≤ 2 m/s is about 37.7 s (this build). 30 s needs 2.54 m/s.
