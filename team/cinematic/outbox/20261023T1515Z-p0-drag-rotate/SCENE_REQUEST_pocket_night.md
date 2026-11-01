# Scene request: skycity "Pock·夜" walk, her chest hidden for 1.45 s (target ≤ 0.8 s)
From 运镜bot (camera), p0drag13, 2026-10-25. Camera side is done: walk plan ≤ 120°/s, ≤ 300°/s², no lens in a box. The camera cannot clear this case without breaking the yaw cap or putting the lens through geometry. We have not touched scene geometry, proxies or the walkable area.

## Where
- Region: skycity. Mesh `env_sky_static_palette` (merged static mesh in `env_skycity.glb`). The blocker is a low parapet or planter wall inside that mesh.
- Coordinates: **local** = env_skycity model-local = walk-local. **world** = T + MW·local, with T = (58.662, 18.63, 143.515) and MW rows (−0.482, 0, 0.880), (−0.001, 1, −0.053), (−0.875, 0, −0.447).
- Parapet mesh extent (vertices of `env_sky_static_palette` in the area):
  - local x 9.09–11.44, y 0.32–1.45, z 7.54–10.01, so about 2.35 × 1.13 × 2.47 m, top at 1.45 m;
  - world corners (60.92, 18.54, 132.19) to (61.96, 19.54, 129.03), centre about (61.44, 19.04, 130.60).
  - A few `env_sky_static_foliage_cards` vertices sit on top at y 0.84–0.88; they do not affect this.
- Her chest is at 1.05 m, below the 1.33–1.45 m wall top, so any low lens on the far side loses her chest.
- Lens-occluder proxy columns that block her chest (`SkycityLensOccluders.ts`), with the number of blocked frames for skd_pock:

| Proxy column (local min→max) | Set | Centre (world) | Blocked frames |
|---|---|---|---|
| [11,0,8 → 12,1.33,9] | scene (#2469) | 60.60, 18.83, 129.65 | 36 |
| [9.24,0,7.54 → 10,1.35,8] | scene (#2403) | 60.86, 18.88, 131.62 | 34 |
| [10,0,7.54 → 11,1.35,8] | scene (#2433) | 60.44, 18.88, 130.85 | 34 |
| [9,0,8 → 10,1.5,9] | cine (#848) | 61.56, 18.92, 131.40 | 32 |
| [9.09,0,8 → 10,1.45,9] | scene (#2401) | 61.54, 18.89, 131.36 | 30 |
| [11,0,7.78 → 12,1.29,8] | scene (#2468) | 60.06, 18.85, 129.93 | 28–29 |
| [11,0,9 → 12,1.33,10] | scene (#2470) | 61.48, 18.78, 129.21 | 27 (n, xd) |
| [10,0.5,8 → 11,1.5,9] | cine (#874) | 61.08, 19.17, 130.53 | 26 |

## When (r7 route of the Mac p0drag11 night pocket tap, 1.2 m/s)
- Route: S3 (6.2, −0.01, 8.2) → corner (10.6, −0.1, 7.0) → stop (11.8, −0.05, 8.2) local. In world: (62.89, 18.18, 134.42) → (59.71, 18.15, 131.11) → (60.19, 18.13, 129.52). The walk takes 5.22 s.
- Chest hidden from t = 3.75 s to 5.18 s after the tap, which is the whole final leg from her at (10.54, −0.10, 7.02) to (11.77, −0.05, 8.17) local. Measured 1.43 s (skd), 1.45 s (skn), 1.45 s (skxd); face 0.23 s.
- During that time the lens swings round the wall from local (5.23, 2.37, 9.20) to (13.68, 2.72, 15.07), world (64.24, 20.51, 134.83) to (65.33, 20.54, 124.81). That is the box-free, single-direction swing at the cap.
- Her stop point (11.8, 8.2) is inside proxy column #2469 (x 11–12), but the mesh ends at x 11.44. She stands about 0.35 m past the real wall end, yet the 1 m column still counts that spot as wall.

## Requested change (any ONE is enough; replay results are from test_p0drag12 W2 with only that change)
1. **Tighten the proxies (smallest change, recommended).** Clip scene columns #2468, #2469 and #2470 (local x 11–12, z 7.78–10) to the mesh edge, max x = 11.44. The generator could do this for every column by clipping to the triangle extent, not the 1 m cell. Replay: chest **0.66 s** (all three runs), face 0.66 s, 0 lens-in-box frames. No visual change.
2. **Lower the parapet.** Bring the wall top in local x 9.09–11.44, z 7.54–10.01 from 1.45 m down to ≤ 0.90 m (about 0.55 m lower) and regenerate the proxies. Replay: chest **0.52–0.53 s**. A 1.10 m top is only borderline (0.81–0.83 s).
3. **Cut the walkable pocket.** Remove the walkable cells in local x 10.9–12.2, z 7.3–8.8 (behind the wall end) so the night pocket tap stops at the corner (10.6, 7.0). Replay: chest **0.35–0.37 s**.

Please send back the commit. We will re-run test_p0drag12 W2 and put the Pock·夜 gate back to green at ≤ 0.5 s, or ≤ 0.8 s if Funning approves.
