# Heroine polish 2026-11-05 (char/polish-20261105, base e976a733)

In-place edit of the runtime GLB (same path, same mesh/material/node names, same vertex counts,
same morph-target counts APRON16/DRESS15/BODY15/BOW3, animations untouched), so `.meta` UUIDs and
`StandupProgramWarm`/`CharacterMotion` morph indexing stay valid.

Rebuild: `python3 scripts/build_polish.py <e976a733 glb> <out glb>` (params at top; override via `POLISH_P` json env).

## Changes
- Head (+hair+hat, everything head-weighted on BODY) scaled 1.12 about the head joint (skull base); blink/corrective morph deltas scaled with it. Height 1.756 -> 1.794 m.
- Face texture (T_G2_FACE): main eyes enlarged 1.22x and lifted 6px, brows redrawn thicker/darker, mouth and nose tick darkened/enlarged.
- Colour: saturated lemon -> mustard (226,170,46 at full luminance) on DRESS, BODY (sleeves/bodice) and FACE collar swatches.
- Apron pushed 2 mm along normals off the dress.
- Skirt weights: 30% of each `skirt.*.low` weight moved to its upper skirt bone (dress + apron together).

## QA (scripts/qa_cloth.py, body-r1 qa_clash.py; Blender 5.2.2, morph weights at 0)
| clip | apron x dress tris before -> after | dress x legs before -> after |
|---|---|---|
| walk_loop | 92 -> 4 | 286 -> 181 |
| sit_hold | 84 -> 106 | 69 -> 69 |
| sit_down | 155 -> 163 | 249 -> 249 |
| stand_up | 150 -> 139 | 244 -> 241 |
qa_clash.py (sleeve/hand vs cloth): idle/walk/door 0 overlaps before and after; sit clips ~unchanged (706->711 sit_hold).

## Renders
`scripts/render_char.py` (Workbench, texture colour, fixed light + fixed camera framing from e976a733 rest bbox):
`blender -b -P render_char.py -- <abs.glb> <abs outdir>`. Comparisons in `compare/`.


# Round 2 (2026-11-05) — seated skirt + hands
Review r1: face approved; seated clipping regression + unchanged hands FAILED. Not for merge into mainline.

## Changes (geometry/weights only; no keyframes edited; names, vertex counts, morph counts, clip list unchanged)
- **Dress tuck**: dress verts within 6 cm behind the apron moved 8 mm inward along their normal (hidden surface), apron stays outside when both deform.
- **Thigh slim**: thigh verts above 0.58 m (always skirt-covered) pulled toward the bone axis to 75% radius: room for the dress when seated.
- **Hands**: low-poly mitten read: fingers 0.85x length, palm/fingers 1.3x thick, 1.1x wide, fingers drawn 50% together (verts with hand weight > 0.6);
  hand tilted back ~4 cm at fingertips from the wrist (back-of-hand direction, ramped along hand length: no wrist step) — clears skirt in walk and lap in sit.
- Kept from r1: head 1.12x, face texture, mustard, apron +2 mm, skirt .low->parent 30% weight shift.

## QA — raw = morph weights 0; morph = game sit/stand morph weights from anim_meta.json (CharacterMotion.morphWeights: piecewise-linear per clip, clamped 0..1), via `scripts/game_morph.py`
Cloth counts = overlapping triangle pairs (`qa_cloth.py`, every 2nd frame); hand/sleeve = sum of `qa_clash.py` overlap_max for hand_* / sleeve_* pairs; gap = min hand->cloth mm.
before = e976a733, after = this commit.

| mode | clip | apron×dress | dress×legs | hand×cloth | sleeve×cloth | min hand gap mm |
|---|---|---|---|---|---|---|
| raw | sit_hold | 84 → 67 | 69 → 62 | 171 → 112 | 535 → 433 | 0.0 → 0.0 |
| raw | sit_down | 156 → 131 | 258 → 178 | 171 → 109 | 572 → 452 | 0.0 → 0.1 |
| raw | stand_up | 156 → 129 | 244 → 188 | 171 → 112 | 562 → 446 | 0.0 → 0.0 |
| raw | walk_loop | 124 → 0 | 286 → 172 | 0 → 0 | 0 → 0 | 3.3 → 38.2 |
| raw | idle_breathing_loop | - → - | - → - | 0 → 0 | 0 → 0 | 20.2 → 22.4 |
| raw | door_reach | - → - | - → - | 0 → 0 | 0 → 0 | 12.4 → 11.7 |
| morph | sit_hold | 85 → 19 | 95 → 0 | 175 → 73 | 128 → 132 | 0.1 → 0.7 |
| morph | sit_down | 281 → 171 | 163 → 161 | 278 → 123 | 181 → 185 | 0.0 → 0.0 |
| morph | stand_up | 779 → 757 | 128 → 85 | 253 → 137 | 128 → 132 | 0.0 → 0.0 |
| morph | walk_loop | 0 → 0 | 286 → 172 | 0 → 0 | 0 → 0 | 3.3 → 38.2 |
| morph | idle_breathing_loop | - → - | - → - | 0 → 0 | 0 → 0 | 20.2 → 22.4 |
| morph | door_reach | - → - | - → - | 0 → 0 | 0 → 0 | 12.4 → 11.7 |

## Repro
- build: `python3 scripts/build_polish.py <e976a733 glb> <out glb>`
- QA: `GAME_MORPH=<anim_meta.json> blender -b --python scripts/game_morph.py -P scripts/qa_cloth.py -- <glb> <out.json>`
  and `GAME_MORPH=... blender -b --python scripts/game_morph.py --python ../body-r1/scripts/qa_clash.py -- <glb> <out.json> <glb>` (omit GAME_MORPH for raw)
- render: `GAME_MORPH=<anim_meta.json> blender -b -P scripts/render_char.py -- <abs glb> <abs outdir>` (fixed cameras; adds hand_* and seated_game_* shots)
