# Coast transition draft v3: re-anchored on scene r2 (scene/b19-coast-scene @73330bef)
Coast root (-0.6, -0.845, 21.5) yaw 180 under island scene_root (old (-2.11, -0.6, 17.39) is void). Assets read with `git show` into /workspace/coast-reanchor-r2 (branch untouched).
`python3 reanchor.py [--render]` (FIT=r2 default; `FIT=v2` reproduces 2f308bd5). `python3 toggle_window.py` = pop-in check.
Path: exit_point -> exit_path_06..17 -> W (-0.7,0,7.4) -> R (-0.6,0,8.4) -> S0 ramp, 10.48 m measured (report 10.45) -> 3 steps -> S1 -> stop z 16.35.
Board pose unchanged (16 m out at 55°, aimed at board centre (-0.6,-0.845,21.5); same view direction as 2f308bd5).

## Timeline 23.33 s (approved v2 19.89 s, +3.44 s, all from the longer walk)
| # | t (s) | dur | change vs v2 |
|---|---|---|---|
| 1 map-collapse handover | 0–2.0 | 2.0 | same; starts at exit_point |
| 2 heading settle | 2.0–2.4 | 0.4 | same |
| 3 island exit path lead | 2.4–11.13 | 8.73 | was 5.30; one walk, no cut; extra key at +5.5 s; lens h 2.35 (was 2.1) to stay ≥1.5 m over the 0.75 m island prop at x -2.56..-1.97, z 6.4..7.6 |
| 4 step-down | 11.13–12.93 | 1.8 | same |
| 5 terrace lead | 12.93–17.73 | 4.79 | same |
| 6 stop + lighthouse | 17.73–18.33 | 0.6 | key az 0 / side +0.6 (was az 5 / +0.3) so the island lantern stays upper-right |
| 7 orbit-rise to board | 18.33–23.33 | 5.0 | same |

## Gates (real mesh, 60 fps, 7 screens) — all pass, none relaxed
yaw standing 82.8°/s, p99 92 °/s² · walking 42.4°/s, p99 97 · standing clearance 1.45 m · travel solids 1.36 m (gull) / ground 1.60 m · face/chest blocked 0 s · margin min 0.171 portrait, 0.146 (320x568), 0.110 (390x520, 768x1024) · face under menu 0 · lantern upper-right 100 % of shot 6 · first frame = live lens, last = board pose · >12 m: 0–1.10 s and 22.28–23.32 s, in frame 100 % · max step 0.99 m/frame at 0.62 s, no hard cuts.

## On-demand activation: pop-in check (Grok Bot condition)
Groups: coast = real r2 coast mesh convex hull + the 3 reuse_palm columns (report extent x -14.6..13.4, z 4.5..37.5 is already world, i.e. with the new root applied; the AABB was too loose to ever leave frame, so the real hull is used). Sail = AABB x -5..2.5, y -1.4..7, z 8.7..63 (SAIL_I6 pier + route to M0, TransportLeg.ts). Bridge = AABB x -2.6..1.5, y -0.6..3.3, z 8..33 (islandApproach + bridgePath, RegionJourneyLayout.ts). Padded boxes; swap for round-3 node bounds. Outside = fully beyond one frustum plane on all 7 screens.
| direction | window (all three off-screen) | note |
|---|---|---|
| (a) island→coast | frames 196–248 (t 3.27–4.13 s, shot 3 start, 0.87 s); also 338–350 (5.63–5.83 s) | shot 1 never clears (map lens sees all three), no shot change needed; toggle at frame ~220 |
| (b) island map lens v24 (-12,15.5,48) | none | all three in view; coast must stay inactive whenever the map shows; toggle only inside (a)/(c) windows |
| (c) coast→island | reversed path: frames 1151–1203 / 1049–1061 of the reverse (same frames as (a)) | no reverse camera exists yet; assumes it mirrors this path |
Options cost: none needed for (a). If round-3 bounds remove the window, adding a 0.5 s push-in on her at end of shot 1 is the fallback (untested).

## Assumption
Coast root active only in the coast area and the island→coast transition; sail route and bridge hidden during it (scene proposal, Grok Bot approved with the no-pop-in condition above).

## Scene notes (for 场景设计部)
- No mesh problems on her line; her ground: exit_point -0.004, S0 -0.245, S1 -0.843, stop -0.846 (matches report).
- Path measures 10.48 m (report 10.45).
- reuse_bush/palm_lean/palm_tall not in bundle mesh (gates use positions only); layout `tilt` on board slabs ignored by this loader.
