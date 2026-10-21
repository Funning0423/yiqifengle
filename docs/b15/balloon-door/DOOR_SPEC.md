# Balloon basket door: spec for 场景特效bot (derived from the real clips + b14 plan A)
Basis:
- base clips: hipsway65 (`planA-verify/hipsway/chr_b_r5g2_planA_hipsway65_cand1.glb`): door_reach, walk_start, walk_loop, walk_stop.
- metadata: `anim_meta.json` from b14 (`gbt/r5-integrated-b14` @ e567125a).
- basket: `transport_balloon.glb` (sha ba5a7578…).
- placement: `LakesideBalloon.ts` / `RegionJourneyAdapter.ts` from b14.

The design was checked frame by frame in `../getout_v2/`.

## Coordinates
- **Basket-local, Cocos/glTF axes:** origin is the basket GLB root, which is the touchdown point and her feet at landing. +Y is up. **+Z is the door's outward normal (toward the shore)**. +X is **her LEFT** when she faces the door from inside.
  - Blender import of the same file: x = X, y = −Z, z = Y, so the door is on the Blender −Y wall.
- **Basket yaw in b14 plan A:** `mountVehicle` never rotates the basket, so its yaw is 0 under the rig node.
  - The shore direction at the mooring is derived from b14: `h = heading(mooringLocal [9.5,·,23] → shore walkLocal[-1] [1.2,·,24.5] + (0,0,2))`, with the lake rotated by yaw 180. In world space it points to **(+0.921, 0, −0.389)**.
  - This direction does not line up with any basket wall. **Code must set `vehicle.setRotationFromEuler(0, 112.86, 0)`** so that the door wall (+Z) faces the shore.
  - The envelope is round, so the yaw is invisible in flight. It can also be set only at touchdown, which happens off-screen in plan A.
  - Assumption: the parent of `rig` is unrotated (`RegionJourney-lakeside` is added to `parent`). Please verify.

## Door (all values basket-local, metres)
| item | value | vs 场景特效bot's proposal |
|---|---|---|
| Clear opening width | **0.80** (X −0.40 … +0.40) | **Correct 0.55 → 0.80.** Her walking dress envelope is 0.72 m wide including sway (walk_loop/walk_start DRESS x −0.395…+0.324 about her hips). At 0.55 both side posts would cut the skirt. At 0.80 the measured minimum gap is 45 mm body / 68 mm cloth. |
| Opening height | full height from the floor (no sill) up through the rim and its padding: frame cut 0 … 1.15 | No lintel is needed because the basket is open-top. |
| Leaf | 0.80 wide × **1.14 high** (bottom 0.01, top 1.15) × **0.04 thick** | **Correct ~0.98 → 1.14.** Her push contact is at **y 1.07–1.17** (fingers/palm, mean 1.13; meta `handle_local_m` y 1.13). A 0.98 leaf is below her hand, so she would push air. The rim padding reaches 1.12, so the leaf top at 1.15 is flush with it. |
| Closed leaf position | inner face at Z **0.80**, outer face at 0.84; vertical | The wall slants from 0.70 at the floor to 0.84 mid-height. Cut the wall inside the opening. |
| Hinge | vertical axis at **(X +0.40, Z 0.84)**, on the outer face. This is **her LEFT edge as seen from inside** | **Confirmed** (the left vertical edge). |
| Swing | outward (toward the shore), **+100° about local +Y**. At 100° the free edge is at (X 0.54, Z 1.63), away from her path | **Confirmed ~100°.** Sign check: Cocos rotY(+90°) takes the leaf direction (−1,0,0) to (0,0,+1), i.e. outward. |
| Pivot node | **`basket_door`**: a separate child of the basket root with its origin on the hinge axis, at (0.40, 0, 0.84). It rotates only about its local Y. The leaf mesh is a child, spanning local X −0.80…0, Z 0…0.04 (the inner face is at local Z 0… see note), Y 0.01…1.15 | **Confirmed** (origin on the hinge, local Y). Name: `basket_door`; the leaf mesh can be `basket_door_leaf`. |
| Push plate / handle | inner face, centred **(X −0.08, Y 1.13, Z 0.80)**, about 0.12 × 0.10 | This is where her **right hand (.L bone; her right = .L)** lands. |
| Floor | **Lower the inner floor 0.10 → 0** (flush with the ground, no sill) | Resolves the floor-height problem. Recommended, and it is your preference. b14 already seats her at `stand_point − 0.1`, i.e. feet at the basket origin z 0. With the floor at 0.10 her feet would be 10 cm *inside* the floor mesh. Moving the floor down is not visible from the ride lens (the walls hide it, and the exit is off-screen in plan A). No step-down clip is needed. |

