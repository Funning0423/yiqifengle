# Plan B (sit_hold = sit_down f36 mocap pose; stand_up re-seamed): FAILED on the v4 mesh after 1 attempt + 1 fix. Stopped.
Delivered for 角色建模bot (attempt-1 animation, v4 mesh, uncompressed): previews/角色动画bot/sit-drape-stool/arm_seam/pelvislift_cand3_dense.glb
3,423,548 B, sha256 300e026cda198c3d11e482c290b6a0c13da44d3b5e1f85ba21c9f98d2b4ecac5. Pose report: sit_hold_pose_report.json.
- Old sit_hold idle motion: max 0.079 deg (spine/chest/neck/head), 0.105 deg elsewhere, i.e. static. Kept as a delta; negligible.
- New sit_hold vs old: wrist L +44.8 mm (40.1 mm higher), wrist R 31.0 mm (z +1.8); thigh pitch within 0.12 deg; shin L -1.12 / R +1.71 deg.
- Morphs: with the patched curves, no morph differs between sit_down end, sit_hold and stand_up f0.
PASS (v4): hand/forearm x cloth/body 0 in every frame of all three clips; body x stool 0; ankle/toe slide equal to the original in every frame; knee step max 68.1 (original 68.1); seam diffs 0.088 deg / 0 mm / 0 morph on both seams.
FAIL (v4):
1. Hand rest: with sit_hold morphs the left hand floats 17.8 mm above the cloth (right 0.77 mm). Over the 5 mm limit.
2. Wrist speed is not <= the original in every frame (stand_up): attempt 1 f3 L 17.1 vs 14.4, f4 22.0 vs 17.2, f5 L 15.9 vs 2.6, f6 R 16.3 vs 7.6, f8-10 slightly over. The clip max (59.8) is unchanged.
3. Cloth above cand1 in stand_up: dress x stool f1 462 vs 424, f3 367 vs 355; dress x apron f4-7 (56/158/90/54 vs 41/144/86/50).
Fix (arms over 14 frames, legs over 6): worse. Lift 52 mm, wrist over the original at f3, 5, 6 and 9-14 (f11 52.8 vs 45.0), dress x stool f1-3 still above. Not adopted.
cand4 reference (patched curves): hand x cloth 0 in all frames. Dress x stool 48 at sit_down f35-36, all of sit_hold, stand_up f0 (29 at f1); cand1 on cand4 has 0. Dress x body slightly up at sit_down f32-34.
