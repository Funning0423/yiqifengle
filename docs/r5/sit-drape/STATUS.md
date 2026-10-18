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

## Round 2: Blender 4.5 cloth sim (sim.py), STOPPED after 2 attempts, no candidate
Setup: A1 v4 final scene. sit_down retimed to 30 fps (36 f), stand→seated root lerp, blend to sit_hold f0 over 10 f, settle 40 f (86 f in total). BODY morphs follow the sit_down curves, then sit_hold. DRESS/APRON/BOW are cloth (cotton-like: tension/compression/shear 40, bending 0.5, quality 12, collision quality 4, distance 3.5 mm). Pin = the hips vertex-group weight (0.35..0.9 → 0..1). Colliders: the stool and the body; the dress also collides with the apron and bow.
- Attempt 1: the DRESS blew up (max displacement 13.26 m). APRON (287 mm) and BOW (144 mm) stayed bounded.
- Attempt 2 (each cloth gets its own collision collection, so the dress can't hit itself): identical result. The dress's z-extent grows linearly from frame 0 (0.75 m → 13 m) while she is still standing, so collision isn't the cause.
- Root cause (islands.py): LOD0_G2_DRESS has 12 loose mesh islands, and 7 of them (230 verts) carry no hips weight, so they have no pin and fall freely. These islands are probably lining/trim pieces weighted only to skirt bones. APRON (2 islands) and BOW (5 islands) are all pinned.
- Not done: conversion to deltas/normals, probe, images, per-frame transition check.
Fix for the next round (mesh side, 角色建模bot, or a sim-setup change if approved): pin or attach the 7 loose DRESS islands (pin them at their top rows, or merge them into the main panel). Optionally add a waistband vertex group for the pin. Then rerun sim.py unchanged otherwise.
