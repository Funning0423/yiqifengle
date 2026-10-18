# sit_drape stool rebake — STOPPED after 2 retries (look fails), no candidate delivered
Base: A1 final chr_b_r5g2_r5wrist_v4_final.glb. Method: projection bake (bake.py) of sit_drape deltas against the stool at sit_hold f0, written into the GLB by patch_glb.py (only the sit_drape POSITION targets; a sit_drape target added to LOD0_G2_BOW). Checked with the UI bot's u3_probe.py (probe_w.py drives BOW sit_drape at the sit_drape weight).

| run | DRESS×stool pairs | BOW×stool | DRESS×APRON | DRESS×BODY | look |
|---|---|---|---|---|---|
| before (A1 v4) | 499 (21 mm inside) | 40 (16 mm) | 28 | 174 | panels/ribbons through seat |
| cand1 radial from stool centre | 210 (0 verts inside, edges straddle rim) | 0 | 28 | 284 | — |
| cand2 +edge pass, retry 1 | 6 | 0 | 28 | 267 | back hem bunched on seat, bow crumpled |
| cand3 hip-radial + rounded rim, retry 2 | **0** | **0** | 28 | 261 | dress ends in a hard flat edge at seat level (no drape over the rim), BOW ribbons crumpled into spiky shards; under-seat clean |
Images (left before, right cand3): img/A_home_camera, C_side_left, G_side_stool_hidden, H_below_seat_up, E_back/F_front (those two cameras are mis-aimed by the UI bot's script), D_side_right (camera inside the wall).
Not run: sit_down/stand_up per-frame transition check, front/back with fixed cameras, NORMAL target update.
Why it fails: a per-vertex projection can't keep panel length/shape: the hanging length under her thigh footprint has nowhere to go (body 0.5 mm above seat) and ribbons are short strips that fold. Needs a real cloth sim (pinned waist, stool + body colliders, started from a collision-free sit_down frame and settled into sit_hold), or a mesh-side reshaping of the seated key by 角色建模bot.
Also needed for any BOW fix: anim_meta morph.meshes must gain "LOD0_G2_BOW": {"targets": {"sit_drape": 0}} (frozen; runtime only drives meshes listed there). Weight curves themselves don't need changes.
