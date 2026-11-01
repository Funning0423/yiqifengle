# getout v3: real door (场景特效bot transport_balloon.glb 24008c3c, fx/r5-b15-skycity-dc @ 893ac038) + b15 mooring

Same sequence and clips as v2 (hipsway65): idle 0.5 s → door_reach (door trigger +0.333 s) → walk_start at door_reach 1.8 s (rate 1.15) → walk_loop 0.8 m/s → corner → walk_stop_bodyL → idle.
Basket and leaf are the real meshes (no cut, no floor removal, real `basket_door` node animated). 30 fps, every frame (t=n/30), crossfades 0.2 s included. Run 473 frames / 15.77 s.

## 1. Door GLB vs DOOR_SPEC
| check | result |
|---|---|
| Nodes | PASS. `transport_balloon` → `basket_door` (EMPTY, at (0.40, 0, 0.84), identity rot/scale) → `basket_door_leaf` (MESH, identity). |
| Pivot on hinge | PASS. Node origin = hinge axis (X 0.40, Z 0.84). |
| Axis / sign | PASS. +100° about local +Y: free edge goes to (X 0.54, Z 1.63) → outward (+Z). At 100°, leaf spans X 0.36…0.65, Z 0.84…1.64. |
| Leaf size | PASS. X −0.40…+0.40, Y 0.01…1.15, faces at Z 0.80 / 0.84. |
| Opening cut | PASS. 0 basket faces inside X ±0.40, Y 0…1.15, Z > 0.6. |
| Floor | PASS. The inner floor faces are at Y 0. Note: `stand_point` and `basket_floor` nodes are still at Y 0.10. That's fine with b14's `stand_point − 0.1` seat offset, but `basket_floor` is stale. |
| Push plate | MINOR. It's a flush region on the inner face at X −0.14…−0.02, **Y 1.07…1.15** (centre (−0.08, **1.11**, 0.80), 0.12 × 0.08), not 1.13 / 0.10 high. Her contact is at 1.13 (1.07–1.17), so it's on the plate. Acceptable; no change needed. |
| Outer details | Hinge straps 6 mm proud on the outer face. The charm on the leaf's outer face protrudes to Z 1.013, at X ±0.10, Y 0.56–1.03. Open, it faces away from her path. 0 contact with her. |
| Door × basket sweep 0–100° (0.5° steps) | **FAIL (sub-mm).** The latch-side rim padding/jamb cap at X −0.40 runs out to Z 0.81, 10 mm past the leaf's inner face (0.80). From 0° to about 0.72° the leaf's inner free corner digs into that lip, up to 0.44 mm (x = −0.40 + 0.8(1−cosθ) − 0.04 sinθ). In the animation this is frame 25 (θ 0.15°, about 0.1 mm). From 1° on: 0 overlaps; minimum clearance 6.9 mm @10°, 39 mm @90–100°. Closed (0°), the hinge-side cap and the frame post only touch the leaf's end face, coplanar, with zero depth. |

## 2. getout v3 numbers (`qa_v3.json`; r 1.0, walk_stop_bodyL)
- Path, lake-local: P0 (9.1105, 0.572, 25.6724), then approach (1.2, 26.5), then shore (1.2, 24.5).
  - Leg 1 is 7.954 m straight out of the door; leg 2 is 2.000 m. The corner turns **95.97°**. Total length 9.531 m.
- Facing at touchdown: world yaw **95.97°** (heading P0→approach). The door normal is 96.19°, so she walks out 0.22° off the door axis. Negligible: minimum side clearance stays 45.7 mm.
- Corner radius: **1.0 m**, the largest that fits (leg 2 / 2). r 0.6 is worse at the median.
- Stop: walk_stop_bodyL needs stride warp **0.970** (3% short). Automatic selection would pick bodyR at 1.023 (`qa_v3_autoR.json`). Both are clean.