Note on leaf-local axes: with the hinge at the outer face, the leaf occupies node-local Z −0.04…0 if the node's +Z is outward. Equivalently, it occupies Blender-mock y 0…0.04 with the inner face toward the basket. What matters is that the inner face is at basket Z 0.80 when closed.

## Her placement and the push (from door_reach)
- **Root** in the basket: **(X +0.03, Y 0, Z 0.395)**, facing +Z.
  - This puts the door_reach fingertip front (forward-most 0.405–0.415 m from her root) exactly on the leaf inner face at 0.80.
  - X +0.03 centres the 0.72 m walking envelope in the 0.80 opening.
- **Pushing hand:** her **RIGHT** hand (rig bone **hand.L**; mirrored naming). It reaches from (−0.34, 0.79) at rest to the leaf.
  - Contact height **1.13** (band 1.07–1.17).
  - Lateral position −0.11 from her root, i.e. basket X −0.08, which is 0.48 m from the hinge, near the free edge (good leverage).
  - Her left hand stays idle-like.
- **Contact frame:** door_reach clip **f10 (0.333 s)**, when the fingers reach the leaf. The forward-most point is f12 (0.415 m).
  - The anim_meta `handle_contact_s` 0.633 refers to the palm-centre IK hold. With a flat leaf, the fingers touch first, at 0.333 s.

## Opening: hand first, then code
1. **Hand-driven for 2 frames:** clip f10 → f11, 0° → 2.75°. The leaf follows the fingertips with a 1 mm gap. Measured hand–door gap = 1.0 mm, with no penetration.
2. Then **code**: `θ(t) = 2.75° + 97.25°·(1 − (1 − u)³)`, with `u = (t − 0.367 s)/0.8 s` in door_reach clip time. It reaches **100° at clip 1.17 s** and then holds.
   - The hand withdraws as the leaf leaves, so the leaf never comes back into the hand.
   - Trigger: the door_reach clip time 0.333 s (`t_trigger = door_reach start + 0.333`). You can treat it as "start opening at 0.333 s with a 1-frame-slow ease-in"; the first 2.75° is too small to read.
3. **She starts stepping when the door is at 100°** (fully open). walk_start begins at door_reach 1.8 s (0.63 s after the door is fully open), and the first foot lifts about 0.2 s later.
   - She could start earlier, once θ ≥ 80° (clip ≥ 0.75 s), but door_reach's arm return would be cut, so I kept the clip's natural end.

## Checked (getout_v2, 30 fps, every frame)
- Body/dress/apron × door leaf: **0** vertices inside.
- Body/dress/apron × basket (with the opening cut and the floor removed): **0** overlapping triangles.
- Minimum gap while passing the open leaf/frame: 45 mm body, 68 mm cloth.
- Hand at the push: 1.0 mm.

Answers to 场景特效bot's questions:
- **Which hand:** her right (.L).
- **Contact height:** 1.13 (1.07–1.17).
- **Door angle when she starts stepping:** 100°.
- **Node:** `basket_door`, origin on the hinge, rotation +Y = outward.
- **Coordinates:** basket-local as above. +Z is the door/shore wall; the basket yaw must be 112.86° in b14 plan A.
