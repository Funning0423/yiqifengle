# Slim room recheck — int/v2-slim 7aff1c0 (read-only, nothing pushed)
Asset: creator-build-project/assets/bundles/static_seat_preview/room/room_no_original_chair.glb
- original = 7aff1c0^ (f77dce9, blob identical to 5c54f7a), input/room_orig_7aff1c0parent.glb
- slim     = 7aff1c0, input/room_slim_7aff1c0.glb
Script: scripts/recheck.py (Blender 4.5, run on ../m1v2-truesize/scene/cine_m1_anim.blend). Units: metres, Blender Z-up world (= exit_path_17 frame).

## Scope / what was run
1. Surface deviation, both directions, of the meshes env_interior_shell, env_lighthouse_door, env_lighthouse_ext, env_interior_props_merged and env_interior_glass. Only vertices within 1 m (XY) of the exit/return paths and anchors with z<3.2 m are counted. Classes: floor, wall, door_frame. -> out/surface_deviation.json
2. Exit and return path samples every 5 cm: floor height, plus wall clearance at z 0.1/0.9/1.6 m. -> out/path_samples.json
3. Per-frame character vs room for every baked clip: cine_open_stand f0-90, cine_open_turn f0-45, cine_open_safe_end f0, cine_home_safe_end f0 (139 frames). Checks foot vs floor, and body/dress/apron/hair vs room surfaces. -> out/per_frame.json

## Results
- Slim->orig deviation is 0.0 mm everywhere. Decimation only removed detail; no slim surface lies outside the original.
- Orig->slim deviation (detail lost, flattened) >10 mm:
  - lighthouse_ext above the door opening (arch/lintel, y≈0.004, z 2.74-3.06, x -0.76..0.76): up to 100.5 mm at (-0.680,0.004,2.865), 34 verts. This is 2.7-3.1 m up, above her height (1.73 m with hat).
  - lighthouse_ext near the door base: 14.0 mm at (0.819,0.130,-0.15).
  - env_lighthouse_door (door leaf/handle region): 22 verts, max 10.97 mm at (-0.541,0.046,1.199) (handle).
  - env_interior_shell walls: 16 verts, max 12.8 mm at (-0.625,5.005,1.890), on the back wall behind the chair.
  - env_interior_shell floor: 1 vert, 10.2 mm at (-0.781,4.974,0.070), a floor-edge trim, not the walk surface.
  - props_merged: wall-like 77 verts up to 40 mm (e.g. (1.133,0.527,0.980)); floor-level 6 verts up to 17.7 mm at (0.220,4.800,0.050) (rug/trim).
  - Full list with positions: out/surface_deviation.json -> over_10mm.o2s (157 entries).
- Walk floor along both paths: Δz = 0.0 mm at every sample inside the room. Minimum wall clearance is identical (5.1 mm). Δclearance is only in open-room directions (largest +147 mm at return (-0.040,3.397), where a prop edge moved farther away; it is not a narrowing).
- Per-frame: floor-under-foot Δz = 0.0 mm on all 139 frames. Foot results are identical orig vs slim.
- Per-frame NEW flag (inside-test sign flip vs env_interior_props_merged behind the chair, around (0.15,4.57,0.65)):
  - cine_open_stand f64: 12.0 mm at (0.153,4.574,0.646)
  - f65: 8.6 mm at (0.180,4.565,0.648)
  - f69: 8.1 mm at (0.143,4.586,0.649)
  - f71: 8.2 mm at (0.165,4.572,0.646)
  - The original already had 0.79 mm at f70 at the same spot.
  - Unsigned distance to that prop is the same in orig and slim (12.0/8.1-8.6 mm). The change is the flattened prop surface flipping its normal side, so this is a marginal/likely false new contact. It needs a visual close-up before it can be called clear.

## NOT run / limits
- Camera-through-wall: no cine_camera is baked in the current anim blend, and there are no walk/door-push or return-walk clips yet (only stand, turn and safe_end poses). So there is no per-frame camera check. The baked door lintel deviation (up to 100 mm at z≈2.9) is what a future exit/return camera passing the doorway must be rechecked against.
- Floor samples outside the room (205/402 path samples, exterior part of the paths) have no ground in this glb (the island ground lives elsewhere), so they were not evaluated.
- Foot-penetration absolute values (max 224 mm, the same in orig and slim) are a ray-method artefact while seated (lowest verts under the seat/props). Only the orig-vs-slim delta (0) is meaningful.
- No renders/video were made. The new suite uses the glb room; the original clipping suite uses env_interior_assembled.blend (a different, lower-poly shell), so the triangle-level garment/chair suite was not re-run (the chair is not in this glb and is unchanged).
