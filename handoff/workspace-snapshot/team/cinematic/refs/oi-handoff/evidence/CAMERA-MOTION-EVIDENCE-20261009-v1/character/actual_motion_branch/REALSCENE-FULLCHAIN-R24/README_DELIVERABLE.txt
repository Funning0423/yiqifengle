REALSCENE-FULLCHAIN-R24 — actual-room kinematic foundation

Frozen blend: B_ACTUAL_FULL_CHAIN_POSE_PREP_v24.blend
SHA256: 1ff76c18e3ce759f44fae7cac208326fe5600f4993b822fbaeaf9dd0126e07c4

33-second sequence: supported seated preparation/rise 0–3; anatomical LEFT turn 3–4.5; walk 4.5–9; actual ring reach 9–10; actual leaf opens 10–11.5; exit 11.5–14; return turn 14.3–16; return approach/handle turn 16–18.5; close 18.5–21.5; turn toward chair 21.5–23.2; walk back 23.2–27.7; short chair turn 27.7–29.2; reverse supported preparation into sit 29.2–32.2; seated hold to33. No additional step before the first left turn.

World motion belongs only to B_METRE_CONTROLLER_REFERENCE_candidate. B_RIG_22_original_bones root is identity; local pelvis motion is natural stance/gait motion, never a second world-root trajectory. Game=(Blender x,Blender z,-Blender y). Uniform source scale1.0611643605259733 remains provisional, based on rest shoe-to-head excluding hat1.626m; posed stature is reported separately. Source hand.L is anatomical RIGHT because source face/apron front is+Z. Original22 rest bones, geometry, UV, weights and119 actual scene-object transforms/geometry are preserved exactly. The real env_lighthouse_door is animated; no replacement door, handle or furniture.

Pose keys:2408 sampled times,60Hz generally and120Hz for exit/closing, plus exact contact-event keys. Scene and intended playback30fps. Source matrices in pose_matrices.npz are source skin/deformation transforms, not raw hierarchical local bone matrices. Source bind/rest data is required.

Passed scoped checks on this exact blend:
- Independent full33s,3961samples at120Hz: thighs/shins/shoes versus24 real environment meshes,0 strict crossings; every actual shoe vertex versus real low upward-facing surfaces,0 negative gaps. Minimum+.344436mm.
- Own full33s,3961samples at120Hz: cross-leg0; fixed-foot lowsole drift<=.1568mm; declared heel-pivot drift<=.0513mm; max connected joint gap<=.6664micrometres.
- Independent exposed hand/wrist release21.4–23.3s,229samples at120Hz:0 body/room crossings, including the formerly failing22.158–22.408s.
- Own full33s,3961samples at120Hz: exposed hands/wrists/head/neck/hat versus24 scene meshes and full body surface,0 crossings. Max arm joint gap<=.399micrometres.
- All2408 keyed poses have0 limb reach overrun. Nominal standing knees are approximately10degrees. Root curve and both complete foot transforms are exactly equal to R22 while the turn/close pelvis path is smoothed.

All gates are sampled geometric checks. Source LBS sleeves/cuffs/dress/apron/bow-tail contact and same-leg knee skin self-contact remain unaccepted. No garment contour, new panel mesh or cloth physics has been merged. Runtime import, channel reduction and performance are unverified. Pressure/muscle/dynamics proof is not an acceptance prerequisite. Support-envelope hulls are not actual supported sole area; the low-area outside stance was visually reviewed on exact shoes and terrain and showed no obvious whole-shoe hovering.

Review files:
- camera_keyframes/FULL_CHAIN_CAMERA_SHEET_R24.jpg and camera_keyframes/index.html
- tempo_short_30fps/: original-speed pivot/close comparison clips
- full_motion_preview/: INTERNAL_FULL_CHAIN_R24_REAL_30FPS.mp4: complete33.000s,990 actual renders,30fps,all-frame decode verified
- GATE_STATUS.json, named independent/own reports, preservation_and_action_audit.json
- root_reference_curve.json, foot_support_plan.json, heel_pivot_events.json, clip_ranges.json

Camera review uses a separate perspective camera only. No art object is moved or hidden. Actual eye/near-plane/frustum checks pass at998 sampled times; a real chair leg naturally obscures one or two extreme shoe-edge points at25 samples27.2–28.0s, while the main ankle/body rays remain clear. Tiny toe-edge occlusion behind real threshold lips is retained. The original cut-wall triangles are absent in the reviewed keyframes. The full preview is a textured Workbench motion diagnostic, not final lighting/material/cloth presentation.

Runtime synchronization: play the authored pose times and controller curve together. An in-place rig root does not make this a generic walk cycle at arbitrary path/speed; retime pose/root/door/contact events together, or replan foot plants and re-audit. The review-only camera plan is not a Cocos runtime-camera acceptance.