### Per segment, mm/frame on the planted sole (max / p95 / median)
| segment | frames | v3 | v2 |
|---|---|---|---|
| idle | 0–14 | 1.4 / 1.0 / 0.2 | same |
| crossfade idle→door_reach | 15–20 | 1.8 / 1.7 / 0.8 | same |
| door_reach | 21–68 | 2.7 / 1.9 / 0.5 | same |
| crossfade door_reach→walk_start | 69–74 | 10.1 (f74) / 6.3 / 1.6 | same |
| walk_start | 75–114 | 34.8 (f84 touch-down) / 7.1 / 1.0 | same |
| crossfade walk_start→walk_loop | 115–120 | 2.6 / 2.2 / 1.0 | 1.5 / 1.4 / 0.6 |
| walk_loop, straight | 121–332 | 40.5 (touch-down spikes) / 5.4 / 1.2 | 49.0 / 6.8 / 0.9 |
| walk_loop, corner | 333–410 | 42.9 / **13.2** / 4.2 | r 0.6: 49.5 / 18.8 / 7.9; r 1.0: 43.8 / 17.5 / 5.2 |
| walk_stop_bodyL | 420–463 | 14.8 / 8.8 / 4.7 | 14.8 / 8.8 / 4.7 |
| end hold | 464–472 | 0.5 | 0.6 |

For comparison on the new path, r 0.6 gives a corner of 18.0 / 14.9 / 6.6 (`qa_v3_r0.6.json`). The corner still needs the support-foot lock in the driver.

### Other checks
- **Clipping**, every frame including the crossfades:
  - body / dress / apron × real basket (walls, rim, jambs, frame posts): **0** triangle overlaps;
  - × real leaf mesh (BVH): **0**;
  - vertices inside the leaf box: **0**.
- **Floor:** checked as ground via sole height. The minimum sole is −1.9 mm, in the crossfade into walk_start. That comes from the clips themselves, the same as v2 and the same as on grass.
- **Clearances:**
  - body to leaf/frame: minimum 45.7 mm (walk_start, passing the hinge side; v2 45);
  - cloth: minimum 36.4 mm in door_reach, 68.7 mm while passing.
- **Hand–door contact:** gap 1.0 mm at f25–26 (door_reach clip f10–11), the same as v2.
  - Door angle: 0.15° (f25), 2.74° (f26), then code ease-out to 14 / 44 / 65 / 81 / 91 / 96 / 99 / 100° at f27 / 30 / 33 / … / 48.
- **Knees:** never straight (minimum 9.7°). Fastest change 14.7°/frame at f74 (crossfade into walk_start) and 14.1°/frame at f107. Same as v2.
- **Visual:** contact sheets viewed (`sheet_v3_side.png`, `sheet_v3_door_side.png`, `sheet_v3_game.png`).
  - The push reads, and she walks through beside the open leaf.
  - The game view is a mock 3/4 follow camera, not the real lens. It passes through the basket uprights for about 1 s; that is the camera mock.

## Yaw 96.19° vs the shore
The door still faces the exit direction. The code sets `doorYawDeg = heading(mooring → approach)`, so the door always points at the approach point. It no longer points at the shore point itself, the same as in v2: she walks 7.95 m out of the door, then turns 96° to the shore.

Only the old 112.86° value is wrong now. Consequences:
1. INTEGRATE uses the 96.19° value, from code.
2. The corner is 96° instead of 113°, which gives less corner slide.
3. The mooring is at Y 0.572 while the walk points are at bank Y 0.58, so her feet step up 8 mm over the first metres if the code puts P0 at 0.572. Use the bank Y for the whole walk, or let the ground snap handle it. Not rendered.

## Files
`v3.py` (pipeline), `summ.py`, `corner.py`, `door_nodes.py`, `door_geom_sweep.py`, `door_closed_contacts.py`, `qa_v3*.json`, `sheet_v3_*.png`, `getout_v3_side.mp4`, `getout_v3_game.mp4`, `v3.blend` (preview dir only; action `balloon_getout_v3`).

