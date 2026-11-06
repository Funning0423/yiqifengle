# Heroine head remodel 2026-11-06 — Nahoko / The Wind Rises

Branch `char/remodel-head-20261106`. Runtime GLB path unchanged:
`creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb`

## Why
Funning rejected polish round-2 face as a generic anime doll (huge round eyes, flat face, tiny red mouth). Task: remodel the head from scratch toward Satomi Nahoko (Ghibli *The Wind Rises*), keep round-2 body/dress/hands, drop the 1.12 head enlargement.

## Pipeline
1. Body base = e976a733 + polish r2 edits with `head_scale=1.0` (`scripts/build_polish.py`, body kept from round 2: mustard, apron push, skirt weights, mitten hands, thigh slim, dress tuck).
2. Procedural head (`scripts/build_head.py`, Blender 5.2.2): new low-poly skull/neck/collar/bob/hat; flattened front plane + soft nose ridge; soft bob + side-swept fringe; straw hat with pink/red band.
3. Face atlas (`scripts/paint_textures.py`): smaller almond dark eyes, thin brows, soft mouth, subtle blush, mustard collar swatch. No separate eye-patch mesh (avoids rect seams). Live GLB had no blink morph names — blink UV morphs not added.
4. Splice (`scripts/splice_glb.py`) replaces FACE/HEAD/HAIR prims; keeps BODY morph **count** (15) with zero deltas on new head verts so Cocos morph indexing stays valid; sparse torso morphs preserved.

Rebuild: see `scripts/` (paint → blender build_head → splice into body/heroine_body_r2_noscale.glb).

## Renders
Workbench, same `render_char.py` cameras as polish. Sheets in `sheets/`:
- `compare_before_round2_remodel.jpg` — face_close / face_34 / face_side / fullbody × 3 columns
- `face_*_3way.jpg`, `fullbody_*_3way.jpg`

## Honest gaps (still not Nahoko)
- Nose ridge is readable in profile but still a bit angular/faceted from the front (Ghibli is softer).
- Fringe is softer than polish but still low-poly chunky; not a fully natural side-part curtain.
- Eyes are small/dark almond (good direction) but Workbench flat lighting makes them read as dots at distance; need Cocos/IBL check.
- Chin/jaw volume improved vs doll sphere but still a bit pointy under the hat shadow.
- Neck–collar seam visible in close-ups.
- Stand-up cloth morphs / seated cloth QA not re-run this round (body unchanged from r2).
- Not verified in Cocos Creator or WeChat device.
- No blink morphs (none existed on live BODY targetNames either).

## Iteration
Visual self-critique loops: iter1→iter6 (nose strength, eye-patch removal, face flatten, tip soften). Final = iter6.
