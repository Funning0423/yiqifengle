# integration/build05-20261016T2048 — Build05 test integration (local only, not pushed)

Base: b0020ed4ea1f632802ac414c44d0655afdeb34ee (measured Mac build 24,553,771 B).
Gates: 23.5 MiB = 24,641,536 B (safety), 24 MiB = 25,165,824 B (hard).
Commit order: everything else first, result screen merged LAST as one `--no-ff` merge so it can be swapped (see "Swapping the result screen").

## Merged pieces
| # | Piece | Source commits | Integration commits |
|---|---|---|---|
| 1 | Exit camera B5.5 + exit track | ggbot/exit-b55-audio 0005d7a (= cherry-picks of 运镜bot f7fdbab-chain 15b164c..274ac39, Voice Bot 8b22546, GGbot wiring) | fast-forward: f7fdbab..0005d7a |
| 2a | Oi review fixes 1-5 (d238881 line) | e869b09, 1eeae18, a9b814c, c76b6fe, 450f1f5 | 021b935, 147edea, a2fdecf, 1e06f12 (conflict resolved: kept landing-A F7b/F8/F9 checks + Oi's fixture-hash report), efbbc2a |
| 2b | 04→05 set-off fade | 3f3e865 | 30a5048 (conflict: Boot already has 88506aa's fadeCover/tickCover; kept it and only added setScreenCover register/unregister) + 95c208d (port: landing A runs 08→09 at startBlendM 0 too, so the fade is gated on route.from==='island') |
| 3a | Lakeside r5h3 assets → subpackage `region_lakeside` | art/regions/lakeside (COCOS_HANDOFF.md, PACKAGE_PLAN_INPUT.md) | e37dfad, 4dff25f |
| 3b | Character GLB lossless meshCompress (plan A / C1) | team/ggbot/outbox/20261016T204404Z-lakeside-budget-plan | 260c3d5 (single meta change, revert this commit alone if needed) |
| 3c | Lakeside gameplay data + chime rule | LEVELS_DRAFT_lakeside.json | 6f66e2f |
| 4 | Result screen (INTERIM) | ggbot/result-screen-on-688aad3 @ 3765e34 (f7354d3, 3765e34 on top of b0020ed) | merge 62382c4 |

## Lakeside details
- 52 GLBs (55 minus 3 zero-instance models cliff_rock/driftwood/tree_far, -17,088 B) = 984,300 B source; palette PNG 1,803 B (nearest, no mip); LUT 9,050 B; transforms 615 instances (LK_board_frame removed), minified JSON 109,996 B; palette.json. Deterministic uuid5 metas.
- Mesh compression: original GLBs + Cocos meshCompress {compress, quantize, encode}. The gltfpack/meshopt trial files were NOT used: Cocos 3.8 importer does not support EXT_meshopt_compression / KHR_mesh_quantization (cocos-engine issue #13189 still open as of 2026-02; forum reports "[Asset DB] 未支持的 glTF 扩展: KHR_mesh_quantization / EXT_meshopt_compression"). No Cocos Creator on the GGbot box, so the single-asset LK_terrain import comparison is still TODO on the Mac.
- Main package gets only scripts/regional-r05/runtime/lakeside-levels-data.js (4,062 B; gameplay fields + names, designIntent dropped). No lakeside art in the main package. Not added to the shipped catalog, no scene/UI wiring yet (handoff gives assets/specs, no Cocos scene).
- regional-session: region 'lake', goal key 'chimes', rules.chimes; a chime rings once per wave when its cell or a 4-neighbour clears (row special clears the row → each chime in it rings once); phase() falls back to 'calm' when no period; tool null supported. Vendor engine untouched.
- Calibration: tools/lakeside/calibrate.cjs (1-ply greedy, seeds 1-12). Witnesses within draft moves for all 6 (lake-04: 6/12 seeds within 22). Greedy median moves: 01=2, 02=14, 03=2, 04=21, 05=2, 06=5 vs drafts 25/24/24/22/24/26 → drafts look very generous for 01/03/05/06 (engine cascades); moves kept at draft, seedBank = first 3 winning seeds.

## Known issues
1. Exit track is 24 kbps mono 22.05 kHz (60,412 B): no stereo, top end cut ~8-10 kHz, duller wind/sea; nobody has listened yet. Possible doubled wind: the track contains wind + sea bed while WindAudio/AmbienceAudio beds still run. Restore to 32k (+~20 KB) only after the real build shows room.
2. Character GLB compress (260c3d5) needs a device check of walk / sit / stand / skirt-in-wind; revert 260c3d5 on ANY deformation. NOTE: without its saving the lakeside likely pushes the build past 24 MiB (see size).
3. tools/camera-frame-test lens-near-movers needs draco3d (not installed on the box); also needs region_island/combined_visual_m.glb fixture which this tree no longer has.
4. Lakeside: 湖光灯 lamp treated as a special-piece skin; engine has 6 fixed normal types (pieceKinds 5 in drafts 01 is not enforced). Designer may add a 6th normal piece model. Moves are design drafts (see calibration). Wind-chime "湖光灯整行+1" is covered by the row-special clear, not a separate tool. Lakeside not reachable in game yet.
5. Result screen is an interim HEAD (3765e34); rs688 had uncommitted changes (BoardPanels.ts, chest PNGs) that are NOT included.
6. engine.js duplicate (r4-cloud-compat vs regional-r05/vendor) NOT deduplicated: byte-identical but both are required by live code (challenge-session/controller and regional-session), so the "only one is ever loaded" condition fails.
7. board_art/board/tool_* untouched.

## Swapping the result screen
`git reset --hard 95c208d && git merge --no-ff <final>` (final descends from b0020ed), or simply `git merge <final>` on top of 62382c4 if it descends from 3765e34.

## Size (estimate, NOT a build)
Source-byte delta vs b0020ed: +1,235,526 B raw (lakeside 1,144,194 incl. GLB 984,300; scripts +30,066; exit mp3 +60,412).
Built estimate: exit audio+scripts ≤ +91 KB; lakeside with meshCompress ≈ +0.41..0.57 MB (GLB 0.29..0.44 MB est + transforms ~110 KB + textures 11 KB); character compress ≈ -0.9..-1.3 MB (plan estimate, unmeasured).
→ total ≈ 24,314,771 B (conservative) .. 23,754,771 B (optimistic): under the 23.5 MiB gate by ≈ 327..887 KB.
Without the character saving: ≈ +0.50..0.66 MB → ≈ 25,050,000..25,215,000 B, at or over the 24 MiB hard limit.
Must be measured by a Mac build (also LK_terrain single-import check).
