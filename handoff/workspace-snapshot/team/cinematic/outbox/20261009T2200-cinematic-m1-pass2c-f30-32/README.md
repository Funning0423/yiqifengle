# M1 pass2c — f29–f33 cine_open_stand pose for f31 refit (运镜bot, 2026-10-09 22:00 CT)

Source scene: team/cinematic/work/m1v2-pass2c/export/blend/cine_m1_pass2c_wip.blend (pass2c interim source copy, K baked once = 1.061164, root scale 1, BONE_DEFORM 4-weight limit = no-op, all meshes already ≤4).
Animation = v2g unchanged (stand-up timing, seat root, turn) + these 2 changes:
- root z +0.5 / +1.0 / +0.5 mm at f30 / f31 / f32 (cos² ease, 0 at f29/f33)
- soles +0.2 mm (ankle IK targets; carried by the hips once the legs straighten, so the knees don't move)
Bone diff against v2g: stand max 1.0 mm (root at f31), turn max 0.0095 mm, safe ends max 0.2 mm.

Files
- pose_f29_33.json: per frame: bones{name:{world (Blender world, Z up, m), local_basis, charframe_world}}, morph_weights (sidecar cine_open_stand_weights), gap measurements
- fNN_eval_meshes.npz: evaluated world verts (float32, Blender world) for body / dress / apron / hair, same vertex order as the pass2c source
- f30_32_eval_meshes.glb: static evaluated meshes for f30/31/32 (body, dress, apron; glTF Y up)

!! Important: scale mismatch in p2c_m1_apply (see WARNING_scale in the json).
Your m1v2g_frames_charframe.json world matrices have unit scale; pb.matrix = Wi @ A on an armature with object scale K gives pose bones a 1/K scale, so the M1 check and the corrective fits used a mesh shrunk 5.8% about every bone (head-region ratio 1.0612; body min z 4.69 mm instead of 0).
With p2c_check.py unchanged except A = A @ Scale(K) (KFIX=1), the check gives these non-zero results: m1s_f0 = 746 (vis legL×dress 155, dress×chair 242); f25 = 1493; f31 = 953; f45 = 919; f60 = 221; f75 = 434.
f31 front edge in the K-correct geometry: body to edge 12.7 / 16.1 / 13.7 mm, dress to edge 0.08 / 0.74 / 0.54 mm (f30 / 31 / 32).
!! The GLB morph targets are scaled by K²: in R5G2_PASS2C_INTERIM_grokbot2.glb the max sit_corrective delta is 1.12607 × the source (body 513.2 vs 455.76 mm, dress 432.2 vs 383.81 mm; K² = 1.126069). The base mesh is scaled by K only, so the morph targets are 6.1% too large.
!! sit_corrective + m1_c* are also present on the BODY: 786–810 verts move more than 0.1 mm, max 483.6 mm with K applied once.
