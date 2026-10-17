# Build05 v4.1 ground (Voice Bot) on 8125493, branch voice/build05-v4-ground (local only, not pushed)
- commit 1c21428d3235f16866d879a078df7cf324117d98 · tree 49c90a372aa45349d1b7d1d297733a20a2a99324 · parent 8125493
- patch SHA256 d9cd65b3c49e51f7a429464d6616a9547e8b196d7c310467874aaf2bffa76493 (git am on 8125493 -> tree 49c90a37 verified)
- env_skycity.glb 1,187,424 -> 1,192,016 B (+4,592); sha256 1727cfdb35c3a00517be3c74bc15c604f31cc609a3a61358178a83dffaf1a4b8
- env_sky_static_palette: verts 22,580 -> 23,252 (+672), tris 23,826 -> 24,696 (+870). Other meshes unchanged.
- Built-size estimate (raw f32 pos/nrm/uv/rgba + u16 idx, zlib-9 ~ meshCompress): +37.5 KB raw / +14.3 KB compressed vs 8125493; +25.2 KB compressed vs 764dcd8. Box estimate only.
## Island top (93-95 s)
- Coplanar midpoint split of island-top edges >1.2 m shared by two island-top faces (581 faces split; never on edges shared with side faces -> no cracks, no vertex leaves its surface).
- 808 verts recoloured (COLOR_0 stored sRGB): 4.2 m patches + 1.8 m detail; warm yellow-green (1,1,0.52) on the sun side, cool blue-green (0.70,0.92,1) on the shaded side; brightness 0.60-1.0; darker band (x0.62 -> 1) within 1.1 m of the outer rim (radial rim from the island centre).
## Deck
- 31 remaining green slab edge/strip faces (cells 5,12 / 2,12 / 11,12, sloped) re-cut into the same wood planks; 33 olive raised patch faces on slabs -> wood UV + plank tone (no geometry).
- NOT changed: the 3 green steps next to the city (x -22..-24, z 26..36). 21 of those faces are inside the real 09 board-background frustum (15 more only inside the 2x safety margin), so changing them would change the 09 background. Needs a decision.
## Checks
- meta: only palette triangleCount 23826 -> 24696 (meshCompress untouched). Fixture: only the two skycity sha256 pins 6db1c0b4 -> 1727cfdb (bin unchanged; all edits coplanar).
- 09 board bg render vs 8125493: day 24 px >8 (max 17/255), night 2 px. Ray-cast shows those pixels are on far city ground (x -16..0.8, z -0.5..33) that was not edited; they come from Draco re-encoding coplanar ground (same kind of noise as v4's 21 px). No edited face is in the frustum.
- Suite (run-suite.cjs, Node 20): 32/37, same as 764dcd8/8125493; the same 5 known non-journey failures (production-integrity, 2x Node20 stripTypeScriptTypes, cloud-web-contract, navigation-guard BLOCKED_BROWSER). suite.log.
## Images (top 8125493, bottom v4.1)
- cmp_day.png / cmp_night.png: real journeyCamera at d 36.6 / 37.8 / 39.0.
- cmp_strips_farslab_day.png: close view of the slab edge strips (cam 77) and the steps toward the city (cam 78; the green steps there are the locked board-frustum ones).
- Eevee unlit emulation (texture x sRGB->linear COLOR_0), night = flat dim tint, proxy character.
