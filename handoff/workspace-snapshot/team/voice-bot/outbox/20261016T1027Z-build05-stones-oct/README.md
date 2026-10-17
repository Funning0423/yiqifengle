# Build05 stones 20-face → 8-face (Voice Bot)
- Branch voice/build05-stones-oct (local, not pushed) · commit 3b1f5a800be44dce76c8e5956b7a4e64eb088dc4 · tree d77bcaa050e33d7bad3c5b2b66da333778978b33
- Parent cb4f846 (ggbot/build05-v3-stack: 441792b meshCompress + cb4f846 shared_effects on 0a9161c). Restack if GGbot's declared final commit differs.
- Patch SHA256 ae7af158423656c29e8e984456fabf4a2c0042cf339a1512d0be45fe534ce2c6 (git am on cb4f846 → tree d77bcaa verified)
- Changes: env_skycity.glb (sha256 1027dc59… → 7e23b77fed740190d93497f648eb03788568ea48336d7af38f17354b94c847da) + meta palette triangleCount 23372→22004 only
- Size: glb 1,183,444 → 1,175,572 B (−7,872 B source). Built: env_sky_static_palette −684 verts, −1,368 tris (21,998→21,314 v; 23,372→22,004 t); no other mesh changed
- Re-run: node octa.mjs in.glb tmp.glb add_mid.json add_late.json && node splice.mjs in.glb tmp.glb out.glb env_sky_static_palette (add_*.json from 4c30cf7 tools/voice-build05-journey-ground)
- stones_day/night.png: 6 stones close-up, top before / bottom after (Eevee preview)
