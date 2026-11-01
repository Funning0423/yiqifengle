# getout v2: door exit (trial), hipsway65 clips, b14 plan A real path

**Trial result:** all the hard checks pass. There is **0** penetration (body/hands/cloth × basket and door), and the hand touches the door with a 1.0 mm gap.

**Sequence:** idle 0.5 s → door_reach (the door is pushed open) → walk_start through the opening (rate 1.15) → walk_loop at 0.8 m/s along the real b14 path (8.6 m straight, then the 113° corner at the approach point) → walk_stop_bodyL at the shore → idle. The run is 16.7 s / 501 frames.

## Per-frame checks (`qa_v2.json`)
| segment | frames | planted-sole slide max / p95 / median (mm per frame) | notes |
|---|---|---|---|
| idle | 0–14 | 1.4 / 1.0 / 0.2 | |
| crossfade idle→door_reach | 15–20 | 1.8 / 1.7 / 0.8 | |
| door_reach | 21–68 | 2.7 / 1.9 / 0.5 | **hand–door gap 1.0 mm at f25–26 (clip f10–11)** |
| crossfade door_reach→walk_start | 69–74 | 10.1 (f74, one frame) / 6.3 / 1.6 | |
| walk_start | 75–114 | 34.8 (f84 touch-down, one frame) / 7.1 / 1.0 | the clip's own (feet are locked by the forward_m curve; rate scales clock and curve together) |
| crossfade walk_start→walk_loop | 115–120 | 1.5 / 1.4 / 0.6 | |
| walk_loop, straight | | 49.0 (touch-down spikes) / 6.8 / 0.9 | the clip's own at 0.8 |
| walk_loop, corner, r 0.6 | 372–424 | 49.5 / 18.8 / 7.9 | **needs the corner foot lock (see INTEGRATE)** |
| walk_stop_bodyL | 448–491 | 14.8 / 8.8 / 4.7 | |
| end hold | 492–500 | 0.6 | |

- **Knees:** never fully straight (min 9.7°). The fastest change is 14.7°/frame (f74, crossfade into walk_start) and 14.1°/frame (f107, walk_start swing). These look natural in the mp4.
- **Basket and door:** with the opening cut and the floor lowered, there are 0 overlapping triangles for body, dress and apron in all frames. There are 0 vertices inside the leaf. The minimum clearance to the leaf/frame is 45 mm body and 68 mm cloth (f95–97, passing the hinge side).
- **Foot slide vs the original clips:**
  - On every straight segment the slide is the clip's own (same per-frame values as the clip alone).
  - The 3 crossfades add at most 10 mm on one frame.
  - The corner is new slide (p95 18.8 mm/frame). It needs the support-foot lock in the driver; it should not be fixed in the clip.
- **Visual check** (contact sheets viewed):
  - The push reads (door 0→3→14→44→81→100° over f25–f48).
  - She walks through with the leaf beside her, with no turn at the door.
  - The game-like camera (my 3/4 follow from behind/high; not the real lens) passes through the basket uprights on f150–225. That is a camera-mock artefact.

## Files
| File | Contents |
|---|---|
| `getout_v2_side.mp4` | side view, basket as wireframe |
| `getout_v2_game.mp4` | game-like view |
| `sheet_v2_side.png` | contact sheet, every 25 frames |
| `sheet_v2_game.png` | game-like contact sheet, every 25 frames |
| `sheet_v2_door_side.png` | door push close-up |
| `qa_v2.json` | per-frame numbers (also `qa_v2_r1.0.json`) |
| `qa_b14*.json` | per-frame numbers, the b14 1.2 m/s runs |
| `v2.py` | the pipeline (`MODE=v2\|b14`, `WALK`, `CORNER`, `RENDER`) |
| `summ.py` | the summary script |
| `v2.blend` | baked action `balloon_getout_v2`, the `basket_door` mock and the cut basket |

## Tested / untested
**Tested:** headless Blender 4.5.3 on the hipsway65 GLB, the b14 anim_meta, and the real b14 numbers for mooring, shore, approach and corner.

**Not tested:**
- In Cocos / CharacterMotion: planWalk, the actual crossfade implementation, and the support-foot lock.
- The real basket yaw and parent (assumed unrotated).
- Cloth simulation: the skirt is clip-driven only.
- The real game lens.
- 场景特效bot's real door mesh: the mock is a box per DOOR_SPEC.
