# anim_meta curves for the arm seam (QA used meta_patch.json, a local copy; the repo anim_meta is unchanged)
## APPROVED (stand_up)
stand_up.morph.curves.hand_rest_support (time s, weight). Smoothstep 1 -> 0 over 0.1667 s, then held at 0:
[[0.0,1],[0.03334,0.896],[0.06668,0.648],[0.10002,0.352],[0.13336,0.104],[0.1667,0],[1.266667,0.0]]
stand_up.morph.curves.cloth_waist_rise_seam. Starts at the sit_hold value 0, smoothstep to 1 by 0.1333 s, then the existing release:
[[0.0,0.0],[0.033325,0.15625],[0.06665,0.5],[0.099975,0.84375],[0.1333,1],[0.8667,0.0],[1.2667,0.0]]
(This key moves the dress by at most 2.79 mm. The old 0 -> 1 step at the seam was small but real.)
## NEEDS APPROVAL (not covered by the stand_up approval)
sit_down.morph.curves.cloth_envelope_sit_down_8: [[0.0,0.0],[1.2,0.0]]
The original ramps 0 -> 1 between 1.05 s and 1.2 s, but sit_hold has it at 0. That mismatch alone gave 14 hand x apron pairs at sit_down f36 with the exact hold pose.
Without this change, sit_down's end frame cannot match sit_hold.
