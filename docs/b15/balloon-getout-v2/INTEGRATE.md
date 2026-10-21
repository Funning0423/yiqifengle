# getout v2: integration values (b14 plan A, LakesideBalloon / RegionJourneyAdapter)
All timings below are at 30 fps. Clips come from hipsway65 (the walk base approved by Grok Bot). The run is 16.7 s in total.

## Placement
- **Basket:** `vehicle.setRotationFromEuler(0, 112.86, 0)`, so the door wall (+Z) faces the shore direction (+0.921, 0, −0.389).
  - b14 currently leaves the basket at yaw 0.
  - **Compensate her seat yaw:** `girl.setRotationFromEuler(0, girlYawDeg − 112.86, 0)` under `stand_point`, so her ride facing is unchanged.
- **At touchdown** (off-screen in plan A), before the get-out:
  - Today she faces the flight heading (−0.498, 0, 0.867), which is **142.7°** from the door.
  - Fix: `cancelAndReset({kind:'standing', controllerRoot: P0, yawRad: atan2(0.921, −0.389)})`, i.e. world yaw 112.86°.
  - Not authored: a visible in-basket turn (walk_turn_180 is 180°, not 143°).
- **Start root P0:** basket-local (X +0.03, Y 0, Z +0.395), i.e. world = `mooring + rotY(112.86°)·(0.03, 0, 0.395)`.
  - That is 0.405 m behind the closed leaf's inner face.
  - Her feet are at the basket origin height. The floor is lowered to 0 per DOOR_SPEC, so no 0.1 drop is needed.

## Clip order and crossfades (CROSSFADE_S 0.2 everywhere)
| clock t (s) | what |
|---|---|
| 0 | idle_breathing_loop at P0, facing the door. The hold length is free; I used 0.5 s. |
| T0 = idle end | crossfade 0.2 s → **door_reach** (time clock, root static; start_pose = idle f0) |
| T0 + 0.333 | **door trigger**: `basket_door` hand-follow 0 → 2.75° for 2 frames, then code ease-out cubic to **+100°** over 0.8 s, done at T0 + 1.17. Use `contactTime` 0.333, not meta handle_contact_s 0.633, for a flat leaf. |
| T0 + 1.8 | crossfade 0.2 s → **walk_start**, played by the planner (rate k = 1.15, i.e. 0.7·1.15 = 0.805 ≈ walkMps). The door is at 100° here. |
| T0 + 1.8 + 1.733/1.15 = T0 + 3.307 | walk_start handoff → **walk_loop** at nextTime 0.2, crossfade 0.2. Root s at handoff = 0.896 m. |
| cruise | walk_loop on the distance clock at **walkMps 0.8** (rate 1.14 = 0.8/0.7). Stride warp 1.001 so the stop lands on the walk_loop foot:R heel strike. |
| s = L − 0.500 | **walk_stop_bodyL** (entry at foot:R, crossfade 0), forward_m 0.500 m → stands at the shore, then idle. |

- `walkMps = 0.8` (a new knob for this exit walk; b14 currently uses `walkMps 1.2`).
- 0.8 ≤ 1.3·0.7 = 0.91 and ≥ 0.75·0.7, so **walk_start and walk_stop are both used by planWalk**.
- **distanceAt: unused.** Let planWalk drive start, cruise and stop; do not pass the eased `moored.walkAt` (that is what drops the start/stop at 1.2).

## Path
- `roundWalk([P0, approach, shore], r)`:
  - approach = shore + lake rotY(0,0,2), as b14 does now;
  - shore = `L.arrival[-1]`;
  - **P0 replaces b14's `exit` point** (mooring + 1.6·h).
- Length with r 0.6 is **10.28 m**: leg 1 is 8.61 m (straight out of the door; no turn at the door), then a **112.7° corner** at approach, then leg 2 of 2.0 m to the shore.
- The final yaw equals b14's (shore − before), so RegionJourneyController's final lens is unchanged.

## Corner radius and foot lock
| run | corner slide max / p95 / median (mm per frame) | straight walk_loop |
|---|---|---|
| 0.8 m/s, r 0.6 (b14 value) | 49.5 / 18.8 / 7.9 (53 frames) | 49.0 / 6.8 / 0.94 |
| 0.8 m/s, r 1.0 (max possible: leg 2 is 2.0 m, so k ≤ 1.0) | 43.8 / 17.5 / 5.2 (72 frames) | 47.5 / 5.7 / 1.1 |

- The straight max values are single touch-down frames of walk_loop itself (the same in every run, so they come from the clip, not this setup).
- **Use the minimum corner radius r = 1.0** (cap: leg 2 / 2). Below that, the planted foot skates sideways during the 113° turn.
- **Foot lock at the corner is still needed.** The in-place root rotates about the root, not the stance foot. The driver should pivot the root about the planted sole (support-foot lock) while the yaw rate is non-zero; that is the same thing TURN_* pivotLocal does for the turn clips. Without it, expect p95 of about 18 mm/frame in the corner.

## What b14 does now (1.2 m/s, measured on the same real path)
- It teleports her to `exit` = mooring + 1.6·h (`cancelAndReset` standing), then calls `perform walk` with `distanceAt` eased 0.8 s, over 9.07 m, with a 112.9° corner at r 0.6.
- At ratio 1.71 > 1.3 there is no walk_start/stop; it is an idle↔walk_loop crossfade.
- Slide:

  | segment | slide (mm per frame) |
  |---|---|
  | start crossfade | **40–41**, 6 frames |
  | corner | max 30.6 / p95 29.3 / median 13.5 (36 frames); r 1.0 gives 31.6 / 26.9 / 8.6 |
  | straight | median 0.8 (single touch-down spikes ≤ 49.5) |
  | end crossfade into idle | **34–48**, 6 frames, plus 38 on the settle frame |

- Basket penetration: 0, because she starts outside.
- Files: `qa_b14.json`, `qa_b14_r1.0.json`.
