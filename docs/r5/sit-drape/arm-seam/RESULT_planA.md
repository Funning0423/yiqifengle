# Plan A (sit_down: legs/hips/skirt = cand1 mocap, only the arms aligned to sit_hold f0): FAILED at authoring, stopped before QA/delivery. Plan B was not attempted.
Per-frame per-side minimal lift (arm blend f20->f33 smootherstep, constant tail lift f33-36, target clearance at f36 >= 3 mm). Rows: planA_rows.txt.
- The sit_hold f0 arms do not fit the sit_down f36 lap. With the mocap legs (2-8 deg gap), the hold-pose left hand needs a 40 mm lift (right 11 mm) to clear the cloth at f33-36. f36 clearance L 3.0 / R 8.9 mm, so the end pose is not the hold pose: the left hand is 40 mm above it, and the crossfade would have to lower it by about 40 mm.
- The lift path is not small: per-frame need peaks at L 100 / R 88 mm (f28-29), because the slerp path from mocap to the hold arms sweeps the forearm through the lap.
- One-frame drop: the lift goes 66.6 -> 40 mm (L) and 44.4 -> 11 mm (R) between f32 and f33. Holding it high enough to remove the drop makes the hand float even more at the end.
Hand x cloth was 0 in the authored frames, but the "few mm above the cloth" end and "no one-frame drop" conditions cannot both be met, so the crossfade QA was not run.
Conclusion: Plan B (sit_hold legs matched to sit_down f36, with 角色建模bot re-fitting the cloth) or another decision is needed.
