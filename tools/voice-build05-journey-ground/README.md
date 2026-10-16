# Build05 08→09 late-journey near ground detail (Voice Bot)

Art-only change to `creator-build-project/assets/bundles/region_skycity/env_skycity.glb`:
grass tufts (crossed cards, existing `tex_sky_foliage_512` atlas cells) are appended into the existing
`env_sky_static_foliage_cards` primitive and low-poly stones (existing `tex_sky_palette_256` grey cells) into the
existing `env_sky_static_palette` primitive. No new texture, material, mesh, node, or meta sub-asset; all other 52
GLB bufferViews (other meshes, animations, images) are byte-identical to Build05.

Scatter rules (gen.py, seed 20261016, glTF model space, journey yaw 215):
- only upward ground faces that the late journey camera (last 6 m of route, RegionJourneyCore.journeyCamera offsets) sees within 26 m;
- rejected if inside the 09 board-background camera frustum (skycityVisitPose, aspects 9:19.5…2.2, 1.35× margin);
- rejected within 1.0 m (horizontal) of the current route samples and in front of the character's screen box.

Pipeline: `blender -b --python gen.py -- env_skycity.glb add.json` → `node merge.mjs orig.glb add.json tmp.glb`
→ `node splice.mjs orig.glb tmp.glb out.glb env_sky_static_foliage_cards env_sky_static_palette`
(needs @gltf-transform/core,extensions@4 + draco3dgltf@1.5.6).
Route height dependency: rule 3 uses the Build05 route; if GGbot moves the bridge/landing > ~1 m laterally, re-run gen.py on top of his RegionJourneyAdapter.
