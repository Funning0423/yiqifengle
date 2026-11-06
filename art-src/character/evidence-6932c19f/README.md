# Evidence pack — `6932c19f`

**Commit:** `6932c19f` — *char: heroine polish r2 — seated cloth clearance (dress tuck under apron, thigh slim), mitten hands + wrist tilt; game-morph QA/render*

**GLB:** `heroine_6932c19f.glb` (extracted from that commit’s heroine asset)

## Index

### Canonical renders (from `heroine_6932c19f.glb`, Workbench, fixed cameras)
| Shot | Path |
|------|------|
| front | `renders/front.png` |
| side | `renders/side.png` |
| back 3/4 | `renders/back34.png` |
| face close | `renders/face_close.png` |
| face 3/4 | `renders/face_34.png` |
| game-scale bust | `renders/game_scale_bust.png` |
| game-scale full | `renders/game_scale_full.png` |
| seated front/side/34 | `renders/seated_*.png` |
| hands | `renders/hand_*.png` |

### Motion / game-morph (from polish after/ QA set aligned with r2)
| Shot | Path |
|------|------|
| seated_game front/side/34 | `motion/seated_game_*.png` |
| seated sit_hold | `motion/seated_*.png` |

### Prior compare sheets (from `art-src/character/polish-20261105/compare/`)
| Sheet | Path |
|-------|------|
| fullbody before/after | `compare/fullbody_before_after.jpg` |
| hands before/after | `compare/hands_before_after.jpg` |
| seated before/after | `compare/seated_before_after.jpg` |
| seated game before/after | `compare/seated_game_before_after.jpg` |

### Notes
- `back34` and `game_scale_*` were missing from older after/ dumps; regenerated from the commit GLB on 2026-11-06 (America/New_York).
- Face in this commit is still the pre-target anime face; face/hair target work is tracked separately under `face-target/` and `hair-collar/`.
