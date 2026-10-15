# Task21 clothing-layer candidate (OPEN)

Reproduce in an isolated checkout of baseline 92e3a6edfb30e9e0cc73330c23b76ac77a7ad2ea:

1. Run `repair_layers_task21.py` from this directory.
2. Run `refine_layers_task21.py` from this directory.

The first script retrieves and verifies original baseline GLB/meta bytes from Git and installs the recorded lower-layer fields. Early stand_up fields below 0.15s are deliberately excluded because their probes added hand intersections. The second installs ten local refinement targets at actual failing interpolation frames and replaces the gait field with a 20mm maximum lower-front gap, smoothly excluding the side hand-contact region. Straight gait clips use the same gap curve to preserve native outgoing/incoming crossfade clearance; turn clips keep zero additional gap after an exact no-change audit of the affected scope.

All original geometry, indices, skinning, bones, animation samples, morph deltas, texture bytes and materials are retained. Only APRON/DRESS targets and metadata curves are added; BODY, wrists and boots retain original data. Collision thresholds are unchanged.

Field knot reports include rejected probes and are diagnostic evidence, not acceptance. The first candidate introduced exact new pairs despite lower counts and was rejected. Acceptance requires the complete runtime build identity, actual native crossfade TRS/morph weights, exact triangle-pair audit and unobstructed actual screenshots. Heel patch contact and all-angle wrists remain OPEN until tested.