## Tested / untested
**Tested:** headless Blender 4.5.3 with:
- the hipsway65 GLB;
- the b14 anim_meta;
- the real door GLB (24008c3c);
- the b15 mooring and route.

**Not tested:**
- Cocos (planWalk, crossfade code, support-foot lock, the door tween);
- the real game lens;
- the ribbon/bow (not in hipsway65);
- cloth simulation;
- the 8 mm ground step;
- the parent rotation of the rig (assumed unrotated, as in v2).

---
# v3b recheck (2026-10-21 14:27 EDT): fixed door b69faa60 (transport_balloon.glb 5b2ae95e) + b15b ground heights
**Result: PASS.** All door checks pass. The run still has 0 clipping, and the 8 mm rise doesn't matter.

## Door b69faa60 (`door_b_check.py`)
- sha256 5b2ae95ecc969fca238083b3e08108ed3d998b601e6cf9e4c5ef8c3185749acb: verified, read from the commit with git show.
- Diff vs 24008c3c:
  - Same object names, types, parents, node transforms (`basket_door` at (0.40, 0, 0.84), identity), face counts and vertex counts.
  - `basket_door_leaf`, envelope and flame: 0 vertices changed.
  - `balloon_basket`: only **9 vertices** changed, all at X −0.40 (latch side), Y 1.01–1.08, Z 0.7968/0.8004/0.805/0.81 → **0.795**. The hinge side is unchanged.
  - Opening seal: no new gaps (same topology).
- Sweep, every 0.1° from 0 to 100° plus all 27 door angles used in the animation (1026 angles):
  - 0 basket vertices inside the leaf;
  - 0 triangle overlaps except at exactly 0° (closed): 16 coplanar edge contacts with zero depth, where the leaf's end faces sit flush against the jambs.
  - Clearance grows from 0.07 mm at 0.1° to 0.49 at 0.7°, 0.70 at 1°, 6.95 at 10° and 39.0 at 100°.
  - The frames used: f25 at 0.15° → 0.10 mm, f26 at 2.745° → 1.92 mm.

## Ground (LakesideBalloon b15b)
- The mooring, P0/exit and approach are at Y 0.572, and L1 (the shore) at 0.58.
- Modelled as a linear +8 mm over the last 2.0 m of path (s 7.53 → 9.53 m; f352 → end). The basket and floor are at the mooring height.

## QA (`qa_v3b.json`; `qa_v3b_flat.json` is the same run with no rise)
- Clipping:
  - body / dress / apron × basket: 0;
  - × leaf: 0;
  - vertices inside the leaf: 0, on every frame and crossfade.
- Hand–door gap 1.0 mm at f25–26. Same as v3.
- Per-segment slide is **identical to v3** on every segment, including the corner (42.9 / 13.2 / 4.2) and walk_stop_bodyL (14.8 / 8.8 / 4.7).
- Last 2 m (f364–472), horizontal slide: 35.9 / 11.0 / 4.2 (max / p95 / median), the same with and without the rise.
- Sole vs the **local** ground under each foot (`slope_check.py`, slope-aware):
  - minimum −2.06 mm (f363 walk_loop touch-down) and −2.00 mm (f447 walk_stop);
  - flat-ground clip own minimum −1.6/−1.7 mm;
  - so the rise adds at most about 0.4 mm of sink.
  - Vertical drift of a planted foot from the rising root: 0.8 m/s × 0.4 % = 0.11 mm/frame.
- **The 8 mm doesn't matter.** It's below the clips' own ±2 mm sole noise and invisible at 0.23°. No foot IK is needed for it; the ground snap or the linear lift is enough.
- Files: `getout_v3b_side.mp4`, `getout_v3b_game.mp4`, `sheet_v3b_*.png`, `v3b.py` (env `BGLB`, `RISE`).

Untested: the same as v3 (Cocos, the real lens, the ribbon, cloth simulation). The terrain is modelled as a linear slope, not sampled from the real terrain mesh (0.569–0.581 along the walk per 场景特效bot).
