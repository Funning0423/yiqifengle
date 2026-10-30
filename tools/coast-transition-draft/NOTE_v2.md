# Coast transition draft v2: re-anchored on the REAL mesh (scene/b19-coast-scene @7297fa5f)
Runtime world frame = island scene_root. Island geometry: creator-project/assets/firstslice/combined_visual_m.glb, anchors: combined_anchors_m.json.
The coast bundle glbs plus coast_layout.json are placed at position (-2.11, -0.6, 17.39), yaw 180, under scene_root.
Run `python3 reanchor.py` for the checks (about 4 s) or `--render` for images (about 1 min).
Lens keys are path-relative: azimuth from her heading (+ = her right), radius, height, look lift/side and vFOV. Re-anchoring only needs the anchors.
Draft only; no runtime integration and no new writer.

## Her ground check (downward ray at each anchor; avoids the meadow-style 26.6 m frame error)
| anchor | world | mesh y |
|---|---|---|
| door_stand_point | (-0.212, 0, -0.332) | -0.053 (env_island_main) |
| S0 = exit_path_17 | (-2.11, 0, 5.29) | -0.013 |
| S1 | (-2.11, -0.6, 6.49) | -0.40 on arrival_steps (step-foot tread; island surface sits above it, see conflicts) |
| E-0.25 stop | (-2.11, -0.6, 12.24) | -0.599 (coast terrain) |

## Timeline (19.89 s; 16.2 s before)
| # | t (s) | Her action | Lens | Look | vFOV | Move / join |
|---|---|---|---|---|---|---|
| 1 | 0–2.0 | stands at the door facing +Z | from the LIVE island lens (v24-readable, (-12, 15.5, 48) aimed at (1, .5, 1), fov 42) down to front-LEFT 3/4: az -30, r 3.4, h 2.1 | lerp to her +0.9 | 42→44 | descends in her cylinder (azimuth, log radius, height); continuous |
| 2 | 2.0–2.4 | about 10° heading settle onto the path | az -28, r 3.4, h 2.1 | her +0.9 | 44 | near-hold |
| 3 | 2.4–7.70 | walks door→S0 along the curved island exit path, 6.36 m at 1.2 m/s | az -24…-30, r 3.2–3.3, h 2.1–2.2, leading dolly | her +0.9, side +0.3: she sits on screen-left third | 44 | lead |
| 4 | 7.70–9.50 | steps down 3 sand steps (step-down kept) | az -45, r 3.5, h 2.3 (front-left 3/4) | her +0.8 | 45 | lead; eases on |
| 5 | 9.50–14.29 | walks S1→E-0.25, 5.75 m | az -25 → 5, r 4.2 → 5.7, h 2.4 → 2.0 | her +0.9 → +1.8 | 46→50 | terrace lead, drops into shot 6 |
| 6 | 14.29–14.89 | stops and looks back at the lighthouse | az 5, r 6.0, h 1.9 (over the board, 1.5 m clear) | her +1.8, side +0.3 | 50 | slight pull-back; the lantern sits upper-right |
| 7 | 14.89–19.89 | stands | orbits round her RIGHT side (az 5→180) while rising to the board pose: 16 m out at 55°, aimed at board centre (-2.11, -0.6, 17.39) | look stays on her, then hands to board centre over the second half | 50→45 | ends exactly on the board pose |

There are no cuts and nothing to register.

Retime notes:
- Shot 1 runs 2.0 s, because the real handover lens is about 50 m away.
- Shot 7 runs 5.0 s. Turning 175° in less than that breaks the 90°/s standing yaw limit.
- The whole lens stays front-left during the walk. The right side of the curved exit path has a 2.06 m island prop, and a left profile on the steps would sit on the gull rock.

## Checks (real mesh, 60 fps)
| Check | Result | Limit |
|---|---|---|
| Yaw standing | max 76.6°/s, p99 accel 80°/s² ✅ | 90 / 200 |
| Yaw walking | max 37.7°/s, p99 accel 76°/s² ✅ | 120 / 300 |
| Standing clearance | min 1.41 m (env_island_props_merged) ✅ | ≥1.1 |
| Travel: distance to solids / height above ground | min 1.41 m / 1.68 m ✅ | ≥0.5 / ≥1.5 |
| Face/chest blocked | 0 s ✅ | ≤0.5 s |
| Frame margin | min 0.146 portrait, 0.110 (390x520, 768x1024) ✅ | ≥0.08 |
| Face under menu button | 0 frames on all 7 screens ✅ | 0 |
| Shot 6 lantern upper-right (x 0.55–0.95, y 0.04–0.5, clear of the menu button) | 100 % of shot 6 on all 7 screens ✅ | |
| Beyond 12 m from her | 0–1.12 s (descent) and 18.85–19.89 s (board pose); in frame 100 % ✅ | ≥95 % |
| Lens step | max 1.0 m/frame at t 0.62 (descent from the island lens); no hard cuts | |
| First frame = live lens, last frame = board pose | ✅ / ✅ | |

## Caveats
- The 4 `reuse_*` instances (decor lighthouse, palms, bushes) are island art the bundle does not ship. They are not in the mesh. By position, the lens stays at least 3.2 m away horizontally (bush at (4.19, -0.6, 16.59)).
- Her body is a 0.4 × 1.25 m box plus a head; the character glb is not loaded. Height 1.62 m and face at 1.42 m are assumed, as in v1.
- The board pose (16 m, 55°) is my choice. No coast board camera exists yet.

## Scene conflicts (for 场景设计部)
1. **The island mesh overlaps the coast steps and the start of the terrace on her walking line.** Corridor |x+2.11| < 0.45:
   - **env_island_main:** the island beach continues at y ≈ 0.0–0.07 over z 5.8–8.2. That is up to 0.67 m above the coast steps and terrace, so the steps are buried.
   - **env_island_props_merged:** one object stands up to 1.35 m above the coast ground at z 6.4–7.6, x -2.56…-1.97 (top y 0.75). Low pieces stick 0.2–0.36 m out of the terrace over z 7.6–10.0.
   - She walks through these. The island side needs trimming or the coast needs to move. A fix that moves anything means re-running `reanchor.py`.
2. Path length: door_stand_point → exit_path_06..17 measures 6.36 m, not 6.18 m. exit_point → 17 is 5.90 m. Which start point is right?
3. The island map lens at handover (v24-readable, (-12, 15.5, 48)) sits beyond the coast (the coast reaches z ≈ 33), so the coast will be in the island map view. Is that intended? This ties in with the RegionJourneyLayout overlap check.
