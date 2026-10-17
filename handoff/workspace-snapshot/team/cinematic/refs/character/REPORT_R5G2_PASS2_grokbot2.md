# R5G2 character fix — PASS 2 report
agent: grokbot-2 (第二个 Grok Bot) · 2026-10-09 · base: pass1 source (pass1 files untouched; 56/56 pass1 manifest SHA256 re-verified OK). Source saved with Blender 4.5.14; renders with 5.2.2. No Drive writes, no WeChat upload.

## Deliverables
- source/B_R5G2_FIX_PASS2_SOURCE_grokbot2.blend (+ R8 MDDs alongside, MESH_CACHE paths fixed to `//`), source/textures/hat_band_g2_straw_pink_grokbot2.png, source/R5G2_PASS2_CLIPS_grokbot2.json (clip sidecar)
- lod/B_R5G2_PASS2_SOURCE_PLUS_LOD0_grokbot2.blend (collection LOD0_GAME_G2), lod/textures/T_G2_{FACE_1024,HEAD_1024,BODY_1024,DRESS_1024,APRON_512}.png, lod/lod_build_report_p2.json
- export/chr_b_r5g2_lod0_anim_pass2_grokbot2.glb (1,653,348 B) + reimport_check_p2.json, clip_source_p2.json, clip_lod0_p2.json, bodyclip_source_p2.json, seat_sit_p2.json, seat_sit_pass1.json
- renders/00_R5G2_pass2_contact_sheet_grokbot2.png (pass1 vs pass2 source vs pass2 LOD0, 12 views), renders/after_source, renders/after_lod0, renders/R5G2_pass2_wind_sway_loop_lowres_grokbot2.mp4 (400x560, 15 fps, 4.0 s, 60 frames = every 2nd frame)
- scripts/ (p2_*.py), work/ (stage files p2_stage0..6), probe/ (analysis images)

## Goals
| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1a | Hair rebuilt as one clean bob shell | DONE | New object G2_HAIR_BOB_R5G2 (6,947 verts), made from a cylindrical ray-cast field of the old hair: pits filled, smooth envelope 1.5 mm outside the old hair, smoothed hairline/hem, inward hem lip, top tucked under the brim, 4 mm solidify, 100% `head` weight, flat navy material. The old hair is kept but hidden inside the source; in LOD0, 8,207 hidden old-hair faces are deleted. |
| 1b | Jagged brim edge | DONE (mostly) | Taubin smoothing of the 192 rim verts (each moves ≤3 mm); hat protected from decimation in LOD0. The pass1 navy paint on the brim underside is reverted to hat colour. |
| H | Hat straw/tan + pink band (user decision) | DONE | New texture (straw sRGB 0.80/0.69/0.50, pink 0.87/0.47/0.55); the original hat_band.png is unused, not deleted. 79+115 atlas-coloured verts under/at the brim set to straw through G2_FIX. Rebaked into LOD0 T_G2_HEAD_1024. |
| 2 | Relaxed pose | DONE | The pass1 asymmetric forearm twist is undone (arms now symmetric), elbows bent 16°, and this is the new rest pose. Soft finger curl (about 35° at the fingertips, bend from the knuckles toward the palm) is baked into the hand mesh. Arm-to-dress/apron clearance at rest is 19 mm on both sides (before: R −6.9 mm after symmetrising the skirt). |
| 3a | Warmer face | DONE | G2_SKIN_TINT multiply: warm (1, .915, .855) on skin, soft under-jaw and face-side shading. Cheek blush is computed per pixel in the shader from G2_REST_POS (σ 13.5 mm, strength 0.62); eyes and face style are unchanged. Baked into LOD0. The effect is subtle on purpose and could go stronger. |
| 3b | LOD0 neck seam | DONE | M_G2_FACE now covers all head and neck skin with a cylindrical UV (seam at the back of the neck, under the hair), 1024². No front neck seam is visible in renders. |
| 4 | Skirt back into seat (sit) | FIXED, with caveat | 0 dress verts inside the 0.38 m seat-box proxy (pass1: 1,501, 543 of them in the back centre; up to 0.53 m deep). The back and side panels splay about 55° over the seat and the lower panels hang outside the box edges. **Caveat:** with a 0.42×0.40 box this gives a wide "bell over the seat" look. A narrower seat should use less splay. The sit pose is pose data in scripts/p2_poses.py, not a baked clip. Sit hands rest on the lap apron with residual contact: 156–265 hand/forearm verts sit up to 17 mm inside the apron/dress. Clearing it fully forced unnatural hands-up poses, so I rejected that. |
| 5 | Symmetric neutral skirt rest | DONE | Dress and apron mirror-averaged with a KD/BVH mirror sample (topology isn't symmetric). Mirror residual mean: dress 13.8 mm → 0.06 mm, apron 12.0 mm → 0.8 mm (p99 27 mm on the apron tie area, which is asymmetric by design). Skirt bones recentred to x=0, span ±0.187. Re-skinned to ≤4 weights. The R8 wind MDD garments stay hidden as reference. |
| 6 | Clips | DONE | wind_sway_loop and idle_breathing_loop, 120 frames @30 fps (4.0 s), loopable (last key = first), in place (root is identity), no events, muted NLA tracks in the source. The wind is driven only by the 8 skirt bones (dress and apron share them, so they move together). Wind blows toward +X (character's physical LEFT) with a slight forward component, matching the R8 MDD hem drift. The windward panel is damped (0.1) so it doesn't hit the legs. Amplitudes: upper 4°, lower 16° with lag and flutter. The idle has chest/spine ~1.1°/0.5°, neck/head counter-motion, slight arm and skirt motion. Both are in the GLB; re-import shows 2 animations, t 0.033–4.033 s. |
| 7 | Body-vs-body clipping | DONE | BVH overlap test (hands×legs/torso/each other, forearms×torso, legL×legR, hair×torso/arms) at rest, walk, sit, and wind/idle frames 1/31/61/91: 0 overlaps everywhere. A positive control (legL×itself = 300) confirms the test works. Garment clipping over the full wind loop (every 10 frames): 0 leg verts out of the dress, 0 arm verts in the garments (min 25 mm), 0 apron-in-dress. Rest and walk are clean in both source and LOD0. |

## LOD0 / GLB
- Tris: 24,542 (≤25k). Body 18,044 (FACE 3,493 / HEAD 1,666 / BODY 10,285 / HAIR 2,600), dress 5,399, apron 1,099.
- Re-import: 26 joints (22 contract + 4 documented skirt.*.low helpers), ≤4 influences, no JOINTS_1, root scale K = 1.061164379119873, height 1.7253 m, faces +Z, 6 primitives, JPEG textures.
- Hair is a 4th body material M_G2_HAIR (flat colour, double sided, no texture).

## Known issues / not done
1. Sit hands have some contact with the lap apron (≤17 mm), and the sit skirt is bulky (see 4).
2. In LOD0, the hair-shell edge along the jaw/cheek is slightly stair-stepped after decimation, with a thin dark line of old hair at the jaw in close-ups. It is barely visible at game distance.
3. The wind sway is moderate (hem about ±5–8 cm sideways). It is limited by the arm and leg clearance rules, and stronger billow would need arm motion in the clip.
4. The blush/warmth is subtle. It is easy to tune: BSTR/warm values in scripts/p2s4_face.py.
5. Thigh bottoms float about 7 cm above the 0.38 m seat-box top in the sit pose (inherited from the R5 sit root offset −0.555). Worth checking against Oi's seat anchor in Cocos.
6. In the LOD0 body, max weight influences reported 2 before export (4 after re-import); weights are pruned/normalised.
