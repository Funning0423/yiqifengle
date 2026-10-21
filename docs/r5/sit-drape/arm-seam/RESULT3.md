# arm-seam attempt 3 (sit_down end), FAILED, stopped. The stand_up seam is unchanged (bit-identical to b2).
Passed: ankle slide <=1.88 mm/frame (original 1.88); body x stool 0; hand/forearm x cloth/body 0 (v4), cand3 only its known 12; knee step 36.3 (same as v4); seam diff 0.119 deg.
Failed:
1. Toe slide up to 9.21 mm/frame at f20-33 (original <=2.31). The foot-rotation blend (4-8 deg) swings the toe about the pinned ankle. A toe/ball pin is needed, not an ankle pin.
2. Dress x body / apron x body are above pelvislift_cand1 in every frame f22-36: dress x body f27 310 vs 204, f32 258 vs 111; apron x body f28 228 vs 167. Leg (thigh/shin) triangles. The clip maximum (393) equals cand1's only because cand1's maximum is at f17.
3. The hand lands in one step. Wrist speed f34-36 is 13.0/9.3/12.9 mm/frame vs the original 2.6/3.6/4.1, and the lift goes 13 mm -> 0 at f36. With the skirt left on the mocap pose, the per-frame lift needed rose to 66 mm at f29.
cand3 sit_down dress x stool, without the envelope_8 contribution: f6 11, f7 72, f8 91, f9 94, f28 10. Identical with the original envelope_8 curve, so that key does not cover these frames.
