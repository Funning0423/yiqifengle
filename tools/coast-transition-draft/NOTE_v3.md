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
| (c) coast→island | superseded: see v3.1 (real return path, toggle frame 1189) | |
Options cost: none needed for (a). If round-3 bounds remove the window, adding a 0.5 s push-in on her at end of shot 1 is the fallback (untested).

## Assumption
Coast root active only in the coast area and the island→coast transition; sail route and bridge hidden during it (scene proposal, Grok Bot approved with the no-pop-in condition above).

## Scene notes (for 场景设计部)
- No mesh problems on her line; her ground: exit_point -0.004, S0 -0.245, S1 -0.843, stop -0.846 (matches report).
- Path measures 10.48 m (report 10.45).
- reuse_bush/palm_lean/palm_tall not in bundle mesh (gates use positions only); layout `tilt` on board slabs ignored by this loader.

---
## v3.1 additions (after Grok Bot approved 6c11b019: 23.33 s, toggle at frame 220)

### Activation gate (toggle_window.py -> `activation_gate` in gates.json; test: `python3 test_gates.py`)
FAILS if the coast root is active on any frame showing the island map lens (v24-readable), or if coast, sail route or bridge is on-screen (any of 7 screens) on the toggle frame or the frame before it. test_gates.py runs both directions plus a negative check (toggling at frame 1 must fail).
| direction | toggle | result |
|---|---|---|
| island→coast | frame 220 (t 3.667 s, shot 3) | PASS: all three off-screen at 219 and 220; map-lens frame 0 has coast inactive |
| coast→island (real return path) | superseded by v3.2: frame 1044 (t 17.40 s) | PASS |

### Clearance evidence (clearance_evidence.py, every frame at 60 fps; out_v3/clearance_evidence.json, evidence_min_solid_clearance.png)
- The 1.36 m figure is **distance to the nearest solid**, not height above ground: frame 588, t 9.80 s, shot 3 (walk; ramp/S0 area). Object coast:gull (local (-2.40, 1.48, 11.00) = world ≈ (1.8, 0.64, 10.5) on the gull rock), nearest point (1.409, 0.905, 10.335), lens (1.414, 2.260, 10.359), lens moving 0.034 m/frame. The gull point is NOT in the 390x844 frame (it is beside/below the lens). Height below the lens at that frame is 1.86 m.
- Minimum height above the first geometry straight below the lens, on moving frames: **1.604 m** at frame 1098, t 18.30 s (shot 6 join, over coast:piece_star on the board; lens (-0.6, 1.054, 22.35)). This is the same figure as the 1.60 m height above ground. 0 of 1390 moving frames are below 1.5 m. Nearest distance to her: 3.21 m. No fix needed.

