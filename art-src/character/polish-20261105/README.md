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
