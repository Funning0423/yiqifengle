# Build05 v4 ground (Voice Bot) on GGbot 764dcd8 (local only, not pushed)
- Branch voice/build05-v4-ground · commit 8125493ba7da1b7417a129dc34c2d2b684b788e8 · tree 09d443872eb4af1110711e0a8233ace1abe30ec6 · parent 764dcd8
- Patch patches/0001-…patch SHA256 ee1d97b2d45587a851d72091c82fddb2d20e9fc4dc08f808b2275f9ef02cc039 (git am on 764dcd8 → tree 09d44387 verified)
- env_skycity.glb 1,183,444 → 1,187,424 B (+3,980 B source, Draco); sha256 6db1c0b479a2f23659b2ed5a7133f9271776d2c36a492870929db38e2f0b1fc6
- Only env_sky_static_palette changed: verts 21,998 → 22,580 (+582), tris 23,372 → 23,826 (+454). COLOR_0 already present.
- Built size estimate (raw interleaved pos/nrm/uv/rgba f32 + u16 idx, zlib-9 like meshCompress): +30.7 KB raw, **+10.9 KB compressed**. Not a Creator build; Mac confirms.
## What changed (93–95 s = journey +30.5–32.5 s = route d≈36.6–39.0 m)
1. Round island top (green cells rows 12–13, x −56…−38, z 58…76): 501 verts recoloured. Stored-sRGB brightness 0.56–1.0 (value noise 1.6 m + per-vertex jitter + 4.5 m field), warm (yellow) / cool (blue-green) patches from a 3.2 m field. No new verts; smooth soft gradients, low-poly shapes untouched.
2. Deck tops (10 connected components of cell 5,12 on the bridge slabs; 6 planar ones re-cut from their convex outline): coplanar re-cut into 0.62 m planks across the travel direction, each = dark seam 5 cm + two grain stripes (×1.0 / ×0.9), per-plank tone 0.80–1.00 and warm/cool, sine+hash variation along the grain. UV moved to the palette wood cell b9946c.
3. No vertex moved off its surface (all new verts lie on the original slab planes) → route 1 m clearance unchanged. 0 faces touched the 09 board frustum (2.0× margin lock). 09 board bg render diff: day mean 0.0009/255 (21 px >8), night 0.0006 (1 px).
## Meta / fixture
- glb.meta: only env_sky_static_palette triangleCount 23372 → 23826 (meshCompress block untouched).
- tools/journey-integration/occlusion/fixture-occluders.json: only the two skycity sha256 pins 1027dc59… → 6db1c0b4… (bin unchanged: deck re-cut is coplanar so occluder surfaces are identical). A full build-fixture.cjs rebuild was NOT run.
## Tests (run-suite.cjs on the box, Node 20): 32/37, identical to 764dcd8 baseline
journey-occlusion, journey-framing, composition-boundaries etc. PASS. Same 5 known non-journey failures: production-integrity (frozen manifest), legacy-board-ui-pure + reward-background-return (Node 20 stripTypeScriptTypes), cloud-web-contract (old cloud build), navigation-guard BLOCKED_BROWSER. Log: suite.log.
## Renders
cmp_day.png / cmp_night.png: top = 764dcd8, bottom = v4; real journeyCamera lens (tools/cams.json via dumpcam.cjs from journey-scene.cjs @764dcd8) at d 36.6 / 37.8 / 39.0. Eevee, unlit emulation (texture × sRGB→linear COLOR_0), night = flat dim tint, proxy character. renders/ also has d34, d46, board09.
Re-run: node tools/v4.mjs base.glb tmp.glb && node tools/splice.mjs base.glb tmp.glb out.glb env_sky_static_palette