### Coast→island return (real path, not mirrored): `DIR=return python3 reanchor.py --render`, out_v3/return/
She walks stop z 16.35 → S1 → 3 steps up → S0 → R → W → exit_path_17..06 → exit_point (reverse of the scene report's route; no return design existed, so this is a minimal one).
| # | t (s) | dur | lens |
|---|---|---|---|
| R1 descent from the coast board lens | 0–3.0 | 3.0 | board pose (first frame) descends to front-right 3/4 (az 30, r 3.8, h 2.6); she faces -Z |
| R2 settle | 3.0–3.4 | 0.4 | az 28 |
| R3 terrace lead | 3.4–8.19 | 4.79 | front-right, h 2.9 over the gull rock |
| R4 step-up | 8.19–9.99 | 1.8 | az 45, h 3.0 |
| R5 island path | 9.99–18.73 | 8.73 | swings from front-right to behind-right (az 60→150); a front lens would sit inside the lighthouse at the door |
| R6 arrive at exit_point | 18.73–19.33 | 0.6 | behind-right az 160→170 |
| R7 rise to live island lens | 19.33–24.33 | 5.0 | ends exactly on v24-readable (last frame) |
Total 24.33 s. Gates (7 screens): yaw standing 39.8°/s p99 182°/s² · walking 65.0°/s p99 70 · standing clearance 2.01 m · solids 1.02 m (gull, frame 349, t 5.82, not in frame) · height below on moving frames min 1.544 m (frame 352, t 5.87, over coast rock_2), 0 frames < 1.5 · face/chest blocked 0 s · margin min 0.209 portrait / 0.146 / 0.110 · menu over face 0 · >12 m 0–0.63 s and 20.83–24.32 s, in frame 100 % · first = board lens, last = island lens · no cuts.
Return off-screen windows: frames 919–932 (15.32–15.53 s), 1044–1091 (17.40–18.18 s), 1160–1218 (19.33–20.30 s); toggle chosen 1189.

## v3.2 return smoothing (Grok Bot conditions on the return); outbound byte-identical
- R6 0.6 → 1.5 s and the lens holds az 165 while she stops (was az 160→170); her heading eases onto the last path segment over the 2 s before the stop. This removed the old switch spike (±660°/s² at 17.7 and 18.7 s).
- R3/R4 lens h 2.9/3.0 → 3.15 over the gull rock and rock_2.
| # | t (s) | dur |
|---|---|---|
| R1 descent from board lens | 0–3.0 | 3.0 |
| R2 settle | 3.0–3.4 | 0.4 |
| R3 terrace | 3.4–8.19 | 4.79 |
| R4 step-up | 8.19–9.99 | 1.8 |
| R5 island path | 9.99–18.73 | 8.73 |
| R6 arrive at exit_point | 18.73–20.23 | 1.5 |
| R7 rise to island lens | 20.23–25.23 | 5.0 |
Total 25.23 s (≤45). Yaw standing max 22.9°/s, p99 57.6°/s² (was 181.6); walking 65.0°/s, p99 70.0. Per-shot p99 ≤70.5 everywhere.
Min height below lens on moving frames 1.673 m (frame 338, t 5.63, over coast rock_2); 0 frames <1.6 m. Solids min 1.135 m (gull, frame 343, not in frame). Standing clearance 2.04 m. Face/chest 0 s; margin min 0.110; menu 0; >12 m 0–0.63 s and 21.73–25.22 s, in frame 100 %; first = board lens, last = island lens; no cuts.
Return windows: frames 919–931 (15.32–15.52 s), 1028–1060 (17.13–17.67 s). Toggle 1044 (t 17.40 s, R5 walk); activation_gate PASS; test_gates.py PASS both directions + negative check.
Round-3 scene bounds have not arrived; sail/bridge are still padded boxes — recheck pending for both toggle frames (220 and 1044).

## v3.3 round-3 boxes (scene/b19-coast-scene @c63921b0, coast_aabbs.json; read via git show)
toggle_window.py now uses the per-node coast boxes (terrain, headland, beacon_post, palms; root union and clouds excluded — clouds = island env_cloud_layer, no toggle); coast visible if any node box is visible. Sail/bridge keep the code-constant boxes. `COAST_BOXES=hull` restores the v3.1 mesh-hull check. Camera output unchanged (outbound byte-identical).
| direction | windows (all 7 screens) | toggle | activation_gate |
|---|---|---|---|
| island→coast | frames 210–227 (3.50–3.78 s) | 220 kept | PASS |
| coast→island | frames 1040–1048 (17.33–17.47 s) | 1044 kept | PASS |
Cross-check with their aabb_gate.py (out_v3/r3_aabb_gate_crosscheck.jsonl, 18 frames incl. both window edges): coast verdicts agree on every frame when given the same frustum (vfov widened for fit-width on narrow screens). With raw --vfov their tool says coast off at 209/228 and 1039/1049 too (less conservative on portrait screens).
**Disagreement:** their *estimate* boxes for sail (x -6..3, z 6..82) and bridge (z 3..32) are ON at frames 220 and 1044, and with them there is no window in either direction. My boxes (sail z ≥8.7, bridge z ≥8.0 from TransportLeg/RegionJourneyLayout: pier at z 9.4, bridge starts at the islandApproach end z 8.48) are off. Kept mine per instruction; if runtime nodes really reach z 3–6, the options are a shot-1/3 change (not made; needs approval).

## v3.4 real sail-route bounds (GGbot @8c98bbfe, team/ggbot/outbox/20261030-sail-bridge-bounds/); camera output unchanged
- **Bridge dropped** from the toggled groups: island→meadow is always sail (RegionJourneyAdapter.ts:100 `const sail=true`), so no bridge mesh exists; the nearby `island_dock` (x -2.575..-0.753, z 8.045..14.45) is a permanent island prop (IslandProps), never toggled.
- **Sail group** = SailArt root at rest: `sail_boat_at_dock` (x -1.558..1.366, y -1.361..3.85, z 9.538..14.218, includes sail_gangway_hinge>sail_gangway) + `sailart_props_near` (rocks/foam/buoys, x -9.78..9.167, y -1.46..0.95, z 9.091..53.62); any box visible = sail visible. Excluded: transit_sea (±800 m plane at y -0.91, coplanar with the island sea; no frustum test can clear it, so it must not be toggled — material/cover question), transit_far_cards/clouds (far).
- Code check, which nodes exist: SailArt (boat, transit_sea, transit_sea_props, far cards, clouds, river mouth) is only mounted inside the island→meadow journey (RegionJourneyAdapter.ts:145 `mountSailArt(rig, model)`, rig created inactive at :96) and destroyed on release (:98 `sailArt?.dispose()`; SailArt.ts:627-628 `root.destroy()`). During the coast transitions it is normally not mounted at all; the check is a worst case where it is left mounted, idle at route[0].
- **Wake verdict: not drawn when the boat is idle.** `wake_trail` is created inactive (SailArt.ts:233) and only activated when `peak > 1/255` (SailArt.ts:248-249). Peak comes from the emission `wakeEmission(speed) = smooth(0.35, 3.2, |speed|)` (SailWakeCore.ts:15, :38), stored per point as `k` (:46); the launch ghost is scaled by `pts[0].k` (:144-145), so at speed 0 it is 0 too. `syncWakeTrail` is only called from the sail driver's per-frame update with the boat speed (SailArt.ts:602). No sail driver runs in either coast transition, so speed = 0 and no wake.
- Sensitivity: with the wake envelope (x -5.25..5.15, z -4.80..46.6) added (WAKE=1), there is **no** window in either direction. So 220/1044 are clean only because the wake is off. A Mac trace isn't strictly required, but a cheap confirmation is to read `__QF_SAIL_WAKE` (null or shown:false) during one coast transition on the Mac.
| direction | windows (7 screens) | toggle | activation_gate |
|---|---|---|---|
| island→coast | 210–227 (3.50–3.78 s) | 220 kept | PASS |
| coast→island | 1040–1048 (17.33–17.47 s) | 1044 kept | PASS |
The windows are unchanged from v3.3: the coast node boxes are the limiting groups. test_gates.py PASS (both directions + negative check).
