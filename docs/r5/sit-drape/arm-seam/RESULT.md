# arm-seam (pelvislift_cand1 anim, checked on cand3 mesh): NOT PASSED. Stopped after 2 attempts.
- a1: eased slerp toward the hold arms + wrist IK lifted by a bump C*4w(1-w), C up to 110 mm. Seam-end hits stayed (sit_down f32-36, stand_up f0-1). Also had a stale-pose bug at w=0.
- a2: bug fixed, skirt bones blended to hold, per-frame minimal lift plus a 3 mm margin. Interior frames now 0 hits (sit_down f22-35, stand_up f1-10), elbow deviation <=5.8 deg, no wrist twist.
  The end frames still fail by construction:
  - sit_down f36, exact hold arms: 26 hand x apron pairs. The legs at sit_down f36 differ from hold f0 (thigh 2-4, shin 2-5, foot 4-8 deg), and legs are frozen.
  - stand_up f0, exact hold arms: 119 pairs. The anim_meta morphs at stand_up f0 (hand_rest_support 0, cloth_waist_rise_seam 1) differ from sit_hold (hand_rest_support 1). With the hold morphs it would be 12, the same as the cand3 sit_hold baseline.
  - The step from f35 (14 mm lift) to f36 (0) would be a contact snap.
  - The original mocap differs from the hold by 61-85 deg (forearm/hand) at both seams.
- Needs one of: (a) a leg match at the end of sit_down (not allowed), (b) a stand_up f0 hand_rest_support curve that starts at 1 (anim_meta change, Cursor), (c) the cand3 mesh fix for the 12 pairs at hold.
