# Build05 ground v3 (Voice Bot) on GGbot v3.1 f05c6a3
- Branch voice/build05-journey-ground-v3 (local, not pushed) · commit 0a9161c85ca35f4272d037f8ded311b078a8cb42 · tree da9d88fa1727534fb5b649d418b43c9c7f6ff379 · parent f05c6a3
- Patch SHA256 f28290d03cdf91ff8fe45d2d491687a74da5c223c6095dabdf855a8c3d636d2d (git am on f05c6a3 → tree da9d88f verified)
- env_skycity.glb 1,166,528 → 1,183,444 B (+16,916 B source); sha256 1027dc59…1aa3. Built (raw mesh): +472 verts, +686 tris on env_sky_static_palette only (+ estimated ~20–25 KB; COLOR_0 already present, no new attribute)
- 90–92 s = route d≈36.7–39.1 m; flats = env_sky_static_palette deck triangles 18.84 m² / 76.33 m²; fixed by coplanar subdivision of 25 big tris + vertex-colour noise on 5,035 verts
- glb.meta: only triangleCount synced (foliage 5790→8790, palette 20028→23372). Creator's rewritten meta was deleted with the Mac temp dir, so these values are reconstructed; they match the Mac Creator log (8790) and the new glb triangle counts. No meshCompress.
- 09 board bg diff: mean 0.0007/255 day (3 px >8), 0.0004 night
- cmp_day/night.png: top f05c6a3 art, bottom v3; GGbot v3 lens (cams.json from his journey-scene.cjs) d=35,37,39,46 + board bg. Eevee preview, sky city only, proxy character.
