# r5 wrist/skirt — integration handoff (FINAL = v4) for Mac Cursor

Content: 角色建模bot tuck v2 mesh (DRESS/APRON vertex positions only) + baked walk animation
(raw mocap arms, single-frame jump smoothing, skirt-bone avoidance on skirt.left/right), compressed with
`previews/角色动画bot/compress/compress.py` (LEGTOL 0.03°, other rot 0.2°, hips 0.1 mm; constant channels removed, greedy key steps).

## File to replace (frozen)
| | path | bytes | sha256 |
|---|---|---|---|
| OLD (repo, frozen) | `creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb` | 3,584,600 | bb37efb59f558e4a80dbed1082dd048914084adf3518353292980e35474fab3f |
| NEW | `chr_b_r5g2_r5wrist_v4_final.glb` (copy over the OLD path, keep the OLD file name) | 3,493,824 | a96226da6956d78aeddd8b181fb2e4975c8520d0a5b44f2458a9ecb7e4caec37 |

Delta −90,776 B (−88.6 KB). Note: the GLB as a whole was already ~3.5 MB, above the ~600 KB character budget before this change; this change does not add to it (it shrinks). Animation data added for the 4 walk clips: 48 KB.

The NEW file is too large for docs/ → it lives on the box at
`/workspace/yiqifengle/previews/角色动画bot/r5-wrist-footik/final/chr_b_r5g2_r5wrist_v4_final.glb` and **must be copied to the Mac (Grok Bot arranges it)**. Verify sha256 after copy.

## Other files
- `.glb.meta`: no change (same uuid/import settings; tangents already `1` = Exclude). Confirm Tangents=Exclude in the Cocos import panel.
- `anim_meta.json`: no change. Same 14 clip names, durations identical (walk_start 1.9333 s, walk_loop 1.4333, walk_stop_bodyL/R 1.4667, turns unchanged), 30 fps, events/root-motion/morph curves untouched. Bones (34 nodes), skin, 4 meshes and morph target names identical; no TANGENT attribute.
- `CharacterMotion.ts`: no change.
- `tools/journey-integration/frozen-production-inputs.json`: stores hashes → update the entry at line ~757 (`...grokbot2.glb`) sha256 `bb37efb5…fab3f` → `a96226da6956d78aeddd8b181fb2e4975c8520d0a5b44f2458a9ecb7e4caec37`. The `.glb.meta` hash entry stays unless Cocos rewrites the meta on import (if it does, update with the new meta sha).
- Animation order inside the GLB changed (the 4 walk clips are now last); clips are looked up by name.

## Manifest rule
After any change under `creator-build-project/`: `node tools/test_manifests.cjs --write`, commit, then rerun `node tools/test_manifests.cjs` (no args) — it must pass.

## Checklist
1. Copy NEW GLB to the OLD path; `shasum -a 256` = a96226da….
2. Update the hash in frozen-production-inputs.json.
3. Open Cocos Creator, let it reimport; check Tangents=Exclude, no new sub-assets/uuids lost (animations still 14, same names).
4. Manifest rule (above). Commit.
5. Tests: `node tools/test_character_handoff.cjs` (passes with this GLB via WALK_GLB on the box); `node tools/test_locomotion.cjs`. `test_walk_driver.cjs` **already fails on unmodified bc81575f** (returnHome → cannot read 'points'); not caused by this change — compare against baseline, don't block on it.
6. Build WeChat mini-game, run on device. Look at:
   - walk_loop & walk_start, side + front: her right hand/forearm swings naturally (no outward arm), no hand inside the skirt/apron, skirt panel gives way softly without popping.
   - back view of walk_loop around f28: light vertical crease/indent on her right side panel is a known residual (should be soft, not a dent).
   - transitions idle→start→loop→stop_bodyL/R and turns: no skirt snap, no wrist flip.

## QA on the COMPRESSED GLB (box, Blender, morph correctives on)
| clip | hand/forearm in dress/apron | dress↔apron cross | legs out of skirt | leg↔dress clear mm | slide herR/herL mm | handoff max° |
|---|---|---|---|---|---|---|
| walk_start | 0 | 0 | 6 (=v4) | 0.9 | 15.57/7.76 (v4 15.36) | 10.3 into loop @1.533 s (hand.R, = baseline mocap), others ≤1.09 |
| walk_loop | 0 | 0 | 7 (=v4) | 0.3 | 10.6/2.62 | — |
| walk_stop_bodyL | 0 | 0 | 0 | 5.2 | 8.83/7.71 | entry 3.57 |
| walk_stop_bodyR | 0 | 0 | 0 | 8.6 | 16.1/14.82 | entry 1.06 |
Max compression error per clip 0.19–0.20°. QA json in `integrate/`.

## Known residuals
- Max skirt avoidance 15.5° on skirt.left (walk_loop); soft back-view crease f28 her right.
- Foot slide unchanged from baseline (turn slide → runtime SoleContactSolver, separate task).
- walk_start→walk_loop hand.R 10.3° handoff is from the mocap, unchanged from baseline.
- Not tested: on-device render, Cocos import, runtime slide (test_walk_driver broken on baseline).
