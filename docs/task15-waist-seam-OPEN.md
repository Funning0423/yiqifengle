# Task15 local waist regression repair — FAIL/OPEN

Baseline for comparison: cf88d7ed2f83df66464c59f53657735ca514f933 (task13).
Input: 02e4a599d386a988224dc336a1cd879929a33e24 (task14).
Runtime code commit: d5627a29301c48831acd6fad8ea446e37c38acda.

Task14's added waist sit_drape delta makes apron faces 288/292 cross dress faces
1563/1743 in eight dense rise samples (0.13246–0.20697 seconds), adding four
pairs per sample. The source points are dress IDs 217,218,260,1395,2485,2486,
including UV seam duplicates. Component ablations isolate the existing
sit_drape delta, rather than the new rise corrective or static positions.

Withdrawing this edit for all actions eliminates those pairs but adds leg/dress
crossings in six return samples (0.89379–0.93517); that attempt was rejected.
The installed candidate cancels only the proved waist delta during stand_up
using cloth_waist_rise_seam with the same curve as stand_up.sit_drape.
sit_down and sit_hold keep the task14 waist behavior. Maximum cancellation is
2.787 mm. No body shape, calf/boot, skinning, rig, animation channel, material,
texture, topology, UV, contact gate or motion-code change is involved.

Regenerate with tools/offline-character/repair_waist_task15.py and the pinned
task15-waist-fields.npz; it starts from the task13 Git asset rather than stacking
onto an existing output. Reproduction and verification must use the full
original collision gate, including failures and untested items.

381 CPU poses: no pair increases versus task14; ten rise poses reduce apron/dress
by forty pairs, including all eight regressions. Dense 300 still have 119 failed
poses (rise 42, return 77), and all 381 still have 172 failed poses. Dense totals:
legs/dress 4469, legs/apron 1883, apron/dress 1925, sleeve/apron 8.
Exact prior native sit_down 0.610 and stand_up 0.612 key poses retain zero pairs.

All 119 failures were mapped by face and bind height. Rise lower-dress leg
crossings use skirt bones rather than the leg field; return includes lower
garment crossings and twelve samples reaching upper waist. The independent
apron/dress deformations do not preserve layer order through early rise and
late return. A 12 mm constrained lower-garment continuous trial reduced failure
counts but introduced three pair increases; it was not installed or included.

Full package s12 followed real door/lighthouse touch actions through natural
sit, rise, turns, walking, stop and return to home/sit_hold. Actual return 0.620
side and back were reviewed, seven collision classes zero; front wall occlusion
is invalid evidence. This is not an exact same-frame comparison to task14 0.615.
Native walking and early rise still contain inherited intersections.
508 controlled 120 Hz, 2.8 m/4 s stop retains reviewed front/side/back cuff
appearance and calf/leather/sole zero crossing pairs. That subitem does not
close expanded contact, all-angle wrist, physical-device or performance gates.

Official Creator 3.8.8 completed package production but returned exit36 for a
shared layout/window startup error, retained in logs. No clean CLI exit claim.
Overall acceptance remains FAIL/OPEN. Do not publish or freeze this candidate.
