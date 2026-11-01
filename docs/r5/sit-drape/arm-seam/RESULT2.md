# arm-seam round 2 (Grok Bot decision 18:30 ET). Stand_up start PASSED; sit_down end FAILED (2 attempts used, stopped).
Per-frame QA is at 30 fps, every frame of all three clips, with meta_patch.json: qa_perframe.csv, qa_summary.json. Crossfades: seam_v4.json, img/.
- Hand/forearm x apron/dress/body, v4 mesh: 0 in every frame of all 3 clips and every simulated crossfade frame (A: k0-9, B: k0-13).
- cand3 mesh: 12 hand x apron pairs in sit_down f35-36, all of sit_hold, stand_up f0 and crossfade B k0-2 (8 at sit_down f35). These are cand3's own sit_hold pairs; 角色建模bot owns them.
- Seams: max bone difference 0.119 deg (float noise) at both seams, 0 mm, 0 morph difference.
- Body x stool: 0 in all frames.
- stand_up: wrist max 59.8 mm/frame, same as the original; no foot change.
## FAIL, sit_down end (attempt 1 = b1: envelope_8 morph mismatch + lift landing hits; attempt 2 = b2, QA'd):
1. Foot slide: ankle/toe move 4-13.7 mm/frame (f19-36) vs <=1.9 mm in the original. Bug: the ankle IK target was lerped toward the hold ankle in armature space, which undoes the mocap's compensation for the root moving in world. Fix: target = orig(f) + wL*(hold - orig(36)).
2. Cloth x legs regression, sit_down f22-33: dress x body max 586 vs 393 and apron x body 403 vs 204 (cand1); thigh/shin triangles. Cause: skirt bones blended toward hold from f16 while the IK keeps the mocap thighs (mid-descent thigh differs from hold by 15-19 deg). Fix: blend the skirt only late (about f30-36, where the diffs are <=6 deg) or drive it from the achieved leg pose.
Wrist: max 122.6 mm/frame, the same as the original. Last frames are 5.9/5.7 mm vs the original's 4.1/4.8. Clearance 3.6-4.6 mm at f35, 0.22 mm at f36.
