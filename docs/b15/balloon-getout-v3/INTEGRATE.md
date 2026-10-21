# getout v3: code-side values (b15, fx/r5-b15-skycity-dc mooring, real door 5b2ae95e @ b69faa60; was 24008c3c)
All values at 30 fps, CROSSFADE_S 0.2. Clips are hipsway65. This supersedes getout_v2/INTEGRATE.md. The yaw is now 96.19°, not 112.86°.

## Placement
- **Basket:**
  - Keep 场景特效bot's `vehicle.setRotationFromEuler(0, moored.doorYawDeg, 0)`. That is `heading(mooring→approach)`, **96.19°** at mooringLocal [9.5, 0.572, 25.6].
  - Seat compensation while riding: `girl` yaw under `stand_point` = `girlYawDeg − doorYawDeg`. Needed only if the yaw is applied before she disembarks; b15 applies it after landing, off-lens.
- **Start root P0**, basket-local (X +0.03, Y 0, Z +0.395):
  - world = `mooring + rotY(doorYawDeg)·(0.03, 0, 0.395)`;
  - lake-local (9.1105, ·, 25.6724).
  - This **replaces** `exit = mooring + 1.6·h`. Today's `cancelAndReset` puts her 1.6 m outside, so the door would never be used.
- **Facing:** `cancelAndReset({kind:'standing', controllerRoot: P0, yawRad: atan2(next−P0)})`, where `next` is the first rounded-walk point. That is world yaw **95.97°**, 0.22° off the door normal, which is fine.
- **Height (b15b, verified on v3b):** P0, the exit and the approach are at Y 0.572 (the mooring), and only L1 is at 0.58. Interpolate root Y linearly with path distance over the last 2 m (or let the ground snap do it). The measured effect is ≤ 0.4 mm of extra sole sink and no extra slide. Basket door GLB: 5b2ae95e (b69faa60). The floor mesh is at basket Y 0 and `stand_point` is still at 0.10, so keep the −0.1 rider offset.

## Clock (T0 = end of the idle hold, 0.5 s in the preview)
| t | what |
|---|---|
| 0 → T0 | idle_breathing_loop at P0 |
| T0 | crossfade 0.2 → **door_reach** (time clock, root static) |
| T0 + 0.333 | **door trigger.** `basket_door` local Y: hand-follow 0 → 2.75° over 2 frames (or start the tween here). Then ease-out cubic `θ = 2.75 + 97.25·(1 − (1 − u)³)`, `u = (t − T0 − 0.367)/0.8`, reaching **+100° at T0 + 1.17**, then hold. |
| T0 + 1.8 | crossfade 0.2 → **walk_start**, planner rate 1.15 |
| T0 + 3.307 | walk_start handoff → walk_loop (nextTime 0.2, crossfade 0.2). s = 0.896 m. |
| cruise | walk_loop on the distance clock, **walkMps 0.8** |
| s = L − 0.500 = 9.030 m (T0 + 13.475) | **walk_stop_bodyL** at foot:R, forward_m 0.500, then idle at the shore. Stride warp 0.970 to land the phase. (bodyR would need 1.023; either is clean.) |

The total from T0 is about 15.3 s; the preview with T0 = 0.5 runs 15.77 s.

## Path
- `roundWalk([P0, approach, shore], **1.0**)`, with approach = (1.2, ·, 26.5) and shore = (1.2, ·, 24.5) lake-local.
- L = 9.531 m: leg 1 7.954 m, then a **95.97° corner**, r 1.0 (the cap = leg 2 / 2), then leg 2 2.0 m.
- Final yaw equals the b14/b15 arrival tangent, so the final lens is unchanged.

## Corner foot lock
Still required. The corner on the new path, measured in mm/frame on the planted sole:

| corner radius | max / p95 / median |
|---|---|
| r 1.0 | 42.9 / 13.2 / 4.2 |
| r 0.6 | 18.0 / 14.9 / 6.6 |

Pivot the root about the planted sole while the yaw rate is non-zero, the same way TURN_* pivotLocal does.

## Door node
- `basket_door` rotates about **local +Y only, 0 → +100°**. Positive opens outward toward the shore.
- Don't animate `basket_door_leaf`.
- Closed at rest; never animate it below 0.
