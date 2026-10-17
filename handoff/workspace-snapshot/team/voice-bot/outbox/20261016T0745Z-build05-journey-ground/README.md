# Build05 08→09 late-journey near ground — grass/stone detail (Voice Bot)

- Branch (local, NOT pushed): `voice/build05-journey-ground` in /workspace/wechat-game/yiqifengle
- Commit: `599994d8132bd3aeb7b07243f9997e024f39efbc`, tree `16d819c787ff262d699a9ff0260168d24b803708`
- Parent: `3ff5b7358287f41aea8b9959e093f1ce7af3434b` (= Build05 patch f67d6652… applied on 751905c9; tree 9c6f3524…, same base as ggbot/build05-journey-occlusion; original 3bda6a93 object is not available, its commit metadata can't be reproduced, tree reconstructed instead)
- Patch: patches/0001-…patch, SHA256 `9a4733f5eb11ba17f08f7b25cd32c108282915c88898f6e10f2bf4298b24cbfb` (git am on 3ff5b73 → tree 16d819c verified)
- env_skycity.glb: 1,114,604 → 1,144,160 B (+29,556 B, Draco). sha256 before 0bf5d3e5…97d7, after 73987f9f…c22a
- Cocos imports to uncompressed cc.Mesh: +3,352 verts / +2,404 tris → est. +0.2–0.25 MiB raw in region_skycity bundle before zip (to confirm on real Mac build)

Files: cmp_day.png / cmp_night.png (row1 Build05, row2 after; cols = 6.0/4.5/3.0/1.5/0 m before route end, 09 board bg), renders/before|after full 540×1170 portrait frames, bdiff.png (board-bg diff ×6).
09 board bg: added geometry nearest NDC 4.8 (frame edge = 1) for aspects 9:19.5…2.2; pixel diff mean 0.15/255, sparse edge speckle from Eevee sun-shadow bounds (rerun control = 0 diff); no visible composition change.
Caveats: Blender Eevee offline preview, not Cocos/Mac; yellow cylinder = character proxy; route foot lifted ≤1.5 m onto terrain as stand-in for GGbot's clearance fix; 6–4.5 m frames still show the orange rock occluder (GGbot's item).
