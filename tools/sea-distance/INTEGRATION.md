# full8 plan E — scene assets, integration note for GGbot (场景设计部 / Grok Bot, b19)

Branch `scene/b19-sail-sea-distance` (on `ggbot/full8-sea-distance` eb71dc73). SailArt.ts is unchanged.

## Files
| file | tris | bytes | notes |
|---|---|---|---|
| `bundles/transport_sail/far_meadow_impostor.glb` | 701 (≤800) | 14,612 | one mesh node `far_meadow_impostor`, Draco, COLOR_0 (aerial perspective baked: blue-green, not grey), no texture, material `M_far_impostor_vc` (white, rough 1, spec 0) |
| `bundles/transport_sail/sea_reef_cluster.glb` | 294 (≤300) | 6,432 | one mesh node `sea_reef_cluster`; 5 basalt columns with strata, a tilted slab, 2 boulders, foam collar at +5 cm; the base goes down to −1.6 m (not floating) |
| `tools/sea-distance/handoff_bounds.json` | — | — | above-water bounds for the handoff test (see §3) |
| `tools/sea-distance/test_sea_assets.cjs` | — | — | gate `sea-assets` (tri limits, COLOR_0 incl. Draco, no textures, names, reef below the water line, stand-in inside the sky dome) |
| `tools/sea-distance/src/*` | — | — | Blender build script + measuring scripts (re-runnable) |

No `.meta` files: open the project in Creator once so it imports both glbs (prefab path `far_meadow_impostor/far_meadow_impostor`, `sea_reef_cluster/sea_reef_cluster`, which is what `loadPrefab` asks for), then commit the generated metas. Creator turns USE_VERTEX_COLOR on because every primitive has COLOR_0, and `copyMat` keeps that define.

## 1. Stand-in transform (data change in SeaReveal.ts)
`SEA_STANDIN = {pos:[-5.6,-0.91,242.0], scale:.335, yawDeg:180}` (was (−11.6,−0.91,492)·0.7).
- **Why**: in the sail scene `env_sky_dome` (radius 282.6 m, opaque, follows the camera in `sync`) hid anything 480 m away, so the stand-in would never show in the engine. CPU measurements don't see the dome.
- Same bearing from the dock, 230 m out. .335 = .7 × 230/480, so the on-screen size matches the approved 0.7 @ 480 m. 运镜bot's framing (4012da49) still holds. The farthest bbox corner from any camera up to the handoff is 264.6 m, inside the 282.6 m dome (checked by `sea-assets`).
- The windmill silhouette on the mesh is 1.2× the real one, so it clears 运镜bot's ≥12 px tall / ≥10 px span gate on **every** screen.

## 2. Lowland: add the river (运镜bot)
South of world z 45, `meadow_river` sits 0.13 m above the sea, so it shows at the handoff. Please:
- `SEA_LOWLAND.meshes = /^(meadow_terrain|meadow_river_bank|meadow_river)$/`. `sinkLowland` / `lowlandHome` / `restoreLowland` already handle any mesh, and docking restores the original mesh object.
- `SEA_ALWAYS_DRAWN` (`meadow_river` stays drawn) can stay as it is. After the sink, the part south of z 45 is under the sea, and the dug channel north of 45 is the water the boat sails into.
- Check: `renders2/swap_*.png` and `river_*.png` (before = river not sunk, after = sunk).

## 3. Handoff frustum: use above-water bounds, not node AABBs
The `meadow_terrain` node AABB contains the boat, so `boxInFrustum` never goes false. Use `handoff_bounds.json`:
- `standin`: min (−23.98, −0.89, 229.68), max (5.12, 6.21, 262.15); sphere c (−9.43, 2.66, 245.92) r 22.1 (already includes the windmill ×1.2).
- `realUnion` (above-water real meadow, lowland sunk; sky dome, near clouds and far hills excluded): min (−57.7, −0.89, 45.1), max (36.3, 18.5, 141.1), sphere c (−10.7, 8.8, 93.1) r 65.1. **Too coarse for the test**: it stays in frame until 18.6 s.
- **Use** `tiles` (terrain + river bank, above-water verts only, 12 m tiles) plus the `real` per-mesh boxes for every other mesh (73 boxes). With 运镜bot's `sailVoyageCamera` (4012da49), the handoff fires at **17.400 s on all 7 screens** (deferredS 0).
- `meadow_far_hills` (r 262 m) must stay out of the test and hidden until the swap. Its box contains every camera.

## 4. Reefs
`sea_reef_cluster` origin = water line; place at `SAIL_SEA_Y` as now. The foam collar is at +0.05 m above the flat sea plane (no z-fight in renders). The `seaReefSlots` positions are 46–64 m off the lane. With the final lens, slot 0 sits about 13° off the frame edge in the mid shot. Move a slot if 运镜bot wants it in frame.

## 5. Package
transport_sail source 999331 B ≤ 1,048,576 (49245 B left). Delta +21,044 B (the other 7 glbs in asset-budget unchanged; 6,856 → 7,851 tris counting both). All asset sources ≈27.81 MB.
