# Slim room recheck — int/v2-slim edc65d5 (read-only, nothing pushed)
Asset: creator-build-project/assets/bundles/static_seat_preview/room/room_no_original_chair.glb
- original: f77dce9 (= 5c54f7a blob) -> input/room_orig_7aff1c0parent.glb, sha256 8ae5efeb…2e42
- slim:     edc65d51a23d694035eb9988655861e94c746311 -> input/room_slim_edc65d5.glb, sha256 57a8b85e…be98
Method: identical to ../slim-room-recheck-7aff1c0 (scripts/recheck.py, Blender 4.5, on ../m1v2-truesize/scene/cine_m1_anim.blend). Units m, Z-up world.
(The run-time filename in out/run.log was room_slim_7aff1c0.glb; the file was renamed afterwards, same bytes.)

## Result: PASS vs 1 cm (0 vertices >10 mm; was 157 on 7aff1c0)
Max original->slim deviation by region (within 1 m of exit/return paths, z<3.2 m):
- doorway lighthouse wall + lintel (env_lighthouse_ext, walls/door frame/floor): 0.00 mm (was 100.5)
- door leaf (env_lighthouse_door): 0.00 mm (was 10.97)
- interior shell walls: 6.89 mm at (1.391,0.738,0.030) (back wall: 0; was 12.8)
- interior shell floor trim: 3.88 mm at (-1.168,0.520,0.070) (was 10.2)
- props_merged: walls/other 5.49 mm at (-1.091,0.576,2.614); floor-level 0.00 (was 40 / 17.7)
- slim->orig: 0.00 mm everywhere
Paths: walkable floor dz 0.0 mm, min wall clearance 5.1 mm both, no narrowing.
Per-frame (cine_open_stand f0-90, cine_open_turn f0-45, cine_open_safe_end f0, cine_home_safe_end f0; 139 frames): floor dz 0.0 mm; env contact identical to original (max 0.79 mm @ stand f70, pre-existing, same false alarm as below); no new flags.

## Prop-behind-chair flag (7aff1c0 stand f64/65/69/71, 8-12 mm): FALSE ALARM
- The flagged points are LOOSE vertices of B_ANATOMICAL_VERTICAL_SLENDER_R5 (no faces, weights hips/skirt.left; e.g. v5970, 4066, 6098, 6099). They are invisible, and the body mesh has 12,146 loose verts in total. (scripts/nearest_raw_verts.py, scripts/loose_vert_check.py)
- Visible geometry only (faces of body/dress/apron/hair) vs the side-table prop: f64 104 mm, f65 115 mm, f69 111 mm, f70 100 mm, f71 107 mm. Minimum over all of f0-90 is 5.9 mm at f50, outside. -> out/prop_visible_distance_cine_open_stand.txt
- Renders (Workbench, slim room, prop in orange, red dot = flagged point): renders/stand_f{064,065,069,071}_v{0,1,2}.png. v2 (side) and v1 (top) show a clear gap. v0 is blocked by her body.
- Model-side note for Grok Bot: the 12,146 loose verts on the body mesh should be removed on export. They pollute clipping checks and add size.

## Not run
- Camera-through-wall: no baked cine_camera and no walk/door/return-walk clips yet.
- Exterior path floor: there is no ground in this glb.
- Triangle-level garment/chair suite: it uses env_interior_assembled.blend, and the chair is unchanged.
- No video.
