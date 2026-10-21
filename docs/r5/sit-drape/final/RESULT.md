# sit_drape final check: 角色建模bot cand3 (compressed). NOT PASSED, no final GLB placed
File: previews/角色建模bot/r5-sit-drape/chr_b_r5g2_sitdrape_cand3_compressed.glb, sha256 47229b63…4230 (verified), 3,269,312 B (v4 final 3,493,824; production 3,584,600; pelvislift_cand1 3,342,092).
Structure vs pelvislift_cand1: nodes/TRS, joints, inverse bind matrices identical; all 14 clips byte-identical; BODY morphs identical; APRON: only sit_drape changed; DRESS 5721→5707 verts (islands 8/9 deleted); BOW gains a sit_drape target. The changed keys have no non-zero anim_meta curve outside sit_down/sit_hold/stand_up. A1 walk QA (clipcheck/arms/loco) identical to v4 final: arm_in_dress/apron 0 on all 4 walk clips.

Per 30-fps frame (qa2.py; anim_meta weights by target name, BOW sit_drape driven like DRESS = the approved morph.meshes entry; controller root linear standing→seated; sit_hold sampled every 10 f). max / total:
| clip | metric | v4 final | cand3 | flag |
|---|---|---|---|---|
| sit_down | dress×stool | 531 / 7099 | **92 / 312** (f6–9, f28, f36) | must be 0 |
| sit_down | bow / apron / body ×stool | 78 / 0 / 28 | 0 / 0 / 0 | ok |
| sit_down | dress×body | 393 / 5908 | 482 / 7351 | ABOVE |
| sit_down | apron×body | 204 / 2891 | 226 / 2687 | max above |
| sit_down | dress×apron | 49 / 314 | 57 / 889 | ABOVE |
| sit_down | hand/forearm×cloth | 0 | 0 | ok |
| sit_hold | dress / bow ×stool | 499 / 40 | 0 / 0 | ok |
| sit_hold | dress×body / apron×body / dress×apron | 174 / 43 / 28 | 67 / 23 / 15 | better |
| sit_hold | hand/forearm×cloth | 0 | **12 every frame** | ABOVE (new) |
| stand_up | dress×stool | 591 / 8136 | **182 / 250** (f6–7, f22, f24, f28) | must be 0 |
| stand_up | dress×body | 264 / 3046 | 339 / 3991 | ABOVE |
| stand_up | apron×body | 87 / 781 | 32 / 559 | better |
| stand_up | dress×apron | 135 / 676 | 72 / 603 | better |
| stand_up | hand/forearm×cloth | 0 | 0 | ok |
Differences vs 角色建模bot's own table: it samples Blender 24-fps frames (fr/24), so it misses 30-fps frames.

Crossfade (xfade.py; CROSSFADE_S 0.2 s = 6 frames, the outgoing clip keeps its clock, per-joint lerp/slerp, morph weights blended the same way):
- sit_down→sit_hold: hand/forearm×cloth 186 / 371 / 325 / 294 / 263 over crossfade frames 1–5. In the close-up the far hand's fingers sink into the apron mid-blend. This is pre-existing: v4 and pelvislift_cand1 give 203–425 on the same frames. Hand steps 6–11 mm/frame, no jerk.
- sit_hold→stand_up: 199 at crossfade frame 1, 6 at frame 2 (v4: 257/277/18). hand_rest_support 1→0 and cloth_waist_rise_seam 0→0.91 blend linearly over the 6 frames, and the apron top visibly slides back with no pop. The hands start moving 20–30 mm/frame from crossfade frame 3 on (the stand_up push-off), smooth.
Visual: game camera before/after looks almost the same at that size; side view: the BOW ribbon now sticks out stiffly backward, and a dark crease shows on the dress back panel. Contact sheets show no hard edge on the seat; dress rim contact is visible during sit_down f6–9 (skirt swing into the stool while she is still at the standing spot, also in v4).
