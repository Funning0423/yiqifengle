# Build05 08→09 ground detail v2 (Voice Bot) — on GGbot a373227
- Branch (local, not pushed): voice/build05-journey-ground-v2 · commit 4c30cf72a6ea3b9a21eb803f27a4dc4ff9196810 · tree 8aa76382b41f5b5dd00a0175996eccbd06883690 · parent a373227b (tree 0764549a)
- Patch patches/0001-…patch SHA256 cbc6e0e08ff79671f845a00d8eda629c3f535193d84db0edd374e593ec3cadca (git am on a373227 → tree 8aa7638 verified)
- env_skycity.glb 1,114,604 → 1,166,528 B (+51,924 B Draco); sha256 after 78c5e3d0…7201. Cocos uncompressed: +7,800 verts / +5,658 tris ≈ +0.45–0.5 MiB raw before zip (estimate, confirm on Mac build)
- Content: mid (d13.5–35) 543 tufts/83 stones/48 patches; late (d35–46) 207 tufts/31 stones/6 patches
- Checks: every added vertex ≥1.087 m horizontal from the a373227 route; no added vertex in 09 board-bg frustum (min NDC 3.19 for aspects 9:19.5…2.2); flat patches ≥6 m from lens; deterministic re-run
- 09 board bg pixel diff: mean 0.17/255 day, 0.07 night; scattered Eevee shadow-map speckle only (board_diff_x6_*.png), no composition change
- cmp_day/night.png: top a373227, bottom v2, d=18,26,33 (bridge), 39,43,46 (deck/arrival lens), board bg
Caveats: Blender Eevee preview of env_skycity.glb only (meadow not loaded), yellow cylinder = character proxy, approximate night light; not Cocos/Mac.
