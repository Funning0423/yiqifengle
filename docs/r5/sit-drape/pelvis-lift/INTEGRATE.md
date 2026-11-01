# Pelvis lift +11 mm (sit_down end / sit_hold / stand_up start), candidate cand1. Includes A1 v4
Candidate (box, too big for docs/, so Grok Bot copies it to the Mac): `previews/角色动画bot/sit-drape-stool/chr_b_r5g2_pelvislift_cand1.glb`
3,342,092 B, sha256 eda257148ac569a95b683f47bc036ad9bd7f305207b2de8b3bf081cd4933a1cc.
It is A1 v4 final (a96226da…, 3,493,824 B) with only sit_down / sit_hold / stand_up replaced; walk and other clips, meshes, morphs and skin are byte-identical in content.
Replaces frozen `creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb` (production bb37efb5…fab3f, 3,584,600 B). Update that sha in `tools/journey-integration/frozen-production-inputs.json`.
Note: this cand1 does NOT contain 角色建模bot's new sit_drape mesh yet. Final = merge its mesh into this animation GLB.
- anim_meta.json: no change (clip names and durations 1.2 / 2.0 / 1.2667 s unchanged, morph curves untouched). seatedRoot unchanged. .meta unchanged (Tangents=Exclude). CharacterMotion.ts unchanged.
- When the BOW sit_drape key from 角色建模bot is merged: anim_meta morph.meshes gets `"LOD0_G2_BOW": {"targets": {"sit_drape": 0}}` (approved; Cursor applies it).
- Manifest rule: after the copy, `node tools/test_manifests.cjs --write`, commit, rerun with no args.
- Compression: `compress_keeptr.py` = compress.py, but it keeps non-rest bone translations (the sit clips translate skirt.*.low/skirt.back). The original compress.py drops them and the skirt then hangs straight down. A1 v4 is unaffected (its sit clips were not recompressed).
On device: sit_down f24–36 no buttock/thigh in the stool; seated gap under the thighs about 10 mm; hands still on the apron; stand_up start no pop.
