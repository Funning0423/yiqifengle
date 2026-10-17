# Merging Oi's character and stool (65bdd4c) into Build05 (88506aa)

## Sources
- Oi: `origin/oi/character-stool-static-20261016` @ `65bdd4c24cf002bcf35d614d8ba8e5560db89232` (2026-10-17 02:40 +0800 = Oct 16, 14:40 EDT). It contains only `models/body09-v44-cold5-static-20261016/` (13 files). All 12 entries in its SHA256SUMS verify OK. Its branch point is 01e25e3, not our line.
- Base: `88506aa` (ggbot/build05-final-mac2, stacked on 2607de6).
- Result: branch `grok/build05-oi-char-20261016T1505`, commit `7ecd2890c39043530961e91a0815ddbac986b7ad`, tree `4de33d3921ff3b135af05943dc095ee8da565ca4`. It is local only and has not been pushed. The patch applies cleanly to 88506aa with git am, and the result reproduces the same tree.

## What changed (2 files only)
| Game file | Before | After |
|---|---|---|
| bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb | 42ca2486… 3,482,864 B | bb37efb5… 3,584,600 B (hybrid, see below) |
| bundles/region_island/character_support/reading_chair.glb | d156b7a0… 73,152 B | cadb9b3f… 73,156 B (= Oi's stool-actual-v2.glb as-is) |

There were no conflicts, because the commit only changes these two GLB files. The .meta files, scripts, frozen manifests and the `__characterCandidateIdentity` string (which still says 42ca2486) were all left as they were.

### Why I didn't drop in Oi's character GLB unchanged
Oi's `character-body09-v44-cold5-static-candidate.glb` has no skin binding, no animations (0, versus the original's 14), and none of the original's 15 groups of morph targets / correctives. WorldIntegrationBoot requires a `sit_hold` SkeletalAnimation (`Required initial seated clip missing`), so replacing the file directly would break the home screen with a load error. I did not test that path in Cocos; this conclusion comes from the code.

The hybrid works like this:
- Start from the original rig GLB (42ca2486, which is the same file as Oi's `sources/original-character.glb`).
- Take Oi's static vertices and use candidate08-pose.npz plus the original inverseBind to inverse-skin them back to bind pose (tools/hybrid.py).
- Re-skinning with the candidate08 pose reproduces Oi's static positions with error < 1e-15 m.
- Joints, weights, UVs, colours, indices, materials, textures, morph targets and all 14 clips are byte-for-byte identical to the original: 1,366 accessors compared, 0 differences.
- Vertices that actually moved: DRESS 914/5721 (at most 6.79 mm), APRON 112/690 (at most 2.28 mm), BODY 27 (at most 0.71 mm). BOW and the rest of the body are unchanged.

## Tests (on this box, Node 22, TypeScript 5.9.3)
- run-suite: base 88506aa **34/37**, merge **34/37**, identical item by item.
  - Failing on both: production-integrity (frozen bgm_main.mp3, an existing issue), cloud-web-contract, and navigation-guard BLOCKED_BROWSER.
  - GGbot's environment gave 32/37. The two differences (legacy-board-ui-pure and reward-background-return) pass here and are caused by the environment.
- test_scene_bgm, test_character_handoff, walk-driver (walk_driver/locomotion/action_transitions), foot-support (contact_acceptance/timestep_matrix): all pass on both base and merge.
  - Note: these tests and character-real-glb-endpoints only evaluate the skeleton and animation. **They do not check the skinned mesh**, so they cannot prove the mesh is correct.
- Known issue that isn't flagged: production-integrity stops at the first frozen file, so it never reaches the character or stool. Both files' SHAs in frozen-production-inputs.json are now out of date.

## Package size
No Cocos Creator build was run (Creator isn't available on this box, and I did not touch the Mac), **so there is no measured value**. Source GLB delta: +101,740 B. Vertex, attribute and morph counts are unchanged, so the imported mesh size should change very little. That is an estimate and needs checking with a real build. Last measured value (2607de6, from the Mac): 24,539,994 B; limit 24,641,536 B; headroom about 101 KB.

## Visual checks (Blender 5.2 offline render, not an in-game capture)
Placement follows the code: she is at seatedRoot with yaw -2, and the stool is at the seat_anchor formula with scale 1.2. The ground is a plain plane and the lighting is generic.
- `stills/SHEET_sit_hold_base_vs_merge.png`: sit_hold, 7 views, base vs merge.
- `stills/CMP3_closeside_*.png`, `stills/CMP3_closeseat_*.png`: base / merge / new character on the old stool.
- `stills/SHEET_idle_base_vs_merge.png`: idle_breathing_loop. Note: I placed her at seatedRoot standing, so her legs passing through the stool is an artefact of my setup, not a game problem.
- `stills/SHEET_oiraw_static_and_merge_oldchair.png`: Oi's static GLB as delivered, placed per placement.json.
- No T-pose, no missing textures, and the materials look the same as the original. Scale is the same as the original.

Penetration test against the stool, in sit_hold (`inside_*.txt`, ray parity, vertices inside the stool solid):
| | BODY | BOW | DRESS |
|---|---|---|---|
| base (old character + old stool) | 78 (22 mm) | 8 (15 mm) | 172 (26 mm) |
| merge (new character + stool-v2) | **0** | 8 (16 mm) | 107 (22 mm) |
| new character + old stool | 78 | 8 | 172 |
| old character + stool-v2 | 0 | 8 | 107 |
- The stool-v2 seat is 54.9 mm lower (in game units), so her body goes from 54 mm sunk into the seat to sitting 0.5 mm above it. **That improvement comes entirely from the stool.** In sitting poses, the character's static fix makes no measurable difference to the counts.
- Problems that remain: 107 DRESS vertices sit 0–117 mm below the seat top, 83–195 mm from the stool centre, at most 22 mm deep (skirt into the seat edge / legs). 8 BOW vertices are 12–16 mm below the seat top and 16 mm deep.
- Not measured: Oi's "15 hand/skirt intersections cleared" is a standing-pose (candidate08) self-intersection claim, and I didn't recheck it. Sit_down / stand_up transitions only had their end frames checked, and I didn't make a continuous video.
